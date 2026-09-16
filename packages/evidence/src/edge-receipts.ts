import {
  AttackPathMeasurementStateSchema,
  AttackPathSchema,
  claimSafePathValidationStateForWrite,
  PathEdgeReceiptSchema,
  type AttackPath,
  type AttackPathMeasurementState,
  type EdgeRelationship,
  type EvidenceBasis,
  type PathEdge,
  type PathEdgeReceipt,
  type PathNode,
  type ValidationState
} from "@periscan/shared";

/**
 * Stable hop identity independent of pathEdgeId rewrites. Same logical hop
 * across path recomputations shares a hopKey so receipts remain attachable.
 */
export function buildHopKey(
  sourceEntityId: string,
  targetEntityId: string,
  relationship: EdgeRelationship | string
): string {
  return `${sourceEntityId}|${relationship}|${targetEntityId}`;
}

/**
 * Path certainty is the weakest edge. One Heuristic hop keeps the path Heuristic.
 *
 * Honesty: Measured without evidence IDs does not count as Measured (aligns with
 * deriveAttackPathMeasurementState measuredEdgeCount and receiptMarksMeasured).
 */
export function weakestEvidenceBasis(
  edges: ReadonlyArray<{
    evidenceBasis: EvidenceBasis;
    evidenceIds?: readonly string[] | null;
  }>
): EvidenceBasis {
  return edges.length > 0 &&
    edges.every(
      (edge) =>
        edge.evidenceBasis === "Measured" &&
        Array.isArray(edge.evidenceIds) &&
        edge.evidenceIds.length > 0
    )
    ? "Measured"
    : "Heuristic";
}

/**
 * Resolve edge evidence basis from a correlation draft without stamping Measured
 * solely from draft.heuristic=false. Measured requires an explicit edge basis
 * plus at least one evidence ID (config-measured or probe-backed).
 * Hop receipts reattach/recompute may still upgrade to Measured afterward.
 */
export function resolveDraftEdgeEvidenceBasis(edge: {
  evidenceBasis?: EvidenceBasis | null;
  evidenceIds?: readonly string[] | null;
}): EvidenceBasis {
  if (
    edge.evidenceBasis === "Measured" &&
    Array.isArray(edge.evidenceIds) &&
    edge.evidenceIds.length > 0
  ) {
    return "Measured";
  }
  return "Heuristic";
}

/**
 * Path-level draft basis = weakest edge after honest edge resolution.
 * Never upgrades from draft.heuristic alone.
 */
export function resolveDraftPathEvidenceBasis(
  edges: ReadonlyArray<{
    evidenceBasis?: EvidenceBasis | null;
    evidenceIds?: readonly string[] | null;
  }>
): EvidenceBasis {
  return weakestEvidenceBasis(
    edges.map((edge) => ({
      evidenceBasis: resolveDraftEdgeEvidenceBasis(edge),
      evidenceIds: edge.evidenceIds ?? []
    }))
  );
}

function nodeEntityId(
  nodes: readonly PathNode[],
  pathNodeId: string
): string | null {
  return nodes.find((node) => node.pathNodeId === pathNodeId)?.entityId ?? null;
}

export function hopKeyForPathEdge(
  edge: Pick<PathEdge, "sourceNodeId" | "targetNodeId" | "relationship">,
  nodes: readonly PathNode[]
): string | null {
  const sourceEntityId = nodeEntityId(nodes, edge.sourceNodeId);
  const targetEntityId = nodeEntityId(nodes, edge.targetNodeId);
  if (!sourceEntityId || !targetEntityId) {
    return null;
  }
  return buildHopKey(sourceEntityId, targetEntityId, edge.relationship);
}

/**
 * A receipt may only mark Measured when it carries at least one evidence ID.
 * Real-first: empty evidence never upgrades Heuristic → Measured.
 */
