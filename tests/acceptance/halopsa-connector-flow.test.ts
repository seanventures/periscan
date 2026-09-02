import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("HaloPSA connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates HaloPSA client and ticket telemetry through the public API", async () => {
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
        "halopsa-acceptance",
        "HaloPSA Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextClientSecret = "halopsa-acceptance-client-secret";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "clientCredentials",
          config: {
            apiBaseUrl: "https://halo.acceptance.test",
            authBaseUrl: "https://halo.acceptance.test",
            clientId: "halopsa-acceptance-client-id",
            clientSecret: plaintextClientSecret,
            connectorKey: "halopsa",
            defaultClientId: 701,
            includeClients: true,
            includeTickets: true,
            pageSize: 50,
            scope: "all",
            ticketPriorityId: 3,
            ticketTypeId: 9
          },
          connectorKey: "halopsa",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "clientCredentials",
        category: "MSSP",
        config: {
          apiBaseUrl: "https://halo.acceptance.test",
          authBaseUrl: "https://halo.acceptance.test",
          clientId: "halopsa-acceptance-client-id",
          clientSecret: "[redacted]",
          connectorKey: "halopsa",
          defaultClientId: 701,
          includeClients: true,
          includeTickets: true,
          mockMode: true,
          pageSize: 50,
          scope: "all",
          ticketPriorityId: 3,
          ticketTypeId: 9
        },
        product: "HaloPSA",
        status: "Connected",
        vendor: "Halo Service Solutions"
      });
      expect(JSON.stringify(created.json())).not.toContain(
        plaintextClientSecret
      );

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.clientSecret).not.toBe(plaintextClientSecret);
      expect(String(storedConfig.clientSecret)).toMatch(/^v1\./u);
      expect(storedConfig.clientId).toBe("halopsa-acceptance-client-id");

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(
        plaintextClientSecret
      );

      const synced = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(synced.statusCode).toBe(200);
      expect(synced.json()).toMatchObject({
        assetCount: 2,
        health: { status: "Healthy" },
        signalCount: 5
      });
      expect(JSON.stringify(synced.json())).not.toContain(
        plaintextClientSecret
      );

      const assets = await prisma.asset.findMany({
        where: { tenantId, tags: { has: "halopsa" } }
      });
      expect(assets).toHaveLength(2);
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining([
          "halopsa-client/Acme Manufacturing",
          "halopsa-client/Northwind Labs"
        ])
      );
      expect(assets.every((asset) => asset.environment === "mssp-psa")).toBe(
        true
      );

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(5);
      expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
        expect.arrayContaining([
          "HaloPSAClientObserved",
          "HaloPSATicketObserved",
          "HaloPSAOpenTicketObserved"
        ])
      );
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "HaloPSAClientObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "HaloPSATicketObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "HaloPSAOpenTicketObserved"
        )
      ).toHaveLength(1);
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextClientSecret);

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
        product: "HaloPSA",
        status: "Connected",
        vendor: "Halo Service Solutions"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "POST /auth/token",
          "GET /api/Client or /api/Clients",
          "GET /api/Ticket or /api/Tickets",
          "POST /api/Ticket or /api/Tickets for workflow delivery"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextClientSecret
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
        assetCount: 2,
        connectorKey: "halopsa",
        healthStatus: "Healthy",
        signalCount: 5,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "halopsa-other",
        "HaloPSA Other Tenant"
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
