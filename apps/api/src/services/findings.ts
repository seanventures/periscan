// @ts-nocheck
import { EvidencePackType, Prisma } from "@prisma/client";
import {
  generateDynamicPathMissionRecommendation,
  type DynamicPathMissionRecommendation
} from "@periscan/operators";
import type {
  ApplyPathEdgeReceiptInput,
  ApplyPathEdgeReceiptResult,
  AssetValuationInput,
  AttackPath,
  AttackPathChokePoint,
  AttackPathMeasurementState,
  AttackPathValidationPlan,
  DispositionFeedbackSummary,
  FindingDispositionOverride,
  LaunchPathEdgeValidationInput,
  PathEdgeReceipt,
  PathEdgeValidationLaunchResult,
  ValidatedFinding
} from "@periscan/shared";
import {
  PathEdgeReceiptSchema,
  ApplyPathEdgeReceiptResultSchema,
  AttackPathMeasurementStateSchema,
  AttackPathValidationPlanSchema,
  PathEdgeValidationLaunchResultSchema,
  findingDispositionFingerprintKey,
  fingerprintFromDispositionKey,
  formatFindingDispositionNote,
  isFindingDispositionFingerprintKey,
  parseFindingDispositionReasonCode
} from "@periscan/shared";
import {
  buildAttackPathValidationPlan,
  computeChokePointAnalysis,
  deriveAttackPathMeasurementState,
  hopKeyForPathEdge,
  recomputeAttackPathFromReceipts,
  resolvePathEdgeReceiptValidationState,
  SAFE_HOP_PROBE_MODULES
} from "@periscan/evidence";
import {
  findingsToSarif,
  toSarifFindingInput,
  type FindingSarifSource,
  type SarifLog
} from "@periscan/reports";

import { serializeMissingSignal } from "../serializers/threat-center.js";
import { withPathEdgeReceiptLock } from "../path-receipt-lock.js";
// Helpers + AppServices/RuntimeServiceDeps types from runtime-services. The value
// imports are hoisted top-level functions used only at call time, so the
// resulting runtime import cycle is benign (factory runs inside
// createRuntimeServices, never at module evaluation).
import {
  assessAttackPathsWithFinancialExposure,
  AppServiceError,
  buildValidatedFindings,
  ensureCorrelatedAttackPathsForTenant,
  filterValidatedFindings,
  requireRole,
  serializeEvidenceArtifact,
  serializeAsset,
  serializeRemediationTask,
  serializeSignalEnvelope,
  writeAuditEvent,
  SCOPE_EDITOR_ROLES
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

const SAFE_HOP_MODULE_SET = new Set<string>(
  Object.values(SAFE_HOP_PROBE_MODULES)
);

const IDENTITY_IMPORT_MODULE_ID = SAFE_HOP_PROBE_MODULES.identityGraphImport;

type MissionEvidenceStore = {
  validationRun: {
    findMany: (args: {
      select: { evidenceIds: true };
      where: { missionId: string; tenantId: string };
    }) => Promise<Array<{ evidenceIds: string[] }>>;
  };
};

/** Keep a finding when any of its evidence ids is on the mission's runs. */
export function filterFindingsByMissionEvidence<
  T extends { evidenceIds: string[] }
>(findings: T[], missionEvidenceIds: readonly string[]): T[] {
  if (missionEvidenceIds.length === 0) {
    return [];
  }

  const allowed = new Set(missionEvidenceIds);
  return findings.filter((finding) =>
    finding.evidenceIds.some((evidenceId) => allowed.has(evidenceId))
  );
}

/** Tenant-scoped union of validationRun.evidenceIds for one mission. */
export async function loadTenantMissionEvidenceIds(
  prisma: MissionEvidenceStore,
  input: { missionId: string; tenantId: string }
): Promise<string[]> {
  const runs = await prisma.validationRun.findMany({
    select: { evidenceIds: true },
    where: {
      missionId: input.missionId,
      tenantId: input.tenantId
    }
  });

  return [...new Set(runs.flatMap((run) => run.evidenceIds))];
}

/**
 * Community-legal SARIF 2.1.0 for later API wiring (`format=sarif`).
 * Evidence-backed rows only; imported scan sources stay Imported; Fixed is
 * pass only when the finding carries measured re-validation.
 */
export function toSarif(
  findings: ReadonlyArray<FindingSarifSource | ValidatedFinding>
): SarifLog {
  return findingsToSarif(
    findings.map((finding) => toSarifFindingInput(finding))
  );
}

export { findingsToSarif };

/**
 * After a hop-bound validation run completes with evidence, auto-apply a path
 * edge receipt so Measure hop is not API-only theater (P05-1).
 * Identity graph import never upgrades to Measured (P05-4).
 */
export async function tryAutoApplyPathEdgeReceiptFromCompletedRun(
  prisma: RuntimeServiceDeps["prisma"],
  input: {
    actor?: string | null;
    evidenceIds: string[];
    missionId: string;
    moduleId: string;
    outcome: string | null;
    runId: string;
    target: unknown;
    tenantId: string;
    validationState: string | null;
  }
): Promise<{ applied: boolean; reason: string }> {
  if (!input.evidenceIds.length) {
    return { applied: false, reason: "no_evidence" };
  }
  if (!input.target || typeof input.target !== "object" || Array.isArray(input.target)) {
    return { applied: false, reason: "not_hop_bound" };
  }
  const target = input.target as Record<string, unknown>;
  const pathId =
    typeof target.attackPathId === "string"
      ? target.attackPathId
      : typeof target.pathId === "string"
        ? target.pathId
        : null;
  const pathEdgeId =
    typeof target.pathEdgeId === "string" ? target.pathEdgeId : null;
  const hopKey =
    typeof target.hopKey === "string" ? target.hopKey : null;
  if (!pathId || !pathEdgeId) {
    return { applied: false, reason: "not_hop_bound" };
  }

  const paths = await ensureCorrelatedAttackPathsForTenant(
    prisma,
    input.tenantId
  );
  const path = paths.find((candidate) => candidate.pathId === pathId);
  if (!path) {
    return { applied: false, reason: "path_not_found" };
  }
  const edge = path.pathEdges.find(
    (candidate) => candidate.pathEdgeId === pathEdgeId
  );
  if (!edge) {
    return { applied: false, reason: "edge_not_found" };
  }
  const resolvedHopKey =
    hopKey ??
    hopKeyForPathEdge(edge, path.pathNodes) ??
    `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`;

  // Identity import is Heuristic-only; never mint Measured from graph import.
  const isIdentityImport = input.moduleId === IDENTITY_IMPORT_MODULE_ID;
  const validationState = isIdentityImport
    ? "Inconclusive"
    : (input.validationState ?? "Inconclusive");
  const outcome =
    input.outcome ??
    (isIdentityImport ? "identity_graph_imported" : "hop_probe_completed");

  const measuredAt = new Date();
  // Lock with correlation refresh so snapshot→deleteMany cannot cascade-wipe
  // this create. Refresh preserves pathEdgeId by hopKey, so the edge id from
  // ensure remains valid under the lock when the hop still exists.
  return withPathEdgeReceiptLock(prisma, pathId, async (tx) => {
    const liveEdge = await tx.pathEdge.findFirst({
      where: { pathEdgeId, pathId, tenantId: input.tenantId }
    });
    if (!liveEdge) {
      return { applied: false, reason: "edge_not_found" };
    }

    const created = await tx.pathEdgeReceipt.create({
      data: {
        actor: input.actor ?? "system:auto-apply",
        evidenceIds: input.evidenceIds,
        hopKey: resolvedHopKey,
        integrityHash: null,
        measuredAt,
        measurementMethod: isIdentityImport
          ? "identity-graph-import"
          : "hop-probe-auto",
        missionId: input.missionId,
        moduleId: input.moduleId,
        outcome,
        pathEdgeId,
        pathId,
        policyDecisionId: null,
        tenantId: input.tenantId,
        validationRunId: input.runId,
        validationState
      }
    });

    const allReceiptRows = await tx.pathEdgeReceipt.findMany({
      orderBy: { measuredAt: "desc" },
      where: { pathId, tenantId: input.tenantId }
    });
    const allReceipts = allReceiptRows.map(serializePathEdgeReceipt);
    const recomputed = recomputeAttackPathFromReceipts({
      applyToPathEdgeIds: [pathEdgeId],
      path,
      receipts: allReceipts
    });
    const updatedEdge = recomputed.pathEdges.find(
      (candidate) => candidate.pathEdgeId === pathEdgeId
    )!;

    await tx.pathEdge.update({
      data: {
        evidenceBasis: updatedEdge.evidenceBasis,
        evidenceIds: updatedEdge.evidenceIds,
        measurementMethod: updatedEdge.measurementMethod ?? null
      },
      where: { pathEdgeId }
    });
    await tx.attackPath.update({
      data: {
        evidenceBasis: recomputed.evidenceBasis,
        evidenceIds: recomputed.evidenceIds,
        // Wave A3: claim-safe validationState from receipts only.
        validationState: recomputed.validationState
      },
      where: { pathId }
    });

    await writeAuditEvent(tx, {
      action: "verification.run",
      actorType: "System",
      entityId: created.receiptId,
      entityType: "AttackPath",
      metadata: {
        hopKey: resolvedHopKey,
        measurementMethod: isIdentityImport
          ? "identity-graph-import"
          : "hop-probe-auto",
        missionId: input.missionId,
        moduleId: input.moduleId,
        outcome,
        pathEdgeId,
        pathId,
        pathValidationState: recomputed.validationState,
        receiptId: created.receiptId,
        surface: "tryAutoApplyPathEdgeReceiptFromCompletedRun",
        validationRunId: input.runId,
        validationState
      },
      tenantId: input.tenantId,
      userId: null
    });

    return { applied: true, reason: "applied" };
  });
}

/**
 * True when a validation run / policy target is bound to this hop.
 * Edge id match is preferred; hopKey + attackPathId covers edge rewrites.
 * Bare attackPathId alone is NOT enough (would let a different hop forge).
 */
function targetLinksToPathEdge(
  target: unknown,
  pathId: string,
  edgeId: string,
  hopKey: string
): boolean {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    return false;
  }
  const record = target as Record<string, unknown>;
  const attackPathId =
    typeof record.attackPathId === "string" ? record.attackPathId : null;
  const pathEdgeId =
    typeof record.pathEdgeId === "string" ? record.pathEdgeId : null;
  const targetHopKey =
    typeof record.hopKey === "string" ? record.hopKey : null;

  if (pathEdgeId === edgeId) {
    if (attackPathId && attackPathId !== pathId) {
      return false;
    }
    return true;
  }

  return (
    attackPathId === pathId &&
    targetHopKey !== null &&
    targetHopKey === hopKey
  );
}