export function receiptMarksMeasured(receipt: Pick<
  PathEdgeReceipt,
  "evidenceIds" | "validationState"
>): boolean {
  if (!receipt.evidenceIds || receipt.evidenceIds.length === 0) {
    return false;
  }
  // Inconclusive / no-evidence outcomes do not upgrade the hop to Measured certainty
  // of an attack edge; they still record that a probe ran.
  const nonUpgrading: ValidationState[] = [
    "NoEvidence",
    "Inconclusive",
    "NotConfigured",
    "RequiresIntegration",
    "RequiresVerifiedScope",
    "RequiresInternalRunner",
    "NeedsApproval",
    "NeedsInternalRunner"
  ];
  if (nonUpgrading.includes(receipt.validationState)) {
    return false;
  }
  return true;
}

/**
 * Server-derived receipt validationState for applyPathEdgeReceipt (P03-2).
 * Never prefer client state when a hop-linked run exists but omitted
 * validationState — that would forge Measured / FullyMeasured claims.
 */
export function resolvePathEdgeReceiptValidationState(input: {
  clientValidationState: ValidationState;
  isIdentityImport: boolean;
  resolvedRunId: string | null;
  serverValidationState: string | null;
}): ValidationState {
  if (input.isIdentityImport) {
    return "Inconclusive";
  }
  if (input.serverValidationState != null) {
    return input.serverValidationState as ValidationState;
  }
  if (input.resolvedRunId) {
    return "Inconclusive";
  }
  return input.clientValidationState;
}

function receiptAppliesToEdge(
  receipt: PathEdgeReceipt,
  edge: PathEdge,
  nodes: readonly PathNode[]
): boolean {
  if (receipt.pathEdgeId === edge.pathEdgeId) {
    return true;
  }
  const hopKey = hopKeyForPathEdge(edge, nodes);
  return hopKey !== null && receipt.hopKey === hopKey;
}

/**
 * Pick the latest receipt for an edge (by measuredAt). Invalid receipts (no
 * evidence when claiming measured) are still considered for outcome tracking
 * but will not upgrade evidenceBasis.
 */
function latestReceiptForEdge(
  edge: PathEdge,
  receipts: readonly PathEdgeReceipt[],
  nodes: readonly PathNode[]
): PathEdgeReceipt | null {
  const matching = receipts
    .filter((receipt) => receiptAppliesToEdge(receipt, edge, nodes))
    .sort(
      (left, right) =>
        Date.parse(right.measuredAt) - Date.parse(left.measuredAt)
    );
  return matching[0] ?? null;
}

export type RecomputeAttackPathFromReceiptsInput = {
  path: AttackPath;
  receipts: readonly PathEdgeReceipt[];
  /**
   * When set, only these pathEdgeIds may be upgraded. Default: any edge with a
   * matching receipt. Unrelated edges are never upgraded by association.
   */
  applyToPathEdgeIds?: readonly string[];
};

/**
 * Re-point preserved PathEdgeReceipts onto newly recreated path edges by
 * stable hopKey (sourceEntityId|relationship|targetEntityId).
 *
 * Used after correlation refresh deletes/recreates pathEdge rows (which would
 * otherwise cascade-delete receipts or leave pathEdgeId FKs dangling).
 *
 * - Receipts whose hopKey still exists on the path are reattached with the new
 *   pathEdgeId.
 * - Receipts for hops that no longer exist are dropped (not reattached).
 * - Does not upgrade evidenceBasis — call recomputeAttackPathFromReceipts after
 *   persisting reattached receipts.
 */
