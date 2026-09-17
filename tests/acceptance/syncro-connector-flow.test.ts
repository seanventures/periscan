import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("Syncro connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates Syncro customer, asset, and ticket telemetry through the public API", async () => {
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
        "syncro-acceptance",
        "Syncro Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextApiKey = "syncro-acceptance-api-key";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiKey",
          config: {
            apiBaseUrl: "https://acme.syncromsp.com/api/v1",
            apiKey: plaintextApiKey,
            connectorKey: "syncro",
            customerId: 1101,
            defaultCustomerId: 1101,
            includeAssets: true,
            includeCustomers: true,
            includeTickets: true,
            page: 1,
            priority: "High",
            status: "New",
            ticketStatusFilter: "Not Closed",
            ticketTypeId: 8
          },
          connectorKey: "syncro",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "apiKey",
        category: "MSSP",
        config: {
          apiBaseUrl: "https://acme.syncromsp.com/api/v1",
          apiKey: "[redacted]",
          connectorKey: "syncro",
          customerId: 1101,
          defaultCustomerId: 1101,
          includeAssets: true,
          includeCustomers: true,
          includeTickets: true,
          mockMode: true,
          page: 1,
          priority: "High",
          status: "New",
          ticketStatusFilter: "Not Closed",
          ticketTypeId: 8
        },
        product: "Syncro",
        status: "Connected",
        vendor: "Syncro"
      });
      expect(JSON.stringify(created.json())).not.toContain(plaintextApiKey);

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.apiKey).not.toBe(plaintextApiKey);
      expect(String(storedConfig.apiKey)).toMatch(/^v1\./u);
      expect(storedConfig.apiBaseUrl).toBe("https://acme.syncromsp.com/api/v1");

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextApiKey);

      const synced = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(synced.statusCode).toBe(200);
      expect(synced.json()).toMatchObject({
        assetCount: 4,
        health: { status: "Healthy" },
        signalCount: 8
      });
      expect(JSON.stringify(synced.json())).not.toContain(plaintextApiKey);

      const assets = await prisma.asset.findMany({
        where: { tenantId, tags: { has: "syncro" } }
      });
      expect(assets).toHaveLength(4);
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining([
          "syncro-customer/Acme Manufacturing",
          "syncro-customer/Northwind Labs",
          "syncro-asset/acme-dc-02",
          "syncro-asset/northwind-laptop-21"
        ])
      );
      expect(assets.every((asset) => asset.environment === "mssp-rmm")).toBe(
        true
      );

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(8);
      expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
        expect.arrayContaining([
          "SyncroCustomerObserved",
          "SyncroAssetObserved",
          "SyncroOfflineAssetObserved",
          "SyncroTicketObserved",
          "SyncroOpenTicketObserved"
        ])
      );
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "SyncroCustomerObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "SyncroAssetObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "SyncroOfflineAssetObserved"
        )
      ).toHaveLength(1);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "SyncroTicketObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "SyncroOpenTicketObserved"
        )
      ).toHaveLength(1);
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextApiKey);

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
        product: "Syncro",
        status: "Connected",
        vendor: "Syncro"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "GET /customers",
          "GET /customer_assets",
          "GET /tickets",
          "POST /tickets for workflow delivery"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(plaintextApiKey);

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
        connectorKey: "syncro",
        healthStatus: "Healthy",
        signalCount: 8,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "syncro-other",
        "Syncro Other Tenant"
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
