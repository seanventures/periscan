import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("Datto RMM connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates Datto RMM telemetry through the public API", async () => {
    const prisma = createPrismaClient();
    await probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie, response: signup } = await performSignup(
        app,
        "datto-rmm-acceptance",
        "Datto RMM Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextApiKey = "datto-rmm-acceptance-key";
      const plaintextApiSecret = "datto-rmm-acceptance-secret";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiKey",
          config: {
            apiBaseUrl: "https://datto.acceptance.test",
            apiKey: plaintextApiKey,
            apiSecret: plaintextApiSecret,
            connectorKey: "datto-rmm",
            max: 100,
            page: 1
          },
          connectorKey: "datto-rmm",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "apiKey",
        category: "MSSP",
        config: {
          apiBaseUrl: "https://datto.acceptance.test",
          apiKey: "[redacted]",
          apiSecret: "[redacted]",
          connectorKey: "datto-rmm",
          max: 100,
          mockMode: true,
          page: 1
        },
        product: "Datto RMM",
        status: "Connected",
        vendor: "Kaseya"
      });
      expect(JSON.stringify(created.json())).not.toContain(plaintextApiKey);
      expect(JSON.stringify(created.json())).not.toContain(plaintextApiSecret);

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.apiKey).not.toBe(plaintextApiKey);
      expect(storedConfig.apiSecret).not.toBe(plaintextApiSecret);
      expect(String(storedConfig.apiKey)).toMatch(/^v1\./u);
      expect(String(storedConfig.apiSecret)).toMatch(/^v1\./u);
      expect(storedConfig.apiBaseUrl).toBe("https://datto.acceptance.test");

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextApiKey);
      expect(JSON.stringify(health.json())).not.toContain(plaintextApiSecret);

      const synced = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(synced.statusCode).toBe(200);
      expect(synced.json()).toMatchObject({
        assetCount: 4,
        health: { status: "Healthy" },
        signalCount: 5
      });
      expect(JSON.stringify(synced.json())).not.toContain(plaintextApiKey);
      expect(JSON.stringify(synced.json())).not.toContain(plaintextApiSecret);

      const assets = await prisma.asset.findMany({
        where: { tenantId, tags: { has: "datto-rmm" } }
      });
      expect(assets).toHaveLength(4);
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining([
          "datto-rmm-site/Acme Manufacturing",
          "datto-rmm-site/Northwind Labs",
          "datto-rmm-device/acme-edge-01",
          "datto-rmm-device/northwind-laptop-08"
        ])
      );
      expect(
        assets.find((asset) => asset.name === "datto-rmm-device/acme-edge-01")
          ?.status
      ).toBe("Inactive");
      expect(
        assets.find((asset) => asset.name === "datto-rmm-device/acme-edge-01")
          ?.businessCriticality
      ).toBe("High");

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(5);
      expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
        expect.arrayContaining([
          "DattoRmmSiteObserved",
          "DattoRmmDeviceObserved",
          "DattoRmmOfflineDeviceObserved"
        ])
      );
      expect(
        signals.filter(
          (signal) =>
            signal.signalSubcategory === "DattoRmmOfflineDeviceObserved"
        )
      ).toHaveLength(1);
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextApiKey);
      expect(JSON.stringify(signals)).not.toContain(plaintextApiSecret);

      const evidence = await prisma.evidenceArtifact.findMany({
        where: {
          relatedEntityId: integrationId,
          relatedEntityType: "Integration",
          tenantId
        }
      });
      expect(evidence).toHaveLength(1);
      expect(evidence[0]).toMatchObject({
        artifactType: "NormalizedEvidence",
        redactionStatus: "Redacted"
      });

      const trustSafety = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/tenants/current/trust-safety"
      });
      expect(trustSafety.statusCode).toBe(200);
      const connected = trustSafety
        .json()
        .connectedIntegrations.find(
          (item: { integrationId: string }) =>
            item.integrationId === integrationId
        );
      expect(connected).toMatchObject({
        category: "MSSP",
        healthStatus: "Healthy",
        lastSyncAt: expect.any(String),
        product: "Datto RMM",
        status: "Connected",
        vendor: "Kaseya"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "POST /auth/oauth/token",
          "GET /api/v2/account/devices"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(plaintextApiKey);
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextApiSecret
      );

      const auditEvents = await prisma.auditEvent.findMany({
        orderBy: { createdAt: "asc" },
        where: {
          action: { in: ["integration_connected", "integration_synced"] },
          entityId: integrationId,
          tenantId
        }
      });
      expect(auditEvents.map((event) => event.action)).toEqual([
        "integration_connected",
        "integration_synced"
      ]);
      expect(auditEvents[1]?.metadata).toMatchObject({
        assetCount: 4,
        connectorKey: "datto-rmm",
        healthStatus: "Healthy",
        signalCount: 5,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "datto-rmm-other",
        "Datto RMM Other Tenant"
      );

      const crossTenantRead = await app.inject({
        cookies: authCookies(otherCookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}`
      });
      expect(crossTenantRead.statusCode).toBe(404);

      const crossTenantSync = await app.inject({
        cookies: authCookies(otherCookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(crossTenantSync.statusCode).toBe(404);
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
