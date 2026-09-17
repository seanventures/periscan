import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

type ThreatIntelConnectorCase = {
  authType: string;
  connectorKey: string;
  config: Record<string, unknown>;
  expectedPermissions: string[];
  expectedSignalSubcategories: string[];
  nonSecretFields: Record<string, unknown>;
  product: string;
  secretFields: Record<string, string>;
  vendor: string;
};

const CONNECTOR_CASES: ThreatIntelConnectorCase[] = [
  {
    authType: "apiToken",
    config: {
      apiBaseUrl: "https://otx.example/api/v1",
      apiKey: "alienvault-otx-acceptance-key",
      connectorKey: "alienvault-otx",
      indicators: ["203.0.113.44", "example-malware.invalid"],
      queryLimit: 2
    },
    connectorKey: "alienvault-otx",
    expectedPermissions: ["indicator:general:read"],
    expectedSignalSubcategories: [
      "ThreatIntelObservation",
      "HighConfidenceMaliciousIndicator",
      "OtxPulseAssociation"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://otx.example/api/v1",
      queryLimit: 2
    },
    product: "Open Threat Exchange",
    secretFields: {
      apiKey: "alienvault-otx-acceptance-key"
    },
    vendor: "AlienVault"
  },
  {
    authType: "apiToken",
    config: {
      apiBaseUrl: "https://api.recordedfuture.example",
      apiToken: "recorded-future-acceptance-token",
      connectorKey: "recorded-future",
      cveIds: ["CVE-2026-12345", "CVE-2025-9999"],
      entityNames: ["Fancy Bear"],
      queryLimit: 3
    },
    connectorKey: "recorded-future",
    expectedPermissions: ["vulnerability:search:read", "entity-match:read"],
    expectedSignalSubcategories: [
      "ThreatIntelObservation",
      "HighRiskVulnerability",
      "ElevatedCveRisk",
      "RecordedFutureEntityMatch"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://api.recordedfuture.example",
      queryLimit: 3
    },
    product: "Recorded Future",
    secretFields: {
      apiToken: "recorded-future-acceptance-token"
    },
    vendor: "Recorded Future"
  },
  {
    authType: "keySecret",
    config: {
      actorNames: ["UNC3782"],
      apiBaseUrl: "https://api.mandiant.example",
      connectorKey: "mandiant-advantage",
      cveIds: ["CVE-2026-12345"],
      indicators: ["203.0.113.44"],
      minimumMscore: 40,
      privateKey: "mandiant-acceptance-secret",
      publicKey: "mandiant-acceptance-key-id",
      queryLimit: 3
    },
    connectorKey: "mandiant-advantage",
    expectedPermissions: [
      "indicator:read",
      "vulnerability:read",
      "threat-actor:read"
    ],
    expectedSignalSubcategories: [
      "ThreatIntelObservation",
      "HighMandiantMScore",
      "MandiantAttributedAssociation",
      "MandiantExploitationObserved",
      "MandiantThreatActorContext"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://api.mandiant.example",
      publicKey: "mandiant-acceptance-key-id",
      queryLimit: 3
    },
    product: "Mandiant Advantage",
    secretFields: {
      privateKey: "mandiant-acceptance-secret"
    },
    vendor: "Google"
  }
];

