import { createHash, generateKeyPairSync, randomUUID, sign } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { VALID_RUNNER_CSR_PEM } from "./helpers/runner-csr.js";

const SESSION_COOKIE_NAME = "periscan_session";

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  return response.cookies.find((c) => c.name === SESSION_COOKIE_NAME)!.value;
}
function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function canonicalizeJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
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

function resultAuditHash(payload: Record<string, unknown>) {
  const unsigned = { ...payload };
  delete unsigned.localAuditSha256;
  delete unsigned.resultSignature;

  return createHash("sha256")
    .update(JSON.stringify(canonicalizeJson(unsigned)), "utf8")
    .digest("hex");
}

// A runner-side Ed25519 result-signing keypair. The runner keeps the private key
// and signs each result's localAuditSha256; the control plane verifies against
// the registered public key.
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

describe("Runner-signed result provenance (enforce-when-registered)", () => {
  it("verifies a registered runner's result signature and rejects missing/invalid ones", async () => {
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
          email: `runner-sign-owner-${randomUUID()}@periscan.test`,
          name: "Runner Sign Owner",
          password: "periscan-runner-sign-password",
          tenantName: "Runner Sign Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = sessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      const token = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["sign-acceptance"],
          runnerName: "sign-acceptance-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(token.statusCode).toBe(201);

      // Register WITH a result-signing public key → the runner is now held to a
      // verified signature on every result.
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
          hostname: "sign-acceptance-runner",
          labels: ["sign-acceptance"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: token.json().registrationToken,
          resultSigningPublicKeyPem: signer.publicKeyPem,
          runnerName: "sign-acceptance-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(register.statusCode).toBe(201);
      const runnerId = register.json().credentials.runnerId as string;
      const runnerAuthToken = register.json().credentials
        .runnerAuthToken as string;
      const runnerAuth = { authorization: `Bearer ${runnerAuthToken}` };

      // Persisted key.
      const storedRunner = await prisma.runner.findUniqueOrThrow({
        where: { runnerId }
      });
      expect(storedRunner.resultSigningPublicKeyPem).toBe(signer.publicKeyPem);

      // A scope + a dispatched measured task to submit a result against.
      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "Domain", value: "corp.internal" },
        url: "/api/v1/scopes"
      });
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      const dispatch = await app.inject({
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
      expect(dispatch.statusCode).toBe(201);
      const body = dispatch.json();
      const taskId = body.task.taskId as string;
      const runId = body.run.runId as string;

      const unsignedResultBase = {
        completedAt: new Date().toISOString(),
        outcome: "tls_deprecated_protocol",
        runId,
        runnerId,
        signals: [],
        startedAt: new Date().toISOString(),
        taskId,
        tenantId,
        validationState: "Validated"
      };
      const submitResult = (payload: Record<string, unknown>) =>
        app.inject({
          headers: runnerAuth,
          method: "POST",
          payload,
          url: `/api/v1/runners/${runnerId}/tasks/${taskId}/result`
        });

      // 1) MISSING signature → rejected (before any state transition).
      const missing = await submitResult({
        ...unsignedResultBase,
        evidenceManifest: [],
        localAuditSha256: "a".repeat(64),
        status: "Failed",
        errorSummary: "no signature"
      });
      expect(missing.statusCode).toBe(403);
      expect(missing.json().code).toBe("runner_result_signature_required");

      // 2) INVALID signature (signs a different digest than submitted) → rejected.
      const invalidPayload = {
        ...unsignedResultBase,
        errorSummary: "bad signature",
        evidenceManifest: [],
        status: "Failed"
      };
      const invalidAuditSha256 = resultAuditHash(invalidPayload);
      const invalid = await submitResult({
        ...invalidPayload,
        localAuditSha256: invalidAuditSha256,
        resultSignature: signer.sign("b".repeat(64)),
      });
      expect(invalid.statusCode).toBe(403);
      expect(invalid.json().code).toBe("runner_result_signature_invalid");

      // 3) A valid signature over a stale hash cannot authorize a payload whose
      // outcome was changed in transit.
      const originalPayload = {
        ...unsignedResultBase,
        errorSummary: "runner failed safely",
        evidenceManifest: [],
        status: "Failed"
      };
      const originalAuditSha256 = resultAuditHash(originalPayload);
      const tampered = await submitResult({
        ...originalPayload,
        localAuditSha256: originalAuditSha256,
        outcome: "tampered_success",
        resultSignature: signer.sign(originalAuditSha256)
      });
      expect(tampered.statusCode).toBe(403);
      expect(tampered.json().code).toBe(
        "runner_result_audit_hash_mismatch"
      );

      // The task is untouched by the rejected submissions.
      const afterRejects = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId }
      });
      expect(afterRejects.result).toBeNull();
      expect(afterRejects.resultSignatureVerifiedAt).toBeNull();

      // 4) VALID signature on a Completed result (with evidence) → accepted,
      // and the verified signature is persisted for chain of custody.
      const content = JSON.stringify({ observation: "tls deprecated", taskId });
      const sha256 = createHash("sha256").update(content).digest("hex");
      const upload = await app.inject({
        headers: runnerAuth,
        method: "POST",
        payload: {
          artifactType: "NormalizedEvidence",
          contentBase64: Buffer.from(content).toString("base64"),
          contentType: "application/json",
          filename: "tls-result.json",
          sha256,
          sizeBytes: Buffer.byteLength(content)
        },
        url: `/api/v1/runners/${runnerId}/tasks/${taskId}/artifacts`
      });
      expect(upload.statusCode).toBe(201);
      const manifestItem = {
        artifactType: "NormalizedEvidence",
        evidenceId: upload.json().artifact.evidenceId,
        redactionStatus: upload.json().artifact.redactionStatus,
        sha256: upload.json().artifact.sha256,
        sizeBytes: Buffer.byteLength(content)
      };

      const validPayload = {
        ...unsignedResultBase,
        evidenceManifest: [manifestItem],
        status: "Completed"
      };
      const localAuditSha256 = resultAuditHash(validPayload);
      const resultSignature = signer.sign(localAuditSha256);
      const valid = await submitResult({
        ...validPayload,
        localAuditSha256,
        resultSignature
      });
      expect(valid.statusCode).toBe(200);

      const verifiedTask = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId }
      });
      expect(verifiedTask.status).toBe("Completed");
      expect(verifiedTask.resultSignature).toBe(resultSignature);
      expect(verifiedTask.resultSignatureVerifiedAt).not.toBeNull();
      expect(verifiedTask.localAuditHash).toBe(localAuditSha256);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);

  // The mandatory invariant: a runner registered WITHOUT a result-signing key
  // cannot submit any result. This closes the bypass where a keyless runner would
  // skip signature verification entirely — measured provenance is non-optional.
  it("rejects result submission from a runner registered without a signing key", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: `runner-nokey-owner-${randomUUID()}@periscan.test`,
          name: "Runner NoKey Owner",
          password: "periscan-runner-nokey-password",
          tenantName: "Runner NoKey Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = sessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      const token = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["nokey-acceptance"],
          runnerName: "nokey-acceptance-runner"
        },
        url: "/api/v1/runners/registration-tokens"
      });
      expect(token.statusCode).toBe(201);

      // Register WITHOUT a result-signing public key (permitted for registration).
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
          hostname: "nokey-acceptance-runner",
          labels: ["nokey-acceptance"],
          networkProfile: {
            additionalEgressNotes: null,
            dnsResolutionRequired: true,
            explicitProxyUrl: null,
            gatewayHostnames: ["runner.periscan.cloud"],
            httpConnectProxySupported: true,
            outboundHttpsPorts: [443]
          },
          os: "linux",
          registrationToken: token.json().registrationToken,
          runnerName: "nokey-acceptance-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(register.statusCode).toBe(201);
      const runnerId = register.json().credentials.runnerId as string;
      const runnerAuthToken = register.json().credentials
        .runnerAuthToken as string;

      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "Domain", value: "corp.internal" },
        url: "/api/v1/scopes"
      });
      const scopeId = scope.json().scopeId as string;
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      const dispatch = await app.inject({
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
      expect(dispatch.statusCode).toBe(201);
      const body = dispatch.json();

      // Even a fully-formed, non-repudiable-looking result is refused because the
      // runner has no registered key to verify against — refused before any state
      // transition, and audited.
      const submit = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          completedAt: new Date().toISOString(),
          evidenceManifest: [],
          localAuditSha256: "a".repeat(64),
          outcome: "tls_deprecated_protocol",
          runId: body.run.runId,
          runnerId,
          startedAt: new Date().toISOString(),
          status: "Failed",
          errorSummary: "no key",
          taskId: body.task.taskId,
          tenantId,
          validationState: "Validated"
        },
        url: `/api/v1/runners/${runnerId}/tasks/${body.task.taskId}/result`
      });
      expect(submit.statusCode).toBe(403);
      expect(submit.json().code).toBe("runner_result_signing_key_required");

      const untouched = await prisma.runnerTask.findUniqueOrThrow({
        where: { taskId: body.task.taskId }
      });
      expect(untouched.result).toBeNull();
      expect(untouched.status).not.toBe("Completed");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
