import { z } from "zod";

/**
 * Canonical control-effectiveness state model (Slice 5 / PERISCAN-8).
 *
 * One denominator across Controls, Dashboard, Findings, Reports, and Schedules.
 * Product-visible claims must come from real observations, evidence, or an
 * honest empty/not-tested state — never from invented BAS live execution or
 * fixture-only promotion into Prevented/Missed.
 *
 * ## States (claim strength, strongest → weakest productive claim)
 *
 * - **Prevented** — authorized observation produced prevention/block evidence.
 * - **Detected** — detection/alert/route evidence without prevention proof.
 * - **TelemetryOnly** — log-only telemetry without detection/alert routing.
 * - **Missed** — completed observation with emission/correlation proof that the
 *   control did not detect or prevent.
 * - **NoEvidence** — observation window completed; no matching telemetry found.
 * - **Inconclusive** — incomplete window, ambiguous outcome, stale evidence, or
 *   tuning-only signal that does not support a stronger claim.
 * - **NotTested** — no observation has been attempted for this control/scenario.
 *
 * ## Mapping rules
 *
 * 1. Prefer an explicit stimulus/observer `verdict` when present.
 * 2. Otherwise map legacy `coverageStatus` (DetectionRuleCoverageStatus).
 * 3. Otherwise derive from observation flags + observed behaviors.
 * 4. **Never invent Prevented or Missed without supporting evidence.**
 *    - Prevented/Detected/TelemetryOnly require at least one of: evidence IDs,
 *      correlation match, or (for TelemetryOnly/Detected) an observed behavior
 *      that already encodes the weaker claim with evidenceIds.
 *    - Missed requires a completed observation plus emission receipt and/or
 *      correlation match, plus evidence trail. Without that proof, downgrade
 *      to NoEvidence (window completed) or Inconclusive (window incomplete).
 * 5. Stale or NeedsTuning coverage statuses map to **Inconclusive** — they do
 *    not support a current Prevented/Detected/Missed claim.
 * 6. TelemetryOnly is weaker than Detected: log-only must not promote to
 *    Detected; Detected must not promote to Prevented without block evidence.
 *
 * ## Legacy DetectionRuleCoverageStatus → ControlEffectivenessState
 *
 * | Coverage status | Effectiveness state |
 * |-----------------|---------------------|
 * | Blocked         | Prevented           |
 * | Covered         | Detected            |
 * | LoggedOnly      | TelemetryOnly       |
 * | Missed          | Missed              |
 * | NoEvidence      | NoEvidence          |
 * | NeedsTuning     | Inconclusive        |
 * | Stale           | Inconclusive        |
 * | NotTested       | NotTested           |
 *
 * ## ControlValidationVerdict → ControlEffectivenessState
 *
 * | Verdict                    | Effectiveness state (when evidence gates pass) |
 * |----------------------------|------------------------------------------------|
 * | Prevented                  | Prevented                                      |
 * | Detected                   | Detected                                       |
 * | TelemetryOnly              | TelemetryOnly                                  |
 * | Missed                     | Missed                                         |
 * | Inconclusive               | Inconclusive                                   |
 * | NotObservedBeforeTimeout   | Inconclusive                                   |
 */

export const ControlEffectivenessStateSchema = z.enum([
  "NotTested",
  "NoEvidence",
  "Inconclusive",
  "TelemetryOnly",
  "Detected",
  "Prevented",
  "Missed"
]);
export type ControlEffectivenessState = z.infer<
  typeof ControlEffectivenessStateSchema
>;

/** Ordered for UI roll-ups and strength comparisons (higher = stronger claim). */
export const CONTROL_EFFECTIVENESS_STRENGTH: Record<
  ControlEffectivenessState,
  number
> = {
  Prevented: 6,
  Detected: 5,
  TelemetryOnly: 4,
  Missed: 3,
  NoEvidence: 2,
  Inconclusive: 1,
  NotTested: 0
};

