import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function getSessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );
  if (!cookie) {
    throw new Error("Expected a Periscan session cookie.");
  }
  return cookie.value;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

/**
 * Scope deletion is a lifecycle + governance action: it must delete the tenant's
 * own scope (204) and audit it, return 404 for a missing scope, and be
 * tenant-isolated — one tenant can never delete another tenant's scope.
 */
describe("Scope deletion", () => {
  it("deletes + audits an owned scope, 404s a missing one, and isolates across tenants", async () => {
    const prisma = createPrismaClient();
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const ownerSignup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("scope-delete-owner"),
          name: "Scope Delete Owner",
          password: "periscan-scope-delete-password",
          tenantName: "Scope Delete Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(ownerSignup.statusCode).toBe(201);
      const ownerCookie = getSessionCookie(ownerSignup);
      const tenantId = ownerSignup.json().tenant.tenantId as string;

      // A second, unrelated tenant (for isolation).
      const otherSignup = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("scope-delete-other"),
          name: "Scope Delete Other",
          password: "periscan-scope-delete-other-password",
          tenantName: "Scope Delete Other Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(otherSignup.statusCode).toBe(201);
      const otherCookie = getSessionCookie(otherSignup);

      const scope = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `scope-delete-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;

      // Another tenant cannot delete this tenant's scope (404, not 204) — the
      // scope is invisible across the tenant boundary.
      const crossTenantDelete = await app.inject({
        cookies: authCookies(otherCookie),
        method: "DELETE",
        url: `/api/v1/scopes/${scopeId}`
      });
      expect(crossTenantDelete.statusCode).toBe(404);
      expect(crossTenantDelete.json().code).toBe("scope_not_found");

      // The scope still exists for its owner after the cross-tenant attempt.
      const stillThere = await prisma.scope.findFirst({
        where: { scopeId, tenantId }
      });
      expect(stillThere).not.toBeNull();

      // The owner deletes it: 204 + audited.
      const ownerDelete = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "DELETE",
        url: `/api/v1/scopes/${scopeId}`
      });
      expect(ownerDelete.statusCode).toBe(204);

      const deleted = await prisma.scope.findFirst({
        where: { scopeId }
      });
      expect(deleted).toBeNull();

      const auditEvent = await prisma.auditEvent.findFirst({
        where: { action: "scope_deleted", entityId: scopeId, tenantId }
      });
      expect(auditEvent).not.toBeNull();

      // The deleted scope no longer appears in the owner's scope list.
      const list = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "GET",
        url: "/api/v1/scopes"
      });
      expect(list.statusCode).toBe(200);
      expect(
        (list.json().items as Array<{ scopeId: string }>).some(
          (item) => item.scopeId === scopeId
        )
      ).toBe(false);

      // Deleting an already-gone scope returns 404.
      const reDelete = await app.inject({
        cookies: authCookies(ownerCookie),
        method: "DELETE",
        url: `/api/v1/scopes/${scopeId}`
      });
      expect(reDelete.statusCode).toBe(404);
      expect(reDelete.json().code).toBe("scope_not_found");
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
