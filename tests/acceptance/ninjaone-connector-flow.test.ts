import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("NinjaOne connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates NinjaOne RMM telemetry through the public API", async () => {
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
        "ninjaone-acceptance",
        "NinjaOne Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextAccessToken = "ninjaone-acceptance-access-token";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "accessToken",
          config: {
            accessToken: plaintextAccessToken,
            apiBaseUrl: "https://app.ninjarmm.com",
            connectorKey: "ninjaone",
            includeAlerts: true,
            includeDevices: true,
            includeOrganizations: true,
            organizationIds: [301, 302],
            pageSize: 50
          },
          connectorKey: "ninjaone",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "accessToken",
        category: "MSSP",
        config: {
          accessToken: "[redacted]",
          apiBaseUrl: "https://app.ninjarmm.com",
          connectorKey: "ninjaone",
          includeAlerts: true,
          includeDevices: true,
          includeOrganizations: true,
          mockMode: true,
          organizationIds: [301, 302],
          pageSize: 50
        },
        product: "NinjaOne",
        status: "Connected",
        vendor: "NinjaOne"
      });
      expect(JSON.stringify(created.json())).not.toContain(
        plaintextAccessToken
      );

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.accessToken).not.toBe(plaintextAccessToken);
      expect(String(storedConfig.accessToken)).toMatch(/^v1\./u);
      expect(storedConfig.apiBaseUrl).toBe("https://app.ninjarmm.com");

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextAccessToken);

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
      expect(JSON.stringify(synced.json())).not.toContain(plaintextAccessToken);

      const assets = await prisma.asset.findMany({
        where: { tenantId, tags: { has: "ninjaone" } }
      });
      expect(assets).toHaveLength(4);
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining([
          "ninjaone-organization/Acme Manufacturing",
          "ninjaone-organization/Northwind Labs",
          "ninjaone-device/acme-dc-01",
          "ninjaone-device/northwind-laptop-14"
        ])
      );
      expect(
        assets.find((asset) => asset.name === "ninjaone-device/acme-dc-01")
          ?.status
      ).toBe("Inactive");
      expect(
        assets.find((asset) => asset.name === "ninjaone-device/acme-dc-01")
          ?.businessCriticality
      ).toBe("High");

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(8);
      expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
        expect.arrayContaining([
          "NinjaOneOrganizationObserved",
          "NinjaOneDeviceObserved",
          "NinjaOneOfflineDeviceObserved",
          "NinjaOneAlertObserved",
          "NinjaOneCriticalOpenAlertObserved"
        ])
      );
      expect(
        signals.filter(
          (signal) =>
            signal.signalSubcategory === "NinjaOneOfflineDeviceObserved"
        )
      ).toHaveLength(1);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "NinjaOneAlertObserved"
        )
      ).toHaveLength(2);
      expect(
        signals.filter(
          (signal) =>
            signal.signalSubcategory === "NinjaOneCriticalOpenAlertObserved"
        )
      ).toHaveLength(1);
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextAccessToken);

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
        product: "NinjaOne",
        status: "Connected",
        vendor: "NinjaOne"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "GET /v2/organizations",
          "GET /v2/devices",
          "GET /v2/device/{id}/alerts or equivalent read-only activity feed"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextAccessToken
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
        connectorKey: "ninjaone",
        healthStatus: "Healthy",
        signalCount: 8,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "ninjaone-other",
        "NinjaOne Other Tenant"
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
