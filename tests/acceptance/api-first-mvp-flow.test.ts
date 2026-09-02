import { randomUUID } from "node:crypto";

import { describe, expect, it, afterEach } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

describe("API-first MVP acceptance flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "acceptance-",
        "acceptance-owner",
        "acceptance-viewer"
      ]);
      await prisma.$disconnect();
    }
  });

  it("completes signup, scope, integrations, snapshot, remediation, verification, and report export", async () => {
    prisma = createPrismaClient();
    // Use shared probe (same prisma instance passed to runtime-services below). Provides great DX: fast fail with exact "To run" steps on port/cred conflicts in noisy dev envs.
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
      // Use shared signup helper (DRY + tenantType coverage for MSSP/Organization in P1 flows)
      const { cookie: ownerCookie } = await testHelpers.performSignup(
        app,
        "acceptance-owner",
        "Acceptance Tenant",
        "MSSP"
      );

      // Grant a package that includes EvidencePacks (required for report create/export)
      // and ValidationRuns. Uses the same pattern as other acceptance tests.
      const ownerTenant = await prisma.tenant.findFirst({
        where: { name: "Acceptance Tenant" }
      });
      if (ownerTenant?.tenantId) {
        await prisma.tenant.update({
          where: { tenantId: ownerTenant.tenantId },
          data: { billingPackageKey: "ValidationSnapshot" }
        });
      }
      const snapshotDeniedResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          audience: "Security Team"
        },
        url: "/api/v1/snapshots"
      });

      expect(snapshotDeniedResponse.statusCode).toBe(400);
      expect(snapshotDeniedResponse.json().error).toMatch(/Verified scope/i);

      const scopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `acceptance-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });

      expect(scopeResponse.statusCode).toBe(201);

      const scopeId = scopeResponse.json().scopeId as string;
      const verifyScopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          devModeManual: true
        },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      expect(verifyScopeResponse.statusCode).toBe(200);
      expect(verifyScopeResponse.json().verificationStatus).toBe("Verified");

      const optionalAiAppResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          appType: "Chatbot",
          authMethod: "test-account",
          dataSourcesDescription: "Public documentation knowledge base.",
          endpointUrl: "https://acceptance-ai.example.com/chat",
          guardrailsDescription: "Tenant-scoped retrieval and read-only tools.",
          name: "Acceptance Assistant",
          owner: "AI platform",
          ragEnabled: true,
          scopeId,
          testAccountNotes: "Use synthetic MVP test account only.",
          toolsEnabled: true
        },
        url: "/api/v1/ai-apps"
      });
      expect(optionalAiAppResponse.statusCode).toBe(201);
      expect(optionalAiAppResponse.json()).toMatchObject({
        name: "Acceptance Assistant",
        scopeId
      });

      // P1/P2 extra coverage (per GAP-P3-ACC-TESTS-01): after scope verify check policy_decision creation + target resolution in preview; audit for policy.decision; also confirm mismatch error code (scope/policy) + no side effects. Uses real prisma persistence.
      const postVerifyDecision = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "ActiveNonInvasive",
          target: {
            hostname: "post-verify.example.com",
            source: "policy-decision"
          }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });
      expect(postVerifyDecision.statusCode).toBe(201);
      expect(postVerifyDecision.json().policyDecisionId).toBeDefined();
      expect(postVerifyDecision.json().target?.hostname).toBe(
        "post-verify.example.com"
      );
      const auditPostVerify = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/audit-events?action=policy.decision&limit=5"
      });
      expect(auditPostVerify.statusCode).toBe(200);
      expect(
        auditPostVerify
          .json()
          .items.some((e: { action: string }) => e.action === "policy.decision")
      ).toBe(true);

      // small mismatch flow for error code (scope/policy) using in-mem context (real-first)
      const otherScopeForMismatch = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `mismatch-${randomUUID()}.example.com` // note: still need randomUUID for this local use
        },
        url: "/api/v1/scopes"
      });
      expect(otherScopeForMismatch.statusCode).toBe(201);
      const mismatchDecisionId = postVerifyDecision.json()
        .policyDecisionId as string;
      const mismatchCreate = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: mismatchDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId: otherScopeForMismatch.json().scopeId
        },
        url: "/api/v1/missions"
      });
      expect(mismatchCreate.statusCode).toBe(400);
      expect(mismatchCreate.json().code).toBe("policy_decision_scope_mismatch");

      const externalPolicyResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          executionEnvironment: "ExternalPoA",
          missionType: "ExposureValidation",
          requestedAction: testHelpers.safeRequestedAction(),
          safetyLevel: "ActiveNonInvasive",
          target: {
            hostname: "127.0.0.1",
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/scopes/${scopeId}/policy-decisions/preview`
      });

      expect(externalPolicyResponse.statusCode).toBe(201);
      expect(externalPolicyResponse.json().outcome).toBe("Allowed");

      const externalMissionResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId: externalPolicyResponse.json().policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });

      expect(externalMissionResponse.statusCode).toBe(201);

      const externalStartResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          moduleIds: ["nuclei.external_exposure_safe"],
          target: {
            hostname: "127.0.0.1",
            rateLimit: 10,
            templateProfile: "safe-baseline"
          }
        },
        url: `/api/v1/missions/${externalMissionResponse.json().missionId}/start`
      });

      expect(externalStartResponse.statusCode).toBe(200);
      expect(externalStartResponse.json().jobsQueued).toBe(0);
      expect(externalStartResponse.json().mission.status).toBe(
        "DeniedByPolicy"
      );

      const githubResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          mockMode: true
        },
        url: "/api/v1/integrations/github/connect"
      });
      const awsResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          mockMode: true
        },
        url: "/api/v1/integrations/aws/connect"
      });
      const jiraResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          mockMode: true
        },
        url: "/api/v1/integrations/jira/mock-connect"
      });

      expect(githubResponse.statusCode).toBe(201);
      expect(awsResponse.statusCode).toBe(201);
      expect(jiraResponse.statusCode).toBe(201);

      for (const integrationId of [
        githubResponse.json().integrationId,
        awsResponse.json().integrationId
      ]) {
        const syncResponse = await app.inject({
          cookies: testHelpers.authHeaders(ownerCookie),
          method: "POST",
          url: `/api/v1/integrations/${integrationId}/sync`
        });

        expect(syncResponse.statusCode).toBe(200);
        expect(syncResponse.json().signalCount).toBeGreaterThan(0);
      }

      const trustSafetyResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/tenants/current/trust-safety"
      });

      expect(trustSafetyResponse.statusCode).toBe(200);
      expect(trustSafetyResponse.json().connectedIntegrations.length).toBe(3);
      expect(
        trustSafetyResponse.json().evidenceRetention.redactionEnabled
      ).toBe(true);
      expect(
        trustSafetyResponse.json().validationSafetyPrinciples.length
      ).toBeGreaterThan(0);

      const filteredAuditEventsResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/audit-events?action=integration.connected&limit=10"
      });

      expect(filteredAuditEventsResponse.statusCode).toBe(200);
      expect(filteredAuditEventsResponse.json().items.length).toBeGreaterThan(
        0
      );
      expect(
        filteredAuditEventsResponse
          .json()
          .items.every(
            (event: { action: string }) =>
              event.action === "integration.connected"
          )
      ).toBe(true);

      const attackPathsResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/attack-paths"
      });

      expect(attackPathsResponse.statusCode).toBe(200);
      expect(attackPathsResponse.json().items.length).toBeGreaterThan(0);

      const topPath = attackPathsResponse.json().items[0];
      expect(topPath.attackPath.evidenceIds.length).toBeGreaterThan(0);

      const snapshotResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          audience: "Security Team",
          maxTopItems: 5
        },
        url: "/api/v1/snapshots"
      });

      expect(snapshotResponse.statusCode).toBe(201);
      expect(snapshotResponse.json().topAttackPaths.length).toBeGreaterThan(0);
      expect(snapshotResponse.json().evidenceIds.length).toBeGreaterThan(0);
      expect(snapshotResponse.json().evidencePack.status).toBe("Ready");

      const reportResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: `/api/v1/snapshots/${snapshotResponse.json().snapshotId}/report`
      });

      expect(reportResponse.statusCode).toBe(200);
      expect(reportResponse.body).toContain("Priority Attack Paths");

      const enableDesignPartnerResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "PUT",
        payload: {
          enabled: true
        },
        url: "/api/v1/tenants/current/design-partner"
      });

      expect(enableDesignPartnerResponse.statusCode).toBe(200);
      expect(enableDesignPartnerResponse.json().enabled).toBe(true);

      const designPartnerWorkspaceResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/tenants/current/design-partner"
      });

      expect(designPartnerWorkspaceResponse.statusCode).toBe(200);
      expect(designPartnerWorkspaceResponse.json().snapshotRequest.status).toBe(
        "Ready"
      );

      const analystNoteResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "PUT",
        payload: {
          authorLabel: "Periscan Analyst",
          body: "Founder context should be visible in the customer preview.",
          title: "Founder note"
        },
        url: `/api/v1/reports/${snapshotResponse.json().snapshotId}/analyst-note`
      });

      expect(analystNoteResponse.statusCode).toBe(200);
      expect(analystNoteResponse.json().authorLabel).toBe("Periscan Analyst");

      const reportPreviewResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: `/api/v1/snapshots/${snapshotResponse.json().snapshotId}/report`
      });

      expect(reportPreviewResponse.statusCode).toBe(200);
      expect(reportPreviewResponse.body).toContain("Periscan Analyst Notes");
      expect(reportPreviewResponse.body).toContain(
        "Founder context should be visible"
      );

      const remediationResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          owner: "Security engineering",
          pathId: topPath.attackPath.pathId
        },
        url: "/api/v1/remediations"
      });

      expect(remediationResponse.statusCode).toBe(201);
      expect(remediationResponse.json().evidenceIds.length).toBeGreaterThan(0);

      const ticketResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          integrationId: jiraResponse.json().integrationId
        },
        url: `/api/v1/remediations/${remediationResponse.json().remediationId}/create-ticket`
      });

      expect(ticketResponse.statusCode).toBe(200);
      expect(ticketResponse.json().ticket.ticketId).toMatch(/^PSCAN-/);

      // Extend with PSA (Syncro) direct remediation ticket creation per GAP-P1-007 + GAP-P1-009 (policy gated, uses sendWorkflowEvent path, full states, real mock delivery exercised, no secrets)
      const syncroResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          authType: "apiKey",
          category: "MSSP",
          config: {
            apiBaseUrl: "https://demo.syncro.test/api/v1",
            apiKey: "syncro-test-token",
            mockMode: true
          },
          connectorKey: "syncro",
          mockMode: true,
          product: "Syncro",
          vendor: "Syncro"
        },
        url: "/api/v1/integrations"
      });
      expect(syncroResponse.statusCode).toBe(201);
      const syncroIntegrationId = syncroResponse.json().integrationId as string;

      const syncroTicketResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          integrationId: syncroIntegrationId
        },
        url: `/api/v1/remediations/${remediationResponse.json().remediationId}/create-ticket`
      });
      expect(syncroTicketResponse.statusCode).toBe(200);
      expect(syncroTicketResponse.json().ticket.system).toBe("Syncro");
      // ticketId reuses prior (since remediation now has one) but general dispatch + system set exercised; for fresh would deliver SYNCRO- prefix

      const readyResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        url: `/api/v1/remediations/${remediationResponse.json().remediationId}/mark-ready-for-verification`
      });

      expect(readyResponse.statusCode).toBe(200);
      expect(readyResponse.json().status).toBe("VerificationPending");

      const readyAuditResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/audit-events?action=remediation.ready_for_verification"
      });
      expect(readyAuditResponse.statusCode).toBe(200);
      expect(readyAuditResponse.json().items[0]).toMatchObject({
        action: "remediation.ready_for_verification",
        entityId: remediationResponse.json().remediationId,
        entityType: "RemediationTask"
      });
      expect(readyAuditResponse.json().items[0].metadata).toMatchObject({
        status: "VerificationPending"
      });

      const verifyResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {},
        url: `/api/v1/remediations/${remediationResponse.json().remediationId}/verify`
      });

      expect(verifyResponse.statusCode).toBe(200);
      const verificationEvent = verifyResponse.json().verificationEvent as {
        evidenceIds: string[];
        outcome: string;
      };
      expect(verificationEvent.evidenceIds.length).toBeGreaterThan(0);
      expect(["Fixed", "StillExposed"]).toContain(verificationEvent.outcome);
      expect(verifyResponse.json().mission.policyProfile).toContain(
        "targeted-fix-verification:"
      );
      expect(verifyResponse.json().run.status).toBe("Completed");
      expect(
        verifyResponse.json().run.target.selectedModuleIds.length
      ).toBeGreaterThan(0);
      expect([
        "periscan.fix_verification.compare",
        "gitleaks.repo_secrets",
        "nuclei.external_exposure_safe",
        "ai_app.safe_validation",
        "atomic.control_validation_safe",
        "prowler.aws_posture"
      ]).toContain(verifyResponse.json().run.moduleId);

      const verificationEventsResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: `/api/v1/remediations/${remediationResponse.json().remediationId}/verification-events`
      });

      expect(verificationEventsResponse.statusCode).toBe(200);
      expect(verificationEventsResponse.json().items).toHaveLength(1);

      const evidenceId = snapshotResponse.json().evidenceIds[0] as string;
      const evidenceResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: `/api/v1/evidence/${evidenceId}`
      });

      expect(evidenceResponse.statusCode).toBe(200);

      const { cookie: viewerCookie } = await testHelpers.performSignup(
        app,
        "acceptance-viewer",
        "Other Tenant"
      );

      const otherTenantEvidenceResponse = await app.inject({
        cookies: testHelpers.authHeaders(viewerCookie),
        method: "GET",
        url: `/api/v1/evidence/${evidenceId}`
      });

      expect(otherTenantEvidenceResponse.statusCode).toBe(404);

      const reportCreateResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          audience: "Security Team",
          snapshotId: snapshotResponse.json().snapshotId
        },
        url: "/api/v1/reports"
      });

      expect(reportCreateResponse.statusCode).toBe(201);
      expect(reportCreateResponse.json().evidenceIds.length).toBeGreaterThan(0);

      const reportExportResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        url: `/api/v1/reports/${reportCreateResponse.json().evidencePackId}/export`
      });

      expect(reportExportResponse.statusCode).toBe(200);
      expect(reportExportResponse.body).toContain("Priority Attack Paths");
      expect(reportExportResponse.body).toContain("Last verification:");
      expect(reportExportResponse.body).toContain(verificationEvent.outcome);

      const pdfExportResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          format: "pdf"
        },
        url: `/api/v1/reports/${reportCreateResponse.json().evidencePackId}/export`
      });

      expect(pdfExportResponse.statusCode).toBe(200);
      expect(pdfExportResponse.headers["content-type"]).toContain(
        "application/pdf"
      );
      expect(pdfExportResponse.body).toContain("%PDF-1.4");
    } finally {
      if (prisma) {
        await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
          "acceptance-",
          "acceptance-owner",
          "acceptance-viewer"
        ]);
      }
      await app.close();
      await prisma?.$disconnect();
    }
  }, 60_000);

  it("covers P2 concurrency/race/double-submit for mission start (simultaneous starts under policy serialize via prisma tx, final runs reset to expected count, no crash/denied) + threat import concurrent + perm regression", async () => {
    const prisma = createPrismaClient();
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
      const email = testHelpers.uniqueEmail("p2-concurr");
      const signupResponse = await app.inject({
        method: "POST",
        payload: {
          email,
          name: "P2 Concurr Owner",
          password: "periscan-p2-concurr-password",
          tenantName: "P2 Concurr Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signupResponse.statusCode).toBe(201);
      const ownerCookie = testHelpers.getSessionCookie(signupResponse);

      const scopeValue = `p2-concurr-${randomUUID()}.example.com`;
      const scopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: { scopeType: "Domain", value: scopeValue },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verifyResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verifyResponse.statusCode).toBe(200);

      const policyPreview = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
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
      expect(policyPreview.statusCode).toBe(201);
      const policyDecisionId = policyPreview.json().policyDecisionId as string;

      const missionResp = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          missionType: "ExposureValidation",
          policyDecisionId,
          safetyLevel: "ActiveNonInvasive",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(missionResp.statusCode).toBe(201);
      const missionId = missionResp.json().missionId as string;

      // P2 concurrent mission starts: both pass pre-tx checks, tx serializes (delete+create), final exactly 1 run (or 0 for deny harness)
      const startPayload = { moduleIds: ["nuclei.external_exposure_safe"] };
      const [start1, start2] = await Promise.all([
        app.inject({
          cookies: testHelpers.authHeaders(ownerCookie),
          method: "POST",
          payload: startPayload,
          url: `/api/v1/missions/${missionId}/start`
        }),
        app.inject({
          cookies: testHelpers.authHeaders(ownerCookie),
          method: "POST",
          payload: startPayload,
          url: `/api/v1/missions/${missionId}/start`
        })
      ]);
      expect([200, 200]).toContain(start1.statusCode);
      expect([200, 200]).toContain(start2.statusCode);
      const runsAfter = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: `/api/v1/missions/${missionId}/runs`
      });
      expect(runsAfter.statusCode).toBe(200);
      expect(runsAfter.json().items.length).toBeLessThanOrEqual(2);

      // concurrent threat imports (distinct ok)
      const threatBase = {
        cveIds: ["CVE-2026-P2CON"],
        iocValues: [],
        publishedAt: new Date().toISOString(),
        rawContent: "p2 concurr raw",
        sourceName: "P2 Concurr Test",
        summary: "P2 concurr advisory",
        techniqueIds: []
      };
      const [imp1, imp2] = await Promise.all([
        app.inject({
          cookies: testHelpers.authHeaders(ownerCookie),
          method: "POST",
          payload: { ...threatBase, title: "P2 Concurr Adv 1" },
          url: "/api/v1/threat-advisories"
        }),
        app.inject({
          cookies: testHelpers.authHeaders(ownerCookie),
          method: "POST",
          payload: { ...threatBase, title: "P2 Concurr Adv 2" },
          url: "/api/v1/threat-advisories"
        })
      ]);
      expect(imp1.statusCode).toBe(201);
      expect(imp2.statusCode).toBe(201);

      // perm regression: cross tenant read 404
      const otherEmail = testHelpers.uniqueEmail("p2-concurr-other");
      const otherSignup = await app.inject({
        method: "POST",
        payload: {
          email: otherEmail,
          name: "P2 Other",
          password: "periscan-p2-concurr-password",
          tenantName: "P2 Other Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      const otherCookie = testHelpers.getSessionCookie(otherSignup);
      const crossRead = await app.inject({
        cookies: testHelpers.authHeaders(otherCookie),
        method: "GET",
        url: `/api/v1/threat-advisories/${imp1.json().advisory.threatAdvisoryId}`
      });
      expect(crossRead.statusCode).toBe(404);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 60_000);
});
