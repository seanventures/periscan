/**
 * P09 ontology laws — machine-checkable acceptance gates
 * ------------------------------------------------------
 * Einstein panel Five Laws (P09-17) plus composition rules for identity,
 * inventory, threats, risk, control language, taxonomy, and clocks.
 *
 * These are pure predicates/maps for schema/API acceptance tests and writers.
 * They do not invent product data; they codify which coordinates are physics
 * vs packaging.
 *
 * Law 1 — Authorization: No validation without verified Scope.
 * Law 2 — Grounding: No conclusion without evidenceIds (or explicit
 *         MissingSignal / NotConfigured).
 * Law 3 — Weakest link: Path claim = min(edge measurement).
 * Law 4 — Closure: Fixed only via VerificationEvent (see fixed-verification).
 * Law 5 — Language: Severity ranks priority; claim language ranks certainty;
 *         never conflate.
 */

import { z } from "zod";

import type { CTEMStage, ProofLoopStage } from "./domain";
import {
  isRemediationFixedAuthorizedByVerification,
  type RemediationFixedAuthorizationInput
} from "./fix-verification";

// ---------------------------------------------------------------------------
// Five Laws registry (P09-17)
// ---------------------------------------------------------------------------

export const ONTOLOGY_LAW_IDS = [
  "authorization",
  "grounding",
  "weakest_link",
  "closure",
  "language"
] as const;
export type OntologyLawId = (typeof ONTOLOGY_LAW_IDS)[number];

/**
 * Runtime Five Laws registry (authorization/grounding/weakest-link/closure/language).
 * Distinct from claim-deny-list `ONTOLOGY_LAWS` (L1–L5 packaging gates).
 */
export const ONTOLOGY_FIVE_LAWS: Record<
  OntologyLawId,
  { id: OntologyLawId; title: string; statement: string; gateHint: string }
> = {
  authorization: {
    id: "authorization",
    title: "Authorization",
    statement: "No validation without verified Scope.",
    gateHint:
      "Denied tasks must never be queued; missions require verified scope + policy decision."
  },
  grounding: {
    id: "grounding",
    title: "Grounding",
    statement:
      "No customer-visible conclusion without evidenceIds (or explicit MissingSignal / NotConfigured).",
    gateHint:
      "Measured / Validated / Exploitable claims require hop evidence or honest readiness state."
  },
  weakest_link: {
    id: "weakest_link",
    title: "Weakest link",
    statement: "Path claim = min(edge measurement). Severity never upgrades certainty.",
    gateHint: "Use claim-language projectPathValidationState / deriveAttackPathClaim."
  },
  closure: {
    id: "closure",
    title: "Closure",
    statement: "Fixed only via VerificationEvent (measured revalidation).",
    gateHint: "assertRemediationFixedOnlyViaVerification; disposition cannot Fixed."
  },
  language: {
    id: "language",
    title: "Language",
    statement:
      "Severity ranks priority; claim language ranks certainty; never conflate the two.",
    gateHint:
      "priorityScore composition cites path/signal risk; certainty uses claim kinds only."
  }
};

/** @deprecated Prefer ONTOLOGY_FIVE_LAWS — kept for local imports during transition. */
export const ONTOLOGY_LAWS = ONTOLOGY_FIVE_LAWS;

/** Schema PR checklist items (human + test gate). */
export const ONTOLOGY_PR_CHECKLIST = [
  "No new top-level entity restating Asset, Signal, Path, Finding, or Evidence under a new brand.",
  "No new status enum overlapping ValidationState without an explicit partition plan.",
  "Fixed is only written via measured verification (fixed-verification chokepoint).",
  "Every product-visible score cites the risk composition law.",
  "Pillars / sourceMotion are tags or derived labels — not a second MissionType system."
] as const;

// ---------------------------------------------------------------------------
// P09-3 Finding identity law
// ---------------------------------------------------------------------------

/**
 * Findings are a **projection** (ValidatedFinding) + **disposition overlay**.
 * Stable cause identity is `fingerprint` (groupKey is the human/root-cause
 * cluster). `findingId` remains the disposition row key for path/signal
 * representatives (pathId/signalId) for backward compatibility — it is NOT
 * the system of record for root-cause identity.
 */
