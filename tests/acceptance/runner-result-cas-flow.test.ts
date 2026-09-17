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

async function bootstrapRunnerMeasuredTask() {
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

  const signup = await app.inject({
    method: "POST",
    payload: {
      email: uniqueEmail("runner-cas-owner"),
      name: "Runner CAS Owner",
      password: "periscan-runner-cas-password",
      tenantName: "Runner CAS Tenant"
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
      labels: ["cas-acceptance"],
      runnerName: "cas-acceptance-runner"
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
      hostname: "cas-acceptance-runner",
      labels: ["cas-acceptance"],
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
      runnerName: "cas-acceptance-runner",
      version: "0.9.0-test"
    },
    url: "/api/v1/runners/register"
  });
  expect(registerResponse.statusCode).toBe(201);
  const runnerId = registerResponse.json().credentials.runnerId as string;
  const runnerAuthToken = registerResponse.json().credentials
    .runnerAuthToken as string;

  const scope = await app.inject({
    cookies: authCookies(cookie),
    method: "POST",
    payload: {
      scopeType: "Domain",
      value: "corp.internal"
    },
    url: "/api/v1/scopes"
  });
  expect(scope.statusCode).toBe(201);
  const scopeId = scope.json().scopeId as string;
  const verifyScope = await app.inject({
    cookies: authCookies(cookie),
    method: "POST",
    payload: { devModeManual: true },
    url: `/api/v1/scopes/${scopeId}/verify`
  });
  expect(verifyScope.statusCode).toBe(200);

  const create = await app.inject({
    cookies: authCookies(cookie),
    method: "POST",
    payload: {
      moduleId: "periscan.tls_protocol_audit",
      port: 443,
      scopeId,
      targetHost: "gateway-01.corp.internal"
    },
    url: `/api/v1/runners/${runnerId}/tasks/measured`
  });
  expect(create.statusCode).toBe(201);

  return {
    app,
    cookie,
    prisma,
    runnerAuthToken,
    runnerId,
    signer,
    task: create.json(),
    tenantId
  };
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJson(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalizeJson(child)])
    );
  }
  return value;
}

function auditHashForResult(payload: Record<string, unknown>): string {
  const unsigned = { ...payload };
  delete unsigned.localAuditSha256;
  delete unsigned.resultSignature;
  return createHash("sha256")
    .update(JSON.stringify(canonicalizeJson(unsigned)), "utf8")
    .digest("hex");
}

async function uploadEvidence(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  content: string;
  filename: string;
  runnerAuthToken: string;
  runnerId: string;
  taskId: string;
}) {
  const sha256 = createHash("sha256").update(input.content).digest("hex");
  const sizeBytes = Buffer.byteLength(input.content);
  const upload = await input.app.inject({
    headers: { authorization: `Bearer ${input.runnerAuthToken}` },
    method: "POST",
    payload: {
      artifactType: "NormalizedEvidence",
      contentBase64: Buffer.from(input.content).toString("base64"),
      contentType: "application/json",
      filename: input.filename,
      sha256,
      sizeBytes
    },
    url: `/api/v1/runners/${input.runnerId}/tasks/${input.taskId}/artifacts`
  });
  expect(upload.statusCode).toBe(201);
  return {
    artifactType: "NormalizedEvidence" as const,
    evidenceId: upload.json().artifact.evidenceId as string,
    redactionStatus: "Redacted" as const,
    sha256,
    sizeBytes
  };
}

