import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * Slice 10 release-qual — P10-2 schedule runner affinity at fire time.
 *
 * When preferredRunnerId is unset but hard siteId affinity is set on the
 * schedule, fire must pin validationRun.runnerId to the matching healthy
 * fleet member (not the wrong site, not unbound when a hard site is required).
 *
 * Pure pick helpers are unit-tested elsewhere; this suite proves the HTTP
 * create → run path stamps the chosen runner on the durable run row.
 */
describe("schedule affinity fire (P10-2 residual)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "sched-affinity"
      ]);
      await prisma.$disconnect();
    }
  });

  it("pins scheduled ControlValidation run to the site-matching runner", async () => {
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
        prisma,
        webhookQueue: null
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "sched-affinity",
        "Schedule Affinity Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const auth = testHelpers.authHeaders(cookie);

      await prisma.tenant.update({
        data: { billingPackageKey: "ValidationSnapshot" },
        where: { tenantId }
      });

      const scope = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `sched-aff-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      const verified = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);

      // Two healthy runners at different sites; schedule hard-affines plant-3.
      const plantRunner = await prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "hash-plant",
          capabilities: {},
          deploymentMode: "Docker",
          hostname: "plant-affinity-runner",
          labels: [],
          name: "Plant Affinity Runner",
          networkProfile: {},
          networkSegment: "ot-cell-b",
          os: "linux",
          siteId: "plant-3",
          status: "Active",
          tenantId,
          transportMode: "LongPollHttps",
          version: "1.0.0"
        }
      });
      const hqRunner = await prisma.runner.create({
        data: {
          arch: "amd64",
          authTokenHash: "hash-hq",
          capabilities: {},
          deploymentMode: "Docker",
          hostname: "hq-affinity-runner",
          labels: [],
          name: "HQ Affinity Runner",
          networkProfile: {},
          networkSegment: "campus",
          os: "linux",
          siteId: "hq-1",
          status: "Active",
          tenantId,
          transportMode: "LongPollHttps",
          version: "1.0.0"
        }
      });

      const create = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          frequency: "Daily",
          missionType: "ControlValidation",
          scopeIds: [scopeId],
          siteId: "plant-3",
          networkSegment: "ot-cell-b"
        },
        url: "/api/v1/schedules"
      });
      expect(create.statusCode).toBe(201);
      const scheduleId = create.json().scheduleId as string;
      // Affinity fields land in schedule config (not top-level columns).
      const stored = await prisma.missionSchedule.findUniqueOrThrow({
        where: { scheduleId }
      });
      const config = (stored.config ?? {}) as Record<string, unknown>;
      expect(config.siteId).toBe("plant-3");
      expect(config.networkSegment).toBe("ot-cell-b");
      expect(config.preferredRunnerId).toBeUndefined();

      const runRes = await app.inject({
        cookies: auth,
        method: "POST",
        url: `/api/v1/schedules/${scheduleId}/run`
      });
      expect(runRes.statusCode).toBe(201);

      const runs = await prisma.validationRun.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 5
      });
      expect(runs.length).toBeGreaterThanOrEqual(1);
      const pinned = runs.find((run) => run.runnerId === plantRunner.runnerId);
      expect(pinned).toBeDefined();
      expect(pinned!.runnerId).toBe(plantRunner.runnerId);
      expect(pinned!.runnerId).not.toBe(hqRunner.runnerId);

      const target = (pinned!.target ?? {}) as Record<string, unknown>;
      expect(target.affinitySelectedRunnerId).toBe(plantRunner.runnerId);
    } finally {
      await app.close();
    }
  }, 60_000);
});
