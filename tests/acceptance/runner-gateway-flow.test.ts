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

describe("Internal Runner gateway acceptance workflow", () => {
  it("registers a runner, lists tasks, and processes accept/reject lifecycle transitions", async () => {
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
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("runner-gateway-owner"),
          name: "Runner Gateway Owner",
          password: "periscan-runner-gateway-password",
          tenantName: "Runner Gateway Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);

      const tokenResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          deploymentMode: "Docker",
          expiresInSeconds: 3600,
          labels: ["gateway-acceptance"],
          runnerName: "gateway-acceptance-runner"
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
          hostname: "gateway-acceptance-runner",
          labels: ["gateway-acceptance"],
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
          runnerName: "gateway-acceptance-runner",
          version: "0.1.0"
        },
        url: "/api/v1/runners/register"
      });
      expect(registerResponse.statusCode).toBe(201);
      const credentials = registerResponse.json().credentials;
      const runnerId = credentials.runnerId as string;
      const tenantId = credentials.tenantId as string;
      const runnerAuthToken = credentials.runnerAuthToken as string;

      const scopeResponse = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: "corp.internal"
        },
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

      const createTask = async () => {
        const response = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            ports: [443],
            scopeId,
            targetHost: "app-01.corp.internal",
            timeoutSeconds: 5
          },
          url: `/api/v1/runners/${runnerId}/tasks/reachability`
        });
        expect(response.statusCode).toBe(201);
        return response.json().task.taskId as string;
      };

      const acceptTaskId = await createTask();
      const rejectTaskId = await createTask();

      // Admin can list tasks for the runner with tenant binding.
      const list = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/runners/${runnerId}/tasks`
      });
      expect(list.statusCode).toBe(200);
      const taskIds = (list.json().items as Array<{ taskId: string }>).map(
        (task) => task.taskId
      );
      expect(taskIds).toContain(acceptTaskId);
      expect(taskIds).toContain(rejectTaskId);

      // Runner accepts a task using its own identity.
      const accept = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          runnerId,
          tenantId
        },
        url: `/api/v1/runners/${runnerId}/tasks/${acceptTaskId}/accept`
      });
      expect(accept.statusCode).toBe(200);
      expect(accept.json().task.status).toBe("Accepted");

      // Identity mismatch on accept/reject is rejected.
      const mismatch = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          reason: "local policy denied",
          runnerId,
          tenantId: randomUUID()
        },
        url: `/api/v1/runners/${runnerId}/tasks/${rejectTaskId}/reject`
      });
      expect(mismatch.statusCode).toBe(403);

      // Runner rejects a task locally (DeniedByLocalPolicy).
      const reject = await app.inject({
        headers: { authorization: `Bearer ${runnerAuthToken}` },
        method: "POST",
        payload: {
          observedAt: new Date().toISOString(),
          reason: "Target outside local policy window.",
          runnerId,
          tenantId
        },
        url: `/api/v1/runners/${runnerId}/tasks/${rejectTaskId}/reject`
      });
      expect(reject.statusCode).toBe(200);
      expect(reject.json().task.status).toBe("DeniedByLocalPolicy");
      expect(reject.json().task.rejectedReason).toContain("local policy");

      // Internal reachability tasks are runner-dispatched, not queued as jobs.
      expect(queuedJobs).toBe(0);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
