import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

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
 * GET /api/v1/reports accepts an optional ?limit so a tenant with a large
 * report history can bound the response (newest-first) instead of fetching
 * everything. Backward-compatible: no limit returns all evidence packs.
 */
describe("Report list limit", () => {
  it("caps the report list to ?limit (newest-first) and returns all without it", async () => {
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
          email: uniqueEmail("report-limit-owner"),
          name: "Report Limit Owner",
          password: "periscan-report-limit-password",
          tenantName: "Report Limit Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      for (let index = 0; index < 3; index += 1) {
        await prisma.evidencePack.create({
          data: {
            audience: "Security Team",
            createdAt: new Date(Date.UTC(2026, 5, 10 + index)),
            evidenceIds: [],
            packType: "ValidationSnapshotReport",
            redactionLevel: "Moderate",
            status: "Ready",
            storageUri: `s3://reports/${index}.html`,
            tenantId,
            title: `Report ${index}`
          }
        });
      }

      const all = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/reports"
      });
      expect(all.statusCode).toBe(200);
      expect((all.json().items as unknown[]).length).toBe(3);

      const limited = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/reports?limit=2"
      });
      expect(limited.statusCode).toBe(200);
      const limitedTitles = (
        limited.json().items as Array<{ title: string }>
      ).map((item) => item.title);
      expect(limitedTitles).toEqual(["Report 2", "Report 1"]);

      const clamped = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/reports?limit=0"
      });
      expect(clamped.statusCode).toBe(200);
      expect((clamped.json().items as unknown[]).length).toBeGreaterThanOrEqual(
        1
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
