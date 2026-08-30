import { createHash, generateKeyPairSync, sign } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { VALID_RUNNER_CSR_PEM } from "./helpers/runner-csr.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S6 — platform E2E: runner lifecycle.
 *
 * register → check-in (heartbeat) → lease task (poll) → complete (signed result).
 * Complements gateway accept/reject and measured-module suites with the full
 * outbound long-poll lease path operators rely on in production.
 */

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

describe("runner lease-complete E2E (register → heartbeat → poll lease → complete)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "runner-lease"
      ]);
      await prisma.$disconnect();
    }
  });

  it("registers, heartbeats, leases a queued task, and completes with a signed result", async () => {
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
        prisma
      })
    });
    const signer = makeSigner();

    try {
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        "runner-lease",
        "Runner Lease Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;

      const tokenResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["lease-e2e"],
          runnerName: "lease-e2e-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(tokenResponse.statusCode).toBe(201);

      // 1) Register with result-signing key (required for complete path).
      const register = await app.inject({
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
          hostname: "lease-e2e-runner",
          labels: ["lease-e2e"],
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
          runnerName: "lease-e2e-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(register.statusCode).toBe(201);
      const runnerId = register.json().credentials.runnerId as string;
      const runnerAuthToken = register.json().credentials
        .runnerAuthToken as string;
      const runnerAuth = { authorization: `Bearer ${runnerAuthToken}` };

      // 2) Check-in / heartbeat.
      const heartbeat = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          queueDepth: 0,
          runnerId,
          status: "Active",
          tenantId,
          version: "0.1.0"
        },
        url: `/api/v1/runners/${runnerId}/heartbeat`
      });
      expect(heartbeat.statusCode).toBe(200);

      const afterBeat = await prisma.runner.findUniqueOrThrow({
        where: { runnerId }
      });
      expect(afterBeat.lastSeenAt).toBeInstanceOf(Date);
      expect(afterBeat.status).toBe("Active");

      // Verified parent domain so host under it is in-scope for reachability.
      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: "corp.internal"
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

      // Queue a reachability task (status Queued until poll leases it).
      const createTask = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          ports: [443],
          scopeId,
          targetHost: "app-01.corp.internal",
          timeoutSeconds: 5
        },
        url: `/api/v1/runners/${runnerId}/tasks/reachability`
      });
      expect(createTask.statusCode).toBe(201);
      expect(createTask.json().task.status).toBe("Queued");
      const taskId = createTask.json().task.taskId as string;
      const runId = createTask.json().task.runId as string;

      // 3) Lease via poll — Queued → Leased, envelope returned.
      const poll = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {
          health: {
            observedAt: new Date().toISOString(),
            queueDepth: 0,
            runnerId,
            status: "Active",
            tenantId,
            version: "0.1.0"
          }
        },
        url: `/api/v1/runners/${runnerId}/poll`
      });
      expect(poll.statusCode).toBe(200);
      expect(poll.json().killSwitchActive).toBe(false);
      expect(poll.json().runnerRevoked).toBe(false);
      const leased = poll.json().tasks as Array<{
        moduleId: string;
        taskId: string;
      }>;
      expect(leased.length).toBeGreaterThanOrEqual(1);
      expect(leased.map((t) => t.taskId)).toContain(taskId);
      expect(
        leased.find((t) => t.taskId === taskId)?.moduleId
      ).toBe("runner.reachability_check");

      const leasedRow = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId }
      });
      expect(leasedRow.status).toBe("Leased");
      expect(leasedRow.leasedAt).toBeInstanceOf(Date);

      // Second poll must not re-lease the same task.
      const pollAgain = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {},
        url: `/api/v1/runners/${runnerId}/poll`
      });
      expect(pollAgain.statusCode).toBe(200);
      expect(
        (pollAgain.json().tasks as Array<{ taskId: string }>).map(
          (t) => t.taskId
        )
      ).not.toContain(taskId);

      // Accept is allowed from Leased.
      const accept = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          runnerId,
          tenantId
        },
        url: `/api/v1/runners/${runnerId}/tasks/${taskId}/accept`
      });
      expect(accept.statusCode).toBe(200);
      expect(accept.json().task.status).toBe("Accepted");

      // 4) Complete with signed result + evidence artifact.
      const content = JSON.stringify({
        observations: [{ port: 443, status: "open" }],
        taskId
      });
      const sha256 = createHash("sha256").update(content).digest("hex");
      const upload = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {
          artifactType: "NormalizedEvidence",
          contentBase64: Buffer.from(content).toString("base64"),
          contentType: "application/json",
          filename: "reachability-result.json",
          sha256,
          sizeBytes: Buffer.byteLength(content)
        },
        url: `/api/v1/runners/${runnerId}/tasks/${taskId}/artifacts`
      });
      expect(upload.statusCode).toBe(201);

      const localAuditSha256 = "c".repeat(64);
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
              sizeBytes: Buffer.byteLength(content)
            }
          ],
          localAuditSha256,
          outcome: "reachable",
          resultSignature: signer.sign(localAuditSha256),
          runId,
          runnerId,
          startedAt: new Date().toISOString(),
          status: "Completed",
          taskId,
          tenantId,
          validationState: "Reachable"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${taskId}/result`
      });
      expect(complete.statusCode).toBe(200);
      expect(complete.json().task.status).toBe("Completed");

      const done = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId }
      });
      expect(done.status).toBe("Completed");
      expect(done.resultSignatureVerifiedAt).not.toBeNull();
      expect(done.localAuditHash).toBe(localAuditSha256);
    } finally {
      await app.close();
    }
  }, 45_000);
});
