import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("identity.cred_spray owned-account safety (jobsQueued)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "identity-spray-safety"
      ]);
      await testHelpers.disconnectPrismaClient(prisma);
    }
  });

  it("internet/unscoped spray stays Forbidden and never queues jobs", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const queuedJobs: unknown[] = [];
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob(payload) {
            queuedJobs.push(payload);
          }
        },
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "identity-spray-safety",
        "Identity Spray Safety Tenant"
      );
      const auth = { [SESSION_COOKIE_NAME]: cookie };

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "IPRange",
          value: "10.0.0.0/24"
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;

      const verify = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      const decision = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          adminApproval: true,
          executionEnvironment: "InternalRunner",
          explicitMissionApproval: true,
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction({
            requiresInternalRunner: true
          }),
          safetyLevel: "ControlledValidation",
          target: {
            sprayMode: "internet",
            targetHost: "login.microsoftonline.com"
          }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(decision.statusCode).toBe(201);
      expect(decision.json().outcome).toBe("Allowed");

      const mission = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: decision.json().policyDecisionId,
          safetyLevel: "ControlledValidation",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(mission.statusCode).toBe(201);

      const start = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          moduleIds: ["identity.cred_spray"],
          target: {
            approvalId: randomUUID(),
            authorizedOffensive: true,
            sprayMode: "internet",
            targetHost: "login.microsoftonline.com"
          }
        },
        url: `/api/v1/missions/${mission.json().missionId}/start`
      });

      expect(start.statusCode).toBe(200);
      expect(start.json().jobsQueued).toBe(0);
      expect(start.json().mission.status).toBe("DeniedByPolicy");
      expect(queuedJobs).toHaveLength(0);
    } finally {
      await app.close();
    }
  });
});