describe("Runner result submit compare-and-swap", () => {
  it("rejects a concurrent/replayed result after the first claim and does not duplicate signals", async () => {
    const ctx = await bootstrapRunnerMeasuredTask();
    const { app, prisma, runnerAuthToken, runnerId, signer, task, tenantId } =
      ctx;

    try {
      const evidence = await uploadEvidence({
        app,
        content: JSON.stringify({ observation: "cas-primary" }),
        filename: "cas-primary.json",
        runnerAuthToken,
        runnerId,
        taskId: task.task.taskId
      });

      const payload = {
        completedAt: new Date().toISOString(),
        evidenceManifest: [evidence],
        outcome: "tls_deprecated_protocol",
        runId: task.run.runId,
        runnerId,
        signals: [
          {
            confidence: 0.9,
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
          }
        ],
        startedAt: new Date().toISOString(),
        status: "Completed",
        taskId: task.task.taskId,
        tenantId,
        validationState: "Validated"
      };
      const localAuditSha256 = auditHashForResult(payload);
      const signedPayload = {
        ...payload,
        localAuditSha256,
        resultSignature: signer.sign(localAuditSha256)
      };
      const replayPayload = {
        ...payload,
        validationState: "Fixed"
      };
      const replayHash = auditHashForResult(replayPayload);
      const signedReplay = {
        ...replayPayload,
        localAuditSha256: replayHash,
        resultSignature: signer.sign(replayHash)
      };

      const [first, second] = await Promise.all([
        app.inject({
          headers: { authorization: `Bearer ${runnerAuthToken}` },
          method: "POST",
          payload: signedPayload,
          url: `/api/v1/runners/${runnerId}/tasks/${task.task.taskId}/result`
        }),
        app.inject({
          headers: { authorization: `Bearer ${runnerAuthToken}` },
          method: "POST",
          payload: signedReplay,
          url: `/api/v1/runners/${runnerId}/tasks/${task.task.taskId}/result`
        })
      ]);

      const statuses = [first.statusCode, second.statusCode].sort();
      expect(statuses).toEqual([200, 409]);
      const conflict = first.statusCode === 409 ? first : second;
      expect(conflict.json().code).toBe("runner_task_invalid_state");

      await expect(
        prisma.signalEnvelope.count({ where: { tenantId } })
      ).resolves.toBe(1);

      const settled = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: task.run.runId }
      });
      expect(settled.status).toBe("Completed");
      expect(settled.validationState).toBe("Validated");
      expect(settled.validationState).not.toBe("Fixed");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });

  it("keeps previously uploaded evidenceIds when a Failed result has an empty manifest", async () => {
    const ctx = await bootstrapRunnerMeasuredTask();
    const { app, prisma, runnerAuthToken, runnerId, signer, task, tenantId } =
      ctx;

    try {
      const evidence = await uploadEvidence({
        app,
        content: JSON.stringify({ observation: "pre-fail-upload" }),
        filename: "pre-fail-upload.json",
        runnerAuthToken,
        runnerId,
        taskId: task.task.taskId
      });

      const runBefore = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: task.run.runId }
      });
      expect(runBefore.evidenceIds).toContain(evidence.evidenceId);

      const failedPayload = {
        completedAt: new Date().toISOString(),
        evidenceManifest: [],
        errorSummary: "module crashed after upload",
        outcome: "module_error",
        runId: task.run.runId,
        runnerId,
        signals: [],
        startedAt: new Date().toISOString(),
        status: "Failed",
        taskId: task.task.taskId,
        tenantId,
        validationState: "Inconclusive"
      };
      const failedHash = auditHashForResult(failedPayload);
      const failed = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          ...failedPayload,
          localAuditSha256: failedHash,
          resultSignature: signer.sign(failedHash)
        },
        url: `/api/v1/runners/${runnerId}/tasks/${task.task.taskId}/result`
      });
      expect(failed.statusCode).toBe(200);

      const runAfter = await prisma.validationRun.findUniqueOrThrow({
        where: { runId: task.run.runId }
      });
      const missionAfter = await prisma.validationMission.findUniqueOrThrow({
        where: { missionId: task.mission.missionId }
      });
      expect(runAfter.status).toBe("Failed");
      expect(runAfter.evidenceIds).toContain(evidence.evidenceId);
      expect(missionAfter.evidenceIds).toContain(evidence.evidenceId);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
