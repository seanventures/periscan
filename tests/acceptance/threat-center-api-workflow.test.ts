import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { VALID_RUNNER_CSR_PEM } from "./helpers/runner-csr.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function getSessionCookie(response: {
  cookies: Array<{
    name: string;
    value: string;
  }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );

  if (!cookie) {
    throw new Error(
      "Expected API response to include a Periscan session cookie."
    );
  }

  return cookie.value;
}

function authCookies(cookie: string) {
  return {
    [SESSION_COOKIE_NAME]: cookie
  };
}

describe("Threat Center API acceptance workflow", () => {
  it("imports advisories, stores evidence, exports readiness, and preserves policy gates without queueing jobs", async () => {
    const prisma = createPrismaClient();
    let queuedJobs = 0;
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            queuedJobs += 1;
          }
        },
        prisma
      })
    });

    try {
      const signupResponse = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("threat-acceptance"),
          name: "Threat Acceptance Owner",
          password: "periscan-threat-acceptance-password",
          tenantName: "Threat Acceptance Tenant"
        },
        url: "/api/v1/auth/signup"
      });

      expect(signupResponse.statusCode).toBe(201);

      const cookie = getSessionCookie(signupResponse);
      const tenantId = signupResponse.json().tenant.tenantId as string;
      // Control-source registration is gated on the Control Validation
      // capability; grant the tenant a package that includes it.
      await prisma.tenant.update({
        data: { billingPackageKey: "ControlValidation" },
        where: { tenantId }
      });
      const missingSignalsImport = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          cveIds: ["cve-2026-99999"],
          iocValues: ["manual-ioc.example.net"],
          rawContent:
            "RAG agent advisory for internal lateral movement references CVE-2026-12345, T1059.001, https://threat.example.net/callback, 203.0.113.55, token=acceptance-secret-token, and key AKIA1234567890ABCDEF.",
          sourceName: "Manual Threat Desk",
          sourceUrl: "https://advisories.example.net/periscan",
          summary:
            "Manual advisory import should produce missing-signal readiness without executing validation.",
          techniqueIds: ["t1110"],
          title: "Acceptance manual advisory"
        },
        url: "/api/v1/threat-advisories"
      });

      expect(missingSignalsImport.statusCode).toBe(201);
      expect(missingSignalsImport.json().advisory.cveIds).toEqual(
        expect.arrayContaining(["CVE-2026-12345", "CVE-2026-99999"])
      );
      expect(missingSignalsImport.json().advisory.techniqueIds).toEqual(
        expect.arrayContaining(["T1059.001", "T1110"])
      );
      expect(missingSignalsImport.json().advisory.iocValues).toEqual(
        expect.arrayContaining([
          "203.0.113.55",
          "https://threat.example.net/callback",
          "manual-ioc.example.net"
        ])
      );
      expect(
        missingSignalsImport
          .json()
          .missingSignals.map(
            (signal: { signalType: string }) => signal.signalType
          )
      ).toEqual(
        expect.arrayContaining([
          "ai_app_scope",
          "cloud_signals",
          "code_repository_signals",
          "control_telemetry",
          "internal_runner",
          "verified_scope"
        ])
      );
      expect(missingSignalsImport.json().readinessReport.readinessStatus).toBe(
        "MissingSignals"
      );
      expect(
        missingSignalsImport.json().validationPlan.planItems.length
      ).toBeGreaterThan(0);

      const rawEvidenceResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/evidence/${missingSignalsImport.json().rawEvidenceId}/download`
      });

      expect(rawEvidenceResponse.statusCode).toBe(200);
      expect(rawEvidenceResponse.json().content).not.toContain(
        "acceptance-secret-token"
      );
      expect(rawEvidenceResponse.json().content).not.toContain(
        "AKIA1234567890ABCDEF"
      );
      expect(rawEvidenceResponse.json().content).toContain("[REDACTED");

      const detailResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/threat-advisories/${missingSignalsImport.json().advisory.threatAdvisoryId}`
      });
      const htmlExportResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          format: "html"
        },
        url: `/api/v1/threat-advisories/${missingSignalsImport.json().advisory.threatAdvisoryId}/readiness-report/export`
      });
      const pdfExportResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          format: "pdf"
        },
        url: `/api/v1/threat-advisories/${missingSignalsImport.json().advisory.threatAdvisoryId}/readiness-report/export`
      });
      const missionsResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/missions"
      });

      expect(detailResponse.statusCode).toBe(200);
      expect(detailResponse.json().rawEvidenceId).toBe(
        missingSignalsImport.json().rawEvidenceId
      );
      expect(htmlExportResponse.statusCode).toBe(200);
      expect(htmlExportResponse.headers["content-type"]).toContain("text/html");
      expect(htmlExportResponse.body).toContain(
        "Periscan Threat Advisory Readiness Report"
      );
      expect(htmlExportResponse.body).not.toContain("AKIA1234567890ABCDEF");
      expect(pdfExportResponse.statusCode).toBe(200);
      expect(pdfExportResponse.headers["content-type"]).toContain(
        "application/pdf"
      );
      expect(missionsResponse.statusCode).toBe(200);
      expect(missionsResponse.json().items).toHaveLength(0);
      expect(queuedJobs).toBe(0);
      await expect(
        prisma.validationMission.count({
          where: {
            tenantId
          }
        })
      ).resolves.toBe(0);
      await expect(
        prisma.job.count({
          where: {
            tenantId
          }
        })
      ).resolves.toBe(0);

      const domainScopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `threat-acceptance-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      const aiScopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "AIApplicationEndpoint",
          value: `https://ai-${randomUUID()}.example.com/chat`
        },
        url: "/api/v1/scopes"
      });

      for (const scopeId of [
        domainScopeResponse.json().scopeId,
        aiScopeResponse.json().scopeId
      ]) {
        const verifyScopeResponse = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            devModeManual: true
          },
          url: `/api/v1/scopes/${scopeId}/verify`
        });

        expect(verifyScopeResponse.statusCode).toBe(200);
      }

      const githubResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          mockMode: true
        },
        url: "/api/v1/integrations/github/connect"
      });
      const awsResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          mockMode: true
        },
        url: "/api/v1/integrations/aws/connect"
      });
      const splunkResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          connectorKey: "splunk",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(githubResponse.statusCode).toBe(201);
      expect(awsResponse.statusCode).toBe(201);
      expect(splunkResponse.statusCode).toBe(201);

      const controlSourceResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          controlType: "SIEM",
          expectedBehaviors: ["Logged"],
          integrationId: splunkResponse.json().integrationId,
          provider: "Splunk"
        },
        url: "/api/v1/control-sources"
      });

      expect(controlSourceResponse.statusCode).toBe(201);

      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["threat-center"],
          runnerName: "threat-center-acceptance-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });

      expect(tokenResponse.statusCode).toBe(201);

      const registerRunnerResponse = await app.inject({
        method: "POST",
        payload: {
          arch: "amd64",
          capabilities: {
            supportsArtifactUpload: true,
            supportsHttpConnectProxy: true,
            supportsLocalReachability: true,
            supportsLongPoll: true,
            supportsWebSocket: false
          },
          csrPem: VALID_RUNNER_CSR_PEM,
          deploymentMode: "Docker",
          hostname: "threat-center-runner",
          labels: ["threat-center"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: tokenResponse.json().registrationToken,
          runnerName: "threat-center-acceptance-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });

      expect(registerRunnerResponse.statusCode).toBe(201);
      expect(registerRunnerResponse.json().runner.status).toBe("Active");

      const approvalReadyImport = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          rawContent:
            "Follow-up RAG agent advisory for internal segmentation references CVE-2026-12345, T1059.001, and https://threat.example.net/callback after prerequisites are configured.",
          sourceName: "Manual Threat Desk",
          summary:
            "All prerequisite signals exist, so the non-executing plan should require approval.",
          title: "Acceptance advisory ready for approval"
        },
        url: "/api/v1/threat-advisories"
      });

      expect(approvalReadyImport.statusCode).toBe(201);
      expect(approvalReadyImport.json().missingSignals).toHaveLength(0);
      expect(approvalReadyImport.json().readinessReport.readinessStatus).toBe(
        "RequiresApproval"
      );
      expect(approvalReadyImport.json().validationPlan.status).toBe(
        "NeedsApproval"
      );
      expect(
        approvalReadyImport
          .json()
          .validationPlan.planItems.every(
            (item: { status: string }) => item.status === "NeedsApproval"
          )
      ).toBe(true);
      expect(queuedJobs).toBe(0);
      await expect(
        prisma.validationMission.count({
          where: {
            tenantId
          }
        })
      ).resolves.toBe(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
