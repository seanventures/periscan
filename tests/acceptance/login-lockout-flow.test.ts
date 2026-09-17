import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

describe("Login lockout acceptance workflow", () => {
  const original = process.env.PERISCAN_LOGIN_MAX_ATTEMPTS;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.PERISCAN_LOGIN_MAX_ATTEMPTS;
    } else {
      process.env.PERISCAN_LOGIN_MAX_ATTEMPTS = original;
    }
  });

  it("locks after repeated failures and unlocks on reset/expiry", async () => {
    // Lock after 3 consecutive failures (read at service-creation time).
    process.env.PERISCAN_LOGIN_MAX_ATTEMPTS = "3";

    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    const email = uniqueEmail("lockout");
    const password = "correct-password-123";

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email,
          name: "Lockout User",
          password,
          tenantName: "Lockout Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);

      async function attempt(pw: string) {
        return app.inject({
          method: "POST",
          payload: { email, password: pw },
          url: "/api/v1/auth/login"
        });
      }

      // First two wrong attempts: generic 401.
      expect((await attempt("wrong-1")).statusCode).toBe(401);
      expect((await attempt("wrong-2")).statusCode).toBe(401);

      // Third wrong attempt trips the lock → 429.
      const third = await attempt("wrong-3");
      expect(third.statusCode).toBe(429);
      expect(third.json().code).toBe("account_locked");

      // While locked, even the correct password is rejected with 429.
      const lockedCorrect = await attempt(password);
      expect(lockedCorrect.statusCode).toBe(429);

      // Simulate lock expiry (clear lockedUntil) → correct password works again.
      await prisma.user.update({
        data: { lockedUntil: null },
        where: { email }
      });
      const success = await attempt(password);
      expect(success.statusCode).toBe(200);

      // Successful login cleared the failure counter.
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user?.failedLoginAttempts).toBe(0);
      expect(user?.lockedUntil).toBeNull();
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
