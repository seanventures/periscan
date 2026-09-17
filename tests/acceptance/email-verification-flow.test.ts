import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { CaptureEmailTransport } from "../../apps/api/src/email.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
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

function extractVerifyToken(text: string): string {
  const match = text.match(/verify-email\?token=([a-f0-9]+)/u);
  if (!match) {
    throw new Error(`No verification token in email body: ${text}`);
  }
  return match[1]!;
}

describe("Email verification acceptance workflow", () => {
  it("emails a verification link on signup that marks the user verified", async () => {
    const prisma = createPrismaClient();
    const email = new CaptureEmailTransport();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        emailTransport: email,
        prisma
      })
    });

    const userEmail = uniqueEmail("verify");

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: userEmail,
          name: "Verify User",
          password: "verify-password-123",
          tenantName: "Verify Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookies = sessionCookie(signup);

      // Freshly signed-up user is not yet verified.
      expect(signup.json().user.emailVerifiedAt ?? null).toBeNull();

      // A verification email was sent.
      const message = email.messages.find((m) => m.to === userEmail);
      expect(message).toBeDefined();
      const token = extractVerifyToken(message!.text);

      // Verify with the token.
      const verify = await app.inject({
        method: "POST",
        payload: { token },
        url: "/api/v1/auth/verify-email"
      });
      expect(verify.statusCode).toBe(200);

      // /me now reflects the verified timestamp.
      const me = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/me"
      });
      expect(me.statusCode).toBe(200);
      expect(me.json().user.emailVerifiedAt).not.toBeNull();

      // The verification token is single-use.
      const reuse = await app.inject({
        method: "POST",
        payload: { token },
        url: "/api/v1/auth/verify-email"
      });
      expect(reuse.statusCode).toBe(400);

      // A bogus token is rejected.
      const bogus = await app.inject({
        method: "POST",
        payload: { token: "deadbeef" },
        url: "/api/v1/auth/verify-email"
      });
      expect(bogus.statusCode).toBe(400);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
