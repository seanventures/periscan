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
 * Customer authorization to validate a scope should not be trusted forever. A
 * freshly verified scope reports verificationStale=false with a future
 * verificationExpiresAt; once the verification ages past the max window it is
 * flagged stale (informational — it does not by itself block validation, but
 * surfaces that authorization should be re-confirmed).
 */
describe("Scope verification staleness", () => {
  it("flags a verified scope as stale once its verification ages out", async () => {
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
          email: uniqueEmail("scope-owner"),
          name: "Scope Owner",
          password: "periscan-scope-password",
          tenantName: "Scope Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `scope-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(created.statusCode).toBe(201);
      const scopeId = created.json().scopeId as string;
      // Pending (unverified) scope has no expiry and is not flagged stale.
      expect(created.json().verificationStale).toBe(false);
      expect(created.json().verificationExpiresAt ?? null).toBeNull();

      const verified = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);
      // Freshly verified: not stale, expiry is in the future.
      expect(verified.json().verificationStale).toBe(false);
      const expiresAt = verified.json().verificationExpiresAt as string;
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

      // Age the verification well past the default 90-day window.
      await prisma.scope.update({
        data: {
          verifiedAt: new Date(Date.now() - 200 * 86_400_000)
        },
        where: { scopeId }
      });

      const aged = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/scopes/${scopeId}`
      });
      expect(aged.statusCode).toBe(200);
      // Now flagged stale, with an expiry in the past.
      expect(aged.json().verificationStale).toBe(true);
      expect(
        new Date(aged.json().verificationExpiresAt as string).getTime()
      ).toBeLessThan(Date.now());
      // Still Verified — staleness is informational, not a status change.
      expect(aged.json().verificationStatus).toBe("Verified");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
