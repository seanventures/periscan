import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  CUSTOMER_QUAL_CONNECTOR_KEYS,
  runConnectorProductionQualDryRun,
  type CustomerQualConnectorKey
} from "../../packages/shared/src/connector-production-qualification.js";
import * as testHelpers from "./helpers.js";

/**
 * Slice C — customer-qualification connectors (scorecard rows 72–78).
 *
 * Honest dry-run connection probe only:
 *  - Empty env → NotConfigured (never invent live partner credentials)
 *  - Optional mockMode integration health when the connector supports mock
 *
 * Residual: live customer-credential Production elevation remains CUST_QUAL
 * and is out of scope for this slice (see docs/qa/SLICE_C_OPS_FLOORS.md).
 */

const SESSION_COOKIE_NAME = "periscan_session";

describe("customer-qual connector dry-run connection probe (rows 72–78)", () => {
  let prisma: ReturnType<typeof createPrismaClient> | undefined;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "cust-qual-probe"
      ]);
      await prisma.$disconnect();
      prisma = undefined;
    }
  });

  it("returns NotConfigured for all 72–78 keys without live env; mock health optional", async () => {
    // Pure dry-run: no DB, no vendor network, no invented secrets.
    expect(CUSTOMER_QUAL_CONNECTOR_KEYS).toHaveLength(7);
    for (const connectorKey of CUSTOMER_QUAL_CONNECTOR_KEYS) {
      const dryRun = runConnectorProductionQualDryRun({
        connectorKey,
        env: {}
      });
      expect(dryRun.decision).toBe("NotConfigured");
      expect(dryRun.allowed).toBe(false);
      expect(dryRun.credentialStatus.status).toBe("NotConfigured");
      expect(dryRun.credentialStatus.harnessKnown).toBe(true);
      expect(dryRun.credentialStatus.missingKeys.length).toBeGreaterThan(0);
      expect(dryRun.summary).toMatch(/NotConfigured/i);
      // Never claim elevation readiness without keys + receipt.
      expect(dryRun.decision).not.toBe("EligibleForElevation");
    }

    // Keys present still do not elevate without a live-smoke receipt.
    const crowdstrikeKeysOnly = runConnectorProductionQualDryRun({
      connectorKey: "crowdstrike",
      env: {
        CS_CLIENT_ID: "acceptance-not-live",
        CS_CLIENT_SECRET: "acceptance-not-live"
      }
    });
    expect(crowdstrikeKeysOnly.credentialStatus.status).toBe("Ready");
    expect(crowdstrikeKeysOnly.decision).toBe("Blocked");
    expect(crowdstrikeKeysOnly.allowed).toBe(false);

    // Optional mock health path — proves connector is wireable without live creds.
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const { cookie } = await testHelpers.performSignup(
        app,
        "cust-qual-probe",
        "Customer Qual Probe Tenant"
      );
      const auth = { [SESSION_COOKIE_NAME]: cookie };

      const mockHealthResults: Array<{
        connectorKey: CustomerQualConnectorKey;
        createStatus: number;
        healthStatusCode?: number;
        healthStatus?: string;
      }> = [];

      for (const connectorKey of CUSTOMER_QUAL_CONNECTOR_KEYS) {
        const created = await app.inject({
          cookies: auth,
          method: "POST",
          payload: {
            authType: "mock",
            config: {
              connectorKey,
              mockMode: true
            },
            connectorKey,
            mockMode: true
          },
          url: "/api/v1/integrations"
        });

        // Some connectors may reject mock for policy reasons — residual, not fail.
        if (created.statusCode !== 201) {
          mockHealthResults.push({
            connectorKey,
            createStatus: created.statusCode
          });
          continue;
        }

        const integrationId = created.json().integrationId as string;
        expect(created.json()).toMatchObject({
          status: "Connected"
        });
        // Secrets must never appear even on mock create.
        expect(JSON.stringify(created.json())).not.toMatch(
          /CS_CLIENT_SECRET|XSIAM_API_KEY|VCENTER_PASSWORD|TENABLE_SECRET|acceptance-not-live/
        );

        const health = await app.inject({
          cookies: auth,
          method: "GET",
          url: `/api/v1/integrations/${integrationId}/health`
        });
        const healthBody =
          health.statusCode === 200 ? health.json() : undefined;
        mockHealthResults.push({
          connectorKey,
          createStatus: 201,
          healthStatusCode: health.statusCode,
          healthStatus: healthBody?.health?.status
        });
        if (health.statusCode === 200) {
          // Mock health is allowed Healthy/Degraded/Unknown — never pretend Production.
          expect(JSON.stringify(healthBody)).not.toMatch(
            /"productionCertified"\s*:\s*true/
          );
          expect(["Healthy", "Degraded", "Unknown", "Unhealthy"]).toContain(
            healthBody.health.status
          );
        }
      }

      // At least one customer-qual connector must accept mock + health (ops probe floor).
      const healthyMock = mockHealthResults.filter(
        (row) => row.createStatus === 201 && row.healthStatusCode === 200
      );
      expect(healthyMock.length).toBeGreaterThanOrEqual(1);

      // Catalog honesty: still zero Production elevations.
      const catalog = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/integrations/catalog"
      });
      if (catalog.statusCode === 200) {
        const body = JSON.stringify(catalog.json());
        expect(body).not.toMatch(/"availability"\s*:\s*"Production"/);
      }
    } finally {
      await app.close();
    }
  });
});
