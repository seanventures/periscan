import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("Autotask connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates Autotask company and ticket telemetry through the public API", async () => {
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
        "autotask-acceptance",
        "Autotask Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextSecret = "autotask-acceptance-secret";
      const plaintextIntegrationCode = "autotask-acceptance-integration-code";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiKey",
          config: {
            apiBaseUrl:
              "https://webservices15.autotask.net/atservicesrest/v1.0",
            apiIntegrationCode: plaintextIntegrationCode,
            connectorKey: "autotask",
            defaultCompanyId: 901,
            includeCompanies: true,
            includeTickets: true,
            pageSize: 50,
            priority: 3,
            queueId: 12,
            secret: plaintextSecret,
            status: 1,
            ticketType: 1,
            username: "apiuser@example.com"
          },
          connectorKey: "autotask",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "apiKey",
        category: "MSSP",
        config: {
          apiBaseUrl: "https://webservices15.autotask.net/atservicesrest/v1.0",
          apiIntegrationCode: "[redacted]",
          connectorKey: "autotask",
          defaultCompanyId: 901,
          includeCompanies: true,
          includeTickets: true,
          mockMode: true,
          pageSize: 50,
          priority: 3,
          queueId: 12,
          secret: "[redacted]",
          status: 1,
          ticketType: 1,
          username: "apiuser@example.com"
        },
        product: "Autotask PSA",
        status: "Connected",
        vendor: "Kaseya"
      });
      expect(JSON.stringify(created.json())).not.toContain(plaintextSecret);
      expect(JSON.stringify(created.json())).not.toContain(
        plaintextIntegrationCode
      );

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.secret).not.toBe(plaintextSecret);
      expect(String(storedConfig.secret)).toMatch(/^v1\./u);
      expect(storedConfig.apiIntegrationCode).not.toBe(
        plaintextIntegrationCode
      );
      expect(String(storedConfig.apiIntegrationCode)).toMatch(/^v1\./u);
      expect(storedConfig.username).toBe("apiuser@example.com");

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextSecret);
      expect(JSON.stringify(health.json())).not.toContain(
        plaintextIntegrationCode
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
      expect(JSON.stringify(synced.json())).not.toContain(plaintextSecret);
      expect(JSON.stringify(synced.json())).not.toContain(
        plaintextIntegrationCode
      );

      const assets = await prisma.asset.findMany({
        where: { tenantId, tags: { has: "autotask" } }
      });
      expect(assets).toHaveLength(2);
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining([
          "autotask-company/Acme Manufacturing",
          "autotask-company/Northwind Labs"
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
          "AutotaskCompanyObserved",
          "AutotaskTicketObserved",
          "AutotaskOpenTicketObserved"
        ])
      );
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "AutotaskCompanyObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "AutotaskTicketObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "AutotaskOpenTicketObserved"
        )
      ).toHaveLength(1);
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextSecret);
      expect(JSON.stringify(signals)).not.toContain(plaintextIntegrationCode);

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
        product: "Autotask PSA",
        status: "Connected",
        vendor: "Kaseya"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "GET /Companies/query",
          "GET /Tickets/query",
          "POST /Tickets for workflow delivery"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(plaintextSecret);
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextIntegrationCode
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
        connectorKey: "autotask",
        healthStatus: "Healthy",
        signalCount: 5,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "autotask-other",
        "Autotask Other Tenant"
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
