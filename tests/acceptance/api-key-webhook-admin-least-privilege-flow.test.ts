import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

/**
 * ICP-P1-9 / P20-17 residual: a key minted with only `webhook:admin` must
 * manage outbound webhooks + event-catalog without elevating to Admin on
 * other surfaces (API key management, missions, audit export).
 */
describe("API key webhook:admin least privilege", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "apikey-webhook-admin"
      ]);
      await prisma.$disconnect();
    }
  });

  it("maps webhook:admin alone to Viewer, allows catalog, denies Admin surfaces", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma,
        webhookQueue: null
      })
    });

    try {
      const { cookie: ownerCookie } = await testHelpers.performSignup(
        app,
        "apikey-webhook-admin",
        "Webhook Admin LP Tenant"
      );

      const createKey = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          name: "webhook-only-automation",
          scopes: ["webhook:admin"]
        },
        url: "/api/v1/tenants/current/api-keys"
      });
      expect(createKey.statusCode).toBe(201);
      expect(createKey.json().scopes).toEqual(["webhook:admin"]);
      const secret = createKey.json().secret as string;
      expect(secret).toMatch(/^psk_/);

      const me = await app.inject({
        headers: { authorization: `Bearer ${secret}` },
        method: "GET",
        url: "/api/v1/me"
      });
      expect(me.statusCode).toBe(200);
      // Role mapping must stay Viewer — not Admin.
      expect(me.json().membership.role).toBe("Viewer");

      // Allowed: discoverable event catalog for receivers (P20-5 / ICP-P1-8).
      const catalog = await app.inject({
        headers: { authorization: `Bearer ${secret}` },
        method: "GET",
        url: "/api/v1/tenants/current/webhooks/event-catalog"
      });
      expect(catalog.statusCode).toBe(200);
      const catalogBody = catalog.json();
      expect(catalogBody.eventTypes).toHaveLength(9);
      expect(catalogBody.eventTypes).toEqual(
        expect.arrayContaining([
          "mission.started",
          "mission.completed",
          "mission.failed",
          "snapshot.ready",
          "remediation.created",
          "remediation.verified",
          "finding.disposition_changed",
          "policy.denied",
          "schedule.failed"
        ])
      );
      expect(catalogBody.eventDataSummaries).toHaveLength(9);
      expect(catalogBody.headers).toEqual(
        expect.objectContaining({
          signature: "x-periscan-signature",
          event: "x-periscan-event",
          delivery: "x-periscan-delivery",
          idempotencyKey: "x-periscan-idempotency-key"
        })
      );
      expect(catalogBody.signatureFormat).toBe("sha256=<hex>");
      expect(catalogBody.productPath).toBe("ApiAvailable");
      // Catalog must never return secrets.
      expect(JSON.stringify(catalogBody)).not.toMatch(/whsec_/);

      // Allowed: list webhooks (empty is fine).
      const listWebhooks = await app.inject({
        headers: { authorization: `Bearer ${secret}` },
        method: "GET",
        url: "/api/v1/tenants/current/webhooks"
      });
      expect(listWebhooks.statusCode).toBe(200);
      expect(Array.isArray(listWebhooks.json().items)).toBe(true);

      // Denied: Admin-only API key management (requireRole TENANT_ADMIN).
      const listKeys = await app.inject({
        headers: { authorization: `Bearer ${secret}` },
        method: "GET",
        url: "/api/v1/tenants/current/api-keys"
      });
      expect(listKeys.statusCode).toBe(403);

      // Denied: audit list needs audit:read capability.
      const auditList = await app.inject({
        headers: { authorization: `Bearer ${secret}` },
        method: "GET",
        url: "/api/v1/audit-events?limit=1"
      });
      expect(auditList.statusCode).toBe(403);
      expect(auditList.json().code).toBe("api_key_capability_denied");

      // Denied: mission create needs SecurityEngineer role + mission:run.
      // Use a real scope so Zod validation succeeds and role/capability gates fire.
      const scopeResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `webhook-lp-${Date.now()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;

      const createMission = await app.inject({
        headers: { authorization: `Bearer ${secret}` },
        method: "POST",
        payload: {
          missionType: "ValidationSnapshot",
          safetyLevel: "PassiveReadOnly",
          scopeId
        },
        url: "/api/v1/missions"
      });
      expect(createMission.statusCode).toBe(403);
    } finally {
      await app.close();
    }
  }, 30_000);
});
