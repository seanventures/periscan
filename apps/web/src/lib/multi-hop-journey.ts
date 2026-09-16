import {
  deriveAttackPathClaim,
  type AttackPath,
  type AttackPathAssessment
} from "@periscan/shared";

/**
 * Multi-hop productization helpers (P04-3 / P12-4 / P13-3 residual).
 *
 * Flagship primary CTA is **Measure path hops** only when:
 * - at least one path has hops that are not yet fully measured (receipts), and
 * - verified authorized scope exists (required for hop eligibility).
 *
 * Never label FullyMeasured without hop receipts — that stays in deriveAttackPathClaim.
 */

export type MultiHopMeasureCta = {
  /** Deep-link to first unmeasured path hop section, or paths list. */
  href: string;
  label: string;
  /**
   * True when unmeasured hops exist and scope is verified.
   * List surfaces cannot know true plan.eligibility=Eligible without N+1
   * validation-plan calls; unmeasured + verified scope is the honest
   * productization gate for the primary Measure CTA (detail page still
   * enforces Eligible / NeedsApproval per hop).
   */
  measureReady: boolean;
  firstPathId: string | null;
  unmeasuredPathCount: number;
  hopsMeasured: number;
  hopsTotal: number;
};

function pathFromAssessment(
  item: AttackPath | AttackPathAssessment
): AttackPath {
  return "attackPath" in item ? item.attackPath : item;
}

function riskScore(item: AttackPath | AttackPathAssessment): number {
  return "risk" in item && item.risk ? item.risk.score : 0;
}

/**
 * Prefer highest-risk path that still has unmeasured hops; fall back to any
 * path with hops, then first path overall.
 */
export function resolveMultiHopMeasureCta(input: {
  paths: readonly (AttackPath | AttackPathAssessment)[];
  scopeVerified: boolean;
}): MultiHopMeasureCta {
  const ranked = [...input.paths].sort(
    (a, b) => riskScore(b) - riskScore(a)
  );

  let hopsMeasured = 0;
  let hopsTotal = 0;
  let unmeasuredPathCount = 0;
  let firstUnmeasuredId: string | null = null;
  let firstWithHopsId: string | null = null;

  for (const item of ranked) {
    const path = pathFromAssessment(item);
    const claim = deriveAttackPathClaim(path);
    hopsMeasured += claim.measuredEdgeCount;
    hopsTotal += claim.totalEdgeCount;

    if (claim.totalEdgeCount > 0 && !firstWithHopsId) {
      firstWithHopsId = path.pathId;
    }
    if (claim.totalEdgeCount > 0 && !claim.fullyMeasured) {
      unmeasuredPathCount += 1;
      if (!firstUnmeasuredId) {
        firstUnmeasuredId = path.pathId;
      }
    }
  }

  const firstPathId =
    firstUnmeasuredId ??
    firstWithHopsId ??
    (ranked[0] ? pathFromAssessment(ranked[0]).pathId : null);

  const measureReady =
    Boolean(firstUnmeasuredId) && input.scopeVerified && hopsTotal > 0;

  if (measureReady && firstUnmeasuredId) {
    return {
      href: `/attack-paths/${firstUnmeasuredId}#hop-measurement`,
      label: "Measure path hops",
      measureReady: true,
      firstPathId: firstUnmeasuredId,
      unmeasuredPathCount,
      hopsMeasured,
      hopsTotal
    };
  }

  if (firstPathId && hopsTotal > 0) {
    // Paths exist with hops but scope not verified — still deep-link; do not
    // claim the Measure primary until scope is ready.
    return {
      href: `/attack-paths/${firstPathId}#hop-measurement`,
      label: input.scopeVerified
        ? "Inspect weakest hop"
        : "Open path (authorize scope to measure)",
      measureReady: false,
      firstPathId,
      unmeasuredPathCount,
      hopsMeasured,
      hopsTotal
    };
  }

  if (firstPathId) {
    return {
      href: `/attack-paths/${firstPathId}#hop-measurement`,
      label: "Inspect path",
      measureReady: false,
      firstPathId,
      unmeasuredPathCount,
      hopsMeasured,
      hopsTotal
    };
  }

  return {
    href: "/attack-paths",
    label: "Open attack paths",
    measureReady: false,
    firstPathId: null,
    unmeasuredPathCount: 0,
    hopsMeasured: 0,
    hopsTotal: 0
  };
}

/**
 * Path-detail primary CTA for the multi-hop journey.
 * Never claims Measure when hops are fully measured, when no edges exist, or
 * when verified scope is missing (list hub uses the same honesty gates).
 */
export function resolvePathDetailMeasureCta(input: {
  fullyMeasured: boolean;
  totalEdgeCount: number;
  measuredEdgeCount: number;
  scopeVerified: boolean;
  hasBreakers: boolean;
}): { href: string; label: string; measureReady: boolean } {
  if (input.fullyMeasured) {
    return {
      href: input.hasBreakers ? "#path-breakers" : "#hop-measurement",
      label: input.hasBreakers
        ? "Choose a path breaker"
        : "Inspect hop receipts",
      measureReady: false
    };
  }

  if (input.totalEdgeCount === 0) {
    return {
      href: "#hop-measurement",
      label: "Inspect path",
      measureReady: false
    };
  }

  if (!input.scopeVerified) {
    return {
      href: "#hop-measurement",
      label: "Open hop plan (authorize scope to measure)",
      measureReady: false
    };
  }

  // Unmeasured or partial hops with verified scope → flagship Measure CTA.
  // ICP-P1-15: path detail primary = "Measure hops" (per-hop), not whole-path mission.
  return {
    href: "#hop-measurement",
    label: "Measure hops",
    measureReady: true
  };
}

/** In-product operator journey entry (docs/MULTI_HOP_MEASURED_OPERATOR_JOURNEY.md). */
export const MULTI_HOP_OPERATOR_JOURNEY = {
  /** Paths hub — product help id `attack-paths` teaches the hop loop. */
  pathsHref: "/attack-paths",
  /** Getting-started leads with Measure multi-hop after first proof. */
  gettingStartedHref: "/getting-started",
  /** Human label for links from Continuous / Paths hubs. */
  label: "Multi-hop operator journey",
  summary:
    "Measure each hop with safe probes, confirm edge receipts with evidence IDs, then choose breakers. FullyMeasured only when every hop has receipts — launch never upgrades certainty."
} as const;
