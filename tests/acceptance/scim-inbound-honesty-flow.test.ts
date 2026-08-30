/**
 * Swarm S4 — inbound SCIM honesty product E2E (acceptance).
 *
 * Inbound SCIM for Periscan memberships remains NotConfigured. Every discovery
 * and resource path must return HTTP 501 with a consistent actionable body —
 * never silent 404, never Production. Trust-safety identity plane must mirror
 * the same contract. CyberArk inventory SCIM is out of scope here.
 */
import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import {
  buildIdentityProvisioningHonesty,
  listRefusedClaimPhrases
} from "../../packages/shared/src/index.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SCIM_PATHS = [
  "/api/v1/scim/v2/ServiceProviderConfig",
  "/api/v1/scim/v2/ResourceTypes",
  "/api/v1/scim/v2/Schemas",
  "/api/v1/scim/v2/Users",
  "/api/v1/scim/v2/Users/example-id",
  "/api/v1/scim/v2/Groups",
  "/api/v1/scim/v2/Groups/example-id"
] as const;

const SCIM_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

describe("inbound SCIM honesty acceptance flow", () => {
  it("returns 501 NotConfigured on every SCIM route and mirrors Trust Safety", async () => {
    const prisma = createPrismaClient();
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
      const owner = await testHelpers.performSignup(
        app,
        "scim-honesty-owner",
        "SCIM Honesty Tenant"
      );

      for (const path of SCIM_PATHS) {
        for (const method of SCIM_METHODS) {
          const response = await app.inject({
            method,
            // Body only when the verb typically carries one; empty is fine for stub.
            ...(method === "GET" || method === "DELETE"
              ? {}
              : {
                  headers: { "content-type": "application/scim+json" },
                  payload: {}
                }),
            url: path
          });
          expect(
            response.statusCode,
            `${method} ${path} must be 501`
          ).toBe(501);
          expect(response.headers["content-type"]).toMatch(
            /application\/scim\+json/i
          );
          const body = response.json() as Record<string, unknown>;
          expect(body).toMatchObject({
            status: "501",
            statusName: "NotConfigured",
            orderFormDoc: "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md",
            residualDoc: "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md",
            trustSafetyPath: "/api/v1/tenants/current/trust-safety"
          });
          expect(body.schemas).toEqual([
            "urn:ietf:params:scim:api:messages:2.0:Error"
          ]);
          expect(Array.isArray(body.nextSteps)).toBe(true);
          expect((body.nextSteps as string[]).length).toBeGreaterThan(0);
          const serialized = JSON.stringify(body);
          expect(serialized).toMatch(/not shipped/i);
          expect(serialized).toMatch(/sales-assisted|order form/i);
          // Body may warn operators "Do not claim SCIM Production" — that is
          // refuse language, not a status claim. Status must stay NotConfigured.
          expect(body.statusName).toBe("NotConfigured");
          expect(body.statusName).not.toBe("Production");
          expect(serialized.toLowerCase()).not.toContain("type ii");
        }
      }

      // Authenticated probe still 501 (no accidental enablement) and may audit.
      const authedDiscovery = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "GET",
        url: "/api/v1/scim/v2/ServiceProviderConfig"
      });
      expect(authedDiscovery.statusCode).toBe(501);
      expect(authedDiscovery.json().statusName).toBe("NotConfigured");

      const trustSafety = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "GET",
        url: "/api/v1/tenants/current/trust-safety"
      });
      expect(trustSafety.statusCode).toBe(200);
      const identity = trustSafety.json().identityProvisioning as {
        planeStatus: string;
        planeStatusDetail: string;
        orderFormDoc: string;
        residualDoc: string;
        scimInbound: {
          status: string;
          discoveryPath: string;
          detail: string;
          inventoryConnectorsNote: string;
        };
        jitProvisioning: { status: string };
        advancedRbac: { status: string; customRolesSupported: boolean };
      };

      const honesty = buildIdentityProvisioningHonesty();
      expect(identity.planeStatus).toBe("Partial");
      expect(identity.planeStatus).toBe(honesty.planeStatus);
      expect(identity.scimInbound.status).toBe("NotConfigured");
      expect(identity.scimInbound.status).toBe(honesty.scimInbound.status);
      expect(identity.scimInbound.discoveryPath).toBe(
        "/api/v1/scim/v2/ServiceProviderConfig"
      );
      expect(identity.jitProvisioning.status).toBe("NotConfigured");
      expect(identity.advancedRbac.customRolesSupported).toBe(false);
      expect(identity.orderFormDoc).toBe(
        "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md"
      );
      expect(identity.residualDoc).toBe(
        "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md"
      );
      expect(identity.planeStatusDetail).toMatch(/SCIM|NotConfigured/i);
      expect(identity.scimInbound.detail).toMatch(/NotConfigured|not shipped/i);
      expect(identity.scimInbound.inventoryConnectorsNote).toMatch(
        /inventory|CyberArk/i
      );

      // Discovery document path advertised by Trust Safety is one of the 501 stubs.
      const advertised = await app.inject({
        method: "GET",
        url: identity.scimInbound.discoveryPath
      });
      expect(advertised.statusCode).toBe(501);
      expect(advertised.json().statusName).toBe("NotConfigured");

      // Claim catalog refuses SCIM Production language (GTM gate).
      const refused = listRefusedClaimPhrases().join(" ").toLowerCase();
      expect(refused).toMatch(/scim/);
      expect(refused).toMatch(/production|full idp lifecycle/);
    } finally {
      await app.close();
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "scim-honesty-owner"
      ]);
      await prisma.$disconnect();
    }
  });
});
