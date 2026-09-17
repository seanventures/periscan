import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import * as testHelpers from "./helpers.js";

const SESSION_COOKIE_NAME = "periscan_session";

describe("tenant localization", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [
        "localization-release"
      ]);
      await prisma.$disconnect();
    }
  });

  it("previews, reviews, activates, and recovers a locale without changing evidence or residency semantics", async () => {
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
        "localization-release-owner",
        "Localized Tenant"
      );
      const cookies = { [SESSION_COOKIE_NAME]: owner.cookie };
      const tenantId = owner.response.json().tenant.tenantId as string;

      const empty = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/tenants/current/localization/workspace"
      });
      expect(empty.statusCode).toBe(200);
      expect(empty.json()).toMatchObject({
        dataRegion: "us-east-1",
        localization: {
          activeReleaseId: null,
          evidenceIdentifiersLocalized: false,
          preferredLocale: "en-US",
          preferredTimeZone: "UTC",
          reportClaimSemanticsLocalized: false
        },
        releaseHistory: []
      });
      expect(empty.json().catalogs).toHaveLength(5);
      expect(
        empty
          .json()
          .catalogs.every(
            (catalog: { coverage: Array<{ completionPercent: number }> }) =>
              catalog.coverage.every(
                (coverage) => coverage.completionPercent === 100
              )
          )
      ).toBe(true);

      const invalidTimeZone = await app.inject({
        cookies,
        method: "POST",
        payload: {
          locale: "ja-JP",
          timeZone: "Not/A_Real_Zone"
        },
        url: "/api/v1/tenants/current/localization/preview"
      });
      expect(invalidTimeZone.statusCode).toBe(400);

      const preview = await app.inject({
        cookies,
        method: "POST",
        payload: {
          locale: "ja-JP",
          sampleNumber: 1234567.89,
          sampleTimestamp: "2026-07-15T16:00:00.000Z",
          timeZone: "Asia/Tokyo"
        },
        url: "/api/v1/tenants/current/localization/preview"
      });
      expect(preview.statusCode).toBe(200);
      expect(preview.json()).toMatchObject({
        locale: "ja-JP",
        sampleTimestamp: "2026-07-15T16:00:00.000Z",
        timeZone: "Asia/Tokyo"
      });
      expect(preview.json().number).toContain("1,234,567.89");

      const missingReview = await app.inject({
        cookies,
        method: "PUT",
        payload: { preferredLocale: "ja-JP" },
        url: "/api/v1/tenants/current/localization"
      });
      expect(missingReview.statusCode).toBe(400);

      const activated = await app.inject({
        cookies,
        method: "PUT",
        payload: {
          preferredLocale: "ja-JP",
          reviewReason:
            "Regional support reviewed the product shell, report catalog, formatting preview, and fallback boundary.",
          reviewReference: "LOCALIZATION-REVIEW-2026-17",
          supportOwnerEmail: "regional-support@example.test",
          timeZone: "Asia/Tokyo"
        },
        url: "/api/v1/tenants/current/localization"
      });
      expect(activated.statusCode).toBe(200);
      expect(activated.json()).toMatchObject({
        activeReleaseId: expect.any(String),
        evidenceIdentifiersLocalized: false,
        preferredLocale: "ja-JP",
        preferredTimeZone: "Asia/Tokyo",
        reportClaimSemanticsLocalized: false,
        reviewReference: "LOCALIZATION-REVIEW-2026-17",
        supportOwnerEmail: "regional-support@example.test"
      });
      expect(activated.json().catalogDigest).toMatch(/^[a-f0-9]{64}$/);

      expect(
        await prisma.tenant.findUniqueOrThrow({ where: { tenantId } })
      ).toMatchObject({
        dataRegion: "us-east-1",
        preferredLocale: "ja-JP",
        preferredTimeZone: "Asia/Tokyo"
      });
      const firstRelease =
        await prisma.tenantLocalizationRelease.findFirstOrThrow({
          where: { tenantId }
        });
      expect(firstRelease).toMatchObject({
        locale: "ja-JP",
        previousLocale: "en-US",
        previousTimeZone: "UTC",
        sequence: 1,
        timeZone: "Asia/Tokyo"
      });

      const recovered = await app.inject({
        cookies,
        method: "PUT",
        payload: {
          preferredLocale: "en-US",
          reviewReason:
            "Regional support approved rollback to the prior English and UTC presentation policy.",
          reviewReference: "LOCALIZATION-ROLLBACK-2026-18",
          supportOwnerEmail: "regional-support@example.test",
          timeZone: "UTC"
        },
        url: "/api/v1/tenants/current/localization"
      });
      expect(recovered.statusCode).toBe(200);
      expect(recovered.json()).toMatchObject({
        preferredLocale: "en-US",
        preferredTimeZone: "UTC",
        reviewReference: "LOCALIZATION-ROLLBACK-2026-18"
      });

      const workspace = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/tenants/current/localization/workspace"
      });
      expect(workspace.statusCode).toBe(200);
      expect(workspace.json().releaseHistory).toHaveLength(2);
      expect(workspace.json().releaseHistory[0]).toMatchObject({
        locale: "en-US",
        previousLocale: "ja-JP",
        previousTimeZone: "Asia/Tokyo",
        sequence: 2,
        timeZone: "UTC"
      });
      expect(workspace.json().residencyBoundary).toContain(
        "does not move tenant data"
      );
      expect(workspace.json().contentBoundary).toContain("inline help");

      const audit = await prisma.auditEvent.findMany({
        orderBy: { createdAt: "asc" },
        where: {
          action: "tenant_localization_activated",
          tenantId
        }
      });
      expect(audit).toHaveLength(2);
      expect(audit[0]?.metadata).toMatchObject({
        evidenceIdentifiersLocalized: false,
        preferredLocale: "ja-JP",
        reportClaimSemanticsLocalized: false,
        reviewReference: "LOCALIZATION-REVIEW-2026-17",
        sequence: 1,
        timeZone: "Asia/Tokyo"
      });

      const outsider = await testHelpers.performSignup(
        app,
        "localization-release-outsider",
        "Localization Outsider"
      );
      const outsiderWorkspace = await app.inject({
        cookies: { [SESSION_COOKIE_NAME]: outsider.cookie },
        method: "GET",
        url: "/api/v1/tenants/current/localization/workspace"
      });
      expect(outsiderWorkspace.statusCode).toBe(200);
      expect(outsiderWorkspace.json()).toMatchObject({
        localization: { activeReleaseId: null, preferredLocale: "en-US" },
        releaseHistory: []
      });
    } finally {
      await app.close();
    }
  });
});
