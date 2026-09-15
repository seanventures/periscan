import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS } from "../../packages/shared/src/fix-verification.js";
import * as testHelpers from "./helpers.js";

describe("Fix verification retests external exposure remediations with measured posture modules", () => {
  it("dispatches DNS/TLS/HTTP/email retest modules against the verified scope hostname", async () => {
    const prisma = createPrismaClient();
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
        prisma
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "fix-posture",
        "Fix Posture Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const hostname = `fix-posture-${randomUUID()}.example.com`;
      const scopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: hostname
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verifyScopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verifyScopeResponse.statusCode).toBe(200);

      const entryNodeId = randomUUID();
      const impactNodeId = randomUUID();
      const path = await prisma.attackPath.create({
        data: {
          confidence: 0.9,
          entryNodeId,
          evidenceBasis: "Measured",
          evidenceIds: [],
          impactNodeId,
          impactScore: 81,
          name: "Public external TLS exposure to production workload",
          tenantId,
          validationState: "Reachable"
        }
      });
      await prisma.pathNode.createMany({
        data: [
          {
            entityId: randomUUID(),
            entityType: "Exposure",
            evidenceIds: [],
            label: "Public external service",
            pathId: path.pathId,
            pathNodeId: entryNodeId,
            sequence: 0,
            tenantId
          },
          {
            entityId: randomUUID(),
            entityType: "Asset",
            evidenceIds: [],
            label: "Production workload",
            pathId: path.pathId,
            pathNodeId: impactNodeId,
            sequence: 1,
            tenantId
          }
        ]
      });

      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [],
          owner: "Security engineering",
          recommendedAction:
            "Restrict public external exposure and enforce modern TLS.",
          relatedPathId: path.pathId,
          status: "VerificationPending",
          technicalSteps: [
            "Remove public exposure",
            "Re-run measured external posture validation"
          ],
          tenantId,
          verificationMethod:
            "Rerun public external DNS, TLS, HTTP, and email posture checks.",
          verificationRequired: true
        }
      });

      const verifyResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediation.remediationId}/verify`
      });
      expect(verifyResponse.statusCode).toBe(200);
      expect(verifyResponse.json().mission.safetyLevel).toBe(
        "ActiveNonInvasive"
      );
      expect(verifyResponse.json().verificationEvent.outcome).toBe("Fixed");
      expect(verifyResponse.json().verificationEvent.measuredRevalidation).toBe(
        true
      );
      expect(verifyResponse.json().verificationEvent.retestMethod).toBe(
        "validation-module"
      );
      expect(verifyResponse.json().run.target.selectedModuleIds).toEqual([
        ...EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS
      ]);
      expect(verifyResponse.json().run.target.hostname).toBe(hostname);
      expect(verifyResponse.json().run.target.fixtureMode).toBe(true);

      const runs = await prisma.validationRun.findMany({
        orderBy: { createdAt: "asc" },
        where: {
          missionId: verifyResponse.json().mission.missionId,
          tenantId
        }
      });

      expect(runs.map((run) => run.moduleId)).toEqual([
        ...EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS
      ]);
      expect(
        runs.every((run) => typeof run.policyDecisionId === "string")
      ).toBe(true);
      expect(
        runs.every(
          (run) =>
            typeof run.target === "object" &&
            run.target !== null &&
            (run.target as Record<string, unknown>).hostname === hostname &&
            (run.target as Record<string, unknown>).fixtureMode === true
        )
      ).toBe(true);
      expect(runs.every((run) => run.status === "Completed")).toBe(true);
    } finally {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["fix-posture"]);
      await app.close();
      await prisma.$disconnect();
    }
  }, 60_000);

  it("denies unverified external exposure retests without creating queued work", async () => {
    const prisma = createPrismaClient();
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
        prisma
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "fix-posture-denied",
        "Fix Posture Denied Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const scopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `fix-posture-denied-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);

      const entryNodeId = randomUUID();
      const impactNodeId = randomUUID();
      const path = await prisma.attackPath.create({
        data: {
          confidence: 0.9,
          entryNodeId,
          evidenceBasis: "Measured",
          evidenceIds: [],
          impactNodeId,
          impactScore: 81,
          name: "Public external TLS exposure to production workload",
          tenantId,
          validationState: "Reachable"
        }
      });
      await prisma.pathNode.createMany({
        data: [
          {
            entityId: randomUUID(),
            entityType: "Exposure",
            evidenceIds: [],
            label: "Public external service",
            pathId: path.pathId,
            pathNodeId: entryNodeId,
            sequence: 0,
            tenantId
          },
          {
            entityId: randomUUID(),
            entityType: "Asset",
            evidenceIds: [],
            label: "Production workload",
            pathId: path.pathId,
            pathNodeId: impactNodeId,
            sequence: 1,
            tenantId
          }
        ]
      });

      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [],
          owner: "Security engineering",
          recommendedAction:
            "Restrict public external exposure and enforce modern TLS.",
          relatedPathId: path.pathId,
          status: "VerificationPending",
          technicalSteps: ["Re-run measured external posture validation"],
          tenantId,
          verificationMethod:
            "Rerun public external DNS, TLS, HTTP, and email posture checks.",
          verificationRequired: true
        }
      });

      const denied = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediation.remediationId}/verify`
      });
      expect(denied.statusCode).toBe(400);
      expect(denied.json().code).toBe("fix_verification_policy_denied");

      await expect(
        prisma.validationMission.count({
          where: {
            missionType: "FixVerification",
            tenantId
          }
        })
      ).resolves.toBe(0);
      await expect(
        prisma.validationRun.count({
          where: {
            tenantId
          }
        })
      ).resolves.toBe(0);
      const policyDecision = await prisma.policyDecision.findFirstOrThrow({
        where: {
          missionType: "FixVerification",
          tenantId
        }
      });
      expect(policyDecision.outcome).toBe("RequiresVerifiedScope");
      await expect(
        prisma.auditEvent.count({
          where: {
            action: "policy_decision",
            entityId: policyDecision.policyDecisionId,
            tenantId
          }
        })
      ).resolves.toBe(1);
    } finally {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "fix-posture-denied"
      ]);
      await app.close();
      await prisma.$disconnect();
    }
  }, 60_000);
});
