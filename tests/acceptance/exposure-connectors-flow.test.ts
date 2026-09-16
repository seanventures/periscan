import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

type ExposureConnectorCase = {
  authType: string;
  connectorKey: string;
  config: Record<string, unknown>;
  expectedAssetCount: number;
  expectedPermissions: string[];
  expectedSignalCategories: string[];
  expectedSignalSubcategories: string[];
  nonSecretFields: Record<string, unknown>;
  product: string;
  secretFields: Record<string, string>;
  vendor: string;
};

const CONNECTOR_CASES: ExposureConnectorCase[] = [
  {
    authType: "apiKeys",
    config: {
      accessKey: "tenable-acceptance-access-key",
      apiBaseUrl: "https://cloud.tenable.example",
      assetLimit: 25,
      connectorKey: "tenable",
      secretKey: "tenable-acceptance-secret-key",
      vulnerabilityLimit: 50
    },
    connectorKey: "tenable",
    expectedAssetCount: 2,
    expectedPermissions: [
      "workbenches:read",
      "assets:read",
      "vulnerabilities:read"
    ],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "VulnerabilityManagedAsset",
      "CriticalVulnerability",
      "CveObserved",
      "HighVulnerability"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://cloud.tenable.example",
      assetLimit: 25,
      vulnerabilityLimit: 50
    },
    product: "Tenable Vulnerability Management",
    secretFields: {
      accessKey: "tenable-acceptance-access-key",
      secretKey: "tenable-acceptance-secret-key"
    },
    vendor: "Tenable"
  },
  {
    authType: "basicAuth",
    config: {
      apiBaseUrl: "https://insightvm.example.com/api/3",
      assetLimit: 25,
      connectorKey: "rapid7-insightvm",
      password: "rapid7-acceptance-password",
      username: "periscan-readonly",
      vulnerabilityLimit: 50
    },
    connectorKey: "rapid7-insightvm",
    expectedAssetCount: 2,
    expectedPermissions: ["assets:read", "vulnerabilities:read"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "VulnerabilityManagedAsset",
      "CriticalVulnerability",
      "CveObserved"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://insightvm.example.com/api/3",
      assetLimit: 25,
      username: "periscan-readonly",
      vulnerabilityLimit: 50
    },
    product: "InsightVM",
    secretFields: {
      password: "rapid7-acceptance-password"
    },
    vendor: "Rapid7"
  },
  {
    authType: "oauth2ClientCredentials",
    config: {
      clientId: "wiz-acceptance-client-id",
      clientSecret: "wiz-acceptance-client-secret",
      connectorKey: "wiz",
      graphqlUrl: "https://api.wiz.example/graphql",
      issueLimit: 25,
      projectIds: ["project-1"],
      resourceLimit: 50,
      tokenUrl: "https://auth.wiz.example/oauth/token"
    },
    connectorKey: "wiz",
    expectedAssetCount: 2,
    expectedPermissions: [
      "read:cloud_resources",
      "read:issues",
      "read:vulnerabilities"
    ],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "CnappCloudResource",
      "CloudResourceInternetExposed",
      "CriticalCnappIssue",
      "CveObserved",
      "HighCnappIssue"
    ],
    nonSecretFields: {
      clientId: "wiz-acceptance-client-id",
      graphqlUrl: "https://api.wiz.example/graphql",
      issueLimit: 25,
      projectIds: ["project-1"],
      resourceLimit: 50,
      tokenUrl: "https://auth.wiz.example/oauth/token"
    },
    product: "Wiz",
    secretFields: {
      clientSecret: "wiz-acceptance-client-secret"
    },
    vendor: "Wiz"
  },
  {
    authType: "accessKey",
    config: {
      accessKeyId: "prisma-acceptance-access-key",
      alertLimit: 25,
      apiBaseUrl: "https://api.prismacloud.example.test",
      connectorKey: "prisma-cloud",
      secretKey: "prisma-acceptance-secret-key",
      timeAmount: 7,
      timeUnit: "day"
    },
    connectorKey: "prisma-cloud",
    expectedAssetCount: 2,
    expectedPermissions: ["alert:read"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "CnappCloudResource",
      "CloudResourceInternetExposed",
      "CriticalCnappIssue",
      "CveObserved",
      "HighCnappIssue"
    ],
    nonSecretFields: {
      alertLimit: 25,
      apiBaseUrl: "https://api.prismacloud.example.test",
      timeAmount: 7,
      timeUnit: "day"
    },
    product: "Prisma Cloud",
    secretFields: {
      accessKeyId: "prisma-acceptance-access-key",
      secretKey: "prisma-acceptance-secret-key"
    },
    vendor: "Palo Alto Networks"
  },
  {
    authType: "bearerToken",
    config: {
      accountUrl: "https://customer.lacework.example.test",
      apiToken: "lacework-acceptance-api-token",
      connectorKey: "lacework",
      vulnerabilityLimit: 25
    },
    connectorKey: "lacework",
    expectedAssetCount: 2,
    expectedPermissions: ["vulnerability_observations:host:read"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "VulnerabilityManagedHost",
      "CriticalHostVulnerability",
      "CveObserved",
      "HighHostVulnerability"
    ],
    nonSecretFields: {
      accountUrl: "https://customer.lacework.example.test",
      vulnerabilityLimit: 25
    },
    product: "FortiCNAPP",
    secretFields: {
      apiToken: "lacework-acceptance-api-token"
    },
    vendor: "Fortinet"
  },
  {
    authType: "apiToken",
    config: {
      alertLimit: 25,
      alertsPath: "/alerts",
      apiBaseUrl: "https://app.us.orcasecurity.example.test/api",
      apiToken: "orca-acceptance-api-token",
      authHeaderPrefix: "Token",
      connectorKey: "orca-security"
    },
    connectorKey: "orca-security",
    expectedAssetCount: 2,
    expectedPermissions: ["alerts:read", "assets:read"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "CnappCloudResource",
      "CloudResourceInternetExposed",
      "CriticalCnappIssue",
      "CveObserved",
      "HighCnappIssue"
    ],
    nonSecretFields: {
      alertLimit: 25,
      alertsPath: "/alerts",
      apiBaseUrl: "https://app.us.orcasecurity.example.test/api",
      authHeaderPrefix: "Token"
    },
    product: "Orca",
    secretFields: {
      apiToken: "orca-acceptance-api-token"
    },
    vendor: "Orca Security"
  },
  {
    authType: "basicAuth",
    config: {
      apiBaseUrl: "https://qualys.example.com",
      assetLimit: 25,
      connectorKey: "qualys",
      detectionLimit: 50,
      password: "qualys-acceptance-password",
      username: "periscan-readonly"
    },
    connectorKey: "qualys",
    expectedAssetCount: 2,
    expectedPermissions: [
      "host:read",
      "vm_detection:read",
      "knowledgebase:read"
    ],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "VulnerabilityManagedAsset",
      "CriticalVulnerability",
      "CveObserved",
      "HighVulnerability"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://qualys.example.com",
      assetLimit: 25,
      detectionLimit: 50,
      username: "periscan-readonly"
    },
    product: "Qualys VMDR",
    secretFields: {
      password: "qualys-acceptance-password"
    },
    vendor: "Qualys"
  },
  {
    authType: "apiToken",
    config: {
      apiBaseUrl: "https://console.runzero.example",
      assetLimit: 25,
      connectorKey: "runzero",
      exportToken: "runzero-acceptance-export-token",
      search: "alive:true"
    },
    connectorKey: "runzero",
    expectedAssetCount: 2,
    expectedPermissions: ["export:assets:read"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "AssetInventoryObserved",
      "ServiceObservation",
      "PublicExposure"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://console.runzero.example",
      assetLimit: 25,
      search: "alive:true"
    },
    product: "runZero",
    secretFields: {
      exportToken: "runzero-acceptance-export-token"
    },
    vendor: "runZero"
  },
  {
    authType: "apiToken",
    config: {
      apiBaseUrl: "https://api.assetnote.example.test",
      apiToken: "assetnote-acceptance-api-token",
      assetLimit: 25,
      assetsPath: "/v1/assets",
      authHeaderPrefix: "Bearer",
      connectorKey: "assetnote"
    },
    connectorKey: "assetnote",
    expectedAssetCount: 2,
    expectedPermissions: ["assets:read", "exposures:read"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "AttackSurfaceAssetObserved",
      "ExternalServiceObservation",
      "ExternalExposure",
      "HighAttackSurfaceRisk",
      "CveObserved"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://api.assetnote.example.test",
      assetLimit: 25,
      assetsPath: "/v1/assets",
      authHeaderPrefix: "Bearer"
    },
    product: "Attack Surface Management",
    secretFields: {
      apiToken: "assetnote-acceptance-api-token"
    },
    vendor: "Assetnote"
  },
  {
    authType: "apiKeySecret",
    config: {
      apiBaseUrl: "https://api.axonius.example.test",
      apiKey: "axonius-acceptance-api-key",
      apiSecret: "axonius-acceptance-api-secret",
      assetLimit: 25,
      assetsPath: "/api/devices",
      connectorKey: "axonius"
    },
    connectorKey: "axonius",
    expectedAssetCount: 2,
    expectedPermissions: ["assets:read", "devices:read"],
    expectedSignalCategories: ["Asset", "Exposure", "ControlObservation"],
    expectedSignalSubcategories: [
      "CaasmAssetObserved",
      "CaasmAdapterCoverage",
      "CoverageGapObserved",
      "InternetExposure",
      "HighCaasmRisk",
      "CveObserved"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://api.axonius.example.test",
      assetLimit: 25,
      assetsPath: "/api/devices"
    },
    product: "CAASM",
    secretFields: {
      apiKey: "axonius-acceptance-api-key",
      apiSecret: "axonius-acceptance-api-secret"
    },
    vendor: "Axonius"
  },
  {
    authType: "apiToken",
    config: {
      apiBaseUrl: "https://api.armis.example.test",
      apiToken: "armis-acceptance-api-token",
      assetLimit: 25,
      assetsPath: "/api/v1/devices",
      connectorKey: "armis"
    },
    connectorKey: "armis",
    expectedAssetCount: 2,
    expectedPermissions: ["assets:read", "devices:read"],
    expectedSignalCategories: ["Asset", "Exposure", "ControlObservation"],
    expectedSignalSubcategories: [
      "AssetInventoryObserved",
      "UnmanagedAssetObserved",
      "InternetExposure",
      "CoverageGapObserved",
      "HighAssetRisk",
      "CveObserved"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://api.armis.example.test",
      assetLimit: 25,
      assetsPath: "/api/v1/devices"
    },
    product: "Armis",
    secretFields: {
      apiToken: "armis-acceptance-api-token"
    },
    vendor: "Armis"
  },
  {
    authType: "apiToken",
    config: {
      apiBaseUrl: "https://api-cortex.paloaltonetworks.example.test",
      apiToken: "cortex-xpanse-acceptance-token",
      assetLimit: 25,
      assetsPath: "/public_api/v1/assets",
      connectorKey: "cortex-xpanse"
    },
    connectorKey: "cortex-xpanse",
    expectedAssetCount: 2,
    expectedPermissions: ["assets:read", "exposures:read"],
    expectedSignalCategories: ["Asset", "Exposure"],
    expectedSignalSubcategories: [
      "AttackSurfaceAssetObserved",
      "ExternalServiceObservation",
      "ExternalExposure",
      "HighAttackSurfaceRisk",
      "CveObserved"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://api-cortex.paloaltonetworks.example.test",
      assetLimit: 25,
      assetsPath: "/public_api/v1/assets"
    },
    product: "Cortex Xpanse",
    secretFields: {
      apiToken: "cortex-xpanse-acceptance-token"
    },
    vendor: "Palo Alto Networks"
  }
];

