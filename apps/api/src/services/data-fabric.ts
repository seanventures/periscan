import {
  importedFindingsToSignals,
  parseScanFile,
  type ScanImportFormat
} from "@periscan/connectors";
import {
  AssetLineageSchema,
  AssetOwnershipReviewSchema,
  AssetOwnershipSurfaceSchema,
  buildScanFileImportHonesty,
  DataFabricQualitySurfaceSchema,
  ScanImportResultSchema,
  type AssetLineage,
  type AssetOwnershipReview,
  type AssetOwnershipSurface,
  type DataFabricQualitySurface,
  type ImportScanFileInput,
  type ScanImportResult
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES,
  serializeAsset,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const SCAN_IMPORT_DISCLAIMER =
  "Imported scan findings are evidenceBasis=Imported. They enter the unified signal fabric for correlation and prioritization but do not claim Measured, Validated, or Periscan re-probe status until a governed validation run produces fresh evidence.";

export function createDataFabricServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "getAssetLineage"
  | "getAssetOwnershipSurface"
  | "getDataFabricQualitySurface"
  | "importScanFile"
  | "reviewAssetOwnershipCandidate"
> {
  const { prisma } = deps;
  return {
    async getDataFabricQualitySurface(context) {
      const [integrations, observationGroups, signalGroups] = await Promise.all(
        [
          prisma.integration.findMany({
            orderBy: [{ vendor: "asc" }, { product: "asc" }],
            where: { tenantId: context.tenant.tenantId }
          }),
          prisma.assetSourceObservation.groupBy({
            _count: { _all: true },
            _max: { observedAt: true },
            by: ["integrationId"],
            where: { tenantId: context.tenant.tenantId }
          }),
          prisma.signalEnvelope.groupBy({
            _count: { _all: true },
            _max: { timestampObserved: true },
            by: ["sourceIntegrationId"],
            where: {
              sourceIntegrationId: { not: null },
              tenantId: context.tenant.tenantId
            }
          })
        ]
      );
      const observationByIntegration = new Map(
        observationGroups.map((group) => [group.integrationId, group])
      );
      const signalByIntegration = new Map(
        signalGroups.flatMap((group) =>
          group.sourceIntegrationId
            ? [[group.sourceIntegrationId, group] as const]
            : []
        )
      );
      const generatedAt = new Date();
      const entries = integrations.map((integration) => {
        const observations = observationByIntegration.get(
          integration.integrationId
        );
        const signals = signalByIntegration.get(integration.integrationId);
        const assetObservationCount = observations?._count._all ?? 0;
        const signalCount = signals?._count._all ?? 0;
        const evidenceDates = [
          observations?._max.observedAt ?? null,
          signals?._max.timestampObserved ?? null
        ].filter((value): value is Date => Boolean(value));
        const lastEvidenceAt = evidenceDates.sort(
          (left, right) => right.getTime() - left.getTime()
        )[0];
        const freshnessBudgetHours = integrationFreshnessBudgetHours(
          integration.syncFrequency
        );
        const ageHours = integration.lastSyncAt
          ? Math.max(
              0,
              Math.round(
                ((generatedAt.getTime() - integration.lastSyncAt.getTime()) /
                  3_600_000) *
                  10
              ) / 10
            )
          : null;
        const issues: string[] = [];
        let state:
          | "Qualified"
          | "Degraded"
          | "Stale"
          | "PendingFirstSync"
          | "Disconnected";
        if (integration.status !== "Connected") {
          state = "Disconnected";
          issues.push("Connector is not connected.");
        } else if (!integration.lastSyncAt) {
          state = "PendingFirstSync";
          issues.push("No completed synchronization is recorded.");
        } else if (ageHours !== null && ageHours > freshnessBudgetHours) {
          state = "Stale";
          issues.push(
            `Last synchronization exceeds the ${freshnessBudgetHours}-hour freshness budget.`
          );
        } else if (integration.healthStatus !== "Healthy") {
          state = "Degraded";
          issues.push(`Connector health is ${integration.healthStatus}.`);
        } else if (assetObservationCount + signalCount === 0) {
          state = "Degraded";
          issues.push(
            "The latest synchronization produced no normalized evidence."
          );
        } else {
          state = "Qualified";
        }
        return {
          ageHours,
          assetObservationCount,
          freshnessBudgetHours,
          healthStatus: integration.healthStatus,
          integrationId: integration.integrationId,
          issues,
          label: `${integration.vendor} ${integration.product}`,
          lastEvidenceAt: lastEvidenceAt?.toISOString() ?? null,
          lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
          signalCount,
          state,
          status: integration.status
        };
      });
      return DataFabricQualitySurfaceSchema.parse({
        entries,
        generatedAt: generatedAt.toISOString(),
        scanFileImport: buildScanFileImportHonesty(),
        summary: {
          degraded: entries.filter((entry) => entry.state === "Degraded")
            .length,
          disconnected: entries.filter(
            (entry) => entry.state === "Disconnected"
          ).length,
          pendingFirstSync: entries.filter(
            (entry) => entry.state === "PendingFirstSync"
          ).length,
          qualified: entries.filter((entry) => entry.state === "Qualified")
            .length,
          stale: entries.filter((entry) => entry.state === "Stale").length,
          total: entries.length
        }
      }) as DataFabricQualitySurface;
    },
    async importScanFile(context, input: ImportScanFileInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "import customer scan files"
      );
      const format = input.format as ScanImportFormat;
      const findings = parseScanFile(format, input.content);
      if (findings.length === 0) {
        throw new AppServiceError(
          "No findings parsed from the uploaded scan file. Confirm format and that the export contains report rows.",
          400,
          "scan_import_empty"
        );
      }
      // Hard cap per request to protect the control plane (pagination later).
      const capped = findings.slice(0, 2_000);
      const nowIso = new Date().toISOString();
      const signals = importedFindingsToSignals(capped, {
        nowIso,
        tenantId: context.tenant.tenantId
      });

      await prisma.signalEnvelope.createMany({
        data: signals.map((signal) => ({
          confidence: signal.confidence ?? null,
          createdAt: new Date(signal.createdAt),
          evidenceIds: signal.evidenceIds,
          freshness: signal.freshness ?? null,
          rawPayloadPointer: signal.rawPayloadPointer ?? null,
          redactionStatus: signal.redactionStatus,
          relatedAssetIds: signal.relatedAssetIds,
          relatedControlIds: signal.relatedControlIds,
          relatedEvidenceIds: signal.relatedEvidenceIds,
          relatedIdentityIds: signal.relatedIdentityIds,
          relatedPathIds: signal.relatedPathIds,
          sensitivityLevel: signal.sensitivityLevel,
          signalCategory: signal.signalCategory,
          signalId: signal.signalId,
          signalSubcategory: signal.signalSubcategory ?? null,
          sourceIntegrationId: null,
          sourceType: signal.sourceType,
          sourceVendor: signal.sourceVendor,
          tenantId: signal.tenantId,
          techniqueIds: signal.techniqueIds ?? [],
          timestampIngested: new Date(signal.timestampIngested),
          timestampObserved: new Date(signal.timestampObserved),
          updatedAt: new Date(signal.updatedAt)
        }))
      });

      await writeAuditEvent(prisma, {
        // Reuse evidence.created until a dedicated audit enum ships; metadata
        // carries the Imported scan-import provenance for auditors.
        action: "evidence.created",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          evidenceBasis: "Imported",
          findingCount: capped.length,
          format,
          kind: "data_fabric.scan_imported",
          label: input.label ?? null,
          signalCount: signals.length,
          truncated: findings.length > capped.length
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return ScanImportResultSchema.parse({
        disclaimer: SCAN_IMPORT_DISCLAIMER,
        evidenceBasis: "Imported",
        findingCount: capped.length,
        format,
        importedAt: nowIso,
        label: input.label ?? null,
        signalCount: signals.length,
        signalIds: signals.map((signal) => signal.signalId).slice(0, 500)
      }) as ScanImportResult;
    },
    async getAssetOwnershipSurface(context) {
      const [assets, scopes, observations, reviews] = await Promise.all([
        prisma.asset.findMany({
          orderBy: [{ internetExposed: "desc" }, { name: "asc" }],
          where: { tenantId: context.tenant.tenantId }
        }),
        prisma.scope.findMany({
          orderBy: { createdAt: "asc" },
          where: {
            scopeType: { in: ["Domain", "Subdomain"] },
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        }),
        prisma.assetSourceObservation.findMany({
          orderBy: { observedAt: "desc" },
          select: {
            assetId: true,
            evidenceId: true,
            integrationId: true,
            observedAt: true
          },
          where: { tenantId: context.tenant.tenantId }
        }),
        prisma.assetOwnershipReview.findMany({
          where: { tenantId: context.tenant.tenantId }
        })
      ]);

      const roots = scopes
        .map((scope) => ({
          scopeId: scope.scopeId,
          value: normalizeHostname(scope.value)
        }))
        .filter((scope): scope is { scopeId: string; value: string } =>
          Boolean(scope.value)
        )
        .sort((left, right) => right.value.length - left.value.length);
      const observationsByAsset = new Map<
        string,
        { evidenceIds: Set<string>; latest: Date | null; sources: Set<string> }
      >();
      for (const observation of observations) {
        const current = observationsByAsset.get(observation.assetId) ?? {
          evidenceIds: new Set<string>(),
          latest: null,
          sources: new Set<string>()
        };
        current.evidenceIds.add(observation.evidenceId);
        current.sources.add(observation.integrationId);
        if (!current.latest || observation.observedAt > current.latest) {
          current.latest = observation.observedAt;
        }
        observationsByAsset.set(observation.assetId, current);
      }

      const generatedAt = new Date();
      const reviewsByAsset = new Map(
        reviews.map((review) => [
          review.assetId,
          serializeOwnershipReview(review)
        ])
      );
      const entries = assets.flatMap((asset) => {
        const hostnames = extractAssetHostnames(asset.name, asset.identifiers);
        const match = bestOwnershipMatch(hostnames, roots);
        if (!asset.internetExposed && !match) return [];
        const activity = observationsByAsset.get(asset.assetId);
        const ownershipStatus = !match
          ? ("UnattributedCandidate" as const)
          : match.exact
            ? ("ExactScope" as const)
            : ("InheritedDomain" as const);
        const confidence = !match ? 0 : match.exact ? 1 : 0.92;
        return [
          {
            asset: serializeAsset(asset),
            basis: !match
              ? "Internet-facing source observation has no matching verified domain scope."
              : match.exact
                ? `Hostname exactly matches verified scope ${match.scope.value}.`
                : `Hostname is a descendant of verified domain scope ${match.scope.value}.`,
            confidence,
            evidenceIds: [...(activity?.evidenceIds ?? [])],
            hostnames,
            latestObservedAt: activity?.latest?.toISOString() ?? null,
            lifecycle: ownershipLifecycle(
              asset.firstSeenAt,
              asset.lastSeenAt,
              generatedAt
            ),
            matchedScopeId: match?.scope.scopeId ?? null,
            matchedScopeValue: match?.scope.value ?? null,
            ownershipStatus,
            review: reviewsByAsset.get(asset.assetId) ?? null,
            sourceCount: activity?.sources.size ?? 0
          }
        ];
      });
      const attributed = entries.filter(
        (entry) => entry.ownershipStatus !== "UnattributedCandidate"
      );
      return AssetOwnershipSurfaceSchema.parse({
        entries,
        generatedAt: generatedAt.toISOString(),
        summary: {
          attributedAssetCount: attributed.length,
          averageAttributedConfidence:
            attributed.length === 0
              ? 0
              : attributed.reduce((sum, entry) => sum + entry.confidence, 0) /
                attributed.length,
          internetFacingAssetCount: assets.filter(
            (asset) => asset.internetExposed
          ).length,
          unattributedCandidateCount: entries.filter(
            (entry) => entry.ownershipStatus === "UnattributedCandidate"
          ).length,
          verifiedRootCount: roots.length
        }
      }) as AssetOwnershipSurface;
    },
    async reviewAssetOwnershipCandidate(context, assetId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "review external asset ownership candidates"
      );
      const [asset, scopes] = await Promise.all([
        prisma.asset.findFirst({
          where: { assetId, tenantId: context.tenant.tenantId }
        }),
        prisma.scope.findMany({
          where: {
            scopeType: { in: ["Domain", "Subdomain"] },
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        })
      ]);
      if (!asset) {
        throw new AppServiceError(
          "Ownership candidate not found.",
          404,
          "ownership_candidate_not_found"
        );
      }
      const roots = scopes
        .map((scope) => ({
          scopeId: scope.scopeId,
          value: normalizeHostname(scope.value)
        }))
        .filter((scope): scope is { scopeId: string; value: string } =>
          Boolean(scope.value)
        );
      const hostnames = extractAssetHostnames(asset.name, asset.identifiers);
      if (!asset.internetExposed || bestOwnershipMatch(hostnames, roots)) {
        throw new AppServiceError(
          "Only unattributed internet-facing candidates can be reviewed here.",
          409,
          "ownership_candidate_already_attributed"
        );
      }
      const now = new Date();
      const review = await prisma.$transaction(async (tx) => {
        const record = await tx.assetOwnershipReview.upsert({
          create: {
            assetId,
            disposition: input.disposition,
            note: input.note,
            reviewedAt: now,
            reviewedBy: context.user.userId,
            tenantId: context.tenant.tenantId
          },
          update: {
            disposition: input.disposition,
            note: input.note,
            reviewedAt: now,
            reviewedBy: context.user.userId
          },
          where: { assetId }
        });
        await writeAuditEvent(tx, {
          action: "asset.ownership_reviewed",
          actorType: "User",
          entityId: record.assetOwnershipReviewId,
          entityType: "Asset",
          metadata: {
            assetId,
            disposition: input.disposition,
            hostnames,
            ownershipPromoted: false
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return record;
      });
      return serializeOwnershipReview(review);
    },
    async getAssetLineage(context, assetId) {
      const asset = await prisma.asset.findFirst({
        where: { assetId, tenantId: context.tenant.tenantId }
      });
      if (!asset) return null;
      const rows = await prisma.assetSourceObservation.findMany({
        include: {
          integration: { select: { product: true, vendor: true } }
        },
        orderBy: { observedAt: "desc" },
        take: 250,
        where: { assetId, tenantId: context.tenant.tenantId }
      });
      const conflictCount = rows.filter(
        (row) => row.conflictFields.length > 0
      ).length;
      const ambiguousObservationCount = rows.filter(
        (row) => row.resolutionStatus === "AmbiguousCreated"
      ).length;
      const sourceCount = new Set(rows.map((row) => row.integrationId)).size;
      const averageConfidence =
        rows.length > 0
          ? rows.reduce((sum, row) => sum + row.resolutionConfidence, 0) /
            rows.length
          : 0;

      return AssetLineageSchema.parse({
        asset: serializeAsset(asset),
        conflictCount,
        latestObservedAt: rows[0]?.observedAt.toISOString() ?? null,
        observations: rows.map((row) => ({
          assetId: row.assetId,
          canonicalKeys: row.canonicalKeys,
          conflictFields: row.conflictFields,
          createdAt: row.createdAt.toISOString(),
          evidenceId: row.evidenceId,
          integrationId: row.integrationId,
          observedAt: row.observedAt.toISOString(),
          observedIdentifiers:
            row.observedIdentifiers &&
            typeof row.observedIdentifiers === "object" &&
            !Array.isArray(row.observedIdentifiers)
              ? row.observedIdentifiers
              : {},
          observedName: row.observedName,
          observedType: row.observedType,
          resolutionConfidence: row.resolutionConfidence,
          resolutionStatus: row.resolutionStatus,
          sourceAssetKey: row.sourceAssetKey,
          sourceName: `${row.integration.vendor} ${row.integration.product}`,
          sourceObservationId: row.sourceObservationId,
          tenantId: row.tenantId,
          updatedAt: row.updatedAt.toISOString()
        })),
        resolutionSummary: {
          ambiguousObservationCount,
          averageConfidence,
          sourceCount
        }
      }) as AssetLineage;
    }
  };
}

function integrationFreshnessBudgetHours(
  frequency: "Daily" | "Weekly" | "Monthly" | null
) {
  if (frequency === "Weekly") return 180;
  if (frequency === "Monthly") return 744;
  return 30;
}

function serializeOwnershipReview(record: {
  assetId: string;
  assetOwnershipReviewId: string;
  createdAt: Date;
  disposition: string;
  note: string;
  reviewedAt: Date;
  reviewedBy: string;
  tenantId: string;
  updatedAt: Date;
}): AssetOwnershipReview {
  return AssetOwnershipReviewSchema.parse({
    assetId: record.assetId,
    assetOwnershipReviewId: record.assetOwnershipReviewId,
    createdAt: record.createdAt.toISOString(),
    disposition: record.disposition,
    note: record.note,
    reviewedAt: record.reviewedAt.toISOString(),
    reviewedBy: record.reviewedBy,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  });
}

function normalizeHostname(value: string): string | null {
  const trimmed = value.trim().toLowerCase().replace(/^\*\./u, "");
  if (!trimmed) return null;
  try {
    const hostname = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    ).hostname
      .replace(/\.$/u, "")
      .toLowerCase();
    if (
      hostname === "localhost" ||
      !hostname.includes(".") ||
      !/^[a-z0-9.-]+$/u.test(hostname)
    ) {
      return null;
    }
    return hostname;
  } catch {
    return null;
  }
}

function extractAssetHostnames(name: string, identifiers: unknown): string[] {
  const candidates = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value !== "string") return;
    const hostname = normalizeHostname(value);
    if (hostname) candidates.add(hostname);
  };
  add(name);
  if (
    identifiers &&
    typeof identifiers === "object" &&
    !Array.isArray(identifiers)
  ) {
    for (const [key, value] of Object.entries(identifiers)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z]/gu, "");
      if (
        ["domain", "dns", "endpoint", "fqdn", "host", "url", "uri"].some(
          (hint) => normalizedKey.includes(hint)
        )
      ) {
        add(value);
      }
    }
  }
  return [...candidates].sort();
}

function bestOwnershipMatch(
  hostnames: string[],
  roots: Array<{ scopeId: string; value: string }>
) {
  for (const root of roots) {
    const hostname = hostnames.find(
      (candidate) =>
        candidate === root.value || candidate.endsWith(`.${root.value}`)
    );
    if (hostname)
      return { exact: hostname === root.value, hostname, scope: root };
  }
  return null;
}

function ownershipLifecycle(
  firstSeenAt: Date | null,
  lastSeenAt: Date | null,
  at: Date
): "New" | "Active" | "Stale" {
  const day = 86_400_000;
  if (firstSeenAt && at.getTime() - firstSeenAt.getTime() <= 7 * day) {
    return "New";
  }
  if (!lastSeenAt || at.getTime() - lastSeenAt.getTime() > 30 * day) {
    return "Stale";
  }
  return "Active";
}
