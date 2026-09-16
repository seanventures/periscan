import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("N-able N-central connector acceptance workflow", () => {
  it("creates, redacts, syncs, and tenant-isolates N-central RMM telemetry through the public API", async () => {
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
        "ncentral-acceptance",
        "N-central Acceptance Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const plaintextAccessToken = "ncentral-acceptance-access-token";
      const plaintextJwtToken = "ncentral-acceptance-jwt-token";

      const created = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          authType: "apiToken",
          config: {
            accessToken: plaintextAccessToken,
            apiBaseUrl: "https://ncentral.acceptance.test/api",
            connectorKey: "n-able-ncentral",
            includeActiveIssues: true,
            includeCustomers: true,
            includeDevices: true,
            jwtToken: plaintextJwtToken,
            orgUnitIds: [2101, 2102],
            pageNumber: 1,
            pageSize: 50
          },
          connectorKey: "n-able-ncentral",
          mockMode: true
        },
        url: "/api/v1/integrations"
      });

      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        authType: "apiToken",
        category: "MSSP",
        config: {
          accessToken: "[redacted]",
          apiBaseUrl: "https://ncentral.acceptance.test/api",
          connectorKey: "n-able-ncentral",
          includeActiveIssues: true,
          includeCustomers: true,
          includeDevices: true,
          jwtToken: "[redacted]",
          mockMode: true,
          orgUnitIds: [2101, 2102],
          pageNumber: 1,
          pageSize: 50
        },
        product: "N-central",
        status: "Connected",
        vendor: "N-able"
      });
      expect(JSON.stringify(created.json())).not.toContain(
        plaintextAccessToken
      );
      expect(JSON.stringify(created.json())).not.toContain(plaintextJwtToken);

      const integrationId = created.json().integrationId as string;
      const storedIntegration = await prisma.integration.findFirstOrThrow({
        where: { integrationId, tenantId }
      });
      const storedConfig = storedIntegration.config as Record<string, unknown>;
      expect(storedConfig.accessToken).not.toBe(plaintextAccessToken);
      expect(storedConfig.jwtToken).not.toBe(plaintextJwtToken);
      expect(String(storedConfig.accessToken)).toMatch(/^v1\./u);
      expect(String(storedConfig.jwtToken)).toMatch(/^v1\./u);
      expect(storedConfig.apiBaseUrl).toBe(
        "https://ncentral.acceptance.test/api"
      );

      const health = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: `/api/v1/integrations/${integrationId}/health`
      });
      expect(health.statusCode).toBe(200);
      expect(health.json().health.status).toBe("Healthy");
      expect(JSON.stringify(health.json())).not.toContain(plaintextAccessToken);
      expect(JSON.stringify(health.json())).not.toContain(plaintextJwtToken);

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
      expect(JSON.stringify(synced.json())).not.toContain(plaintextAccessToken);
      expect(JSON.stringify(synced.json())).not.toContain(plaintextJwtToken);

      const assets = await prisma.asset.findMany({
        where: { tenantId, tags: { has: "ncentral" } }
      });
      expect(assets).toHaveLength(4);
      expect(assets.map((asset) => asset.name)).toEqual(
        expect.arrayContaining([
          "ncentral-customer/Acme Manufacturing",
          "ncentral-customer/Northwind Labs",
          "ncentral-device/acme-edge-01",
          "ncentral-device/northwind-laptop-08"
        ])
      );
      expect(
        assets.find((asset) => asset.name === "ncentral-device/acme-edge-01")
          ?.status
      ).toBe("Inactive");
      expect(
        assets.find((asset) => asset.name === "ncentral-device/acme-edge-01")
          ?.businessCriticality
      ).toBe("High");

      const signals = await prisma.signalEnvelope.findMany({
        where: { sourceIntegrationId: integrationId, tenantId }
      });
      expect(signals).toHaveLength(7);
      expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
        expect.arrayContaining([
          "NCentralCustomerObserved",
          "NCentralDeviceObserved",
          "NCentralOfflineDeviceObserved",
          "NCentralActiveIssueObserved"
        ])
      );
      expect(
        signals.filter(
          (signal) =>
            signal.signalSubcategory === "NCentralOfflineDeviceObserved"
        )
      ).toHaveLength(1);
      expect(
        signals.filter(
          (signal) => signal.signalSubcategory === "NCentralActiveIssueObserved"
        )
      ).toHaveLength(2);
      expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
        true
      );
      expect(JSON.stringify(signals)).not.toContain(plaintextAccessToken);
      expect(JSON.stringify(signals)).not.toContain(plaintextJwtToken);

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
        product: "N-central",
        status: "Connected",
        vendor: "N-able"
      });
      expect(connected.permissionsUsed).toEqual(
        expect.arrayContaining([
          "POST /api/auth/authenticate for JWT token exchange when access token is not supplied",
          "GET /api/customers",
          "GET /api/devices",
          "GET /api/org-units/{orgUnitId}/active-issues"
        ])
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextAccessToken
      );
      expect(JSON.stringify(trustSafety.json())).not.toContain(
        plaintextJwtToken
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
        connectorKey: "n-able-ncentral",
        healthStatus: "Healthy",
        signalCount: 7,
        status: "Succeeded"
      });

      const { cookie: otherCookie } = await performSignup(
        app,
        "ncentral-other",
        "N-central Other Tenant"
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
