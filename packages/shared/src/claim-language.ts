import { z } from "zod";

import {
  isPathValidationState,
  type AttackPath,
  type AttackPathAssessment,
  type RiskBand
} from "./domain";

export const AttackPathClaimKindSchema = z.enum([
  "HeuristicHypothesis",
  "PartiallyMeasuredHypothesis",
  "MeasuredPath",
  "MeasuredReachable",
  "MeasuredValidated",
  "MeasuredExploitable"
]);

export type AttackPathClaimKind = z.infer<typeof AttackPathClaimKindSchema>;

export const AttackPathClaimSchema = z.object({
  canClaimExploitable: z.boolean(),
  canClaimReachable: z.boolean(),
  canClaimValidated: z.boolean(),
  displayLabel: z.string().min(1),
  fullyMeasured: z.boolean(),
  kind: AttackPathClaimKindSchema,
  measuredEdgeCount: z.number().int().nonnegative(),
  totalEdgeCount: z.number().int().nonnegative()
});

export type AttackPathClaim = z.infer<typeof AttackPathClaimSchema>;

type AttackPathClaimInput = Pick<
  AttackPath,
  "evidenceBasis" | "pathEdges" | "validationState"
>;

/**
 * A hop counts as Measured for claim language only when evidenceBasis is
 * Measured AND at least one evidence ID is present. Measured without receipts
 * is dishonest and must not enable Validated/Exploitable claims (aligns with
 * weakestEvidenceBasis / receiptMarksMeasured / deriveAttackPathMeasurementState).
 */
export function edgeCountsAsMeasured(edge: {
  evidenceBasis: string;
  evidenceIds?: readonly string[] | null;
}): boolean {
  return (
    edge.evidenceBasis === "Measured" &&
    Array.isArray(edge.evidenceIds) &&
    edge.evidenceIds.length > 0
  );
}

/** Path-partition states that imply reachability (subset of PATH_VALIDATION_STATES). */
const REACHABLE_PATH_STATES = new Set(["Reachable", "Validated", "Exploitable"]);

/**
 * Certainty-bearing path states that require fully-measured hop receipts before
 * they may appear as customer-visible validationState (P09-2).
 */
export const PATH_CERTAINTY_VALIDATION_STATES = [
  "Reachable",
  "Validated",
  "Exploitable"
] as const;

export type PathCertaintyValidationState =
  (typeof PATH_CERTAINTY_VALIDATION_STATES)[number];

const PATH_CERTAINTY_VALIDATION_STATE_SET = new Set<string>(
  PATH_CERTAINTY_VALIDATION_STATES
);

export function isPathCertaintyValidationState(
  state: string
): state is PathCertaintyValidationState {
  return PATH_CERTAINTY_VALIDATION_STATE_SET.has(state);
}

/**
 * Explicit projection of path validationState through claim language (P09-2).
 *
 * Certainty-bearing states (Reachable / Validated / Exploitable) are kept only
 * when hop measurement supports the corresponding claim flag. Otherwise they
 * remap to Discovered — never silently upgraded, never left as an overclaim.
 * Non-certainty states (Discovered, Inconclusive, Fixed, control/readiness, …)
 * pass through unchanged.
 *
 * Use this for findings projection, risk factor derivation, and write clamps so
 * AttackPath.validationState and ValidatedFinding.validationState cannot diverge
 * into two silent truths.
 */
export type PathValidationStateProjection = {
  claim: AttackPathClaim;
  /** Customer-visible certainty-safe validation state after claim gates. */
  claimSafeValidationState: AttackPath["validationState"];
  /** Recorded path row / requested workflow state (input). */
  recordedValidationState: AttackPath["validationState"];
  /** True when claimSafe differs from recorded (explicit remap, not silent). */
  remapped: boolean;
  /** Why remapped, when remapped; null when states already agree. */
  remapReason: string | null;
};

/**
 * Project path validationState through claim language so customer-visible
 * certainty never exceeds what hop measurement supports.
 */
export function projectPathValidationState(
  path: AttackPathClaimInput
): PathValidationStateProjection {
  const claim = deriveAttackPathClaim(path);
  const recorded = path.validationState;

  let claimSafe: AttackPath["validationState"] = recorded;
  let remapReason: string | null = null;

  if (recorded === "Exploitable") {
    if (claim.canClaimExploitable) {
      claimSafe = "Exploitable";
    } else {
      claimSafe = "Discovered";
      remapReason = claim.fullyMeasured
        ? "Recorded Exploitable is not claim-safe: hop measurement does not support an exploitable-path claim."
        : `Recorded Exploitable remapped: path is not fully measured (${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops Measured).`;
    }
  } else if (recorded === "Validated") {
    if (claim.canClaimValidated) {
      claimSafe = "Validated";
    } else {
      claimSafe = "Discovered";
      remapReason = claim.fullyMeasured
        ? "Recorded Validated is not claim-safe: hop measurement does not support a validated-path claim."
        : `Recorded Validated remapped: path is not fully measured (${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops Measured).`;
    }
  } else if (recorded === "Reachable") {
    if (claim.canClaimReachable) {
      claimSafe = "Reachable";
    } else {
      claimSafe = "Discovered";
      remapReason = claim.fullyMeasured
        ? "Recorded Reachable is not claim-safe: hop measurement does not support a reachable-path claim."
        : `Recorded Reachable remapped: path is not fully measured (${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops Measured).`;
    }
  }
  // Non-certainty states pass through. Claim language never upgrades them to
  // Reachable/Validated/Exploitable here (L3 weakest-link; no silent upgrade).

  return {
    claim,
    claimSafeValidationState: claimSafe,
    recordedValidationState: recorded,
    remapped: claimSafe !== recorded,
    remapReason
  };
}

