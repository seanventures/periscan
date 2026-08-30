import { randomBytes, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  EvidencePackType,
  SignalCategory,
  type Membership as PrismaMembership,
  type Prisma,
  type User as PrismaUser
} from "@prisma/client";

import { createPrismaEvidenceService } from "@periscan/evidence";

import { serializeMissingSignal } from "../serializers/threat-center.js";
import { buildCTEMProgramSummary } from "@periscan/reports";
import {
  AuditEventActionSchema,
  COMMUNITY_VALIDATION_MODULE_IDS,
  ValidationSnapshotSchema,
  isCommunityValidationModuleId,
  resolveCommunityActivationNextAction,
  type AuditEvent,
  type CTEMProgramSummary,
  type BlueShiftBrief,
  type ProductActivationState,
  type ProductExperienceProfile,
  type ProductWorkQueue,
  type ReadinessResponse,
  type TenantMaturity,
  type TenantRequireMfaSettings,
  type TenantSafetySettings,
  type SetTenantRequireMfaInput
} from "@periscan/shared";

import { assertPrivilegedMfaStepUp } from "../mfa-step-up.js";

// Build the safety-settings DTO from a tenant row. The effective ceiling is
// AdvancedAdversarial only when offensive validation is authorized, else the
// safe default (BASLite). The hard policy floor is enforced separately.
function buildTenantSafetySettings(tenant: {
  offensiveValidationEnabled: boolean;
  offensiveValidationAuthorizedBy: string | null;
  offensiveValidationAuthorizedAt: Date | null;
  offensiveValidationAuthorizationRef: string | null;
  destructiveValidationEnabled: boolean;
  destructiveValidationAuthorizedBy: string | null;
  destructiveValidationAuthorizedAt: Date | null;
  destructiveValidationAuthorizationRef: string | null;
}): TenantSafetySettings {
  return {
    authorizationReference: tenant.offensiveValidationAuthorizationRef,
    authorizedAt: tenant.offensiveValidationAuthorizedAt?.toISOString() ?? null,
    authorizedBy: tenant.offensiveValidationAuthorizedBy,
    // Destructive is the higher tier, so it dictates the effective ceiling.
    effectiveMaxSafetyLevel:
      tenant.offensiveValidationEnabled || tenant.destructiveValidationEnabled
        ? "AdvancedAdversarial"
        : "BASLite",
    offensiveValidationEnabled: tenant.offensiveValidationEnabled,
    destructiveValidationEnabled: tenant.destructiveValidationEnabled,
    destructiveAuthorizedBy: tenant.destructiveValidationAuthorizedBy,
    destructiveAuthorizedAt:
      tenant.destructiveValidationAuthorizedAt?.toISOString() ?? null,
    destructiveAuthorizationReference:
      tenant.destructiveValidationAuthorizationRef
  };
}

