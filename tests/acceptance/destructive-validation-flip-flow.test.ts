import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";
function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

const SAFE_ACTION = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresInternalRunner: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
};

async function buildTestApp(prisma: ReturnType<typeof createPrismaClient>) {
  return buildApp({
    devMode: true,
    services: createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: {
        async enqueueValidationJob() {
          return;
        }
      },
      prisma
    })
  });
}

describe("destructive-validation authorization tier", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "destructive-owner"
      ]);
      await prisma.$disconnect();
    }
  });

  it("gates destructive/real-payload validation behind the tier + per-mission approval, keeps uncontrolled chaining permanently denied, and audits", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "destructive-owner",
        "Destructive Tenant"
      );
      const auth = authCookies(cookie);

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          maxSafetyLevel: "AdvancedAdversarial",
          scopeType: "Domain",
          value: "destructive.example.com"
        },
        url: "/api/v1/scopes"
      });
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const preview = (
        action = SAFE_ACTION,
        adminApproval = false,
        explicitMissionApproval = false
      ) =>
        app.inject({
          cookies: auth,
          method: "POST",
          payload: {
            adminApproval,
            executionEnvironment: "InternalRunner",
            explicitMissionApproval,
            missionType: "ControlValidation",
            requestedAction: action,
            safetyLevel: "AdvancedAdversarial",
            target: { hostname: "destructive.example.com" }
          },
          url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
        });

      const DESTRUCTIVE = { ...SAFE_ACTION, destructive: true };

      // Default OFF: destructive is denied even with full approvals.
      const before = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/tenants/current/safety-settings"
      });
      expect(before.json().destructiveValidationEnabled).toBe(false);
      expect((await preview(DESTRUCTIVE, true, true)).json().outcome).toBe(
        "Denied"
      );

      // The OFFENSIVE flip alone does NOT authorize destructive validation.
      await app.inject({
        cookies: auth,
        method: "PUT",
        payload: {
          authorizationReference: "SOW-offensive-only",
          enabled: true
        },
        url: "/api/v1/tenants/current/safety-settings/offensive-validation"
      });
      expect((await preview(DESTRUCTIVE, true, true)).json().outcome).toBe(
        "Denied"
      );

      // Enabling the destructive tier requires an authorization reference.
      const missingRef = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: { enabled: true },
        url: "/api/v1/tenants/current/safety-settings/destructive-validation"
      });
      expect(missingRef.statusCode).toBe(400);

      // Enable the destructive tier with an attestation reference.
      const enable = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: {
          authorizationReference:
            "SOW-2026-021: customer-authorized destructive validation of owned lab assets",
          enabled: true
        },
        url: "/api/v1/tenants/current/safety-settings/destructive-validation"
      });
      expect(enable.statusCode).toBe(200);
      expect(enable.json().destructiveValidationEnabled).toBe(true);
      expect(enable.json().destructiveAuthorizedBy).toBeTruthy();

      // Tier ON + admin approval but NO per-mission approval → not auto-allowed.
      expect((await preview(DESTRUCTIVE, true, false)).json().outcome).toBe(
        "RequiresApproval"
      );

      // Tier ON + admin approval + explicit per-mission approval → allowed.
      expect((await preview(DESTRUCTIVE, true, true)).json().outcome).toBe(
        "Allowed"
      );

      // Uncontrolled exploit chaining is NEVER permitted, tier or not.
      expect(
        (
          await preview(
            { ...SAFE_ACTION, uncontrolledExploitChaining: true },
            true,
            true
          )
        ).json().outcome
      ).toBe("Denied");

      // Audited.
      const auditRow = await prisma.auditEvent.findFirst({
        where: { action: "destructive_validation_changed" }
      });
      expect(auditRow).toBeTruthy();

      // Revoking returns to the denied-by-default state.
      const disable = await app.inject({
        cookies: auth,
        method: "PUT",
        payload: { enabled: false },
        url: "/api/v1/tenants/current/safety-settings/destructive-validation"
      });
      expect(disable.json().destructiveValidationEnabled).toBe(false);
      expect((await preview(DESTRUCTIVE, true, true)).json().outcome).toBe(
        "Denied"
      );
    } finally {
      await app.close();
    }
  });
});