export function reattachPathEdgeReceiptsByHopKey(input: {
  pathId: string;
  pathEdges: readonly PathEdge[];
  pathNodes: readonly PathNode[];
  receipts: readonly PathEdgeReceipt[];
}): {
  reattachedReceipts: PathEdgeReceipt[];
  droppedReceiptCount: number;
  hopKeyToPathEdgeId: Map<string, string>;
} {
  const hopKeyToPathEdgeId = new Map<string, string>();
  for (const edge of input.pathEdges) {
    const hopKey = hopKeyForPathEdge(edge, input.pathNodes);
    if (hopKey) {
      hopKeyToPathEdgeId.set(hopKey, edge.pathEdgeId);
    }
  }

  const reattachedReceipts: PathEdgeReceipt[] = [];
  let droppedReceiptCount = 0;

  for (const receipt of input.receipts) {
    const parsed = PathEdgeReceiptSchema.parse(receipt);
    if (parsed.pathId !== input.pathId) {
      droppedReceiptCount += 1;
      continue;
    }
    const newPathEdgeId = hopKeyToPathEdgeId.get(parsed.hopKey);
    if (!newPathEdgeId) {
      droppedReceiptCount += 1;
      continue;
    }
    reattachedReceipts.push(
      PathEdgeReceiptSchema.parse({
        ...parsed,
        pathEdgeId: newPathEdgeId
      })
    );
  }

  return {
    reattachedReceipts,
    droppedReceiptCount,
    hopKeyToPathEdgeId
  };
}

/**
 * Apply edge receipts to an attack path. Pure: returns a new path object.
 *
 * Safety / real-first rules:
 * - Only edges with a matching receipt (pathEdgeId or hopKey) are updated.
 * - Unrelated edges keep their prior evidenceBasis and evidenceIds.
 * - Measured is only set when the receipt has evidenceIds and a non-empty
 *   measurement outcome that is not an explicit non-proof state.
 * - Path-level evidenceBasis is always the weakest edge basis.
 * - Path validationState is claim-clamped from receipt-backed hops only —
 *   never upgrades Heuristic/partial paths to Validated/Exploitable.
 */
export function recomputeAttackPathFromReceipts(
  input: RecomputeAttackPathFromReceiptsInput
): AttackPath {
  const allowList = input.applyToPathEdgeIds
    ? new Set(input.applyToPathEdgeIds)
    : null;

  // Validate receipts early so bad inputs fail closed.
  const receipts = input.receipts.map((receipt) =>
    PathEdgeReceiptSchema.parse(receipt)
  );

  const pathEdges = input.path.pathEdges.map((edge) => {
    if (allowList && !allowList.has(edge.pathEdgeId)) {
      return edge;
    }

    const receipt = latestReceiptForEdge(
      edge,
      receipts,
      input.path.pathNodes
    );
    if (!receipt) {
      return edge;
    }

    // Never upgrade unrelated edges: receipt must match this edge.
    if (
      receipt.pathId !== input.path.pathId &&
      receipt.pathEdgeId !== edge.pathEdgeId
    ) {
      return edge;
    }

    const measured = receiptMarksMeasured(receipt);
    const evidenceIds = measured
      ? Array.from(
          new Set([...(edge.evidenceIds ?? []), ...receipt.evidenceIds])
        )
      : edge.evidenceIds;

    return {
      ...edge,
      evidenceBasis: measured ? ("Measured" as const) : edge.evidenceBasis,
      evidenceIds,
      measurementMethod: receipt.measurementMethod,
      updatedAt: receipt.measuredAt
    };
  });

  const pathEvidenceIds = Array.from(
    new Set([
      ...input.path.evidenceIds,
      ...pathEdges.flatMap((edge) => edge.evidenceIds)
    ])
  );

  const evidenceBasis = weakestEvidenceBasis(pathEdges);
  // Wave A3: recompute claim-safe validationState from receipt-backed hops only.
  // Keeps Reachable/Validated/Exploitable only when every hop has Measured +
  // evidence IDs; otherwise remaps overclaims to Discovered. Never invents a
  // stronger certainty state than the recorded/requested path state.
  const claimSafeValidationState = claimSafePathValidationStateForWrite({
    evidenceBasis,
    pathEdges,
    requestedValidationState: input.path.validationState
  });

  return AttackPathSchema.parse({
    ...input.path,
    evidenceBasis,
    evidenceIds: pathEvidenceIds,
    pathEdges,
    updatedAt: new Date().toISOString(),
    validationState: claimSafeValidationState
  });
}

