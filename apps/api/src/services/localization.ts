import { createHash } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import {
  LOCALIZATION_CATALOG_VERSION,
  LOCALE_LABELS,
  PRODUCT_SHELL_SOURCE_TEXT,
  PRODUCT_SHELL_TRANSLATIONS,
  REPORT_TEMPLATE_TRANSLATIONS,
  SUPPORTED_LOCALES,
  LocalizationFormatPreviewSchema,
  TenantLocalizationCatalogSchema,
  TenantLocalizationReleaseSchema,
  TenantLocalizationSchema,
  TenantLocalizationWorkspaceSchema,
  type LocalizationCatalogCoverage,
  type LocalizationFormatPreview,
  type MembershipRole,
  type SupportedLocale,
  type TenantLocalization,
  type TenantLocalizationCatalog,
  type TenantLocalizationRelease,
  type TenantLocalizationWorkspace
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const LOCALIZATION_ADMIN_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "MSSPOwner",
  "ClientAdmin"
]);

type LocalizationServices = Pick<
  AppServices,
  | "getTenantLocalization"
  | "getTenantLocalizationWorkspace"
  | "previewTenantLocalization"
  | "updateTenantLocalization"
>;

type LocalizationReleaseRecord = Awaited<
  ReturnType<PrismaClient["tenantLocalizationRelease"]["findFirst"]>
>;

function buildCoverage(): LocalizationCatalogCoverage[] {
  const shellKeys = PRODUCT_SHELL_SOURCE_TEXT.length;
  const reportKeys = Object.keys(REPORT_TEMPLATE_TRANSLATIONS["en-US"]).length;
  return [
    {
      complete: true,
      completionPercent: 100,
      fallbackKeys: [],
      scope: "ProductShell",
      totalKeys: shellKeys,
      translatedKeys: shellKeys
    },
    {
      complete: true,
      completionPercent: 100,
      fallbackKeys: [],
      scope: "SnapshotReport",
      totalKeys: reportKeys,
      translatedKeys: reportKeys
    }
  ];
}

function catalogDigest(locale: SupportedLocale) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        locale,
        productShell: PRODUCT_SHELL_TRANSLATIONS[locale],
        snapshotReport: REPORT_TEMPLATE_TRANSLATIONS[locale],
        version: LOCALIZATION_CATALOG_VERSION
      })
    )
    .digest("hex");
}

function buildCatalog(locale: SupportedLocale): TenantLocalizationCatalog {
  const coverage = buildCoverage();
  return TenantLocalizationCatalogSchema.parse({
    catalogDigest: catalogDigest(locale),
    catalogVersion: LOCALIZATION_CATALOG_VERSION,
    coverage,
    locale,
    localeLabel: LOCALE_LABELS[locale],
    readyForActivation: coverage.every((item) => item.complete)
  });
}

function assertTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new AppServiceError(
      "Localization timezone must be a valid IANA timezone.",
      400,
      "invalid_localization_timezone"
    );
  }
}

function buildFormatPreview(input: {
  locale: SupportedLocale;
  sampleNumber?: number;
  sampleTimestamp?: string;
  timeZone: string;
}): LocalizationFormatPreview {
  assertTimeZone(input.timeZone);
  const sampleTimestamp = input.sampleTimestamp ?? new Date().toISOString();
  const timestamp = new Date(sampleTimestamp);
  const sampleNumber = input.sampleNumber ?? 1234567.89;
  return LocalizationFormatPreviewSchema.parse({
    dateTime: new Intl.DateTimeFormat(input.locale, {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: input.timeZone
    }).format(timestamp),
    locale: input.locale,
    number: new Intl.NumberFormat(input.locale, {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(sampleNumber),
    relativeTime: new Intl.RelativeTimeFormat(input.locale, {
      numeric: "always"
    }).format(3, "day"),
    sampleNumber,
    sampleTimestamp,
    timeZone: input.timeZone
  });
}

function serializeRelease(
  record: NonNullable<LocalizationReleaseRecord>
): TenantLocalizationRelease {
  return TenantLocalizationReleaseSchema.parse({
    ...record,
    activatedAt: record.activatedAt.toISOString(),
    coverage: record.coverage
  });
}

async function loadLocalizationState(prisma: PrismaClient, tenantId: string) {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    include: {
      localizationReleases: {
        orderBy: { sequence: "desc" },
        take: 20
      }
    },
    where: { tenantId }
  });
  const releases = tenant.localizationReleases.map(serializeRelease);
  const latest = releases[0] ?? null;
  const catalog = buildCatalog(tenant.preferredLocale as SupportedLocale);
  const localization = TenantLocalizationSchema.parse({
    activeReleaseId: latest?.localizationReleaseId ?? null,
    catalogCoverage: catalog.coverage,
    catalogDigest: catalog.catalogDigest,
    catalogVersion: catalog.catalogVersion,
    evidenceIdentifiersLocalized: false,
    preferredLocale: tenant.preferredLocale,
    preferredTimeZone: tenant.preferredTimeZone,
    reportClaimSemanticsLocalized: false,
    reviewReference: latest?.reviewReference ?? null,
    reviewedAt: latest?.activatedAt ?? null,
    supportOwnerEmail: latest?.supportOwnerEmail ?? null,
    supportedLocales: SUPPORTED_LOCALES
  });
  return { localization, releases, tenant };
}

