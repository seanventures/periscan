import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

function bearer(token: string): Record<string, string> {
  return {
    authorization: `Bearer ${token}`
  };
}

describe("tenant API key authentication flow", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "apikey-owner",
        "apikey-other"
      ]);
      await prisma.$disconnect();
    }
  });

  it("issues a key, authorizes API calls by Bearer token, isolates tenants, and revokes", async () => {
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
      const { cookie: ownerCookie } = await testHelpers.performSignup(
        app,
        "apikey-owner",
        "API Key Tenant"
      );

      const createResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        payload: {
          name: "automation-key",
          scopes: ["read", "write"]
        },
        url: "/api/v1/tenants/current/api-keys"
      });

      expect(createResponse.statusCode).toBe(201);
      const created = createResponse.json();
      expect(created.secret).toMatch(/^psk_/);
      expect(created.keyPrefix).toMatch(/^psk_/);
      expect(created.scopes).toEqual(["read", "write"]);

      const secret = created.secret as string;

      // The key authenticates API calls without a session cookie.
      const meViaKey = await app.inject({
        headers: bearer(secret),
        method: "GET",
        url: "/api/v1/me"
      });
      expect(meViaKey.statusCode).toBe(200);
      expect(meViaKey.json().tenant.tenantId).toBe(created.tenantId);

      // Listing keys (admin-only) never returns the secret.
      const listResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "GET",
        url: "/api/v1/tenants/current/api-keys"
      });
      expect(listResponse.statusCode).toBe(200);
      expect(listResponse.json().items).toHaveLength(1);
      expect(listResponse.json().items[0]).not.toHaveProperty("secret");

      // A non-admin (read/write) key cannot manage keys.
      const managementDenied = await app.inject({
        headers: bearer(secret),
        method: "GET",
        url: "/api/v1/tenants/current/api-keys"
      });
      expect(managementDenied.statusCode).toBe(403);

      // The key stays bound to its own tenant regardless of the tenant header.
      const { cookie: otherCookie } = await testHelpers.performSignup(
        app,
        "apikey-other",
        "Other API Key Tenant"
      );
      const boundTenantResponse = await app.inject({
        headers: {
          ...bearer(secret),
          "x-periscan-tenant-id": randomUUID()
        },
        method: "GET",
        url: "/api/v1/me"
      });
      expect(boundTenantResponse.statusCode).toBe(200);
      expect(boundTenantResponse.json().tenant.tenantId).toBe(created.tenantId);
      expect(otherCookie).toBeTruthy();

      // Rotation invalidates the old secret and returns a new one.
      const apiKeyId = created.apiKeyId as string;
      const rotateResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "POST",
        url: `/api/v1/tenants/current/api-keys/${apiKeyId}/rotate`
      });
      expect(rotateResponse.statusCode).toBe(200);
      const rotatedSecret = rotateResponse.json().secret as string;
      expect(rotatedSecret).not.toBe(secret);

      const staleKeyResponse = await app.inject({
        headers: bearer(secret),
        method: "GET",
        url: "/api/v1/me"
      });
      expect(staleKeyResponse.statusCode).toBe(401);

      const rotatedKeyResponse = await app.inject({
        headers: bearer(rotatedSecret),
        method: "GET",
        url: "/api/v1/me"
      });
      expect(rotatedKeyResponse.statusCode).toBe(200);

      // Revocation disables the key entirely.
      const revokeResponse = await app.inject({
        cookies: testHelpers.authHeaders(ownerCookie),
        method: "DELETE",
        url: `/api/v1/tenants/current/api-keys/${apiKeyId}`
      });
      expect(revokeResponse.statusCode).toBe(200);
      expect(revokeResponse.json().revokedAt).not.toBeNull();

      const revokedKeyResponse = await app.inject({
        headers: bearer(rotatedSecret),
        method: "GET",
        url: "/api/v1/me"
      });
      expect(revokedKeyResponse.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  }, 30_000);
});
