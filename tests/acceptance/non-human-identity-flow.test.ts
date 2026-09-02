import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("non-human identity inventory", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, ["nhi-owner", "nhi-other"]);
      await prisma.$disconnect();
    }
  });

  it("rejects plaintext credentials, ranks metadata, upserts, audits, and isolates tenants", async () => {
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
      const owner = await testHelpers.performSignup(app, "nhi-owner", "NHI Owner Tenant");
      const ownerAuth = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      const basePayload = {
        credentialFingerprint:
          "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        displayName: "Production release key",
        environment: "production",
        expiresAt: "2026-06-01T00:00:00.000Z",
        externalId: "github-release-key-17",
        identityType: "APIKey",
        lastUsedAt: "2025-01-01T00:00:00.000Z",
        privileges: ["organization:admin"],
        provider: "GitHub",
        publicExposure: true,
        resourceAccess: [
          { access: "write", environment: "production", resource: "repo:api" },
          { access: "write", environment: "development", resource: "repo:web" }
        ],
        rotatedAt: "2025-01-01T00:00:00.000Z"
      };

      const rejected = await app.inject({
        cookies: ownerAuth,
        method: "POST",
        payload: { ...basePayload, secret: "must-never-persist" },
        url: "/api/v1/non-human-identities"
      });
      expect(rejected.statusCode).toBe(400);
      expect(await prisma.nonHumanIdentity.count({ where: { tenantId } })).toBe(0);

      const created = await app.inject({
        cookies: ownerAuth,
        method: "POST",
        payload: basePayload,
        url: "/api/v1/non-human-identities"
      });
      expect(created.statusCode).toBe(201);
      expect(created.json()).toMatchObject({
        displayName: "Production release key",
        riskLevel: "Critical",
        riskScore: 100
      });
      expect(created.json().riskFlags).toEqual(
        expect.arrayContaining(["Orphaned", "OverPrivileged", "PubliclyExposed", "CrossEnvironment"])
      );
      expect(created.body).not.toContain("github-release-key-17");
      expect(created.body).not.toContain("must-never-persist");

      const updated = await app.inject({
        cookies: ownerAuth,
        method: "POST",
        payload: { ...basePayload, owner: "Platform Engineering" },
        url: "/api/v1/non-human-identities"
      });
      expect(updated.statusCode).toBe(201);
      expect(updated.json().riskFlags).not.toContain("Orphaned");
      expect(await prisma.nonHumanIdentity.count({ where: { tenantId } })).toBe(1);

      const listed = await app.inject({
        cookies: ownerAuth,
        method: "GET",
        url: "/api/v1/non-human-identities"
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json().summary).toMatchObject({ critical: 1, total: 1 });
      expect(listed.body).not.toContain("github-release-key-17");

      const persisted = await prisma.nonHumanIdentity.findFirstOrThrow({ where: { tenantId } });
      expect(persisted.externalIdHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(persisted.externalIdHash).not.toBe("github-release-key-17");
      expect(
        await prisma.auditEvent.count({
          where: {
            action: { in: ["non_human_identity_registered", "non_human_identity_updated"] },
            entityId: persisted.nonHumanIdentityId,
            tenantId
          }
        })
      ).toBe(2);

      const other = await testHelpers.performSignup(app, "nhi-other", "NHI Other Tenant");
      const isolated = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: other.cookie },
        method: "GET",
        url: "/api/v1/non-human-identities"
      });
      expect(isolated.statusCode).toBe(200);
      expect(isolated.json()).toMatchObject({ identities: [], summary: { total: 0 } });
    } finally {
      await app.close();
    }
  });
});
