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

function extractInviteToken(text: string): string {
  const match = text.match(/accept-invite\?token=([a-f0-9]+)/u);
  if (!match) {
    throw new Error(`No invite token in email body: ${text}`);
  }
  return match[1]!;
}

describe("Invite + accept acceptance workflow", () => {
  it("emails a new invitee a set-password link they can accept and sign in with", async () => {
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

    const inviteeEmail = uniqueEmail("invitee");
    const inviteePassword = "invitee-password-123";

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("owner"),
          name: "Owner",
          password: "owner-password-123",
          tenantName: "Invite Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookies = sessionCookie(signup);

      // Owner invites a brand-new user.
      const invite = await app.inject({
        cookies,
        method: "POST",
        payload: {
          email: inviteeEmail,
          name: "Invitee",
          role: "SecurityEngineer"
        },
        url: "/api/v1/tenants/current/invite"
      });
      expect(invite.statusCode).toBe(201);

      // The invitee cannot log in yet (no password set).
      const preAccept = await app.inject({
        method: "POST",
        payload: { email: inviteeEmail, password: inviteePassword },
        url: "/api/v1/auth/login"
      });
      expect(preAccept.statusCode).toBe(401);

      // An invite email was sent with an accept link + token.
      const inviteMessage = email.messages.find((m) => m.to === inviteeEmail);
      expect(inviteMessage).toBeDefined();
      const token = extractInviteToken(inviteMessage!.text);

      // Accept the invite by choosing a password.
      const accept = await app.inject({
        method: "POST",
        payload: { password: inviteePassword, token },
        url: "/api/v1/auth/accept-invite"
      });
      expect(accept.statusCode).toBe(200);

      // Now the invitee can sign in.
      const login = await app.inject({
        method: "POST",
        payload: { email: inviteeEmail, password: inviteePassword },
        url: "/api/v1/auth/login"
      });
      expect(login.statusCode).toBe(200);

      // The invite token is single-use.
      const reuse = await app.inject({
        method: "POST",
        payload: { password: "another-password-456", token },
        url: "/api/v1/auth/accept-invite"
      });
      expect(reuse.statusCode).toBe(400);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
