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
 * GET /api/v1/evidence accepts an optional ?limit so a tenant with a large
 * evidence history can bound the response (newest-first) instead of fetching
 * everything. Backward-compatible: no limit returns all artifacts.
 */
describe("Evidence list limit", () => {
  it("caps the evidence list to ?limit (newest-first) and returns all without it", async () => {
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
          email: uniqueEmail("evidence-limit-owner"),
          name: "Evidence Limit Owner",
          password: "periscan-evidence-limit-password",
          tenantName: "Evidence Limit Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = getSessionCookie(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      // Seed three evidence artifacts with increasing createdAt (newest last).
      for (let index = 0; index < 3; index += 1) {
        await prisma.evidenceArtifact.create({
          data: {
            artifactType: "NormalizedEvidence",
            createdAt: new Date(Date.UTC(2026, 5, 10 + index)),
            redactionStatus: "Redacted",
            relatedEntityId: randomUUID(),
            relatedEntityType: "ValidationRun",
            sensitivityLevel: "Moderate",
            sha256: "a".repeat(64),
            storageUri: `s3://evidence/${index}`,
            tenantId
          }
        });
      }

      // No limit → all three.
      const all = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/evidence"
      });
      expect(all.statusCode).toBe(200);
      expect((all.json().items as unknown[]).length).toBe(3);

      // ?limit=2 → the two newest (storageUri 2 then 1, createdAt desc).
      const limited = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/evidence?limit=2"
      });
      expect(limited.statusCode).toBe(200);
      const limitedUris = (
        limited.json().items as Array<{ storageUri: string }>
      ).map((item) => item.storageUri);
      expect(limitedUris).toEqual(["s3://evidence/2", "s3://evidence/1"]);

      // An out-of-range limit is clamped (>=1), not an error.
      const clamped = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/evidence?limit=0"
      });
      expect(clamped.statusCode).toBe(200);
      expect((clamped.json().items as unknown[]).length).toBeGreaterThanOrEqual(
        1
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