/**
 * Legacy detection-rule coverage statuses. Kept as a local enum so this module
 * does not create a circular import with domain.ts (domain imports helpers here).
 */
export const ControlEffectivenessCoverageStatusSchema = z.enum([
  "Covered",
  "Blocked",
  "LoggedOnly",
  "Missed",
  "NoEvidence",
  "NeedsTuning",
  "Stale",
  "NotTested"
]);
export type ControlEffectivenessCoverageStatus = z.infer<
  typeof ControlEffectivenessCoverageStatusSchema
>;

export const ControlEffectivenessVerdictSchema = z.enum([
  "Prevented",
  "Detected",
  "TelemetryOnly",
  "Missed",
  "Inconclusive",
  "NotObservedBeforeTimeout"
]);
export type ControlEffectivenessVerdict = z.infer<
  typeof ControlEffectivenessVerdictSchema
>;

export const ControlEffectivenessObservedBehaviorSchema = z.enum([
  "Detected",
  "Blocked",
  "Logged",
  "Alerted",
  "Routed",
  "Missed",
  "NoEvidence",
  "NeedsTuning"
]);
export type ControlEffectivenessObservedBehavior = z.infer<
  typeof ControlEffectivenessObservedBehaviorSchema
>;

/**
 * Observation facts used to derive a single effectiveness state.
 * All fields are optional so callers can supply whatever is known; missing
 * evidence never upgrades a claim.
 */
export const ControlEffectivenessObservationSchema = z.object({
  /** True when emission/dispatch receipt exists for the stimulus under test. */
  correlationMatched: z.boolean().default(false),
  /**
   * Legacy rule-coverage status already derived from signals. Mapping this
   * alone is safe because coverage already required a real signal for any
   * non-NotTested value.
   */
  coverageStatus: ControlEffectivenessCoverageStatusSchema.nullish(),
  /** True when a matching emission receipt exists (required for Missed). */
  emissionReceiptPresent: z.boolean().default(false),
  /** Evidence artifact IDs backing the claim. */
  evidenceIds: z.array(z.string()).default([]),
  /** Explicit "no matching telemetry" after a completed observation. */
  noEvidenceObserved: z.boolean().default(false),
  /** Observed control behaviors from normalized signals. */
  observedBehaviors: z
    .array(ControlEffectivenessObservedBehaviorSchema)
    .default([]),
  /** True when an observer/stimulus dispatch was attempted. */
  observationAttempted: z.boolean().default(false),
  /** True when the observation window finished (success or timeout). */
  observationCompleted: z.boolean().default(false),
  /** Explicit stimulus/observer verdict when available. */
  verdict: ControlEffectivenessVerdictSchema.nullish()
});
export type ControlEffectivenessObservation = z.infer<
  typeof ControlEffectivenessObservationSchema
>;

export type ControlEffectivenessObservationInput = z.input<
  typeof ControlEffectivenessObservationSchema
>;

function hasSupportingEvidence(
  input: ControlEffectivenessObservation
): boolean {
  return (
    input.evidenceIds.length > 0 ||
    input.correlationMatched ||
    input.emissionReceiptPresent
  );
}

/**
 * Map legacy DetectionRuleCoverageStatus into the canonical effectiveness
 * model. Coverage statuses are already evidence-derived for non-NotTested
 * values, so this mapping does not re-check evidence IDs.
 */
export function mapDetectionRuleCoverageStatusToEffectiveness(
  status: ControlEffectivenessCoverageStatus
): ControlEffectivenessState {
  switch (status) {
    case "Blocked":
      return "Prevented";
    case "Covered":
      return "Detected";
    case "LoggedOnly":
      return "TelemetryOnly";
    case "Missed":
      return "Missed";
    case "NoEvidence":
      return "NoEvidence";
    case "NeedsTuning":
    case "Stale":
      return "Inconclusive";
    case "NotTested":
      return "NotTested";
  }
}

