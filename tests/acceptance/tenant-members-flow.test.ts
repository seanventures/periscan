import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

async function buildTestApp(prisma: ReturnType<typeof createPrismaClient>) {
  return buildApp({
    devMode: true,
    services: createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      missionQueue: {
        async enqueueValidationJob() {
          return;
        }
      },
      prisma
    })
  });
}

describe("tenant members roster + role management flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "members-owner",
        "members-invitee"
      ]);
      await prisma.$disconnect();
    }
  });

  it("lists members joined to users without secrets", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "members-owner",
        "Members Tenant"
      );

      const response = await app.inject({
        cookies: testHelpers.authHeaders(cookie),
        method: "GET",
        url: "/api/v1/tenants/current/members"
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.items.length).toBeGreaterThanOrEqual(1);
      const owner = body.items[0];
      expect(owner.membership.role).toBe("Owner");
      expect(owner.user.email).toContain("members-owner");
      expect(owner.user).not.toHaveProperty("passwordHash");
    } finally {
      await app.close();
    }
  });

  it("changes a member's role, removes them, and protects the last owner", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildTestApp(prisma);
    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "members-owner",
        "Members Tenant"
      );
      const auth = testHelpers.authHeaders(cookie);

      // Invite a second member.
      const inviteResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          email: `members-invitee-${Date.now()}@example.com`,
          name: "Invited Member",
          role: "Viewer"
        },
        url: "/api/v1/tenants/current/invite"
      });
      expect(inviteResponse.statusCode).toBe(201);

      const roster = (
        await app.inject({
          cookies: auth,
          method: "GET",
          url: "/api/v1/tenants/current/members"
        })
      ).json();
      const owner = roster.items.find(
        (m: { membership: { role: string } }) => m.membership.role === "Owner"
      );
      const invitee = roster.items.find((m: { user: { email: string } }) =>
        m.user.email.includes("members-invitee")
      );
      expect(invitee).toBeTruthy();

      // Change the invitee's role.
      const patchResponse = await app.inject({
        cookies: auth,
        method: "PATCH",
        payload: { role: "SecurityEngineer" },
        url: `/api/v1/tenants/current/members/${invitee.membership.membershipId}`
      });
      expect(patchResponse.statusCode).toBe(200);
      expect(patchResponse.json().membership.role).toBe("SecurityEngineer");

      // Last-owner guard: removing the sole owner is rejected.
      const removeOwner = await app.inject({
        cookies: auth,
        method: "DELETE",
        url: `/api/v1/tenants/current/members/${owner.membership.membershipId}`
      });
      expect(removeOwner.statusCode).toBe(400);
      expect(removeOwner.json().code).toBe("last_owner");

      // Remove the invitee.
      const removeInvitee = await app.inject({
        cookies: auth,
        method: "DELETE",
        url: `/api/v1/tenants/current/members/${invitee.membership.membershipId}`
      });
      expect(removeInvitee.statusCode).toBe(204);

      const afterRoster = (
        await app.inject({
          cookies: auth,
          method: "GET",
          url: "/api/v1/tenants/current/members"
        })
      ).json();
      expect(
        afterRoster.items.some((m: { user: { email: string } }) =>
          m.user.email.includes("members-invitee")
        )
      ).toBe(false);
    } finally {
      await app.close();
    }
  });
});
