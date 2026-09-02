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

describe("MFA verify + login-enforcement acceptance workflow", () => {
  it("activates MFA on a valid code and then enforces it at login", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    const email = uniqueEmail("mfa-verify");
    const password = "mfa-verify-password-123";

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email,
          name: "MFA Verify User",
          password,
          tenantName: "MFA Verify Tenant"
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
      expect(enroll.statusCode).toBe(200);
      const secret = (enroll.json() as { secret: string }).secret;

      // An invalid code does not activate MFA.
      const badVerify = await app.inject({
        cookies,
        method: "POST",
        payload: { code: "000000" },
        url: "/api/v1/auth/mfa/verify"
      });
      expect(badVerify.statusCode).toBe(400);
      expect(badVerify.json().error).toBeTruthy();
      const stillInactive = await prisma.user.findUnique({ where: { userId } });
      expect(stillInactive?.mfaEnabledAt ?? null).toBeNull();

      // A valid code activates MFA.
      const verify = await app.inject({
        cookies,
        method: "POST",
        payload: { code: generateTotp(secret) },
        url: "/api/v1/auth/mfa/verify"
      });
      expect(verify.statusCode).toBe(200);
      expect(verify.json().activated).toBe(true);

      const activated = await prisma.user.findUnique({ where: { userId } });
      expect(activated?.mfaEnabledAt ?? null).not.toBeNull();
      const me = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/me"
      });
      expect(me.json().user.mfaEnabledAt ?? null).not.toBeNull();

      // Login WITHOUT a TOTP code is rejected once MFA is active.
      const loginNoCode = await app.inject({
        method: "POST",
        payload: { email, password },
        url: "/api/v1/auth/login"
      });
      expect(loginNoCode.statusCode).toBe(401);
      expect(loginNoCode.json().code).toBe("mfa_required");

      // Login WITH a wrong TOTP code is rejected.
      const loginWrongCode = await app.inject({
        method: "POST",
        payload: { email, password, totpCode: "000000" },
        url: "/api/v1/auth/login"
      });
      expect(loginWrongCode.statusCode).toBe(401);
      expect(loginWrongCode.json().code).toBe("mfa_invalid");

      // Login WITH a valid TOTP code succeeds.
      const loginGoodCode = await app.inject({
        method: "POST",
        payload: { email, password, totpCode: generateTotp(secret) },
        url: "/api/v1/auth/login"
      });
      expect(loginGoodCode.statusCode).toBe(200);
      expect(loginGoodCode.json().user.email).toBe(email);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
