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

describe("MFA enrollment acceptance workflow", () => {
  it("issues a TOTP secret + otpauth URI and stores the secret encrypted, inactive", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    const email = uniqueEmail("mfa");

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email,
          name: "MFA User",
          password: "mfa-user-password-123",
          tenantName: "MFA Tenant"
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
      const body = enroll.json() as { secret: string; otpauthUri: string };
      expect(body.secret).toMatch(/^[A-Z2-7]+$/u);
      expect(body.otpauthUri).toContain("otpauth://totp/");
      expect(body.otpauthUri).toContain(`secret=${body.secret}`);

      // The returned secret produces valid TOTP codes.
      expect(generateTotp(body.secret)).toMatch(/^\d{6}$/u);

      // Stored secret is encrypted at rest (not the plaintext) and MFA is not
      // active yet — activation happens after a code is verified.
      const user = await prisma.user.findUnique({ where: { userId } });
      expect(user?.mfaSecret).toBeTruthy();
      expect(user?.mfaSecret).not.toBe(body.secret);
      expect(user?.mfaEnabledAt ?? null).toBeNull();

      // Status is not exposed as enabled in the user payload yet.
      const me = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/me"
      });
      expect(me.json().user.mfaEnabledAt ?? null).toBeNull();
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
