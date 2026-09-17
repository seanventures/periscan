import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
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
 * Evidence is the product's proof; downloading it now verifies chain-of-custody:
 * the response reports whether the stored content still matches the sha256
 * recorded at write time (integrityVerified) with both the recorded and the
 * recomputed hash.
 */
describe("Evidence integrity on download", () => {
  it("reports verified integrity with matching recorded + computed hashes", async () => {
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
          email: uniqueEmail("evidence-owner"),
          name: "Evidence Owner",
          password: "periscan-evidence-password",
          tenantName: "Evidence Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);

      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `evidence-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scope.json().scopeId}/verify`
      });

      // A snapshot produces evidence artifacts.
      const snapshot = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { audience: "Security Team", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshot.statusCode).toBe(201);
      const evidenceId = snapshot.json().evidenceIds[0] as string;
      expect(typeof evidenceId).toBe("string");

      const download = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/evidence/${evidenceId}/download`
      });
      expect(download.statusCode).toBe(200);
      const body = download.json();
      expect(body.integrityVerified).toBe(true);
      expect(typeof body.recordedSha256).toBe("string");
      expect(body.computedSha256).toBe(body.recordedSha256);
      expect(typeof body.content).toBe("string");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