export const FINDING_IDENTITY_LAW = {
  projection: "ValidatedFinding is derived; not a first-class table of record.",
  stableCauseId: "fingerprint",
  dispositionKey:
    "findingId (currently representative pathId/signalId; future: fingerprint)",
  sourceLinks: ["sourceEntityId", "relatedPathIds", "relatedAssetIds"] as const
} as const;

export type FindingIdentityFields = {
  findingId: string;
  fingerprint?: string | null;
  groupKey?: string | null;
  sourceEntityId?: string | null;
};

/**
 * Operational cause id for triage/SLA/dedup. Prefers fingerprint when present;
 * falls back to findingId for legacy rows (pre-grouping / fixtures).
 */
export function resolveFindingCauseId(
  finding: FindingIdentityFields
): string {
  const fp = finding.fingerprint?.trim();
  if (fp && fp.length > 0) {
    return fp;
  }
  return finding.findingId;
}

/**
 * Public list shape must carry merge metadata (P09-4). Pre-merge rows may
 * omit fields internally; operators must never see missing occurrenceCount.
 */
export function isOperationalFindingIdentityComplete(finding: {
  fingerprint?: string | null;
  groupKey?: string | null;
  occurrenceCount?: number | null;
}): boolean {
  return (
    typeof finding.fingerprint === "string" &&
    finding.fingerprint.length > 0 &&
    typeof finding.groupKey === "string" &&
    finding.groupKey.length > 0 &&
    typeof finding.occurrenceCount === "number" &&
    Number.isInteger(finding.occurrenceCount) &&
    finding.occurrenceCount >= 1
  );
}