/**
 * Summarize measurement state for UI/API without mutating the path.
 * measuredHopFraction and claimSafeValidationState are derived only from
 * receipt-backed hop evidence (Measured + non-empty evidenceIds).
 */
export function deriveAttackPathMeasurementState(
  path: Pick<
    AttackPath,
    | "pathId"
    | "evidenceBasis"
    | "pathEdges"
    | "pathNodes"
    | "validationState"
  >,
  receipts: readonly PathEdgeReceipt[] = []
): AttackPathMeasurementState {
  const validatedReceipts = receipts.map((receipt) =>
    PathEdgeReceiptSchema.parse(receipt)
  );

  const edgeStates = path.pathEdges.map((edge) => {
    const hopKey = hopKeyForPathEdge(edge, path.pathNodes);
    const receipt = latestReceiptForEdge(
      edge,
      validatedReceipts,
      path.pathNodes
    );
    return {
      pathEdgeId: edge.pathEdgeId,
      hopKey,
      evidenceBasis: edge.evidenceBasis,
      evidenceIds: edge.evidenceIds,
      measurementMethod: edge.measurementMethod ?? receipt?.measurementMethod,
      latestReceiptId: receipt?.receiptId ?? null
    };
  });

  const measuredEdgeCount = edgeStates.filter(
    (edge) =>
      edge.evidenceBasis === "Measured" && edge.evidenceIds.length > 0
  ).length;
  const totalEdgeCount = edgeStates.length;
  const pathEvidenceBasis = weakestEvidenceBasis(path.pathEdges);
  const fullyMeasured =
    totalEdgeCount > 0 &&
    measuredEdgeCount === totalEdgeCount &&
    pathEvidenceBasis === "Measured";
  const measuredHopFraction =
    totalEdgeCount === 0 ? 0 : measuredEdgeCount / totalEdgeCount;
  const claimSafeValidationState = claimSafePathValidationStateForWrite({
    evidenceBasis: pathEvidenceBasis,
    pathEdges: path.pathEdges,
    requestedValidationState: path.validationState
  });

  return AttackPathMeasurementStateSchema.parse({
    pathId: path.pathId,
    pathEvidenceBasis,
    measuredEdgeCount,
    totalEdgeCount,
    measuredHopFraction,
    fullyMeasured,
    claimSafeValidationState,
    edgeStates
  });
}

/**
 * Build a receipt DTO from a successful hop probe. Requires evidence IDs.
 */
export function buildPathEdgeReceipt(input: {
  receiptId: string;
  tenantId?: string;
  pathId: string;
  pathEdgeId: string;
  hopKey: string;
  validationRunId?: string | null;
  missionId?: string | null;
  policyDecisionId?: string | null;
  moduleId: string;
  outcome: string;
  validationState: ValidationState;
  evidenceIds: string[];
  measuredAt?: string;
  measurementMethod: string;
  integrityHash?: string | null;
  actor?: string | null;
}): PathEdgeReceipt {
  if (input.evidenceIds.length === 0) {
    throw new Error(
      "Path edge receipts require at least one evidence ID (real-first: no fabricated Measured edges)."
    );
  }

  return PathEdgeReceiptSchema.parse({
    receiptId: input.receiptId,
    tenantId: input.tenantId,
    pathId: input.pathId,
    pathEdgeId: input.pathEdgeId,
    hopKey: input.hopKey,
    validationRunId: input.validationRunId ?? null,
    missionId: input.missionId ?? null,
    policyDecisionId: input.policyDecisionId ?? null,
    moduleId: input.moduleId,
    outcome: input.outcome,
    validationState: input.validationState,
    evidenceIds: input.evidenceIds,
    measuredAt: input.measuredAt ?? new Date().toISOString(),
    measurementMethod: input.measurementMethod,
    integrityHash: input.integrityHash ?? null,
    actor: input.actor ?? null
  });
}
