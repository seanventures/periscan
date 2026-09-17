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

describe("MFA disable/reset acceptance workflow", () => {
  it("requires re-auth, then clears every factor and stops enforcing at login", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    const email = uniqueEmail("mfa-disable");
    const password = "mfa-disable-password-123";

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email,
          name: "MFA Disable User",
          password,
          tenantName: "MFA Disable Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookies = sessionCookie(signup);
      const userId = signup.json().user.userId as string;

      const enroll = await app.inject({
        cookies,
        method: "POST",
        url: "/api/v1/auth/mfa/enroll"
      });
      const secret = (enroll.json() as { secret: string }).secret;

      const verify = await app.inject({
        cookies,
        method: "POST",
        payload: { code: generateTotp(secret) },
        url: "/api/v1/auth/mfa/verify"
      });
      expect(verify.statusCode).toBe(200);
      expect(
        (verify.json() as { recoveryCodes: string[] }).recoveryCodes
      ).toHaveLength(10);

      // Disable without re-auth is rejected.
      const noReauth = await app.inject({
        cookies,
        method: "POST",
        payload: {},
        url: "/api/v1/auth/mfa/disable"
      });
      expect(noReauth.statusCode).toBe(401);
      expect(noReauth.json().code).toBe("reauth_required");
      const stillActive = await prisma.user.findUnique({ where: { userId } });
      expect(stillActive?.mfaEnabledAt ?? null).not.toBeNull();

      // Disable with the current password clears every factor.
      const disable = await app.inject({
        cookies,
        method: "POST",
        payload: { password },
        url: "/api/v1/auth/mfa/disable"
      });
      expect(disable.statusCode).toBe(200);
      expect(disable.json().disabled).toBe(true);

      const cleared = await prisma.user.findUnique({ where: { userId } });
      expect(cleared?.mfaSecret ?? null).toBeNull();
      expect(cleared?.mfaEnabledAt ?? null).toBeNull();
      const remainingCodes = await prisma.mfaRecoveryCode.count({
        where: { userId }
      });
      expect(remainingCodes).toBe(0);

      // Login now works with just the password (no second factor required).
      const login = await app.inject({
        method: "POST",
        payload: { email, password },
        url: "/api/v1/auth/login"
      });
      expect(login.statusCode).toBe(200);
      expect(login.json().user.mfaEnabledAt ?? null).toBeNull();

      // MFA can be re-enrolled after a reset.
      const reEnroll = await app.inject({
        cookies,
        method: "POST",
        url: "/api/v1/auth/mfa/enroll"
      });
      expect(reEnroll.statusCode).toBe(200);
      expect((reEnroll.json() as { secret: string }).secret).toMatch(
        /^[A-Z2-7]+$/u
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
