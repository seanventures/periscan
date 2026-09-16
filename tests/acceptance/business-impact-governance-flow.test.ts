import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("business-impact governance", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "business-impact-governance"
      ]);
      await prisma.$disconnect();
    }
  });

  it("keeps assumptions inactive until review and preserves immutable provenance", async () => {
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
      const owner = await testHelpers.performSignup(
        app,
        "business-impact-governance-owner",
        "Business Impact Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;
      const asset = await prisma.asset.create({
        data: {
          assetType: "Application",
          businessCriticality: "Critical",
          environment: "production",
          identifiers: { service: "payments" },
          internetExposed: true,
          name: "Production payments API",
          owner: "Payments engineering",
          status: "Active",
          tags: ["payments"],
          tenantId
        }
      });
      const input = {
        assumptionNotes:
          "Includes lost transactions, incident response, recovery, and customer notification.",
        businessServiceName: "Payments",
        changeReason:
          "Establish the first finance-reviewed planning range for payments.",
        confidence: "Medium",
        lossEventFrequencyPerYear: {
          maximum: 2,
          minimum: 0.5,
          mostLikely: 1
        },
        lossMagnitudeUsd: {
          maximum: 400_000,
          minimum: 100_000,
          mostLikely: 200_000
        },
        scenarioId: "availability-disruption",
        sources: [
          {
            asOfDate: "2026-07-16",
            note: "Quarterly finance planning range and incident history.",
            owner: "Finance operations",
            reference: "FIN-RISK-Q3",
            sourceType: "FinanceModel"
          }
        ]
      };

      const empty = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/business-impact/workspace"
      });
      expect(empty.statusCode).toBe(200);
      expect(empty.json()).toMatchObject({
        assets: [
          {
            asset: { assetId: asset.assetId },
            currentApprovedVersionId: null,
            currentExposure: null,
            versions: []
          }
        ],
        summary: {
          failedIntegrityCount: 0,
          pendingReviewCount: 0,
          valuedAssetCount: 0
        }
      });
      expect(empty.json().scenarios).toHaveLength(4);
      expect(JSON.stringify(empty.json().scenarios)).not.toMatch(
        /mostLikely|minimum|maximum/u
      );

      const missingSource = await app.inject({
        cookies,
        method: "POST",
        payload: { ...input, sources: [] },
        url: `/api/v1/assets/${asset.assetId}/valuation/preview`
      });
      expect(missingSource.statusCode).toBe(400);

      const retiredDirectUpdate = await app.inject({
        cookies,
        method: "PATCH",
        payload: input,
        url: `/api/v1/assets/${asset.assetId}/valuation`
      });
      expect(retiredDirectUpdate.statusCode).toBe(410);

      const preview = await app.inject({
        cookies,
        method: "POST",
        payload: input,
        url: `/api/v1/assets/${asset.assetId}/valuation/preview`
      });
      expect(preview.statusCode).toBe(200);
      expect(preview.json()).toMatchObject({
        estimate: {
          annualizedLossExposureUsd: 234_722.22,
          methodology: "FAIR-inspired PERT range estimate"
        },
        scenario: { scenarioId: "availability-disruption" }
      });
      expect(
        await prisma.asset.findUniqueOrThrow({
          where: { assetId: asset.assetId }
        })
      ).toMatchObject({ valuation: null });

      const submitted = await app.inject({
        cookies,
        method: "POST",
        payload: input,
        url: `/api/v1/assets/${asset.assetId}/valuation/versions`
      });
      expect(submitted.statusCode).toBe(201);
      expect(submitted.json()).toMatchObject({
        integrityVerified: true,
        sequence: 1,
        status: "PendingReview"
      });
      const valuationVersionId = submitted.json().valuationVersionId as string;
      expect(submitted.json().inputDigest).toMatch(/^[a-f0-9]{64}$/u);
      expect(
        await prisma.asset.findUniqueOrThrow({
          where: { assetId: asset.assetId }
        })
      ).toMatchObject({ valuation: null });

      const pendingWorkspace = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/business-impact/workspace"
      });
      expect(pendingWorkspace.json()).toMatchObject({
        summary: { pendingReviewCount: 1, valuedAssetCount: 0 }
      });

      await expect(
        prisma.assetValuationVersion.update({
          data: { changeReason: "Attempted content tamper after submission." },
          where: { assetValuationVersionId: valuationVersionId }
        })
      ).rejects.toThrow(/immutable/u);

      const approved = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decision: "Approve",
          reviewNote:
            "Finance confirmed the cited source, ordered range, and scenario boundary.",
          reviewReference: "RISK-COMMITTEE-2026-07"
        },
        url: `/api/v1/assets/${asset.assetId}/valuation/versions/${valuationVersionId}/review`
      });
      expect(approved.statusCode).toBe(200);
      expect(approved.json()).toMatchObject({
        reviewReference: "RISK-COMMITTEE-2026-07",
        status: "Approved"
      });
      expect(
        await prisma.asset.findUniqueOrThrow({
          where: { assetId: asset.assetId }
        })
      ).toMatchObject({
        valuation: {
          businessServiceName: "Payments",
          currency: "USD"
        }
      });

      const duplicateReview = await app.inject({
        cookies,
        method: "POST",
        payload: {
          decision: "Reject",
          reviewNote: "A completed decision cannot be overwritten later.",
          reviewReference: "RISK-COMMITTEE-2026-07-RETRY"
        },
        url: `/api/v1/assets/${asset.assetId}/valuation/versions/${valuationVersionId}/review`
      });
      expect(duplicateReview.statusCode).toBe(409);

      const finalWorkspace = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/business-impact/workspace"
      });
      expect(finalWorkspace.json()).toMatchObject({
        assets: [
          {
            currentApprovedVersionId: valuationVersionId,
            versions: [
              {
                input: {
                  sources: [
                    {
                      owner: "Finance operations",
                      reference: "FIN-RISK-Q3"
                    }
                  ]
                },
                integrityVerified: true,
                reviewReference: "RISK-COMMITTEE-2026-07",
                status: "Approved"
              }
            ]
          }
        ],
        summary: {
          approvedAssetCount: 1,
          failedIntegrityCount: 0,
          pendingReviewCount: 0,
          valuedAssetCount: 1
        }
      });
      expect(finalWorkspace.json().limitations.join(" ")).toContain(
        "not measured loss history"
      );

      const audits = await prisma.auditEvent.findMany({
        orderBy: { createdAt: "asc" },
        where: {
          action: {
            in: [
              "asset_valuation_submitted",
              "asset_valuation_reviewed",
              "asset_valuation_updated"
            ]
          },
          tenantId
        }
      });
      expect(audits.map((audit) => audit.action)).toEqual([
        "asset_valuation_submitted",
        "asset_valuation_reviewed",
        "asset_valuation_updated"
      ]);
      expect(audits[1]?.metadata).toMatchObject({
        decision: "Approve",
        reviewReference: "RISK-COMMITTEE-2026-07",
        sequence: 1
      });

      const outsider = await testHelpers.performSignup(
        app,
        "business-impact-governance-outsider",
        "Business Impact Outsider"
      );
      const outsiderCookies = { [SESSION_COOKIE_NAME]: outsider.cookie };
      const outsiderWorkspace = await app.inject({
        cookies: outsiderCookies,
        method: "GET",
        url: "/api/v1/business-impact/workspace"
      });
      expect(outsiderWorkspace.statusCode).toBe(200);
      expect(outsiderWorkspace.json().assets).toEqual([]);
      const outsiderReview = await app.inject({
        cookies: outsiderCookies,
        method: "POST",
        payload: {
          decision: "Approve",
          reviewNote: "This tenant must not be able to approve the version.",
          reviewReference: "OUTSIDER-ATTEMPT"
        },
        url: `/api/v1/assets/${asset.assetId}/valuation/versions/${valuationVersionId}/review`
      });
      expect(outsiderReview.statusCode).toBe(404);
    } finally {
      await app.close();
    }
  });
});