/**
 * Convenience: claim-safe path validationState for writers and projectors.
 * Prefer `projectPathValidationState` when remap metadata is needed.
 */
export function claimSafePathValidationState(
  path: AttackPathClaimInput
): AttackPath["validationState"] {
  return projectPathValidationState(path).claimSafeValidationState;
}

/**
 * Write clamp: given path hop evidence and a requested validationState, return
 * the state that may be persisted without overclaiming certainty. Does not
 * invent Reachable/Validated/Exploitable — only keeps them when measurement
 * supports the claim, else remaps to Discovered.
 */
export function claimSafePathValidationStateForWrite(input: {
  evidenceBasis: AttackPath["evidenceBasis"];
  pathEdges: AttackPath["pathEdges"];
  requestedValidationState: AttackPath["validationState"];
}): AttackPath["validationState"] {
  return claimSafePathValidationState({
    evidenceBasis: input.evidenceBasis,
    pathEdges: input.pathEdges,
    validationState: input.requestedValidationState
  });
}

/**
 * Derive customer-visible path certainty from the weakest hop. Risk severity,
 * confidence, and impact never upgrade evidence certainty.
 *
 * P09-1: reachability/exploitability claims only apply to the path partition of
 * ValidationState. Control/remediation/readiness values on a path row are
 * dual-accounting leftovers and never upgrade path certainty language.
 */
export function deriveAttackPathClaim(
  path: AttackPathClaimInput
): AttackPathClaim {
  const totalEdgeCount = path.pathEdges.length;
  const measuredEdgeCount = path.pathEdges.filter(edgeCountsAsMeasured).length;
  // Path-level Measured alone is not enough: every hop must carry evidence IDs.
  const fullyMeasured =
    path.evidenceBasis === "Measured" &&
    totalEdgeCount > 0 &&
    measuredEdgeCount === totalEdgeCount;

  if (!fullyMeasured) {
    const partiallyMeasured = measuredEdgeCount > 0;
    return AttackPathClaimSchema.parse({
      canClaimExploitable: false,
      canClaimReachable: false,
      canClaimValidated: false,
      displayLabel: partiallyMeasured
        ? "Partially measured hypothesis"
        : "Heuristic hypothesis",
      fullyMeasured: false,
      kind: partiallyMeasured
        ? "PartiallyMeasuredHypothesis"
        : "HeuristicHypothesis",
      measuredEdgeCount,
      totalEdgeCount
    });
  }

  // Non-path ValidationState values (control/remediation/readiness) do not
  // support path certainty claims even when every hop is Measured.
  if (!isPathValidationState(path.validationState)) {
    return AttackPathClaimSchema.parse({
      canClaimExploitable: false,
      canClaimReachable: false,
      canClaimValidated: false,
      displayLabel: "Measured path",
      fullyMeasured: true,
      kind: "MeasuredPath",
      measuredEdgeCount,
      totalEdgeCount
    });
  }

  if (path.validationState === "Exploitable") {
    return AttackPathClaimSchema.parse({
      canClaimExploitable: true,
      canClaimReachable: true,
      canClaimValidated: true,
      displayLabel: "Measured exploitable path",
      fullyMeasured: true,
      kind: "MeasuredExploitable",
      measuredEdgeCount,
      totalEdgeCount
    });
  }

  if (path.validationState === "Validated") {
    return AttackPathClaimSchema.parse({
      canClaimExploitable: false,
      canClaimReachable: true,
      canClaimValidated: true,
      displayLabel: "Measured validated path",
      fullyMeasured: true,
      kind: "MeasuredValidated",
      measuredEdgeCount,
      totalEdgeCount
    });
  }

  if (REACHABLE_PATH_STATES.has(path.validationState)) {
    return AttackPathClaimSchema.parse({
      canClaimExploitable: false,
      canClaimReachable: true,
      canClaimValidated: false,
      displayLabel: "Measured reachable path",
      fullyMeasured: true,
      kind: "MeasuredReachable",
      measuredEdgeCount,
      totalEdgeCount
    });
  }

  // Remaining path-partition states: Discovered, Inconclusive.
  return AttackPathClaimSchema.parse({
    canClaimExploitable: false,
    canClaimReachable: false,
    canClaimValidated: false,
    displayLabel: "Measured path",
    fullyMeasured: true,
    kind: "MeasuredPath",
    measuredEdgeCount,
    totalEdgeCount
  });
}

