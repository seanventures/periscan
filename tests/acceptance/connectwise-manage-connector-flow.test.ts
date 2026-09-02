import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("ConnectWise Manage connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates ConnectWise Manage company and ticket telemetry through the public API", async () => {
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
        "connectwise-manage-acceptance",
        "ConnectWise Manage Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextPrivateKey = "connectwise-manage-private-key";
      const plaintextPublicKey = "connectwise-manage-public-key";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiKey",
          config: {
            apiBaseUrl: "https://manage.example.com/apis/3.0",
            boardId: 11,
            clientId: "connectwise-client-id",
            companyId: "periscan",
            connectorKey: "connectwise-manage",
            defaultTicketCompanyId: 201,
            includeCompanies: true,
            includeTickets: true,
            pageSize: 50,
            privateKey: plaintextPrivateKey,
            publicKey: plaintextPublicKey,
            statusId: 1,
            ticketType: "ServiceTicket"
          },
          connectorKey: "connectwise-manage",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "apiKey",
        category: "MSSP",
        config: {
          apiBaseUrl: "https://manage.example.com/apis/3.0",
          boardId: 11,
          clientId: "connectwise-client-id",
          companyId: "periscan",
          connectorKey: "connectwise-manage",
          defaultTicketCompanyId: 201,
          includeCompanies: true,
          includeTickets: true,
          mockMode: true,
          pageSize: 50,
          privateKey: "[redacted]",
          publicKey: "[redacted]",
          statusId: 1,
          ticketType: "ServiceTicket"
        },
        product: "ConnectWise Manage",
        status: "Connected",
        vendor: "ConnectWise"
      });
      expect(JSON.stringify(created.json())).not.toContain(plaintextPrivateKey);
      expect(JSON.stringify(created.json())).not.toContain(plaintextPublicKey);

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.privateKey).not.toBe(plaintextPrivateKey);
      expect(String(storedConfig.privateKey)).toMatch(/^v1\./u);
      expect(storedConfig.publicKey).not.toBe(plaintextPublicKey);
      expect(String(storedConfig.publicKey)).toMatch(/^v1\./u);
      expect(storedConfig.clientId).toBe("connectwise-client-id");

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextPrivateKey);
      expect(JSON.stringify(health.json())).not.toContain(plaintextPublicKey);

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
      expect(JSON.stringify(synced.json())).not.toContain(plaintextPrivateKey);
      expect(JSON.stringify(synced.json())).not.toContain(plaintextPublicKey);

      const assets = await prisma.asset.findMany({
        where: { tenantId, tags: { has: "connectwise" } }
      });
      expect(assets).toHaveLength(2);
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining([
          "connectwise-company/Acme Manufacturing",
          "connectwise-company/Northwind Labs"
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
          "ConnectWiseCompanyObserved",
          "ConnectWiseTicketObserved",
          "ConnectWiseOpenTicketObserved"
        ])
      );
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "ConnectWiseCompanyObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "ConnectWiseTicketObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) =>
            signal.signalSubcategory === "ConnectWiseOpenTicketObserved"
        )
      ).toHaveLength(1);
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextPrivateKey);
      expect(JSON.stringify(signals)).not.toContain(plaintextPublicKey);

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
        product: "ConnectWise Manage",
        status: "Connected",
        vendor: "ConnectWise"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "system/info:read",
          "company/companies:read",
          "service/tickets:read",
          "service/tickets:create for workflow routing"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextPrivateKey
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextPublicKey
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
        connectorKey: "connectwise-manage",
        healthStatus: "Healthy",
        signalCount: 5,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "connectwise-manage-other",
        "ConnectWise Manage Other Tenant"
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
