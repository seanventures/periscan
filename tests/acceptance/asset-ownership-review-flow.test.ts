import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import {
  authCookies,
  cleanupTestDataByEmailPrefix,
  performSignup,
  probeDatabaseConnection
} from "./helpers.js";

describe("external ownership candidate review", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await cleanupTestDataByEmailPrefix(prisma, ["ownership-review"]);
      await prisma.$disconnect();
    }
  });

  it("persists and audits a review without expanding authorized scope", async () => {
    prisma = createPrismaClient();
    await probeDatabaseConnection(prisma);
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: { async enqueueValidationJob() {} },
        prisma
      })
    });

    try {
      const { cookie, response } = await performSignup(
        app,
        "ownership-review",
        "Ownership Review Tenant"
      );
      const tenantId = response.json().tenant.tenantId as string;
      const hostname = "unclaimed.review.example.net";
      const candidate = await prisma.asset.create({
        data: {
          assetType: "Service",
          businessCriticality: "Moderate",
          identifiers: { publicDnsName: hostname },
          internetExposed: true,
          name: "Unclaimed review endpoint",
          status: "Active",
          tags: ["easm-candidate"],
          tenantId
        }
      });

      const before = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/data-fabric/ownership-surface"
      });
      expect(before.statusCode).toBe(200);
      expect(before.json().entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            asset: expect.objectContaining({ assetId: candidate.assetId }),
            ownershipStatus: "UnattributedCandidate",
            review: null
          })
        ])
      );

      const reviewed = await app.inject({
        cookies: authCookies(cookie),
        method: "PATCH",
        payload: {
          disposition: "NeedsVerification",
          note: "Confirm ownership through DNS verification with the asset owner."
        },
        url: `/api/v1/data-fabric/ownership-candidates/${candidate.assetId}/review`
      });
      expect(reviewed.statusCode).toBe(200);
      expect(reviewed.json()).toMatchObject({
        assetId: candidate.assetId,
        disposition: "NeedsVerification"
      });

      expect(
        await prisma.assetOwnershipReview.findUnique({
          where: { assetId: candidate.assetId }
        })
      ).toMatchObject({
        disposition: "NeedsVerification",
        tenantId
      });
      expect(
        await prisma.auditEvent.findFirst({
          where: {
            action: "asset_ownership_reviewed",
            entityId: reviewed.json().assetOwnershipReviewId,
            tenantId
          }
        })
      ).toMatchObject({ entityType: "Asset" });
      expect(
        await prisma.scope.count({ where: { tenantId, value: hostname } })
      ).toBe(0);

      const reread = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/data-fabric/ownership-surface"
      });
      expect(reread.json().entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            asset: expect.objectContaining({ assetId: candidate.assetId }),
            ownershipStatus: "UnattributedCandidate",
            review: expect.objectContaining({
              disposition: "NeedsVerification"
            })
          })
        ])
      );

      const scope = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { scopeType: "Domain", value: hostname },
        url: "/api/v1/scopes"
      });
      expect(scope.statusCode).toBe(201);
      const verified = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scope.json().scopeId}/verify`
      });
      expect(verified.statusCode).toBe(200);

      const afterVerification = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/data-fabric/ownership-surface"
      });
      expect(afterVerification.json().entries).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            asset: expect.objectContaining({ assetId: candidate.assetId }),
            ownershipStatus: "ExactScope"
          })
        ])
      );

      const rejectedRepeat = await app.inject({
        cookies: authCookies(cookie),
        method: "PATCH",
        payload: {
          disposition: "Dismissed",
          note: "This should fail after verified ownership exists."
        },
        url: `/api/v1/data-fabric/ownership-candidates/${candidate.assetId}/review`
      });
      expect(rejectedRepeat.statusCode).toBe(409);
      expect(rejectedRepeat.json().code).toBe(
        "ownership_candidate_already_attributed"
      );
    } finally {
      await app.close();
    }
  }, 30_000);
});
