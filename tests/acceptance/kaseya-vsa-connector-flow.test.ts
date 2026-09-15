import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("Kaseya VSA connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates VSA RMM telemetry through the public API", async () => {
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
        "kaseya-vsa-acceptance",
        "Kaseya VSA Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextToken = "kaseya-vsa-acceptance-token";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiKey",
          config: {
            accessToken: plaintextToken,
            apiBaseUrl: "https://vsa.acceptance.test/api/v1.0",
            connectorKey: "kaseya-vsa",
            includeAgents: true,
            includeAssets: true
          },
          connectorKey: "kaseya-vsa",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "apiKey",
        category: "MSSP",
        config: {
          accessToken: "[redacted]",
          apiBaseUrl: "https://vsa.acceptance.test/api/v1.0",
          connectorKey: "kaseya-vsa",
          includeAgents: true,
          includeAssets: true,
          mockMode: true
        },
        product: "VSA",
        status: "Connected",
        vendor: "Kaseya"
      });
      expect(JSON.stringify(created.json())).not.toContain(plaintextToken);

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.accessToken).not.toBe(plaintextToken);
      expect(String(storedConfig.accessToken)).toMatch(/^v1\./u);
      expect(storedConfig.apiBaseUrl).toBe(
        "https://vsa.acceptance.test/api/v1.0"
      );

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextToken);

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
      expect(JSON.stringify(synced.json())).not.toContain(plaintextToken);

      const assets = await prisma.asset.findMany({
        orderBy: { name: "asc" },
        where: { tenantId, tags: { has: "vsa" } }
      });
      expect(assets.map((asset) => asset.name)).toEqual([
        "kaseya-vsa-asset/acme-vsa-server-01",
        "kaseya-vsa-asset/northwind-vsa-laptop-04"
      ]);
      expect(
        assets.find((asset) => asset.name.includes("acme-vsa-server-01"))
          ?.businessCriticality
      ).toBe("High");

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(5);
      expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
        expect.arrayContaining([
          "KaseyaVsaAssetObserved",
          "KaseyaVsaAgentObserved",
          "KaseyaVsaOfflineAgentObserved"
        ])
      );
      expect(
        signals.filter(
          (signal) =>
            signal.signalSubcategory === "KaseyaVsaOfflineAgentObserved"
        )
      ).toHaveLength(1);
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextToken);

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
        product: "VSA",
        status: "Connected",
        vendor: "Kaseya"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "GET /api/v1.0/assetmgmt/assets",
          "GET /api/v1.0/assetmgmt/agents"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(plaintextToken);

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
        connectorKey: "kaseya-vsa",
        healthStatus: "Healthy",
        signalCount: 5,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "kaseya-vsa-other",
        "Kaseya VSA Other Tenant"
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
