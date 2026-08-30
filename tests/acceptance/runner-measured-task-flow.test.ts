import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";

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
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );
  if (!cookie) {
    throw new Error("Expected a Periscan session cookie.");
  }
  return cookie.value;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

// A runner-side Ed25519 result-signing keypair. Result submission now REQUIRES a
// registered signing key, so this acceptance runner registers with one and signs
// each result's localAuditSha256.
function makeSigner() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString(),
    sign: (localAuditSha256: string) =>
      sign(null, Buffer.from(localAuditSha256, "utf8"), privateKey).toString(
        "base64"
      )
  };
}

describe("Runner measured-module task acceptance workflow", () => {
  it("dispatches an allowlisted measured module as a signed in-network task and rejects non-allowlisted/out-of-scope requests", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });
    const signer = makeSigner();

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("runner-measured-owner"),
          name: "Runner Measured Owner",
          password: "periscan-runner-measured-password",
          tenantName: "Runner Measured Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["measured-acceptance"],
          runnerName: "measured-acceptance-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(tokenResponse.statusCode).toBe(201);

      const registerResponse = await app.inject({
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
          hostname: "measured-acceptance-runner",
          labels: ["measured-acceptance"],
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
          resultSigningPublicKeyPem: signer.publicKeyPem,
          runnerName: "measured-acceptance-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const runnerId = registerResponse.json().credentials.runnerId as string;
      const runnerAuthToken = registerResponse.json().credentials
        .runnerAuthToken as string;
      const uploadRunnerEvidence = async (input: {
        content: string;
        filename: string;
        taskId: string;
      }) => {
        const sha256 = createHash("sha256").update(input.content).digest("hex");
        const upload = await app.inject({
          headers: { authorization: `Bearer ${runnerAuthToken}` },
          method: "POST",
          payload: {
            artifactType: "NormalizedEvidence",
            contentBase64: Buffer.from(input.content).toString("base64"),
            contentType: "application/json",
            filename: input.filename,
            sha256,
            sizeBytes: Buffer.byteLength(input.content)
          },
          url: `/api/v1/runners/${runnerId}/tasks/${input.taskId}/artifacts`
        });
        expect(upload.statusCode).toBe(201);

        return {
          artifactType: "NormalizedEvidence",
          evidenceId: upload.json().artifact.evidenceId,
          redactionStatus: upload.json().artifact.redactionStatus,
          sha256: upload.json().artifact.sha256,
          sizeBytes: Buffer.byteLength(input.content)
        };
      };

      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "Domain", value: "corp.internal" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verify = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      const createMeasured = (payload: Record<string, unknown>) =>
        app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload,
          url: `/api/v1/runners/${runnerId}/tasks/measured`
        });

      // Allowlisted measured module → a real signed task whose envelope carries
      // the actual periscan.* module the runner-agent will execute in-network.
      const protocol = await createMeasured({
        moduleId: "periscan.tls_protocol_audit",
        port: 443,
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(protocol.statusCode).toBe(201);
      const protocolBody = protocol.json();
      expect(protocolBody.envelope.moduleId).toBe(
        "periscan.tls_protocol_audit"
      );
      expect(protocolBody.envelope.executionEnvironment).toBe("InternalRunner");
      expect(protocolBody.envelope.signature.algorithm).toBeTruthy();
      expect(protocolBody.envelope.inputs.port).toBe(443);
      expect(protocolBody.envelope.target.hostname).toBe(
        "gateway-01.corp.internal"
      );
      expect(protocolBody.run.moduleId).toBe("periscan.tls_protocol_audit");
      expect(protocolBody.task.taskType).toBe("periscan.tls_protocol_audit");

      // DNS resolution check — no port required.
      const dns = await createMeasured({
        moduleId: "periscan.dns_resolution_check",
        scopeId,
        targetHost: "db-01.corp.internal"
      });
      expect(dns.statusCode).toBe(201);
      expect(dns.json().envelope.moduleId).toBe(
        "periscan.dns_resolution_check"
      );
      expect(dns.json().envelope.scopeConstraints.approvedPorts).toEqual([]);

      // The endpoint marker is a governed runner task rather than an analytics
      // fixture. It requires an explicitly verified Internal Network host
      // boundary, carries the exact platform/marker receipt inputs, and never
      // opens a network port.
      const endpointOnDomainScope = await createMeasured({
        markerId: "periscan-endpoint-acceptance-01",
        moduleId: "periscan.endpoint_benign_marker_emit",
        platform: "Linux",
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(endpointOnDomainScope.statusCode).toBe(400);
      expect(endpointOnDomainScope.json().code).toBe("module_scope_mismatch");

      const endpointScope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "InternalNetwork",
          value: "measured-acceptance-runner"
        },
        url: "/api/v1/scopes"
      });
      expect(endpointScope.statusCode).toBe(201);
      const endpointScopeId = endpointScope.json().scopeId as string;
      const verifyEndpointScope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${endpointScopeId}/verify`
      });
      expect(verifyEndpointScope.statusCode).toBe(200);

      const endpointMarker = await createMeasured({
        markerId: "periscan-endpoint-acceptance-01",
        moduleId: "periscan.endpoint_benign_marker_emit",
        platform: "Linux",
        scopeId: endpointScopeId,
        targetHost: "measured-acceptance-runner"
      });
      expect(endpointMarker.statusCode).toBe(201);
      expect(endpointMarker.json().mission.missionType).toBe(
        "ControlValidation"
      );
      expect(endpointMarker.json().mission.scopeId).toBe(endpointScopeId);
      expect(endpointMarker.json().envelope.scopeConstraints).toMatchObject({
        approvedPorts: []
      });
      expect(endpointMarker.json().envelope.inputs).toMatchObject({
        markerId: "periscan-endpoint-acceptance-01",
        platform: "Linux"
      });
      expect(endpointMarker.json().envelope.target).toMatchObject({
        hostname: "measured-acceptance-runner",
        markerId: "periscan-endpoint-acceptance-01",
        platform: "Linux"
      });

      await prisma.runnerTask.update({
        data: { status: "Rejected" },
        where: { taskId: dns.json().task.taskId as string }
      });
      const rejectAlreadyRejected = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          reason: "local verifier attempted to reject a closed task",
          runnerId,
          tenantId
        },
        url: `/api/v1/runners/${runnerId}/tasks/${dns.json().task.taskId}/reject`
      });
      expect(rejectAlreadyRejected.statusCode).toBe(409);
      expect(rejectAlreadyRejected.json().code).toBe(
        "runner_task_invalid_state"
      );
      await expect(
        prisma.runnerTask.findUniqueOrThrow({
          where: { taskId: dns.json().task.taskId as string }
        })
      ).resolves.toMatchObject({
        rejectedReason: null,
        status: "Rejected"
      });
      await expect(
        prisma.auditEvent.findFirst({
          where: {
            action: "runner_task_rejected",
            entityId: dns.json().task.taskId as string,
            metadata: {
              path: ["reason"],
              equals: "reject_after_terminal_state"
            },
            tenantId
          }
        })
      ).resolves.not.toBeNull();

      // A non-allowlisted / offensive module is rejected by schema before the
      // service runs (authorization boundary).
      const offensive = await createMeasured({
        moduleId: "exploit.metasploit_check",
        port: 443,
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(offensive.statusCode).toBe(400);

      // A public-domain measured module is not runner-safe-listed either.
      const publicDomain = await createMeasured({
        moduleId: "periscan.well_known_security_txt",
        port: 443,
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(publicDomain.statusCode).toBe(400);

      // Out-of-scope target is rejected before any task is signed.
      const denied = await createMeasured({
        moduleId: "periscan.tls_protocol_audit",
        port: 443,
        scopeId,
        targetHost: "evil.example.com"
      });
      expect(denied.statusCode).toBe(400);
      expect(denied.json().code).toBe("runner_scope_violation");

      // TLS/HTTP without a port fail schema validation (port required).
      const missingPort = await createMeasured({
        moduleId: "periscan.tls_protocol_audit",
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(missingPort.statusCode).toBe(400);

      // A verify-in-network dispatch with an unknown remediation is rejected.
      const unknownRemediation = await createMeasured({
        moduleId: "periscan.tls_protocol_audit",
        port: 443,
        remediationId: randomUUID(),
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(unknownRemediation.statusCode).toBe(404);
      expect(unknownRemediation.json().code).toBe("remediation_not_found");

      // The runner submits a measured result (with an exposure signal) for the
      // dispatched protocol task; the control plane persists the signal so it
      // surfaces as a finding (the value of in-network measurement).
      const measuredSignal = {
        confidence: 0.95,
        createdAt: new Date().toISOString(),
        evidenceIds: [],
        redactionStatus: "Redacted",
        relatedAssetIds: [],
        relatedControlIds: [],
        relatedEvidenceIds: [],
        relatedIdentityIds: [],
        relatedPathIds: [],
        sensitivityLevel: "Low",
        signalCategory: "Exposure",
        signalId: randomUUID(),
        signalSubcategory: "TlsDeprecatedProtocol",
        sourceType: "tls_protocol_audit",
        sourceVendor: "Periscan",
        techniqueIds: [],
        tenantId,
        timestampIngested: new Date().toISOString(),
        timestampObserved: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const invalidResultStatus = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          completedAt: new Date().toISOString(),
          evidenceManifest: [],
          localAuditSha256: "c".repeat(64),
          resultSignature: signer.sign("c".repeat(64)),
          outcome: "still_running",
          runId: protocolBody.run.runId,
          runnerId,
          signals: [],
          startedAt: new Date().toISOString(),
          status: "Running",
          taskId: protocolBody.task.taskId,
          tenantId,
          validationState: "Reachable"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${protocolBody.task.taskId}/result`
      });
      expect(invalidResultStatus.statusCode).toBe(400);

      const unchangedRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: protocolBody.run.runId }
      });
      const unchangedTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: protocolBody.task.taskId }
      });
      const unchangedMission = await prisma.validationMission.findUniqueOrThrow(
        {
          where: { missionId: protocolBody.mission.missionId }
        }
      );
      expect(unchangedRun.status).toBe(protocolBody.run.status);
      expect(unchangedRun.completedAt).toBeNull();
      expect(unchangedTask.status).toBe(protocolBody.task.status);
      expect(unchangedTask.result).toBeNull();
      expect(unchangedMission.status).toBe(protocolBody.mission.status);

      const prooflessCompleted = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          completedAt: new Date().toISOString(),
          evidenceManifest: [],
          localAuditSha256: "d".repeat(64),
          resultSignature: signer.sign("d".repeat(64)),
          outcome: "tls_deprecated_protocol",
          runId: protocolBody.run.runId,
          runnerId,
          signals: [],
          startedAt: new Date().toISOString(),
          status: "Completed",
          taskId: protocolBody.task.taskId,
          tenantId,
          validationState: "Validated"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${protocolBody.task.taskId}/result`
      });
      expect(prooflessCompleted.statusCode).toBe(400);
      expect(prooflessCompleted.json().code).toBe(
        "runner_result_evidence_required"
      );

      const stillUnchangedTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: protocolBody.task.taskId }
      });
      const stillUnchangedRun = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: protocolBody.run.runId }
      });
      const stillUnchangedMission =
        await prisma.validationMission.findUniqueOrThrow({
          where: { missionId: protocolBody.mission.missionId }
        });
      expect(stillUnchangedTask.status).toBe(protocolBody.task.status);
      expect(stillUnchangedTask.result).toBeNull();
      expect(stillUnchangedRun.status).toBe(protocolBody.run.status);
      expect(stillUnchangedRun.completedAt).toBeNull();
      expect(stillUnchangedMission.status).toBe(protocolBody.mission.status);

      const protocolEvidenceManifestItem = await uploadRunnerEvidence({
        content: JSON.stringify({
          observation: "tls deprecated protocol observed",
          signalSubcategory: measuredSignal.signalSubcategory,
          taskId: protocolBody.task.taskId
        }),
        filename: "tls-protocol-audit-result.json",
        taskId: protocolBody.task.taskId
      });

      const submit = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          completedAt: new Date().toISOString(),
          evidenceManifest: [protocolEvidenceManifestItem],
          localAuditSha256: "a".repeat(64),
          resultSignature: signer.sign("a".repeat(64)),
          outcome: "tls_deprecated_protocol",
          runId: protocolBody.run.runId,
          runnerId,
          signals: [measuredSignal],
          startedAt: new Date().toISOString(),
          status: "Completed",
          taskId: protocolBody.task.taskId,
          tenantId,
          validationState: "Validated"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${protocolBody.task.taskId}/result`
      });
      expect(submit.statusCode).toBe(200);

      const evidenceCountBeforeTerminalUpload =
        await prisma.evidenceArtifact.count({
          where: { tenantId }
        });
      const lateArtifactContent = JSON.stringify({
        observation: "late artifact after completed task",
        taskId: protocolBody.task.taskId
      });
      const lateArtifactSha256 = createHash("sha256")
        .update(lateArtifactContent)
        .digest("hex");
      const lateArtifactUpload = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          artifactType: "NormalizedEvidence",
          contentBase64: Buffer.from(lateArtifactContent).toString("base64"),
          contentType: "application/json",
          filename: "late-terminal-result.json",
          sha256: lateArtifactSha256,
          sizeBytes: Buffer.byteLength(lateArtifactContent)
        },
        url: `/api/v1/runners/${runnerId}/tasks/${protocolBody.task.taskId}/artifacts`
      });
      expect(lateArtifactUpload.statusCode).toBe(409);
      expect(lateArtifactUpload.json().code).toBe("runner_task_invalid_state");
      await expect(
        prisma.evidenceArtifact.count({ where: { tenantId } })
      ).resolves.toBe(evidenceCountBeforeTerminalUpload);
      await expect(
        prisma.auditEvent.findFirst({
          where: {
            action: "runner_task_rejected",
            entityId: protocolBody.task.taskId,
            metadata: {
              path: ["reason"],
              equals: "artifact_after_terminal_state"
            },
            tenantId
          }
        })
      ).resolves.not.toBeNull();

      // The measured signal now drives a validated finding.
      const findings = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/findings"
      });
      expect(findings.statusCode).toBe(200);
      const findingItems = findings.json().items as Array<{
        impact: string;
        measuredInNetwork: boolean;
        title: string;
      }>;
      const measuredFinding = findingItems.find(
        (finding) =>
          (typeof finding.impact === "string" &&
            finding.impact.includes("TlsDeprecatedProtocol")) ||
          (typeof finding.title === "string" &&
            finding.title.includes("TlsDeprecatedProtocol"))
      );
      expect(measuredFinding).toBeTruthy();
      // Provenance: this finding was measured in-network by the runner.
      expect(measuredFinding?.measuredInNetwork).toBe(true);

      // Provenance: the persisted signal is tagged as measured in-network by
      // this runner (vs control-plane, which leaves sourceRunnerId null).
      const persistedSignal = await prisma.signalEnvelope.findFirst({
        where: { sourceType: "tls_protocol_audit", tenantId }
      });
      expect(persistedSignal?.sourceRunnerId).toBe(runnerId);

      // The in-network measured signal is projected into the evidence graph
      // (a ValidationRun node for the runner's run), so it becomes attack-path
      // graph evidence exactly as control-plane validation does.
      const runNode = await prisma.graphNode.findFirst({
        where: {
          nodeKey: `validation-run:${protocolBody.run.runId}`,
          tenantId
        }
      });
      expect(runNode).not.toBeNull();

      // Runner-driven fix re-verification: dispatch a measured task tied to a
      // remediation, submit a Completed "Fixed" result, and the control plane
      // records a measured in-network verification event + updates the fix.
      const remediation = await prisma.remediationTask.create({
        data: {
          evidenceIds: [],
          recommendedAction: "Disable deprecated TLS on the internal gateway.",
          status: "Open",
          technicalSteps: ["Disable TLS 1.0/1.1", "Re-verify in-network"],
          tenantId,
          verificationMethod: "Re-run periscan.tls_protocol_audit in-network.",
          verificationRequired: true
        }
      });

      const verifyDispatch = await createMeasured({
        moduleId: "periscan.tls_protocol_audit",
        port: 443,
        remediationId: remediation.remediationId,
        scopeId,
        targetHost: "gateway-01.corp.internal"
      });
      expect(verifyDispatch.statusCode).toBe(201);
      const verifyTask = verifyDispatch.json();
      expect(verifyTask.task.inputs.remediationId).toBe(
        remediation.remediationId
      );

      const verificationEvidenceManifestItem = await uploadRunnerEvidence({
        content: JSON.stringify({
          observation: "tls modern protocol only",
          remediationId: remediation.remediationId,
          taskId: verifyTask.task.taskId
        }),
        filename: "tls-fix-verification-result.json",
        taskId: verifyTask.task.taskId
      });

      const verifySubmit = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          completedAt: new Date().toISOString(),
          evidenceManifest: [verificationEvidenceManifestItem],
          localAuditSha256: "b".repeat(64),
          resultSignature: signer.sign("b".repeat(64)),
          outcome: "tls_modern_only",
          runId: verifyTask.run.runId,
          runnerId,
          signals: [],
          startedAt: new Date().toISOString(),
          status: "Completed",
          taskId: verifyTask.task.taskId,
          tenantId,
          validationState: "Fixed"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${verifyTask.task.taskId}/result`
      });
      expect(verifySubmit.statusCode).toBe(200);

      // A measured in-network verification event was recorded.
      const events = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/remediations/${remediation.remediationId}/verification-events`
      });
      expect(events.statusCode).toBe(200);
      const eventItems = events.json().items as Array<{
        measuredRevalidation: boolean;
        outcome: string;
        retestMethod: string | null;
      }>;
      expect(eventItems).toHaveLength(1);
      expect(eventItems[0]!.retestMethod).toBe("in-network-runner");
      expect(eventItems[0]!.measuredRevalidation).toBe(true);
      expect(eventItems[0]!.outcome).toBe("Fixed");

      // The remediation, read through the API the UI consumes (not just the DB),
      // reflects the in-network re-verification: status Fixed with the measured
      // provenance surfaced inline so a "Fixed" claim is API-visible + grounded.
      const remediations = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/remediations"
      });
      expect(remediations.statusCode).toBe(200);
      const remediationItem = (
        remediations.json().items as Array<{
          lastVerifiedAt: string | null;
          latestVerification: {
            measuredRevalidation: boolean;
            outcome: string;
            retestMethod: string | null;
          } | null;
          nextVerificationAt: string | null;
          remediationId: string;
          status: string;
        }>
      ).find((item) => item.remediationId === remediation.remediationId);
      expect(remediationItem?.status).toBe("Fixed");
      expect(remediationItem?.lastVerifiedAt).not.toBeNull();
      expect(remediationItem?.nextVerificationAt).not.toBeNull();
      expect(remediationItem?.latestVerification?.measuredRevalidation).toBe(
        true
      );
      expect(remediationItem?.latestVerification?.retestMethod).toBe(
        "in-network-runner"
      );
      expect(remediationItem?.latestVerification?.outcome).toBe("Fixed");

      // DB backstop: the persisted record matches the API-surfaced state.
      const refreshed = await prisma.remediationTask.findUniqueOrThrow({
        where: { remediationId: remediation.remediationId }
      });
      expect(refreshed.status).toBe("Fixed");
      expect(refreshed.lastVerifiedAt).not.toBeNull();
      expect(refreshed.nextVerificationAt).not.toBeNull();
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
