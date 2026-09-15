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
 * A public report share link exposes the full report to anyone with the URL, so
 * minting one requires the same editor privilege as creating the report. A
 * read-only Viewer must not be able to share a report externally.
 */
describe("Report share-link creation is gated to editor roles", () => {
  it("forbids a Viewer from minting a public share link but allows an editor", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });
    let tenantId = "";

    try {
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("share-role-owner"),
          name: "Share Role Owner",
          password: "periscan-share-role-password",
          tenantName: "Share Role Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);
      tenantId = owner.json().tenant.tenantId as string;

      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `share-role-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scope.json().scopeId}/verify`
      });

      const snapshot = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { audience: "Security Team", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      expect(snapshot.statusCode).toBe(201);
      const reportId = snapshot.json().snapshotId as string;

      // As the Owner (an editor role) the share link is minted.
      const asOwner = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/reports/${reportId}/share-link`
      });
      expect(asOwner.statusCode).toBe(201);
      expect(asOwner.json().token).toBeTruthy();

      // Demote the member to a read-only Viewer (role is resolved per request).
      await prisma.membership.updateMany({
        data: { role: "Viewer" },
        where: { tenantId }
      });

      const asViewer = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/reports/${reportId}/share-link`
      });
      expect(asViewer.statusCode).toBe(403);
    } finally {
      // No tenant cleanup: deleting a tenant here races the concurrent global
      // system-validation-sweep test (a tenant vanishing mid-sweep counts as a
      // sweep failure); the shared acceptance DB accumulates test data anyway.
      void tenantId;
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
