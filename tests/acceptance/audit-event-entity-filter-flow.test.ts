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

interface AuditEvent {
  entityId: string | null;
  entityType: string;
}

/**
 * The audit log can be scoped to a single entity (entityType + entityId), so an
 * operator can pull the full audit trail for one integration / scope / etc. for
 * forensics or compliance review — not just by action/actor/time.
 */
describe("Audit event entity filtering", () => {
  it("filters audit events to a specific entity", async () => {
    const prisma = createPrismaClient();
    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      const owner = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("audit-owner"),
          name: "Audit Owner",
          password: "periscan-audit-password",
          tenantName: "Audit Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(owner.statusCode).toBe(201);
      const cookie = sessionCookie(owner);

      // Create + sync an integration — this writes audit events scoped to the
      // integration entity.
      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { connectorKey: "tenable", mockMode: true },
        url: "/api/v1/integrations"
      });
      expect(created.statusCode).toBe(201);
      const integrationId = created.json().integrationId as string;

      await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });

      // Filter the audit log to exactly this integration.
      const scoped = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/audit-events?entityType=Integration&entityId=${integrationId}`
      });
      expect(scoped.statusCode).toBe(200);
      const scopedItems = scoped.json().items as AuditEvent[];
      expect(scopedItems.length).toBeGreaterThan(0);
      expect(
        scopedItems.every(
          (event) =>
            event.entityType === "Integration" &&
            event.entityId === integrationId
        )
      ).toBe(true);

      // A different entity id returns none of this integration's events.
      const otherEntity = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/audit-events?entityType=Integration&entityId=${randomUUID()}`
      });
      expect(otherEntity.statusCode).toBe(200);
      expect(
        (otherEntity.json().items as AuditEvent[]).some(
          (event) => event.entityId === integrationId
        )
      ).toBe(false);

      // entityType filtering alone never returns a different entity type.
      const byType = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/audit-events?entityType=Integration"
      });
      expect(byType.statusCode).toBe(200);
      const byTypeItems = byType.json().items as AuditEvent[];
      expect(byTypeItems.length).toBeGreaterThan(0);
      expect(
        byTypeItems.every((event) => event.entityType === "Integration")
      ).toBe(true);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 30_000);
});
