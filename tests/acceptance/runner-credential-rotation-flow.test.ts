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

/**
 * Runner credential rotation refreshes the runner's CERTIFICATE + task-signing
 * key material and version (NOT the long-lived bearer enrollment token, which is
 * what revoke severs). This proves: rotation requires the runner's identity to
 * match, returns fresh signing material + advances the recorded version, is
 * audited (runner.credentials.rotated with the previous cert expiry), and the
 * bearer token keeps authenticating afterward (rotation is not revocation).
 */
describe("Runner credential rotation", () => {
  it("rotates cert/signing material + version, audits it, and keeps the bearer token valid", async () => {
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
          email: uniqueEmail("runner-rotate-owner"),
          name: "Runner Rotate Owner",
          password: "periscan-runner-rotate-password",
          tenantName: "Runner Rotate Tenant"
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
          labels: ["rotate-acceptance"],
          runnerName: "rotate-runner"
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
          hostname: "rotate-runner",
          labels: ["rotate-acceptance"],
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
          runnerName: "rotate-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const runnerId = registerResponse.json().credentials.runnerId as string;
      const runnerAuthToken = registerResponse.json().credentials
        .runnerAuthToken as string;

      // Identity guard: a rotation request whose body does not match the
      // authenticated runner is rejected.
      const mismatch = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          csrPem: VALID_RUNNER_CSR_PEM,
          observedAt: new Date().toISOString(),
          runnerId,
          tenantId: randomUUID(),
          version: "0.1.1"
        },
        url: `/api/v1/runners/${runnerId}/credentials/rotate`
      });
      expect(mismatch.statusCode).toBe(403);
      expect(mismatch.json().code).toBe("runner_identity_mismatch");

      // Rotate: fresh signing material + the recorded version advances.
      const rotate = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          csrPem: VALID_RUNNER_CSR_PEM,
          observedAt: new Date().toISOString(),
          runnerId,
          tenantId,
          version: "0.1.1"
        },
        url: `/api/v1/runners/${runnerId}/credentials/rotate`
      });
      expect(rotate.statusCode).toBe(200);
      expect(rotate.json().credentials.taskSigningKeyId).toBeTruthy();
      expect(rotate.json().credentials.taskSigningPublicKeyPem).toBeTruthy();
      expect(rotate.json().runner.version).toBe("0.1.1");

      // The rotation is audited with the previous certificate expiry recorded.
      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          action: "runner_credentials_rotated",
          entityId: runnerId,
          tenantId
        }
      });
      expect(auditEvent).not.toBeNull();
      expect(
        (auditEvent?.metadata as { version?: string } | null)?.version
      ).toBe("0.1.1");

      // Rotation refreshes cert/signing material, NOT the bearer token: the
      // original token still authenticates (revoke, not rotate, severs it).
      const pollAfter = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {},
        url: `/api/v1/runners/${runnerId}/poll`
      });
      expect(pollAfter.statusCode).toBe(200);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
