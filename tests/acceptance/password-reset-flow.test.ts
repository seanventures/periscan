import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { CaptureEmailTransport } from "../../apps/api/src/email.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function extractToken(text: string): string {
  const match = text.match(/reset-password\?token=([a-f0-9]+)/u);
  if (!match) {
    throw new Error(`No reset token found in email body: ${text}`);
  }
  return match[1]!;
}

describe("Password reset acceptance workflow", () => {
  it("emails a token, lets the user set a new password, and is single-use", async () => {
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

    const userEmail = uniqueEmail("reset");
    const originalPassword = "original-password-123";
    const newPassword = "brand-new-password-456";

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: userEmail,
          name: "Reset User",
          password: originalPassword,
          tenantName: "Reset Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);

      // Request a reset → 202 and a reset email captured. (Signup also sends a
      // verification email, so select the reset message specifically.)
      const request = await app.inject({
        method: "POST",
        payload: { email: userEmail },
        url: "/api/v1/auth/password-reset/request"
      });
      expect(request.statusCode).toBe(202);
      const resetMessage = email.messages.find(
        (m) => m.to === userEmail && m.text.includes("reset-password?token=")
      );
      expect(resetMessage).toBeDefined();
      const token = extractToken(resetMessage!.text);

      // Confirm with the token → password updated.
      const confirm = await app.inject({
        method: "POST",
        payload: { password: newPassword, token },
        url: "/api/v1/auth/password-reset/confirm"
      });
      expect(confirm.statusCode).toBe(200);

      // New password works; old one no longer does.
      const goodLogin = await app.inject({
        method: "POST",
        payload: { email: userEmail, password: newPassword },
        url: "/api/v1/auth/login"
      });
      expect(goodLogin.statusCode).toBe(200);

      const oldLogin = await app.inject({
        method: "POST",
        payload: { email: userEmail, password: originalPassword },
        url: "/api/v1/auth/login"
      });
      expect(oldLogin.statusCode).toBe(401);

      // The token is single-use → reuse rejected.
      const reuse = await app.inject({
        method: "POST",
        payload: { password: "yet-another-password-789", token },
        url: "/api/v1/auth/password-reset/confirm"
      });
      expect(reuse.statusCode).toBe(400);

      // A bogus token is rejected.
      const bogus = await app.inject({
        method: "POST",
        payload: { password: "irrelevant-password-000", token: "deadbeef" },
        url: "/api/v1/auth/password-reset/confirm"
      });
      expect(bogus.statusCode).toBe(400);

      // Requesting a reset for an unknown email still returns 202 and sends
      // nothing (no account enumeration) — message count is unchanged.
      const beforeUnknown = email.messages.length;
      const unknown = await app.inject({
        method: "POST",
        payload: { email: uniqueEmail("nobody") },
        url: "/api/v1/auth/password-reset/request"
      });
      expect(unknown.statusCode).toBe(202);
      expect(email.messages).toHaveLength(beforeUnknown);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
