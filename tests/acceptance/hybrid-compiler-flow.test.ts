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

describe("Hybrid Execution Compiler + conversational draft + passive multi-agent", () => {
  it("compiles → queues signed passive task → mock runner completes; draft convert; Draft multi-agent missions", async () => {
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
          email: uniqueEmail("hybrid-compiler-owner"),
          name: "Hybrid Compiler Owner",
          password: "periscan-hybrid-compiler-password",
          tenantName: "Hybrid Compiler Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      const domain = `hybrid-${randomUUID().slice(0, 8)}.example.com`;
      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: domain
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      const targetHost = `host.${domain}`;

      const verified = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);

      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["hybrid-compiler"],
          runnerName: "hybrid-compiler-runner"
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
          hostname: "hybrid-compiler-runner",
          labels: ["hybrid-compiler"],
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
          runnerName: "hybrid-compiler-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const runnerId = registerResponse.json().credentials.runnerId as string;
      const runnerAuthToken = registerResponse.json().credentials
        .runnerAuthToken as string;
      const runnerAuth = { authorization: `Bearer ${runnerAuthToken}` };

      const draftResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          intent: "Validate DNS and TLS posture for AEV proof",
          maximumSteps: 3,
          scopeId,
          source: "AevProofPlanPreset",
          targetHost,
          title: "AEV hybrid draft"
        },
        url: "/api/v1/mission-drafts/conversational"
      });
      expect(draftResponse.statusCode).toBe(201);
      const draft = draftResponse.json();
      expect(draft).toMatchObject({
        executable: false,
        honesty: {
          claimLanguage: "mission_draft_not_executable_bas",
          conversationalOnly: true
        },
        title: "AEV hybrid draft"
      });
      expect(draft.moduleIds.length).toBeGreaterThan(0);

      // Conversational draft → hybrid compile input (draft stays non-BAS).
      const convertResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          draft,
          options: {
            queueTasks: false,
            runnerId
          }
        },
        url: "/api/v1/mission-drafts/conversational/to-hybrid-compile-input"
      });
      expect(convertResponse.statusCode).toBe(200);
      const converted = convertResponse.json();
      expect(converted.draftExecutable).toBe(false);
      expect(converted.honesty.basExecutableFromDraft).toBe(false);
      expect(converted.honesty.claimLanguage).toBe(
        "mission_draft_not_executable_bas"
      );
      expect(converted.compileInput.runnerId).toBe(runnerId);
      expect(converted.compileInput.scopeId).toBe(scopeId);
      expect(converted.compileInput.queueTasks).toBe(false);
      expect(
        (converted.compileInput.moduleIds as string[]).every((id: string) =>
          id.startsWith("periscan.")
        )
      ).toBe(true);

      const assembleResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          intent: "dns tls http exposure",
          maximumSteps: 3,
          scopeId,
          targetHost
        },
        url: "/api/v1/hybrid-compiler/assemble-passive-multi-agent"
      });
      expect(assembleResponse.statusCode).toBe(201);
      const assembled = assembleResponse.json();
      expect(assembled).toMatchObject({
        honesty: {
          claimLanguage: "passive_role_assembly_not_bas_swarm",
          draftMissionsOnly: true,
          multiAgentOffensiveSwarmSupported: false
        },
        missionStatus: "Draft",
        policyPreview: {
          executionEnvironment: "InternalRunner",
          requestedAction: {
            destructive: false,
            realDataExfiltration: false
          }
        }
      });
      expect(assembled.missionId).toBeTruthy();
      expect(assembled.missionPlan.steps.length).toBeGreaterThan(0);

      const draftMission = await prisma.validationMission.findUniqueOrThrow({
        where: { missionId: assembled.missionId as string }
      });
      expect(draftMission.status).toBe("Draft");
      expect(draftMission.startedAt).toBeNull();
      // Multi-agent assembly must not auto-queue runner tasks.
      const multiAgentTasks = await prisma.runnerTask.count({
        where: { missionId: assembled.missionId as string }
      });
      expect(multiAgentTasks).toBe(0);

      const compileResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          intent: "dns resolution passive proof",
          moduleIds: ["periscan.dns_resolution_check"],
          queueTasks: false,
          runnerId,
          scopeId,
          targetHost,
          timeoutSeconds: 5
        },
        url: "/api/v1/hybrid-compiler/compile"
      });
      expect(compileResponse.statusCode).toBe(201);
      const compiled = compileResponse.json();
      expect(compiled.honesty.fullyE2EMeasuredSurface).toBe(false);
      expect(compiled.honesty.liveAptAtomicSupported).toBe(false);
      expect(compiled.honesty.multiAgentOffensiveSwarmSupported).toBe(false);
      expect(compiled.acceptedCount).toBe(1);
      expect(compiled.queuedTaskCount).toBe(0);
      expect(compiled.steps).toHaveLength(1);
      expect(compiled.steps[0].envelope.signature.signature).toMatch(
        /^[A-Za-z0-9_-]+$/
      );
      expect(compiled.steps[0].envelope.moduleId).toBe(
        "periscan.dns_resolution_check"
      );
      expect(compiled.steps[0].queued).toBe(false);
      expect(compiled.missionId).toBeTruthy();

      const rejectOffensive = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: [
            "atomic.control_validation_safe",
            "exploit.metasploit_check"
          ],
          queueTasks: false,
          runnerId,
          scopeId,
          targetHost
        },
        url: "/api/v1/hybrid-compiler/compile"
      });
      expect(rejectOffensive.statusCode).toBe(400);
      expect(rejectOffensive.json().code).toBe("hybrid_compile_empty");

      // queueTasks:true → signed Queued runner task for passive allowlisted module.
      const queueCompile = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          moduleIds: ["periscan.dns_resolution_check"],
          queueTasks: true,
          runnerId,
          scopeId,
          targetHost
        },
        url: "/api/v1/hybrid-compiler/compile"
      });
      expect(queueCompile.statusCode).toBe(201);
      expect(queueCompile.json().queuedTaskCount).toBe(1);
      expect(queueCompile.json().steps[0].queued).toBe(true);
      expect(queueCompile.json().steps[0].runId).toBeTruthy();
      const queuedTaskId = queueCompile.json().steps[0].taskId as string;
      const queuedRunId = queueCompile.json().steps[0].runId as string;
      const queueMissionId = queueCompile.json().missionId as string;

      const tasks = await prisma.runnerTask.findMany({
        where: {
          missionId: queueMissionId,
          tenantId
        }
      });
      expect(tasks).toHaveLength(1);
      expect(tasks[0]?.status).toBe("Queued");
      expect(tasks[0]?.moduleId).toBe("periscan.dns_resolution_check");

      // Mock runner: poll → accept → artifact → signed result (passive module E2E).
      const poll = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {},
        url: `/api/v1/runners/${runnerId}/poll`
      });
      expect(poll.statusCode).toBe(200);
      const leased = poll.json().tasks as Array<{
        moduleId: string;
        taskId: string;
      }>;
      expect(leased.map((t) => t.taskId)).toContain(queuedTaskId);
      expect(leased.find((t) => t.taskId === queuedTaskId)?.moduleId).toBe(
        "periscan.dns_resolution_check"
      );

      const accept = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          runnerId,
          tenantId
        },
        url: `/api/v1/runners/${runnerId}/tasks/${queuedTaskId}/accept`
      });
      expect(accept.statusCode).toBe(200);
      expect(accept.json().task.status).toBe("Accepted");

      const evidenceContent = JSON.stringify({
        moduleId: "periscan.dns_resolution_check",
        observation: "dns_resolution_ok",
        source: "hybrid-compiler-mock-runner",
        targetHost,
        taskId: queuedTaskId
      });
      const sha256 = createHash("sha256").update(evidenceContent).digest("hex");
      const upload = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {
          artifactType: "NormalizedEvidence",
          contentBase64: Buffer.from(evidenceContent).toString("base64"),
          contentType: "application/json",
          filename: "dns-resolution-result.json",
          sha256,
          sizeBytes: Buffer.byteLength(evidenceContent)
        },
        url: `/api/v1/runners/${runnerId}/tasks/${queuedTaskId}/artifacts`
      });
      expect(upload.statusCode).toBe(201);

      const localAuditSha256 = "d".repeat(64);
      const complete = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {
          completedAt: new Date().toISOString(),
          errorSummary: null,
          evidenceManifest: [
            {
              artifactType: "NormalizedEvidence",
              evidenceId: upload.json().artifact.evidenceId,
              redactionStatus: upload.json().artifact.redactionStatus,
              sha256: upload.json().artifact.sha256,
              sizeBytes: Buffer.byteLength(evidenceContent)
            }
          ],
          localAuditSha256,
          outcome: "dns_resolved",
          resultSignature: signer.sign(localAuditSha256),
          runId: queuedRunId,
          runnerId,
          startedAt: new Date().toISOString(),
          status: "Completed",
          taskId: queuedTaskId,
          tenantId,
          validationState: "Validated"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${queuedTaskId}/result`
      });
      expect(complete.statusCode).toBe(200);
      expect(complete.json().task.status).toBe("Completed");

      const done = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: queuedTaskId }
      });
      expect(done.status).toBe("Completed");
      expect(done.resultSignatureVerifiedAt).not.toBeNull();
      expect(done.moduleId).toBe("periscan.dns_resolution_check");

      // Converted draft can also be compiled (queueTasks still optional/false by default).
      const compileFromDraft = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          ...converted.compileInput,
          // Force only DNS so no port is required for multi-module drafts.
          moduleIds: ["periscan.dns_resolution_check"],
          queueTasks: false
        },
        url: "/api/v1/hybrid-compiler/compile"
      });
      expect(compileFromDraft.statusCode).toBe(201);
      expect(compileFromDraft.json().honesty.fullyE2EMeasuredSurface).toBe(
        false
      );
      expect(compileFromDraft.json().acceptedCount).toBe(1);
      expect(compileFromDraft.json().queuedTaskCount).toBe(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 60_000);
});