describe("VM/EAP/ASM/CNAPP connector acceptance", () => {
  it("creates, encrypts, syncs, audits, and tenant-isolates exposure-management connectors through public APIs", async () => {
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
        "exposure-connectors",
        "Exposure Connector Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const integrationIds: string[] = [];

      for (const connectorCase of CONNECTOR_CASES) {
        const assetCountBeforeSync = await prisma.asset.count({
          where: { tenantId }
        });
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
          category: "SecurityControl",
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
        expect(synced.json().assetCount).toBe(connectorCase.expectedAssetCount);
        expect(synced.json().health.status).toBe("Healthy");
        expect(synced.json().signalCount).toBeGreaterThan(0);
        for (const plaintext of Object.values(connectorCase.secretFields)) {
          expect(JSON.stringify(synced.json())).not.toContain(plaintext);
        }

        const assetCountAfterSync = await prisma.asset.count({
          where: { tenantId }
        });
        expect(assetCountAfterSync - assetCountBeforeSync).toBe(
          connectorCase.expectedAssetCount
        );

        const signals = await prisma.signalEnvelope.findMany({
          where: { sourceIntegrationId: integrationId, tenantId }
        });
        expect(signals.length).toBeGreaterThan(0);
        expect(signals.map((signal) => signal.signalCategory)).toEqual(
          expect.arrayContaining(connectorCase.expectedSignalCategories)
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
          category: "SecurityControl",
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
          assetCount: connectorCase.expectedAssetCount,
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
        "exposure-connectors-other",
        "Exposure Connector Other Tenant"
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
