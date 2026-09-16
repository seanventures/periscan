import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import {
  createRuntimeServices,
  markStaleRunnersOffline
} from "../../apps/api/src/runtime-services.js";
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
 * The control plane stamps Runner.lastSeenAt on every poll but never derives the
 * Offline status from silence. This proves the system reaper closes that gap: an
 * Active runner that has gone silent past the staleness window is transitioned to
 * Offline (visible through the API the UI reads), while a freshly-seen runner is
 * left untouched. Recovery is automatic — a runner's next poll restores Active.
 */
describe("Runner staleness reaper", () => {
  it("marks a silent Active runner Offline and leaves a fresh runner untouched", async () => {
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
          email: uniqueEmail("runner-stale-owner"),
          name: "Runner Stale Owner",
          password: "periscan-runner-stale-password",
          tenantName: "Runner Stale Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      async function enrollRunner(name: string): Promise<string> {
        const tokenResponse = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            deploymentMode: "Docker",
            expiresInSeconds: 3600,
            labels: ["staleness-acceptance"],
            runnerName: name
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
            hostname: name,
            labels: ["staleness-acceptance"],
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
            runnerName: name,
            version: "0.1.0"
          },
          url: "/api/v1/runners/register"
        });
        expect(registerResponse.statusCode).toBe(201);
        return registerResponse.json().credentials.runnerId as string;
      }

      const silentRunnerId = await enrollRunner("silent-runner");
      const liveRunnerId = await enrollRunner("live-runner");

      // markStaleRunnersOffline is GLOBAL (mirrors expireStaleRunnerTasks), so on
      // a shared test database the offlinedRunnerCount reflects every tenant's
      // stale runners. Assert per-entity (tenant-scoped GET) rather than exact
      // global counts. Both runners just enrolled fresh, so neither is offlined.
      async function runnerStatuses() {
        const runners = await app.inject({
          cookies: authCookies(cookie),
          method: "GET",
          url: "/api/v1/runners"
        });
        expect(runners.statusCode).toBe(200);
        const items = runners.json().items as Array<{
          runnerId: string;
          status: string;
        }>;
        return {
          live: items.find((item) => item.runnerId === liveRunnerId)?.status,
          silent: items.find((item) => item.runnerId === silentRunnerId)?.status
        };
      }

      await markStaleRunnersOffline(prisma);
      expect(await runnerStatuses()).toEqual({
        live: "Active",
        silent: "Active"
      });

      // Backdate ONLY the silent runner's last poll beyond the staleness window.
      await prisma.runner.update({
        data: { lastSeenAt: new Date(Date.now() - 60 * 60 * 1000) },
        where: { runnerId: silentRunnerId }
      });

      const result = await markStaleRunnersOffline(prisma);
      expect(result.offlinedRunnerCount).toBeGreaterThanOrEqual(1);

      // The transition is visible through the runners API the UI reads; the
      // fresh runner is untouched.
      expect(await runnerStatuses()).toEqual({
        live: "Active",
        silent: "Offline"
      });

      // DB backstop + tenant scoping sanity.
      const reaped = await prisma.runner.findUniqueOrThrow({
        where: { runnerId: silentRunnerId }
      });
      expect(reaped.status).toBe("Offline");
      expect(reaped.tenantId).toBe(tenantId);

      // Idempotent per-entity: a second run leaves the already-Offline runner
      // Offline and the fresh one Active.
      await markStaleRunnersOffline(prisma);
      expect(await runnerStatuses()).toEqual({
        live: "Active",
        silent: "Offline"
      });
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
