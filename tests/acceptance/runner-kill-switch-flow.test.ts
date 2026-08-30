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
 * The runner kill switch is safety-critical: a halted runner executes nothing.
 * This proves the full state machine — activate sets KillSwitchActive + records
 * an audit event, and deactivate restores Active and clears the halt reason —
 * end to end through the API the operator uses, including the runners read.
 */
describe("Runner kill-switch", () => {
  it("activates (halts + audits) and deactivates (restores Active) a runner", async () => {
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
          email: uniqueEmail("runner-kill-owner"),
          name: "Runner Kill Owner",
          password: "periscan-runner-kill-password",
          tenantName: "Runner Kill Tenant"
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
          labels: ["kill-switch-acceptance"],
          runnerName: "kill-switch-runner"
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
          hostname: "kill-switch-runner",
          labels: ["kill-switch-acceptance"],
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
          runnerName: "kill-switch-runner",
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

      // A freshly enrolled runner is Active with the kill switch off.
      const enrolled = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/runners"
      });
      const enrolledRunner = (
        enrolled.json().items as Array<{
          killSwitchActive: boolean;
          runnerId: string;
          status: string;
        }>
      ).find((item) => item.runnerId === runnerId);
      expect(enrolledRunner?.status).toBe("Active");
      expect(enrolledRunner?.killSwitchActive).toBe(false);

      // Activate the kill switch with an explicit reason: the runner is halted.
      const activated = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { active: true, reason: "Out-of-scope activity suspected." },
        url: `/api/v1/runners/${runnerId}/kill-switch`
      });
      expect(activated.statusCode).toBe(200);
      expect(activated.json().runner.killSwitchActive).toBe(true);
      expect(activated.json().runner.status).toBe("KillSwitchActive");
      expect(activated.json().runner.killSwitchReason).toBe(
        "Out-of-scope activity suspected."
      );
      await expect(
        prisma.runnerTask.findUniqueOrThrow({ where: { taskId } })
      ).resolves.toMatchObject({
        errorSummary: "Runner kill switch activated before completion.",
        status: "DeniedByServerPolicy"
      });

      // The halt is visible through the runners read and is audited.
      const halted = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/runners"
      });
      expect(
        (
          halted.json().items as Array<{ runnerId: string; status: string }>
        ).find((item) => item.runnerId === runnerId)?.status
      ).toBe("KillSwitchActive");
      const auditEvent = await prisma.auditEvent.findFirst({
        where: {
          action: "runner_task_rejected",
          entityId: runnerId,
          tenantId
        }
      });
      expect(auditEvent).not.toBeNull();

      // Deactivate: the runner is restored to Active and the reason is cleared.
      const deactivated = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { active: false },
        url: `/api/v1/runners/${runnerId}/kill-switch`
      });
      expect(deactivated.statusCode).toBe(200);
      expect(deactivated.json().runner.killSwitchActive).toBe(false);
      expect(deactivated.json().runner.status).toBe("Active");
      expect(deactivated.json().runner.killSwitchReason).toBeNull();

      const restored = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/runners"
      });
      expect(
        (
          restored.json().items as Array<{ runnerId: string; status: string }>
        ).find((item) => item.runnerId === runnerId)?.status
      ).toBe("Active");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
