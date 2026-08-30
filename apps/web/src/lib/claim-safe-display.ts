/**
 * UX-W11 — product-wide claim-safe display helpers.
 *
 * Customer-visible certainty never exceeds hop measurement. Path cards already
 * use deriveAttackPathClaim / AttackPathClaimBadge; findings and other surfaces
 * must not render raw Reachable/Validated/Exploitable workflow state when the
 * finding is path-linked without fully-measured hop receipts.
 *
 * No claim upgrades — only remaps overclaims down to Discovered / hypothesis.
 */

import {
  deriveAttackPathClaim,
  isPathCertaintyValidationState,
  projectPathValidationState,
  summarizeExecutivePathClaimHonesty,
  type AttackPath,
  type AttackPathAssessment,
  type ValidatedFinding
} from "@periscan/shared";

export type FindingClaimDisplay = {
  /** Customer-visible validation state (claim-safe when path-linked). */
  displayValidationState: string;
  /** Path claim label from pathProof or derived honesty, when path-linked. */
  claimDisplayLabel: string | null;
  fullyMeasured: boolean;
  /** True when displayValidationState differs from recorded finding.validationState. */
  remapped: boolean;
  recordedValidationState: string;
  remapReason: string | null;
  /** Screen-reader / title string including claim-safe and remapped note. */
  ariaLabel: string;
  pathLinked: boolean;
};

function isPathLinkedFinding(finding: ValidatedFinding): boolean {
  return (
    finding.sourceEntityType === "AttackPath" ||
    finding.relatedPathIds.length > 0 ||
    finding.pathProof != null
  );
}

/**
 * Project a finding's validationState for UI display.
 *
 * Path-linked findings with certainty-bearing recorded state (Reachable /
 * Validated / Exploitable) are remapped to Discovered when hop proof does not
 * support full measurement. Prefer pathProof hop counts / fullyMeasured over
 * inventing FullyMeasured. Non-path findings pass through unchanged.
 */
export function projectFindingClaimDisplay(
  finding: ValidatedFinding
): FindingClaimDisplay {
  const recorded = finding.validationState;
  const pathLinked = isPathLinkedFinding(finding);
  const proof = finding.pathProof;

  if (!pathLinked) {
    return {
      displayValidationState: recorded,
      claimDisplayLabel: null,
      fullyMeasured: false,
      remapped: false,
      recordedValidationState: recorded,
      remapReason: null,
      ariaLabel: `Validation state ${recorded}`,
      pathLinked: false
    };
  }

  const measured =
    typeof proof?.measuredEdgeCount === "number" ? proof.measuredEdgeCount : null;
  const total =
    typeof proof?.totalEdgeCount === "number" ? proof.totalEdgeCount : null;
  const fullyMeasured =
    proof?.fullyMeasured === true &&
    total != null &&
    total > 0 &&
    measured != null &&
    measured === total;

  const claimDisplayLabel =
    proof?.claimDisplayLabel?.trim() ||
    (fullyMeasured
      ? null
      : measured != null && total != null && measured > 0
        ? "Partially measured hypothesis"
        : "Heuristic hypothesis");

  let displayValidationState = recorded;
  let remapped = false;
  let remapReason: string | null = null;

  if (isPathCertaintyValidationState(recorded) && !fullyMeasured) {
    displayValidationState = "Discovered";
    remapped = true;
    if (measured != null && total != null) {
      remapReason = `Recorded ${recorded} remapped: path is not fully measured (${measured}/${total} hops Measured).`;
    } else {
      remapReason = `Recorded ${recorded} remapped: path-linked finding lacks fully-measured hop receipts.`;
    }
  }

  const evidenceCertainty = claimDisplayLabel ?? displayValidationState;
  const ariaParts = [
    `Claim-safe validation state ${displayValidationState}`,
    `recorded ${recorded} vs evidence certainty ${evidenceCertainty}`,
    remapped ? `remapped from recorded ${recorded}` : null,
    claimDisplayLabel ? `path claim ${claimDisplayLabel}` : null,
    remapReason
  ].filter(Boolean);

  return {
    displayValidationState,
    claimDisplayLabel,
    fullyMeasured,
    remapped,
    recordedValidationState: recorded,
    remapReason,
    ariaLabel: ariaParts.join("; "),
    pathLinked: true
  };
}

/**
 * SR / title string for AttackPathClaimBadge.
 * Always includes "claim-safe" and explicit recorded vs evidence certainty
 * (P08 badge title discipline). Remapped note when recorded row state exceeds
 * hop measurement.
 */
export function buildAttackPathClaimAriaLabel(
  attackPath: Pick<AttackPath, "evidenceBasis" | "pathEdges" | "validationState">
): string {
  const projection = projectPathValidationState(attackPath);
  const claim = projection.claim;
  const evidenceCertainty = claim.displayLabel;
  const recorded = projection.recordedValidationState;
  const recordedVsEvidence = `recorded ${recorded} vs evidence certainty ${evidenceCertainty}`;
  if (projection.remapped) {
    return [
      `Path claim ${evidenceCertainty}, claim-safe`,
      recordedVsEvidence,
      `remapped from recorded ${recorded}`,
      projection.remapReason
    ]
      .filter(Boolean)
      .join("; ");
  }
  return [
    `Path claim ${evidenceCertainty}, claim-safe`,
    recordedVsEvidence,
    claim.totalEdgeCount > 0
      ? `${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops measured`
      : "no path hops recorded"
  ].join("; ");
}

/**
 * Compact claim-safe path preview for executive / dashboard / reports list.
 * Never surfaces raw Validated without hop support.
 */
export function formatPathClaimSnippet(
  attackPath: Pick<AttackPath, "evidenceBasis" | "pathEdges" | "validationState">
): string {
  const projection = projectPathValidationState(attackPath);
  const claim = projection.claim;
  const hops =
    claim.totalEdgeCount === 0
      ? "no hops"
      : `${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops`;
  if (projection.remapped) {
    return `${claim.displayLabel} · ${hops} · claim-safe (remapped from ${projection.recordedValidationState})`;
  }
  return `${claim.displayLabel} · ${hops} · claim-safe`;
}

/**
 * Snapshot / report list honesty line from top attack path assessments.
 */
export function formatSnapshotPathClaimPreview(
  assessments: readonly AttackPathAssessment[]
): string {
  if (assessments.length === 0) {
    return "No priority paths · claim-safe empty state";
  }
  const honesty = summarizeExecutivePathClaimHonesty(assessments);
  const top = assessments[0]!;
  const topClaim = deriveAttackPathClaim(top.attackPath);
  const topProjection = projectPathValidationState(top.attackPath);
  const topBit = topProjection.remapped
    ? `${topClaim.displayLabel} (remapped claim-safe)`
    : topClaim.displayLabel;
  if (honesty.hypothesisMode) {
    return `Top: ${topBit} · ${honesty.totalPaths} path${honesty.totalPaths === 1 ? "" : "s"}, all hypotheses · claim-safe`;
  }
  return `Top: ${topBit} · ${honesty.fullyMeasuredCount}/${honesty.totalPaths} fully measured · claim-safe`;
}
