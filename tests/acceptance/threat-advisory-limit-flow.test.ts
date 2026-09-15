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
 * GET /api/v1/threat-advisories accepts an optional ?limit so a tenant with a
 * large advisory history can bound the response (newest-first) instead of
 * fetching everything. Backward-compatible: no limit returns all advisories.
 */
describe("Threat advisory list limit", () => {
  it("caps the advisory list to ?limit (newest-first) and returns all without it", async () => {
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
          email: uniqueEmail("advisory-limit-owner"),
          name: "Advisory Limit Owner",
          password: "periscan-advisory-limit-password",
          tenantName: "Advisory Limit Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);

      // Import three distinct advisories (newest imported last).
      const titles = ["Advisory Alpha", "Advisory Bravo", "Advisory Charlie"];
      for (const title of titles) {
        const imported = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            cveIds: [`cve-2026-${randomUUID().slice(0, 8)}`],
            rawContent: `Advisory ${title} references CVE-2026-12345 and T1059.001.`,
            sourceName: "Limit Test Desk",
            summary: "Advisory for the list-limit acceptance check.",
            title
          },
          url: "/api/v1/threat-advisories"
        });
        expect(imported.statusCode).toBe(201);
      }

      // No limit → all three advisories.
      const all = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/threat-advisories"
      });
      expect(all.statusCode).toBe(200);
      expect((all.json().items as unknown[]).length).toBe(3);

      // ?limit=2 → only the two newest (Charlie, then Bravo), order preserved.
      const limited = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/threat-advisories?limit=2"
      });
      expect(limited.statusCode).toBe(200);
      const limitedTitles = (
        limited.json().items as Array<{ title: string }>
      ).map((item) => item.title);
      expect(limitedTitles).toEqual(["Advisory Charlie", "Advisory Bravo"]);

      // An out-of-range limit is clamped (>=1), not an error.
      const clamped = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/threat-advisories?limit=0"
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
