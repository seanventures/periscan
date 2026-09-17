/**
 * P09-12 / P09-3 Fixed multiverse law
 * -----------------------------------
 * The token "Fixed" appears in several product enums (RemediationStatus,
 * VerificationOutcome, ValidationState, RiskBand, ValidatedFindingStatus,
 * ExposureStatus). Only ONE write path may author remediation status Fixed:
 *
 *   A verification event whose outcome is Fixed, produced by a real retest
 *   (measured revalidation — connector resync, validation-module retest, or
 *   in-network runner measured result).
 *
 * Authorized RemediationTask.status="Fixed" writers (must call assert):
 * - apps/api/src/services/remediation.ts → verifyRemediation
 * - apps/api/src/services/runner.ts → submitRunnerTaskResult (remediationId path)
 *
 * Forbidden authors of Fixed:
 * - Analyst finding disposition (FindingDispositionSchema excludes Fixed)
 * - External ticket close (→ ClosedWithoutEvidence when verification required)
 * - Status patches / ticket state alone / aspirational workflow claims
 * - Risk band from remediationStatus or validationState alone
 *   (packages/evidence risk short-circuit requires verificationStatus === "Fixed")
 * - Module validationState "Fixed" (measurement outcome on paths/checks — not
 *   RemediationTask.status)
 *
 * Use `assertRemediationFixedOnlyViaVerification` at every writer that can set
 * RemediationTask.status to Fixed. Use
 * `resolveExternalTicketClosedRemediationStatus` when ticket sync observes close.
 *
 * RiskBand "Fixed" is presentation of a verification outcome only — never mint
 * band Fixed from remediationStatus / validationState without verificationStatus.
 * Score→band mapping (`toBand`) never returns Fixed. UI/report labels use
 * formatRiskBandDisplayLabel → "Closed (risk)" so operators do not conflate
 * the risk band with RemediationTask.status Fixed.
 *
 * Architecture enforcement: `fix-verification.test.ts` walks production sources
 * and fails if a free RemediationTask Fixed writer appears outside
 * REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS (or without the assert chokepoint).
 */

/** Symbols/paths allowed to persist RemediationTask.status = Fixed (P09-3). */
export const REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS = [
  "apps/api/src/services/remediation.ts:verifyRemediation",
  "apps/api/src/services/runner.ts:submitRunnerTaskResult"
] as const;

/**
 * Repo-relative production source files that may call
 * assertRemediationFixedOnlyViaVerification (derived from authorized paths).
 * Definition site in this module is also allowed.
 */
export const REMEDIATION_FIXED_AUTHORIZED_WRITER_FILES = [
  ...new Set(
    REMEDIATION_FIXED_AUTHORIZED_WRITER_PATHS.map((entry) => entry.split(":")[0]!)
  )
] as readonly string[];

export type RemediationFixedAuthorizationInput = {
  /** Status the writer intends to persist on RemediationTask. */
  nextStatus: string;
  /**
   * Verification outcome being applied in the same write (or already proven).
   * Required and must equal "Fixed" when nextStatus is "Fixed".
   */
  verificationOutcome?: string | null;
  /**
   * True when a real retest / connector resync / measured runner result produced
   * the outcome. Required when nextStatus is "Fixed".
   */
  measuredRevalidation?: boolean | null;
};

export class RemediationFixedWithoutVerificationError extends Error {
  readonly code = "remediation_fixed_without_verification" as const;

  constructor(message?: string) {
    super(
      message ??
        "Remediation status Fixed requires a verification event that proves Fixed (measured revalidation)."
    );
    this.name = "RemediationFixedWithoutVerificationError";
  }
}

/**
 * Pure predicate for the Fixed multiverse law. Non-Fixed next statuses always
 * pass — the law only gates writes of status Fixed.
 */
export function isRemediationFixedAuthorizedByVerification(
  input: RemediationFixedAuthorizationInput
): boolean {
  if (input.nextStatus !== "Fixed") {
    return true;
  }

  return (
    input.verificationOutcome === "Fixed" &&
    input.measuredRevalidation === true
  );
}

/**
 * Central chokepoint: throw when a writer would set RemediationTask.status to
 * Fixed without a measured verification outcome of Fixed.
 */
export function assertRemediationFixedOnlyViaVerification(
  input: RemediationFixedAuthorizationInput
): void {
  if (!isRemediationFixedAuthorizedByVerification(input)) {
    throw new RemediationFixedWithoutVerificationError(
      `Cannot set remediation status to Fixed without measured verification (got outcome=${String(input.verificationOutcome)}, measuredRevalidation=${String(input.measuredRevalidation)}).`
    );
  }
}

