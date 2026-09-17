import { randomUUID } from "node:crypto";

import { createPrismaEvidenceService } from "@periscan/evidence";
import type {
  AdvisoryReadinessReport,
  ThreatFeedIngestionResult,
  ThreatValidationPlan
} from "@periscan/shared";

import {
  serializeAdvisoryReadinessReport,
  serializeThreatAdvisory
} from "../serializers/threat-center.js";
import {
  fetchCisaKevFeed,
  normalizeCisaKevEntry,
  orderCisaKevByRecency,
  resolveThreatFeedUrl,
  THREAT_FEED_SOURCE_CATEGORY
} from "../threat-feeds.js";
import {
  AppServiceError,
  buildAdvisoryPackageSummary,
  buildImpactSummary,
  buildMissingSignalDrafts,
  buildReadinessSummary,
  buildThreatPlanDrafts,
  calculateNextRunAt,
  dedupeNormalized,
  assessThreatAdvisoryExposure,
  exportAdvisoryReadinessReportFromDetail,
  extractThreatIndicators,
  findEvidenceBackedThreatValidation,
  loadThreatAdvisoryDetailRecord,
  loadThreatTenantPrerequisites,
  mentionsAiApplication,
  mentionsInternalValidationContext,
  requireRole,
  SCOPE_EDITOR_ROLES,
  serializeThreatAdvisoryDetail,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

// Threat Center (manual advisory import) service group (D1 Phase 2 closure decomposition).
export function createThreatCenterServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "exportAdvisoryReadinessReport"
  | "getAdvisoryReadinessReport"
  | "getThreatAdvisory"
  | "importThreatAdvisory"
  | "getThreatFeedSchedule"
  | "ingestThreatFeed"
  | "listThreatAdvisories"
  | "runDueThreatFeedIngestion"
  | "setThreatFeedSchedule"
> {
  const { fetchImpl, prisma } = deps;

  return {
    async ingestThreatFeed(
      this: AppServices,
      context,
      input
    ): Promise<ThreatFeedIngestionResult> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "ingest threat feeds"
      );

      const feedUrl = resolveThreatFeedUrl(input.feed, input.feedUrl);
      const feed = await fetchCisaKevFeed(feedUrl, fetchImpl);
      const sourceCategory = THREAT_FEED_SOURCE_CATEGORY[input.feed];
      const candidates = orderCisaKevByRecency(feed.vulnerabilities).slice(
        0,
        input.limit
      );

      // Idempotent: skip entries already imported for this tenant + feed. The
      // unique (tenantId, sourceCategory, externalId) index is the backstop.
      const externalIds = candidates.map((entry) =>
        entry.cveID.trim().toUpperCase()
      );
      const existing = await prisma.threatAdvisory.findMany({
        select: { externalId: true },
        where: {
          externalId: { in: externalIds },
          sourceCategory,
          tenantId: context.tenant.tenantId
        }
      });
      const seen = new Set(
        existing
          .map((row) => row.externalId)
          .filter((value): value is string => Boolean(value))
      );

      const advisoryIds: string[] = [];
      let skippedCount = 0;
      for (const entry of candidates) {
        const externalId = entry.cveID.trim().toUpperCase();
        if (seen.has(externalId)) {
          skippedCount += 1;
          continue;
        }
        // Reuse the audited manual-import normalization path per new entry.
        const detail = await this.importThreatAdvisory(
          context,
          normalizeCisaKevEntry(entry)
        );
        advisoryIds.push(detail.advisory.threatAdvisoryId);
        seen.add(externalId);
      }

      return {
        advisoryIds,
        feed: input.feed,
        feedUrl,
        fetchedCount: feed.vulnerabilities.length,
        importedCount: advisoryIds.length,
        ingestedAt: new Date().toISOString(),
        skippedCount
      };
    },

    // Opt the tenant into recurring threat-feed ingestion (continuous threat center).
    async setThreatFeedSchedule(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "schedule threat-feed ingestion"
      );
      const frequency = input.frequency ?? null;
      const updated = await prisma.tenant.update({
        data: {
          nextThreatFeedIngestAt: frequency
            ? calculateNextRunAt(frequency, new Date())
            : null,
          threatFeedFrequency: frequency
        },
        where: { tenantId: context.tenant.tenantId }
      });
      return {
        frequency: updated.threatFeedFrequency,
        nextThreatFeedIngestAt:
          updated.nextThreatFeedIngestAt?.toISOString() ?? null
      };
    },

    // Read the tenant's current recurring threat-feed schedule (frequency +
    // next due time) so the UI can show it on load. A null frequency means no
    // recurring ingestion is configured. Reflects stored state only — no fetch.
    async getThreatFeedSchedule(context) {
      const tenant = await prisma.tenant.findUnique({
        select: { nextThreatFeedIngestAt: true, threatFeedFrequency: true },
        where: { tenantId: context.tenant.tenantId }
      });
      return {
        frequency: tenant?.threatFeedFrequency ?? null,
        nextThreatFeedIngestAt:
          tenant?.nextThreatFeedIngestAt?.toISOString() ?? null
      };
    },

    // Ingest the threat feed for this tenant if its recurring schedule is due, then
    // advance it. Idempotent (ingestThreatFeed skips already-imported advisories),
    // so new CISA KEV entries flow in automatically via the continuous sweep.
    async runDueThreatFeedIngestion(this: AppServices, context) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "run due threat-feed ingestion"
      );
      const ranAt = new Date();
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { tenantId: context.tenant.tenantId }
      });
      if (
        !tenant.threatFeedFrequency ||
        !tenant.nextThreatFeedIngestAt ||
        tenant.nextThreatFeedIngestAt > ranAt
      ) {
        return {
          advisoryCount: 0,
          ingested: false,
          ranAt: ranAt.toISOString()
        };
      }
      try {
        const result = await this.ingestThreatFeed(context, {
          feed: "cisa_kev",
          limit: 50
        });
        return {
          advisoryCount: result.importedCount,
          ingested: true,
          ranAt: ranAt.toISOString()
        };
      } finally {
        // Advance the schedule whether or not ingestion succeeded, so a broken
        // feed doesn't get stuck re-running on every sweep.
        await prisma.tenant.update({
          data: {
            nextThreatFeedIngestAt: calculateNextRunAt(
              tenant.threatFeedFrequency,
              ranAt
            )
          },
          where: { tenantId: tenant.tenantId }
        });
      }
    },
    async listThreatAdvisories(context, options) {
      // Route callers pass a bounded default; direct service callers can omit
      // it only for controlled internal use.
      const advisories = await prisma.threatAdvisory.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: options?.limit,
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return advisories.map(serializeThreatAdvisory);
    },

    async getThreatAdvisory(context, threatAdvisoryId) {
      const advisory = await loadThreatAdvisoryDetailRecord(
        prisma,
        context.tenant.tenantId,
        threatAdvisoryId
      );

      if (!advisory) {
        return null;
      }

      // Explain WHY the tenant is (or isn't) exposed to this advisory: which of
      // its indicators correlate to completed, evidence-backed validation runs.
      const exposure = await assessThreatAdvisoryExposure({
        indicators: {
          cveIds: advisory.cveIds,
          iocValues: advisory.iocValues,
          techniqueIds: advisory.techniqueIds
        },
        prisma,
        tenantId: context.tenant.tenantId
      });

      return serializeThreatAdvisoryDetail(advisory, exposure);
    },

    async getAdvisoryReadinessReport(context, threatAdvisoryId) {
      const report = await prisma.advisoryReadinessReport.findFirst({
        where: {
          tenantId: context.tenant.tenantId,
          threatAdvisoryId
        }
      });

      return report ? serializeAdvisoryReadinessReport(report) : null;
    },

    async exportAdvisoryReadinessReport(context, threatAdvisoryId, input = {}) {
      const advisory = await loadThreatAdvisoryDetailRecord(
        prisma,
        context.tenant.tenantId,
        threatAdvisoryId
      );
      const detail = advisory ? serializeThreatAdvisoryDetail(advisory) : null;

      if (!detail) {
        return null;
      }

      return exportAdvisoryReadinessReportFromDetail({
        context,
        detail,
        format: input.format ?? "html",
        prisma
      });
    },

    async importThreatAdvisory(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "import threat advisories"
      );

      const threatAdvisoryId = randomUUID();
      const indicators = extractThreatIndicators(input);
      const mentionsAi = mentionsAiApplication(input);
      const mentionsInternal = mentionsInternalValidationContext(input);
      const [prerequisites, validationEvidence] = await Promise.all([
        loadThreatTenantPrerequisites(prisma, context.tenant.tenantId),
        findEvidenceBackedThreatValidation({
          indicators,
          prisma,
          tenantId: context.tenant.tenantId
        })
      ]);
      const validationReady = validationEvidence.ready;
      const missingSignalDrafts = buildMissingSignalDrafts({
        mentionsAi,
        prerequisites
      });
      const evidenceService = createPrismaEvidenceService({
        prisma
      });
      const rawArtifact = await evidenceService.putEvidenceArtifact({
        artifactType: "RawModuleOutput",
        content: input.rawContent,
        filename: "threat-advisory-raw",
        relatedEntityId: threatAdvisoryId,
        relatedEntityType: "ThreatAdvisory",
        sensitivityLevel: "High",
        tenantId: context.tenant.tenantId
      });
      const normalizedArtifact = await evidenceService.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: {
          advisoryTitle: input.title,
          cveIds: indicators.cveIds,
          iocValues: indicators.iocValues,
          sourceName: input.sourceName,
          sourceUrl: input.sourceUrl ?? null,
          techniqueIds: indicators.techniqueIds,
          warning:
            "Extracted indicators are advisory context only and are not validation proof."
        },
        filename: "threat-advisory-normalized-context",
        relatedEntityId: threatAdvisoryId,
        relatedEntityType: "ThreatAdvisory",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });
      const evidenceIds = [
        rawArtifact.artifact.evidenceId,
        normalizedArtifact.artifact.evidenceId
      ];
      const conclusionEvidenceIds = dedupeNormalized([
        ...evidenceIds,
        ...validationEvidence.evidenceIds
      ]);
      const planDrafts = buildThreatPlanDrafts({
        indicators,
        mentionsAi,
        mentionsInternal,
        missingSignals: missingSignalDrafts
      });
      const readinessStatus: AdvisoryReadinessReport["readinessStatus"] =
        missingSignalDrafts.length > 0
          ? "MissingSignals"
          : validationReady
            ? "Ready"
            : "RequiresApproval";
      const overallPlanStatus: ThreatValidationPlan["status"] = planDrafts.some(
        (item) => item.status === "RequiresVerifiedScope"
      )
        ? "RequiresVerifiedScope"
        : planDrafts.some((item) => item.status === "RequiresInternalRunner")
          ? "RequiresInternalRunner"
          : planDrafts.some((item) => item.status === "RequiresIntegration")
            ? "RequiresIntegration"
            : planDrafts.some((item) => item.status === "NotConfigured")
              ? "NotConfigured"
              : "NeedsApproval";
      const packageSummary = buildAdvisoryPackageSummary({
        indicators,
        summary: input.summary
      });
      const impactSummary = buildImpactSummary({
        missingSignalCount: missingSignalDrafts.length,
        validationReady
      });
      const readinessSummary = buildReadinessSummary({
        missingSignalCount: missingSignalDrafts.length,
        readinessStatus
      });
      const publishedAt = input.publishedAt
        ? new Date(input.publishedAt)
        : null;

      const advisory = await prisma.$transaction(async (tx) => {
        const createdAdvisory = await tx.threatAdvisory.create({
          data: {
            cveIds: indicators.cveIds,
            evidenceIds: conclusionEvidenceIds,
            externalId: input.externalId ?? null,
            iocValues: indicators.iocValues,
            publishedAt,
            rawEvidenceId: rawArtifact.artifact.evidenceId,
            sourceCategory: input.sourceCategory ?? null,
            sourceName: input.sourceName,
            sourceUrl: input.sourceUrl ?? null,
            status: "PlanReady",
            summary: input.summary,
            techniqueIds: indicators.techniqueIds,
            tenantId: context.tenant.tenantId,
            threatAdvisoryId,
            title: input.title
          }
        });
        const createdPackage = await tx.threatPackage.create({
          data: {
            cveIds: indicators.cveIds,
            evidenceIds: conclusionEvidenceIds,
            iocValues: indicators.iocValues,
            summary: packageSummary,
            techniqueIds: indicators.techniqueIds,
            tenantId: context.tenant.tenantId,
            threatAdvisoryId,
            title: input.title
          }
        });
        const createdMissingSignals = [];

        for (const draft of missingSignalDrafts) {
          createdMissingSignals.push(
            await tx.missingSignal.create({
              data: {
                reason: draft.reason,
                relatedEntityId: threatAdvisoryId,
                relatedEntityType: "ThreatAdvisory",
                requiredIntegrationCategory: draft.requiredIntegrationCategory,
                signalType: draft.signalType,
                status: draft.status,
                tenantId: context.tenant.tenantId,
                threatAdvisoryId
              }
            })
          );
        }

        const missingSignalIds = createdMissingSignals.map(
          (signal) => signal.missingSignalId
        );
        const missingSignalsByType = new Map(
          createdMissingSignals.map((signal) => [
            signal.signalType,
            signal.missingSignalId
          ])
        );
        const createdImpactAssessment =
          await tx.advisoryImpactAssessment.create({
            data: {
              affectedAssetIds: [],
              affectedFindingIds: [],
              confidence:
                missingSignalIds.length > 0
                  ? Math.max(0.1, 0.7 - missingSignalIds.length * 0.1)
                  : validationReady
                    ? 0.8
                    : 0.7,
              evidenceIds: conclusionEvidenceIds,
              missingSignalIds,
              summary: impactSummary,
              tenantId: context.tenant.tenantId,
              threatAdvisoryId
            }
          });
        const threatValidationPlanId = randomUUID();
        await tx.threatValidationPlan.create({
          data: {
            evidenceIds: conclusionEvidenceIds,
            status: overallPlanStatus,
            summary:
              "Non-executing advisory validation plan. Each item remains policy-gated and is not queued by import.",
            tenantId: context.tenant.tenantId,
            threatAdvisoryId,
            threatValidationPlanId
          }
        });

        for (const draft of planDrafts) {
          await tx.threatValidationPlanItem.create({
            data: {
              evidenceIds: conclusionEvidenceIds,
              missingSignalIds: draft.missingSignalTypes
                .map((signalType) => missingSignalsByType.get(signalType))
                .filter((signalId): signalId is string => Boolean(signalId)),
              missionType: draft.missionType,
              rationale: draft.rationale,
              requiredIntegrationCategories:
                draft.requiredIntegrationCategories,
              requiredScopeTypes: draft.requiredScopeTypes,
              safetyLevel: draft.safetyLevel,
              status: draft.status,
              tenantId: context.tenant.tenantId,
              threatValidationPlanId,
              title: draft.title
            }
          });
        }

        const createdValidationPlan =
          await tx.threatValidationPlan.findUniqueOrThrow({
            include: {
              planItems: {
                orderBy: {
                  createdAt: "asc"
                }
              }
            },
            where: {
              threatValidationPlanId
            }
          });
        const createdReadinessReport = await tx.advisoryReadinessReport.create({
          data: {
            evidenceIds: conclusionEvidenceIds,
            evidencePackId: null,
            missingSignalIds,
            readinessStatus,
            summary: readinessSummary,
            tenantId: context.tenant.tenantId,
            threatAdvisoryId
          }
        });

        await writeAuditEvent(tx, {
          action: "threat_advisory.imported",
          actorType: "User",
          entityId: threatAdvisoryId,
          entityType: "ThreatAdvisory",
          metadata: {
            cveCount: indicators.cveIds.length,
            iocCount: indicators.iocValues.length,
            missingSignalCount: missingSignalIds.length,
            sourceName: input.sourceName,
            techniqueCount: indicators.techniqueIds.length
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        return {
          ...createdAdvisory,
          impactAssessment: createdImpactAssessment,
          missingSignals: createdMissingSignals,
          readinessReport: createdReadinessReport,
          threatPackage: createdPackage,
          validationPlan: createdValidationPlan
        };
      });

      const detail = serializeThreatAdvisoryDetail(advisory);

      if (!detail) {
        throw new AppServiceError(
          "Threat advisory import did not produce a complete readiness bundle.",
          500,
          "threat_advisory_incomplete"
        );
      }

      return detail;
    }
  };
}
