import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("ConnectWise Automate connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates Automate RMM telemetry through the public API", async () => {
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
        "cwa-acceptance",
        "ConnectWise Automate Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextPassword = "automate-acceptance-password";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "basicAuth",
          config: {
            apiBaseUrl: "https://automate.acceptance.test",
            includeAlerts: true,
            includeClients: true,
            includeComputers: true,
            page: 1,
            pageSize: 100,
            password: plaintextPassword,
            username: "automate-readonly"
          },
          connectorKey: "connectwise-automate",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "basicAuth",
        category: "MSSP",
        config: {
          apiBaseUrl: "https://automate.acceptance.test",
          connectorKey: "connectwise-automate",
          mockMode: true,
          password: "[redacted]",
          username: "automate-readonly"
        },
        product: "ConnectWise Automate",
        status: "Connected",
        vendor: "ConnectWise"
      });
      expect(JSON.stringify(created.json())).not.toContain(plaintextPassword);

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.password).not.toBe(plaintextPassword);
      expect(String(storedConfig.password)).toMatch(/^v1\./u);
      expect(storedConfig.username).toBe("automate-readonly");

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextPassword);

      const synced = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        url: `/api/v1/integrations/${integrationId}/sync`
      });
      expect(synced.statusCode).toBe(200);
      expect(synced.json()).toMatchObject({
        assetCount: 4,
        health: { status: "Healthy" },
        signalCount: 7
      });
      expect(JSON.stringify(synced.json())).not.toContain(plaintextPassword);

      const assets = await prisma.asset.findMany({
        where: { tenantId, tags: { has: "automate" } }
      });
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining([
          "connectwise-automate-client/Acme Manufacturing",
          "connectwise-automate-computer/acme-cwa-server-01"
        ])
      );

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(7);
      expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
        expect.arrayContaining([
          "ConnectWiseAutomateClientObserved",
          "ConnectWiseAutomateComputerObserved",
          "ConnectWiseAutomateOfflineComputerObserved",
          "ConnectWiseAutomateAlertObserved",
          "ConnectWiseAutomateCriticalOpenAlertObserved"
        ])
      );
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextPassword);

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
        product: "ConnectWise Automate",
        status: "Connected",
        vendor: "ConnectWise"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "GET /cwa/api/v1/Clients",
          "GET /cwa/api/v1/Computers",
          "GET /cwa/api/v1/Alerts"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextPassword
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
        connectorKey: "connectwise-automate",
        healthStatus: "Healthy",
        signalCount: 7,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "cwa-other",
        "ConnectWise Automate Other Tenant"
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
