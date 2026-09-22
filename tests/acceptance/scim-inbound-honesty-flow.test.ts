/**
 * Inbound SCIM 2.0 membership provisioning (acceptance).
 *
 * Unauthenticated probes are HTTP 401. A tenant SCIM bearer token provisions
 * Users/Groups. Login remains SSO or password. CyberArk inventory SCIM is
 * out of scope here.
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

describe("inbound SCIM membership lifecycle acceptance flow", () => {
  it("returns 401 without a token and provisions a user with a tenant SCIM token", async () => {
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
      for (const path of SCIM_PATHS) {
        const response = await app.inject({
          method: "GET",
          url: path
        });
        expect(response.statusCode, `GET ${path} must be 401`).toBe(401);
        expect(response.headers["content-type"]).toMatch(
          /application\/scim\+json/i
        );
        expect(response.json()).toMatchObject({
          schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
          status: "401"
        });
      }

      const owner = await testHelpers.performSignup(
        app,
        "scim-lifecycle-owner",
        "SCIM Lifecycle Tenant"
      );

      const trustSafety = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "GET",
        url: "/api/v1/tenants/current/trust-safety"
      });
      expect(trustSafety.statusCode).toBe(200);
      const identity = trustSafety.json().identityProvisioning as {
        planeStatus: string;
        scimInbound: { status: string; discoveryPath: string; detail: string };
        jitProvisioning: { status: string };
      };
      expect(identity.planeStatus).toBe("Partial");
      expect(identity.scimInbound.status).toBe("NotConfigured");
      expect(identity.jitProvisioning.status).toBe("Optional");
      expect(identity.scimInbound.discoveryPath).toBe(
        buildIdentityProvisioningHonesty().scimInbound.discoveryPath
      );

      const issued = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "POST",
        payload: { name: "okta" },
        url: "/api/v1/tenants/current/scim-tokens"
      });
      expect(issued.statusCode).toBe(201);
      const token = (issued.json() as { token: string }).token;
      expect(token.startsWith("scim_")).toBe(true);

      const created = await app.inject({
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/scim+json"
        },
        method: "POST",
        payload: {
          active: true,
          schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
          userName: "scim-lifecycle-member@example.test"
        },
        url: "/api/v1/scim/v2/Users"
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        active: true,
        userName: "scim-lifecycle-member@example.test"
      });

      const ready = await app.inject({
        cookies: testHelpers.authHeaders(owner.cookie),
        method: "GET",
        url: "/api/v1/tenants/current/trust-safety"
      });
      expect(ready.json().identityProvisioning.scimInbound.status).toBe("Ready");

      const refused = listRefusedClaimPhrases().join(" ").toLowerCase();
      expect(refused).toMatch(/scim/);
      expect(refused).toMatch(/certified|jit/);
    } finally {
      await app.close();
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "scim-lifecycle-owner",
        "scim-lifecycle-member"
      ]);
      await prisma.$disconnect();
    }
  });
});
