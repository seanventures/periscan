import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

async function buildTestApp(prisma: ReturnType<typeof createPrismaClient>) {
  return buildApp({
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
}

describe("executive trend time-series flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["exec-series"]);
      await prisma.$disconnect();
    }
  });

  it("captures a snapshot on read and returns it as a series", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "exec-series",
        "Exec Series Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);

      // No history before the dashboard is read.
      const before = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/tenants/current/executive-trends/series"
      });
      expect(before.statusCode).toBe(200);
      expect(before.json().metrics).toEqual([]);

      // Reading the executive dashboard captures a real snapshot.
      const trends = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/tenants/current/executive-trends"
      });
      expect(trends.statusCode).toBe(200);
      const metricCount = trends.json().metrics.length;
      expect(metricCount).toBeGreaterThan(0);

      // The series now carries one point per captured metric.
      const after = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/tenants/current/executive-trends/series"
      });
      expect(after.statusCode).toBe(200);
      const series = after.json();
      expect(series.metrics.length).toBe(metricCount);
      for (const metric of series.metrics) {
        expect(metric.points.length).toBeGreaterThanOrEqual(1);
        expect(typeof metric.points[0].value).toBe("number");
        expect(typeof metric.points[0].capturedAt).toBe("string");
      }

      // A second read within the throttle window does not add a second point.
      await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/tenants/current/executive-trends"
      });
      const stillOne = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/tenants/current/executive-trends/series"
      });
      const firstMetric = stillOne.json().metrics[0];
      expect(firstMetric.points.length).toBe(1);
    } finally {
      await app.close();
    }
  });
});
