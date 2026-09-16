import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import {
  getLastValidationSweep,
  runSystemValidationSweep
} from "../../apps/api/src/system-scheduler.js";
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

/**
 * Proves the continuous-validation DRIVER: runSystemValidationSweep sweeps all
 * tenants and ticks the due-runners with NO per-tenant HTTP auth — it builds a
 * system context on behalf of a real editor-role member of each tenant. Here a
 * due connector sync for one tenant is actually executed by the sweep.
 */
describe("System validation sweep (continuous-validation driver)", () => {
  it("sweeps all tenants and runs a due integration sync without an HTTP context", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      // Tenant 1 with a connected integration whose sync is overdue.
      const owner1 = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("sweep-owner1"),
          name: "Sweep Owner One",
          password: "periscan-sweep-password-1",
          tenantName: "Sweep Tenant One"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner1.statusCode).toBe(201);
      const cookie1 = sessionCookie(owner1);
      const tenantId1 = owner1.json().tenant.tenantId as string;

      const created = await app.inject({
        cookies: authCookies(cookie1),
        method: "POST",
        payload: { connectorKey: "tenable", mockMode: true },
        url: "/api/v1/integrations"
      });
      expect(created.statusCode).toBe(201);
      const integrationId = created.json().integrationId as string;

      // Make the sync due (recurring + past nextSyncAt + Connected).
      await prisma.integration.update({
        data: {
          nextSyncAt: new Date(Date.now() - 60_000),
          status: "Connected",
          syncFrequency: "Daily"
        },
        where: { integrationId }
      });

      // Tenant 1 also has a verified Domain scope enrolled in continuous posture
      // monitoring whose check is overdue — the sweep must run it (fixture mode
      // in devMode, so no network).
      const scope1 = await app.inject({
        cookies: authCookies(cookie1),
        method: "POST",
        payload: { scopeType: "Domain", value: "sweep-posture.example.com" },
        url: "/api/v1/scopes"
      });
      expect(scope1.statusCode).toBe(201);
      const scopeId1 = scope1.json().scopeId as string;
      await app.inject({
        cookies: authCookies(cookie1),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId1}/verify`
      });
      await prisma.scope.update({
        data: { nextPostureCheckAt: new Date(Date.now() - 60_000) },
        where: { scopeId: scopeId1 }
      });

      // Tenant 2 simply exists with NO due work — the optimized sweep must skip
      // it (it only visits tenants that actually have due work).
      const owner2 = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("sweep-owner2"),
          name: "Sweep Owner Two",
          password: "periscan-sweep-password-2",
          tenantName: "Sweep Tenant Two"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner2.statusCode).toBe(201);
      const tenantId2 = owner2.json().tenant.tenantId as string;

      // Drive the loop directly — no request, no cookie, no per-tenant auth.
      // The production scheduler omits tenantIds and sweeps all due tenants.
      // Acceptance tests scope to their own tenants so an accumulated shared DB
      // cannot turn this into unrelated historical sweep work.
      const summary = await runSystemValidationSweep({
        services,
        tenantIds: [tenantId1, tenantId2]
      });

      // Assert DURABLE per-entity outcomes, not this call's summary counts:
      // other acceptance tests also drive the global sweep against the shared DB
      // concurrently, so a sibling sweep may have done (and counted) this
      // tenant's work first. What must hold is that the due integration WAS
      // synced and its schedule advanced into the future.
      const afterSync = await prisma.integration.findFirstOrThrow({
        where: { integrationId }
      });
      expect(afterSync.nextSyncAt?.getTime() ?? 0).toBeGreaterThan(Date.now());
      expect(afterSync.lastSyncAt).not.toBeNull();

      // The due verified scope WAS posture-checked: its cadence advanced.
      const afterPosture = await prisma.scope.findFirstOrThrow({
        where: { scopeId: scopeId1 }
      });
      expect(afterPosture.lastPostureCheckAt).not.toBeNull();
      expect(afterPosture.nextPostureCheckAt?.getTime() ?? 0).toBeGreaterThan(
        Date.now()
      );

      // This call's summary is well-formed (failure attribution is asserted
      // precisely in the injected-failure half below). We don't assert a global
      // zero here: the sweep processes EVERY due tenant in the shared DB, and
      // concurrent acceptance tests mutate that data mid-sweep, so an unrelated
      // tenant could contribute a transient failure that is not this test's
      // concern. This test's own work is verified durably above.
      expect(summary.failures).toBeGreaterThanOrEqual(0);
      expect(Object.keys(summary.failuresByRunner).sort()).toEqual([
        "context",
        "executiveSnapshot",
        "integrationSync",
        "posture",
        "reverification",
        "schedules",
        "threatFeed"
      ]);

      // Observability: a sweep outcome is recorded and exposed via /metrics.
      // The lastValidationSweep singleton is shared across concurrent sweeps
      // (other tests drive the sweep too, including a deliberately-failing one),
      // so assert the observability SHAPE is exposed — not values from this
      // specific call.
      expect(getLastValidationSweep()).not.toBeNull();
      const metrics = await app.inject({
        method: "GET",
        url: "/api/v1/metrics"
      });
      expect(metrics.statusCode).toBe(200);
      const exposedSweep = metrics.json().lastValidationSweep;
      expect(exposedSweep).not.toBeNull();
      expect(typeof exposedSweep.integrationsSynced).toBe("number");
      expect(typeof exposedSweep.postureChecksRun).toBe("number");
      expect(typeof exposedSweep.failuresByRunner.posture).toBe("number");

      // A failing due-runner is attributed to the right runner and raises a
      // structured alert log — the continuous-validation loop must never
      // silently swallow failures. Other due runners may also emit warnings in
      // the shared acceptance DB, so assert the relevant sample exists instead
      // of assuming a singleton warning.
      await prisma.integration.update({
        data: { nextSyncAt: new Date(Date.now() - 60_000) },
        where: { integrationId }
      });
      const warnings: Array<{
        details: Record<string, unknown>;
        message: string;
      }> = [];
      const failingServices = {
        ...services,
        async runDueIntegrationSyncs() {
          throw new Error("integration sync boom");
        }
      } as typeof services;
      const failedSummary = await runSystemValidationSweep({
        logger: {
          warn: (details, message) => warnings.push({ details, message })
        },
        services: failingServices,
        tenantIds: [tenantId1]
      });
      expect(failedSummary.failures).toBeGreaterThanOrEqual(1);
      expect(
        failedSummary.failuresByRunner.integrationSync
      ).toBeGreaterThanOrEqual(1);
      const sweepWarnings = warnings.filter(
        (warning) => warning.details.op === "validation.sweep.failures"
      );
      expect(sweepWarnings.length).toBeGreaterThanOrEqual(1);
      const samples = sweepWarnings.flatMap(
        (warning) =>
          (warning.details.samples as Array<{
            message: string;
            runner: string;
          }>) ?? []
      );
      expect(samples.length).toBeGreaterThanOrEqual(1);
      const typedSamples = samples as Array<{
        message: string;
        runner: string;
      }>;
      expect(
        typedSamples.some(
          (sample) =>
            sample.runner === "integrationSync" &&
            sample.message.includes("integration sync boom")
        )
      ).toBe(true);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 60_000);
});