/**
 * External ticket close must never claim Fixed. When verification is required
 * and the remediation is still in an open workflow state, the honest status is
 * ClosedWithoutEvidence. Already-verified or non-open statuses are preserved.
 */
export function resolveExternalTicketClosedRemediationStatus(input: {
  currentStatus: string;
  verificationRequired: boolean;
}): string {
  if (!input.verificationRequired) {
    return input.currentStatus;
  }

  if (input.currentStatus === "Open" || input.currentStatus === "InProgress") {
    return "ClosedWithoutEvidence";
  }

  return input.currentStatus;
}

export type TargetedFixVerificationFamily =
  | "RepositorySecretToCloudPath"
  | "ExternalExposure"
  | "AIApplication"
  | "ControlValidation"
  | "AttackPathCorrelation"
  | "GenericFixVerification";

export type TargetedFixVerificationPlan = {
  family: TargetedFixVerificationFamily;
  rationale: string;
  selectedModuleIds: string[];
  /**
   * P06-13: true when selectedModuleIds came from the originating measurement
   * modules rather than the family keyword fallback map.
   */
  usedOriginalModules?: boolean;
};

export type TargetedFixVerificationPlanInput = {
  hasCurrentPath?: boolean;
  hasPreviousPath?: boolean;
  pathName?: string | null;
  pathNodeLabels?: string[] | null;
  /**
   * P06-13: module ids from the original mission/evidence that produced the
   * exposure. Prefer these for retest when non-empty (family map is fallback).
   */
  originalModuleIds?: string[] | null;
  remediation: {
    recommendedAction?: string | null;
    relatedExposureId?: string | null;
    relatedPathId?: string | null;
    verificationMethod?: string | null;
  };
};

export const EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS = [
  "periscan.tls_certificate_check",
  "periscan.tls_protocol_audit",
  "periscan.dns_resolution_check",
  "periscan.http_health_check",
  "periscan.http_cookie_security",
  "periscan.http_redirect_enforcement",
  "periscan.http_cors_audit",
  "periscan.dns_email_security_check",
  "periscan.dns_caa_check"
] as const;

/**
 * Normalize original module ids: trim, drop empties, de-dupe, stable order.
 * Compare-only helpers are excluded so retest still measures when possible.
 */
export function normalizeOriginalFixVerificationModules(
  moduleIds: string[] | null | undefined
): string[] {
  if (!moduleIds?.length) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of moduleIds) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) continue;
    // Graph-diff alone is not a measured retest of the original exposure.
    if (id === "periscan.fix_verification.compare") continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

