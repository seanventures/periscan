import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

type AIProviderConnectorCase = {
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

const CONNECTOR_CASES: AIProviderConnectorCase[] = [
  {
    authType: "apiKey",
    config: {
      apiKey: "openai-acceptance-key",
      baseUrl: "https://api.openai.example",
      connectorKey: "openai",
      organizationId: "org-acceptance",
      projectId: "proj-acceptance"
    },
    connectorKey: "openai",
    expectedAssetCount: 2,
    expectedPermissions: ["models:read"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: ["AIModelAvailable"],
    nonSecretFields: {
      baseUrl: "https://api.openai.example",
      organizationId: "org-acceptance",
      projectId: "proj-acceptance"
    },
    product: "OpenAI",
    secretFields: {
      apiKey: "openai-acceptance-key"
    },
    vendor: "OpenAI"
  },
  {
    authType: "apiKey",
    config: {
      apiKey: "anthropic-acceptance-key",
      baseUrl: "https://api.anthropic.example",
      connectorKey: "anthropic",
      version: "2023-06-01"
    },
    connectorKey: "anthropic",
    expectedAssetCount: 2,
    expectedPermissions: ["models:read"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: ["AIModelAvailable"],
    nonSecretFields: {
      baseUrl: "https://api.anthropic.example",
      version: "2023-06-01"
    },
    product: "Anthropic",
    secretFields: {
      apiKey: "anthropic-acceptance-key"
    },
    vendor: "Anthropic"
  },
  {
    authType: "apiKey",
    config: {
      apiKey: "azure-openai-acceptance-key",
      apiVersion: "2024-02-15-preview",
      connectorKey: "azure-openai",
      deploymentNames: ["periscan-safe-validation"],
      endpoint: "https://periscan-ai.openai.azure.com"
    },
    connectorKey: "azure-openai",
    expectedAssetCount: 1,
    expectedPermissions: ["deployments:read"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: ["AIDeploymentAvailable"],
    nonSecretFields: {
      apiVersion: "2024-02-15-preview",
      deploymentNames: ["periscan-safe-validation"],
      endpoint: "https://periscan-ai.openai.azure.com"
    },
    product: "Azure OpenAI",
    secretFields: {
      apiKey: "azure-openai-acceptance-key"
    },
    vendor: "Microsoft"
  },
  {
    authType: "apiKey",
    config: {
      apiKey: "azure-search-acceptance-key",
      apiVersion: "2025-09-01",
      connectorKey: "azure-ai-search",
      endpoint: "https://periscan-search.search.windows.net"
    },
    connectorKey: "azure-ai-search",
    expectedAssetCount: 2,
    expectedPermissions: ["indexes:read", "serviceStats:read"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: [
      "SearchIndexAvailable",
      "VectorSearchConfigured",
      "SemanticSearchConfigured",
      "SearchIndexCorsEnabled",
      "SearchServiceStatsAvailable"
    ],
    nonSecretFields: {
      apiVersion: "2025-09-01",
      endpoint: "https://periscan-search.search.windows.net"
    },
    product: "Azure AI Search",
    secretFields: {
      apiKey: "azure-search-acceptance-key"
    },
    vendor: "Microsoft"
  },
  {
    authType: "apiKey",
    config: {
      apiKey: "chroma-acceptance-key",
      baseUrl: "https://api.trychroma.example",
      connectorKey: "chroma",
      database: "prod-db",
      limit: 100,
      tenant: "tenant-123"
    },
    connectorKey: "chroma",
    expectedAssetCount: 2,
    expectedPermissions: ["collections:list", "collections:count"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: [
      "VectorCollectionAvailable",
      "VectorIndexConfigured",
      "SparseVectorIndexConfigured",
      "FullTextIndexConfigured",
      "CollectionCountAvailable"
    ],
    nonSecretFields: {
      baseUrl: "https://api.trychroma.example",
      database: "prod-db",
      limit: 100,
      tenant: "tenant-123"
    },
    product: "Chroma",
    secretFields: {
      apiKey: "chroma-acceptance-key"
    },
    vendor: "Chroma"
  },
  {
    authType: "staticCredentials",
    config: {
      accessKeyId: "AKIAACCEPTANCEBEDROCK",
      connectorKey: "aws-bedrock",
      region: "us-east-1",
      secretAccessKey: "bedrock-acceptance-secret",
      sessionToken: "bedrock-acceptance-session"
    },
    connectorKey: "aws-bedrock",
    expectedAssetCount: 1,
    expectedPermissions: [
      "bedrock:ListFoundationModels",
      "sts:AssumeRole",
      "sts:GetCallerIdentity"
    ],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: ["AIFoundationModelAvailable"],
    nonSecretFields: {
      region: "us-east-1"
    },
    product: "AWS Bedrock",
    secretFields: {
      accessKeyId: "AKIAACCEPTANCEBEDROCK",
      secretAccessKey: "bedrock-acceptance-secret",
      sessionToken: "bedrock-acceptance-session"
    },
    vendor: "AWS"
  }
];

describe("AI provider connector acceptance", () => {
  it("creates, encrypts, syncs, audits, and tenant-isolates AI provider/vector connectors through public APIs", async () => {
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
        "ai-provider-connectors",
        "AI Provider Connector Tenant"
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
          category: "AIStack",
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
          category: "AIStack",
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
        "ai-provider-connectors-other",
        "AI Provider Connector Other Tenant"
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
