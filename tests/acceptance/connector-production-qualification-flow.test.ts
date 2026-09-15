import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  assertCanElevateToProduction,
  buildProductionCertifiedOverrideFromReceipt,
  evaluateProductionElevation,
  ProductionElevationBlockedError,
  runConnectorProductionQualDryRun,
  summarizeCatalogProductionHonesty,
  type ConnectorProductionQualificationReceipt
} from "../../packages/shared/src/connector-production-qualification.js";
import { PRODUCTION_QUAL_CHECKLIST_ITEMS } from "../../packages/shared/src/connector-production-qualification.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S5 — Connector Production qualification E2E.
 *
 * Locks:
 * 1. Catalog API honesty: 0 Production / Certified (no fake cert).
 * 2. Planned scaffolds cannot receive live credentials.
 * 3. Dry-run fails closed without live keys (NotConfigured).
 * 4. Elevation gate denies incomplete / mock / fixture receipts.
 * 5. Eligible elevation still does NOT mutate the catalog in this run.
 *
 * Forbidden: inventing productionCertified or live partner keys.
 */

const SESSION_COOKIE_NAME = "periscan_session";

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

function validReceipt(
  overrides: Partial<ConnectorProductionQualificationReceipt> = {}
): ConnectorProductionQualificationReceipt {
  return {
    schemaVersion: 1,
    connectorKey: "crowdstrike",
    dateUtc: "2026-07-31T18:00:00.000Z",
    operator: "swarm-s5-acceptance",
    periscanTenantId: "11111111-1111-4111-8111-111111111111",
    partnerVendorTenant: "partner-scratch-falcon",
    integrationId: "22222222-2222-4222-8222-222222222222",
    authMethodUsed: "oauth2ClientCredentials",
    commitSha: "abcdef0123456789",
    planeIssueRef: "PERISCAN-467",
    checklist: PRODUCTION_QUAL_CHECKLIST_ITEMS.map((item) => ({
      item,
      result: "PASS" as const,
      notes: "acceptance synthetic receipt — not a live partner smoke"
    })),
    liveCredentialsUsed: true,
    mockMode: false,
    fixtureOnlyPath: false,
    ...overrides
  };
}

describe("Connector Production qualification acceptance (Swarm S5)", () => {
  let prisma: ReturnType<typeof createPrismaClient> | undefined;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["conn-qual-s5"]);
      await prisma.$disconnect();
      prisma = undefined;
    }
  });

  it("dry-run + elevation gate + catalog API honesty (0 Production)", async () => {
    // --- Pure gate / dry-run (no live keys, no catalog mutation) ---
    const missingKeys = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env: {}
    });
    expect(missingKeys.decision).toBe("NotConfigured");
    expect(missingKeys.allowed).toBe(false);
    expect(missingKeys.credentialStatus.missingKeys).toEqual(
      expect.arrayContaining(["CS_CLIENT_ID", "CS_CLIENT_SECRET"])
    );

    const keysOnly = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env: {
        CS_CLIENT_ID: "acceptance-client-id",
        CS_CLIENT_SECRET: "acceptance-client-secret"
      }
    });
    expect(keysOnly.credentialStatus.status).toBe("Ready");
    expect(keysOnly.decision).toBe("Blocked");
    expect(keysOnly.allowed).toBe(false);

    const incomplete = evaluateProductionElevation(
      validReceipt({
        checklist: PRODUCTION_QUAL_CHECKLIST_ITEMS.filter(
          (item) => item !== "audit"
        ).map((item) => ({ item, result: "PASS" as const }))
      })
    );
    expect(incomplete.allowed).toBe(false);
    expect(incomplete.decision).toBe("Blocked");
    expect(incomplete.missingChecklistItems).toContain("audit");

    expect(() =>
      assertCanElevateToProduction({
        connectorKey: "crowdstrike",
        productionCertified: true
      })
    ).toThrow(ProductionElevationBlockedError);

    // Fixture / mock flags are schema-invalid — never elevatable.
    expect(
      evaluateProductionElevation(
        validReceipt({
          // @ts-expect-error honesty violation under test
          mockMode: true
        })
      ).decision
    ).toBe("InvalidReceipt");

    // Eligible only with full receipt + (in dry-run) live keys — still no
    // catalog write. This acceptance must not set productionCertified on disk.
    const eligible = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env: {
        CS_CLIENT_ID: "acceptance-client-id",
        CS_CLIENT_SECRET: "acceptance-client-secret"
      },
      receipt: validReceipt({ connectorKey: "crowdstrike" })
    });
    expect(eligible.decision).toBe("EligibleForElevation");
    expect(eligible.allowed).toBe(true);
    const override = buildProductionCertifiedOverrideFromReceipt(
      validReceipt({ connectorKey: "crowdstrike" })
    );
    expect(override?.productionCertified).toBe(true);
    // Explicit non-action: we never apply the override to the catalog here.

    // --- API: catalog honesty + Planned not connectable ---
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: testHelpers.uniqueEmail("conn-qual-s5"),
          name: "Connector Qual S5 Owner",
          password: "periscan-conn-qual-s5-password",
          tenantName: "Connector Qual S5 Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = testHelpers.getSessionCookie(signup);

      const catalog = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/integrations/catalog"
      });
      expect(catalog.statusCode).toBe(200);
      const items = catalog.json().items as Array<{
        availability: string;
        certificationLevel: string;
        connectable: boolean;
        connectorKey: string;
        executionReadiness: string;
      }>;
      expect(items.length).toBeGreaterThan(50);

      const productionCount = items.filter(
        (item) => item.availability === "Production"
      ).length;
      const certifiedCount = items.filter(
        (item) => item.certificationLevel === "Certified"
      ).length;
      expect(productionCount).toBe(0);
      expect(certifiedCount).toBe(0);

      const betaCount = items.filter(
        (item) => item.availability === "Beta"
      ).length;
      const plannedCount = items.filter(
        (item) =>
          item.availability === "Planned" ||
          item.executionReadiness === "NotConnectable"
      ).length;
      const honesty = summarizeCatalogProductionHonesty({
        productionCertifiedCount: productionCount,
        betaCount,
        plannedCount
      });
      expect(honesty.hasAnyProduction).toBe(false);
      expect(honesty.customerFacingSummary).toMatch(/0 Production-certified/);
      expect(honesty.customerFacingSummary).toMatch(/remain Beta/);

      // Planned / NotConnectable scaffold cannot take live credentials.
      const darktrace = items.find((item) => item.connectorKey === "darktrace");
      if (darktrace) {
        expect(darktrace.connectable).toBe(false);
        const createPlanned = await app.inject({
          cookies: authCookies(cookie),
          method: "POST",
          payload: {
            authType: "apiToken",
            config: {
              apiToken: `fake-live-key-${randomUUID()}`,
              connectorKey: "darktrace"
            },
            connectorKey: "darktrace",
            mockMode: false
          },
          url: "/api/v1/integrations"
        });
        expect(createPlanned.statusCode).toBe(400);
        expect(createPlanned.json().code).toBe("connector_not_connectable");
      }

      // Dedicated Beta (e.g. digitalocean) remains connectable but not Production.
      const digitalocean = items.find(
        (item) => item.connectorKey === "digitalocean"
      );
      expect(digitalocean).toBeDefined();
      expect(digitalocean!.availability).not.toBe("Production");
      expect(digitalocean!.certificationLevel).not.toBe("Certified");
      expect(digitalocean!.connectable).toBe(true);
    } finally {
      await app.close();
    }
  }, 45_000);
});