function serializePathEdgeReceipt(record: {
  actor: string | null;
  evidenceIds: string[];
  hopKey: string;
  integrityHash: string | null;
  measuredAt: Date;
  measurementMethod: string;
  missionId: string | null;
  moduleId: string;
  outcome: string;
  pathEdgeId: string;
  pathId: string;
  policyDecisionId: string | null;
  receiptId: string;
  tenantId: string;
  validationRunId: string | null;
  validationState: PathEdgeReceipt["validationState"];
}): PathEdgeReceipt {
  return PathEdgeReceiptSchema.parse({
    actor: record.actor,
    evidenceIds: record.evidenceIds,
    hopKey: record.hopKey,
    integrityHash: record.integrityHash,
    measuredAt: record.measuredAt.toISOString(),
    measurementMethod: record.measurementMethod,
    missionId: record.missionId,
    moduleId: record.moduleId,
    outcome: record.outcome,
    pathEdgeId: record.pathEdgeId,
    pathId: record.pathId,
    policyDecisionId: record.policyDecisionId,
    receiptId: record.receiptId,
    tenantId: record.tenantId,
    validationRunId: record.validationRunId,
    validationState: record.validationState
  });
}

const NON_SNAPSHOT_PACK_TYPES = [
  EvidencePackType.ControlValidationReport,
  EvidencePackType.AIAppValidationReport,
  EvidencePackType.FixVerificationReport
] as const;

interface NonSnapshotPackBacklink {
  evidencePackId: string;
  packType: EvidencePackType;
  scheduleId?: string;
}

type AttackPathWithNonSnapshotPack = AttackPath & {
  nonSnapPack?: NonSnapshotPackBacklink;
};

function asJsonRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function readEvidencePackIdFromDiff(value: Prisma.JsonValue | null) {
  const diff = asJsonRecord(value);
  const packInfo = asJsonRecord(diff.packInfo);
  const directPackId = diff.evidencePackId;
  const nestedPackId = packInfo.evidencePackId;

  return typeof directPackId === "string"
    ? directPackId
    : typeof nestedPackId === "string"
      ? nestedPackId
      : null;
}

async function loadNonSnapshotBacklinks(
  prisma: RuntimeServiceDeps["prisma"],
  tenantId: string,
  packTypes: readonly EvidencePackType[] = NON_SNAPSHOT_PACK_TYPES
) {
  const [packs, schedules] = await Promise.all([
    prisma.evidencePack.findMany({
      select: { evidenceIds: true, evidencePackId: true, packType: true },
      where: {
        packType: {
          in: [...packTypes]
        },
        tenantId
      }
    }),
    prisma.missionSchedule.findMany({
      select: { lastDiff: true, scheduleId: true },
      where: {
        lastDiff: { not: Prisma.DbNull },
        tenantId
      }
    })
  ]);

  const scheduleIdByPackId = new Map<string, string>();
  for (const schedule of schedules) {
    const evidencePackId = readEvidencePackIdFromDiff(schedule.lastDiff);
    if (evidencePackId) {
      scheduleIdByPackId.set(evidencePackId, schedule.scheduleId);
    }
  }

  const backlinkByEvidenceId = new Map<string, NonSnapshotPackBacklink>();
  for (const pack of packs) {
    for (const evidenceId of pack.evidenceIds) {
      if (!backlinkByEvidenceId.has(evidenceId)) {
        backlinkByEvidenceId.set(evidenceId, {
          evidencePackId: pack.evidencePackId,
          packType: pack.packType,
          scheduleId: scheduleIdByPackId.get(pack.evidencePackId)
        });
      }
    }
  }

  return backlinkByEvidenceId;
}

function attachNonSnapshotBacklinks(
  paths: AttackPath[],
  backlinkByEvidenceId: Map<string, NonSnapshotPackBacklink>
): AttackPathWithNonSnapshotPack[] {
  return paths.map((path) => {
    const matchingEvidenceId = path.evidenceIds.find((evidenceId) =>
      backlinkByEvidenceId.has(evidenceId)
    );
    const nonSnapPack = matchingEvidenceId
      ? backlinkByEvidenceId.get(matchingEvidenceId)
      : undefined;

    const enriched = nonSnapPack
      ? {
          ...path,
          nonSnapPack
        }
      : { ...path, nonSnapPack: undefined };

    return enriched;
  }) as AttackPathWithNonSnapshotPack[];
}

function serializeDispositionRow(row: {
  approvedAt: Date | null;
  approvedBy: string | null;
  disposition: string;
  expiresAt: Date | null;
  findingId: string;
  note: string | null;
  ownerId: string | null;
  updatedAt: Date;
  updatedBy: string;
}): FindingDispositionOverride {
  const nowMs = Date.now();
  const expired =
    Boolean(row.expiresAt) && (row.expiresAt as Date).getTime() <= nowMs;
  const approvalState: FindingDispositionOverride["approvalState"] =
    row.disposition === "AcceptedRisk"
      ? expired
        ? "Expired"
        : row.approvedAt
          ? "Approved"
          : "Pending"
      : row.disposition === "Suppressed" && expired
        ? "Expired"
        : "NotRequired";
  const fingerprint = fingerprintFromDispositionKey(row.findingId);
  return {
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy ?? null,
    approvalState,
    disposition: row.disposition as FindingDispositionOverride["disposition"],
    expiresAt: row.expiresAt?.toISOString() ?? null,
    note: row.note ?? null,
    ownerId: row.ownerId ?? null,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    inheritedFromFingerprint: false,
    fingerprint
  };
}

// Load analyst disposition overlays for a tenant, keyed by the derived finding
// id (stable pathId/signalId) plus fingerprint keys (`fp:…`) so group absorb
// cannot orphan triage (P06-17). Expired Suppressed rows are cleared on read
// (P18-16 snooze/revisit) without claiming Fixed.
async function loadFindingDispositions(
  prisma: RuntimeServiceDeps["prisma"],
  tenantId: string
): Promise<{
  byFindingId: Map<string, FindingDispositionOverride>;
  byFingerprint: Map<string, FindingDispositionOverride>;
}> {
  const rows = await prisma.findingDisposition.findMany({
    where: { tenantId }
  });
  const byFindingId = new Map<string, FindingDispositionOverride>();
  const byFingerprint = new Map<string, FindingDispositionOverride>();
  const expiredSuppressedIds: string[] = [];

  for (const row of rows) {
    const isFingerprintKey = isFindingDispositionFingerprintKey(row.findingId);
    const expired =
      Boolean(row.expiresAt) && row.expiresAt!.getTime() <= Date.now();
    // P18-16: snoozed Suppressed past revisit → clear, do not claim Fixed.
    if (row.disposition === "Suppressed" && expired) {
      expiredSuppressedIds.push(row.findingDispositionId);
      continue;
    }
    const override = serializeDispositionRow(row);
    if (isFingerprintKey) {
      const fingerprint = fingerprintFromDispositionKey(row.findingId);
      if (fingerprint) {
        byFingerprint.set(fingerprint, {
          ...override,
          fingerprint,
          inheritedFromFingerprint: false
        });
      }
      continue;
    }
    byFindingId.set(row.findingId, override);
  }

  if (expiredSuppressedIds.length > 0) {
    await prisma.findingDisposition.deleteMany({
      where: {
        findingDispositionId: { in: expiredSuppressedIds },
        tenantId
      }
    });
  }

  return { byFindingId, byFingerprint };
}