async function loadWorkspace(
  prisma: PrismaClient,
  tenantId: string
): Promise<TenantLocalizationWorkspace> {
  const { localization, releases, tenant } = await loadLocalizationState(
    prisma,
    tenantId
  );
  return TenantLocalizationWorkspaceSchema.parse({
    catalogs: SUPPORTED_LOCALES.map(buildCatalog),
    contentBoundary:
      "The governed catalog covers product-shell navigation and Validation Snapshot report chrome. Page bodies, inline help, customer-authored evidence, regulatory language, tax, and legal terms remain in their reviewed source language unless a separate catalog explicitly covers them.",
    dataRegion: tenant.dataRegion,
    formatPreview: buildFormatPreview({
      locale: localization.preferredLocale,
      timeZone: localization.preferredTimeZone
    }),
    generatedAt: new Date().toISOString(),
    localization,
    releaseHistory: releases,
    residencyBoundary:
      "Changing language or timezone changes presentation only. It does not move tenant data, change the configured data region, or authorize a cross-border transfer."
  });
}

export function createLocalizationServices(
  deps: RuntimeServiceDeps
): LocalizationServices {
  const { prisma } = deps;

  return {
    async getTenantLocalization(context): Promise<TenantLocalization> {
      return (await loadLocalizationState(prisma, context.tenant.tenantId))
        .localization;
    },

    async getTenantLocalizationWorkspace(
      context
    ): Promise<TenantLocalizationWorkspace> {
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async previewTenantLocalization(
      context,
      input
    ): Promise<LocalizationFormatPreview> {
      requireRole(
        context.membership.role,
        LOCALIZATION_ADMIN_ROLES,
        "preview tenant localization"
      );
      return buildFormatPreview(input);
    },

    async updateTenantLocalization(context, input) {
      requireRole(
        context.membership.role,
        LOCALIZATION_ADMIN_ROLES,
        "activate tenant localization"
      );
      assertTimeZone(input.timeZone);
      const catalog = buildCatalog(input.preferredLocale);
      if (!catalog.readyForActivation) {
        throw new AppServiceError(
          "The selected localization catalog is incomplete and cannot be activated.",
          409,
          "localization_catalog_incomplete"
        );
      }

      await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUniqueOrThrow({
          select: { preferredLocale: true, preferredTimeZone: true },
          where: { tenantId: context.tenant.tenantId }
        });
        const latest = await tx.tenantLocalizationRelease.findFirst({
          orderBy: { sequence: "desc" },
          select: { sequence: true },
          where: { tenantId: context.tenant.tenantId }
        });
        await tx.tenant.update({
          data: {
            preferredLocale: input.preferredLocale,
            preferredTimeZone: input.timeZone
          },
          where: { tenantId: context.tenant.tenantId }
        });
        const release = await tx.tenantLocalizationRelease.create({
          data: {
            activatedBy: context.user.userId,
            catalogDigest: catalog.catalogDigest,
            catalogVersion: catalog.catalogVersion,
            coverage: catalog.coverage as unknown as Prisma.InputJsonValue,
            locale: input.preferredLocale,
            previousLocale: tenant.preferredLocale,
            previousTimeZone: tenant.preferredTimeZone,
            reviewReason: input.reviewReason,
            reviewReference: input.reviewReference,
            sequence: (latest?.sequence ?? 0) + 1,
            supportOwnerEmail: input.supportOwnerEmail,
            tenantId: context.tenant.tenantId,
            timeZone: input.timeZone
          }
        });
        await writeAuditEvent(tx, {
          action: "tenant.localization_activated",
          actorType: "User",
          entityId: release.localizationReleaseId,
          entityType: "Tenant",
          metadata: {
            catalogDigest: catalog.catalogDigest,
            catalogVersion: catalog.catalogVersion,
            evidenceIdentifiersLocalized: false,
            preferredLocale: input.preferredLocale,
            previousLocale: tenant.preferredLocale,
            previousTimeZone: tenant.preferredTimeZone,
            reportClaimSemanticsLocalized: false,
            reviewReference: input.reviewReference,
            sequence: release.sequence,
            timeZone: input.timeZone
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });

      return (await loadLocalizationState(prisma, context.tenant.tenantId))
        .localization;
    }
  };
}