import {
  serializeMembership,
  serializePolicyDecision,
  serializeScope,
  serializeUser,
  serializeValidationMission
} from "../serializers/entities.js";
import {
  serializeTenant,
  serializeTenantDesignPartnerSettings,
  serializeTenantReportBranding
} from "../serializers/tenant.js";
import {
  AppServiceError,
  assertCanAssignMembershipRole,
  AUDIT_ACTION_TO_DB,
  AUDIT_EXPORT_MAX_EVENTS,
  auditEventsToCsv,
  buildAuditExportCompleteness,
  BILLING_PACKAGE_CATALOG,
  buildBillingUsage,
  buildDeploymentStatus,
  appendDesignPartnerSessionNote,
  buildDesignPartnerWorkspace,
  buildExecutiveTrendSummary,
  buildMSSPClientPortfolio,
  buildOperationalMetricsSummary,
  buildTrustSafetySummary,
  buildValidationSnapshotPayload,
  expireTenantTrialIfNeeded,
  getMeteringPeriod,
  hashSecret,
  INVITE_ROLES,
  loadTenantReportBranding,
  MSSP_ADMIN_ROLES,
  OPERATIONAL_METRICS_WINDOW_DAYS,
  isUnownedValidatedFinding,
  parseOptionalLimitEnv,
  requireRole,
  requireApiKeyCapability,
  requireAuditExportAccess,
  resolveEvidenceEndpointEnv,
  serializeAuditEvent,
  serializeEvidenceArtifact,
  serializeEvidencePack,
  serializeIntegration,
  serializeSignalEnvelope,
  serializeRemediationTask,
  serializeVerificationEvent,
  TENANT_ADMIN_ROLES,
  USAGE_METER_DEFINITIONS,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import {
  isMfaRequiredForPasswordAuth,
  isRequireMfaEnabled
} from "../mfa-policy.js";
import { getLastValidationSweep } from "../system-scheduler.js";

const NON_SNAPSHOT_CTEM_PACK_TYPES = [
  EvidencePackType.ControlValidationReport,
  EvidencePackType.AIAppValidationReport,
  EvidencePackType.FixVerificationReport
] as const;

function buildAuditEventWhere(
  tenantId: string,
  input: {
    action?: keyof typeof AUDIT_ACTION_TO_DB;
    actorType?: string;
    category?: string;
    entityId?: string;
    entityType?: AuditEvent["entityType"];
    from?: string;
    search?: string;
    to?: string;
    userId?: string;
  }
): Prisma.AuditEventWhereInput {
  const createdAt =
    input.from || input.to
      ? {
          ...(input.from ? { gte: new Date(input.from) } : {}),
          ...(input.to ? { lte: new Date(input.to) } : {})
        }
      : undefined;
  const publicActions = AuditEventActionSchema.options
    .filter((action) => !input.action || action === input.action)
    .filter(
      (action) =>
        !input.category ||
        action.split(".")[0]?.toLowerCase() === input.category.toLowerCase()
    );
  const dbActions = publicActions.map((action) => AUDIT_ACTION_TO_DB[action]);
  const search = input.search?.trim().toLowerCase();
  const matchingSearchActions = search
    ? publicActions
        .filter((action) => action.toLowerCase().includes(search))
        .map((action) => AUDIT_ACTION_TO_DB[action])
    : [];
  const idSearch = search
    ? z.string().uuid().safeParse(input.search?.trim())
    : null;

  return {
    ...(dbActions.length < AuditEventActionSchema.options.length
      ? { action: { in: dbActions } }
      : {}),
    ...(input.actorType ? { actorType: input.actorType } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(search
      ? {
          OR: [
            ...(matchingSearchActions.length > 0
              ? [{ action: { in: matchingSearchActions } }]
              : []),
            {
              actorType: { contains: input.search!.trim(), mode: "insensitive" }
            },
            ...(idSearch?.success
              ? [{ entityId: idSearch.data }, { userId: idSearch.data }]
              : [])
          ]
        }
      : {}),
    tenantId,
    ...(input.userId ? { userId: input.userId } : {})
  };
}

interface NonSnapshotStageCounts {
  validate: number;
  verify: number;
}

interface NonSnapshotLastDiff {
  at: Date | null;
  diff: Record<string, unknown>;
}

interface NonSnapshotHistoryEntry {
  at: string;
  outcome: string | null;
  packType: string | null;
  validateDelta: number;
  verifyDelta: number;
}

type ExtendedCTEMProgramSummary = CTEMProgramSummary & {
  discoverPrioritizeFedByNonSnap: boolean;
  lastDiffBased: boolean;
  lastNonSnapRunAt?: string;
  nonSnapDiscoverEvidence: number;
  nonSnapPrioritizeEvidence: number;
  nonSnapValidateEvidence: number;
  nonSnapVerifyEvidence: number;
  recentHistory: NonSnapshotHistoryEntry[];
  recentNonSnapPacks: NonSnapshotHistoryEntry[];
  validateDelta: number;
  verifyDelta: number;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readPackInfo(diff: Record<string, unknown>) {
  return asRecord(diff.packInfo);
}

function readNonSnapshotPackType(diff: Record<string, unknown>) {
  const packInfo = readPackInfo(diff);
  return readString(diff.packType) ?? readString(packInfo.packType);
}

function readEvidenceCount(diff: Record<string, unknown>) {
  const packInfo = readPackInfo(diff);
  const direct = readNumber(diff.evidenceCount);
  const nested = readNumber(packInfo.evidenceCount);
  const evidenceIds = Array.isArray(diff.evidenceIds) ? diff.evidenceIds : null;

  return direct ?? nested ?? evidenceIds?.length ?? 0;
}

function readValidationOutcome(diff: Record<string, unknown>) {
  const packInfo = readPackInfo(diff);
  return (
    readString(diff.verificationOutcome) ??
    readString(packInfo.verificationOutcome) ??
    readString(packInfo.lastOutcome)
  );
}

function isFixVerificationPackType(packType: string | null) {
  return packType === EvidencePackType.FixVerificationReport;
}

function isNonSnapshotPackType(packType: string | null) {
  return NON_SNAPSHOT_CTEM_PACK_TYPES.some(
    (candidate) => candidate === packType
  );
}

function getEvidenceDelta(
  current?: { evidenceIds: string[] },
  previous?: { evidenceIds: string[] }
) {
  if (!current) {
    return 0;
  }

  return previous
    ? current.evidenceIds.length - previous.evidenceIds.length
    : current.evidenceIds.length;
}

function getLastDiffEvidenceDelta(records: NonSnapshotLastDiff[]) {
  const current = records[0];
  const previous = records[1];

  if (!current) {
    return 0;
  }

  return previous
    ? readEvidenceCount(current.diff) - readEvidenceCount(previous.diff)
    : readEvidenceCount(current.diff);
}

// Tenant context, MSSP portfolio, billing, audit-export, executive trends,
// operational metrics, trust/safety, readiness service group (final D1 Phase 2 slice).
export function createTenantServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "checkReadiness"
  | "createAuditExport"
  | "createClientTenant"
  | "getAuditExport"
  | "getActiveBillingPackage"
  | "getBillingLimits"
  | "getBillingMeters"
  | "getBillingPackages"
  | "getBillingUsage"
  | "getCTEMProgramSummary"
  | "getClientPortfolio"
  | "getDeploymentStatus"
  | "getDesignPartnerWorkspace"
  | "appendDesignPartnerSessionNote"
  | "getExecutiveTrends"
  | "getExecutiveTrendSeries"
  | "captureExecutiveTrendSnapshot"
  | "getOperationalMetrics"
  | "getTenantBranding"
  | "getTenantContext"
  | "getProductActivationState"
  | "getProductWorkQueue"
  | "getBlueShiftBrief"
  | "getTrustSafetySummary"
  | "inviteToCurrentTenant"
  | "listAuditEvents"
  | "listClientTenants"
  | "listTenantMembers"
  | "submitProductFeedback"
  | "getTenantSafetySettings"
  | "setOffensiveValidation"
  | "setDestructiveValidation"
  | "getTenantRequireMfa"
  | "setTenantRequireMfa"
  | "removeTenantMember"
  | "updateTenantMemberRole"
  | "updateProductExperienceProfile"
  | "updateDesignPartnerSettings"
  | "updateTenantBranding"
> {
  const {
    availableDataRegions,
    emailTransport,
    missionQueue,
    prisma,
    webBaseUrl
  } = deps;

  // Invite tokens (set-password links) live for 7 days — longer than reset
  // tokens since an invitee may not act immediately.
  const INVITE_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  // At most one executive-trend snapshot per ~20h per tenant, so a burst of
  // dashboard reads (or scheduler ticks) yields a clean roughly-daily series
  // instead of dozens of near-identical same-day points.
  const EXECUTIVE_SNAPSHOT_INTERVAL_MS = 20 * 60 * 60 * 1000;

  // Persist the current metric values as one snapshot (all rows sharing a single
  // capturedAt so they group as one point in time), throttled per tenant.
  // Returns whether a snapshot was written. Never throws on the read path — a
  // metric with no numeric samples simply isn't captured.
  async function persistExecutiveSnapshot(
    tenantId: string,
    metrics: ReadonlyArray<{
      label: string;
      metricId: string;
      unit: string;
      value: number;
    }>
  ): Promise<boolean> {
    // Only persist metrics with a real finite sample. A metric computed as a
    // ratio can be NaN/Infinity for a tenant with no denominator yet (e.g. a
    // fresh tenant with zero remediations); those carry no plottable value and
    // Postgres rejects non-finite floats, so they are dropped rather than faked.
    const samples = metrics.filter((metric) => Number.isFinite(metric.value));
    if (samples.length === 0) {
      return false;
    }
    const latest = await prisma.executiveMetricSnapshot.findFirst({
      orderBy: { capturedAt: "desc" },
      select: { capturedAt: true },
      where: { tenantId }
    });
    const now = new Date();
    if (
      latest &&
      now.getTime() - latest.capturedAt.getTime() <
        EXECUTIVE_SNAPSHOT_INTERVAL_MS
    ) {
      return false;
    }
    await prisma.executiveMetricSnapshot.createMany({
      data: samples.map((metric) => ({
        capturedAt: now,
        label: metric.label,
        metricId: metric.metricId,
        tenantId,
        unit: metric.unit,
        value: metric.value
      }))
    });
    return true;
  }

  return {
    async getCTEMProgramSummary(this: AppServices, context) {
      const snapshots = await this.listSnapshots(context);
      const latestSnapshot = snapshots[0];

      if (latestSnapshot) {
        return buildCTEMProgramSummary(latestSnapshot);
      }

      const payload = await buildValidationSnapshotPayload({
        audience: "Security Team",
        context,
        maxTopItems: 5,
        prisma
      });

      // Incorporate evidence from recent non-snapshot scheduled runs (Control/AI/Fix packs)
      // so continuous non-snap schedules visibly advance the CTEM "Validate" stage.
      const nonSnapPacks = await prisma.evidencePack.findMany({
        where: {
          tenantId: context.tenant.tenantId,
          packType: {
            in: [...NON_SNAPSHOT_CTEM_PACK_TYPES]
          },
          updatedAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30) }
        },
        select: { evidenceIds: true, packType: true, updatedAt: true }
      });
      const extraValidateEvidence = nonSnapPacks.reduce(
        (n, p) => n + (p.evidenceIds?.length || 0),
        0
      );

      // CTEM depth: attribute non-snap packs to stages (Control/AI -> validate, Fix -> verify)
      const nonSnapStageCounts = nonSnapPacks.reduce<NonSnapshotStageCounts>(
        (acc, pack) => {
          const count = pack.evidenceIds.length;
          if (pack.packType === EvidencePackType.FixVerificationReport) {
            acc.verify += count;
          } else {
            acc.validate += count;
          }

          return acc;
        },
        { validate: 0, verify: 0 }
      );

      const sortNewestFirst = <T extends { updatedAt: Date }>(
        left: T,
        right: T
      ) => right.updatedAt.getTime() - left.updatedAt.getTime();

      // P2 CTEM-trends: compute simple deltas from recent non-snap scheduled packs (latest vs prior for Validate/Verify)
      // This surfaces "change from last scheduled non-snap run" using pack evidence (tied to lastDiff/packInfo flow).
      const validatePacks = nonSnapPacks
        .filter(
          (pack) => pack.packType !== EvidencePackType.FixVerificationReport
        )
        .sort(sortNewestFirst);
      const verifyPacks = nonSnapPacks
        .filter(
          (pack) => pack.packType === EvidencePackType.FixVerificationReport
        )
        .sort(sortNewestFirst);
      const validateDelta = getEvidenceDelta(
        validatePacks[0],
        validatePacks[1]
      );
      const verifyDelta = getEvidenceDelta(verifyPacks[0], verifyPacks[1]);

      // P2 CTEM-trends deeper: pull deltas directly from schedule.lastDiff (the non-snap scheduled run artifact)
      // This makes "trends" reflect the actual lastDiff/packInfo updates from processor for Control/AI/Fix schedules.
      let lastDiffValidateDelta = 0;
      let lastDiffVerifyDelta = 0;
      let lastNonSnapRunAt: Date | null = null;
      let nonSnapLastDiffs: NonSnapshotLastDiff[] = [];
      try {
        const recentSchedules = await prisma.missionSchedule.findMany({
          where: { tenantId: context.tenant.tenantId },
          select: { lastDiff: true, lastRunAt: true },
          take: 20
        });
        nonSnapLastDiffs = recentSchedules
          .map((schedule) => ({
            at: schedule.lastRunAt,
            diff: asRecord(schedule.lastDiff)
          }))
          .filter((entry) =>
            isNonSnapshotPackType(readNonSnapshotPackType(entry.diff))
          );
        const valDiffs = nonSnapLastDiffs.filter(
          (entry) =>
            !isFixVerificationPackType(readNonSnapshotPackType(entry.diff))
        );
        const verDiffs = nonSnapLastDiffs.filter((entry) =>
          isFixVerificationPackType(readNonSnapshotPackType(entry.diff))
        );
        lastDiffValidateDelta = getLastDiffEvidenceDelta(valDiffs);
        lastDiffVerifyDelta = getLastDiffEvidenceDelta(verDiffs);
        lastNonSnapRunAt = nonSnapLastDiffs[0]?.at ?? null;
      } catch {
        // CTEM schedule history is best-effort; baseline CTEM still renders.
      }
      // Prefer lastDiff-based when available for "trends from scheduled runs"
      const effectiveValidateDelta = lastDiffValidateDelta || validateDelta;
      const effectiveVerifyDelta = lastDiffVerifyDelta || verifyDelta;

      // P3 remaining slice: compute persistent history time-series list DIRECTLY from recentNonSnapPacks + schedule.lastDiff (for chart/list); feed discover/prioritize from non-snap signals.
      const recentHistory: NonSnapshotHistoryEntry[] = nonSnapLastDiffs
        .slice(0, 10)
        .map((entry) => {
          const packType = readNonSnapshotPackType(entry.diff);
          const isVerify = isFixVerificationPackType(packType);
          const evidenceCount = readEvidenceCount(entry.diff);

          return {
            at: entry.at?.toISOString() ?? new Date().toISOString(),
            outcome: readValidationOutcome(entry.diff),
            packType,
            validateDelta: !isVerify ? evidenceCount : 0,
            verifyDelta: isVerify ? evidenceCount : 0
          };
        });
      // feed discover/prioritize stages from non-snap continuous signals (P3 full)
      const nonSnapDiscoverBoost = Math.min(3, nonSnapPacks.length);
      const nonSnapPrioritizeBoost = nonSnapStageCounts.validate > 0 ? 1 : 0;

      // Deepen: load real signals/observations linked to non-snap pack evidence for rich CTEM inclusion.
      const nonSnapEvidenceIds = Array.from(
        new Set(nonSnapPacks.flatMap((pack) => pack.evidenceIds))
      );
      let extraControlObs: Array<ReturnType<typeof serializeSignalEnvelope>> =
        [];
      let extraAiRisks: Array<ReturnType<typeof serializeSignalEnvelope>> = [];
      if (nonSnapEvidenceIds.length > 0) {
        const extraSignals = await prisma.signalEnvelope.findMany({
          where: {
            tenantId: context.tenant.tenantId,
            OR: [
              { evidenceIds: { hasSome: nonSnapEvidenceIds.slice(0, 50) } },
              {
                relatedEvidenceIds: { hasSome: nonSnapEvidenceIds.slice(0, 50) }
              }
            ],
            signalCategory: {
              in: [
                SignalCategory.ControlObservation,
                SignalCategory.AIApplication,
                SignalCategory.Remediation
              ]
            }
          },
          orderBy: { timestampObserved: "desc" },
          take: 20
        });
        extraControlObs = extraSignals
          .filter(
            (signal) =>
              signal.signalCategory === SignalCategory.ControlObservation
          )
          .map(serializeSignalEnvelope);
        extraAiRisks = extraSignals
          .filter(
            (signal) => signal.signalCategory === SignalCategory.AIApplication
          )
          .map(serializeSignalEnvelope);
      }

      // Merge real non-snap observations for deepened CTEM (real signals over count only).
      const mergedAiRisks = [
        ...(payload.aiAppRisks || []),
        ...extraAiRisks
      ].slice(0, 50);
      const mergedControlObs = [
        ...(payload.controlObservations || []),
        ...extraControlObs
      ].slice(0, 50);

      const syntheticSnapshot = ValidationSnapshotSchema.parse({
        aiAppRisks: mergedAiRisks,
        controlObservations: mergedControlObs,
        createdAt: new Date().toISOString(),
        evidenceIds: payload.evidenceIds,
        evidencePack: {
          audience: "Security Team",
          createdAt: new Date().toISOString(),
          evidenceIds: payload.evidenceIds,
          evidencePackId: randomUUID(),
          packType: "CTEMProgramSummary",
          redactionLevel: "Moderate",
          status: "Ready",
          storageUri: null,
          tenantId: context.tenant.tenantId,
          title: "CTEM Program Summary",
          updatedAt: new Date().toISOString()
        },
        integrationIds: payload.integrationIds,
        metrics: {
          aiRiskCount:
            mergedAiRisks.length ||
            payload.aiRiskCount + Math.floor(extraValidateEvidence * 0.3),
          controlObservationCount:
            mergedControlObs.length ||
            payload.controlObservationCount +
              Math.floor(extraValidateEvidence * 0.7),
          highRiskPathCount: payload.highRiskPathCount,
          correlatedThreatAdvisoryCount: payload.correlatedThreatAdvisoryCount,
          integrationCount: payload.integrationIds.length,
          openThreatAdvisoryCount: payload.openThreatAdvisoryCount,
          remediationCount: payload.remediations.length,
          staleVerificationCount: payload.staleVerificationCount,
          topPathCount: payload.topAttackPaths.length,
          verifiedScopeCount: payload.scopeIds.length,
          // CTEM depth from non-snap scheduled runs (release-grade continuous visibility)
          nonSnapValidateEvidence: nonSnapStageCounts.validate,
          nonSnapVerifyEvidence: nonSnapStageCounts.verify
        },
        missionId: null,
        remediationPriorities: payload.remediations,
        scopeIds: payload.scopeIds,
        snapshotId: randomUUID(),
        summary: payload.summary,
        tenantId: context.tenant.tenantId,
        topAttackPaths: payload.topAttackPaths,
        updatedAt: new Date().toISOString(),
        verificationPlan: [
          "Continue recurring validation.",
          "Track reopened risks and complete outstanding remediations."
        ]
      });

      const ctemSummary = buildCTEMProgramSummary(syntheticSnapshot, {
        snapshotId: null,
        source: "LiveTenantStateBaseline",
        nonSnapValidateEvidence: nonSnapStageCounts.validate,
        nonSnapVerifyEvidence: nonSnapStageCounts.verify
      });
      const extendedSummary: ExtendedCTEMProgramSummary = {
        ...ctemSummary,
        discoverPrioritizeFedByNonSnap:
          nonSnapDiscoverBoost > 0 || nonSnapPrioritizeBoost > 0,
        lastDiffBased: Boolean(lastDiffValidateDelta || lastDiffVerifyDelta),
        ...(lastNonSnapRunAt
          ? { lastNonSnapRunAt: lastNonSnapRunAt.toISOString() }
          : {}),
        nonSnapDiscoverEvidence: nonSnapDiscoverBoost,
        nonSnapPrioritizeEvidence: nonSnapPrioritizeBoost,
        nonSnapValidateEvidence: nonSnapStageCounts.validate,
        nonSnapVerifyEvidence: nonSnapStageCounts.verify,
        recentHistory,
        recentNonSnapPacks: recentHistory,
        validateDelta: effectiveValidateDelta,
        verifyDelta: effectiveVerifyDelta
      };

      return extendedSummary;
    },

    async getTenantContext(context) {
      return {
        membership: context.membership,
        tenant: context.tenant
      };
    },

    async getProductActivationState(context) {
      const tenantId = context.tenant.tenantId;
      const [
        membership,
        connectedSource,
        latestSource,
        verifiedScope,
        latestScope,
        policyDecision,
        mission,
        measuredRun,
        latestFailedRun,
        latestCommunityCandidate,
        remediation,
        verification,
        reportShare,
        exportedPack
      ] = await Promise.all([
        prisma.membership.findUniqueOrThrow({
          where: { membershipId: context.membership.membershipId }
        }),
        prisma.integration.findFirst({
          orderBy: { createdAt: "asc" },
          where: { status: "Connected", tenantId }
        }),
        prisma.integration.findFirst({
          orderBy: { updatedAt: "desc" },
          where: { tenantId }
        }),
        prisma.scope.findFirst({
          orderBy: { verifiedAt: "asc" },
          where: { tenantId, verificationStatus: "Verified" }
        }),
        prisma.scope.findFirst({
          orderBy: { updatedAt: "desc" },
          where: { tenantId }
        }),
        prisma.policyDecision.findFirst({
          orderBy: { createdAt: "asc" },
          where: { tenantId }
        }),
        prisma.validationMission.findFirst({
          orderBy: { createdAt: "asc" },
          where: { tenantId }
        }),
        prisma.validationRun.findFirst({
          orderBy: { completedAt: "asc" },
          where: {
            completedAt: { not: null },
            evidenceIds: { isEmpty: false },
            status: "Completed",
            tenantId
          }
        }),
        prisma.validationRun.findFirst({
          orderBy: { updatedAt: "desc" },
          where: { status: "Failed", tenantId }
        }),
        prisma.validationRun.findFirst({
          orderBy: { updatedAt: "desc" },
          where: {
            moduleId: { in: [...COMMUNITY_VALIDATION_MODULE_IDS] },
            tenantId
          }
        }),
        prisma.remediationTask.findFirst({
          orderBy: { createdAt: "asc" },
          where: { tenantId }
        }),
        prisma.verificationEvent.findFirst({
          orderBy: { verifiedAt: "asc" },
          where: { tenantId }
        }),
        prisma.reportShare.findFirst({
          orderBy: { createdAt: "asc" },
          where: { tenantId }
        }),
        prisma.evidencePack.findFirst({
          orderBy: { updatedAt: "asc" },
          where: { status: "Exported", tenantId }
        })
      ]);
      const latestCommunityRun =
        latestCommunityCandidate &&
        isCommunityValidationModuleId(latestCommunityCandidate.moduleId)
          ? latestCommunityCandidate
          : null;
      const communityNextAction =
        resolveCommunityActivationNextAction(latestCommunityRun);
      const proofDeliveredAt =
        [reportShare?.createdAt, exportedPack?.updatedAt]
          .filter((value): value is Date => Boolean(value))
          .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
      const profile: ProductExperienceProfile = {
        completedAt:
          membership.experienceProfileCompletedAt?.toISOString() ?? null,
        membershipId: membership.membershipId,
        primaryOutcome: membership.primaryOutcome,
        productPersona: membership.productPersona,
        updatedAt: membership.updatedAt.toISOString()
      };
      const maturity: TenantMaturity = verification
        ? "Operating"
        : measuredRun
          ? "Measured"
          : connectedSource || verifiedScope || mission
            ? "Activating"
            : "New";
      const records = [
        {
          completedAt: membership.createdAt,
          evidenceBasis: "The current tenant membership is persisted.",
          href: "/dashboard",
          key: "AccountCreated" as const,
          label: "Account created",
          stage: "Connect" as const
        },
        {
          completedAt: connectedSource?.createdAt ?? null,
          evidenceBasis: connectedSource
            ? `${connectedSource.vendor} ${connectedSource.product} is connected.`
            : "No connected integration is persisted for this tenant.",
          href: "/integrations",
          key: "SourceConnected" as const,
          label: "Source connected",
          stage: "Connect" as const
        },
        {
          completedAt: verifiedScope?.verifiedAt ?? null,
          evidenceBasis: verifiedScope
            ? `Scope ${verifiedScope.value} has a recorded verification event.`
            : "No scope has a current Verified status.",
          // P02-4: Authorize home is /scopes (verification), not Validate.
          href: "/scopes",
          key: "ScopeVerified" as const,
          label: "Scope verified",
          stage: "Authorize" as const
        },
        {
          completedAt: policyDecision?.createdAt ?? null,
          evidenceBasis: policyDecision
            ? `Policy decision ${policyDecision.outcome} is persisted.`
            : "No mission policy decision has been previewed.",
          href: "/missions",
          key: "PolicyPreviewed" as const,
          label: "Policy previewed",
          stage: "Authorize" as const
        },
        {
          completedAt: mission?.createdAt ?? null,
          evidenceBasis: mission
            ? `Mission ${mission.missionId} is persisted.`
            : "No validation mission has been created.",
          href: "/missions",
          key: "MissionCreated" as const,
          label: "First mission created",
          stage: "Validate" as const
        },
        {
          completedAt: measuredRun?.completedAt ?? null,
          evidenceBasis: measuredRun
            ? `Completed run ${measuredRun.runId} has ${measuredRun.evidenceIds.length} evidence item${measuredRun.evidenceIds.length === 1 ? "" : "s"}.`
            : "No completed validation run with evidence is persisted.",
          href: latestCommunityRun
            ? `/missions/${latestCommunityRun.missionId}`
            : mission
              ? `/missions/${mission.missionId}`
              : "/missions",
          key: "MeasuredResult" as const,
          label: "Measured result captured",
          stage: "Understand" as const
        },
        {
          completedAt: remediation?.createdAt ?? null,
          evidenceBasis: remediation
            ? `Remediation ${remediation.remediationId} is persisted.`
            : "No measured result has been routed into remediation.",
          href: "/remediation",
          key: "RemediationCreated" as const,
          label: "Remediation assigned",
          stage: "Act" as const
        },
        {
          completedAt: verification?.verifiedAt ?? null,
          evidenceBasis: verification
            ? `Verification ${verification.verificationId} recorded ${verification.outcome}.`
            : "No fresh verification event is persisted.",
          href: remediation
            ? `/remediation/${remediation.remediationId}`
            : "/remediation",
          key: "Revalidated" as const,
          label: "Fix re-validated",
          stage: "Verify" as const
        },
        {
          completedAt: proofDeliveredAt,
          evidenceBasis: reportShare
            ? "A governed report share has been created."
            : exportedPack
              ? "An evidence pack has been exported."
              : "No evidence pack has been shared or exported.",
          href: "/reports",
          key: "ProofDelivered" as const,
          label: "Proof delivered",
          stage: "Prove" as const
        }
      ];
      const currentIndex = records.findIndex((record) => !record.completedAt);
      const milestones: ProductActivationState["milestones"] = records.map(
        (record, index) => ({
          ...record,
          completedAt: record.completedAt?.toISOString() ?? null,
          state: record.completedAt
            ? "Completed"
            : index === currentIndex
              ? "Current"
              : "Upcoming"
        })
      );
      const current =
        milestones[currentIndex >= 0 ? currentIndex : milestones.length - 1]!;
      const diagnostics: ProductActivationState["diagnostics"] = [];

      if (!profile.completedAt) {
        diagnostics.push({
          code: "experience_profile_incomplete",
          detail:
            "Choose your role and first outcome so the landing view can prioritize the right proof-loop work.",
          href: "/welcome",
          severity: "Info",
          title: "Set your starting view"
        });
      }
      if (!connectedSource) {
        diagnostics.push({
          code: latestSource ? "source_not_connected" : "source_missing",
          detail: latestSource
            ? `${latestSource.vendor} ${latestSource.product} is ${latestSource.status}; reconnect it before relying on its signals.`
            : "Connect a source you already operate. Periscan remains read-only unless the connector explicitly states otherwise.",
          href: "/integrations",
          severity: "Attention",
          title: latestSource
            ? "Signal source needs attention"
            : "No signal source yet"
        });
      } else if (
        connectedSource.healthStatus === "Degraded" ||
        connectedSource.healthStatus === "Unhealthy"
      ) {
        diagnostics.push({
          code: "source_health_degraded",
          detail: `${connectedSource.vendor} ${connectedSource.product} reports ${connectedSource.healthStatus} health. Review it before using the signals as current proof.`,
          href: "/integrations",
          severity: "Attention",
          title: "Connected source is not healthy"
        });
      }
      if (!verifiedScope) {
        diagnostics.push({
          code: latestScope ? "scope_verification_pending" : "scope_missing",
          detail: latestScope
            ? `${latestScope.value} is ${latestScope.verificationStatus}. Active validation stays locked until authorization is verified.`
            : "Declare an authorized scope, classify its safety ceiling, and complete verification before active work can run.",
          // P02-4: resolve Authorize diagnostics on Scope workbench.
          href: "/scopes",
          severity: "Attention",
          title: latestScope
            ? "Scope is not verified"
            : "No authorized scope yet"
        });
      }
      if (
        latestFailedRun &&
        (!measuredRun || latestFailedRun.updatedAt > measuredRun.updatedAt)
      ) {
        const communityFailed = isCommunityValidationModuleId(
          latestFailedRun.moduleId
        );
        diagnostics.push({
          code: "latest_run_failed",
          detail:
            latestFailedRun.errorSummary ??
            "The latest validation run failed before it produced measured evidence.",
          href: `/missions/${latestFailedRun.missionId}`,
          severity: "Blocking",
          title: communityFailed
            ? "Latest Community validation needs recovery"
            : "Latest validation needs recovery"
        });
      }

      const nextLabels = {
        AccountCreated: "Open dashboard",
        SourceConnected: connectedSource ? "Review source" : "Connect a source",
        ScopeVerified: latestScope
          ? "Finish scope verification"
          : "Add a scope",
        PolicyPreviewed: "Preview mission policy",
        MissionCreated: "Create first mission",
        MeasuredResult: measuredRun
          ? "Review mission progress"
          : communityNextAction.label,
        RemediationCreated: "Route the smallest fix",
        Revalidated: "Run fresh verification",
        ProofDelivered: proofDeliveredAt
          ? "Review delivered proof"
          : "Deliver proof"
      } satisfies Record<
        ProductActivationState["milestones"][number]["key"],
        string
      >;

      return {
        completedMilestones: milestones.filter(
          (milestone) => milestone.state === "Completed"
        ).length,
        currentStage: current.stage,
        diagnostics,
        maturity,
        measuredAt: new Date().toISOString(),
        milestones,
        nextAction:
          current.key === "MeasuredResult" && !measuredRun
            ? communityNextAction
            : {
                href: current.href,
                label: nextLabels[current.key],
                reason: current.evidenceBasis
              },
        profile,
        totalMilestones: milestones.length
      };
    },

    async getProductWorkQueue(this: AppServices, context) {
      const tenantId = context.tenant.tenantId;
      const now = new Date();
      const [
        activation,
        findings,
        threatAlerts,
        approvals,
        overdue,
        failedRuns,
        readyForRetest,
        evidenceChain,
        schedules
      ] = await Promise.all([
        this.getProductActivationState(context),
        this.listValidatedFindings(context),
        this.listThreatAlerts(context, { status: "New" }),
        prisma.policyDecision.findMany({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
          where: { approvalState: "Pending", tenantId }
        }),
        prisma.remediationTask.findMany({
          orderBy: { dueAt: "asc" },
          select: { dueAt: true, remediationId: true },
          where: {
            dueAt: { lt: new Date() },
            status: { in: ["Open", "InProgress", "Reopened", "StillExposed"] },
            tenantId
          }
        }),
        prisma.validationRun.findMany({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
          where: { status: "Failed", tenantId }
        }),
        prisma.remediationTask.findMany({
          orderBy: { updatedAt: "asc" },
          select: { remediationId: true, updatedAt: true },
          where: { status: "VerificationPending", tenantId }
        }),
        this.verifyEvidenceChain(context),
        // Continuous validation program health (P14-19).
        prisma.missionSchedule.findMany({
          orderBy: { nextRunAt: "asc" },
          select: {
            lastDiff: true,
            lastRunAt: true,
            nextRunAt: true,
            scheduleId: true,
            status: true,
            updatedAt: true
          },
          where: { tenantId }
        })
      ]);
      // Monday taxonomy (server + client fallback must agree on these kinds).
      const noiseDisposition = new Set(["FalsePositive", "Suppressed"]);
      const newFindings = findings.filter(
        (finding) => finding.status === "New" && !finding.disposition
      );
      // Operational ownership only (ownerId / ownerDisplay). Disposition
      // AcceptedRisk acceptor must not clear UnownedFinding (P18-3). Escalated
      // assignees are already projected onto finding.ownerId by overlay.
      const priorityUnowned = findings.filter(
        (finding) =>
          finding.priorityScore >= 70 &&
          isUnownedValidatedFinding(finding) &&
          !noiseDisposition.has(finding.disposition?.disposition ?? "")
      );
      const pendingRiskApprovals = findings.filter(
        (finding) => finding.disposition?.approvalState === "Pending"
      );
      const prerequisites = activation.diagnostics.filter(
        (diagnostic) =>
          diagnostic.severity !== "Info" &&
          [
            "source_missing",
            "source_not_connected",
            "source_health_degraded",
            "scope_missing",
            "scope_verification_pending"
          ].includes(diagnostic.code)
      );
      const brokenLinks = evidenceChain.links.filter((link) => !link.valid);
      const items: ProductWorkQueue["items"] = [];
      const push = (item: ProductWorkQueue["items"][number] | null) => {
        if (item) items.push(item);
      };

      push(
        pendingRiskApprovals.length
          ? {
              count: pendingRiskApprovals.length,
              detail:
                "Accepted-risk dispositions wait for a second authorized reviewer before they settle.",
              href: "/findings?disposition=AcceptedRisk",
              itemId: "risk-approvals",
              kind: "Approval",
              oldestAt: pendingRiskApprovals[0]!.disposition?.updatedAt ?? null,
              stage: "Authorize",
              title: "Risk approvals waiting",
              urgency: "Now"
            }
          : null
      );
      push(
        approvals.length
          ? {
              count: approvals.length,
              detail:
                "A governed mission cannot proceed until an authorized reviewer records a decision.",
              href: "/policies?approvalState=Pending",
              itemId: "pending-approvals",
              kind: "Approval",
              oldestAt: approvals[0]!.createdAt.toISOString(),
              stage: "Authorize",
              title: "Policy approvals waiting",
              urgency: "Now"
            }
          : null
      );
      push(
        newFindings.length
          ? {
              count: newFindings.length,
              detail:
                "Validated findings without a disposition need triage before they age out of the Active queue.",
              href: "/findings?view=active",
              itemId: "new-findings",
              kind: "NewFinding",
              oldestAt:
                newFindings
                  .map(
                    (finding) =>
                      finding.firstSeenAt ??
                      finding.createdAt ??
                      finding.updatedAt
                  )
                  .filter((value): value is string => Boolean(value))
                  .sort()[0] ?? null,
              stage: "Understand",
              title: "New findings need disposition",
              urgency: "Soon"
            }
          : null
      );
      push(
        threatAlerts.length
          ? {
              count: threatAlerts.length,
              detail:
                "Correlated tenant threat alerts still marked New need acknowledgement or investigation.",
              href: "/threat-feed?status=New",
              itemId: "threat-alerts",
              kind: "ThreatAlert",
              oldestAt: threatAlerts[0]?.createdAt ?? null,
              stage: "Understand",
              title: "Threat alerts need acknowledgement",
              urgency: "Soon"
            }
          : null
      );
      push(
        failedRuns.length
          ? {
              count: failedRuns.length,
              detail:
                "These runs stopped before producing a complete measured result. Review the error and retry only after its prerequisite is resolved.",
              href: "/missions?status=Failed",
              itemId: "failed-runs",
              kind: "FailedRun",
              oldestAt: failedRuns[0]!.createdAt.toISOString(),
              stage: "Validate",
              title: "Failed validation runs",
              urgency: "Now"
            }
          : null
      );
      push(
        brokenLinks.length || !evidenceChain.valid
          ? {
              count: Math.max(1, brokenLinks.length),
              detail:
                evidenceChain.reason ??
                "Evidence integrity verification found a broken chain link.",
              href: "/evidence?integrity=failed",
              itemId: "evidence-integrity",
              kind: "EvidenceIntegrity",
              oldestAt: evidenceChain.verifiedAt,
              stage: "Prove",
              title: "Evidence chain needs review",
              urgency: "Now"
            }
          : null
      );
      push(
        overdue.length
          ? {
              count: overdue.length,
              detail:
                "These open remediations passed their target date without a fresh fixed verification.",
              href: "/remediation?view=overdue",
              itemId: "overdue-remediation",
              kind: "OverdueRemediation",
              oldestAt: overdue[0]!.dueAt?.toISOString() ?? null,
              stage: "Act",
              title: "Remediation is overdue",
              urgency: "Now"
            }
          : null
      );
      push(
        readyForRetest.length
          ? {
              count: readyForRetest.length,
              detail:
                "The implementation is marked ready; only fresh measured evidence can move it to fixed.",
              href: "/remediation?status=VerificationPending",
              itemId: "ready-for-retest",
              kind: "ReadyForRetest",
              oldestAt: readyForRetest[0]!.updatedAt.toISOString(),
              stage: "Verify",
              title: "Fixes ready for re-test",
              urgency: "Soon"
            }
          : null
      );
      push(
        priorityUnowned.length
          ? {
              count: priorityUnowned.length,
              detail:
                "High-priority measured or correlated findings have no recorded operational owner (remediation owner or non-AcceptedRisk assignee).",
              href: "/findings?view=priority-unowned",
              itemId: "priority-unowned",
              kind: "UnownedFinding",
              oldestAt:
                priorityUnowned
                  .map(
                    (finding) =>
                      finding.firstSeenAt ??
                      finding.createdAt ??
                      finding.updatedAt
                  )
                  .filter((value): value is string => Boolean(value))
                  .sort()[0] ?? null,
              stage: "Understand",
              title: "Priority findings need an owner",
              urgency: "Soon"
            }
          : null
      );
      push(
        prerequisites.length
          ? {
              count: prerequisites.length,
              detail: prerequisites.map((item) => item.title).join(" · "),
              href: activation.nextAction.href,
              itemId: "incomplete-prerequisites",
              kind: "Prerequisite",
              oldestAt: null,
              stage: activation.currentStage,
              title: "Proof inputs are incomplete",
              urgency: "Watch"
            }
          : null
      );

      const pausedSchedules = schedules.filter(
        (schedule) => schedule.status === "Paused"
      );
      const missedSchedules = schedules.filter(
        (schedule) =>
          schedule.status === "Active" && schedule.nextRunAt < now
      );
      const lastRunFailedSchedules = schedules.filter((schedule) => {
        const diff = schedule.lastDiff;
        if (!diff || typeof diff !== "object" || Array.isArray(diff)) {
          return false;
        }
        const record = diff as Record<string, unknown>;
        // Prefer explicit outcome/status from lastDiff; fall back to summary text.
        const outcome =
          typeof record.outcome === "string"
            ? record.outcome
            : typeof record.status === "string"
              ? record.status
              : null;
        if (
          outcome === "Failed" ||
          outcome === "Error" ||
          outcome === "RunFailed"
        ) {
          return true;
        }
        const summary =
          typeof record.summary === "string" ? record.summary.toLowerCase() : "";
        return summary.includes("failed") || summary.includes("error");
      });

      push(
        pausedSchedules.length
          ? {
              count: pausedSchedules.length,
              detail:
                "Paused schedules will not fire continuous validation until resumed. Review blackout windows and program intent.",
              href: "/schedules?status=Paused",
              itemId: "schedules-paused",
              kind: "SchedulePaused",
              oldestAt:
                pausedSchedules
                  .map((s) => s.updatedAt.toISOString())
                  .sort()[0] ?? null,
              stage: "Validate",
              title: "Schedules paused",
              urgency: "Soon"
            }
          : null
      );
      push(
        missedSchedules.length
          ? {
              count: missedSchedules.length,
              detail:
                "Active schedules have a next run in the past — the continuous validation window was missed or the runner is behind.",
              href: "/schedules?view=overdue",
              itemId: "schedules-missed-next-run",
              kind: "ScheduleMissedNextRun",
              oldestAt:
                missedSchedules
                  .map((s) => s.nextRunAt.toISOString())
                  .sort()[0] ?? null,
              stage: "Validate",
              title: "Schedules missed next run",
              urgency: "Now"
            }
          : null
      );
      push(
        lastRunFailedSchedules.length
          ? {
              count: lastRunFailedSchedules.length,
              detail:
                "The most recent scheduled run reported failure. Inspect lastDiff, fix the prerequisite, then resume or run now.",
              href: "/schedules?view=last-failed",
              itemId: "schedules-last-run-failed",
              kind: "ScheduleLastRunFailed",
              oldestAt:
                lastRunFailedSchedules
                  .map((s) => s.lastRunAt?.toISOString() ?? null)
                  .filter((value): value is string => Boolean(value))
                  .sort()[0] ?? null,
              stage: "Validate",
              title: "Schedule last run failed",
              urgency: "Now"
            }
          : null
      );

      // P14-16: total = queue categories; workUnits = sum of item counts.
      const workUnits = items.reduce((sum, item) => sum + item.count, 0);

      // P18-3/4: case-level feed (entity rows), not a re-list of category cards.
      const severityRank = (severity: string | undefined) => {
        switch (severity) {
          case "Critical":
            return 0;
          case "High":
            return 1;
          case "Medium":
            return 2;
          case "Low":
            return 3;
          default:
            return 4;
        }
      };
      const urgencyRank = (urgency: "Now" | "Soon" | "Watch") =>
        urgency === "Now" ? 0 : urgency === "Soon" ? 1 : 2;
      const feed: ProductWorkQueue["feed"] = [];
      const pushFeed = (row: ProductWorkQueue["feed"][number]) => {
        feed.push(row);
      };

      for (const finding of [...newFindings]
        .sort((a, b) => {
          const bySev =
            severityRank(a.severity) - severityRank(b.severity);
          if (bySev !== 0) return bySev;
          return (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
        })
        .slice(0, 8)) {
        pushFeed({
          at:
            finding.firstSeenAt ??
            finding.createdAt ??
            finding.updatedAt ??
            null,
          detail: `${finding.severity} · priority ${finding.priorityScore}`,
          feedId: `finding:${finding.findingId}`,
          href: `/findings/${finding.findingId}`,
          kind: "NewFinding",
          severity: finding.severity,
          stage: "Understand",
          title: finding.title,
          urgency: finding.priorityScore >= 70 ? "Now" : "Soon"
        });
      }

      for (const finding of pendingRiskApprovals.slice(0, 4)) {
        pushFeed({
          at: finding.disposition?.updatedAt ?? finding.updatedAt ?? null,
          detail: "Accepted-risk disposition awaits second reviewer.",
          feedId: `risk:${finding.findingId}`,
          href: `/findings/${finding.findingId}`,
          kind: "Approval",
          severity: finding.severity,
          stage: "Authorize",
          title: finding.title,
          urgency: "Now"
        });
      }

      for (const alert of threatAlerts.slice(0, 4)) {
        pushFeed({
          at: alert.createdAt ?? null,
          detail: `Match ${alert.matchType}: ${alert.matchedValue}`,
          feedId: `threat:${alert.tenantThreatAlertId}`,
          href: "/threat-feed?status=New",
          kind: "ThreatAlert",
          severity: alert.severity,
          stage: "Understand",
          title: alert.item?.title ?? "Threat alert",
          urgency: "Soon"
        });
      }

      for (const rem of readyForRetest.slice(0, 4)) {
        pushFeed({
          at: rem.updatedAt.toISOString(),
          detail: "Implementation ready — needs measured re-test.",
          feedId: `retest:${rem.remediationId}`,
          href: `/remediation/${rem.remediationId}`,
          kind: "ReadyForRetest",
          severity: null,
          stage: "Verify",
          title: rem.title || "Fix ready for re-test",
          urgency: "Soon"
        });
      }

      for (const rem of overdue.slice(0, 4)) {
        pushFeed({
          at: rem.dueAt?.toISOString() ?? null,
          detail: "Open remediation past due without fixed verification.",
          feedId: `overdue:${rem.remediationId}`,
          href: `/remediation/${rem.remediationId}`,
          kind: "OverdueRemediation",
          severity: null,
          stage: "Act",
          title: rem.title || "Remediation overdue",
          urgency: "Now"
        });
      }

      feed.sort((a, b) => {
        const byUrgency = urgencyRank(a.urgency) - urgencyRank(b.urgency);
        if (byUrgency !== 0) return byUrgency;
        const aAt = a.at ?? "";
        const bAt = b.at ?? "";
        return aAt.localeCompare(bAt);
      });

      return {
        feed: feed.slice(0, 20),
        generatedAt: new Date().toISOString(),
        items,
        total: items.length,
        workUnits
      };
    },

    async getBlueShiftBrief(this: AppServices, context) {
      const [queue, feedback] = await Promise.all([
        this.getProductWorkQueue(context),
        this.listDispositionFeedback(context)
      ]);

      const buckets: BlueShiftBrief["buckets"] = queue.items.map((item) => ({
        count: item.count,
        detail: item.detail,
        href: item.href,
        id: item.itemId,
        title: item.title,
        urgency: item.urgency
      }));

      if (buckets.length === 0) {
        buckets.push({
          count: 0,
          detail:
            "No open Needs-you categories. Continuous validation and disposition queues are clear.",
          href: "/dashboard#needs-you",
          id: "program-clear",
          title: "Program clear",
          urgency: "Clear"
        });
      }

      const falsePositiveByReason: BlueShiftBrief["falsePositiveByReason"] = [];
      for (const row of feedback.byReason ?? []) {
        if (row.reasonCode == null || row.reasonCode.length === 0) {
          continue;
        }
        falsePositiveByReason.push({
          count: row.count,
          reasonCode: row.reasonCode
        });
      }

      const totalActionable = queue.workUnits;
      const programNote =
        totalActionable === 0
          ? "Validated program health looks clear for this shift — keep continuous validation running and re-check after the next scheduled window."
          : `Focus first on Now urgency buckets (${queue.items.filter((i) => i.urgency === "Now").length} categories). Deep links open the exact proof-loop surface — not a SIEM wall.`;

      const brief: BlueShiftBrief = {
        buckets,
        falsePositiveByReason,
        generatedAt: new Date().toISOString(),
        programNote,
        totalActionable
      };
      return brief;
    },

    async updateProductExperienceProfile(context, input) {
      const completedAt = new Date();
      const membership = await prisma.membership.update({
        data: {
          experienceProfileCompletedAt: completedAt,
          primaryOutcome: input.primaryOutcome,
          productPersona: input.productPersona
        },
        where: { membershipId: context.membership.membershipId }
      });
      await writeAuditEvent(prisma, {
        action: "experience.profile_updated",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          primaryOutcome: input.primaryOutcome,
          productPersona: input.productPersona
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        completedAt:
          membership.experienceProfileCompletedAt?.toISOString() ?? null,
        membershipId: membership.membershipId,
        primaryOutcome: membership.primaryOutcome,
        productPersona: membership.productPersona,
        updatedAt: membership.updatedAt.toISOString()
      };
    },

    async submitProductFeedback(this: AppServices, context, input) {
      const tenantId = context.tenant.tenantId;
      if (input.missionId) {
        const missionExists = await prisma.validationMission.count({
          where: { missionId: input.missionId, tenantId }
        });
        if (!missionExists) {
          throw new AppServiceError(
            "The referenced mission does not belong to this tenant.",
            404,
            "mission_not_found"
          );
        }
      }
      if (input.evidencePackId) {
        const reportExists = await prisma.evidencePack.count({
          where: { evidencePackId: input.evidencePackId, tenantId }
        });
        if (!reportExists) {
          throw new AppServiceError(
            "The referenced evidence pack does not belong to this tenant.",
            404,
            "evidence_pack_not_found"
          );
        }
      }
      const activation = await this.getProductActivationState(context);
      const feedback = await prisma.productFeedback.create({
        data: {
          comment: input.comment?.trim() || null,
          evidencePackId: input.evidencePackId ?? null,
          maturity: activation.maturity,
          missionId: input.missionId ?? null,
          persona: activation.profile.productPersona,
          rating: input.rating ?? null,
          route: input.route,
          stage: input.stage,
          tenantId,
          userId: context.user.userId
        }
      });
      await writeAuditEvent(prisma, {
        action: "experience.feedback_submitted",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          feedbackId: feedback.feedbackId,
          maturity: feedback.maturity,
          rating: feedback.rating,
          route: feedback.route,
          stage: feedback.stage
        },
        tenantId,
        userId: context.user.userId
      });

      return {
        comment: feedback.comment,
        createdAt: feedback.createdAt.toISOString(),
        evidencePackId: feedback.evidencePackId,
        feedbackId: feedback.feedbackId,
        maturity: feedback.maturity,
        missionId: feedback.missionId,
        persona: feedback.persona,
        rating: feedback.rating,
        route: feedback.route,
        stage: feedback.stage,
        tenantId: feedback.tenantId,
        updatedAt: feedback.updatedAt.toISOString(),
        userId: feedback.userId
      };
    },

    async getBillingLimits(context) {
      // Use the canonical UTC billing month so this count matches /billing/usage.
      const { meteringPeriodEnd, meteringPeriodStart } = getMeteringPeriod();
      const [missionsThisMonth, runners, evidenceArtifacts] = await Promise.all(
        [
          prisma.validationMission.count({
            where: {
              createdAt: {
                gte: meteringPeriodStart,
                lt: meteringPeriodEnd
              },
              tenantId: context.tenant.tenantId
            }
          }),
          prisma.runner.count({
            where: {
              tenantId: context.tenant.tenantId
            }
          }),
          prisma.evidenceArtifact.count({
            where: {
              tenantId: context.tenant.tenantId
            }
          })
        ]
      );
      const limits = {
        evidenceArtifacts: parseOptionalLimitEnv(
          "PERISCAN_LIMIT_EVIDENCE_ARTIFACTS"
        ),
        missionsPerMonth: parseOptionalLimitEnv(
          "PERISCAN_LIMIT_MISSIONS_PER_MONTH"
        ),
        runners: parseOptionalLimitEnv("PERISCAN_LIMIT_RUNNERS")
      };
      const withinLimits =
        (limits.missionsPerMonth === null ||
          missionsThisMonth <= limits.missionsPerMonth) &&
        (limits.runners === null || runners <= limits.runners) &&
        (limits.evidenceArtifacts === null ||
          evidenceArtifacts <= limits.evidenceArtifacts);

      return {
        limits,
        usage: {
          evidenceArtifacts,
          missionsThisMonth,
          runners
        },
        withinLimits
      };
    },

    async listTenantMembers(context) {
      const rows = await prisma.membership.findMany({
        where: {
          tenantId: context.tenant.tenantId
        },
        include: {
          user: true
        },
        orderBy: {
          createdAt: "asc"
        }
      });

      return rows.map((row) => ({
        membership: serializeMembership(row),
        user: serializeUser(row.user)
      }));
    },

    async getTenantSafetySettings(context) {
      const tenant = await prisma.tenant.findUniqueOrThrow({
        where: { tenantId: context.tenant.tenantId }
      });
      return buildTenantSafetySettings(tenant);
    },

    async setOffensiveValidation(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "change offensive validation authorization"
      );
      await assertPrivilegedMfaStepUp(prisma, context, input.totpCode);

      const reference = input.authorizationReference?.trim();
      if (input.enabled && !reference) {
        throw new AppServiceError(
          "An authorization reference is required to enable offensive validation.",
          400,
          "authorization_reference_required"
        );
      }

      const now = new Date();
      const updated = await prisma.tenant.update({
        data: input.enabled
          ? {
              offensiveValidationAuthorizationRef: reference,
              offensiveValidationAuthorizedAt: now,
              offensiveValidationAuthorizedBy: context.user.userId,
              offensiveValidationEnabled: true
            }
          : {
              offensiveValidationAuthorizationRef: null,
              offensiveValidationAuthorizedAt: null,
              offensiveValidationAuthorizedBy: null,
              offensiveValidationEnabled: false
            },
        where: { tenantId: context.tenant.tenantId }
      });

      await writeAuditEvent(prisma, {
        action: "offensive_validation.changed",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          authorizationReference: input.enabled ? reference : null,
          enabled: input.enabled
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return buildTenantSafetySettings(updated);
    },

    async setDestructiveValidation(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "change destructive validation authorization"
      );
      await assertPrivilegedMfaStepUp(prisma, context, input.totpCode);

      const reference = input.authorizationReference?.trim();
      if (input.enabled && !reference) {
        throw new AppServiceError(
          "An authorization reference is required to enable destructive validation.",
          400,
          "authorization_reference_required"
        );
      }

      const now = new Date();
      const updated = await prisma.tenant.update({
        data: input.enabled
          ? {
              destructiveValidationAuthorizationRef: reference,
              destructiveValidationAuthorizedAt: now,
              destructiveValidationAuthorizedBy: context.user.userId,
              destructiveValidationEnabled: true
            }
          : {
              destructiveValidationAuthorizationRef: null,
              destructiveValidationAuthorizedAt: null,
              destructiveValidationAuthorizedBy: null,
              destructiveValidationEnabled: false
            },
        where: { tenantId: context.tenant.tenantId }
      });

      await writeAuditEvent(prisma, {
        action: "destructive_validation.changed",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          authorizationReference: input.enabled ? reference : null,
          enabled: input.enabled
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return buildTenantSafetySettings(updated);
    },

    async getTenantRequireMfa(context): Promise<TenantRequireMfaSettings> {
      // Any authenticated tenant member may read force-MFA policy (affects their
      // password session). Mutation remains admin-only.
      const tenant = await prisma.tenant.findUnique({
        where: { tenantId: context.tenant.tenantId }
      });
      if (!tenant) {
        throw new AppServiceError("Tenant not found.", 404, "tenant_not_found");
      }
      const envRequireMfa = isRequireMfaEnabled();
      return {
        envRequireMfa,
        effectiveRequireMfa: isMfaRequiredForPasswordAuth({
          envRequireMfa,
          tenantRequireMfa: tenant.requireMfa
        }),
        requireMfa: tenant.requireMfa
      };
    },

    async setTenantRequireMfa(
      context,
      input: SetTenantRequireMfaInput
    ): Promise<TenantRequireMfaSettings> {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "change tenant force-MFA policy"
      );
      await assertPrivilegedMfaStepUp(prisma, context, input.totpCode);

      const updated = await prisma.tenant.update({
        data: { requireMfa: input.enabled },
        where: { tenantId: context.tenant.tenantId }
      });

      await writeAuditEvent(prisma, {
        action: "tenant.updated",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          field: "requireMfa",
          requireMfa: input.enabled
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      const envRequireMfa = isRequireMfaEnabled();
      return {
        envRequireMfa,
        effectiveRequireMfa: isMfaRequiredForPasswordAuth({
          envRequireMfa,
          tenantRequireMfa: updated.requireMfa
        }),
        requireMfa: updated.requireMfa
      };
    },

    async updateTenantMemberRole(context, membershipId, role) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "manage tenant members"
      );

      // Serializable so concurrent demotions of distinct Owners cannot both
      // observe owners=2 and leave the tenant with zero Owners.
      const result = await prisma.$transaction(
        async (tx) => {
          const membership = await tx.membership.findFirst({
            where: {
              membershipId,
              tenantId: context.tenant.tenantId
            },
            include: {
              user: true
            }
          });

          if (!membership) {
            throw new AppServiceError(
              "Member not found.",
              404,
              "membership_not_found"
            );
          }

          assertCanAssignMembershipRole({
            actorRole: context.membership.role,
            newRole: role,
            previousRole: membership.role
          });

          if (membership.role === "Owner" && role !== "Owner") {
            const owners = await tx.membership.count({
              where: {
                role: "Owner",
                tenantId: context.tenant.tenantId
              }
            });

            if (owners <= 1) {
              throw new AppServiceError(
                "Cannot change the role of the last owner.",
                400,
                "last_owner"
              );
            }
          }

          const updated = await tx.membership.update({
            where: {
              membershipId: membership.membershipId
            },
            data: {
              role
            },
            include: {
              user: true
            }
          });

          await writeAuditEvent(tx, {
            action: "role.changed",
            actorType: "User",
            entityId: updated.membershipId,
            entityType: "Tenant",
            metadata: {
              previousRole: membership.role,
              role: updated.role,
              userId: updated.userId
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });

          return {
            membership: serializeMembership(updated),
            user: serializeUser(updated.user)
          };
        },
        { isolationLevel: "Serializable" }
      );

      return result;
    },

    async removeTenantMember(context, membershipId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "manage tenant members"
      );

      // Serializable: concurrent removals of the last two Owners must not both
      // pass a soft owners<=1 check and delete every Owner membership.
      await prisma.$transaction(
        async (tx) => {
          const membership = await tx.membership.findFirst({
            where: {
              membershipId,
              tenantId: context.tenant.tenantId
            }
          });

          if (!membership) {
            throw new AppServiceError(
              "Member not found.",
              404,
              "membership_not_found"
            );
          }

          // Same ownership boundary as role changes: Admin/ClientAdmin must not
          // be able to remove an Owner/MSSPOwner and seize control of the tenant.
          assertCanAssignMembershipRole({
            actorRole: context.membership.role,
            newRole: membership.role,
            previousRole: membership.role
          });

          if (membership.role === "Owner") {
            const owners = await tx.membership.count({
              where: {
                role: "Owner",
                tenantId: context.tenant.tenantId
              }
            });

            if (owners <= 1) {
              throw new AppServiceError(
                "Cannot remove the last owner.",
                400,
                "last_owner"
              );
            }
          }

          await tx.membership.delete({
            where: {
              membershipId: membership.membershipId
            }
          });

          await writeAuditEvent(tx, {
            action: "member.removed",
            actorType: "User",
            entityId: membership.membershipId,
            entityType: "Tenant",
            metadata: {
              role: membership.role,
              userId: membership.userId
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });
        },
        { isolationLevel: "Serializable" }
      );
    },

    async createAuditExport(context, input) {
      // API keys: audit:read capability (role may be Viewer). Session: Admin.
      requireAuditExportAccess(context, "export audit events");

      const where = buildAuditEventWhere(context.tenant.tenantId, input);
      const [events, totalCount] = await Promise.all([
        prisma.auditEvent.findMany({
          orderBy: {
            createdAt: "desc"
          },
          take: AUDIT_EXPORT_MAX_EVENTS,
          where
        }),
        prisma.auditEvent.count({
          where
        })
      ]);
      const serialized = events.map(serializeAuditEvent) as Array<
        Record<string, unknown>
      >;
      const completeness = buildAuditExportCompleteness({
        exportedCount: serialized.length,
        totalCount
      });
      const content =
        input.format === "csv"
          ? auditEventsToCsv(serialized)
          : JSON.stringify(serialized, null, 2);
      const evidenceService = createPrismaEvidenceService({
        prisma
      });
      const generatedAt = new Date().toISOString();
      const stored = await evidenceService.putEvidenceArtifact({
        artifactType: "ReportExport",
        content,
        contentType: input.format === "csv" ? "text/csv" : "application/json",
        filename: `audit-export-${generatedAt.slice(0, 10)}.${input.format}`,
        relatedEntityId: context.tenant.tenantId,
        relatedEntityType: "Tenant",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });

      await writeAuditEvent(prisma, {
        action: "report.generated",
        actorType: "User",
        entityId: stored.artifact.evidenceId,
        entityType: "Tenant",
        metadata: {
          auditFilters: {
            action: input.action ?? null,
            actorType: input.actorType ?? null,
            category: input.category ?? null,
            from: input.from ?? null,
            search: input.search ?? null,
            to: input.to ?? null
          },
          eventCount: completeness.eventCount,
          exportFormat: input.format,
          totalEventCount: completeness.totalEventCount,
          truncated: completeness.truncated
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        downloadPath: `/api/v1/audit-events/export/${stored.artifact.evidenceId}`,
        eventCount: completeness.eventCount,
        evidenceId: stored.artifact.evidenceId,
        exportId: stored.artifact.evidenceId,
        format: input.format,
        generatedAt,
        totalEventCount: completeness.totalEventCount,
        truncated: completeness.truncated
      };
    },

    async getAuditExport(context, exportId) {
      // API keys: audit:read capability (role may be Viewer). Session: Admin.
      requireAuditExportAccess(context, "download an audit export");

      const evidenceService = createPrismaEvidenceService({
        prisma
      });
      const stored = await evidenceService.getEvidenceArtifact(exportId);

      if (!stored || stored.artifact.tenantId !== context.tenant.tenantId) {
        return null;
      }

      let contentType = "application/json";

      try {
        JSON.parse(stored.content);
      } catch {
        contentType = "text/csv";
      }

      return {
        content: stored.content,
        contentType
      };
    },

    async checkReadiness() {
      const checks: ReadinessResponse["checks"] = [];

      const dbStartedAt = Date.now();
      try {
        await prisma.$queryRawUnsafe("SELECT 1");
        checks.push({
          detail: "Database reachable.",
          latencyMs: Date.now() - dbStartedAt,
          name: "database",
          status: "ok"
        });
      } catch (error) {
        checks.push({
          detail:
            error instanceof Error ? error.message : "Database query failed.",
          latencyMs: Date.now() - dbStartedAt,
          name: "database",
          status: "down"
        });
      }

      if (typeof missionQueue.checkHealth === "function") {
        const queueHealth = await missionQueue.checkHealth();
        checks.push({
          detail: queueHealth.detail,
          latencyMs: queueHealth.latencyMs,
          name: "queue",
          status: queueHealth.ok ? "ok" : "down"
        });
      } else {
        checks.push({
          detail: "Queue health check not available.",
          latencyMs: null,
          name: "queue",
          status: "skipped"
        });
      }

      const evidenceEndpoint = resolveEvidenceEndpointEnv(process.env);
      checks.push({
        detail: evidenceEndpoint
          ? "Evidence object storage configured."
          : "Evidence object storage not configured.",
        latencyMs: null,
        name: "evidence_store",
        status: evidenceEndpoint ? "ok" : "skipped"
      });

      // Continuous-validation sweep health — the engine of "continuous
      // validation". Surfaced as degraded (not down) when the last sweep had
      // per-runner failures, so operators see a stalling loop without the API
      // being marked not_ready over a background-job hiccup. Skipped until the
      // first sweep runs (e.g. the scheduler is off in tests).
      const lastSweep = getLastValidationSweep();
      if (!lastSweep) {
        checks.push({
          detail: "No continuous-validation sweep has run yet.",
          latencyMs: null,
          name: "validation_sweep",
          status: "skipped"
        });
      } else if (lastSweep.failures > 0) {
        const failingRunners = Object.entries(lastSweep.failuresByRunner)
          .filter(([, count]) => count > 0)
          .map(([runner, count]) => `${runner}:${count}`)
          .join(", ");
        checks.push({
          detail: `Last sweep (${lastSweep.ranAt}) had ${lastSweep.failures} runner failure(s): ${failingRunners}.`,
          latencyMs: null,
          name: "validation_sweep",
          status: "degraded"
        });
      } else {
        checks.push({
          detail: `Last sweep (${lastSweep.ranAt}) swept ${lastSweep.tenantsSwept} tenant(s) with no failures.`,
          latencyMs: null,
          name: "validation_sweep",
          status: "ok"
        });
      }

      // Only a hard "down" dependency blocks readiness; "degraded" surfaces a
      // warning while keeping the API ready (so a flaky background sweep never
      // 503s request traffic).
      const ready = checks.every((check) => check.status !== "down");

      return {
        checks,
        service: "api",
        status: ready ? "ready" : "not_ready",
        timestamp: new Date().toISOString()
      };
    },

    async getDeploymentStatus(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "read deployment status"
      );

      return buildDeploymentStatus();
    },

    async getClientPortfolio(context) {
      return buildMSSPClientPortfolio(prisma, context);
    },

    async listClientTenants(context) {
      requireRole(
        context.membership.role,
        MSSP_ADMIN_ROLES,
        "list MSSP client tenants"
      );

      if (context.tenant.type !== "MSSP") {
        return [];
      }

      const clients = await prisma.tenant.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          parentTenantId: context.tenant.tenantId,
          type: "Client"
        }
      });

      return clients.map(serializeTenant);
    },

    async createClientTenant(context, input) {
      requireRole(
        context.membership.role,
        MSSP_ADMIN_ROLES,
        "create MSSP client tenants"
      );

      if (context.tenant.type !== "MSSP") {
        throw new AppServiceError(
          "Only MSSP tenants can create client tenants.",
          400,
          "mssp_tenant_required"
        );
      }

      const selectedDataRegion = input.dataRegion ?? context.tenant.dataRegion;
      if (!availableDataRegions.includes(selectedDataRegion)) {
        throw new AppServiceError(
          `Data region ${selectedDataRegion} is not configured for this deployment.`,
          400,
          "data_region_unavailable"
        );
      }

      const result = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const tenant = await tx.tenant.create({
            data: {
              billingAccountId:
                input.billingAccountId ?? context.tenant.billingAccountId,
              dataRegion: selectedDataRegion,
              name: input.name,
              parentTenantId: context.tenant.tenantId,
              type: "Client"
            }
          });
          const msspMembership = await tx.membership.create({
            data: {
              role: "MSSPOwner",
              tenantId: tenant.tenantId,
              userId: context.user.userId
            }
          });
          let clientAdminMembership: PrismaMembership | null = null;
          let clientAdminUser: PrismaUser | null = null;

          if (input.clientAdminEmail) {
            const existingUser = await tx.user.findUnique({
              where: {
                email: input.clientAdminEmail
              }
            });
            clientAdminUser =
              existingUser ??
              (await tx.user.create({
                data: {
                  email: input.clientAdminEmail,
                  name: input.clientAdminName ?? input.clientAdminEmail,
                  passwordHash: null,
                  status: "Invited"
                }
              }));

            if (clientAdminUser.userId !== context.user.userId) {
              clientAdminMembership = await tx.membership.create({
                data: {
                  role: "ClientAdmin",
                  tenantId: tenant.tenantId,
                  userId: clientAdminUser.userId
                }
              });
            }
          }

          await writeAuditEvent(tx, {
            action: "tenant.created",
            actorType: "User",
            entityId: tenant.tenantId,
            entityType: "Tenant",
            metadata: {
              parentTenantId: context.tenant.tenantId,
              tenantName: tenant.name,
              tenantType: tenant.type
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });

          return {
            clientAdminMembership,
            clientAdminUser,
            msspMembership,
            tenant
          };
        }
      );

      return {
        clientAdminMembership: result.clientAdminMembership
          ? serializeMembership(result.clientAdminMembership)
          : null,
        clientAdminUser: result.clientAdminUser
          ? serializeUser(result.clientAdminUser)
          : null,
        msspMembership: serializeMembership(result.msspMembership),
        tenant: serializeTenant(result.tenant)
      };
    },

    async getTenantBranding(context) {
      return loadTenantReportBranding(prisma, context.tenant.tenantId);
    },

    async getDesignPartnerWorkspace(context) {
      return buildDesignPartnerWorkspace(prisma, context);
    },

    async appendDesignPartnerSessionNote(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "append design partner session notes"
      );
      return appendDesignPartnerSessionNote(prisma, context, input);
    },

    async getExecutiveTrends(this: AppServices, context) {
      const tenantId = context.tenant.tenantId;
      const [
        findings,
        attackPaths,
        remediations,
        verificationEvents,
        reports,
        evidenceArtifacts,
        scopes,
        integrations,
        missingSignals,
        deniedNeverQueuedCount
      ] = await Promise.all([
        this.listValidatedFindings(context),
        this.listAttackPaths(context),
        prisma.remediationTask.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId
          }
        }),
        prisma.verificationEvent.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId
          }
        }),
        prisma.evidencePack.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId
          }
        }),
        prisma.evidenceArtifact.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId
          }
        }),
        prisma.scope.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId
          }
        }),
        prisma.integration.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId
          }
        }),
        prisma.missingSignal.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId
          }
        }),
        // Fail-closed proof: Denied policy decisions never enter the queue.
        prisma.policyDecision.count({
          where: {
            outcome: "Denied",
            tenantId
          }
        })
      ]);

      const summary = buildExecutiveTrendSummary({
        attackPaths,
        deniedNeverQueuedCount,
        evidenceArtifacts: evidenceArtifacts.map(serializeEvidenceArtifact),
        findings,
        generatedAt: new Date().toISOString(),
        integrations: integrations.map(serializeIntegration),
        missingSignals: missingSignals.map(serializeMissingSignal),
        remediations: remediations.map(serializeRemediationTask),
        reports: reports.map(serializeEvidencePack),
        scopes: scopes.map(serializeScope),
        tenantId,
        verificationEvents: verificationEvents.map(serializeVerificationEvent)
      });

      // Capture-on-read: accumulate the trend TIME SERIES from real reads,
      // throttled to ~daily. This is what turns the delta-only summary into a
      // plottable history without any interpolation.
      await persistExecutiveSnapshot(tenantId, summary.metrics);

      return summary;
    },

    async captureExecutiveTrendSnapshot(this: AppServices, context) {
      const tenantId = context.tenant.tenantId;
      // Cheap throttle probe first so the scheduler doesn't run the full
      // executive query set every tick for every tenant when nothing is due.
      const latest = await prisma.executiveMetricSnapshot.findFirst({
        orderBy: { capturedAt: "desc" },
        select: { capturedAt: true },
        where: { tenantId }
      });
      if (
        latest &&
        Date.now() - latest.capturedAt.getTime() <
          EXECUTIVE_SNAPSHOT_INTERVAL_MS
      ) {
        return { captured: false };
      }
      // Due: getExecutiveTrends builds the summary and persists (throttle now
      // passes). Report whether it actually wrote.
      const summary = await this.getExecutiveTrends(context);
      const captured = await persistExecutiveSnapshot(
        tenantId,
        summary.metrics
      );
      return { captured };
    },

    async getExecutiveTrendSeries(context) {
      const tenantId = context.tenant.tenantId;
      const rows = await prisma.executiveMetricSnapshot.findMany({
        orderBy: { capturedAt: "asc" },
        where: { tenantId }
      });

      // Group points by metric, preserving the latest label/unit seen.
      const byMetric = new Map<
        string,
        {
          label: string;
          metricId: string;
          points: Array<{ capturedAt: string; value: number }>;
          unit: string;
        }
      >();
      for (const row of rows) {
        const existing = byMetric.get(row.metricId);
        const point = {
          capturedAt: row.capturedAt.toISOString(),
          value: row.value
        };
        if (existing) {
          existing.label = row.label;
          existing.unit = row.unit;
          existing.points.push(point);
        } else {
          byMetric.set(row.metricId, {
            label: row.label,
            metricId: row.metricId,
            points: [point],
            unit: row.unit
          });
        }
      }

      return {
        generatedAt: new Date().toISOString(),
        metrics: [...byMetric.values()],
        tenantId
      };
    },

    async getOperationalMetrics(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view tenant operational metrics"
      );

      const tenantId = context.tenant.tenantId;
      const generatedAt = new Date();
      const since = new Date(
        generatedAt.getTime() -
          OPERATIONAL_METRICS_WINDOW_DAYS * 24 * 60 * 60 * 1000
      );
      const [auditEvents, integrations, missions, policyDecisions] =
        await Promise.all([
          prisma.auditEvent.findMany({
            orderBy: {
              createdAt: "desc"
            },
            take: 500,
            where: {
              createdAt: {
                gte: since
              },
              tenantId
            }
          }),
          prisma.integration.findMany({
            orderBy: {
              createdAt: "desc"
            },
            where: {
              tenantId
            }
          }),
          prisma.validationMission.findMany({
            orderBy: {
              createdAt: "desc"
            },
            where: {
              tenantId
            }
          }),
          prisma.policyDecision.findMany({
            orderBy: {
              createdAt: "desc"
            },
            where: {
              createdAt: {
                gte: since
              },
              tenantId
            }
          })
        ]);

      return buildOperationalMetricsSummary({
        auditEvents: auditEvents.map(serializeAuditEvent),
        generatedAt: generatedAt.toISOString(),
        integrations: integrations.map(serializeIntegration),
        missions: missions.map(serializeValidationMission),
        policyDecisions: policyDecisions.map(serializePolicyDecision),
        tenantId
      });
    },

    async getTrustSafetySummary(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view trust and safety settings"
      );

      return buildTrustSafetySummary(prisma, context);
    },

    async updateTenantBranding(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "update report branding"
      );

      const branding = await prisma.tenantReportBranding.upsert({
        create: {
          logoUrl: input.logoUrl ?? null,
          organizationName: input.organizationName ?? null,
          primaryColor: input.primaryColor ?? null,
          reportFooter: input.reportFooter ?? null,
          supportEmail: input.supportEmail ?? null,
          tenantId: context.tenant.tenantId,
          whiteLabelEnabled: input.whiteLabelEnabled
        },
        update: {
          logoUrl: input.logoUrl ?? null,
          organizationName: input.organizationName ?? null,
          primaryColor: input.primaryColor ?? null,
          reportFooter: input.reportFooter ?? null,
          supportEmail: input.supportEmail ?? null,
          whiteLabelEnabled: input.whiteLabelEnabled
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "tenant.updated",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          field: "reportBranding",
          whiteLabelEnabled: branding.whiteLabelEnabled
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeTenantReportBranding(branding);
    },

    async updateDesignPartnerSettings(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "update design partner settings"
      );

      const settings = await prisma.tenantDesignPartnerSettings.upsert({
        create: {
          enabled: input.enabled,
          tenantId: context.tenant.tenantId
        },
        update: {
          enabled: input.enabled
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "tenant.updated",
        actorType: "User",
        entityId: context.tenant.tenantId,
        entityType: "Tenant",
        metadata: {
          designPartnerEnabled: settings.enabled,
          field: "designPartnerSettings"
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeTenantDesignPartnerSettings(settings);
    },

    async getBillingMeters(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view billing meters"
      );

      return USAGE_METER_DEFINITIONS;
    },

    async getBillingPackages(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view billing packages"
      );

      return BILLING_PACKAGE_CATALOG;
    },

    async getBillingUsage(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view billing usage"
      );

      return buildBillingUsage(prisma, context.tenant);
    },

    // The tenant's active subscription package (resolved against the catalog),
    // or null when unsubscribed. The decision source for entitlement checks.
    async getActiveBillingPackage(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view billing package"
      );

      const tenant = await expireTenantTrialIfNeeded(
        prisma,
        context.tenant.tenantId
      );
      const key = tenant?.billingPackageKey ?? null;

      return (
        BILLING_PACKAGE_CATALOG.find((pkg) => pkg.packageKey === key) ?? null
      );
    },

    async inviteToCurrentTenant(context, input) {
      requireRole(context.membership.role, INVITE_ROLES, "invite users");
      assertCanAssignMembershipRole({
        actorRole: context.membership.role,
        newRole: input.role
      });

      const result = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const existingUser = await tx.user.findUnique({
            where: {
              email: input.email
            }
          });

          const user =
            existingUser ??
            (await tx.user.create({
              data: {
                email: input.email,
                name: input.name,
                passwordHash: null,
                status: "Invited"
              }
            }));

          const existingMembership = await tx.membership.findUnique({
            where: {
              tenantId_userId: {
                tenantId: context.tenant.tenantId,
                userId: user.userId
              }
            }
          });

          if (existingMembership) {
            throw new AppServiceError(
              "The user is already a member of the current tenant.",
              409,
              "membership_exists"
            );
          }

          const membership = await tx.membership.create({
            data: {
              role: input.role,
              tenantId: context.tenant.tenantId,
              userId: user.userId
            }
          });

          // A brand-new (never-activated) user needs to set a password before
          // they can sign in. Mint a single-use Invite token, delivered by the
          // accept-invite email below. An existing user already has credentials,
          // so they only get a notification that they were added to the tenant.
          const needsActivation = !user.passwordHash;
          let rawToken: string | null = null;
          if (needsActivation) {
            rawToken = randomBytes(32).toString("hex");
            await tx.userToken.create({
              data: {
                expiresAt: new Date(Date.now() + INVITE_TOKEN_TTL_MS),
                purpose: "Invite",
                tokenHash: hashSecret(rawToken),
                userId: user.userId
              }
            });
          }

          await writeAuditEvent(tx, {
            action: "user.invited",
            actorType: "User",
            entityId: user.userId,
            entityType: "Tenant",
            metadata: {
              email: user.email,
              role: membership.role
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });

          return {
            membership,
            rawToken,
            user
          };
        }
      );

      // Send the invite/notification email AFTER the transaction commits so a
      // mail outage never rolls back the membership. Best-effort, mirroring the
      // webhook emitter: a delivery failure is logged, not fatal.
      try {
        if (result.rawToken) {
          const acceptUrl = `${webBaseUrl}/accept-invite?token=${result.rawToken}`;
          await emailTransport.send({
            subject: `You've been invited to ${context.tenant.name} on Periscan`,
            text: [
              `Hi ${result.user.name},`,
              "",
              `${context.user.name} invited you to join "${context.tenant.name}" on`,
              "Periscan. Use the link below to set your password and activate your",
              "account. It expires in 7 days.",
              "",
              acceptUrl
            ].join("\n"),
            to: result.user.email
          });
        } else {
          await emailTransport.send({
            subject: `You've been added to ${context.tenant.name} on Periscan`,
            text: [
              `Hi ${result.user.name},`,
              "",
              `${context.user.name} added you to "${context.tenant.name}" on Periscan.`,
              "Sign in with your existing Periscan account to access it.",
              "",
              `${webBaseUrl}/`
            ].join("\n"),
            to: result.user.email
          });
        }
      } catch (error) {
        console.error(
          `[invite] failed to send invite email to ${result.user.email}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      return {
        membership: serializeMembership(result.membership),
        user: serializeUser(result.user)
      };
    },

    async listAuditEvents(context, input) {
      // Session users: any authenticated membership may list. API keys need
      // audit:read (or admin expansion) so automation least privilege holds.
      requireApiKeyCapability(context, "audit:read", "list audit events");

      const events = await prisma.auditEvent.findMany({
        orderBy: {
          createdAt: "desc"
        },
        skip: input.offset ?? 0,
        take: input.limit,
        where: buildAuditEventWhere(context.tenant.tenantId, input)
      });

      return events.map(serializeAuditEvent);
    }
  };
}