describe("Threat-intelligence connector acceptance", () => {
  it("creates, encrypts, syncs, audits, and tenant-isolates threat-intel connectors through public APIs", async () => {
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
        "threat-intel-connectors",
        "Threat Intel Connector Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const integrationIds: string[] = [];

      for (const connectorCase of CONNECTOR_CASES) {
        const created = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            authType: connectorCase.authType,
            config: connectorCase.config,
            connectorKey: connectorCase.connectorKey,
            mockMode: true
          },
          url: "/api/v1/integrations"
        });

        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({
          authType: connectorCase.authType,
          category: "Other",
          product: connectorCase.product,
          status: "Connected",
          vendor: connectorCase.vendor
        });
        expect(created.json().config).toMatchObject({
          connectorKey: connectorCase.connectorKey,
          mockMode: true,
          ...connectorCase.nonSecretFields
        });
        for (const [field, plaintext] of Object.entries(
          connectorCase.secretFields
        )) {
          expect(created.json().config[field]).toBe("[redacted]");
          expect(JSON.stringify(created.json())).not.toContain(plaintext);
        }

        const integrationId = created.json().integrationId as string;
        integrationIds.push(integrationId);

        const storedIntegration = await prisma.integration.findFirstOrThrow({
          where: { integrationId, tenantId }
        });
        const storedConfig = storedIntegration.config as Record<
          string,
          unknown
        >;
        for (const [field, plaintext] of Object.entries(
          connectorCase.secretFields
        )) {
          expect(storedConfig[field]).not.toBe(plaintext);
          expect(String(storedConfig[field])).toMatch(/^v1\./u);
          expect(JSON.stringify(storedConfig)).not.toContain(plaintext);
        }
        for (const [field, value] of Object.entries(
          connectorCase.nonSecretFields
        )) {
          expect(storedConfig[field]).toEqual(value);
        }

        const health = await app.inject({
          cookies: authCookies(cookie),
          method: "GET",
          url: `/api/v1/integrations/${integrationId}/health`
        });
        expect(health.statusCode).toBe(200);
        expect(health.json().health.status).toBe("Healthy");
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(health.json())).not.toContain(plaintext);
        }

        const synced = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          url: `/api/v1/integrations/${integrationId}/sync`
        });
        expect(synced.statusCode).toBe(200);
        expect(synced.json().assetCount).toBe(0);
        expect(synced.json().health.status).toBe("Healthy");
        expect(synced.json().signalCount).toBeGreaterThan(0);
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(synced.json())).not.toContain(plaintext);
        }

        const signals = await prisma.signalEnvelope.findMany({
          where: { sourceIntegrationId: integrationId, tenantId }
        });
        expect(signals.length).toBeGreaterThan(0);
        expect(signals.map((signal) => signal.signalCategory)).toEqual(
          expect.arrayContaining(["Exposure"])
        );
        expect(signals.map((signal) => signal.signalSubcategory)).toEqual(
          expect.arrayContaining(connectorCase.expectedSignalSubcategories)
        );
        expect(signals.every((signal) => signal.evidenceIds.length > 0)).toBe(
          true
        );
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(signals)).not.toContain(plaintext);
        }

        const evidence = await prisma.evidenceArtifact.findMany({
          where: {
            relatedEntityId: integrationId,
            relatedEntityType: "Integration",
            tenantId
          }
        });
        expect(evidence.length).toBe(1);
        expect(evidence[0]).toMatchObject({
          artifactType: "NormalizedEvidence"
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
          category: "Other",
          healthStatus: "Healthy",
          lastSyncAt: expect.any(String),
          product: connectorCase.product,
          status: "Connected",
          vendor: connectorCase.vendor
        });
        expect(connected.permissionsUsed).toEqual(
          expect.arrayContaining(connectorCase.expectedPermissions)
        );
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(trustSafety.json())).not.toContain(plaintext);
        }

        const auditEvents = await prisma.auditEvent.findMany({
          orderBy: { createdAt: "asc" },
          where: {
            entityId: integrationId,
            tenantId
          }
        });
        expect(auditEvents.map((event) => event.action)).toEqual(
          expect.arrayContaining([
            "integration_connected",
            "integration_synced"
          ])
        );
        expect(
          auditEvents.find((event) => event.action === "integration_synced")
            ?.metadata
        ).toMatchObject({
          assetCount: 0,
          connectorKey: connectorCase.connectorKey,
          healthStatus: "Healthy",
          status: "Succeeded"
        });
        expect(
          (
            auditEvents.find((event) => event.action === "integration_synced")
              ?.metadata as { signalCount?: number } | undefined
          )?.signalCount
        ).toBeGreaterThan(0);
      }

      const { cookie: otherCookie } = await performSignup(
        app,
        "threat-intel-connectors-other",
        "Threat Intel Connector Other Tenant"
      );

      for (const integrationId of integrationIds) {
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
      }
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