function riskPrefix(band: RiskBand) {
  // P09-3: avoid bare "Fixed" wording that collides with remediation Fixed.
  return band === "Fixed" ? "Closed (risk)" : `${band}-risk`;
}

export function buildAttackPathRiskSummary(
  path: AttackPathClaimInput,
  band: RiskBand
): string {
  const claim = deriveAttackPathClaim(path);

  if (band === "Fixed") {
    return "Closed (risk) path band after verified residual closure; retain fresh verification evidence before relying on remediation Fixed status.";
  }

  if (claim.canClaimExploitable) {
    return `${riskPrefix(band)} measured exploitable path; prioritize remediation and measured re-validation.`;
  }

  if (claim.canClaimValidated) {
    return `${riskPrefix(band)} measured validated path; prioritize remediation and measured re-validation.`;
  }

  if (claim.canClaimReachable) {
    return `${riskPrefix(band)} measured reachable path; validate exploitability before making an exploitable-path claim.`;
  }

  if (claim.kind === "PartiallyMeasuredHypothesis") {
    return `${riskPrefix(band)} path hypothesis is ${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops measured; complete hop validation before treating it as reachable or validated.`;
  }

  return `${riskPrefix(band)} heuristic path hypothesis requires measurement before any reachable or validated-path claim.`;
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return count === 1 ? singular : pluralValue;
}

export function buildValidationSnapshotPathLanguage(
  assessments: readonly AttackPathAssessment[]
): { headline: string; overview: string } {
  if (assessments.length === 0) {
    return {
      headline: "No attack paths are available in the current evidence set.",
      overview:
        "Periscan has no path hypothesis or measured path to prioritize. This is an empty evidence state, not proof that the tenant has no exposure."
    };
  }

  const claims = assessments.map((assessment) =>
    deriveAttackPathClaim(assessment.attackPath)
  );
  const topAssessment = assessments[0]!;
  const topClaim = claims[0]!;
  const measuredValidatedCount = claims.filter(
    (claim) => claim.canClaimValidated
  ).length;
  const measuredReachableCount = claims.filter(
    (claim) => claim.canClaimReachable && !claim.canClaimValidated
  ).length;
  const hypothesisCount = claims.filter((claim) => !claim.fullyMeasured).length;
  const measuredOtherCount =
    claims.length -
    measuredValidatedCount -
    measuredReachableCount -
    hypothesisCount;

  const headline = topClaim.canClaimExploitable
    ? `${topAssessment.risk.band}-risk measured exploitable path requires action.`
    : topClaim.canClaimValidated
      ? `${topAssessment.risk.band}-risk measured validated path requires action.`
      : topClaim.canClaimReachable
        ? `${topAssessment.risk.band}-risk measured reachable path requires validation.`
        : `${topAssessment.risk.band}-risk path hypothesis requires validation.`;

  return {
    headline,
    overview: `Periscan prioritized ${assessments.length} ${plural(assessments.length, "attack path")} from verified scopes and connected systems: ${measuredValidatedCount} measured ${plural(measuredValidatedCount, "validated path")}, ${measuredReachableCount} measured ${plural(measuredReachableCount, "reachable path")}, ${measuredOtherCount} other fully measured ${plural(measuredOtherCount, "path")}, and ${hypothesisCount} ${plural(hypothesisCount, "hypothesis", "hypotheses")} awaiting complete hop measurement. Risk severity sets priority; only recorded edge evidence sets path certainty.`
  };
}

/**
 * Board / executive pack honesty metrics (P04-11).
 * Counts Measured vs Heuristic declared path basis and fully-measured hop ratio
 * so executive exports cannot hide hypothesis-heavy portfolios.
 */
export type ExecutivePathClaimHonesty = {
  fullyMeasuredCount: number;
  fullyMeasuredRatio: number;
  heuristicPathCount: number;
  hypothesisMode: boolean;
  measuredPathCount: number;
  partiallyMeasuredCount: number;
  totalPaths: number;
};

export function summarizeExecutivePathClaimHonesty(
  assessments: readonly AttackPathAssessment[]
): ExecutivePathClaimHonesty {
  const claims = assessments.map((assessment) =>
    deriveAttackPathClaim(assessment.attackPath)
  );
  const totalPaths = claims.length;
  const measuredPathCount = assessments.filter(
    (assessment) => assessment.attackPath.evidenceBasis === "Measured"
  ).length;
  const heuristicPathCount = totalPaths - measuredPathCount;
  const fullyMeasuredCount = claims.filter((claim) => claim.fullyMeasured).length;
  const partiallyMeasuredCount = claims.filter(
    (claim) => !claim.fullyMeasured && claim.measuredEdgeCount > 0
  ).length;
  const fullyMeasuredRatio =
    totalPaths === 0 ? 0 : fullyMeasuredCount / totalPaths;

  return {
    fullyMeasuredCount,
    fullyMeasuredRatio,
    heuristicPathCount,
    hypothesisMode: totalPaths > 0 && fullyMeasuredCount === 0,
    measuredPathCount,
    partiallyMeasuredCount,
    totalPaths
  };
}
