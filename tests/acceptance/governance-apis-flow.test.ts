import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

describe("enterprise governance APIs", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "governance-owner"
      ]);
      await prisma.$disconnect();
    }
  });

  it("exposes billing limits, audit export download, and pending approvals", async () => {
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
      const { cookie } = await testHelpers.performSignup(
        app,
        "governance-owner",
        "Governance Tenant"
      );

      const limitsResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "GET",
        url: "/api/v1/billing/limits"
      });
      expect(limitsResponse.statusCode).toBe(200);
      expect(limitsResponse.json()).toHaveProperty("limits");
      expect(limitsResponse.json()).toHaveProperty("usage");
      expect(limitsResponse.json().withinLimits).toBe(true);

      const approvalsResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "GET",
        url: "/api/v1/approvals/pending"
      });
      expect(approvalsResponse.statusCode).toBe(200);
      expect(Array.isArray(approvalsResponse.json().items)).toBe(true);

      // The signup itself produces auditable events, so an export has content.
      const exportResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "POST",
        payload: {
          format: "csv"
        },
        url: "/api/v1/audit-events/export"
      });
      expect(exportResponse.statusCode).toBe(201);
      const exportBody = exportResponse.json();
      expect(exportBody.format).toBe("csv");
      expect(exportBody.eventCount).toBeGreaterThan(0);
      // A small trail is fully exported: the count matches the total and the
      // export is honestly marked complete (not silently truncated).
      expect(exportBody.totalEventCount).toBe(exportBody.eventCount);
      expect(exportBody.truncated).toBe(false);

      const downloadResponse = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "GET",
        url: exportBody.downloadPath
      });
      expect(downloadResponse.statusCode).toBe(200);
      expect(downloadResponse.headers["content-type"]).toContain("text/csv");
      expect(downloadResponse.body).toContain("auditEventId");
    } finally {
      await app.close();
    }
  }, 30_000);
});
