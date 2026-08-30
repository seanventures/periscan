import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import {
  getConnectorByKey,
  getConnectorCatalog
} from "../../packages/connectors/src/index.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

type AuthField = {
  key: string;
  required?: boolean;
  secret?: boolean;
};

type CloudConnectorCase = {
  authType: string;
  config: Record<string, unknown>;
  connectorKey: string;
  expectedAssetCount: number;
  expectedAssetNames: string[];
  expectedPermissions: string[];
  expectedSignalCategories: string[];
  expectedSignalSubcategories: string[];
  nonSecretFields: Record<string, unknown>;
  product: string;
  secretFields: Record<string, string>;
  vendor: string;
};

function valueForAuthField(connectorKey: string, field: AuthField): unknown {
  const key = field.key;
  const lowerKey = key.toLowerCase();

  if (lowerKey.includes("include") || lowerKey.startsWith("enable")) {
    return true;
  }

  if (
    lowerKey.includes("limit") ||
    lowerKey === "perpage" ||
    lowerKey === "pagesize" ||
    lowerKey === "statementlimit" ||
    lowerKey === "maxitems"
  ) {
    return 25;
  }

  if (
    lowerKey === "projectids" ||
    lowerKey === "subscriptionids" ||
    lowerKey === "zoneids" ||
    lowerKey === "namespacenames"
  ) {
    return [`${connectorKey}-scope-1`];
  }

  if (
    lowerKey.includes("url") ||
    lowerKey === "endpoint" ||
    lowerKey.endsWith("endpoint") ||
    lowerKey.includes("baseurl")
  ) {
    return `https://${connectorKey}.cloud.example.test`;
  }

  if (lowerKey === "region") {
    return "us-east-1";
  }

  if (lowerKey === "warehouse") {
    return "PERISCAN_WH";
  }

  if (lowerKey === "database") {
    return "PERISCAN_DB";
  }

  if (lowerKey === "role") {
    return "PERISCAN_READONLY";
  }

  if (lowerKey === "workspacepath") {
    return "/Shared/periscan";
  }

  if (lowerKey === "clustername") {
    return `${connectorKey}-cluster`;
  }

  if (lowerKey.includes("tenant")) {
    return `${connectorKey}-tenant`;
  }

  if (lowerKey.includes("clientid")) {
    return `${connectorKey}-client-id`;
  }

  if (lowerKey.includes("accountid")) {
    return `${connectorKey}-account`;
  }

  return `${connectorKey}-${key}-acceptance`;
}

function isSensitiveAuthField(field: AuthField) {
  const lowerKey = field.key.toLowerCase();

  const tokenLike =
    lowerKey.includes("token") &&
    !lowerKey.includes("endpoint") &&
    !lowerKey.includes("url") &&
    !lowerKey.includes("authmethod");

  return (
    field.secret === true ||
    lowerKey.includes("secret") ||
    lowerKey.includes("password") ||
    lowerKey.includes("privatekey") ||
    tokenLike ||
    lowerKey.includes("apikey") ||
    lowerKey.includes("accesskey") ||
    lowerKey === "pat" ||
    lowerKey.includes("pattoken")
  );
}

async function buildCloudConnectorCases(): Promise<CloudConnectorCase[]> {
  const manifests = getConnectorCatalog().filter(
    (manifest) => manifest.category === "Cloud" && manifest.connectable === true
  );

  const cases: CloudConnectorCase[] = [];

  for (const manifest of manifests) {
    const authMethod = manifest.authMethods.find(
      (method) => method.kind !== "mock"
    );
    const connector = getConnectorByKey(manifest.connectorKey);

    expect(authMethod).toBeDefined();
    expect(connector).toBeDefined();

    const config: Record<string, unknown> = {
      connectorKey: manifest.connectorKey
    };
    const nonSecretFields: Record<string, unknown> = {};
    const secretFields: Record<string, string> = {};

    for (const field of authMethod!.fields as AuthField[]) {
      const value = valueForAuthField(manifest.connectorKey, field);
      config[field.key] = value;

      if (isSensitiveAuthField(field)) {
        secretFields[field.key] = String(value);
      } else {
        nonSecretFields[field.key] = value;
      }
    }

    const mockResult = await connector!.sync({
      authType: "mock",
      config: {
        connectorKey: manifest.connectorKey,
        mockMode: true
      },
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: true,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    cases.push({
      authType: authMethod!.kind,
      config,
      connectorKey: manifest.connectorKey,
      expectedAssetCount: mockResult.assets.length,
      expectedAssetNames: [
        ...new Set(mockResult.assets.map((asset) => asset.name))
      ],
      expectedPermissions: manifest.requiredPermissions,
      expectedSignalCategories: [
        ...new Set(mockResult.signals.map((signal) => signal.signalCategory))
      ],
      expectedSignalSubcategories: [
        ...new Set(mockResult.signals.map((signal) => signal.signalSubcategory))
      ],
      nonSecretFields,
      product: manifest.product,
      secretFields,
      vendor: manifest.vendor
    });
  }

  return cases;
}

describe("Cloud connector acceptance", () => {
  it("creates, encrypts, syncs, audits, and tenant-isolates all connectable cloud connectors through public APIs", async () => {
    const connectorCases = await buildCloudConnectorCases();

    expect(connectorCases.length).toBeGreaterThanOrEqual(10);
    expect(
      connectorCases.map((connectorCase) => connectorCase.connectorKey)
    ).toEqual(expect.arrayContaining(["aws", "azure", "gcp", "cloudflare"]));

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
        "cloud-connectors",
        "Cloud Connector Tenant"
      );
      const tenantId = signup.json().tenant.tenantId as string;
      const integrationIds: string[] = [];

      for (const connectorCase of connectorCases) {
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
          category: "Cloud",
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

        if (connectorCase.expectedAssetNames.length > 0) {
          const assets = await prisma.asset.findMany({
            where: {
              name: { in: connectorCase.expectedAssetNames },
              tenantId
            }
          });
          expect(assets.map((asset) => asset.name)).toEqual(
            expect.arrayContaining(connectorCase.expectedAssetNames)
          );

          const observations = await prisma.assetSourceObservation.findMany({
            where: { integrationId, tenantId }
          });
          expect(observations).toHaveLength(connectorCase.expectedAssetCount);
          expect(
            observations.every(
              (observation) =>
                observation.evidenceId.length > 0 &&
                observation.resolutionConfidence > 0
            )
          ).toBe(true);

          const lineage = await app.inject({
            cookies: authCookies(cookie),
            method: "GET",
            url: `/api/v1/data-fabric/assets/${observations[0]!.assetId}/lineage`
          });
          expect(lineage.statusCode).toBe(200);
          expect(lineage.json()).toMatchObject({
            asset: { assetId: observations[0]!.assetId },
            observations: expect.arrayContaining([
              expect.objectContaining({
                evidenceId: observations[0]!.evidenceId,
                integrationId,
                sourceName: `${connectorCase.vendor} ${connectorCase.product}`
              })
            ])
          });
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
          category: "Cloud",
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

      const quality = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/data-fabric/quality-surface"
      });
      expect(quality.statusCode).toBe(200);
      expect(quality.json().summary).toMatchObject({
        degraded: 0,
        qualified: connectorCases.length,
        stale: 0,
        total: connectorCases.length
      });
      expect(
        quality
          .json()
          .entries.every(
            (entry: { state: string }) => entry.state === "Qualified"
          )
      ).toBe(true);

      const { cookie: otherCookie } = await performSignup(
        app,
        "cloud-connectors-other",
        "Cloud Connector Other Tenant"
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
