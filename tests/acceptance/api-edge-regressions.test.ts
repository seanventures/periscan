import { randomUUID } from "node:crypto";

import { describe, expect, it, afterEach } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

describe("API edge regression acceptance", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["api-edge-"]);
      await prisma.$disconnect();
    }
  });

  it("preserves policy-binding error codes, audit trail, resolved targets, and bad-cookie behavior", async () => {
    const queuedJobs: unknown[] = [];
    prisma = createPrismaClient();
    // shared probe uses *exact same* prisma instance for test + runtime (real persistence)
    await testHelpers.probeDatabaseConnection(prisma);
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
      // use helper + exercise tenantType MSSP coverage
      const { cookie } = await testHelpers.performSignup(
        app,
        "api-edge-owner",
        "API Edge Tenant",
        "MSSP"
      );

      const scopeValue = `edge-${randomUUID()}.example.com`;
      const scopeResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: scopeValue
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verifyScopeResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          devModeManual: true
        },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verifyScopeResponse.statusCode).toBe(200);

      const decisionTarget = {
        hostname: `validation.${scopeValue}`,
        source: "policy-decision"
      };
      const decisionResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "ActiveNonInvasive",
          target: decisionTarget
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(decisionResponse.statusCode).toBe(201);
      const policyDecisionId = decisionResponse.json()
        .policyDecisionId as string;

      const otherScopeResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `edge-other-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(otherScopeResponse.statusCode).toBe(201);
      const otherScopeId = otherScopeResponse.json().scopeId as string;

      const createMismatchResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: otherScopeId
        },
        url: "/api/v1/missions"
      });
      expect(createMismatchResponse.statusCode).toBe(400);
      expect(createMismatchResponse.json().code).toBe(
        "policy_decision_scope_mismatch"
      );
      expect(queuedJobs).toHaveLength(0);

      // extra 2-3+ for P1/P2 (policy mismatch codes full set incl mission_type using in-mem queue to assert denied-never-queued; complements target/audit in flow)
      const typeDecisionResp = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "ActiveNonInvasive",
          target: { hostname: `type.${scopeValue}` }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(typeDecisionResp.statusCode).toBe(201);
      const typeDecisionId = typeDecisionResp.json().policyDecisionId as string;
      const typeMismatchMission = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          missionType: "ControlValidation",
          policyDecisionId: typeDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(typeMismatchMission.statusCode).toBe(400);
      expect(typeMismatchMission.json().code).toBe(
        "policy_decision_mission_type_mismatch"
      );
      expect(queuedJobs).toHaveLength(0);

      const validMissionResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(validMissionResponse.statusCode).toBe(201);
      const missionId = validMissionResponse.json().missionId as string;

      const startResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"]
        },
        url: `/api/v1/missions/${missionId}/start`
      });
      expect(startResponse.statusCode, startResponse.body).toBe(200);
      expect(startResponse.json().runs[0].target).toEqual(decisionTarget);

      const runsResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "GET",
        url: `/api/v1/missions/${missionId}/runs`
      });
      expect(runsResponse.statusCode).toBe(200);
      expect(runsResponse.json().items[0].target).toEqual(decisionTarget);

      const targetOverrideResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname: `override.${scopeValue}`
          }
        },
        url: `/api/v1/missions/${missionId}/start`
      });
      expect(targetOverrideResponse.statusCode).toBe(400);
      expect(targetOverrideResponse.json().code).toBe(
        "policy_decision_target_mismatch"
      );
      expect(queuedJobs).toHaveLength(1);

      const driftDecisionResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "PassiveReadOnly",
          target: {}
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(driftDecisionResponse.statusCode).toBe(201);
      const driftDecisionId = driftDecisionResponse.json()
        .policyDecisionId as string;

      const driftMissionResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: driftDecisionId,
          safetyLevel: "PassiveReadOnly",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(driftMissionResponse.statusCode).toBe(201);
      const driftMissionId = driftMissionResponse.json().missionId as string;

      await prisma.policyDecision.update({
        data: {
          safetyLevel: "ActiveNonInvasive"
        },
        where: {
          policyDecisionId: driftDecisionId
        }
      });

      const startMismatchResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"]
        },
        url: `/api/v1/missions/${driftMissionId}/start`
      });
      expect(startMismatchResponse.statusCode).toBe(400);
      expect(startMismatchResponse.json().code).toBe(
        "policy_decision_safety_level_mismatch"
      );

      const auditResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "GET",
        url: "/api/v1/audit-events?action=policy.decision&limit=100"
      });
      expect(auditResponse.statusCode).toBe(200);
      expect(auditResponse.json().items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            entityId: policyDecisionId,
            metadata: expect.objectContaining({
              code: "policy_decision_scope_mismatch",
              missionBindingGuard: true,
              outcome: "Denied",
              stage: "create"
            })
          }),
          expect.objectContaining({
            entityId: driftDecisionId,
            metadata: expect.objectContaining({
              code: "policy_decision_safety_level_mismatch",
              missionBindingGuard: true,
              missionId: driftMissionId,
              outcome: "Denied",
              stage: "start"
            })
          }),
          expect.objectContaining({
            entityId: policyDecisionId,
            metadata: expect.objectContaining({
              code: "policy_decision_target_mismatch",
              missionBindingGuard: true,
              missionId,
              outcome: "Denied",
              stage: "start"
            })
          })
        ])
      );

      const badCookie = "not.a.valid.jwt";
      const protectedResponse = await app.inject({
        cookies: testHelpers.authCookies(badCookie),
        method: "GET",
        url: "/api/v1/me"
      });
      expect(protectedResponse.statusCode).toBe(401);
      expect(protectedResponse.json().code).toBe("unauthorized");

      const logoutResponse = await app.inject({
        cookies: testHelpers.authCookies(badCookie),
        method: "POST",
        url: "/api/v1/auth/logout"
      });
      expect(logoutResponse.statusCode).toBe(204);
    } finally {
      if (prisma) {
        await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["api-edge-"]);
      }
      await app.close();
      await prisma?.$disconnect();
    }
  });

  it("rejects fixture posture checks outside dev mode before module execution", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: false,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: false,
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
        "api-edge-posture",
        "API Edge Posture Tenant"
      );
      const userId = response.json().user.userId as string;
      const tenantId = response.json().tenant.tenantId as string;

      const scopeResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `posture-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      await prisma.scope.update({
        data: {
          verificationStatus: "Verified",
          verifiedAt: new Date(),
          verifiedBy: userId
        },
        where: {
          scopeId
        }
      });

      const runCountBefore = await prisma.validationRun.count({
        where: { tenantId }
      });
      const fixtureResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          executionMode: "Fixture",
          fixtures: {
            "periscan.tls_certificate_check": {
              fixtureCertificate: {
                issuer: "CN=Fixture CA",
                subject: "CN=posture.example.com",
                validFrom: new Date(
                  Date.now() - 400 * 24 * 60 * 60 * 1000
                ).toISOString(),
                validTo: new Date(
                  Date.now() - 10 * 24 * 60 * 60 * 1000
                ).toISOString()
              }
            }
          }
        },
        url: `/api/v1/scopes/${scopeId}/posture-check`
      });

      expect(fixtureResponse.statusCode).toBe(400);
      expect(fixtureResponse.json()).toMatchObject({
        code: "fixture_mode_disabled"
      });

      const runCountAfter = await prisma.validationRun.count({
        where: { tenantId }
      });
      expect(runCountAfter).toBe(runCountBefore);

      const scope = await prisma.scope.findUniqueOrThrow({
        where: { scopeId }
      });
      expect(scope.lastPostureCheckAt).toBeNull();
      expect(scope.nextPostureCheckAt).toBeNull();
    } finally {
      await app.close();
    }
  });

  it("rejects fixture control verdicts outside dev mode before observer execution", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: false,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: false,
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
        "api-edge-control",
        "API Edge Control Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;

      const integration = await prisma.integration.create({
        data: {
          authType: "mock",
          category: "SecurityControl",
          config: {
            connectorKey: "splunk",
            mockMode: true
          },
          healthStatus: "Unknown",
          permissionsSummary: [],
          product: "Splunk",
          status: "Connected",
          tenantId,
          vendor: "Splunk"
        }
      });
      const controlSource = await prisma.controlSource.create({
        data: {
          controlType: "SIEM",
          expectedBehaviors: ["Detected", "Logged", "Alerted"],
          healthStatus: "Unknown",
          integrationId: integration.integrationId,
          provider: "Splunk",
          telemetryStatus: "Unknown",
          tenantId
        }
      });

      const runCountBefore = await prisma.validationRun.count({
        where: { tenantId }
      });
      const fixtureResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          dryRun: true,
          fixtureOutcome: "Missed",
          techniqueId: "T1595"
        },
        url: `/api/v1/control-sources/${controlSource.controlSourceId}/validate`
      });

      expect(fixtureResponse.statusCode).toBe(400);
      expect(fixtureResponse.json()).toMatchObject({
        code: "fixture_mode_disabled"
      });

      const runCountAfter = await prisma.validationRun.count({
        where: { tenantId }
      });
      expect(runCountAfter).toBe(runCountBefore);

      const unchangedControlSource =
        await prisma.controlSource.findUniqueOrThrow({
          where: { controlSourceId: controlSource.controlSourceId }
        });
      expect(unchangedControlSource.lastValidatedAt).toBeNull();
      expect(unchangedControlSource.healthStatus).toBe("Unknown");
      expect(unchangedControlSource.telemetryStatus).toBe("Unknown");
    } finally {
      await app.close();
    }
  });

  it("rejects mock integration creation outside dev mode before persistence", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: false,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: false,
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
        "api-edge-integration",
        "API Edge Integration Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;

      const countBefore = await prisma.integration.count({
        where: { tenantId }
      });
      const mockModeResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          connectorKey: "github",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(mockModeResponse.statusCode).toBe(400);
      expect(mockModeResponse.json()).toMatchObject({
        code: "fixture_mode_disabled"
      });

      const mockAuthResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          authType: "mock",
          connectorKey: "github"
        },
        url: "/api/v1/integrations"
      });

      expect(mockAuthResponse.statusCode).toBe(400);
      expect(mockAuthResponse.json()).toMatchObject({
        code: "fixture_mode_disabled"
      });

      const mockShortcutResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {},
        url: "/api/v1/integrations/jira/mock-connect"
      });

      expect(mockShortcutResponse.statusCode).toBe(400);
      expect(mockShortcutResponse.json()).toMatchObject({
        code: "fixture_mode_disabled"
      });

      const countAfter = await prisma.integration.count({
        where: { tenantId }
      });
      expect(countAfter).toBe(countBefore);
    } finally {
      await app.close();
    }
  });

  it("rejects fixture mission targets outside dev mode before policy or queue writes", async () => {
    const queuedJobs: unknown[] = [];
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: false,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: false,
        missionQueue: {
          async enqueueValidationJob(payload) {
            queuedJobs.push(payload);
          }
        },
        prisma
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "api-edge-mission-target",
        "API Edge Mission Target Tenant"
      );
      const userId = response.json().user.userId as string;
      const tenantId = response.json().tenant.tenantId as string;

      const scopeResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `mission-target-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      const scopeValue = scopeResponse.json().value as string;

      await prisma.scope.update({
        data: {
          verificationStatus: "Verified",
          verifiedAt: new Date(),
          verifiedBy: userId
        },
        where: { scopeId }
      });

      const decisionCountBefore = await prisma.policyDecision.count({
        where: { tenantId }
      });
      const rejectedDecision = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "ActiveNonInvasive",
          target: {
            hostname: scopeValue,
            nested: { fixtureReportPath: "/tmp/fake-report.json" }
          }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });

      expect(rejectedDecision.statusCode).toBe(400);
      expect(rejectedDecision.json()).toMatchObject({
        code: "fixture_mode_disabled"
      });
      expect(await prisma.policyDecision.count({ where: { tenantId } })).toBe(
        decisionCountBefore
      );

      const validDecision = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "ActiveNonInvasive",
          target: { hostname: scopeValue }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(validDecision.statusCode, validDecision.body).toBe(201);

      const missionResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: validDecision.json().policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(missionResponse.statusCode, missionResponse.body).toBe(201);
      const missionId = missionResponse.json().missionId as string;
      const runCountBefore = await prisma.validationRun.count({
        where: { tenantId }
      });

      const rejectedStart = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            fixtureMode: true,
            hostname: scopeValue
          }
        },
        url: `/api/v1/missions/${missionId}/start`
      });

      expect(rejectedStart.statusCode).toBe(400);
      expect(rejectedStart.json()).toMatchObject({
        code: "fixture_mode_disabled"
      });
      expect(await prisma.validationRun.count({ where: { tenantId } })).toBe(
        runCountBefore
      );
      expect(queuedJobs).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("rejects fixture engagement targets outside dev mode before persistence or execution", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: false,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: false,
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
        "api-edge-engagement-target",
        "API Edge Engagement Target Tenant"
      );
      const userId = response.json().user.userId as string;
      const tenantId = response.json().tenant.tenantId as string;

      const scopeResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `engagement-target-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      await prisma.scope.update({
        data: {
          verificationStatus: "Verified",
          verifiedAt: new Date(),
          verifiedBy: userId
        },
        where: { scopeId }
      });

      const engagementCountBefore = await prisma.engagement.count({
        where: { tenantId }
      });
      const runCountBefore = await prisma.validationRun.count({
        where: { tenantId }
      });
      const evidenceCountBefore = await prisma.evidenceArtifact.count({
        where: { tenantId }
      });

      const fixtureResponse = await app.inject({
        cookies: testHelpers.authCookies(cookie),
        method: "POST",
        payload: {
          mode: "Execute",
          plan: [
            {
              moduleId: "periscan.dns_resolution_check",
              target: {
                nested: {
                  fixtureMode: true
                }
              }
            }
          ],
          scopeId
        },
        url: "/api/v1/engagements"
      });

      expect(fixtureResponse.statusCode).toBe(400);
      expect(fixtureResponse.json()).toMatchObject({
        code: "fixture_mode_disabled"
      });
      expect(await prisma.engagement.count({ where: { tenantId } })).toBe(
        engagementCountBefore
      );
      expect(await prisma.validationRun.count({ where: { tenantId } })).toBe(
        runCountBefore
      );
      expect(await prisma.evidenceArtifact.count({ where: { tenantId } })).toBe(
        evidenceCountBefore
      );
    } finally {
      await app.close();
    }
  });
});
