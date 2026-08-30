import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import {
  MEASURED_POSTURE_MODULE_IDS,
  createRuntimeServices
} from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

describe("Validation Snapshot auto-runs measured posture checks", () => {
  it("stores measured DNS/TLS/HTTP/email posture evidence before rendering the snapshot", async () => {
    const prisma = createPrismaClient();
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
        prisma
      })
    });

    try {
      const { cookie, response } = await testHelpers.performSignup(
        app,
        "snapshot-posture",
        "Snapshot Posture Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const scopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `snapshot-posture-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const verifyResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verifyResponse.statusCode).toBe(200);

      const snapshotResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: { audience: "Security Team", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshotResponse.statusCode).toBe(201);
      expect(
        snapshotResponse.json().metrics.controlObservationCount
      ).toBeGreaterThan(0);

      const measuredRuns = await prisma.validationRun.findMany({
        orderBy: { createdAt: "asc" },
        select: {
          moduleId: true,
          status: true,
          target: true,
          validationState: true
        },
        where: {
          moduleId: {
            in: [...MEASURED_POSTURE_MODULE_IDS]
          },
          tenantId
        }
      });
      const measuredModuleIds = measuredRuns.map((run) => run.moduleId);

      expect(measuredModuleIds).toEqual(
        expect.arrayContaining([...MEASURED_POSTURE_MODULE_IDS])
      );
      expect(measuredRuns.every((run) => run.status === "Completed")).toBe(
        true
      );
      expect(
        measuredRuns.every(
          (run) =>
            typeof run.target === "object" &&
            run.target !== null &&
            "hostname" in run.target
        )
      ).toBe(true);

      const scopeAfterSnapshot = await prisma.scope.findUniqueOrThrow({
        select: {
          lastPostureCheckAt: true,
          nextPostureCheckAt: true
        },
        where: { scopeId }
      });
      expect(scopeAfterSnapshot.lastPostureCheckAt).toBeInstanceOf(Date);
      expect(scopeAfterSnapshot.nextPostureCheckAt).toBeInstanceOf(Date);
    } finally {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "snapshot-posture"
      ]);
      await app.close();
      await prisma.$disconnect();
    }
  }, 45_000);
});
