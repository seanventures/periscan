import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * P0 catalog honesty: subscribers to `policy.denied` must get a delivery row
 * when policy actually denies work (admin deny → mission start DeniedByPolicy).
 */
describe("policy.denied webhook emission", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "policy-denied-wh"
      ]);
      await prisma.$disconnect();
    }
  });

  it("emits policy.denied delivery on admin deny and mission start gate deny", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma,
        webhookQueue: null
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "policy-denied-wh",
        "policy-denied-wh Tenant"
      );

      const webhookResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          events: ["policy.denied"],
          url: "https://example.test/policy-denied"
        },
        url: "/api/v1/tenants/current/webhooks"
      });
      expect(webhookResponse.statusCode).toBe(201);
      const webhookId = webhookResponse.json().webhookId as string;

      const scopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `policy-denied-${Date.now()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verify = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      // ControlledValidation without explicit mission approval → RequiresApproval.
      const preview = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "ControlledValidation",
          target: { hostname: scopeResponse.json().value }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(preview.statusCode).toBe(201);
      expect(preview.json().outcome).toBe("RequiresApproval");
      const policyDecisionId = preview.json().policyDecisionId as string;

      const missionResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId,
          safetyLevel: "ControlledValidation",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(missionResponse.statusCode).toBe(201);
      const missionId = missionResponse.json().missionId as string;

      const deny = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        url: `/api/v1/approvals/${policyDecisionId}/deny`
      });
      expect(deny.statusCode).toBe(200);
      expect(deny.json().approvalState).toBe("Rejected");

      const adminDenyDeliveries = await prisma.webhookDelivery.findMany({
        where: {
          eventType: "policy.denied",
          webhookId
        }
      });
      expect(adminDenyDeliveries.length).toBeGreaterThanOrEqual(1);
      const adminDeny = adminDenyDeliveries.find((delivery) => {
        const payload = delivery.payload as Record<string, unknown>;
        return payload.stage === "admin_deny";
      });
      expect(adminDeny).toBeDefined();
      expect(adminDeny?.payload).toMatchObject({
        policyDecisionId,
        scopeId,
        stage: "admin_deny"
      });

      const start = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: { moduleIds: ["nuclei.external_exposure_safe"] },
        url: `/api/v1/missions/${missionId}/start`
      });
      expect(start.statusCode).toBe(200);
      expect(start.json().mission.status).toBe("DeniedByPolicy");
      expect(start.json().jobsQueued).toBe(0);

      const startDenyDeliveries = await prisma.webhookDelivery.findMany({
        where: {
          eventType: "policy.denied",
          webhookId
        }
      });
      const startDeny = startDenyDeliveries.find((delivery) => {
        const payload = delivery.payload as Record<string, unknown>;
        return payload.stage === "mission_start";
      });
      expect(startDeny).toBeDefined();
      expect(startDeny?.payload).toMatchObject({
        missionId,
        policyDecisionId,
        scopeId,
        stage: "mission_start"
      });

      const listDeliveries = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "GET",
        url: `/api/v1/tenants/current/webhook-deliveries?webhookId=${webhookId}`
      });
      expect(listDeliveries.statusCode).toBe(200);
      expect(
        listDeliveries
          .json()
          .items.filter(
            (item: { eventType: string }) => item.eventType === "policy.denied"
          ).length
      ).toBeGreaterThanOrEqual(2);
    } finally {
      await app.close();
    }
  }, 45_000);
});