/**
 * Map a ControlValidationVerdict into the canonical model without inventing
 * Prevented/Missed when supporting evidence is absent.
 */
export function mapControlValidationVerdictToEffectiveness(
  verdict: ControlEffectivenessVerdict,
  evidence: Pick<
    ControlEffectivenessObservation,
    | "correlationMatched"
    | "emissionReceiptPresent"
    | "evidenceIds"
    | "observationCompleted"
  >
): ControlEffectivenessState {
  const supported = hasSupportingEvidence({
    correlationMatched: evidence.correlationMatched,
    coverageStatus: null,
    emissionReceiptPresent: evidence.emissionReceiptPresent,
    evidenceIds: evidence.evidenceIds,
    noEvidenceObserved: false,
    observedBehaviors: [],
    observationAttempted: true,
    observationCompleted: evidence.observationCompleted,
    verdict
  });

  switch (verdict) {
    case "Prevented":
      return supported ? "Prevented" : "Inconclusive";
    case "Detected":
      return supported ? "Detected" : "Inconclusive";
    case "TelemetryOnly":
      return supported ? "TelemetryOnly" : "Inconclusive";
    case "Missed":
      // Missed is the strongest negative claim: require completed window plus
      // emission/correlation proof and an evidence trail.
      if (
        evidence.observationCompleted &&
        (evidence.emissionReceiptPresent || evidence.correlationMatched) &&
        evidence.evidenceIds.length > 0
      ) {
        return "Missed";
      }
      if (evidence.observationCompleted) {
        return "NoEvidence";
      }
      return "Inconclusive";
    case "Inconclusive":
    case "NotObservedBeforeTimeout":
      return "Inconclusive";
  }
}

function deriveFromBehaviors(
  input: ControlEffectivenessObservation
): ControlEffectivenessState {
  const behaviors = new Set(input.observedBehaviors);
  const supported = hasSupportingEvidence(input);

  // Order is conservative: prevention first, then detection, then log-only.
  // Logged must not promote to Detected; Detected must not promote to Prevented.
  if (behaviors.has("Blocked")) {
    return supported ? "Prevented" : "Inconclusive";
  }
  if (
    behaviors.has("Detected") ||
    behaviors.has("Alerted") ||
    behaviors.has("Routed")
  ) {
    return supported ? "Detected" : "Inconclusive";
  }
  if (behaviors.has("Logged")) {
    return supported ? "TelemetryOnly" : "Inconclusive";
  }
  if (behaviors.has("Missed")) {
    if (
      input.observationCompleted &&
      (input.emissionReceiptPresent || input.correlationMatched) &&
      input.evidenceIds.length > 0
    ) {
      return "Missed";
    }
    return input.observationCompleted ? "NoEvidence" : "Inconclusive";
  }
  if (behaviors.has("NoEvidence") || input.noEvidenceObserved) {
    return "NoEvidence";
  }
  if (behaviors.has("NeedsTuning")) {
    return "Inconclusive";
  }

  if (input.noEvidenceObserved) {
    return "NoEvidence";
  }

  // Observation completed without a classifiable productive outcome.
  return "Inconclusive";
}

/**
 * Derive the single canonical control-effectiveness state from observation
 * facts. Pure: no I/O, no persistence, no BAS execution.
 */
export function deriveControlEffectivenessState(
  raw: ControlEffectivenessObservationInput
): ControlEffectivenessState {
  const input = ControlEffectivenessObservationSchema.parse(raw);

  if (input.verdict) {
    return mapControlValidationVerdictToEffectiveness(input.verdict, input);
  }

  if (input.coverageStatus) {
    return mapDetectionRuleCoverageStatusToEffectiveness(input.coverageStatus);
  }

  if (!input.observationAttempted) {
    return "NotTested";
  }

  if (!input.observationCompleted) {
    return "Inconclusive";
  }

  if (
    input.noEvidenceObserved &&
    input.observedBehaviors.length === 0
  ) {
    return "NoEvidence";
  }

  return deriveFromBehaviors(input);
}