function overlayDispositions(
  findings: ValidatedFinding[],
  dispositions: {
    byFindingId: Map<string, FindingDispositionOverride>;
    byFingerprint: Map<string, FindingDispositionOverride>;
  }
): ValidatedFinding[] {
  if (dispositions.byFindingId.size === 0 && dispositions.byFingerprint.size === 0) {
    return findings;
  }
  return findings.map((finding) => {
    let override = dispositions.byFindingId.get(finding.findingId) ?? null;
    let inherited = false;
    if (!override && finding.fingerprint) {
      const byFp = dispositions.byFingerprint.get(finding.fingerprint);
      if (byFp) {
        override = {
          ...byFp,
          inheritedFromFingerprint: true,
          fingerprint: finding.fingerprint
        };
        inherited = true;
      }
    }
    if (!override) {
      return finding;
    }
    // Expired AcceptedRisk keeps the overlay but reopens for triage narrative.
    if (override.approvalState === "Expired" && override.disposition === "Suppressed") {
      return {
        ...finding,
        disposition: null,
        status: !["Fixed", "Revalidated"].includes(finding.status)
          ? "Reopened"
          : finding.status
      };
    }

    // P06-3: non-AcceptedRisk disposition assignees are operational owners for
    // Priority · unowned / My queue. Do not overwrite remediation-projected
    // ownerId/ownerDisplay. AcceptedRisk ownerId remains acceptor-only (P18-3).
    const operationalOwnerId =
      !finding.ownerId &&
      !finding.ownerDisplay?.trim() &&
      override.ownerId &&
      override.disposition !== "AcceptedRisk"
        ? override.ownerId
        : finding.ownerId;

    return {
      ...finding,
      disposition: {
        ...override,
        inheritedFromFingerprint: inherited || Boolean(override.inheritedFromFingerprint),
        fingerprint: override.fingerprint ?? finding.fingerprint ?? null
      },
      ...(operationalOwnerId && operationalOwnerId !== finding.ownerId
        ? { ownerId: operationalOwnerId }
        : {}),
      status:
        override.approvalState === "Expired" &&
        !["Fixed", "Revalidated"].includes(finding.status)
          ? "Reopened"
          : finding.status
    };
  });
}

// Findings & attack-path service group (D1 Phase 2 closure decomposition):
// the unified validated-findings queue and attack-path reads. Pure reads over
// persisted state plus correlation; uses only `prisma` from the shared deps.
function measuredHopWeight(path: {
  pathEdges: Array<{ evidenceBasis?: string; evidenceIds: string[] }>;
}): number {
  const edges = path.pathEdges ?? [];
  if (edges.length === 0) {
    return 1;
  }
  const measured = edges.filter(
    (edge) =>
      edge.evidenceBasis === "Measured" && (edge.evidenceIds?.length ?? 0) > 0
  ).length;
  // Heuristic paths still count (weight 1); fully measured paths weight 2 so
  // breakers on proven hops rank higher — still greedy, never exact min-cut.
  return 1 + measured / edges.length;
}

export function createFindingsServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "getAttackPath"
  | "getAttackPathChokePointAnalysis"
  | "getAttackPathNextMission"
  | "approveAttackPathNextMission"
  | "getAttackPathValidationPlan"
  | "getAttackPathMeasurementState"
  | "getValidatedFinding"
  | "approveFindingRisk"
  | "listAttackPathEvidence"
  | "listAttackPathEdgeReceipts"
  | "listAttackPaths"
  | "listAssets"
  | "listDispositionFeedback"
  | "listValidatedFindings"
  | "applyPathEdgeReceipt"
  | "launchPathEdgeValidation"
  | "requestAttackPathVerification"
  | "transitionFinding"
  | "updateAssetValuation"