function familyFallbackPlan(
  input: TargetedFixVerificationPlanInput
): TargetedFixVerificationPlan {
  const haystack = [
    input.pathName,
    input.remediation.recommendedAction,
    input.remediation.verificationMethod,
    ...(input.pathNodeLabels ?? [])
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (haystack.includes("secret")) {
    return {
      family: "RepositorySecretToCloudPath",
      rationale:
        "Secret-path remediation should retest repository secret evidence and downstream cloud posture correlation.",
      selectedModuleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"],
      usedOriginalModules: false
    };
  }

  if (
    haystack.includes("public") ||
    haystack.includes("external") ||
    haystack.includes("internet")
  ) {
    return {
      family: "ExternalExposure",
      rationale:
        "Public exposure remediation should rerun measured DNS, TLS, HTTP, and email posture checks against verified scope.",
      selectedModuleIds: [...EXTERNAL_EXPOSURE_FIX_VERIFICATION_MODULE_IDS],
      usedOriginalModules: false
    };
  }

  if (haystack.includes("ai") || haystack.includes("rag")) {
    return {
      family: "AIApplication",
      rationale:
        "AI app remediation should rerun the safe AI validation suite with the approved test account.",
      selectedModuleIds: ["ai_app.safe_validation"],
      usedOriginalModules: false
    };
  }

  if (
    haystack.includes("control") ||
    haystack.includes("detected") ||
    haystack.includes("missed")
  ) {
    return {
      family: "ControlValidation",
      rationale:
        "Control remediation should rerun the dry-run control validation and observer lookup.",
      selectedModuleIds: ["atomic.control_validation_safe"],
      usedOriginalModules: false
    };
  }

  if (
    input.hasCurrentPath ||
    input.hasPreviousPath ||
    input.remediation.relatedPathId
  ) {
    return {
      family: "AttackPathCorrelation",
      rationale:
        "Path remediation should recompute the current evidence graph and compare before/after path state.",
      selectedModuleIds: ["periscan.fix_verification.compare"],
      usedOriginalModules: false
    };
  }

  return {
    family: "GenericFixVerification",
    rationale:
      "No specific path family was available; compare remediation evidence and current graph state.",
    selectedModuleIds: ["periscan.fix_verification.compare"],
    usedOriginalModules: false
  };
}

export function buildTargetedFixVerificationPlan(
  input: TargetedFixVerificationPlanInput
): TargetedFixVerificationPlan {
  // P06-13: prefer the original measured module set when available so Fixed is
  // earned by re-running the same measurement path, not a keyword-family proxy.
  const original = normalizeOriginalFixVerificationModules(
    input.originalModuleIds
  );
  if (original.length > 0) {
    const family = familyFallbackPlan(input).family;
    return {
      family,
      rationale:
        "Retest uses the original measured module set from the source mission/evidence; family keyword map is only a fallback when originals are unavailable.",
      selectedModuleIds: original,
      usedOriginalModules: true
    };
  }

  return familyFallbackPlan(input);
}

// D: Remediation & Verification - simulator (what-if), playbooks, tripwires, re-test, trending
// Pure functions for use in evidence, services, reports, UI (real-first, no side effects)

export interface RemediationSimulationInput {
  remediationId: string;
  currentRiskBand: string;
  currentRiskScore: number;
  pathSummary: string;
  proposedFix: string; // e.g. "rotate secret and tighten role"
  relatedPathId?: string | null;
}

export interface RemediationSimulationResult {
  hypotheticalRiskDelta: number; // negative = improvement
  projectedRiskBand: string;
  projectedVerdict: "Fixed" | "Reduced" | "Still Exposed";
  affectedPathsCount: number;
  confidence: number; // 0-1
  explanation: string;
  retestRecommended: boolean;
}

export function simulateRemediationWhatIf(
  input: RemediationSimulationInput
): RemediationSimulationResult {
  const fix = (input.proposedFix || "").toLowerCase();
  const path = (input.pathSummary || "").toLowerCase();
  let delta = -10; // baseline modest improvement
  let band = "Medium";
  let verdict: "Fixed" | "Reduced" | "Still Exposed" = "Reduced";
  let affected = 1;
  let conf = 0.7;
  let expl = "What-if: proposed fix applied to path; simulated delta from evidence correlation.";

  if (fix.includes("rotate") || fix.includes("secret") || fix.includes("credential")) {
    delta = -35;
    band = "Low";
    verdict = "Fixed";
    affected = 2;
    conf = 0.85;
    expl = "Secret rotation + invalidation breaks repo-to-cloud path. Pre/post FixVerification will confirm.";
  } else if (fix.includes("restrict") || fix.includes("public") || fix.includes("ingress") || fix.includes("firewall")) {
    delta = -28;
    band = "Low";
    verdict = "Fixed";
    affected = 1;
    conf = 0.8;
    expl = "Public exposure removed. External re-validation (DNS/TLS/HTTP) expected to pass.";
  } else if (fix.includes("limit") || fix.includes("permission") || fix.includes("role")) {
    delta = -22;
    band = "Medium";
    verdict = "Reduced";
    affected = 1;
    conf = 0.75;
    expl = "Permission boundary tightened. Re-test via targeted FixVerification recommended.";
  }

  if (path.includes("ai") || fix.includes("ai") || fix.includes("guardrail")) {
    delta = Math.min(delta, -30);
    verdict = "Fixed";
    expl += " AI guardrail/path reduction modeled via safe harness comparison.";
  }

  return {
    hypotheticalRiskDelta: delta,
    projectedRiskBand: band,
    projectedVerdict: verdict,
    affectedPathsCount: affected,
    confidence: conf,
    explanation: expl,
    retestRecommended: true
  };
}

export interface PlaybookArtifacts {
  scriptBash: string;
  iacTerraform: string;
  ticketServiceNow: ServiceNowTicketPayload;
  ticketJira: JiraTicketPayload;
  autoPlaybookNote: string;
  executionMode: "ExportOnly";
  requiresReview: true;
}

export interface ServiceNowTicketPayload {
  short_description: string;
  description: string;
  category: string;
  subcategory: string;
  impact: string;
  urgency: string;
  correlation_id: string;
}

export interface JiraTicketPayload {
  fields: {
    summary: string;
    description: string;
    issuetype: {
      name: string;
    };
    labels: string[];
    customfield_periscan_id: string;
  };
}

export function generateReviewableRemediationTemplates(
  remediation: { remediationId: string; recommendedAction?: string | null; technicalSteps?: string[] | null }
): PlaybookArtifacts {
  const id = remediation.remediationId || "rem-xxx";
  const action = remediation.recommendedAction || "Apply remediation per Periscan evidence";
  const steps = (remediation.technicalSteps || ["Review evidence pack", "Apply change", "Re-verify"]).join("\n- ");
  const script = `#!/bin/bash
# Periscan review-only remediation template for ${id}
# This export deliberately performs no change. Convert the approved manifest
# into environment-specific code, review it, and execute it through your normal
# change-control system.
echo "Proposed action: ${action}"
echo "Steps:\n- ${steps}"
echo "Required follow-up: run Periscan FixVerification for ${id}"
echo "No remediation action was executed by this template."
exit 2
`;
  const iac = `// Periscan review-only Terraform context for ${id}
// This file contains no resource and cannot change infrastructure.
// Translate the approved exact diff into provider-specific configuration,
// review it in your repository, and run the mandatory Periscan re-test.
locals {
  periscan_remediation_id = "${id}"
  periscan_proposed_action = "${action.replace(/"/g, "")}"
  periscan_execution_mode = "export-only"
}
`;
  const ticketSN = {
    short_description: `Periscan Fix: ${action}`,
    description: `Remediation ${id}\n\nEvidence-backed.\nSteps:\n${steps}\n\nLink to Periscan: /remediation?remediationId=${id}\nAuto retest via FixVerification scheduled post close.`,
    category: "Security",
    subcategory: "Remediation",
    impact: "2",
    urgency: "2",
    correlation_id: id
  };
  const ticketJ = {
    fields: {
      summary: `Periscan: ${action} (${id})`,
      description: `From Periscan remediation.\n\n${steps}\n\nVerification: schedule instant re-test after. ROI: risk reduced per sim.`,
      issuetype: { name: "Task" },
      labels: ["periscan", "remediation", "fix-verification"],
      customfield_periscan_id: id
    }
  };
  return {
    scriptBash: script,
    iacTerraform: iac,
    ticketServiceNow: ticketSN,
    ticketJira: ticketJ,
    autoPlaybookNote:
      "Reviewable export only: no infrastructure or security-product change is executed. Route the ticket or approved manifest through change control, then run fresh verification.",
    executionMode: "ExportOnly",
    requiresReview: true
  };
}

/** @deprecated Use generateReviewableRemediationTemplates. */
export const generateOneClickPlaybooks = generateReviewableRemediationTemplates;

export interface TripwireConfig {
  detectorId: string;
  name: string;
  condition: string;
  action: string; // e.g. "trigger re-test"
  behavioral: boolean;
}

export function createTripwireBehavioralDetector(
  remediationId: string,
  pathKey: string
): TripwireConfig {
  return {
    detectorId: `tripwire-${remediationId.slice(0,8)}`,
    name: `Behavioral detector for ${pathKey || "remediated path"}`,
    condition: "change in exposure/identity state OR new signal matching pre-fix pattern",
    action: `queue FixVerification re-test for ${remediationId}; update CTEM delta; alert analyst`,
    behavioral: true
  };
}

export interface FixEffectivenessTrend {
  remediationId: string;
  runs: number;
  avgRiskDelta: number;
  successRate: number; // % Fixed/Reduced
  lastOutcome: string;
  trend: "improving" | "stable" | "regressing";
}

interface PastVerificationRecord {
  remediationId: string;
  verificationOutcome?: string;
  riskDelta?: number;
}

export { computeFixEffectivenessTrending as getFixEffectivenessTrends };
export function computeFixEffectivenessTrending(
  pastVerifications: PastVerificationRecord[]
): FixEffectivenessTrend[] {
  const byId = new Map<string, PastVerificationRecord[]>();
  for (const v of pastVerifications) {
    if (!v.remediationId) continue;
    if (!byId.has(v.remediationId)) byId.set(v.remediationId, []);
    byId.get(v.remediationId)!.push(v);
  }
  const trends: FixEffectivenessTrend[] = [];
  byId.forEach((vs, id) => {
    const deltas = vs.map((x) => x.riskDelta || -10).filter((d) => typeof d === "number");
    const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const fixedCount = vs.filter((x) => /fixed|reduced/i.test(x.verificationOutcome || "")).length;
    const rate = vs.length ? Math.round((fixedCount / vs.length) * 100) : 0;
    const last = vs[vs.length - 1];
    const trend: "improving" | "stable" | "regressing" = avgDelta < -15 ? "improving" : (avgDelta > -5 ? "regressing" : "stable");
    trends.push({
      remediationId: id,
      runs: vs.length,
      avgRiskDelta: Math.round(avgDelta),
      successRate: rate,
      lastOutcome: last?.verificationOutcome || "Unknown",
      trend
    });
  });
  return trends;
}
