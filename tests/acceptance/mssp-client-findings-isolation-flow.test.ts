import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Swarm S6 — platform E2E: MSSP client open + findings isolation.
 *
 * create client → Open client (x-periscan-tenant-id) → findings live only in
 * the child tenant. Parent without switch and sibling clients must not list or
 * mutate the child's findings (no cross-tenant mutation).
 */
describe("MSSP client open + child findings isolation", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "mssp-findings",
        "mssp-sibling",
        "mssp-outsider"
      ]);
      await prisma.$disconnect();
    }
  });

  it("keeps child findings isolated after Open client switch", async () => {
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
        prisma,
        webhookQueue: null
      })
    });

    try {
      // 1) MSSP parent signup.
      const parent = await testHelpers.performSignup(
        app,
        "mssp-findings",
        "MSSP Findings Parent",
        "MSSP"
      );
      const parentAuth = testHelpers.authHeaders(parent.cookie);
      const parentTenantId = parent.response.json().tenant.tenantId as string;
      await prisma.tenant.update({
        data: { billingPackageKey: "MSSPPartner" },
        where: { tenantId: parentTenantId }
      });

      // 2) Create two client tenants.
      const clientA = await app.inject({
        cookies: parentAuth,
        method: "POST",
        payload: {
          clientAdminEmail: testHelpers.uniqueEmail("mssp-findings-a"),
          clientAdminName: "Client A Admin",
          name: "MSSP Findings Client A"
        },
        url: "/api/v1/tenants/current/clients"
      });
      expect(clientA.statusCode).toBe(201);
      const clientAId = clientA.json().tenant.tenantId as string;
      expect(clientA.json().tenant).toMatchObject({
        parentTenantId,
        type: "Client"
      });

      const clientB = await app.inject({
        cookies: parentAuth,
        method: "POST",
        payload: {
          clientAdminEmail: testHelpers.uniqueEmail("mssp-findings-b"),
          clientAdminName: "Client B Admin",
          name: "MSSP Findings Client B"
        },
        url: "/api/v1/tenants/current/clients"
      });
      expect(clientB.statusCode).toBe(201);
      const clientBId = clientB.json().tenant.tenantId as string;

      await prisma.tenant.update({
        data: { billingPackageKey: "Enterprise" },
        where: { tenantId: clientAId }
      });
      await prisma.tenant.update({
        data: { billingPackageKey: "Enterprise" },
        where: { tenantId: clientBId }
      });

      // 3) Open client A via tenant-switch header.
      const openA = {
        cookies: parentAuth,
        headers: { "x-periscan-tenant-id": clientAId }
      };
      const childContext = await app.inject({
        ...openA,
        method: "GET",
        url: "/api/v1/tenants/current"
      });
      expect(childContext.statusCode).toBe(200);
      expect(childContext.json().tenant.tenantId).toBe(clientAId);
      expect(childContext.json().tenant.name).toBe("MSSP Findings Client A");
      expect(childContext.json().membership.role).toBe("MSSPOwner");

      // Seed a real measured finding in client A (fixture expired TLS posture).
      const scope = await app.inject({
        ...openA,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `mssp-child-a-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const scopeId = scope.json().scopeId as string;
      const verify = await app.inject({
        ...openA,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });
      expect(verify.statusCode).toBe(200);

      const posture = await app.inject({
        ...openA,
        method: "POST",
        payload: {
          executionMode: "Fixture",
          fixtures: {
            "periscan.tls_certificate_check": {
              fixtureCertificate: {
                issuer: "CN=Real CA,O=CA",
                subject: `CN=mssp-child-a.example.com,O=ClientA`,
                validFrom: new Date(Date.now() - 400 * DAY_MS).toISOString(),
                validTo: new Date(Date.now() - 10 * DAY_MS).toISOString()
              }
            }
          }
        },
        url: `/api/v1/scopes/${scopeId}/posture-check`
      });
      expect(posture.statusCode).toBeLessThan(500);

      const findingsInA = await app.inject({
        ...openA,
        method: "GET",
        url: "/api/v1/findings"
      });
      expect(findingsInA.statusCode).toBe(200);
      const aItems = findingsInA.json().items as Array<{
        findingId: string;
        tenantId?: string;
      }>;
      expect(aItems.length).toBeGreaterThan(0);
      const findingId = aItems[0]!.findingId;
      // Validated findings are derived views; detail under Open client must bind
      // to the child tenant context (tenantId on payload when present).
      const childDetail = await app.inject({
        ...openA,
        method: "GET",
        url: `/api/v1/findings/${findingId}`
      });
      expect(childDetail.statusCode).toBe(200);
      if (childDetail.json().tenantId) {
        expect(childDetail.json().tenantId).toBe(clientAId);
      }

      // 4) Parent WITHOUT switch must not list the child finding.
      const parentFindings = await app.inject({
        cookies: parentAuth,
        method: "GET",
        url: "/api/v1/findings"
      });
      expect(parentFindings.statusCode).toBe(200);
      const parentIds = (
        parentFindings.json().items as Array<{ findingId: string }>
      ).map((f) => f.findingId);
      expect(parentIds).not.toContain(findingId);

      const parentDetail = await app.inject({
        cookies: parentAuth,
        method: "GET",
        url: `/api/v1/findings/${findingId}`
      });
      expect(parentDetail.statusCode).toBe(404);

      // 5) Open client B — sibling isolation.
      const openB = {
        cookies: parentAuth,
        headers: { "x-periscan-tenant-id": clientBId }
      };
      const findingsInB = await app.inject({
        ...openB,
        method: "GET",
        url: "/api/v1/findings"
      });
      expect(findingsInB.statusCode).toBe(200);
      const bIds = (
        findingsInB.json().items as Array<{ findingId: string }>
      ).map((f) => f.findingId);
      expect(bIds).not.toContain(findingId);

      const siblingDetail = await app.inject({
        ...openB,
        method: "GET",
        url: `/api/v1/findings/${findingId}`
      });
      expect(siblingDetail.statusCode).toBe(404);

      // Cross-tenant mutation from sibling must fail (no 2xx).
      const siblingMutate = await app.inject({
        ...openB,
        method: "POST",
        payload: {
          disposition: "AcceptedRisk",
          rationale: "Attempted cross-tenant disposition — must fail."
        },
        url: `/api/v1/findings/${findingId}/transition`
      });
      expect(siblingMutate.statusCode).toBeGreaterThanOrEqual(400);
      expect(siblingMutate.statusCode).toBeLessThan(500);

      // 6) Unrelated outsider tenant cannot read/mutate either.
      const outsider = await testHelpers.performSignup(
        app,
        "mssp-outsider",
        "Outsider Org"
      );
      const outsiderAuth = testHelpers.authHeaders(outsider.cookie);
      const outsiderDetail = await app.inject({
        cookies: outsiderAuth,
        method: "GET",
        url: `/api/v1/findings/${findingId}`
      });
      expect(outsiderDetail.statusCode).toBe(404);

      // Open client A again — finding still present only in child context.
      const stillInA = await app.inject({
        ...openA,
        method: "GET",
        url: `/api/v1/findings/${findingId}`
      });
      expect(stillInA.statusCode).toBe(200);
      expect(stillInA.json().findingId).toBe(findingId);
    } finally {
      await app.close();
    }
  }, 90_000);
});
