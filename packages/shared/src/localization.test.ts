import { describe, expect, it } from "vitest";

import {
  LOCALIZATION_CATALOG_VERSION,
  PRODUCT_SHELL_SOURCE_TEXT,
  PRODUCT_SHELL_TRANSLATIONS,
  REPORT_TEMPLATE_TRANSLATIONS,
  SUPPORTED_LOCALES,
  TenantLocalizationWorkspaceSchema,
  UpdateTenantLocalizationInputSchema,
  translateProductShellText
} from "./localization";

describe("localization contracts", () => {
  it("keeps every governed catalog complete for every supported locale", () => {
    const reportKeys = Object.keys(REPORT_TEMPLATE_TRANSLATIONS["en-US"]);

    for (const locale of SUPPORTED_LOCALES) {
      expect(Object.keys(PRODUCT_SHELL_TRANSLATIONS[locale]).sort()).toEqual(
        [...PRODUCT_SHELL_SOURCE_TEXT].sort()
      );
      expect(Object.keys(REPORT_TEMPLATE_TRANSLATIONS[locale]).sort()).toEqual(
        reportKeys.sort()
      );
      expect(
        Object.values(PRODUCT_SHELL_TRANSLATIONS[locale]).every(
          (value) => value.trim().length > 0
        )
      ).toBe(true);
    }
  });

  it("translates catalog text and preserves text outside the governed catalog", () => {
    expect(translateProductShellText("ja-JP", "Dashboard")).toBe(
      "ダッシュボード"
    );
    expect(translateProductShellText("de-DE", "Customer evidence title")).toBe(
      "Customer evidence title"
    );
  });

  it("requires review ownership and IANA timezone input for activation", () => {
    expect(() =>
      UpdateTenantLocalizationInputSchema.parse({ preferredLocale: "es-ES" })
    ).toThrow();
    expect(
      UpdateTenantLocalizationInputSchema.parse({
        preferredLocale: "es-ES",
        reviewReason:
          "Reviewed shell and report translation catalogs before activation.",
        reviewReference: "LOC-REVIEW-42",
        supportOwnerEmail: "regional-support@example.test",
        timeZone: "Europe/Madrid"
      })
    ).toMatchObject({
      preferredLocale: "es-ES",
      timeZone: "Europe/Madrid"
    });
  });

  it("parses an honest workspace with presentation-only boundaries", () => {
    const digest = "a".repeat(64);
    const coverage = [
      {
        complete: true,
        completionPercent: 100,
        fallbackKeys: [],
        scope: "ProductShell",
        totalKeys: PRODUCT_SHELL_SOURCE_TEXT.length,
        translatedKeys: PRODUCT_SHELL_SOURCE_TEXT.length
      }
    ];
    expect(
      TenantLocalizationWorkspaceSchema.parse({
        catalogs: [
          {
            catalogDigest: digest,
            catalogVersion: LOCALIZATION_CATALOG_VERSION,
            coverage,
            locale: "en-US",
            localeLabel: "English (United States)",
            readyForActivation: true
          }
        ],
        contentBoundary: "Only reviewed catalog surfaces are translated.",
        dataRegion: "us-east-1",
        formatPreview: {
          dateTime: "Tuesday, July 15, 2026 at 12:00 PM",
          locale: "en-US",
          number: "1,234,567.89",
          relativeTime: "in 3 days",
          sampleNumber: 1234567.89,
          sampleTimestamp: "2026-07-15T16:00:00.000Z",
          timeZone: "America/New_York"
        },
        generatedAt: "2026-07-15T16:00:00.000Z",
        localization: {
          activeReleaseId: null,
          catalogCoverage: coverage,
          catalogDigest: digest,
          catalogVersion: LOCALIZATION_CATALOG_VERSION,
          evidenceIdentifiersLocalized: false,
          preferredLocale: "en-US",
          preferredTimeZone: "America/New_York",
          reportClaimSemanticsLocalized: false,
          reviewReference: null,
          reviewedAt: null,
          supportOwnerEmail: null,
          supportedLocales: ["en-US"]
        },
        releaseHistory: [],
        residencyBoundary: "Presentation changes do not move tenant data."
      }).localization
    ).toMatchObject({
      evidenceIdentifiersLocalized: false,
      reportClaimSemanticsLocalized: false
    });
  });
});
