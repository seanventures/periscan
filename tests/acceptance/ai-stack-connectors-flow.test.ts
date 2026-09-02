import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

type AIStackConnectorCase = {
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

const CONNECTOR_CASES: AIStackConnectorCase[] = [
  {
    authType: "accessToken",
    config: {
      accessToken: "vertex-ai-acceptance-token",
      connectorKey: "vertex-ai",
      location: "us-central1",
      projectId: "periscan-acceptance",
      publisher: "google",
      queryLimit: 2
    },
    connectorKey: "vertex-ai",
    expectedAssetCount: 2,
    expectedPermissions: [
      "aiplatform.endpoints.list",
      "aiplatform.publisherModels.list"
    ],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: [
      "AIEndpointAvailable",
      "AIPublisherModelAvailable"
    ],
    nonSecretFields: {
      location: "us-central1",
      projectId: "periscan-acceptance",
      publisher: "google",
      queryLimit: 2
    },
    product: "Vertex AI",
    secretFields: {
      accessToken: "vertex-ai-acceptance-token"
    },
    vendor: "Google"
  },
  {
    authType: "apiKey",
    config: {
      apiBaseUrl: "https://api.pinecone.example",
      apiKey: "pinecone-acceptance-key",
      apiVersion: "2026-04",
      connectorKey: "pinecone"
    },
    connectorKey: "pinecone",
    expectedAssetCount: 2,
    expectedPermissions: ["indexes:list"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: [
      "VectorIndexAvailable",
      "VectorIndexNotReady",
      "VectorIndexDeletionProtectionDisabled"
    ],
    nonSecretFields: {
      apiBaseUrl: "https://api.pinecone.example",
      apiVersion: "2026-04"
    },
    product: "Pinecone",
    secretFields: {
      apiKey: "pinecone-acceptance-key"
    },
    vendor: "Pinecone"
  },
  {
    authType: "apiKey",
    config: {
      apiKey: "weaviate-acceptance-key",
      baseUrl: "https://weaviate.example",
      connectorKey: "weaviate"
    },
    connectorKey: "weaviate",
    expectedAssetCount: 2,
    expectedPermissions: ["schema:read", "meta:read"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: [
      "VectorCollectionAvailable",
      "VectorCollectionSingleTenant",
      "VectorizerConfigured"
    ],
    nonSecretFields: {
      baseUrl: "https://weaviate.example"
    },
    product: "Weaviate",
    secretFields: {
      apiKey: "weaviate-acceptance-key"
    },
    vendor: "Weaviate"
  },
  {
    authType: "configImport",
    config: {
      applicationName: "incident-response-assistant",
      connectorKey: "langchain",
      environment: "production"
    },
    connectorKey: "langchain",
    expectedAssetCount: 2,
    expectedPermissions: ["langchain:metadata:import"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: [
      "LangChainApplicationDeclared",
      "LangChainAgentDeclared",
      "LangChainToolDeclared",
      "LangChainSensitiveToolDeclared"
    ],
    nonSecretFields: {
      applicationName: "incident-response-assistant",
      environment: "production"
    },
    product: "LangChain",
    secretFields: {},
    vendor: "LangChain"
  },
  {
    authType: "configImport",
    config: {
      applicationName: "incident-rag",
      connectorKey: "llamaindex",
      environment: "production"
    },
    connectorKey: "llamaindex",
    expectedAssetCount: 2,
    expectedPermissions: ["llamaindex:metadata:import"],
    expectedSignalCategories: ["AIApplication"],
    expectedSignalSubcategories: [
      "LlamaIndexApplicationDeclared",
      "LlamaIndexAgentDeclared",
      "LlamaIndexIndexDeclared",
      "LlamaIndexQueryEngineDeclared",
      "LlamaIndexToolDeclared"
    ],
    nonSecretFields: {
      applicationName: "incident-rag",
      environment: "production"
    },
    product: "LlamaIndex",
    secretFields: {},
    vendor: "LlamaIndex"
  },
  {
    authType: "configImport",
    config: {
      applicationName: "incident-guardrails",
      connectorKey: "guardrails-ai",
      environment: "production"
    },
    connectorKey: "guardrails-ai",
    expectedAssetCount: 3,
    expectedPermissions: ["guardrails-ai:metadata:import"],
    expectedSignalCategories: ["AIApplication", "ControlObservation"],
    expectedSignalSubcategories: [
      "GuardrailsAIApplicationDeclared",
      "GuardrailsAIGuardDeclared",
      "GuardrailsAIInputGuardConfigured",
      "GuardrailsAIOutputGuardConfigured",
      "GuardrailsAISensitiveValidatorDeclared"
    ],
    nonSecretFields: {
      applicationName: "incident-guardrails",
      environment: "production"
    },
    product: "Guardrails AI",
    secretFields: {},
    vendor: "Guardrails AI"
  },
  {
    authType: "apiKey",
    config: {
      apiKey: "lakera-acceptance-key",
      connectorKey: "lakera",
      platformBaseUrl: "https://platform.lakera.example/api/v2",
      policyIds: ["policy-guard-strict"],
      projectIds: ["customer-support-ai"]
    },
    connectorKey: "lakera",
    expectedAssetCount: 2,
    expectedPermissions: ["lakera:projects:read", "lakera:policies:read"],
    expectedSignalCategories: ["AIApplication", "ControlObservation"],
    expectedSignalSubcategories: [
      "LakeraProjectDeclared",
      "LakeraPolicyDeclared",
      "LakeraProjectPolicyMapped",
      "LakeraPromptDefenseConfigured",
      "LakeraBlockingPolicyConfigured"
    ],
    nonSecretFields: {
      platformBaseUrl: "https://platform.lakera.example/api/v2",
      policyIds: ["policy-guard-strict"],
      projectIds: ["customer-support-ai"]
    },
    product: "Lakera Guard",
    secretFields: {
      apiKey: "lakera-acceptance-key"
    },
    vendor: "Lakera"
  }
];

describe("AI-stack connector acceptance", () => {
  it("creates, encrypts, syncs, audits, and tenant-isolates AI-stack connectors through public APIs", async () => {
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
        "ai-stack-connectors",
        "AI Stack Connector Tenant"
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
        "ai-stack-connectors-other",
        "AI Stack Connector Other Tenant"
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