/**
 * Ensure a coverage item carries the canonical effectiveness state.
 * Safe for persisted snapshots that predate the field.
 */
export function ensureCoverageItemEffectivenessState<
  T extends {
    coverageStatus?: ControlEffectivenessCoverageStatus | null;
    effectivenessState?: ControlEffectivenessState | null;
    status?: ControlEffectivenessCoverageStatus | null;
  }
>(item: T): T & { effectivenessState: ControlEffectivenessState } {
  if (item.effectivenessState) {
    return {
      ...item,
      effectivenessState: item.effectivenessState
    };
  }

  const status = item.status ?? item.coverageStatus ?? "NotTested";
  return {
    ...item,
    effectivenessState: mapDetectionRuleCoverageStatusToEffectiveness(status)
  };
}

/**
 * P09-8: single pure map from path-edge control relationships → the product
 * control atom (ControlEffectivenessState). Non-control edge types return null
 * so callers do not invent effectiveness from CAN_ACCESS / EXPOSES / etc.
 *
 * ControlState / ControlValidationVerdict / ValidationState control outcomes
 * must all reduce through this module — never invent parallel bridges.
 */
export const CONTROL_EDGE_RELATIONSHIPS = [
  "DETECTED_BY",
  "BLOCKED_BY",
  "MISSED_BY",
  "OBSERVED_BY"
] as const;
export type ControlEdgeRelationship =
  (typeof CONTROL_EDGE_RELATIONSHIPS)[number];

export function isControlEdgeRelationship(
  relationship: string
): relationship is ControlEdgeRelationship {
  return (CONTROL_EDGE_RELATIONSHIPS as readonly string[]).includes(
    relationship
  );
}

/**
 * Map a graph/path edge relationship to ControlEffectivenessState.
 * Requires evidence for productive claims (same honesty as verdict maps).
 */
export function mapEdgeRelationshipToControlEffectiveness(
  relationship: string,
  evidence: {
    evidenceIds?: readonly string[] | null;
    correlationMatched?: boolean;
    emissionReceiptPresent?: boolean;
  } = {}
): ControlEffectivenessState | null {
  if (!isControlEdgeRelationship(relationship)) {
    return null;
  }

  const evidenceIds = evidence.evidenceIds ?? [];
  const supported =
    evidenceIds.length > 0 ||
    evidence.correlationMatched === true ||
    evidence.emissionReceiptPresent === true;

  switch (relationship) {
    case "BLOCKED_BY":
      return supported ? "Prevented" : "Inconclusive";
    case "DETECTED_BY":
      return supported ? "Detected" : "Inconclusive";
    case "MISSED_BY":
      if (
        (evidence.emissionReceiptPresent || evidence.correlationMatched) &&
        evidenceIds.length > 0
      ) {
        return "Missed";
      }
      return supported ? "NoEvidence" : "Inconclusive";
    case "OBSERVED_BY":
      return supported ? "TelemetryOnly" : "Inconclusive";
  }
}

/** Legacy ControlState → effectiveness (product atom only). */
export function mapControlStateToEffectiveness(
  controlState: string
): ControlEffectivenessState {
  switch (controlState) {
    case "Blocked":
      return "Prevented";
    case "Detected":
    case "Alerted":
    case "Routed":
      return "Detected";
    case "Logged":
      return "TelemetryOnly";
    case "Missed":
      return "Missed";
    case "NoEvidence":
      return "NoEvidence";
    case "NeedsTuning":
      return "Inconclusive";
    default:
      return "NotTested";
  }
}

export const CONTROL_LANGUAGE_LAW =
  "ControlEffectivenessState is the only product-visible control atom. Map verdict → effectiveness, edge relationship → effectiveness, and legacy ControlState → effectiveness only through this module. ValidationState must not store control outcomes long-term.";
