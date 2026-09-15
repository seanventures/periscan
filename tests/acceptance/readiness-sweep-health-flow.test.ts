import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { runSystemValidationSweep } from "../../apps/api/src/system-scheduler.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  return response.cookies.find((item) => item.name === SESSION_COOKIE_NAME)!
    .value;
}

interface ReadinessCheck {
  detail: string;
  name: string;
  status: string;
}

/**
 * The readiness endpoint surfaces continuous-validation sweep health. A sweep
 * with per-runner failures reads as `degraded` (visible to operators) but must
 * NOT mark the API not_ready — a flaky background job should never 503 request
 * traffic. Only a hard `down` dependency blocks readiness.
 */
describe("Readiness reflects continuous-validation sweep health", () => {
  it("reports a failing sweep as degraded without flipping readiness to 503", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("ready-owner"),
          name: "Ready Owner",
          password: "periscan-ready-password",
          tenantName: "Ready Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);
      const tenantId = owner.json().tenant.tenantId as string;

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { connectorKey: "tenable", mockMode: true },
        url: "/api/v1/integrations"
      });
      expect(created.statusCode).toBe(201);
      const integrationId = created.json().integrationId as string;

      // Make the integration sync due so the sweep actually ticks a runner.
      await prisma.integration.update({
        data: {
          nextSyncAt: new Date(Date.now() - 60_000),
          status: "Connected",
          syncFrequency: "Daily"
        },
        where: { integrationId }
      });

      // Drive a sweep whose integration-sync runner throws, recording a failure.
      const failingServices = {
        ...services,
        async runDueIntegrationSyncs() {
          throw new Error("sweep integration sync boom");
        }
      } as typeof services;
      const summary = await runSystemValidationSweep({
        services: failingServices,
        tenantIds: [tenantId]
      });
      expect(summary.failures).toBeGreaterThanOrEqual(1);
      expect(summary.failuresByRunner.integrationSync).toBeGreaterThanOrEqual(
        1
      );

      const readiness = await app.inject({
        method: "GET",
        url: "/api/v1/health/ready"
      });
      // Degraded sweep does NOT 503 — the API stays ready for request traffic.
      expect(readiness.statusCode).toBe(200);
      expect(readiness.json().status).toBe("ready");

      const sweepCheck = (readiness.json().checks as ReadinessCheck[]).find(
        (check) => check.name === "validation_sweep"
      );
      expect(sweepCheck).toBeDefined();
      expect(sweepCheck?.status).toBe("degraded");
      expect(sweepCheck?.detail).toContain("integrationSync");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 60_000);
});