> {
  const { emitTenantWebhook, prisma } = deps;

  return {
    async getAttackPathChokePointAnalysis(context) {
      const paths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const pathById = new Map(paths.map((path) => [path.pathId, path]));
      const nodesByEntityId = new Map<
        string,
        Array<(typeof paths)[number]["pathNodes"][number]>
      >();

      for (const path of paths) {
        for (const node of path.pathNodes) {
          const occurrences = nodesByEntityId.get(node.entityId) ?? [];
          occurrences.push(node);
          nodesByEntityId.set(node.entityId, occurrences);
        }
      }

      const analysis = computeChokePointAnalysis(
        paths.map((path) => ({
          nodeIds: [...path.pathNodes]
            .sort((left, right) => left.sequence - right.sequence)
            .map((node) => node.entityId),
          pathId: path.pathId,
          // Evidence-weighted ranking: measured hop fraction biases cover scores.
          weight: measuredHopWeight(path)
        })),
        {
          excludeObjectives: true,
          excludeOrigins: true
        }
      );

      const enrich = (nodeId: string): AttackPathChokePoint => {
        const ranked = analysis.chokePoints.find(
          (candidate) => candidate.nodeId === nodeId
        );
        const pathIds = ranked?.pathIds ?? [];
        const matchingPaths = pathIds
          .map((pathId) => pathById.get(pathId))
          .filter((path): path is (typeof paths)[number] => Boolean(path));
        const evidenceBases = new Set(
          matchingPaths.map((path) => path.evidenceBasis)
        );
        const occurrences = nodesByEntityId.get(nodeId) ?? [];

        return {
          betweenness: ranked?.betweenness ?? 0,
          evidenceBasis:
            evidenceBases.size > 1
              ? "Mixed"
              : (matchingPaths[0]?.evidenceBasis ?? "Heuristic"),
          evidenceIds: [
            ...new Set([
              ...matchingPaths.flatMap((path) => path.evidenceIds),
              ...occurrences.flatMap((node) => node.evidenceIds)
            ])
          ],
          label: occurrences[0]?.label ?? `Graph node ${nodeId.slice(0, 8)}`,
          nodeId,
          pathCount: ranked?.pathCount ?? 0,
          pathIds,
          pathNames: matchingPaths.map((path) => path.name)
        };
      };

      return {
        analyzedAt: new Date().toISOString(),
        assumptions: [
          "These are evidence-backed path breakers ranked from persisted, evidence-linked paths — not XM-class min-cut science or a Leading graph claim.",
          "Entry and objective nodes are excluded when an internal control point is available.",
          "Recommendations use a greedy hitting-set approximation with optional evidence weights (1 + measured-hop fraction). They are not a proof of the exact global minimum cut, max-flow, or a single cheapest control across all paths.",
          "Betweenness is weighted path coverage / total path weight — not classic edge-betweenness centrality on a flow network.",
          "Breaking a node means remediating the real control or relationship represented by that graph entity, then revalidating affected paths. A recommendation is never proof of a fix.",
          "Scorecard honesty: Choke Point Analysis remains Partial until a real graph-wide min-cut/dominator solver ships — do not market as Leading choke science."
        ],
        chokePoints: analysis.chokePoints.map((point) => enrich(point.nodeId)),
        collapseRatio: analysis.collapseRatio,
        honestyNote:
          "Methodology GreedyHittingSetApproximation: evidence-weighted path breakers only. Not graph-wide min-cut, max-flow, or XM-class Leading choke science. Scorecard #4 stays <4 / Partial until a real dominator/min-cut solver ships.",
        methodology: "GreedyHittingSetApproximation",
        recommendedCutSet: analysis.minimalCutSet.map(enrich),
        tenantId: context.tenant.tenantId,
        totalPaths: analysis.totalPaths
      };
    },

    async listValidatedFindings(context, filters = {}) {
      const rawPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );

      // Non-snap enrichment (findings/attack paths): load non-snap packs + candidate schedules for source pack/schedule backlinks
      // when an evidenceId on the path is owned by a Control/AI/Fix pack. This advances unified surfaces for continuous signals.
      const evToNonSnap = await loadNonSnapshotBacklinks(
        prisma,
        context.tenant.tenantId
      );
      const enrichedRawPaths = attachNonSnapshotBacklinks(
        rawPaths,
        evToNonSnap
      );

      const [signals, remediations, missingSignals] = await Promise.all([
        prisma.signalEnvelope.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.remediationTask.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.missingSignal.findMany({
          orderBy: {
            createdAt: "desc"
          },
          where: {
            tenantId: context.tenant.tenantId
          }
        })
      ]);

      const assessedPaths = await assessAttackPathsWithFinancialExposure({
        paths: enrichedRawPaths,
        prisma,
        tenantId: context.tenant.tenantId
      });

      const dispositions = await loadFindingDispositions(
        prisma,
        context.tenant.tenantId
      );

      const overlaid = overlayDispositions(
        buildValidatedFindings({
          attackPaths: assessedPaths,
          missingSignals: missingSignals.map(serializeMissingSignal),
          remediations: remediations.map(serializeRemediationTask),
          signals: signals.map(serializeSignalEnvelope),
          tenantId: context.tenant.tenantId
        }),
        dispositions
      );
      const filtered = filterValidatedFindings(overlaid, filters);
      const missionScoped = filters.missionId
        ? filterFindingsByMissionEvidence(
            filtered,
            await loadTenantMissionEvidenceIds(prisma, {
              missionId: filters.missionId,
              tenantId: context.tenant.tenantId
            })
          )
        : filtered;
      return missionScoped.slice(
        filters.offset ?? 0,
        (filters.offset ?? 0) + (filters.limit ?? missionScoped.length)
      );
    },

    async getValidatedFinding(this: AppServices, context, findingId) {
      return (
        (await this.listValidatedFindings(context)).find(
          (finding) => finding.findingId === findingId
        ) ?? null
      );
    },

    async transitionFinding(this: AppServices, context, findingId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "change finding disposition"
      );

      // The finding must actually exist in the derived set — you cannot
      // disposition a finding the evidence does not currently produce.
      const finding = await this.getValidatedFinding(context, findingId);
      if (!finding) {
        throw new AppServiceError(
          "Finding not found.",
          404,
          "finding_not_found"
        );
      }

      const tenantId = context.tenant.tenantId;
      const fingerprint = finding.fingerprint ?? null;
      const fingerprintKey = fingerprint
        ? findingDispositionFingerprintKey(fingerprint)
        : null;

      if (input.disposition === null) {
        // Clear finding-scoped row and any fingerprint mute for this cause.
        const clearIds = [findingId];
        if (fingerprintKey) clearIds.push(fingerprintKey);
        await prisma.findingDisposition.deleteMany({
          where: { findingId: { in: clearIds }, tenantId }
        });
        await writeAuditEvent(prisma, {
          action: "finding.disposition_changed",
          actorType: "User",
          entityId: finding.sourceEntityId,
          entityType: finding.sourceEntityType,
          metadata: {
            cleared: true,
            findingId,
            fingerprint,
            previousStatus: finding.status
          },
          tenantId,
          userId: context.user.userId
        });
        try {
          await emitTenantWebhook(tenantId, "finding.disposition_changed", {
            cleared: true,
            findingId,
            fingerprint,
            previousStatus: finding.status
          });
        } catch {
          // Webhook delivery is best-effort; disposition write already succeeded.
        }
        return { ...finding, disposition: null };
      }

      const now = new Date();
      const acceptedRisk = input.disposition === "AcceptedRisk";
      const suppressed = input.disposition === "Suppressed";
      const falsePositive = input.disposition === "FalsePositive";
      // P18-16: Suppressed may carry optional revisitAt via expiresAt (lighter
      // than dual-control AcceptedRisk). AcceptedRisk still requires expiry.
      let expiresAt: Date | null = null;
      if (acceptedRisk || (suppressed && input.expiresAt)) {
        expiresAt = new Date(input.expiresAt!);
        if (expiresAt.getTime() <= now.getTime()) {
          throw new AppServiceError(
            acceptedRisk
              ? "Accepted risk expiry must be in the future."
              : "Suppressed revisit time must be in the future.",
            400,
            acceptedRisk
              ? "finding_risk_expiry_invalid"
              : "finding_suppress_revisit_invalid"
          );
        }
      }
      const storedNote =
        formatFindingDispositionNote(input.reasonCode, input.note) ?? null;
      // Owner is optional on any disposition (SOC queue assignment / SLA handoff).
      // AcceptedRisk still requires owner via TransitionFindingInputSchema.
      const ownerId = input.ownerId ?? null;
      if (ownerId) {
        const ownerMembership = await prisma.membership.findFirst({
          where: {
            tenantId,
            userId: ownerId
          }
        });
        if (!ownerMembership) {
          throw new AppServiceError(
            "Finding owner must be a current tenant member.",
            400,
            "finding_owner_invalid"
          );
        }
      }

      const upsertPayload = {
        approvedAt: null as Date | null,
        approvedBy: null as string | null,
        disposition: input.disposition,
        expiresAt,
        note: storedNote,
        ownerId,
        updatedBy: context.user.userId
      };

      const row = await prisma.findingDisposition.upsert({
        create: {
          ...upsertPayload,
          findingId,
          tenantId
        },
        update: {
          ...upsertPayload,
          updatedAt: now
        },
        where: { tenantId_findingId: { findingId, tenantId } }
      });

      // P06-17 / P18-18: also persist FP/Suppressed by fingerprint so group
      // absorb and re-keying cannot orphan the mute. Default on when fingerprint
      // exists unless applyToFingerprint is explicitly false.
      const applyToFingerprint =
        (falsePositive || suppressed) &&
        fingerprintKey &&
        input.applyToFingerprint !== false;
      if (applyToFingerprint && fingerprintKey) {
        await prisma.findingDisposition.upsert({
          create: {
            ...upsertPayload,
            findingId: fingerprintKey,
            tenantId
          },
          update: {
            ...upsertPayload,
            updatedAt: now
          },
          where: {
            tenantId_findingId: { findingId: fingerprintKey, tenantId }
          }
        });
      } else if (fingerprintKey && !falsePositive && !suppressed) {
        // Moving off FP/Suppressed drops the fingerprint mute so the cause
        // re-enters Active triage for sibling group members.
        await prisma.findingDisposition.deleteMany({
          where: { findingId: fingerprintKey, tenantId }
        });
      }

      const reasonCode =
        input.reasonCode ?? parseFindingDispositionReasonCode(storedNote);

      await writeAuditEvent(prisma, {
        action: "finding.disposition_changed",
        actorType: "User",
        entityId: finding.sourceEntityId,
        entityType: finding.sourceEntityType,
        metadata: {
          applyToFingerprint: Boolean(applyToFingerprint),
          derivedStatus: finding.status,
          disposition: input.disposition,
          expiresAt: expiresAt?.toISOString() ?? null,
          findingId,
          fingerprint,
          note: storedNote,
          ownerId,
          reasonCode,
          approvalState: acceptedRisk ? "Pending" : "NotRequired",
          source: finding.source
        },
        tenantId,
        userId: context.user.userId
      });

      try {
        await emitTenantWebhook(tenantId, "finding.disposition_changed", {
          applyToFingerprint: Boolean(applyToFingerprint),
          disposition: input.disposition,
          expiresAt: expiresAt?.toISOString() ?? null,
          findingId,
          fingerprint,
          reasonCode,
          source: finding.source,
          title: finding.title
        });
      } catch {
        // Best-effort webhook.
      }

      const override: FindingDispositionOverride = {
        approvedAt: null,
        approvedBy: null,
        approvalState: acceptedRisk ? "Pending" : "NotRequired",
        disposition: input.disposition,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        note: row.note ?? null,
        ownerId: row.ownerId ?? null,
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedBy,
        inheritedFromFingerprint: false,
        fingerprint
      };
      return { ...finding, disposition: override };
    },

    async listDispositionFeedback(
      this: AppServices,
      context
    ): Promise<DispositionFeedbackSummary> {
      const findings = await this.listValidatedFindings(context);
      const rows = findings.filter(
        (finding) =>
          finding.disposition?.disposition === "FalsePositive" ||
          finding.disposition?.disposition === "Suppressed"
      );

      const byReasonMap = new Map<string | null, number>();
      const byFingerprintMap = new Map<
        string,
        {
          fingerprint: string | null;
          reasonCode: ReturnType<typeof parseFindingDispositionReasonCode>;
          disposition: "FalsePositive" | "Suppressed";
          count: number;
          source: string | null;
          sampleFindingId: string | null;
          sampleTitle: string | null;
          lastUpdatedAt: string | null;
          expiresAt: string | null;
        }
      >();
      const bySourceMap = new Map<string, number>();
      let totalFalsePositive = 0;
      let totalSuppressed = 0;

      for (const finding of rows) {
        const disposition = finding.disposition!.disposition as
          | "FalsePositive"
          | "Suppressed";
        if (disposition === "FalsePositive") totalFalsePositive += 1;
        else totalSuppressed += 1;

        const reasonCode = parseFindingDispositionReasonCode(
          finding.disposition?.note
        );
        byReasonMap.set(reasonCode, (byReasonMap.get(reasonCode) ?? 0) + 1);
        bySourceMap.set(
          finding.source,
          (bySourceMap.get(finding.source) ?? 0) + 1
        );

        const fpKey = finding.fingerprint ?? finding.findingId;
        const existing = byFingerprintMap.get(fpKey);
        if (existing) {
          existing.count += 1;
          if (
            (finding.disposition?.updatedAt ?? "") >
            (existing.lastUpdatedAt ?? "")
          ) {
            existing.lastUpdatedAt = finding.disposition?.updatedAt ?? null;
            existing.expiresAt = finding.disposition?.expiresAt ?? null;
            existing.sampleFindingId = finding.findingId;
            existing.sampleTitle = finding.title;
          }
        } else {
          byFingerprintMap.set(fpKey, {
            fingerprint: finding.fingerprint ?? null,
            reasonCode,
            disposition,
            count: 1,
            source: finding.source,
            sampleFindingId: finding.findingId,
            sampleTitle: finding.title,
            lastUpdatedAt: finding.disposition?.updatedAt ?? null,
            expiresAt: finding.disposition?.expiresAt ?? null
          });
        }
      }

      return {
        generatedAt: new Date().toISOString(),
        totalFalsePositive,
        totalSuppressed,
        byReason: [...byReasonMap.entries()]
          .map(([reasonCode, count]) => ({ reasonCode, count }))
          .sort((a, b) => b.count - a.count),
        byFingerprint: [...byFingerprintMap.values()].sort(
          (a, b) => b.count - a.count
        ),
        bySource: [...bySourceMap.entries()]
          .map(([source, count]) => ({ source, count }))
          .sort((a, b) => b.count - a.count)
      };
    },

    async approveFindingRisk(this: AppServices, context, findingId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "approve accepted risk"
      );
      const finding = await this.getValidatedFinding(context, findingId);
      if (!finding) {
        throw new AppServiceError(
          "Finding not found.",
          404,
          "finding_not_found"
        );
      }
      const tenantId = context.tenant.tenantId;
      const row = await prisma.findingDisposition.findFirst({
        where: { findingId, tenantId }
      });
      if (!row || row.disposition !== "AcceptedRisk" || !row.expiresAt) {
        throw new AppServiceError(
          "No pending accepted-risk request exists for this finding.",
          409,
          "finding_risk_not_pending"
        );
      }
      if (row.expiresAt.getTime() <= Date.now()) {
        throw new AppServiceError(
          "This accepted-risk request has expired.",
          409,
          "finding_risk_expired"
        );
      }
      if (row.updatedBy === context.user.userId) {
        throw new AppServiceError(
          "Accepted risk requires approval by a different tenant member.",
          409,
          "finding_risk_self_approval_denied"
        );
      }
      const approvedAt = new Date();
      const approved = await prisma.findingDisposition.update({
        data: {
          approvedAt,
          approvedBy: context.user.userId
        },
        where: { findingDispositionId: row.findingDispositionId }
      });
      await writeAuditEvent(prisma, {
        action: "finding.risk_approved",
        actorType: "User",
        entityId: finding.sourceEntityId,
        entityType: finding.sourceEntityType,
        metadata: {
          approvedBy: context.user.userId,
          expiresAt: approved.expiresAt?.toISOString() ?? null,
          findingId,
          ownerId: approved.ownerId,
          requestedBy: approved.updatedBy
        },
        tenantId,
        userId: context.user.userId
      });
      return {
        ...finding,
        disposition: {
          approvedAt: approvedAt.toISOString(),
          approvedBy: context.user.userId,
          approvalState: "Approved",
          disposition: "AcceptedRisk",
          expiresAt: approved.expiresAt?.toISOString() ?? null,
          note: approved.note ?? null,
          ownerId: approved.ownerId ?? null,
          updatedAt: approved.updatedAt.toISOString(),
          updatedBy: approved.updatedBy
        }
      };
    },

    async listAttackPaths(context) {
      const rawPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );

      // Non-snap enrichment for /attack-paths: same pack/schedule backlink attachment as findings.
      const evToNonSnap = await loadNonSnapshotBacklinks(
        prisma,
        context.tenant.tenantId
      );
      const enrichedRaw = attachNonSnapshotBacklinks(rawPaths, evToNonSnap);

      return (
        await assessAttackPathsWithFinancialExposure({
          paths: enrichedRaw,
          prisma,
          tenantId: context.tenant.tenantId
        })
      ).sort((left, right) => right.risk.score - left.risk.score);
    },

    async listAssets(context) {
      const assets = await prisma.asset.findMany({
        orderBy: [{ businessCriticality: "desc" }, { name: "asc" }],
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return assets.map(serializeAsset);
    },

    async updateAssetValuation(context, assetId, input: AssetValuationInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "update asset financial assumptions"
      );
      const asset = await prisma.asset.findFirst({
        where: {
          assetId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!asset) {
        throw new AppServiceError("Asset not found.", 404, "asset_not_found");
      }
      const valuation = {
        ...input,
        currency: input.currency ?? "USD",
        updatedAt: new Date().toISOString(),
        updatedBy: context.user.userId
      };
      const updated = await prisma.asset.update({
        data: {
          valuation: valuation as Prisma.InputJsonValue
        },
        where: {
          assetId: asset.assetId
        }
      });
      await writeAuditEvent(prisma, {
        action: "asset.valuation_updated",
        actorType: "User",
        entityId: asset.assetId,
        entityType: "Asset",
        metadata: {
          businessServiceName: valuation.businessServiceName,
          confidence: valuation.confidence,
          currency: valuation.currency
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeAsset(updated);
    },

    async getAttackPath(context, pathId) {
      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        return null;
      }

      return (
        await assessAttackPathsWithFinancialExposure({
          paths: [path],
          prisma,
          tenantId: context.tenant.tenantId
        })
      )[0]!;
    },

    async listAttackPathEvidence(context, pathId) {
      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        throw new AppServiceError(
          "Attack path not found.",
          404,
          "attack_path_not_found"
        );
      }

      const artifacts = await prisma.evidenceArtifact.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          evidenceId: {
            in: path.evidenceIds
          },
          tenantId: context.tenant.tenantId
        }
      });

      return artifacts.map(serializeEvidenceArtifact);
    },

    async requestAttackPathVerification(
      this: AppServices,
      context,
      pathId,
      input
    ) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "request attack path verification"
      );
      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        throw new AppServiceError(
          "Attack path not found.",
          404,
          "attack_path_not_found"
        );
      }

      const verifiedScopes = await prisma.scope.findMany({
        orderBy: { createdAt: "asc" },
        where: {
          ...(input.scopeId ? { scopeId: input.scopeId } : {}),
          tenantId: context.tenant.tenantId,
          verificationStatus: "Verified"
        }
      });

      if (input.scopeId && verifiedScopes.length === 0) {
        throw new AppServiceError(
          "Attack path verification requires a verified scope.",
          400,
          "verified_scope_required"
        );
      }

      if (!input.scopeId && verifiedScopes.length === 0) {
        throw new AppServiceError(
          "Attack path verification requires at least one verified scope.",
          400,
          "verified_scope_required"
        );
      }

      if (!input.scopeId && verifiedScopes.length > 1) {
        throw new AppServiceError(
          "Multiple verified scopes are available; provide scopeId for attack path verification.",
          400,
          "scope_required"
        );
      }

      const scope = verifiedScopes[0]!;
      const assessedPath = (
        await assessAttackPathsWithFinancialExposure({
          paths: [path],
          prisma,
          tenantId: context.tenant.tenantId
        })
      )[0]!;
      const target = {
        attackPathId: path.pathId,
        evidenceIds: path.evidenceIds,
        reason: input.reason ?? null,
        scenarioType: "AttackPathValidation",
        validationState: path.validationState
      };
      const policyDecision = await this.previewPolicyDecision(
        context,
        scope.scopeId,
        {
          executionEnvironment: "ControlPlane",
          explicitMissionApproval: false,
          missionType: "ExposureValidation",
          requestedAction: {
            credentialTheft: false,
            destructive: false,
            persistence: false,
            realDataExfiltration: false,
            requiresInternalRunner: false,
            requiresTimeWindow: false,
            uncontrolledExploitChaining: false
          },
          safetyLevel: "ControlledValidation",
          target
        }
      );
      const mission = await this.createMission(context, {
        missionType: "ExposureValidation",
        policyDecisionId: policyDecision.policyDecisionId,
        policyProfile: "attack-path-verification",
        safetyLevel: "ControlledValidation",
        scopeId: scope.scopeId,
        scopeIds: [scope.scopeId]
      });

      return {
        attackPath: assessedPath,
        evidenceIds: path.evidenceIds,
        mission,
        policyDecision,
        queued: false,
        status: "RequiresApproval",
        verificationPlan: {
          nextStep:
            "Approve the policy decision, then start the created mission with an attack-path validation module.",
          reason: input.reason ?? null,
          requestedAt: new Date().toISOString(),
          scopeId: scope.scopeId
        }
      };
    },

    async getAttackPathValidationPlan(
      context,
      pathId
    ): Promise<AttackPathValidationPlan> {
      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        throw new AppServiceError(
          "Attack path not found.",
          404,
          "attack_path_not_found"
        );
      }

      const tenantId = context.tenant.tenantId;
      const [verifiedScopeCount, runnerCount, integrations] = await Promise.all(
        [
          prisma.scope.count({
            where: {
              tenantId,
              verificationStatus: "Verified"
            }
          }),
          prisma.runner.count({
            where: {
              tenantId,
              status: {
                in: ["Active", "Degraded"]
              }
            }
          }),
          prisma.integration.findMany({
            select: {
              category: true
            },
            where: {
              status: "Connected",
              tenantId
            }
          })
        ]
      );

      const plan = buildAttackPathValidationPlan({
        path,
        readiness: {
          hasVerifiedScope: verifiedScopeCount > 0,
          hasRunner: runnerCount > 0,
          connectedIntegrationCategories: [
            ...new Set(integrations.map((integration) => integration.category))
          ],
          // Safe hop probes are ActiveNonInvasive/PassiveReadOnly. Do not force
          // plan-level NeedsApproval that blocks the Measure hop journey —
          // launch still runs policy (RequiresApproval / Denied) honestly and
          // never queues Denied or claims Measured from launch alone.
          requiresApprovalForActive: false
        }
      });

      return AttackPathValidationPlanSchema.parse(plan);
    },

    async listAttackPathEdgeReceipts(
      context,
      pathId
    ): Promise<PathEdgeReceipt[]> {
      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        throw new AppServiceError(
          "Attack path not found.",
          404,
          "attack_path_not_found"
        );
      }

      const rows = await prisma.pathEdgeReceipt.findMany({
        orderBy: {
          measuredAt: "desc"
        },
        where: {
          pathId,
          tenantId: context.tenant.tenantId
        }
      });

      return rows.map(serializePathEdgeReceipt);
    },

    async getAttackPathMeasurementState(
      context,
      pathId
    ): Promise<AttackPathMeasurementState> {
      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        throw new AppServiceError(
          "Attack path not found.",
          404,
          "attack_path_not_found"
        );
      }

      const rows = await prisma.pathEdgeReceipt.findMany({
        orderBy: {
          measuredAt: "desc"
        },
        where: {
          pathId,
          tenantId: context.tenant.tenantId
        }
      });
      const receipts = rows.map(serializePathEdgeReceipt);

      return AttackPathMeasurementStateSchema.parse(
        deriveAttackPathMeasurementState(path, receipts)
      );
    },

    async getAttackPathNextMission(this: AppServices, context, pathId) {
      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        throw new AppServiceError(
          "Attack path not found.",
          404,
          "attack_path_not_found"
        );
      }

      const tenantId = context.tenant.tenantId;
      const [measurementState, validationPlan, signals, verifiedScope] =
        await Promise.all([
          this.getAttackPathMeasurementState(context, pathId),
          this.getAttackPathValidationPlan(context, pathId),
          prisma.signalEnvelope.findMany({
            orderBy: { createdAt: "desc" },
            take: 200,
            where: { tenantId }
          }),
          prisma.scope.findFirst({
            orderBy: { createdAt: "asc" },
            where: {
              tenantId,
              verificationStatus: "Verified"
            }
          })
        ]);

      const recommendation = generateDynamicPathMissionRecommendation({
        attackPath: path,
        generatedAt: new Date().toISOString(),
        measurementState,
        signals: signals.map(serializeSignalEnvelope),
        tenantId,
        validationPlan,
        verifiedScopeId: verifiedScope?.scopeId ?? null
      });

      if (!recommendation) {
        return null;
      }

      // Persist advisory proposal (same durable store as operator recommendations).
      const existing = await prisma.operatorRecommendation.findFirst({
        where: {
          payload: {
            equals: recommendation.recommendationId,
            path: ["recommendationId"]
          },
          tenantId
        }
      });

      if (!existing) {
        await prisma.operatorRecommendation.create({
          data: {
            payload: recommendation as unknown as Prisma.InputJsonValue,
            scopeId: recommendation.missionPlan.scopeId ?? null,
            status: recommendation.status,
            tenantId
          }
        });
      } else {
        // Overlay durable status so Approved survives refetch.
        if (
          existing.status !== recommendation.status &&
          existing.status === "Approved"
        ) {
          return {
            ...recommendation,
            status: "Approved" as const
          } satisfies DynamicPathMissionRecommendation;
        }
      }

      return recommendation;
    },

    async approveAttackPathNextMission(this: AppServices, context, pathId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "approve attack path next mission"
      );

      const recommendation = await this.getAttackPathNextMission(
        context,
        pathId
      );

      if (!recommendation) {
        throw new AppServiceError(
          "No next recommended mission is available for this path.",
          404,
          "dynamic_path_mission_not_found"
        );
      }

      if (
        recommendation.status === "NotActionable" ||
        !recommendation.missionPlan.scopeId
      ) {
        throw new AppServiceError(
          "Next recommended mission is not actionable without verified scope.",
          400,
          "dynamic_path_mission_not_actionable"
        );
      }

      const decision = await this.previewPolicyDecision(
        context,
        recommendation.missionPlan.scopeId,
        {
          executionEnvironment: recommendation.missionPlan.executionEnvironment,
          missionType: recommendation.missionPlan.missionType,
          requestedAction: recommendation.missionPlan.requestedAction,
          safetyLevel: recommendation.missionPlan.safetyLevel,
          target: recommendation.missionPlan.target
        }
      );

      const mission = await this.createMission(context, {
        missionType: recommendation.missionPlan.missionType,
        policyDecisionId: decision.policyDecisionId,
        policyProfile: `dynamic-path:${pathId}`,
        safetyLevel: recommendation.missionPlan.safetyLevel,
        scopeId: recommendation.missionPlan.scopeId,
        scopeIds: [recommendation.missionPlan.scopeId]
      });

      await prisma.operatorRecommendation.updateMany({
        data: {
          status: "Approved"
        },
        where: {
          payload: {
            equals: recommendation.recommendationId,
            path: ["recommendationId"]
          },
          tenantId: context.tenant.tenantId
        }
      });

      // createMission already emits mission.created; record path-linked approval
      // on the same allowed action with recommendation metadata.
      await writeAuditEvent(prisma, {
        action: "mission.created",
        actorType: "User",
        entityId: mission.missionId,
        entityType: "ValidationMission",
        metadata: {
          drivers: recommendation.drivers,
          kind: "DynamicPathNextMission",
          missionType: mission.missionType,
          pathId,
          queued: false,
          recommendationId: recommendation.recommendationId,
          source: "dynamic-path-next-mission-approve"
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        decision,
        mission,
        queued: false as const,
        recommendation: {
          ...recommendation,
          status: "Approved" as const
        }
      };
    },

    async applyPathEdgeReceipt(
      context,
      pathId,
      edgeId,
      input: ApplyPathEdgeReceiptInput
    ): Promise<ApplyPathEdgeReceiptResult> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "apply path edge receipt"
      );

      if (input.pathId !== pathId || input.pathEdgeId !== edgeId) {
        throw new AppServiceError(
          "Receipt pathId/pathEdgeId must match the request path.",
          400,
          "path_edge_receipt_mismatch"
        );
      }

      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        throw new AppServiceError(
          "Attack path not found.",
          404,
          "attack_path_not_found"
        );
      }

      const edge = path.pathEdges.find(
        (candidate) => candidate.pathEdgeId === edgeId
      );
      if (!edge) {
        throw new AppServiceError(
          "Attack path edge not found.",
          404,
          "path_edge_not_found"
        );
      }

      const hopKey =
        input.hopKey ??
        hopKeyForPathEdge(edge, path.pathNodes) ??
        `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`;

      // P0 AppSec: Measured must not be forgeable from bare client evidenceIds.
      // Require a tenant validation run and/or mission that is linked to this
      // path/edge (launchPathEdgeValidation → mission → run pipeline).
      const inputRunId = input.validationRunId ?? null;
      const inputMissionId = input.missionId ?? null;
      if (!inputRunId && !inputMissionId) {
        throw new AppServiceError(
          "Path edge receipts require a tenant validationRunId and/or missionId linked to this path edge. Measured cannot be forged from evidence IDs alone.",
          400,
          "path_edge_receipt_run_linkage_required"
        );
      }

      let resolvedMissionId = inputMissionId;
      let resolvedRunId = inputRunId;
      let resolvedPolicyDecisionId = input.policyDecisionId ?? null;

      // Server-derived proof fields (P03-2): prefer completed run outcome over
      // client-supplied Measured claims.
      let serverModuleId: string | null = null;
      let serverOutcome: string | null = null;
      let serverValidationState: string | null = null;
      let runEvidenceIds: string[] | null = null;

      if (inputRunId) {
        const run = await prisma.validationRun.findFirst({
          select: {
            evidenceIds: true,
            missionId: true,
            moduleId: true,
            outcome: true,
            policyDecisionId: true,
            runId: true,
            status: true,
            target: true,
            validationState: true
          },
          where: {
            runId: inputRunId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!run) {
          throw new AppServiceError(
            "Validation run not found for this tenant.",
            404,
            "validation_run_not_found"
          );
        }
        if (
          inputMissionId &&
          run.missionId !== inputMissionId
        ) {
          throw new AppServiceError(
            "validationRunId does not belong to the provided missionId.",
            400,
            "path_edge_receipt_mission_run_mismatch"
          );
        }
        if (
          !targetLinksToPathEdge(run.target, pathId, edgeId, hopKey)
        ) {
          throw new AppServiceError(
            "Validation run is not linked to this attack path edge.",
            400,
            "path_edge_receipt_run_not_linked"
          );
        }
        // Measured-upgradeable receipts require a Completed run (P03-2).
        const nonUpgradingStates = new Set([
          "NoEvidence",
          "Inconclusive",
          "NotConfigured",
          "RequiresIntegration",
          "RequiresVerifiedScope",
          "RequiresInternalRunner",
          "NeedsApproval",
          "NeedsInternalRunner"
        ]);
        const clientWouldUpgrade =
          input.evidenceIds.length > 0 &&
          !nonUpgradingStates.has(input.validationState);
        if (clientWouldUpgrade && run.status !== "Completed") {
          throw new AppServiceError(
            "Measured path edge receipts require a Completed validation run.",
            400,
            "path_edge_receipt_run_not_completed"
          );
        }
        runEvidenceIds = Array.isArray(run.evidenceIds)
          ? (run.evidenceIds as string[])
          : [];
        for (const evidenceId of input.evidenceIds) {
          if (!runEvidenceIds.includes(evidenceId)) {
            throw new AppServiceError(
              "Path edge receipt evidenceIds must be produced by the linked validation run.",
              400,
              "path_edge_receipt_evidence_not_from_run"
            );
          }
        }
        resolvedMissionId = run.missionId;
        resolvedRunId = run.runId;
        if (!resolvedPolicyDecisionId && run.policyDecisionId) {
          resolvedPolicyDecisionId = run.policyDecisionId;
        }
        serverModuleId = run.moduleId;
        serverOutcome = run.outcome;
        serverValidationState = run.validationState;
      } else if (inputMissionId) {
        const mission = await prisma.validationMission.findFirst({
          select: {
            missionId: true,
            policyDecision: {
              select: {
                policyDecisionId: true,
                target: true
              }
            },
            policyDecisionId: true,
            validationRuns: {
              orderBy: { createdAt: "desc" },
              select: {
                evidenceIds: true,
                moduleId: true,
                outcome: true,
                runId: true,
                status: true,
                target: true,
                validationState: true
              },
              take: 50
            }
          },
          where: {
            missionId: inputMissionId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!mission) {
          throw new AppServiceError(
            "Mission not found for this tenant.",
            404,
            "mission_not_found"
          );
        }

        const policyTargetLinks = targetLinksToPathEdge(
          mission.policyDecision?.target,
          pathId,
          edgeId,
          hopKey
        );
        const linkedRun = mission.validationRuns.find((run) =>
          targetLinksToPathEdge(run.target, pathId, edgeId, hopKey)
        );
        if (!policyTargetLinks && !linkedRun) {
          throw new AppServiceError(
            "Mission is not linked to this attack path edge.",
            400,
            "path_edge_receipt_mission_not_linked"
          );
        }
        resolvedMissionId = mission.missionId;
        if (linkedRun) {
          resolvedRunId = linkedRun.runId;
          serverModuleId = linkedRun.moduleId;
          serverOutcome = linkedRun.outcome;
          serverValidationState = linkedRun.validationState;
          runEvidenceIds = Array.isArray(linkedRun.evidenceIds)
            ? (linkedRun.evidenceIds as string[])
            : [];
          const nonUpgradingStates = new Set([
            "NoEvidence",
            "Inconclusive",
            "NotConfigured",
            "RequiresIntegration",
            "RequiresVerifiedScope",
            "RequiresInternalRunner",
            "NeedsApproval",
            "NeedsInternalRunner"
          ]);
          const clientWouldUpgrade =
            input.evidenceIds.length > 0 &&
            !nonUpgradingStates.has(input.validationState);
          if (clientWouldUpgrade && linkedRun.status !== "Completed") {
            throw new AppServiceError(
              "Measured path edge receipts require a Completed validation run.",
              400,
              "path_edge_receipt_run_not_completed"
            );
          }
          for (const evidenceId of input.evidenceIds) {
            if (!runEvidenceIds.includes(evidenceId)) {
              throw new AppServiceError(
                "Path edge receipt evidenceIds must be produced by the linked validation run.",
                400,
                "path_edge_receipt_evidence_not_from_run"
              );
            }
          }
        } else {
          // Policy-linked mission with no hop-bound run cannot mint Measured.
          const nonUpgradingStates = new Set([
            "NoEvidence",
            "Inconclusive",
            "NotConfigured",
            "RequiresIntegration",
            "RequiresVerifiedScope",
            "RequiresInternalRunner",
            "NeedsApproval",
            "NeedsInternalRunner"
          ]);
          if (
            input.evidenceIds.length > 0 &&
            !nonUpgradingStates.has(input.validationState)
          ) {
            throw new AppServiceError(
              "Measured path edge receipts require a hop-linked Completed validation run.",
              400,
              "path_edge_receipt_run_not_completed"
            );
          }
        }
        if (!resolvedPolicyDecisionId && mission.policyDecisionId) {
          resolvedPolicyDecisionId = mission.policyDecisionId;
        }
      }

      // Real-first: evidence IDs on the receipt must belong to this tenant.
      const evidenceRows = await prisma.evidenceArtifact.findMany({
        select: {
          evidenceId: true
        },
        where: {
          evidenceId: {
            in: input.evidenceIds
          },
          tenantId: context.tenant.tenantId
        }
      });
      if (evidenceRows.length !== input.evidenceIds.length) {
        throw new AppServiceError(
          "Path edge receipts require tenant-owned evidence IDs (real-first).",
          400,
          "evidence_required"
        );
      }

      const measuredAt = input.measuredAt
        ? new Date(input.measuredAt)
        : new Date();

      // Prefer server-derived module/outcome/state from the completed run so a
      // client cannot stamp Measured after linking a failed/empty probe (P03-2).
      const receiptModuleId = serverModuleId ?? input.moduleId;
      // P05-4: BloodHound identity import never upgrades hop to Measured.
      const isIdentityImport = receiptModuleId === IDENTITY_IMPORT_MODULE_ID;
      const receiptOutcome =
        serverOutcome ??
        input.outcome ??
        (isIdentityImport ? "identity_graph_imported" : "hop_probe_completed");
      const receiptValidationState = resolvePathEdgeReceiptValidationState({
        clientValidationState: input.validationState,
        isIdentityImport,
        resolvedRunId,
        serverValidationState
      });

      // Serialize with correlation refresh: holding the path receipt lock across
      // create+recompute prevents snapshot→deleteMany from cascade-wiping this
      // receipt before reattach.
      return withPathEdgeReceiptLock(prisma, pathId, async (tx) => {
        const liveEdge = await tx.pathEdge.findFirst({
          where: {
            pathEdgeId: edgeId,
            pathId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!liveEdge) {
          throw new AppServiceError(
            "Attack path edge not found.",
            404,
            "path_edge_not_found"
          );
        }

        const created = await tx.pathEdgeReceipt.create({
          data: {
            actor: input.actor ?? context.user.userId,
            evidenceIds: input.evidenceIds,
            hopKey,
            integrityHash: input.integrityHash ?? null,
            measuredAt,
            measurementMethod: input.measurementMethod,
            missionId: resolvedMissionId,
            moduleId: receiptModuleId,
            outcome: receiptOutcome,
            pathEdgeId: edgeId,
            pathId,
            policyDecisionId: resolvedPolicyDecisionId,
            tenantId: context.tenant.tenantId,
            validationRunId: resolvedRunId,
            validationState: receiptValidationState
          }
        });

        const receipt = serializePathEdgeReceipt(created);

        // Load all receipts for the path so path-level basis is weakest-edge
        // across real history, but only upgrade the targeted edge from this apply.
        const allReceiptRows = await tx.pathEdgeReceipt.findMany({
          orderBy: {
            measuredAt: "desc"
          },
          where: {
            pathId,
            tenantId: context.tenant.tenantId
          }
        });
        const allReceipts = allReceiptRows.map(serializePathEdgeReceipt);

        const recomputed = recomputeAttackPathFromReceipts({
          applyToPathEdgeIds: [edgeId],
          path,
          receipts: allReceipts
        });

        const updatedEdge = recomputed.pathEdges.find(
          (candidate) => candidate.pathEdgeId === edgeId
        )!;

        // Persist ONLY the targeted edge + path-level weakest basis + claim-safe
        // validationState recomputed from receipts. Never write unrelated edges.
        await tx.pathEdge.update({
          data: {
            evidenceBasis: updatedEdge.evidenceBasis,
            evidenceIds: updatedEdge.evidenceIds,
            measurementMethod: updatedEdge.measurementMethod ?? null
          },
          where: {
            pathEdgeId: edgeId
          }
        });
        await tx.attackPath.update({
          data: {
            evidenceBasis: recomputed.evidenceBasis,
            evidenceIds: recomputed.evidenceIds,
            // Wave A3: validationState from receipt-backed claim clamp only.
            validationState: recomputed.validationState
          },
          where: {
            pathId
          }
        });

        await writeAuditEvent(tx, {
          action: "verification.run",
          actorType: "User",
          entityId: receipt.receiptId,
          entityType: "AttackPath",
          metadata: {
            hopKey: receipt.hopKey,
            measurementMethod: receipt.measurementMethod,
            missionId: receipt.missionId,
            moduleId: receipt.moduleId,
            outcome: receipt.outcome,
            pathEdgeId: edgeId,
            pathId,
            pathValidationState: recomputed.validationState,
            receiptId: receipt.receiptId,
            surface: "applyPathEdgeReceipt",
            validationRunId: receipt.validationRunId,
            validationState: receipt.validationState
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        const measurementState = deriveAttackPathMeasurementState(
          recomputed,
          allReceipts
        );

        return ApplyPathEdgeReceiptResultSchema.parse({
          attackPath: recomputed,
          measurementState,
          receipt
        });
      });
    },

    async launchPathEdgeValidation(
      this: AppServices,
      context,
      pathId,
      edgeId,
      input: LaunchPathEdgeValidationInput
    ): Promise<PathEdgeValidationLaunchResult> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "launch path edge validation"
      );

      if (input.pathId !== pathId || input.pathEdgeId !== edgeId) {
        throw new AppServiceError(
          "Launch pathId/pathEdgeId must match the request path.",
          400,
          "path_edge_launch_mismatch"
        );
      }

      // Safety belt: only first-customer safe hop-probe modules.
      if (!SAFE_HOP_MODULE_SET.has(input.moduleId)) {
        throw new AppServiceError(
          "Edge validation only allows safe ActiveNonInvasive/PassiveReadOnly hop-probe modules.",
          400,
          "unsafe_edge_module"
        );
      }

      if (
        input.safetyLevel !== "ActiveNonInvasive" &&
        input.safetyLevel !== "PassiveReadOnly" &&
        input.safetyLevel !== "ControlledValidation"
      ) {
        throw new AppServiceError(
          "Edge validation safety level must be ActiveNonInvasive, PassiveReadOnly, or ControlledValidation.",
          400,
          "unsafe_edge_safety_level"
        );
      }

      const existingPaths = await ensureCorrelatedAttackPathsForTenant(
        prisma,
        context.tenant.tenantId
      );
      const path = existingPaths.find(
        (candidate) => candidate.pathId === pathId
      );

      if (!path) {
        throw new AppServiceError(
          "Attack path not found.",
          404,
          "attack_path_not_found"
        );
      }

      const edge = path.pathEdges.find(
        (candidate) => candidate.pathEdgeId === edgeId
      );
      if (!edge) {
        throw new AppServiceError(
          "Attack path edge not found.",
          404,
          "path_edge_not_found"
        );
      }

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId: input.scopeId,
          tenantId: context.tenant.tenantId,
          verificationStatus: "Verified"
        }
      });

      if (!scope) {
        throw new AppServiceError(
          "Edge validation requires a verified scope.",
          400,
          "verified_scope_required"
        );
      }

      const hopKey =
        hopKeyForPathEdge(edge, path.pathNodes) ??
        `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`;

      const assessedPath = (
        await assessAttackPathsWithFinancialExposure({
          paths: [path],
          prisma,
          tenantId: context.tenant.tenantId
        })
      )[0]!;

      // Bind hop probes to a reachable hostname when the verified scope is a
      // Domain/Subdomain. Without this, modules like http_health_check run with
      // an empty target and return Inconclusive — which correctly refuses
      // Measured (receiptMarksMeasured) but never proves the hop.
      // Identity/asset-only scopes leave hostname unset.
      const scopeHostname =
        scope.scopeType === "Domain" || scope.scopeType === "Subdomain"
          ? scope.value
          : null;

      // Local continuous-loop lab (infra/lab): published ports 8081/8082/8083
      // when PERISCAN_LAB_MODE=1 so hop probes work without /etc/hosts DNS.
      // Never invents Measured — probe must still succeed with a certainty state.
      let labUrl: string | null = null;
      if (
        process.env.PERISCAN_LAB_MODE === "1" &&
        typeof scopeHostname === "string" &&
        scopeHostname.endsWith(".lab.range.test")
      ) {
        const labPorts: Record<string, number> = {
          edge: 8081,
          app: 8082,
          data: 8083
        };
        const tier = scopeHostname.split(".")[0] ?? "";
        const port = labPorts[tier];
        if (port) {
          labUrl = `http://127.0.0.1:${port}/health`;
        }
      }

      const target = {
        attackPathId: path.pathId,
        evidenceIds: edge.evidenceIds,
        hopKey,
        ...(scopeHostname ? { hostname: scopeHostname } : {}),
        ...(labUrl ? { url: labUrl, protocol: "http" as const } : {}),
        moduleId: input.moduleId,
        pathEdgeId: edge.pathEdgeId,
        reason: input.reason ?? null,
        scenarioType: "AttackPathEdgeValidation",
        validationState: path.validationState
      };

      const policyDecision = await this.previewPolicyDecision(
        context,
        scope.scopeId,
        {
          executionEnvironment: "ControlPlane",
          explicitMissionApproval: false,
          missionType: input.missionType,
          requestedAction: {
            credentialTheft: false,
            destructive: false,
            persistence: false,
            realDataExfiltration: false,
            requiresInternalRunner: false,
            requiresTimeWindow: false,
            uncontrolledExploitChaining: false
          },
          safetyLevel: input.safetyLevel,
          target
        }
      );

      // Denied tasks must never be queued and must not create a mission.
      // previewPolicyDecision already audited the decision.
      if (policyDecision.outcome === "Denied") {
        await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
          hopKey,
          moduleId: input.moduleId,
          outcome: policyDecision.outcome,
          pathEdgeId: edgeId,
          pathId,
          policyDecisionId: policyDecision.policyDecisionId,
          rationale: policyDecision.rationale,
          scopeId: scope.scopeId,
          stage: "hop_launch"
        });

        return PathEdgeValidationLaunchResultSchema.parse({
          attackPath: assessedPath,
          evidenceIds: edge.evidenceIds,
          hopKey,
          mission: null,
          moduleId: input.moduleId,
          pathEdgeId: edgeId,
          policyDecision,
          queued: false,
          status: "Denied",
          verificationPlan: null
        });
      }

      // createMission audits mission.created. Never fabricate Measured here —
      // Measured requires a receipt with evidence IDs after a real run.
      const mission = await this.createMission(context, {
        missionType: input.missionType,
        policyDecisionId: policyDecision.policyDecisionId,
        policyProfile: "attack-path-edge-validation",
        safetyLevel: input.safetyLevel,
        scopeId: scope.scopeId,
        scopeIds: [scope.scopeId]
      });

      // Happy path (P05-2): Allowed policy for safe hop probes auto-queues the
      // hop module via startMission (run + job), same as other safe modules.
      // RequiresApproval and other non-Allowed gates stay RequiresApproval and
      // never queue.
      if (policyDecision.outcome === "Allowed") {
        // Use decision.target (set at preview) so hopKey/pathEdgeId stay bound
        // without a separate startMission target mismatch risk.
        const started = await this.startMission(context, mission.missionId, {
          moduleIds: [input.moduleId]
        });

        if (started.jobsQueued > 0) {
          return PathEdgeValidationLaunchResultSchema.parse({
            attackPath: assessedPath,
            evidenceIds: edge.evidenceIds,
            hopKey,
            mission: started.mission,
            moduleId: input.moduleId,
            pathEdgeId: edgeId,
            policyDecision,
            queued: true,
            status: "Queued",
            verificationPlan: {
              hopKey,
              moduleId: input.moduleId,
              nextStep:
                "Hop probe mission is queued. Measured claims require a receipt with evidence IDs after the run completes.",
              pathEdgeId: edgeId,
              reason: input.reason ?? null,
              requestedAt: new Date().toISOString(),
              scopeId: scope.scopeId
            }
          });
        }

        // startMission recheck denied or parked approval — surface honestly.
        if (started.mission.status === "DeniedByPolicy") {
          return PathEdgeValidationLaunchResultSchema.parse({
            attackPath: assessedPath,
            evidenceIds: edge.evidenceIds,
            hopKey,
            mission: started.mission,
            moduleId: input.moduleId,
            pathEdgeId: edgeId,
            policyDecision,
            queued: false,
            status: "Denied",
            verificationPlan: null
          });
        }

        return PathEdgeValidationLaunchResultSchema.parse({
          attackPath: assessedPath,
          evidenceIds: edge.evidenceIds,
          hopKey,
          mission: started.mission,
          moduleId: input.moduleId,
          pathEdgeId: edgeId,
          policyDecision,
          queued: false,
          status: "RequiresApproval",
          verificationPlan: {
            hopKey,
            moduleId: input.moduleId,
            nextStep:
              "Approve the policy decision, then start the created mission with the edge hop-probe module. Measured claims require a receipt with evidence IDs.",
            pathEdgeId: edgeId,
            reason: input.reason ?? null,
            requestedAt: new Date().toISOString(),
            scopeId: scope.scopeId
          }
        });
      }

      return PathEdgeValidationLaunchResultSchema.parse({
        attackPath: assessedPath,
        evidenceIds: edge.evidenceIds,
        hopKey,
        mission,
        moduleId: input.moduleId,
        pathEdgeId: edgeId,
        policyDecision,
        queued: false,
        status: "RequiresApproval",
        verificationPlan: {
          hopKey,
          moduleId: input.moduleId,
          nextStep:
            "Approve the policy decision, then start the created mission with the edge hop-probe module. Measured claims require a receipt with evidence IDs.",
          pathEdgeId: edgeId,
          reason: input.reason ?? null,
          requestedAt: new Date().toISOString(),
          scopeId: scope.scopeId
        }
      });
    }
  };
}
