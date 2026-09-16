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
 * Revoking a runner must actually SEVER the in-network agent, not just flip a
 * flag: this proves the runner's auth token works before revocation and is
 * rejected (403 runner_revoked) after, the status reads Revoked through the API,
 * and the revocation is audited.
 */
describe("Runner revoke", () => {
  it("rejects a revoked runner's token and surfaces + audits the revocation", async () => {
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
          email: uniqueEmail("runner-revoke-owner"),
          name: "Runner Revoke Owner",
          password: "periscan-runner-revoke-password",
          tenantName: "Runner Revoke Tenant"
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
          labels: ["revoke-acceptance"],
          runnerName: "revoke-runner"
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
          hostname: "revoke-runner",
          labels: ["revoke-acceptance"],
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
          runnerName: "revoke-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const runnerId = registerResponse.json().credentials.runnerId as string;
      const runnerAuthToken = registerResponse.json().credentials
        .runnerAuthToken as string;

      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "Domain", value: "corp.internal" },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const verifyScope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeResponse.json().scopeId}/verify`
      });
      expect(verifyScope.statusCode).toBe(200);
      const taskResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          ports: [443],
          scopeId: scopeResponse.json().scopeId,
          targetHost: "gateway.corp.internal",
          timeoutSeconds: 5
        },
        url: `/api/v1/runners/${runnerId}/tasks/reachability`
      });
      expect(taskResponse.statusCode).toBe(201);
      const taskId = taskResponse.json().task.taskId as string;
      const acceptResponse = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          runnerId,
          tenantId
        },
        url: `/api/v1/runners/${runnerId}/tasks/${taskId}/accept`
      });
      expect(acceptResponse.statusCode).toBe(200);
      expect(acceptResponse.json().task.status).toBe("Accepted");

      // Before revocation the runner's token authenticates and can poll.
      const pollBefore = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {},
        url: `/api/v1/runners/${runnerId}/poll`
      });
      expect(pollBefore.statusCode).toBe(200);

      // Revoke the runner (tenant admin action).
      const revoke = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/runners/${runnerId}/revoke`
      });
      expect(revoke.statusCode).toBe(200);
      expect(revoke.json().status).toBe("Revoked");
      expect(revoke.json().revokedAt).not.toBeNull();
      await expect(
        prisma.runnerTask.findUniqueOrThrow({ where: { taskId } })
      ).resolves.toMatchObject({
        errorSummary: "Runner was revoked before task completion.",
        status: "Cancelled"
      });

      // The revocation is visible through the runners API the operator reads.
      const runners = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/runners"
      });
      expect(
        (
          runners.json().items as Array<{ runnerId: string; status: string }>
        ).find((item) => item.runnerId === runnerId)?.status
      ).toBe("Revoked");

      // After revocation the SAME token can only observe the fail-closed
      // control state; no work is returned. This lets the host prove it saw
      // the revocation instead of leaving the operator with an unverified
      // control-plane state.
      const pollAfter = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {},
        url: `/api/v1/runners/${runnerId}/poll`
      });
      expect(pollAfter.statusCode).toBe(200);
      expect(pollAfter.json()).toMatchObject({
        runnerRevoked: true,
        tasks: []
      });
      expect(pollAfter.json().controlStateChangedAt).toBe(
        revoke.json().revokedAt
      );

      const observedAt = new Date().toISOString();
      const acknowledgement = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          controlState: "Revoked",
          observedAt,
          stateChangedAt: pollAfter.json().controlStateChangedAt
        },
        url: `/api/v1/runners/${runnerId}/control-state/acknowledge`
      });
      expect(acknowledgement.statusCode).toBe(200);
      expect(acknowledgement.json().revocationAcknowledgedAt).toBe(observedAt);

      // The revocation is audited.
      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          action: "runner_task_rejected",
          entityId: runnerId,
          tenantId
        }
      });
      expect(auditEvent).not.toBeNull();
      expect((auditEvent?.metadata as { reason?: string } | null)?.reason).toBe(
        "runner_revoked"
      );

      // Revoke is idempotent: re-revoking an already-revoked runner succeeds
      // and leaves it Revoked (no error, no resurrection).
      const reRevoke = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/runners/${runnerId}/revoke`
      });
      expect(reRevoke.statusCode).toBe(200);
      expect(reRevoke.json().status).toBe("Revoked");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
