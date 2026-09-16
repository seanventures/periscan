import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { generateTotp } from "../../apps/api/src/totp.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function sessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );
  if (!cookie) {
    throw new Error("Expected a session cookie.");
  }
  return { [SESSION_COOKIE_NAME]: cookie.value };
}

describe("MFA recovery-code acceptance workflow", () => {
  it("issues single-use recovery codes, allows recovery login once, and regenerates", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    const email = uniqueEmail("mfa-recovery");
    const password = "mfa-recovery-password-123";

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email,
          name: "MFA Recovery User",
          password,
          tenantName: "MFA Recovery Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookies = sessionCookie(signup);

      const enroll = await app.inject({
        cookies,
        method: "POST",
        url: "/api/v1/auth/mfa/enroll"
      });
      const secret = (enroll.json() as { secret: string }).secret;

      // Activation returns exactly 10 single-use recovery codes (once).
      const verify = await app.inject({
        cookies,
        method: "POST",
        payload: { code: generateTotp(secret) },
        url: "/api/v1/auth/mfa/verify"
      });
      expect(verify.statusCode).toBe(200);
      const recoveryCodes = (verify.json() as { recoveryCodes: string[] })
        .recoveryCodes;
      expect(recoveryCodes).toHaveLength(10);
      expect(recoveryCodes[0]).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}/u);

      // Login with a recovery code succeeds.
      const recoveryLogin = await app.inject({
        method: "POST",
        payload: { email, password, recoveryCode: recoveryCodes[0] },
        url: "/api/v1/auth/login"
      });
      expect(recoveryLogin.statusCode).toBe(200);

      // The same recovery code cannot be reused (single-use).
      const reuse = await app.inject({
        method: "POST",
        payload: { email, password, recoveryCode: recoveryCodes[0] },
        url: "/api/v1/auth/login"
      });
      expect(reuse.statusCode).toBe(401);
      expect(reuse.json().code).toBe("mfa_invalid");

      // A TOTP code still works alongside recovery codes.
      const totpLogin = await app.inject({
        method: "POST",
        payload: { email, password, totpCode: generateTotp(secret) },
        url: "/api/v1/auth/login"
      });
      expect(totpLogin.statusCode).toBe(200);

      // Regenerate (re-auth with password) voids the old set and issues fresh.
      const regenerate = await app.inject({
        cookies,
        method: "POST",
        payload: { password },
        url: "/api/v1/auth/mfa/recovery-codes/regenerate"
      });
      expect(regenerate.statusCode).toBe(200);
      const freshCodes = (regenerate.json() as { recoveryCodes: string[] })
        .recoveryCodes;
      expect(freshCodes).toHaveLength(10);

      // A still-unused code from the OLD set no longer works after regenerate.
      const oldCodeLogin = await app.inject({
        method: "POST",
        payload: { email, password, recoveryCode: recoveryCodes[1] },
        url: "/api/v1/auth/login"
      });
      expect(oldCodeLogin.statusCode).toBe(401);

      // A code from the NEW set works.
      const newCodeLogin = await app.inject({
        method: "POST",
        payload: { email, password, recoveryCode: freshCodes[0] },
        url: "/api/v1/auth/login"
      });
      expect(newCodeLogin.statusCode).toBe(200);

      // Regenerate without re-auth is rejected.
      const noReauth = await app.inject({
        cookies,
        method: "POST",
        payload: {},
        url: "/api/v1/auth/mfa/recovery-codes/regenerate"
      });
      expect(noReauth.statusCode).toBe(401);
      expect(noReauth.json().code).toBe("reauth_required");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