export function normalizeOccurrenceCount(
  occurrenceCount: number | null | undefined
): number {
  if (
    typeof occurrenceCount === "number" &&
    Number.isInteger(occurrenceCount) &&
    occurrenceCount >= 1
  ) {
    return occurrenceCount;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// P09-5 Scope ↔ Asset authorization binding (contract; durable join)
// ---------------------------------------------------------------------------

/**
 * Scope is authorization; Asset is inventory. Binding lifecycle answers
 * "is this inventory entity in the authorized set?" without collapsing the two.
 */
export const ScopeAssetBindingStatusSchema = z.enum([
  "DiscoveredInScope",
  "Authorized",
  "Rejected"
]);
export type ScopeAssetBindingStatus = z.infer<
  typeof ScopeAssetBindingStatusSchema
>;

export const ScopeAssetBindingSchema = z.object({
  bindingId: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  scopeId: z.string().uuid(),
  assetId: z.string().uuid(),
  status: ScopeAssetBindingStatusSchema,
  /** Optional strong identifiers observed at bind time (hostname, ARN, etc.). */
  matchedIdentifiers: z.array(z.string().min(1)).default([]),
  note: z.string().min(1).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});
export type ScopeAssetBinding = z.infer<typeof ScopeAssetBindingSchema>;

export const SCOPE_ASSET_JOIN_LAW =
  "Authorization (Scope) and inventory (Asset) stay distinct; durable join is ScopeAssetBinding with lifecycle DiscoveredInScope | Authorized | Rejected. Ownership review remains judgment; binding is physics.";

// ---------------------------------------------------------------------------
// P09-6 Inventory multiverse reduction
// ---------------------------------------------------------------------------

export const INVENTORY_REDUCTION_LAW = {
  durable: "Asset + AssetSourceObservation + GraphNode",
  projectionOnly:
    "AssetInventoryEntry / TerrainQuery / LivingMapDelta are Labs/fixture DTOs over Asset+GraphNode — not a second inventory product model",
  scopeClassification: "ScopeAssetClass describes authorization envelope class only"
} as const;

/** Collapse synonym coverage tags (K8s → Kubernetes). */
export function normalizeAssetCoverageTag(tag: string): string {
  if (tag === "K8s") {
    return "Kubernetes";
  }
  return tag;
}

export function normalizeAssetCoverageTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    const n = normalizeAssetCoverageTag(tag);
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// P09-7 Threat dual-stack subsumption
// ---------------------------------------------------------------------------

/**
 * Single threat particle chain (feed → relevance → curated workflow → action).
 *
 * ThreatIntelItem (global particle)
 *   → TenantThreatAlert (tenant relevance)
 *   → ThreatAdvisory (curated program workflow)
 *   → MissingSignal / ValidationPlan (actionable gaps)
 */
export const THREAT_SUBSUMPTION_ORDER = [
  "ThreatIntelItem",
  "TenantThreatAlert",
  "ThreatAdvisory",
  "MissingSignal",
  "ValidationPlan"
] as const;
export type ThreatSubsumptionLayer = (typeof THREAT_SUBSUMPTION_ORDER)[number];

export const THREAT_SUBSUMPTION_LAW =
  "ThreatIntelItem is the global feed particle; TenantThreatAlert is tenant relevance; ThreatAdvisory is curated workflow; MissingSignal/ValidationPlan are actionable gaps. Prefer linking advisory.externalId to intel.canonicalKey. One product nav object Threats with feed vs program tabs.";

export function isThreatSubsumptionLayer(value: string): value is ThreatSubsumptionLayer {
  return (THREAT_SUBSUMPTION_ORDER as readonly string[]).includes(value);
}

export function threatLayerIndex(layer: ThreatSubsumptionLayer): number {
  return THREAT_SUBSUMPTION_ORDER.indexOf(layer);
}

/** True when `upper` may subsume / feed into `lower` in the chain. */
export function threatLayerFeeds(
  upper: ThreatSubsumptionLayer,
  lower: ThreatSubsumptionLayer
): boolean {
  return threatLayerIndex(upper) < threatLayerIndex(lower);
}

// ---------------------------------------------------------------------------
// P09-9 Risk composition law
// ---------------------------------------------------------------------------

export const RISK_COMPOSITION_LAW =
  "priorityScore = clamp(baseRisk + missingSignalImpact + dispositionAdjustment, 0, 100). Money (FAIR) and NHI hygiene scores are separate axes — never mix into the primary triage number without explicit composition. Certainty is claim language, not a risk number.";

export type FindingPriorityCompositionInput = {
  /** Path risk 0–100 or signal base risk 0–100. */
  baseRisk: number;
  /** Optional uplift/penalty from MissingSignal impact (typically −20…+30). */
  missingSignalImpact?: number | null;
  /**
   * Disposition adjustment: FalsePositive/Suppressed strongly demote;
   * AcceptedRisk soft-demotes; default 0.
   */
  dispositionAdjustment?: number | null;
};

export function clampPriorityScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Single composition law for product-visible finding priority (P09-9).
 * Callers supply already-derived baseRisk (path calculateRiskScore or signal
 * base); this function never invents severity from certainty alone.
 */
export function composeFindingPriorityScore(
  input: FindingPriorityCompositionInput
): number {
  const base = Number.isFinite(input.baseRisk) ? input.baseRisk : 0;
  const missing =
    typeof input.missingSignalImpact === "number" &&
    Number.isFinite(input.missingSignalImpact)
      ? input.missingSignalImpact
      : 0;
  const disposition =
    typeof input.dispositionAdjustment === "number" &&
    Number.isFinite(input.dispositionAdjustment)
      ? input.dispositionAdjustment
      : 0;
  return clampPriorityScore(base + missing + disposition);
}

export function dispositionPriorityAdjustment(
  disposition: string | null | undefined
): number {
  switch (disposition) {
    case "FalsePositive":
      return -80;
    case "Suppressed":
      return -60;
    case "AcceptedRisk":
      return -25;
    case "Duplicate":
      return -40;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// P09-10 Mission / Scenario / Pillar / sourceMotion taxonomy
// ---------------------------------------------------------------------------

export const OPERATIONAL_TAXONOMY_LAW = {
  operationalRunType:
    "MissionType (or ScenarioType for scenario packs) is the single operational run type.",
  pillars:
    "ValidationPillar is packaging/tags on modules and packs only — never a third MissionType.",
  sourceMotion:
    "sourceMotion is a derived finding tag from module/signal category; never hardcode APT for all paths.",
  continuousValidation:
    "ContinuousValidation is a MissionType schedule mode, not a separate ontology particle."
} as const;

export type SourceMotionHint = {
  signalCategory?: string | null;
  signalSubcategory?: string | null;
  methodology?: string | null;
  pathName?: string | null;
  moduleCategory?: string | null;
};

/**
 * Derive finding sourceMotion from signal/module/path hints (P09-10).
 * Defaults to APT only for attack-path narratives without a clearer category.
 */
export function deriveFindingSourceMotion(
  hint: SourceMotionHint
): "BAS" | "APT" | "EXV" | "AIApp" | "Cloud" | "Secrets" | "FixVerification" {
  const cat = (hint.signalCategory ?? "").toLowerCase();
  const sub = (hint.signalSubcategory ?? "").toLowerCase();
  const method = (hint.methodology ?? "").toLowerCase();
  const name = (hint.pathName ?? "").toLowerCase();
  const moduleCat = (hint.moduleCategory ?? "").toLowerCase();

  if (
    cat === "controlobservation" ||
    moduleCat.includes("control") ||
    moduleCat.includes("bas") ||
    method.includes("bas") ||
    method.includes("atomic")
  ) {
    return "BAS";
  }
  if (cat === "aiapplication" || moduleCat.includes("ai") || name.includes("llm")) {
    return "AIApp";
  }
  if (cat === "cloud" || moduleCat.includes("cloud") || method.includes("cloud")) {
    return "Cloud";
  }
  if (
    (cat === "repository" && sub.includes("secret")) ||
    moduleCat.includes("secret") ||
    method.includes("secret") ||
    name.includes("secret")
  ) {
    return "Secrets";
  }
  if (
    cat === "exposure" ||
    moduleCat.includes("exposure") ||
    method.includes("exv") ||
    name.includes("exposure")
  ) {
    return "EXV";
  }
  if (
    method.includes("fix") ||
    method.includes("retest") ||
    name.includes("fix verification")
  ) {
    return "FixVerification";
  }
  // Attack-path default: multi-hop narrative motion
  return "APT";
}

// ---------------------------------------------------------------------------
// P09-11 Three clocks → one canonical + aliases
// ---------------------------------------------------------------------------

/**
 * Canonical product clock is ProofLoopStage. CTEM stages are aliases for
 * program packaging / executive views — not a second physics.
 */
export const CANONICAL_PROOF_CLOCK = "ProofLoopStage" as const;

export const CTEM_TO_PROOF_LOOP: Record<CTEMStage, ProofLoopStage[]> = {
  Scope: ["Authorize"],
  Discover: ["Connect", "Validate"],
  Prioritize: ["Understand"],
  Validate: ["Validate"],
  Mobilize: ["Act"],
  Verify: ["Verify", "Prove", "Repeat"]
};

export const PROOF_LOOP_TO_CTEM: Record<ProofLoopStage, CTEMStage> = {
  Connect: "Discover",
  Authorize: "Scope",
  Validate: "Validate",
  Understand: "Prioritize",
  Act: "Mobilize",
  Verify: "Verify",
  Prove: "Verify",
  Repeat: "Verify"
};

export function mapCtemStageToProofLoop(stage: CTEMStage): ProofLoopStage {
  const mapped = CTEM_TO_PROOF_LOOP[stage];
  return mapped[0] ?? "Validate";
}

export function mapProofLoopStageToCtem(stage: ProofLoopStage): CTEMStage {
  return PROOF_LOOP_TO_CTEM[stage];
}

export const PROOF_CLOCK_LAW =
  "Store and drive workflows with ProofLoopStage. CTEMStage is an executive alias table only. Marketing hero copy must not invent a third stage enum.";

// ---------------------------------------------------------------------------
// P09-18 Principal multiverse reduction (Identity vs NHI vs graph Identity)
// ---------------------------------------------------------------------------

/**
 * Shared principal type for inventory views. Collapses human Identity rows and
 * NonHumanIdentity rows into one operator surface so NHI hygiene is not a
 * competing dashboard atom.
 */
export const PrincipalKindSchema = z.enum([
  "human",
  "service",
  "workload",
  "key"
]);
export type PrincipalKind = z.infer<typeof PrincipalKindSchema>;

export const PRINCIPAL_INVENTORY_LAW = {
  sharedView:
    "Principal inventory is the single identity work surface (type: human | service | workload | key).",
  graphProjection:
    "Both product Identity and NonHumanIdentity map to graph Identity (see ontology-mapping).",
  riskComposition:
    "NHI / principal hygiene scores are factor inputs to path/finding priority when the principal is on a path — never a parallel triage queue number.",
  forbidden:
    "Do not ship a competing NHI-only risk dashboard number that is not composed into path/finding priority."
} as const;

/** Map product Identity.identityType → PrincipalKind. */
export function principalKindFromIdentityType(
  identityType: string | null | undefined
): PrincipalKind {
  switch (identityType) {
    case "Human":
      return "human";
    case "ServiceAccount":
    case "Role":
    case "Group":
      return "service";
    case "APIKey":
      return "key";
    default:
      return "human";
  }
}

/** Map NonHumanIdentity.identityType → PrincipalKind. */
export function principalKindFromNonHumanIdentityType(
  identityType: string | null | undefined
): PrincipalKind {
  switch (identityType) {
    case "ServiceAccount":
    case "OAuthClient":
      return "service";
    case "WorkloadRole":
      return "workload";
    case "APIKey":
    case "OAuthToken":
    case "Certificate":
      return "key";
    default:
      return "service";
  }
}

/**
 * Convert an NHI risk score (0–100 hygiene) into a priority factor uplift when
 * the principal is on a path. High hygiene risk can add at most +15 to the
 * finding priority composition — it never replaces base path risk.
 */
export function principalRiskPriorityFactor(
  riskScore: number | null | undefined,
  options?: { principalOnPath?: boolean }
): number {
  if (options?.principalOnPath !== true) {
    return 0;
  }
  if (typeof riskScore !== "number" || !Number.isFinite(riskScore)) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(100, riskScore));
  // Map 0–100 hygiene risk → 0–15 priority uplift when on-path.
  return Math.round((clamped / 100) * 15);
}

/**
 * Extended finding priority composition that may include principal hygiene
 * (P09-18). Still cites RISK_COMPOSITION_LAW; principal factor is explicit.
 */
export function composeFindingPriorityScoreWithPrincipal(
  input: FindingPriorityCompositionInput & {
    principalRiskScore?: number | null;
    principalOnPath?: boolean;
  }
): number {
  const principal = principalRiskPriorityFactor(input.principalRiskScore, {
    principalOnPath: input.principalOnPath
  });
  return composeFindingPriorityScore({
    baseRisk: input.baseRisk,
    missingSignalImpact: input.missingSignalImpact,
    dispositionAdjustment:
      (typeof input.dispositionAdjustment === "number"
        ? input.dispositionAdjustment
        : 0) + principal
  });
}

// ---------------------------------------------------------------------------
// P09-19 Exposure as third lifecycle peer of Path and Finding
// ---------------------------------------------------------------------------

/**
 * Reduction rule: Exposure is a real particle, but operators have exactly one
 * triage queue (Findings). Exposure is never a third primary nav work queue.
 *
 * | Particle  | Meaning                                      |
 * |-----------|----------------------------------------------|
 * | Exposure  | Asset-scoped condition (what is open)        |
 * | Path      | Multi-node narrative (how it chains)         |
 * | Finding   | Prioritized work-queue projection (what to do)|
 *
 * Remediations attach to fingerprint (cause), with optional exposureId/pathId
 * for navigation — not as competing SoR identities.
 */
export const EXPOSURE_PATH_FINDING_REDUCTION = {
  exposure: "asset-scoped condition",
  path: "multi-node narrative",
  finding: "prioritized work-queue projection",
  remediationSoR: "fingerprint (cause id)",
  optionalLinks: ["exposureId", "pathId"] as const,
  forbidThirdTriageQueue:
    "Do not add Exposure as a primary-nav triage queue peer of Findings."
} as const;

export const EXPOSURE_PATH_FINDING_LAW =
  "Exposure = asset-scoped condition; Path = multi-node narrative; Finding = prioritized work queue projection. Remediations attach to fingerprint (cause) with optional exposureId/pathId. No third triage queue UI.";

export type LifecycleWorkUnitKind = "exposure" | "path" | "finding";

/**
 * Classify a work unit for API/UI copy. Prefer finding for operator queues;
 * exposure and path are supporting particles.
 */
export function classifyLifecycleWorkUnit(input: {
  hasFindingFingerprint?: boolean;
  hasPathId?: boolean;
  hasExposureId?: boolean;
}): LifecycleWorkUnitKind {
  if (input.hasFindingFingerprint) {
    return "finding";
  }
  if (input.hasPathId) {
    return "path";
  }
  if (input.hasExposureId) {
    return "exposure";
  }
  return "finding";
}

/** True when remediation linkage is valid under the reduction rule. */
export function isRemediationCauseLinkageValid(input: {
  fingerprint?: string | null;
  exposureId?: string | null;
  pathId?: string | null;
}): boolean {
  const cause = input.fingerprint?.trim();
  // Prefer fingerprint as SoR; allow legacy path/exposure-only links during migration.
  if (cause && cause.length > 0) {
    return true;
  }
  return Boolean(input.pathId || input.exposureId);
}

// ---------------------------------------------------------------------------
// P09-20 Feature zoo as model explosion in IA
// ---------------------------------------------------------------------------

export const FEATURE_ZOO_IA_LAW = {
  jobsOnly: [
    "Authorize (Scope + Assets)",
    "Validate (Missions / Schedules / Runners)",
    "Understand (Paths + Findings + Controls)",
    "Act (Remediation)",
    "Prove (Evidence + Reports)"
  ] as const,
  demoteToLabs: [
    "swarm theater",
    "living-map fixtures",
    "duplicate spine workbenches"
  ] as const,
  singleNavSource: "PRIMARY_NAV (app-navigation derives from it)"
} as const;

// ---------------------------------------------------------------------------
// Aggregate gate helpers (P09-17)
// ---------------------------------------------------------------------------

export type OntologyGateCheck = {
  law: OntologyLawId;
  ok: boolean;
  detail: string;
};

export function checkClosureLaw(
  input: RemediationFixedAuthorizationInput
): OntologyGateCheck {
  const ok = isRemediationFixedAuthorizedByVerification(input);
  return {
    law: "closure",
    ok,
    detail: ok
      ? "Fixed write is verification-authorized."
      : "Fixed write rejected — needs measured verification outcome Fixed."
  };
}

export function checkGroundingLaw(input: {
  evidenceIds?: readonly string[] | null;
  allowsMissingSignal?: boolean;
  missingSignalExplicit?: boolean;
  notConfigured?: boolean;
}): OntologyGateCheck {
  const hasEvidence =
    Array.isArray(input.evidenceIds) && input.evidenceIds.length > 0;
  const ok =
    hasEvidence ||
    input.notConfigured === true ||
    (input.allowsMissingSignal === true && input.missingSignalExplicit === true);
  return {
    law: "grounding",
    ok,
    detail: ok
      ? "Conclusion grounded or honestly empty/not-configured."
      : "Conclusion lacks evidenceIds and is not an explicit MissingSignal/NotConfigured."
  };
}

export function checkLanguageLaw(input: {
  /** True when severity alone was used to set a measurement claim. */
  severityUpgradedCertainty?: boolean;
}): OntologyGateCheck {
  const ok = input.severityUpgradedCertainty !== true;
  return {
    law: "language",
    ok,
    detail: ok
      ? "Severity and certainty remain decoupled."
      : "Severity must not upgrade measurement certainty."
  };
}

export function runOntologyAcceptanceGates(input: {
  fixedWrite?: RemediationFixedAuthorizationInput;
  grounding?: Parameters<typeof checkGroundingLaw>[0];
  severityUpgradedCertainty?: boolean;
}): OntologyGateCheck[] {
  const checks: OntologyGateCheck[] = [];
  if (input.fixedWrite) {
    checks.push(checkClosureLaw(input.fixedWrite));
  }
  if (input.grounding) {
    checks.push(checkGroundingLaw(input.grounding));
  }
  checks.push(
    checkLanguageLaw({
      severityUpgradedCertainty: input.severityUpgradedCertainty
    })
  );
  return checks;
}

export function allOntologyGatesPass(checks: OntologyGateCheck[]): boolean {
  return checks.every((c) => c.ok);
}
