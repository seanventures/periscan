import { z } from "zod";

import { ControlEffectivenessStateSchema } from "./control-effectiveness";
import { HonestyTrustMetricsSchema } from "./honesty-trust-metrics";
import { RiskRelatedEntityTypeSchema } from "./related-entity-partitions";

const IdSchema = z.string().uuid();
const TimestampSchema = z.string().datetime();
const StringListSchema = z.array(z.string());
const IdListSchema = z.array(IdSchema);
const LooseObjectSchema = z.record(z.string(), z.unknown());

export const TenantTypeSchema = z.enum(["Organization", "MSSP", "Client"]);
export const UserStatusSchema = z.enum(["Invited", "Active", "Disabled"]);
export const MembershipRoleSchema = z.enum([
  "Owner",
  "Admin",
  "SecurityEngineer",
  "Viewer",
  "MSSPOwner",
  "ClientAdmin"
]);
export const ProductPersonaSchema = z.enum([
  "SecurityLeader",
  "SecurityEngineer",
  "GrcAuditor",
  "MsspOperator"
]);
export const ProductOutcomeSchema = z.enum([
  "PrioritizeRisk",
  "RunProofLoop",
  "ProduceAssurance",
  "TriageClients"
]);
export const ProofLoopStageSchema = z.enum([
  "Connect",
  "Authorize",
  "Validate",
  "Understand",
  "Act",
  "Verify",
  "Prove",
  "Repeat"
]);
export const ScopeTypeSchema = z.enum([
  "Domain",
  "Subdomain",
  "IPRange",
  "CloudAccount",
  "Repository",
  "AIApplicationEndpoint",
  "InternalNetwork",
  "ControlSource",
  "Physical"
]);
export const ScopeAssetClassSchema = z.enum([
  "BusinessApplication",
  "Cloud",
  "Code",
  "Identity",
  "NonHumanIdentity",
  "Network",
  "OT",
  "IoT",
  "Physical",
  "Other"
]);
export const PurdueLevelSchema = z.enum([
  "Level5Enterprise",
  "Level4BusinessPlanning",
  "Level3OperationsManagement",
  "Level3_5IndustrialDMZ",
  "Level2SupervisoryControl",
  "Level1BasicControl",
  "Level0Process",
  "SafetySystem"
]);
export const ScopeVerificationStatusSchema = z.enum([
  "Pending",
  "Verified",
  "Rejected"
]);
export const IntegrationCategorySchema = z.enum([
  "Cloud",
  "Identity",
  "Code",
  "SecurityControl",
  "Ticketing",
  "AIStack",
  "MSSP",
  "Other"
]);
export const IntegrationStatusSchema = z.enum([
  "Created",
  "Connected",
  "Disconnected",
  "Error"
]);
export const IntegrationHealthStatusSchema = z.enum([
  "Healthy",
  "Degraded",
  "Unhealthy",
  "Unknown"
]);
export const IntegrationImplementationTierSchema = z.enum([
  "DedicatedClient",
  "StandardizedCatalog",
  "Planned"
]);
export const IntegrationExecutionReadinessSchema = z.enum([
  "ReadyForCredentials",
  "FixtureOnly",
  "NotConnectable"
]);
export const IntegrationPermissionsSummarySchema = z
  .object({
    connectorKey: z.string().min(1).nullish(),
    dedicatedClient: z.boolean().nullish(),
    executionReadiness: IntegrationExecutionReadinessSchema.nullish(),
    executionReadinessReason: z.string().min(1).nullish(),
    implementationTier: IntegrationImplementationTierSchema.nullish(),
    live: z.boolean().nullish(),
    requiredPermissions: StringListSchema.optional()
  })
  .catchall(z.unknown());
export const ValidationStateSchema = z.enum([
  "Discovered",
  "Reachable",
  "Validated",
  "Exploitable",
  "Detected",
  "Blocked",
  "Logged",
  "Alerted",
  "Routed",
  "Missed",
  "NoEvidence",
  "Mitigated",
  "Inconclusive",
  "NeedsApproval",
  "NeedsInternalRunner",
  "Fixed",
  "PartiallyFixed",
  "StillExposed",
  "Reopened",
  "ClosedWithoutEvidence",
  "NotConfigured",
  "RequiresIntegration",
  "RequiresVerifiedScope",
  "RequiresInternalRunner"
]);

// ---------------------------------------------------------------------------
// P09-1: ValidationState partition (theory-of-everything cleanup)
//
// ValidationStateSchema collapses four distinct *question kinds* into one
// transitional union. Specialized enums already re-partition subsets of the
// same meanings (ControlState, RemediationStatus, VerificationOutcome,
// ExploitabilityState, claim language). Dual accounting is the symptom.
//
// Canonical helpers for this partition live ONLY here (exported via
// @periscan/shared). Prefer these over ad-hoc string sets:
//
//   PATH_VALIDATION_STATES / isPathValidationState / isValidationStatePathOnly
//   CONTROL_VALIDATION_STATES / isControlValidationState / isValidationStateControlOnly
//   REMEDIATION_VALIDATION_STATES / isRemediationValidationState / isValidationStateRemediationOnly
//   READINESS_VALIDATION_STATES / isReadinessValidationState / isValidationStateReadinessOnly
//   VALIDATION_STATE_PARTITIONS + classifyValidationState
//
// Claim writers (claim-language.ts) import isPathValidationState so path
// certainty language never upgrades from control/remediation/readiness tokens.
//
// These helpers classify members by partition without rewriting the schema or
// dropping API values. Prefer specialized enums + claim language for new
// product-visible writers. Long-term direction (do not drop overnight):
//   PathOutcome | ControlObservation | RemediationLifecycle | ReadinessPrerequisite
// with adapter maps from this union.
//
// Membership is exclusive: every ValidationStateSchema member belongs to
// exactly one partition (enforced in domain tests).
// ---------------------------------------------------------------------------

/** Path / measurement certainty (future PathOutcome). */
export const PATH_VALIDATION_STATES = [
  "Discovered",
  "Reachable",
  "Validated",
  "Exploitable",
  "Inconclusive"
] as const;

/**
 * Control observation response (aligns ControlState / ControlEffectiveness).
 * Note: historical AttackPath rows may store Blocked as a path terminal; primary
 * classification still treats Blocked as control observation.
 */
export const CONTROL_VALIDATION_STATES = [
  "Detected",
  "Blocked",
  "Logged",
  "Alerted",
  "Routed",
  "Missed",
  "NoEvidence"
] as const;

/** Remediation / verification lifecycle (aligns RemediationStatus / VerificationOutcome). */
export const REMEDIATION_VALIDATION_STATES = [
  "Mitigated",
  "Fixed",
  "PartiallyFixed",
  "StillExposed",
  "Reopened",
  "ClosedWithoutEvidence"
] as const;

/** Operational readiness / configuration prerequisites (gates, not measured outcomes). */
export const READINESS_VALIDATION_STATES = [
  "NeedsApproval",
  "NeedsInternalRunner",
  "NotConfigured",
  "RequiresIntegration",
  "RequiresVerifiedScope",
  "RequiresInternalRunner"
] as const;

/**
 * Single surface for P09-1 partition membership. Prefer this map (or the
 * isValidationState*Only aliases) over scattering partition arrays.
 */
export const VALIDATION_STATE_PARTITIONS = {
  path: PATH_VALIDATION_STATES,
  control: CONTROL_VALIDATION_STATES,
  remediation: REMEDIATION_VALIDATION_STATES,
  readiness: READINESS_VALIDATION_STATES
} as const;

export type PathValidationState = (typeof PATH_VALIDATION_STATES)[number];
export type ControlValidationState = (typeof CONTROL_VALIDATION_STATES)[number];
export type RemediationValidationState =
  (typeof REMEDIATION_VALIDATION_STATES)[number];
export type ReadinessValidationState =
  (typeof READINESS_VALIDATION_STATES)[number];

/** Primary partition kind for a ValidationState member (P09-1). */
export type ValidationStatePartition =
  | "path"
  | "control"
  | "remediation"
  | "readiness";

const PATH_VALIDATION_STATE_SET = new Set<string>(PATH_VALIDATION_STATES);
const CONTROL_VALIDATION_STATE_SET = new Set<string>(CONTROL_VALIDATION_STATES);
const REMEDIATION_VALIDATION_STATE_SET = new Set<string>(
  REMEDIATION_VALIDATION_STATES
);
const READINESS_VALIDATION_STATE_SET = new Set<string>(
  READINESS_VALIDATION_STATES
);

/** True when state answers path / measurement certainty (not control/remediation/readiness). */
export function isPathValidationState(
  state: string
): state is PathValidationState {
  return PATH_VALIDATION_STATE_SET.has(state);
}

/** True when state answers control observation response. */
export function isControlValidationState(
  state: string
): state is ControlValidationState {
  return CONTROL_VALIDATION_STATE_SET.has(state);
}

/** True when state answers remediation / verification lifecycle. */
export function isRemediationValidationState(
  state: string
): state is RemediationValidationState {
  return REMEDIATION_VALIDATION_STATE_SET.has(state);
}

/** True when state is an operational readiness / config prerequisite gate. */
export function isReadinessValidationState(
  state: string
): state is ReadinessValidationState {
  return READINESS_VALIDATION_STATE_SET.has(state);
}

/**
 * Discoverability aliases (P09-1): same predicates as is*ValidationState.
 * Prefer these names when the call site is "is this token path-partition only?"
 * rather than "is this a path validation state enum member?"
 */
export const isValidationStatePathOnly = isPathValidationState;
export const isValidationStateControlOnly = isControlValidationState;
export const isValidationStateRemediationOnly = isRemediationValidationState;
export const isValidationStateReadinessOnly = isReadinessValidationState;

/**
 * Exclusive primary partition for a ValidationState member.
 * Returns null for unknown strings (not in ValidationStateSchema).
 */
export function classifyValidationState(
  state: string
): ValidationStatePartition | null {
  if (isPathValidationState(state)) {
    return "path";
  }
  if (isControlValidationState(state)) {
    return "control";
  }
  if (isRemediationValidationState(state)) {
    return "remediation";
  }
  if (isReadinessValidationState(state)) {
    return "readiness";
  }
  return null;
}

export const ControlStateSchema = z.enum([
  "Detected",
  "Blocked",
  "Logged",
  "Alerted",
  "Routed",
  "Missed",
  "NoEvidence",
  "NeedsTuning"
]);
export const RemediationStatusSchema = z.enum([
  "Open",
  "InProgress",
  "VerificationPending",
  "Fixed",
  "PartiallyFixed",
  "StillExposed",
  "Mitigated",
  "Inconclusive",
  "Reopened",
  "ClosedWithoutEvidence"
]);
export const SafetyLevelSchema = z.enum([
  "PassiveReadOnly",
  "ActiveNonInvasive",
  "ControlledValidation",
  "BASLite",
  "AdvancedAdversarial",
  "Disallowed"
]);

// Where a module's tool actually executes. AgentLocal = on the in-network runner
// agent (raw-socket/L2/session tools). ServiceViaProxy is reserved for a future
// restricted signed logical channel; it is not a reverse SSH tunnel or arbitrary
// customer-network tunnel. ServiceDirect = in the SaaS, reaching the target
// directly (repo/cloud/AI/internet-facing). Defaults are derived from
// executionMode when a module does not declare one (see getModuleRunMode).
export const RunModeSchema = z.enum([
  "AgentLocal",
  "ServiceViaProxy",
  "ServiceDirect"
]);
export const SignalCategorySchema = z.enum([
  "Asset",
  "Identity",
  "Exposure",
  "ControlObservation",
  "Detection",
  "Repository",
  "Cloud",
  "AIApplication",
  "Remediation",
  "Evidence",
  "Audit"
]);
export const SensitivityLevelSchema = z.enum([
  "Low",
  "Moderate",
  "High",
  "Restricted"
]);
export const RedactionStatusSchema = z.enum([
  "NotRequired",
  "Redacted",
  "Blocked"
]);
export const AssetTypeSchema = z.enum([
  "Repository",
  "Service",
  "Host",
  "Container",
  "Kubernetes",
  "CloudResource",
  "Domain",
  "Application",
  "IdentityStore",
  "Other"
]);
export const AssetStatusSchema = z.enum(["Active", "Inactive", "Archived"]);
export const BusinessCriticalitySchema = z.enum([
  "Low",
  "Moderate",
  "High",
  "Critical"
]);
export const ScopeMaxSafetyLevelSchema = SafetyLevelSchema;
export const ScopeClassificationSchema = z.object({
  assetClass: ScopeAssetClassSchema.default("Other"),
  businessCriticality: BusinessCriticalitySchema.default("Moderate"),
  externalValidationProfileId: z.string().min(1).nullable().default(null),
  maxSafetyLevel: ScopeMaxSafetyLevelSchema.default("BASLite"),
  purdueLevel: PurdueLevelSchema.nullable().default(null),
  segmentName: z.string().trim().min(1).max(120).nullable().default(null),
  sensitivity: SensitivityLevelSchema.default("Moderate"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([])
});

const OT_SCOPE_TAGS = new Set([
  "ics",
  "industrial-control",
  "operational-technology",
  "ot",
  "safety-instrumented-system",
  "scada"
]);

export function isOperationalTechnologyScope(
  input: Pick<
    z.infer<typeof ScopeClassificationSchema>,
    "assetClass" | "purdueLevel" | "tags"
  >
) {
  return (
    input.assetClass === "OT" ||
    input.purdueLevel !== null ||
    input.tags.some((tag) => OT_SCOPE_TAGS.has(tag.trim().toLowerCase()))
  );
}

export function resolveScopeSafetyEnvelope(
  input: z.infer<typeof ScopeClassificationSchema>
) {
  const isOperationalTechnology = isOperationalTechnologyScope(input);
  const effectiveMaxSafetyLevel =
    input.maxSafetyLevel === "Disallowed"
      ? ("Disallowed" as const)
      : isOperationalTechnology
        ? ("PassiveReadOnly" as const)
        : input.maxSafetyLevel;

  return {
    effectiveMaxSafetyLevel,
    isOperationalTechnology,
    safetyRestrictionReason:
      effectiveMaxSafetyLevel === "Disallowed"
        ? "Validation is disabled for this scope."
        : isOperationalTechnology
          ? "OT-classified scopes are hard-limited to passive, read-only validation."
          : `This scope permits validation through ${effectiveMaxSafetyLevel}.`
  };
}
export const IdentityTypeSchema = z.enum([
  "Human",
  "ServiceAccount",
  "Role",
  "Group",
  "APIKey",
  "Other"
]);
export const MFAStatusSchema = z.enum(["Enabled", "Disabled", "Unknown"]);
export const PrivilegeLevelSchema = z.enum([
  "Standard",
  "Privileged",
  "Administrator",
  "Unknown"
]);
export const ControlSourceTypeSchema = z.enum([
  "EDR",
  "XDR",
  "SIEM",
  "SOAR",
  "MDR",
  "WAF",
  "Firewall",
  "MFA",
  "EmailSecurity",
  "CloudGuardrail",
  "AIGuardrail"
]);
export const AIApplicationTypeSchema = z.enum([
  "Chatbot",
  "Copilot",
  "Agent",
  "RAG",
  "Workflow",
  "Other"
]);
export const SeveritySchema = z.enum([
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational"
]);
export const ExposureStatusSchema = z.enum([
  "Open",
  "Accepted",
  "Mitigated",
  "Fixed",
  "Archived"
]);
export const ScenarioTypeSchema = z.enum([
  "ExposureValidation",
  "ControlValidation",
  "AIAppValidation",
  "FixVerification",
  "AttackPathValidation"
]);

// Mandatory 6 Pillars (ASV/EASM, APV, SCV, DRV, CSV, EXV) for sector dominance.
// Used for picker filtering, pack categorization (marketplace), EXV dashboard,
// pillar-specific verdicts/modules, and scheduling.
export const ValidationPillarSchema = z.enum([
  "ASV_EASM",
  "APV",
  "SCV",
  "DRV",
  "CSV",
  "EXV"
]);
export type ValidationPillar = z.infer<typeof ValidationPillarSchema>;

// Pillar tagging / labels for UI pickers, verdicts, reports, marketplace, modules.
// Maps enum to human labels; used first-class for ASV/EASM, APV, SCV, DRV, CSV, EXV.
export const PILLAR_LABELS: Record<ValidationPillar, string> = {
  ASV_EASM: "Attack Surface Validation (ASV/EASM)",
  APV: "Attack Path Validation (APV)",
  SCV: "Security Control Validation (SCV)",
  DRV: "Detection Rule Validation (DRV)",
  CSV: "Cloud Security Validation (CSV)",
  EXV: "Exposure Validation (EXV/CTEM)"
};

// P11-5 Labs/fixture contracts for living-map / Cyber Terrain / swarm-KB stubs.
// Implementations live ONLY in packages/evidence/src/fixtures/living-map-terrain.ts
// and are NOT production inventory APIs. Real inventory = Asset + GraphNode.
// Do not wire these schemas into customer-facing risk/financial paths.
/**
 * Coverage tags for labs/terrain inventory helpers (P11-12).
 * Canonical Kubernetes tag is **K8s** only — "Kubernetes" is a deprecated
 * alias accepted by `normalizeAssetCoverageTag` and never stored as a distinct
 * ontology member.
 */
export const AssetCoverageTagSchema = z.enum([
  "EASM",
  "CAASM",
  "Internal",
  "Cloud",
  "K8s",
  "LLM",
  "IoT",
  "OT",
  "Host",
  "Domain",
  "CodeRepo",
  "IdP",
  "SaaSApp",
  "Container"
]);
export type AssetCoverageTag = z.infer<typeof AssetCoverageTagSchema>;

/** Deprecated aliases → canonical AssetCoverageTag (P11-12). */
export const ASSET_COVERAGE_TAG_ALIASES: Readonly<
  Record<string, AssetCoverageTag>
> = {
  Kubernetes: "K8s",
  k8s: "K8s",
  kubernetes: "K8s"
};

/**
 * Normalize a free-form coverage label to a canonical AssetCoverageTag.
 * Unknown values return null (callers should drop or map explicitly).
 */
export function normalizeAssetCoverageTag(
  value: string
): AssetCoverageTag | null {
  if ((AssetCoverageTagSchema.options as readonly string[]).includes(value)) {
    return value as AssetCoverageTag;
  }
  const alias = ASSET_COVERAGE_TAG_ALIASES[value];
  if (alias) {
    return alias;
  }
  const lower = value.toLowerCase();
  const lowerAlias = ASSET_COVERAGE_TAG_ALIASES[lower];
  if (lowerAlias) {
    return lowerAlias;
  }
  return null;
}

/** Deduplicate and canonicalize a tag list (drops unknown tags). */
export function canonicalizeAssetCoverageTags(
  tags: readonly string[]
): AssetCoverageTag[] {
  const out: AssetCoverageTag[] = [];
  const seen = new Set<AssetCoverageTag>();
  for (const tag of tags) {
    const canonical = normalizeAssetCoverageTag(tag);
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
}

// Labs/fixture coverage slogan — not product completeness claim.
export const COVERAGE_TAGS_VERBATIM =
  "EASM+CAASM+Internal+Cloud+K8s+...+LLM+IoT" as const;

/**
 * Labs/fixture DTO only — not a second inventory product model (use Asset).
 * assetType is bound to AssetTypeSchema so inventory stubs cannot invent free
 * type strings that diverge from production Asset.assetType (P11-12).
 */
export const AssetInventoryEntrySchema = z.object({
  assetId: z.string().min(1),
  assetType: AssetTypeSchema,
  coverageTags: z
    .array(z.string())
    .default([])
    .transform((tags) => canonicalizeAssetCoverageTags(tags)),
  crownJewel: z.boolean().default(false),
  discoveredBy: z.string().min(1),
  firstSeen: TimestampSchema,
  lastSeen: TimestampSchema,
  properties: LooseObjectSchema.default({}),
  riskScore: z.number().min(0).max(100).optional(),
  previousLastSeen: TimestampSchema.optional()
});
export type AssetInventoryEntry = z.infer<typeof AssetInventoryEntrySchema>;

/** Labs/fixture campaign memory — not durable product campaign state. */
export const CampaignMemoryEntrySchema = z.object({
  campaignId: z.string().min(1),
  timestamp: TimestampSchema,
  affectedAssets: IdListSchema.default([]),
  riskImpact: z.number(),
  summary: z.string().min(1),
  terrainDelta: LooseObjectSchema.optional()
});
export type CampaignMemoryEntry = z.infer<typeof CampaignMemoryEntrySchema>;

/** Labs/fixture terrain query input — not a production graph API contract. */
export const TerrainQueryInputSchema = z.object({
  tenantId: IdSchema,
  coverageTags: z.array(AssetCoverageTagSchema).optional(),
  crownJewelsOnly: z.boolean().optional(),
  includeCampaignMemory: z.boolean().default(false)
});
export type TerrainQueryInput = z.infer<typeof TerrainQueryInputSchema>;

/** Labs/fixture living-map delta — dollar figures are synthetic theater. */
export const LivingMapDeltaSchema = z.object({
  added: z.number().int().min(0),
  removed: z.number().int().min(0),
  changed: z.number().int().min(0),
  crownJewelImpactDelta: z.number().optional(),
  deltaSummary: z.string(),
  campaignMemoryUpdates: z.array(CampaignMemoryEntrySchema).default([])
});
export type LivingMapDelta = z.infer<typeof LivingMapDeltaSchema>;

export const MissionTypeSchema = z.enum([
  "ValidationSnapshot",
  "ExposureValidation",
  "ControlValidation",
  "AIAppValidation",
  "FixVerification",
  "ContinuousValidation"
]);
export const MissionStatusSchema = z.enum([
  "Draft",
  "Queued",
  "Running",
  "Completed",
  "Failed",
  "DeniedByPolicy",
  "RequiresApproval",
  "Cancelled"
]);
export const RunStatusSchema = z.enum([
  "Queued",
  "Running",
  "Completed",
  "Failed",
  "DeniedByPolicy",
  "RequiresApproval",
  "Cancelled"
]);
export const JobStatusSchema = z.enum([
  "Queued",
  "Running",
  "Completed",
  "Failed",
  "DeniedByPolicy",
  "RequiresApproval",
  "Cancelled"
]);
export const ScheduleFrequencySchema = z.enum(["Daily", "Weekly", "Monthly"]);
export const ScheduleBlackoutWindowSchema = z.object({
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
});
export const ScheduleTimingSchema = z.object({
  blackoutWindows: z.array(ScheduleBlackoutWindowSchema).max(10).default([]),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  runAtLocalTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("09:00"),
  timeZone: z.string().min(1).default("UTC")
});
export const ScheduleStatusSchema = z.enum(["Active", "Paused"]);
export const ScheduleDiffStatusSchema = z.enum([
  "NoPreviousRun",
  "Unchanged",
  "Changed",
  "ReopenedRiskDetected"
]);
export const SignalTriggerTypeSchema = z.enum([
  "CVE",
  "AssetChange",
  "PolicyChange",
  "MissedDetection"
]);
export const SignalTriggerEvaluationStatusSchema = z.enum([
  "NeedsApproval",
  "RequiresVerifiedScope",
  "RequiresIntegration",
  "RequiresInternalRunner",
  "NotConfigured"
]);
export const EvidenceArtifactTypeSchema = z.enum([
  "RawModuleOutput",
  "NormalizedEvidence",
  "ReportExport",
  "Screenshot",
  "Transcript",
  "Attachment"
]);
export const RelatedEntityTypeSchema = z.enum([
  "Tenant",
  "TenantWebhook",
  "Scope",
  "Integration",
  "Asset",
  "AssetValuationVersion",
  "Identity",
  "NonHumanIdentity",
  "ComplianceControlGovernance",
  "ControlSource",
  "AIApplication",
  "Exposure",
  "Scenario",
  "ValidationMission",
  "ValidationRun",
  "AttackPath",
  "RemediationTask",
  "RemediationAction",
  "VerificationEvent",
  "EvidencePack",
  "AuditEvent",
  "Runner",
  "RunnerTask",
  "ThreatAdvisory",
  "ThreatPackage",
  "AdvisoryImpactAssessment",
  "MissingSignal",
  "ThreatValidationPlan",
  "ThreatValidationPlanItem",
  "AdvisoryReadinessReport",
  "ThirdPartyTool",
  "ThirdPartyToolCandidate",
  "ThirdPartyToolImplementationWorkOrder",
  "ThirdPartyToolPromotionPackage",
  "ThirdPartyToolPromotionCertification",
  "ThirdPartyToolUpstreamVersionCheck",
  "ThirdPartyToolUpdateRecommendation",
  "ToolLicenseAcceptance",
  "ModelProvider",
  "ModelPolicyProfile",
  "ModelSession",
  "ModelToolRequest",
  "Engagement",
  "ScenarioBundle",
  "ValidationStimulus",
  "OperatorRecommendation"
]);
export const EdgeRelationshipSchema = z.enum([
  "RELATES_TO",
  "CAN_ACCESS",
  "EXPOSES",
  "DETECTED_BY",
  "BLOCKED_BY",
  "MISSED_BY",
  "VALIDATED_BY",
  "FIXED_BY",
  "REOPENED_BY",
  "LEADS_TO",
  "OBSERVED_BY",
  "REMEDIATED_BY",
  "AFFECTED_BY"
]);
export const VerificationOutcomeSchema = z.enum([
  "Fixed",
  "PartiallyFixed",
  "StillExposed",
  "Mitigated",
  "Inconclusive",
  "Reopened",
  "ClosedWithoutEvidence"
]);
export const ValidatedFindingSourceMotionSchema = z.enum([
  "BAS",
  "APT",
  "EXV",
  "AIApp",
  "Cloud",
  "Secrets",
  "FixVerification"
]);
export const ValidatedFindingStatusSchema = z.enum([
  "New",
  "Validated",
  "Routed",
  "InProgress",
  "Fixed",
  "Revalidated",
  "Reopened",
  "NeedsReview",
  "Inconclusive"
]);
export const ExploitabilityStateSchema = z.enum([
  "Unknown",
  "NotReachable",
  "Reachable",
  "Validated",
  "Exploitable",
  "Blocked",
  "Inconclusive"
]);
export const ObjectiveStateSchema = z.enum([
  "Reached",
  "Blocked",
  "NotReached",
  "Unknown"
]);
export const EvidencePackTypeSchema = z.enum([
  "ExecutiveRiskSummary",
  "CustomerSecurityReview",
  "CyberInsuranceEvidence",
  "SOC2Support",
  "ISOSupport",
  "PCISupport",
  "ControlValidationReport",
  "AIAppValidationReport",
  "FixVerificationReport",
  "CTEMProgramSummary",
  "MSSPClientQBR",
  "TechnicalAppendix",
  "RemediationClosurePack",
  "ValidationSnapshotReport",
  "ThreatAdvisoryReadinessReport",
  // 3.13 Emerging & Edge: SSPM/SaaS, Identity, SSCS, OT/ICS safe packs (marketplace + reports)
  "SSPMValidationReport",
  "IdentityValidationReport",
  "SSCSValidationReport",
  "OTICSAttackPackReport",
  // PRD 3.11 Business-Centric Risk Quantification & Compliance: Automated Compliance Attestations
  // (DORA, NIS2, SEC, GDPR, PCI DSS, ISO 27001, EU AI Act/ISO 42001). New packTypes + rich renderers.
  "DORAAttestation",
  "NIS2Attestation",
  "SECAttestation",
  "GDPRAttestation",
  "PCIDSSAttestation",
  "ISO27001Attestation",
  "EUAiActAttestation",
  "ISO42001Attestation",
  "HIPAAAttestation",
  "SOC2Attestation",
  "NISTCSFAttestation",
  "TenantIsolationDataProtectionReport"
]);
export const EvidencePackStatusSchema = z.enum(["Draft", "Ready", "Exported"]);
export const ReportExportFormatSchema = z.enum(["html", "pdf"]);
export const PolicyDecisionOutcomeSchema = z.enum([
  "Allowed",
  "Denied",
  "RequiresApproval",
  "RequiresVerifiedScope",
  "RequiresInternalRunner",
  "RequiresTimeWindow"
]);
export const ApprovalStateSchema = z.enum([
  "NotRequired",
  "Pending",
  "Approved",
  "Rejected"
]);
export const ExecutionEnvironmentSchema = z.enum([
  "ControlPlane",
  "ExternalPoA",
  "InternalRunner"
]);
export const AuditEventActionSchema = z.enum([
  "signup",
  "login",
  "logout",
  "tenant.created",
  "tenant.updated",
  "tenant.localization_activated",
  "integration.connected",
  "integration.disconnected",
  "integration.synced",
  "scope.created",
  "scope.classification_updated",
  "scope.deleted",
  "scope.verified",
  "asset.ownership_reviewed",
  "asset.valuation_updated",
  "asset.valuation_submitted",
  "asset.valuation_reviewed",
  "policy.decision",
  "mission.created",
  "mission.started",
  "mission.cancelled",
  "module.executed",
  "evidence.created",
  "evidence.redacted",
  "report.generated",
  "report.updated",
  "report.shared",
  "report.share_revoked",
  "report.accessed",
  "remediation.created",
  "remediation.ticket.created",
  "remediation.ticket.synced",
  "remediation.closed_without_evidence",
  "non_human_identity.registered",
  "non_human_identity.updated",
  "remediation.ready_for_verification",
  "remediation.auto_mitigated",
  "verification.run",
  "tee_assurance.requirement_created",
  "tee_assurance.evaluated",
  "tee_assurance.revoked",
  "runner.registered",
  "runner.credentials.rotated",
  "runner.fleet_policy.updated",
  "runner.task.executed",
  "runner.task.rejected",
  "threat_advisory.imported",
  "user.invited",
  "role.changed",
  "member.removed",
  "finding.disposition_changed",
  "finding.risk_approved",
  "mcp.tool_invoked",
  "offensive_validation.changed",
  "destructive_validation.changed",
  "api_key.created",
  "api_key.revoked",
  "api_key.rotated",
  "model_provider.created",
  "model_provider.updated",
  "model_provider.deleted",
  "model_policy.created",
  "model_policy.updated",
  "model_policy.deleted",
  "model_session.created",
  "model_session.terminated",
  "model_tool.requested",
  "model_tool.allowed",
  "model_tool.denied",
  "model_tool.executed",
  "model.kill_switch_activated",
  "evidence.retention.purged",
  "engagement.run",
  "engagement.read",
  "engagement.workspace.created",
  "engagement.collaborator.updated",
  "engagement.collaboration.event_added",
  "scenario.compiled",
  "scenario.approved",
  "scenario.executed",
  "scenario.feedback_cycle.started",
  "scenario.feedback_cycle.completed",
  "scenario.feedback_cycle.failed",
  "scenario.feedback.stopped",
  "ai_validation.kill_switch_changed",
  "remediation_action.previewed",
  "remediation_action.approved",
  "remediation_action.applied",
  "remediation_action.rolled_back",
  "password_reset.requested",
  "password_reset.completed",
  "password.changed",
  "sessions.revoked",
  "invite.accepted",
  "email.verified",
  "login.failed",
  "queue.tenant_limited",
  "mfa.enrolled",
  "mfa.activated",
  "mfa.recovery_used",
  "mfa.recovery_regenerated",
  "mfa.disabled",
  "webhook.created",
  "webhook.updated",
  "webhook.deleted",
  "webhook.tested",
  "webhook.dead_lettered",
  "billing.entitlement_denied",
  "trial.started",
  "trial.expired",
  "trial.converted",
  "trial.cancelled",
  "subscription.started",
  "subscription.renewal_decided",
  "subscription.reconciled",
  "subscription.grace_started",
  "subscription.grace_resolved",
  "subscription.cancellation_scheduled",
  "subscription.cancellation_revoked",
  "compliance.governance.updated",
  "sso_config.updated",
  "sso_config.disabled",
  "sso.login_started",
  "sso.login_completed",
  "sso.login_failed",
  "third_party_tool.checked",
  "third_party_tool.install_requested",
  "third_party_tool.installed",
  "third_party_tool.install_failed",
  "third_party_tool.enabled",
  "third_party_tool.disabled",
  "third_party_tool.enable_denied",
  "third_party_tool.intake_validated",
  "third_party_tool.intake_submitted",
  "third_party_tool.candidate_batch_imported",
  "third_party_tool.candidate_reviewed",
  "third_party_tool.work_order_generated",
  "third_party_tool.implementation_bundle_generated",
  "third_party_tool.promotion_package_generated",
  "third_party_tool.promotion_certified",
  "third_party_tool.upstream_checked",
  "third_party_tool.update_checked",
  "third_party_tool.update_applied",
  "third_party_tool.update_dismissed",
  "third_party_tool.refresh_due_checked",
  "third_party_tool.runner_dispatched",
  "third_party_tool.runner_dispatch_denied",
  "third_party_tool.license_accepted",
  "extension.project_created",
  "extension.release_submitted",
  "extension.release_reviewed",
  "extension.release_activated",
  "extension.release_revoked",
  "control_source.tuning_changed",
  "validation_stimulus.created",
  "validation_stimulus.dispatched",
  "validation_stimulus.observed",
  "validation_stimulus.cancelled",
  "experience.profile_updated",
  "experience.feedback_submitted",
  "async_operations.policy_configured",
  "async_operations.reconciled",
  "async_operations.recovery_prepared",
  "async_operations.terminal_accepted"
]);

/**
 * Tenant API key scopes (P20-17).
 *
 * Coarse role scopes (backward compatible):
 * - `read`  → Viewer-equivalent GET surface
 * - `write` → SecurityEngineer-equivalent mutate surface (missions, remediations)
 * - `admin` → Admin-equivalent (keys, webhooks, audit export, approvals)
 *
 * Fine-grained capability scopes for automation least privilege (may be combined
 * with or instead of coarse scopes):
 * - `mission:run`        → start/queue validation missions
 * - `remediation:write`  → create/update remediations and verification handoffs
 * - `webhook:admin`      → manage outbound webhooks
 * - `audit:read`         → list/export audit events
 *
 * Coarse scopes expand into capabilities at auth time (see expandApiKeyCapabilities).
 * A fine-grained-only key is limited to those capabilities plus the minimum role
 * needed to pass requireRole guards for those surfaces.
 */
export const TenantApiKeyScopeSchema = z.enum([
  "read",
  "write",
  "admin",
  "mission:run",
  "remediation:write",
  "webhook:admin",
  "audit:read"
]);

/** Capability scopes that are enforced for API-key callers beyond role mapping. */
export const TenantApiKeyCapabilitySchema = z.enum([
  "mission:run",
  "remediation:write",
  "webhook:admin",
  "audit:read"
]);

export type TenantApiKeyCapability = z.infer<typeof TenantApiKeyCapabilitySchema>;
export type TenantApiKeyScope = z.infer<typeof TenantApiKeyScopeSchema>;

export const TenantApiKeySchema = z.object({
  apiKeyId: IdSchema,
  tenantId: IdSchema,
  name: z.string().min(1),
  keyPrefix: z.string().min(1),
  scopes: z.array(TenantApiKeyScopeSchema),
  createdBy: IdSchema,
  lastUsedAt: TimestampSchema.nullable(),
  expiresAt: TimestampSchema.nullable(),
  revokedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export const TenantApiKeyWithSecretSchema = TenantApiKeySchema.extend({
  secret: z.string().min(1)
});

export const CreateTenantApiKeyInputSchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z.array(TenantApiKeyScopeSchema).min(1),
  expiresAt: TimestampSchema.nullish()
});

/**
 * Expand coarse API key scopes into the fine-grained capability set enforced
 * for automation least privilege. Fine-grained scopes pass through as-is.
 * Session users do not use this path.
 */
export function expandApiKeyCapabilities(
  scopes: readonly TenantApiKeyScope[]
): Set<TenantApiKeyCapability> {
  const caps = new Set<TenantApiKeyCapability>();
  for (const scope of scopes) {
    if (scope === "admin") {
      caps.add("mission:run");
      caps.add("remediation:write");
      caps.add("webhook:admin");
      caps.add("audit:read");
    } else if (scope === "write") {
      caps.add("mission:run");
      caps.add("remediation:write");
    } else if (scope === "read") {
      // read alone: no write/admin capabilities
    } else if (
      scope === "mission:run" ||
      scope === "remediation:write" ||
      scope === "webhook:admin" ||
      scope === "audit:read"
    ) {
      caps.add(scope);
    }
  }
  return caps;
}

export const WebhookEventTypeSchema = z.enum([
  "mission.completed",
  "mission.failed",
  // Emitted when startMission successfully queues validation work (not on
  // RequiresApproval / DeniedByPolicy — those use policy.denied or no event).
  "mission.started",
  "snapshot.ready",
  "remediation.created",
  // Emitted when verifyRemediation (or runner-path retest) finishes with a
  // VerificationEvent — the Fixed-only-via-measurement flagship outcome.
  "remediation.verified",
  // Emitted after analyst disposition set/clear on a finding (SOC queue hygiene).
  "finding.disposition_changed",
  "policy.denied",
  "schedule.failed"
]);

export const WEBHOOK_EVENT_TYPES = WebhookEventTypeSchema.options;

/**
 * Discoverable outbound webhook contract (P20-5 / O13 / ICP-P1-8).
 * Runtime source of truth for event types + signature headers so OpenAPI,
 * admin UI, and receivers do not drift from hard-coded help copy alone.
 * Optional eventDataSummaries document progressive per-event `data` fields.
 */
export const WebhookEventDataSummarySchema = z.object({
  dataFields: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
  eventType: WebhookEventTypeSchema
});

export const WebhookEventCatalogSchema = z.object({
  eventTypes: z.array(WebhookEventTypeSchema).min(1),
  headers: z.object({
    signature: z.string().min(1),
    event: z.string().min(1),
    delivery: z.string().min(1),
    idempotencyKey: z.string().min(1)
  }),
  signatureFormat: z.literal("sha256=<hex>"),
  bodyFields: z.array(z.string().min(1)).min(1),
  productPath: z.literal("ApiAvailable"),
  /** Progressive per-event `data` field summaries for receiver codegen. */
  eventDataSummaries: z.array(WebhookEventDataSummarySchema).optional()
});

export const WebhookDeliveryStatusSchema = z.enum([
  "Pending",
  "Delivered",
  "Failed"
]);

export const TenantWebhookSchema = z.object({
  webhookId: IdSchema,
  tenantId: IdSchema,
  url: z.url(),
  events: z.array(WebhookEventTypeSchema),
  enabled: z.boolean(),
  createdBy: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export const TenantWebhookWithSecretSchema = TenantWebhookSchema.extend({
  secret: z.string().min(1)
});

export const WebhookDeliverySchema = z.object({
  deliveryId: IdSchema,
  webhookId: IdSchema,
  tenantId: IdSchema,
  eventType: WebhookEventTypeSchema,
  status: WebhookDeliveryStatusSchema,
  attempts: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  responseStatus: z.number().int().nullable(),
  nextRetryAt: TimestampSchema.nullable(),
  deliveredAt: TimestampSchema.nullable(),
  deadLetteredAt: TimestampSchema.nullish(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export const CreateTenantWebhookInputSchema = z.object({
  url: z.url(),
  events: z.array(WebhookEventTypeSchema).min(1),
  enabled: z.boolean().optional()
});

export const UpdateTenantWebhookInputSchema = z.object({
  url: z.url().optional(),
  events: z.array(WebhookEventTypeSchema).min(1).optional(),
  enabled: z.boolean().optional()
});

const EvidenceLinkedSchema = z.object({
  evidenceIds: IdListSchema
});

const TimestampedEntitySchema = z.object({
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

const TenantScopedEntitySchema = TimestampedEntitySchema.extend({
  tenantId: IdSchema
});

const ValidationContextSchema = z.object({
  scopeId: IdSchema,
  policyDecisionId: IdSchema.nullish(),
  safetyLevel: SafetyLevelSchema
});
export const PolicyRequestedActionSchema = z.object({
  destructive: z.boolean(),
  realDataExfiltration: z.boolean(),
  persistence: z.boolean(),
  credentialTheft: z.boolean(),
  uncontrolledExploitChaining: z.boolean(),
  requiresInternalRunner: z.boolean().default(false),
  requiresTimeWindow: z.boolean().default(false)
});

export const TenantSchema = TimestampedEntitySchema.extend({
  tenantId: IdSchema,
  name: z.string().min(1),
  type: TenantTypeSchema,
  parentTenantId: IdSchema.nullish(),
  billingAccountId: z.string().min(1).nullish(),
  dataRegion: z.string().min(1),
  // Tenant force-MFA policy for password auth. Deployment-wide override:
  // PERISCAN_REQUIRE_MFA=true. Optional for backwards-compatible payloads.
  requireMfa: z.boolean().default(false)
});

export const DataResidencyRegionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1)
});

export const DataResidencyOptionsSchema = z.object({
  defaultRegion: z.string().min(1),
  regions: z.array(DataResidencyRegionSchema).min(1)
});

export const TenantReportBrandingSchema = TimestampedEntitySchema.extend({
  tenantId: IdSchema,
  logoUrl: z.url().nullish(),
  organizationName: z.string().min(1).nullish(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  reportFooter: z.string().min(1).nullish(),
  supportEmail: z.email().nullish(),
  whiteLabelEnabled: z.boolean()
});

export const TenantDesignPartnerSettingsSchema = TimestampedEntitySchema.extend(
  {
    tenantId: IdSchema,
    enabled: z.boolean()
  }
);

export const TenantSsoProviderTypeSchema = z.enum(["OIDC", "SAML"]);
export const TenantSsoStatusSchema = z.enum(["Disabled", "Enabled"]);

const OidcScopeValueSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9:._/-]+$/u);

const TenantSsoEmailDomainSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/iu);

const SamlCertificateSchema = z
  .string()
  .trim()
  .min(128)
  .max(16384)
  .refine(
    (value) =>
      /^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/u.test(
        value
      ) || /^[A-Za-z0-9+/=\s]+$/u.test(value),
    "Provide an X.509 certificate in PEM or base64 DER form."
  );

const SamlNameIdFormatSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .default("urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress");

/** IdP group/role claim value → Periscan MembershipRole rule. */
export const TenantSsoRoleMappingRuleSchema = z.object({
  claimValue: z.string().trim().min(1).max(512),
  role: MembershipRoleSchema
});

const TenantSsoRoleClaimNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9:._/-]+$/u);

const TenantSsoRoleMappingsSchema = z
  .array(TenantSsoRoleMappingRuleSchema)
  .max(64)
  .default([]);

export const TenantSsoConfigSchema = TimestampedEntitySchema.extend({
  tenantId: IdSchema,
  providerType: TenantSsoProviderTypeSchema,
  status: TenantSsoStatusSchema,
  issuerUrl: z.url(),
  authorizationEndpoint: z.url(),
  tokenEndpoint: z.url().nullish(),
  jwksUri: z.url().nullish(),
  clientId: z.string().min(1).max(512),
  clientSecretSet: z.boolean(),
  samlIdpCertificateSet: z.boolean().default(false),
  samlNameIdFormat: z.string().min(1).max(256).nullish(),
  scopes: z.array(OidcScopeValueSchema).min(1),
  emailDomainAllowlist: z.array(TenantSsoEmailDomainSchema),
  enforced: z.boolean(),
  redirectUri: z.url().nullish(),
  /** OIDC claim or SAML attribute name for groups/roles (default applied at login: "groups"). */
  roleClaimName: TenantSsoRoleClaimNameSchema.nullish(),
  /** Empty array = mapping disabled; membership role stays invite-time. */
  roleMappings: TenantSsoRoleMappingsSchema,
  /** Fallback role when mappings exist but no claim matches; null denies login. */
  defaultMappedRole: MembershipRoleSchema.nullish(),
  createdBy: IdSchema.nullish(),
  updatedBy: IdSchema.nullish()
});

export const TenantSsoConfigResponseSchema = z.object({
  config: TenantSsoConfigSchema.nullable()
});

const BaseTenantSsoConfigInputSchema = z.object({
  authorizationEndpoint: z.url(),
  clientId: z.string().trim().min(1).max(512),
  emailDomainAllowlist: z.array(TenantSsoEmailDomainSchema).default([]),
  enabled: z.boolean().default(true),
  enforced: z.boolean().default(false),
  issuerUrl: z.url(),
  redirectUri: z.url().nullable().optional(),
  roleClaimName: TenantSsoRoleClaimNameSchema.nullable().optional(),
  roleMappings: TenantSsoRoleMappingsSchema.optional(),
  defaultMappedRole: MembershipRoleSchema.nullable().optional()
});

const UpdateOidcTenantSsoConfigInputSchema =
  BaseTenantSsoConfigInputSchema.extend({
    clientSecret: z.string().min(1).max(4096).optional(),
    jwksUri: z.url().nullable().optional(),
    providerType: z.literal("OIDC").default("OIDC"),
    scopes: z
      .array(OidcScopeValueSchema)
      .min(1)
      .default(["openid", "email", "profile"]),
    tokenEndpoint: z.url().nullable().optional()
  });

const UpdateSamlTenantSsoConfigInputSchema =
  BaseTenantSsoConfigInputSchema.extend({
    providerType: z.literal("SAML"),
    samlIdpCertificate: SamlCertificateSchema.optional(),
    samlNameIdFormat: SamlNameIdFormatSchema,
    scopes: z
      .array(OidcScopeValueSchema)
      .min(1)
      .default(["saml:nameid:emailAddress"])
  });

export const UpdateTenantSsoConfigInputSchema = z.union([
  UpdateSamlTenantSsoConfigInputSchema,
  UpdateOidcTenantSsoConfigInputSchema
]);

export const TenantSsoAuthorizationUrlInputSchema = z.object({
  loginHint: z.email().optional(),
  nonce: z.string().min(8).max(512),
  prompt: z.enum(["none", "login", "consent", "select_account"]).optional(),
  redirectUri: z.url().optional(),
  state: z.string().min(8).max(512)
});

export const TenantSsoAuthorizationUrlSchema = z.object({
  authorizationUrl: z.url(),
  nonce: z.string().min(8),
  providerType: TenantSsoProviderTypeSchema,
  redirectUri: z.url(),
  scopes: z.array(OidcScopeValueSchema).min(1),
  state: z.string().min(8),
  tenantId: IdSchema
});

export const StartTenantSsoLoginInputSchema = z
  .object({
    email: z.email().optional(),
    prompt: z.enum(["none", "login", "consent", "select_account"]).optional(),
    redirectUri: z.url().optional(),
    tenantId: IdSchema.optional()
  })
  .refine((value) => Boolean(value.email || value.tenantId), {
    message: "Provide either email or tenantId."
  });

export const TenantSsoLoginStartResultSchema = z.object({
  authorizationUrl: z.url(),
  expiresAt: z.string().datetime(),
  providerType: TenantSsoProviderTypeSchema,
  redirectUri: z.url(),
  tenantId: IdSchema
});

export const CompleteTenantSsoLoginInputSchema = z
  .object({
    code: z.string().min(1).max(4096).optional(),
    samlResponse: z.string().min(1).max(262144).optional(),
    state: z.string().min(32).max(512)
  })
  .refine((value) => Boolean(value.code) !== Boolean(value.samlResponse), {
    message: "Provide exactly one of code or samlResponse."
  });

export const SignalTriggerRoutingStatusSchema = z.enum([
  "Disabled",
  "NotConfigured",
  "Ready",
  "Delivered",
  "Failed"
]);

export const SignalTriggerRoutingDeliveryStatusSchema = z.enum([
  "Delivered",
  "Failed",
  "Skipped"
]);

export const SignalTriggerRoutingSettingsSchema =
  TimestampedEntitySchema.extend({
    tenantId: IdSchema,
    enabled: z.boolean(),
    defaultOwnerRole: MembershipRoleSchema,
    workflowDestinationIntegrationIds: IdListSchema,
    notificationIntegrationIds: IdListSchema,
    ruleParameters: z.record(z.string(), z.unknown()).optional()
  });

export const DesignPartnerChecklistStatusSchema = z.enum([
  "Pending",
  "Complete"
]);

export const DesignPartnerChecklistItemSchema = z.object({
  description: z.string().min(1),
  itemId: z.string().min(1),
  label: z.string().min(1),
  status: DesignPartnerChecklistStatusSchema
});

export const DesignPartnerSnapshotRequestStatusSchema = z.object({
  latestReportId: IdSchema.nullish(),
  latestSnapshotId: IdSchema.nullish(),
  previewPath: z.string().min(1).nullish(),
  requestedAt: TimestampSchema.nullish(),
  status: z.enum(["NotRequested", "Ready"])
});

export const DesignPartnerReportNoteSchema = TimestampedEntitySchema.extend({
  authorLabel: z.string().min(1),
  body: z.string().min(1),
  reportId: IdSchema,
  tenantId: IdSchema,
  title: z.string().min(1).nullish()
});

/**
 * Internal design-partner session learning note (SESSION_LEARNING_LOG path).
 * Partner codes are internal-only; this never grants public references or Wave.
 */
export const DesignPartnerSessionOutcomeSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "convert",
  "nurture",
  "churn"
]);

export const DesignPartnerSessionNoteSchema = TimestampedEntitySchema.extend({
  sessionNoteId: IdSchema,
  tenantId: IdSchema,
  /** Internal anonymized partner code only — never a public customer name claim. */
  partnerCode: z.string().min(1).max(64),
  roleBand: z.string().min(1).max(128).nullish(),
  note: z.string().min(1).max(4000),
  outcome: DesignPartnerSessionOutcomeSchema.nullish(),
  sessionDate: TimestampSchema.nullish(),
  /** Always false from product APIs; public refs require external consent. */
  isPublicReference: z.literal(false)
});

export const AppendDesignPartnerSessionNoteInputSchema = z.object({
  partnerCode: z.string().min(1).max(64),
  roleBand: z.string().min(1).max(128).optional(),
  note: z.string().min(1).max(4000),
  outcome: DesignPartnerSessionOutcomeSchema.optional(),
  sessionDate: TimestampSchema.optional()
});

/**
 * SESSION_LEARNING_LOG reflection for design-partner workspace (P08-8).
 * Honest zero is the correct state until real ICP sessions are logged.
 */
export const DesignPartnerSessionLearningSchema = z.object({
  /** Count of internal session notes logged for this tenant. Honest 0 until real. */
  sessionCount: z.number().int().nonnegative(),
  /** Gate target from SESSION_LEARNING_LOG / W0 release proof. */
  sessionsRequired: z.literal(5),
  sessions: z.array(DesignPartnerSessionNoteSchema),
  /**
   * True only when sessionCount >= sessionsRequired.
   * Does NOT imply public references or Wave market presence eligibility.
   */
  sessionsGateMet: z.boolean(),
  /** Product never marks Wave ready; external reference consent is separate. */
  waveMarketPresenceReady: z.literal(false),
  message: z.string().min(1),
  sourceDoc: z.literal("docs/DESIGN_PARTNER/SESSION_LEARNING_LOG.md")
});

/**
 * Tenant-scoped proof-loop metrics for design-partner mode (P12-20).
 * Product surfaces real activation evidence only. Never invents customer
 * references, session scorecards, or market-presence eligibility.
 */
export const DesignPartnerAnalystEvidenceSchema = z.object({
  modeEnabled: z.boolean(),
  measuredAt: TimestampSchema,
  checklist: z.object({
    onboardingComplete: z.number().int().nonnegative(),
    onboardingTotal: z.number().int().positive(),
    integrationComplete: z.number().int().nonnegative(),
    integrationTotal: z.number().int().positive()
  }),
  proofLoop: z.object({
    maturity: z.enum(["New", "Activating", "Measured", "Operating"]),
    completedMilestones: z.number().int().nonnegative(),
    totalMilestones: z.number().int().positive(),
    measuredResultAt: TimestampSchema.nullable(),
    revalidatedAt: TimestampSchema.nullable(),
    proofDeliveredAt: TimestampSchema.nullable()
  }),
  counts: z.object({
    verifiedScopes: z.number().int().nonnegative(),
    connectedIntegrations: z.number().int().nonnegative(),
    completedRunsWithEvidence: z.number().int().nonnegative(),
    verificationEvents: z.number().int().nonnegative(),
    exportedOrSharedPacks: z.number().int().nonnegative()
  }),
  honesty: z.object({
    marketPresenceEligible: z.boolean(),
    publicReferenceCount: z.number().int().nonnegative(),
    sessionLearningEvidenceInProduct: z.enum([
      "None",
      "ChecklistOnly",
      "InternalSessionNotes"
    ]),
    disclaimer: z.string().min(1),
    banner: z.string().min(1).optional(),
    waveMarketPresenceGate: z.enum(["Fail", "Pass"]).optional(),
    mqMarketPresenceGate: z.enum(["Fail", "Pass"]).optional(),
    peerDiligenceGate: z.enum(["Fail", "Pass"]).optional(),
    referencePackStatus: z.enum(["Empty", "Partial", "Filled"]).optional()
  })
});

export const DesignPartnerWorkspaceSchema = z.object({
  analystEvidence: DesignPartnerAnalystEvidenceSchema,
  integrationChecklist: z.array(DesignPartnerChecklistItemSchema),
  latestAnalystNote: DesignPartnerReportNoteSchema.nullish(),
  onboardingChecklist: z.array(DesignPartnerChecklistItemSchema),
  /** SESSION_LEARNING_LOG path: honest sessionCount (0 until real sessions). */
  sessionLearning: DesignPartnerSessionLearningSchema,
  settings: TenantDesignPartnerSettingsSchema,
  snapshotRequest: DesignPartnerSnapshotRequestStatusSchema,
  tenantId: IdSchema
});

export const TrustSafetyConnectedIntegrationSchema = z.object({
  integrationId: IdSchema,
  connectorKey: z.string().min(1).nullish(),
  vendor: z.string().min(1),
  product: z.string().min(1),
  category: IntegrationCategorySchema,
  status: IntegrationStatusSchema,
  healthStatus: IntegrationHealthStatusSchema,
  lastSyncAt: TimestampSchema.nullish(),
  implementationTier: IntegrationImplementationTierSchema.nullish(),
  executionReadiness: IntegrationExecutionReadinessSchema.nullish(),
  executionReadinessReason: z.string().min(1).nullish(),
  dedicatedClient: z.boolean().nullish(),
  live: z.boolean().nullish(),
  permissionsUsed: z.array(z.string().min(1)),
  dataReadCategories: z.array(SignalCategorySchema),
  supportedMissionTypes: z.array(MissionTypeSchema),
  validationCapabilities: z.array(z.string().min(1)),
  controlObservationCapabilities: z.array(z.string().min(1)),
  workflowCapabilities: z.array(z.string().min(1)),
  dataSensitivity: SensitivityLevelSchema,
  revokeInstructions: z.string().min(1),
  disconnectPath: z.string().min(1)
});

export const TrustSafetyEvidenceRetentionSchema = z.object({
  artifactStorage: z.string().min(1),
  redactionEnabled: z.boolean(),
  tenantScopedAccess: z.boolean(),
  retentionPolicyStatus: z.enum(["DeploymentManaged", "Configured"]),
  retentionPeriodDays: z.number().int().positive().nullish(),
  notes: z.string().min(1)
});

export const TrustSafetyDataGovernanceSchema = z.object({
  availableRegions: z.array(DataResidencyRegionSchema).min(1),
  baaReferenceUrl: z.url().nullish(),
  baaStatus: z.enum(["Available", "NotConfigured"]),
  /** Categories of customer data the product processes (honest inventory). */
  dataCategoriesProcessed: z.array(z.string().min(1)).min(1),
  /** How DSAR / export / deletion are fulfilled today. */
  dataSubjectRequestProcess: z.string().min(1),
  dpaReferenceUrl: z.url().nullish(),
  dpaStatus: z.enum(["Available", "NotConfigured"]),
  encryptionAtRestDetails: z.string().min(1),
  encryptionAtRestStatus: z.enum(["Configured", "DeploymentManaged"]),
  routingStatus: z.enum(["RegionRouted", "SingleRegion"]),
  selectedRegion: z.string().min(1),
  selectedRegionStorageConfigured: z.boolean(),
  subprocessors: z.array(
    z.object({
      name: z.string().min(1),
      privacyUrl: z.url().nullish(),
      purpose: z.string().min(1)
    })
  ),
  /** Empty list ≠ “zero subprocessors” — always surface honesty copy. */
  subprocessorsHonesty: z.string().min(1),
  subprocessorsStatus: z.enum(["Configured", "NotConfigured"])
});

export const TrustSafetyOperationalReadinessControlSchema = z.object({
  controlId: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["DeploymentManaged", "Configured"]),
  value: z.string().min(1).nullish(),
  notes: z.string().min(1)
});

export const TrustSafetyOperationalReadinessSchema = z.object({
  environment: z.string().min(1),
  overallStatus: z.enum(["DeploymentManaged", "Configured"]),
  controls: z.array(TrustSafetyOperationalReadinessControlSchema).min(1),
  notes: z.string().min(1)
});

/**
 * Periscan-as-vendor assurance (distinct from customer SOC 2 *support* packs).
 * Used by trust-safety buildVendorAssurance and NDA diligence language.
 */
export const TrustSafetyVendorAssuranceSchema = z.object({
  customerEvidencePacksNote: z.string().min(1),
  detail: z.string().min(1),
  soc2TypeIiStatus: z.enum(["None", "InProgress", "ReportUnderNda"])
});

export const TrustSafetyPrincipleSchema = z.object({
  description: z.string().min(1),
  principleId: z.string().min(1),
  title: z.string().min(1)
});

export const TrustSafetyRunnerModelSchema = z.object({
  outboundOnly: z.boolean(),
  transport: z.string().min(1),
  taskSigningRequired: z.boolean(),
  scopeEnforcementRequired: z.boolean(),
  localAuditLogsRequired: z.boolean(),
  killSwitchAvailable: z.boolean(),
  gatewayHostnames: z.array(z.string().min(1)),
  inboundFirewallRuleRequired: z.boolean()
});

/**
 * Product honesty for enterprise identity lifecycle (P17-1 / P17-12).
 * Inbound SCIM for Periscan user memberships is intentionally NotConfigured
 * and not shipped. CyberArk/other connector SCIM is read-only inventory only.
 * "Advanced RBAC" means custom roles/ABAC — not the baseline multi-role set.
 */
export const InboundScimStatusSchema = z.literal("NotConfigured");
export const AdvancedRbacStatusSchema = z.literal("BaselineRolesOnly");

export const TrustSafetyIdentityProvisioningSchema = z.object({
  advancedRbac: z.object({
    availableRoles: z.array(MembershipRoleSchema).min(1),
    customRolesSupported: z.literal(false),
    detail: z.string().min(1),
    status: AdvancedRbacStatusSchema
  }),
  /**
   * Overall IdP plane is Partial (SSO + force-MFA + claim→role ship; SCIM/JIT do not).
   * Individual SCIM/JIT rows stay literal NotConfigured — never conflate with Partial.
   */
  planeStatus: z.literal("Partial"),
  planeStatusDetail: z.string().min(1),
  /** Sales-assisted provisioning SLA + order-form annex path (until inbound SCIM ships). */
  orderFormDoc: z.string().min(1),
  residualDoc: z.string().min(1),
  /** JIT create-on-first-SSO is NotConfigured (P17-14). SSO remains invite-gated. */
  jitProvisioning: z.object({
    defaultRoleIfEnabled: z.literal("Viewer"),
    detail: z.string().min(1),
    requiresDomainAllowlist: z.literal(true),
    status: z.literal("NotConfigured")
  }),
  scimInbound: z.object({
    discoveryPath: z.string().min(1),
    detail: z.string().min(1),
    inventoryConnectorsNote: z.string().min(1),
    status: InboundScimStatusSchema
  })
});

export function buildIdentityProvisioningHonesty(): z.infer<
  typeof TrustSafetyIdentityProvisioningSchema
> {
  return {
    planeStatus: "Partial",
    planeStatusDetail:
      "Partial IdP control plane: SSO (OIDC/SAML), force-MFA for password users, and IdP group→role claim mapping ship. Inbound SCIM and JIT membership remain NotConfigured — not a full enterprise joiner/mover/leaver product. Do not claim SCIM Production or full IdP lifecycle.",
    orderFormDoc: "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md",
    residualDoc: "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md",
    advancedRbac: {
      availableRoles: [...MembershipRoleSchema.options],
      customRolesSupported: false,
      detail:
        "Periscan ships baseline multi-role RBAC (Owner, Admin, SecurityEngineer, Viewer, MSSPOwner, ClientAdmin). Custom roles, ABAC, and permission-matrix advanced RBAC are not shipped.",
      status: "BaselineRolesOnly"
    },
    jitProvisioning: {
      defaultRoleIfEnabled: "Viewer",
      detail:
        "Just-in-time (JIT) auto-create of tenant memberships on first SSO login is NotConfigured and not shipped. SSO requires an existing Active membership (admin invite or sales-assisted provisioning). If JIT ships later, it would use domain allowlist + default Viewer + audit user.jit_provisioned — prefer SCIM for disable/delete.",
      requiresDomainAllowlist: true,
      status: "NotConfigured"
    },
    scimInbound: {
      discoveryPath: "/api/v1/scim/v2/ServiceProviderConfig",
      detail:
        "Inbound SCIM 2.0 provisioning of Periscan users and groups is NotConfigured and not shipped. Provision members with admin invites or sales-assisted onboarding. Attach the sales-assisted provisioning SLA from docs/ENTERPRISE_IDENTITY_LIFECYCLE.md to enterprise order forms. Do not claim product SCIM Production for RFP questionnaires. Discovery stubs return HTTP 501 (not silent 404).",
      inventoryConnectorsNote:
        "CyberArk Identity SCIM and similar connectors are read-only external identity inventory only; they do not provision Periscan tenant memberships.",
      status: "NotConfigured"
    }
  };
}

/**
 * Enterprise commercial / trust residual honesty (P17-6/7/9/10/13).
 * Prefer exact capability language over marketing. Do not invent settlement,
 * public SLA %, vendor SOC 2 Type II, or SIEM stream product claims.
 */
export const TrustSafetyEnterpriseCommercialSchema = z.object({
  auditStreaming: z.object({
    /**
     * P04-16 honesty: product audit is pull-export only today.
     * Continuous SIEM-native stream is a separate NotConfigured surface.
     */
    continuousStreamStatus: z.literal("NotConfigured"),
    detail: z.string().min(1),
    exportPath: z.string().min(1),
    /** Hard cap on events materialized in a single export (matches AUDIT_EXPORT_MAX_EVENTS). */
    maxExportEvents: z.number().int().positive(),
    status: z.literal("PullExportOnly"),
    webhookCatalogNote: z.string().min(1)
  }),
  multiRegionResidency: z.object({
    detail: z.string().min(1),
    status: z.enum(["RegionRouted", "SingleRegionDeploymentDependent"])
  }),
  paymentSettlement: z.object({
    detail: z.string().min(1),
    status: z.literal("NotConfigured")
  }),
  publicSlaStatusPage: z.object({
    detail: z.string().min(1),
    status: z.literal("NotConfigured")
  }),
  rfpDefaultScope: z.object({
    detail: z.string().min(1),
    excludedLabsSurfaces: z.array(z.string().min(1)).min(1),
    includedSurfaces: z.array(z.string().min(1)).min(1)
  }),
  vendorSoc2Attestation: z.object({
    detail: z.string().min(1),
    status: z.literal("NotClaimed")
  })
});

export function buildEnterpriseCommercialHonesty(input?: {
  routingStatus?: "RegionRouted" | "SingleRegion";
  /** Defaults to 5000 to match apps/api AUDIT_EXPORT_MAX_EVENTS. */
  maxExportEvents?: number;
}): z.infer<typeof TrustSafetyEnterpriseCommercialSchema> {
  const multiRegion =
    input?.routingStatus === "RegionRouted"
      ? ("RegionRouted" as const)
      : ("SingleRegionDeploymentDependent" as const);
  const maxExportEvents = input?.maxExportEvents ?? 5000;

  return {
    auditStreaming: {
      continuousStreamStatus: "NotConfigured",
      detail:
        `Control-plane audit is pull-export only (CSV/JSON via /api/v1/audit-events/export, hard cap ${maxExportEvents} events per export; truncated exports report truncated=true). Continuous SIEM-native stream (Splunk HEC / Sentinel / OCSF pipeline for every security-relevant audit action) is NotConfigured and not shipped. Product outbound webhooks cover discrete proof-loop events (mission.*, remediation.verified, policy.denied, finding.disposition_changed) — not a full continuous audit bus. Keep offline legal-hold export.`,
      exportPath: "/api/v1/audit-events",
      maxExportEvents,
      status: "PullExportOnly",
      webhookCatalogNote:
        "Outbound webhooks deliver selected product events with HMAC signing; they are not a substitute for continuous SIEM audit streaming of every admin/auth/policy action."
    },
    multiRegionResidency: {
      detail:
        multiRegion === "RegionRouted"
          ? "Multiple evidence data regions are configured for this deployment; tenant selectedRegion routing is active. Confirm regional storage health before promising EU/UK-only residency in contracts."
          : "Residency selection exists, but multi-region evidence routing is deployment-dependent. Single-region defaults are common; fail-closed when a regional target is absent. Document SCC/transfer basis in the customer DPA, not as an in-app guarantee.",
      status: multiRegion
    },
    paymentSettlement: {
      detail:
        "Billing is a usage and entitlement ledger only. paymentProcessorStatus is NotConfigured: no card capture, tax, or automated invoice settlement. Enterprise purchase is sales-led order form / invoice / Marketplace — never silent self-serve checkout readiness.",
      status: "NotConfigured"
    },
    publicSlaStatusPage: {
      detail:
        "No public contractual uptime status page is shipped in-product. /metrics and deployment operational readiness are operator-facing. Do not invent 99.x% availability claims; publish an external status page and support severity matrix under MSA when ready.",
      status: "NotConfigured"
    },
    rfpDefaultScope: {
      detail:
        "Default RFP / security-review scope is the proof loop plus SSO, audit, and Trust Center — not Autonomous/Swarm/MCP/Labs theater. Expanding questionnaire surface to every Lab product line slows enterprise review without changing the core buy.",
      excludedLabsSurfaces: [
        "Autonomous / Live validation ops (Swarm)",
        "Agent Workflows",
        "MCP Server",
        "Model Gateway",
        "Machine Identities (unless contracted)",
        "OT/ICS and confidential attestation packs (unless contracted)"
      ],
      includedSurfaces: [
        "Validation Snapshot",
        "Attack paths / findings / remediation",
        "Evidence packs & audit export",
        "SSO (OIDC/SAML) + baseline six-role RBAC",
        "Trust & Safety / isolation proof (customer tenancy evidence)"
      ]
    },
    vendorSoc2Attestation: {
      detail:
        "In-product SOC 2 / ISO packs are customer control-evidence assistants, not Periscan vendor SOC 2 Type II attestation. Do not answer questionnaires as certified by virtue of the product UI. Pair with NDA-gated third-party assurance when required.",
      status: "NotClaimed"
    }
  };
}

export const MarketPresenceGateStatusSchema = z.enum(["Fail", "Pass"]);

export const ZERO_CUSTOMER_REFERENCES_BANNER =
  "Zero customer references — Wave market presence not met";

export const MarketPresenceReferencePackGateSchema = z.object({
  gateId: z.string().min(1),
  label: z.string().min(1),
  /** RequiredNow = G0 honesty; Open = needs real partners; Met = completed. */
  status: z.enum(["RequiredNow", "Open", "Met"]),
  notes: z.string().min(1)
});

export const MarketPresenceReadinessSchema = z.object({
  banner: z.string().min(1),
  disclaimer: z.string().min(1),
  marketPresenceEligible: z.boolean(),
  mqMarketPresenceGate: MarketPresenceGateStatusSchema,
  peerDiligenceGate: MarketPresenceGateStatusSchema,
  publicCaseStudyCount: z.number().int().nonnegative(),
  publicLogoCount: z.number().int().nonnegative(),
  publicReferenceCount: z.number().int().nonnegative(),
  productionDesignPartnerReferenceCount: z.number().int().nonnegative(),
  referencePack: z.object({
    inventoryEmpty: z.boolean(),
    kpis: z.object({
      icpSessionsCompleted: z.number().int().nonnegative(),
      icpSessionsTarget: z.number().int().positive(),
      paidInvoiceConversions: z.number().int().nonnegative(),
      publicCaseStudies: z.number().int().nonnegative(),
      publicLogos: z.number().int().nonnegative(),
      referenceableProductionTenants: z.number().int().nonnegative(),
      signedReferenceCallPermissions: z.number().int().nonnegative()
    }),
    gates: z.array(MarketPresenceReferencePackGateSchema).min(1),
    packStatus: z.enum(["Empty", "Partial", "Filled"]),
    sourceDoc: z.literal("docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md")
  }),
  signedReferencePermissionCount: z.number().int().nonnegative(),
  waveMarketPresenceGate: MarketPresenceGateStatusSchema
});

/**
 * Build product market-presence readiness.
 *
 * Optional counts default to 0. Product surfaces must not invent customers;
 * only an external consent ledger (CRM/legal) may raise counts later.
 * Gates auto-fail while publicReferenceCount === 0.
 */
export function buildMarketPresenceReadiness(input?: {
  publicReferenceCount?: number;
  productionDesignPartnerReferenceCount?: number;
  signedReferencePermissionCount?: number;
  publicCaseStudyCount?: number;
  publicLogoCount?: number;
  paidInvoiceConversions?: number;
  icpSessionsCompleted?: number;
}): z.infer<typeof MarketPresenceReadinessSchema> {
  const publicReferenceCount = Math.max(
    0,
    Math.floor(input?.publicReferenceCount ?? 0)
  );
  const productionDesignPartnerReferenceCount = Math.max(
    0,
    Math.floor(input?.productionDesignPartnerReferenceCount ?? 0)
  );
  const signedReferencePermissionCount = Math.max(
    0,
    Math.floor(input?.signedReferencePermissionCount ?? 0)
  );
  const publicCaseStudyCount = Math.max(
    0,
    Math.floor(input?.publicCaseStudyCount ?? 0)
  );
  const publicLogoCount = Math.max(0, Math.floor(input?.publicLogoCount ?? 0));
  const paidInvoiceConversions = Math.max(
    0,
    Math.floor(input?.paidInvoiceConversions ?? 0)
  );
  const icpSessionsCompleted = Math.max(
    0,
    Math.floor(input?.icpSessionsCompleted ?? 0)
  );
  const icpSessionsTarget = 5;

  // Wave/MQ/peer diligence require real public references — never lab/demo.
  const hasReferences = publicReferenceCount > 0;
  const hasProductionConsent =
    productionDesignPartnerReferenceCount >= 3 &&
    signedReferencePermissionCount >= 3;
  const gate: "Fail" | "Pass" =
    hasReferences && hasProductionConsent ? "Pass" : "Fail";
  const marketPresenceEligible = gate === "Pass";

  const inventoryEmpty =
    publicReferenceCount === 0 &&
    productionDesignPartnerReferenceCount === 0 &&
    signedReferencePermissionCount === 0 &&
    publicCaseStudyCount === 0 &&
    publicLogoCount === 0;

  const packStatus: "Empty" | "Partial" | "Filled" = inventoryEmpty
    ? "Empty"
    : marketPresenceEligible
      ? "Filled"
      : "Partial";

  const banner = marketPresenceEligible
    ? `Market presence eligible — ${publicReferenceCount} public reference(s) with production consent.`
    : publicReferenceCount === 0
      ? ZERO_CUSTOMER_REFERENCES_BANNER
      : `Market presence not met — ${publicReferenceCount} public reference(s) but production/consent gates incomplete.`;

  return MarketPresenceReadinessSchema.parse({
    banner,
    disclaimer:
      "Product alone never grants Wave, Magical Quadrant, or peer-of-record market presence. Public references require written consent and production deploy evidence outside this product. Demo tenants, lab E2E, seed fixtures, and sample /demo reports do not count.",
    marketPresenceEligible,
    mqMarketPresenceGate: gate,
    peerDiligenceGate: gate,
    publicCaseStudyCount,
    publicLogoCount,
    publicReferenceCount,
    productionDesignPartnerReferenceCount,
    referencePack: {
      inventoryEmpty,
      kpis: {
        icpSessionsCompleted,
        icpSessionsTarget,
        paidInvoiceConversions,
        publicCaseStudies: publicCaseStudyCount,
        publicLogos: publicLogoCount,
        referenceableProductionTenants: productionDesignPartnerReferenceCount,
        signedReferenceCallPermissions: signedReferencePermissionCount
      },
      gates: [
        {
          gateId: "G0",
          label: "Honest pre-commercial posture",
          status: "RequiredNow",
          notes:
            "Public materials refuse fake refs. Zero references = market presence fail."
        },
        {
          gateId: "G1",
          label: "Five ICP first sessions",
          status: icpSessionsCompleted >= icpSessionsTarget ? "Met" : "Open",
          notes: "Protocol pass/fail published; needs real partners."
        },
        {
          gateId: "G2",
          label: "≥3 production deploy partners",
          status:
            productionDesignPartnerReferenceCount >= 3 ? "Met" : "Open",
          notes: "Real tenants outside lab."
        },
        {
          gateId: "G3",
          label: "≥3 signed reference permissions",
          status: signedReferencePermissionCount >= 3 ? "Met" : "Open",
          notes: "Call + logo optional tiers."
        },
        {
          gateId: "G4",
          label: "Reference pack filled",
          status: packStatus === "Filled" ? "Met" : "Open",
          notes: "docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md inventory."
        },
        {
          gateId: "G5",
          label: "Wave / MQ questionnaire",
          status: marketPresenceEligible ? "Met" : "Open",
          notes: "Do not start Wave/MQ GTM spend while references = 0."
        }
      ],
      packStatus,
      sourceDoc: "docs/DESIGN_PARTNER/REFERENCE_PACK_CHECKLIST.md"
    },
    signedReferencePermissionCount,
    waveMarketPresenceGate: gate
  });
}

/** Compact honesty fields shared by design-partner analystEvidence.honesty. */
export function buildDesignPartnerMarketPresenceHonesty(input?: {
  publicReferenceCount?: number;
}): {
  marketPresenceEligible: boolean;
  publicReferenceCount: number;
  waveMarketPresenceGate: "Fail" | "Pass";
  mqMarketPresenceGate: "Fail" | "Pass";
  peerDiligenceGate: "Fail" | "Pass";
  referencePackStatus: "Empty" | "Partial" | "Filled";
  banner: string;
  sessionLearningEvidenceInProduct: "ChecklistOnly";
  disclaimer: string;
} {
  const readiness = buildMarketPresenceReadiness(input);
  return {
    marketPresenceEligible: readiness.marketPresenceEligible,
    publicReferenceCount: readiness.publicReferenceCount,
    waveMarketPresenceGate: readiness.waveMarketPresenceGate,
    mqMarketPresenceGate: readiness.mqMarketPresenceGate,
    peerDiligenceGate: readiness.peerDiligenceGate,
    referencePackStatus: readiness.referencePack.packStatus,
    banner: readiness.banner,
    sessionLearningEvidenceInProduct: "ChecklistOnly",
    disclaimer:
      "Tenant checklist and proof-loop counts are not customer references, Wave/MQ market presence, or five-session research scorecards. Public references require written consent outside this product."
  };
}


export const TrustSafetySummarySchema = z.object({
  auditLogPath: z.string().min(1),
  connectedIntegrations: z.array(TrustSafetyConnectedIntegrationSchema),
  dataGovernance: TrustSafetyDataGovernanceSchema,
  enterpriseCommercial: TrustSafetyEnterpriseCommercialSchema,
  evidenceRetention: TrustSafetyEvidenceRetentionSchema,
  identityProvisioning: TrustSafetyIdentityProvisioningSchema,
  /** Zero-ref honesty: Wave/MQ/peer diligence fail until real references exist. */
  marketPresence: MarketPresenceReadinessSchema,
  operationalReadiness: TrustSafetyOperationalReadinessSchema,
  runnerSecurityModel: TrustSafetyRunnerModelSchema,
  tenantId: IdSchema,
  validationSafetyPrinciples: z.array(TrustSafetyPrincipleSchema).min(1),
  /** Periscan-as-vendor assurance (distinct from customer evidence packs). */
  vendorAssurance: TrustSafetyVendorAssuranceSchema
});

export const UsageMeterNameSchema = z.enum([
  "ValidatedAssets",
  "Identities",
  "ControlSources",
  "AIApplications",
  "ValidationMissions",
  "ValidationRuns",
  "RunnerMinutes",
  "EvidencePacks",
  "EvidenceRetention",
  "ClientTenants",
  "APIUsage",
  // 3.13 MSSP: short-term assessment packs (time-boxed marketplace packs for co-managed ASV, licensing)
  "ShortTermAssessments"
]);

export const UsageMeterSchema = z.object({
  description: z.string().min(1),
  label: z.string().min(1),
  measuredAt: TimestampSchema,
  meterName: UsageMeterNameSchema,
  quantity: z.number().nonnegative(),
  unit: z.string().min(1)
});

export const UsageMeterDefinitionSchema = UsageMeterSchema.omit({
  measuredAt: true,
  quantity: true
});

export const BillingPackageKeySchema = z.enum([
  "ValidationSnapshot",
  "LightExternalScan",
  "CoreValidation",
  "ControlValidation",
  "AISecurityValidation",
  "EvidencePacks",
  "MSSPPartner",
  "Enterprise",
  /** Metered private/hybrid runner entitlement (RunnerMinutes); payment still NotConfigured. */
  "HybridRunner"
]);

export const BillingPackageStatusSchema = z.enum([
  "Available",
  "ContactSales",
  "Beta"
]);

export const BillingPackageApiAccessSchema = z.enum([
  "Included",
  "Available",
  "Enterprise"
]);

export const BillingPackageSchema = z.object({
  apiAccess: BillingPackageApiAccessSchema,
  audiences: z.array(z.string().min(1)).min(1),
  description: z.string().min(1),
  includedCapabilities: z.array(z.string().min(1)).min(1),
  includedMeterNames: z.array(UsageMeterNameSchema).min(1),
  label: z.string().min(1),
  packageKey: BillingPackageKeySchema,
  paymentProcessorStatus: z.literal("NotConfigured"),
  publicPricingLanguage: z.string().min(1),
  status: BillingPackageStatusSchema,
  supportedOutcomes: z.array(z.string().min(1)).min(1)
});

export const BillingUsageSchema = z.object({
  billingAccountId: z.string().min(1).nullish(),
  meteringPeriodEnd: TimestampSchema,
  meteringPeriodStart: TimestampSchema,
  meters: z.array(UsageMeterSchema),
  tenantId: IdSchema
});

export const TrialStatusSchema = z.enum([
  "NotStarted",
  "Active",
  "Expired",
  "Converted",
  "Cancelled"
]);
export const StartTenantTrialInputSchema = z
  .object({
    agreementAccepted: z.literal(true),
    durationDays: z.number().int().min(1).max(30).default(14),
    retentionDays: z.number().int().min(0).max(90).default(30)
  })
  .strict();
export const ConvertTenantTrialInputSchema = z
  .object({
    approvalReference: z.string().trim().min(3).max(500),
    packageKey: BillingPackageKeySchema
  })
  .strict();
export const CancelTenantTrialInputSchema = z
  .object({
    reason: z.string().trim().min(3).max(500)
  })
  .strict();
export const TenantTrialSchema = z.object({
  activatedBy: IdSchema.nullish(),
  canStart: z.boolean(),
  cancellationReason: z.string().nullish(),
  cancelledAt: TimestampSchema.nullish(),
  conversionApprovalReference: z.string().nullish(),
  convertedAt: TimestampSchema.nullish(),
  deletionScheduledAt: TimestampSchema.nullish(),
  entitlementPackageKey: BillingPackageKeySchema.nullish(),
  endsAt: TimestampSchema.nullish(),
  previousBillingPackageKey: BillingPackageKeySchema.nullish(),
  remainingDays: z.number().int().nonnegative(),
  retentionDays: z.number().int().min(0).max(90),
  startedAt: TimestampSchema.nullish(),
  status: TrialStatusSchema,
  tenantId: IdSchema
});

export const ComplianceFrameworkKeySchema = z.enum([
  "DORAAttestation",
  "NIS2Attestation",
  "SECAttestation",
  "GDPRAttestation",
  "PCIDSSAttestation",
  "ISO27001Attestation",
  "EUAiActAttestation",
  "ISO42001Attestation",
  "HIPAAAttestation",
  "SOC2Attestation",
  "NISTCSFAttestation"
]);
export const ComplianceSignoffStatusSchema = z.enum([
  "Draft",
  "InReview",
  "Approved",
  "Rejected"
]);
export const UpdateComplianceControlGovernanceInputSchema = z
  .object({
    controlId: z.string().trim().min(1).max(500),
    evidenceRequest: z.string().trim().min(1).max(2_000).nullish(),
    exceptionExpiresAt: TimestampSchema.nullish(),
    exceptionRationale: z.string().trim().min(3).max(2_000).nullish(),
    framework: ComplianceFrameworkKeySchema,
    owner: z.string().trim().min(1).max(300).nullish(),
    reviewNotes: z.string().trim().min(1).max(4_000).nullish(),
    // Optional without default: omitting must not silently downgrade Approved→Draft.
    // Create path defaults to Draft in the service; update path preserves existing.
    signoffStatus: ComplianceSignoffStatusSchema.optional()
  })
  .strict()
  .superRefine((input, context) => {
    if (
      Boolean(input.exceptionRationale) !== Boolean(input.exceptionExpiresAt)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "An exception requires both a rationale and an expiration time.",
        path: ["exceptionRationale"]
      });
    }
    if (input.signoffStatus === "Approved" && !input.reviewNotes) {
      context.addIssue({
        code: "custom",
        message: "Approved sign-off requires review notes.",
        path: ["reviewNotes"]
      });
    }
    // Slice D: Approved governance sign-off requires an accountable owner.
    if (input.signoffStatus === "Approved" && !input.owner) {
      context.addIssue({
        code: "custom",
        message: "Approved sign-off requires an accountable owner.",
        path: ["owner"]
      });
    }
  });
export const ComplianceControlGovernanceSchema = z.object({
  catalogVersion: z.string().min(1),
  complianceControlGovernanceId: IdSchema.nullish(),
  controlId: z.string().min(1),
  controlTitle: z.string().min(1),
  evidenceRequest: z.string().nullish(),
  evidencedBy: z.array(z.string().min(1)),
  exceptionActive: z.boolean(),
  exceptionExpiresAt: TimestampSchema.nullish(),
  exceptionRationale: z.string().nullish(),
  framework: ComplianceFrameworkKeySchema,
  owner: z.string().nullish(),
  reviewNotes: z.string().nullish(),
  signedOffAt: TimestampSchema.nullish(),
  signedOffBy: IdSchema.nullish(),
  signoffStatus: ComplianceSignoffStatusSchema,
  createdAt: TimestampSchema.nullish(),
  tenantId: IdSchema,
  updatedAt: TimestampSchema.nullish(),
  updatedBy: IdSchema.nullish()
});
export const ComplianceGovernanceInventorySchema = z.object({
  catalogLastReviewedAt: TimestampSchema,
  catalogVersion: z.string().min(1),
  controls: z.array(ComplianceControlGovernanceSchema),
  displayName: z.string().min(1),
  framework: ComplianceFrameworkKeySchema,
  summary: z.object({
    approved: z.number().int().nonnegative(),
    exceptions: z.number().int().nonnegative(),
    inReview: z.number().int().nonnegative(),
    owned: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  })
});
export const ComplianceGovernanceChangeSchema = z.object({
  action: z.string().min(1),
  afterState: LooseObjectSchema,
  beforeState: LooseObjectSchema.nullish(),
  changedAt: TimestampSchema,
  changedBy: IdSchema,
  complianceGovernanceChangeId: IdSchema,
  framework: ComplianceFrameworkKeySchema,
  controlId: z.string().min(1),
  tenantId: IdSchema
});
/** Slice D — multi-framework governance rollup (evidence-support sign-off only). */
export const ComplianceFrameworkGovernanceSummarySchema = z.object({
  catalogVersion: z.string().min(1),
  displayName: z.string().min(1),
  framework: ComplianceFrameworkKeySchema,
  partialCatalog: z.literal(true),
  summary: z.object({
    approved: z.number().int().nonnegative(),
    exceptions: z.number().int().nonnegative(),
    inReview: z.number().int().nonnegative(),
    owned: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  })
});
export const ComplianceGovernanceMultiFrameworkSummarySchema = z.object({
  frameworks: z.array(ComplianceFrameworkGovernanceSummarySchema).min(1),
  honestyNote: z.string().min(1),
  notCertification: z.literal(true),
  scorecardId: z.literal(80),
  totals: z.object({
    approved: z.number().int().nonnegative(),
    exceptions: z.number().int().nonnegative(),
    frameworkCount: z.number().int().positive(),
    inReview: z.number().int().nonnegative(),
    owned: z.number().int().nonnegative(),
    totalControls: z.number().int().nonnegative()
  })
});
export const BatchComplianceGovernanceItemSchema = z
  .object({
    controlId: z.string().trim().min(1).max(500),
    evidenceRequest: z.string().trim().min(1).max(2_000).nullish(),
    exceptionExpiresAt: TimestampSchema.nullish(),
    exceptionRationale: z.string().trim().min(3).max(2_000).nullish(),
    framework: ComplianceFrameworkKeySchema,
    owner: z.string().trim().min(1).max(300).nullish(),
    reviewNotes: z.string().trim().min(1).max(4_000).nullish(),
    // Optional without default: omitted status preserves existing Approved rows.
    signoffStatus: ComplianceSignoffStatusSchema.optional()
  })
  .strict();
export const BatchComplianceGovernanceInputSchema = z
  .object({
    items: z.array(BatchComplianceGovernanceItemSchema).min(1).max(50),
    /**
     * Required when any item is Approved. Explicit GRC acknowledgement that
     * Periscan sign-off is customer evidence-support only — not certification
     * or an audit opinion.
     */
    notCertificationAcknowledged: z.boolean()
  })
  .strict()
  .superRefine((input, context) => {
    const hasApproved = input.items.some(
      (item) => (item.signoffStatus ?? "Draft") === "Approved"
    );
    if (hasApproved && !input.notCertificationAcknowledged) {
      context.addIssue({
        code: "custom",
        message:
          "Batch Approved sign-off requires notCertificationAcknowledged=true (evidence support only).",
        path: ["notCertificationAcknowledged"]
      });
    }
    input.items.forEach((item, index) => {
      if (
        Boolean(item.exceptionRationale) !== Boolean(item.exceptionExpiresAt)
      ) {
        context.addIssue({
          code: "custom",
          message:
            "An exception requires both a rationale and an expiration time.",
          path: ["items", index, "exceptionRationale"]
        });
      }
      if ((item.signoffStatus ?? "Draft") === "Approved" && !item.reviewNotes) {
        context.addIssue({
          code: "custom",
          message: "Approved sign-off requires review notes.",
          path: ["items", index, "reviewNotes"]
        });
      }
      if ((item.signoffStatus ?? "Draft") === "Approved" && !item.owner) {
        context.addIssue({
          code: "custom",
          message: "Approved sign-off requires an accountable owner.",
          path: ["items", index, "owner"]
        });
      }
    });
  });
export const BatchComplianceGovernanceResultSchema = z.object({
  notCertification: z.literal(true),
  results: z.array(
    z.object({
      controlId: z.string().min(1),
      framework: ComplianceFrameworkKeySchema,
      signedOffAt: TimestampSchema.nullish(),
      signoffStatus: ComplianceSignoffStatusSchema
    })
  ),
  summary: ComplianceGovernanceMultiFrameworkSummarySchema
});
export const MultiFrameworkComplianceExportInputSchema = z
  .object({
    audience: z.string().trim().min(1).max(200).default("Auditor"),
    frameworks: z
      .array(ComplianceFrameworkKeySchema)
      .min(1)
      .max(11),
    snapshotId: IdSchema,
    titlePrefix: z.string().trim().min(1).max(200).nullish()
  })
  .strict();
export const MultiFrameworkComplianceExportPackSchema = z.object({
  catalogVersion: z.string().min(1),
  displayName: z.string().min(1),
  evidencePackId: IdSchema,
  framework: ComplianceFrameworkKeySchema,
  governance: z.object({
    approved: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  }),
  packType: ComplianceFrameworkKeySchema,
  partialCatalog: z.literal(true)
});
export const MultiFrameworkComplianceExportResultSchema = z.object({
  disclaimer: z.string().min(1),
  notCertification: z.literal(true),
  packs: z.array(MultiFrameworkComplianceExportPackSchema).min(1),
  scorecardId: z.literal(80),
  snapshotId: IdSchema,
  tenantId: IdSchema
});
export const TenantIsolationProofControlSchema = z.object({
  control: z.string().min(1),
  detail: z.string().min(1),
  status: z.enum(["Pass", "Fail", "NotConfigured"])
});
export const TenantIsolationProofSchema = z.object({
  controlResults: z.array(TenantIsolationProofControlSchema).min(1),
  dataProtection: z.object({
    activeReportShares: z.number().int().nonnegative(),
    dataRegion: z.string().min(1),
    evidenceEncryptionAtRest: z.enum(["Configured", "NotConfigured"]),
    integrationCredentialEncryption: z.enum([
      "Configured",
      "DevelopmentFallback",
      "NotConfigured"
    ])
  }),
  evidenceChain: z.object({
    brokenAtSequence: z.string().nullish(),
    checkedArtifacts: z.number().int().nonnegative(),
    valid: z.boolean()
  }),
  evidenceIds: z.array(IdSchema).min(2),
  generatedAt: TimestampSchema,
  reportId: IdSchema,
  rls: z.object({
    forcedTableCount: z.number().int().nonnegative(),
    policyCount: z.number().int().nonnegative(),
    tenantScopedTableCount: z.number().int().nonnegative(),
    uncoveredTables: z.array(z.string())
  }),
  tenantId: IdSchema
});

export const ExecutiveTrendDirectionSchema = z.enum([
  "Improved",
  "Worsened",
  "Unchanged",
  "NotAvailable"
]);

export const ExecutiveTrendMetricSchema = z.object({
  delta: z.number(),
  evidenceIds: IdListSchema,
  label: z.string().min(1),
  metricId: z.string().min(1),
  previousValue: z.number().nullable(),
  trendDirection: ExecutiveTrendDirectionSchema,
  unit: z.string().min(1),
  value: z.number()
});

export const RemediationVelocitySummarySchema = z.object({
  averageVerificationHours: z.number().nonnegative().nullable(),
  closedWithoutEvidence: z.number().int().nonnegative(),
  fixedRemediations: z.number().int().nonnegative(),
  openRemediations: z.number().int().nonnegative(),
  readyForVerification: z.number().int().nonnegative(),
  reopenedRemediations: z.number().int().nonnegative(),
  totalRemediations: z.number().int().nonnegative()
});

export const ProofDeliverySummarySchema = z.object({
  evidencePacksReady: z.number().int().nonnegative(),
  latestReportCreatedAt: TimestampSchema.nullish(),
  latestReportId: IdSchema.nullish(),
  reportExports: z.number().int().nonnegative()
});

export const ExecutiveTrendSummarySchema = z.object({
  generatedAt: TimestampSchema,
  /**
   * Leaders honesty instrumentation (P12-17 / ICP-P1-6): % Measured path/hop
   * claims, Fixed that survived measured revalidation, denied-never-queued, and
   * signature verification rate. Composed only from real counters — empty
   * windows yield 0%/null, never fabricated 100%.
   */
  honestyTrust: HonestyTrustMetricsSchema,
  metrics: z.array(ExecutiveTrendMetricSchema),
  proofDelivery: ProofDeliverySummarySchema,
  recommendations: StringListSchema,
  remediationVelocity: RemediationVelocitySummarySchema,
  tenantId: IdSchema
});

// Executive trend TIME SERIES — the accumulating history behind the delta-only
// ExecutiveTrendSummary. Each point is a real captured metric value at a moment
// in time (capture-on-read + scheduler capture), never interpolated. A metric
// with fewer than two points is a young series, not a fabricated line.
export const ExecutiveTrendSeriesPointSchema = z.object({
  capturedAt: TimestampSchema,
  value: z.number()
});

export const ExecutiveTrendSeriesMetricSchema = z.object({
  label: z.string().min(1),
  metricId: z.string().min(1),
  points: z.array(ExecutiveTrendSeriesPointSchema),
  unit: z.string().min(1)
});

export const ExecutiveTrendSeriesSchema = z.object({
  generatedAt: TimestampSchema,
  metrics: z.array(ExecutiveTrendSeriesMetricSchema),
  tenantId: IdSchema
});

export const OperationalMetricsWindowSchema = z.object({
  since: TimestampSchema,
  until: TimestampSchema
});

export const MissionStartLatencyEventSchema = z.object({
  durationMs: z.number().int().nonnegative(),
  jobsQueued: z.number().int().nonnegative(),
  missionId: IdSchema,
  moduleCount: z.number().int().nonnegative(),
  startedAt: TimestampSchema
});

export const MissionStartLatencySummarySchema = z.object({
  averageDurationMs: z.number().nonnegative().nullable(),
  maxDurationMs: z.number().int().nonnegative().nullable(),
  p95DurationMs: z.number().nonnegative().nullable(),
  queuedMissionCount: z.number().int().nonnegative(),
  recentStarts: z.array(MissionStartLatencyEventSchema),
  startedMissionCount: z.number().int().nonnegative()
});

export const PolicyDenialEventSchema = z.object({
  code: z.string().min(1).nullish(),
  createdAt: TimestampSchema,
  missionId: IdSchema.nullish(),
  policyDecisionId: IdSchema.nullish(),
  rationale: z.string().min(1).nullish()
});

export const PolicyDenialSummarySchema = z.object({
  denialRate: z.number().min(0).max(1),
  deniedDecisionCount: z.number().int().nonnegative(),
  recentDenials: z.array(PolicyDenialEventSchema),
  totalPolicyDecisionCount: z.number().int().nonnegative()
});

export const ConnectorSyncTimingEventSchema = z.object({
  assetCount: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative(),
  healthStatus: IntegrationHealthStatusSchema,
  integrationId: IdSchema,
  product: z.string().min(1),
  signalCount: z.number().int().nonnegative(),
  status: z.enum(["Succeeded", "Failed"]),
  syncedAt: TimestampSchema,
  vendor: z.string().min(1)
});

export const ConnectorSyncTimingSummarySchema = z.object({
  averageDurationMs: z.number().nonnegative().nullable(),
  failedSyncCount: z.number().int().nonnegative(),
  p95DurationMs: z.number().nonnegative().nullable(),
  recentSyncs: z.array(ConnectorSyncTimingEventSchema),
  totalSyncCount: z.number().int().nonnegative()
});

export const TenantOperationalMetricsSchema = z.object({
  connectorSyncs: ConnectorSyncTimingSummarySchema,
  generatedAt: TimestampSchema,
  missionStartLatency: MissionStartLatencySummarySchema,
  policyDenials: PolicyDenialSummarySchema,
  recommendations: StringListSchema,
  tenantId: IdSchema,
  window: OperationalMetricsWindowSchema
});

export const ClientPortfolioReadinessStatusSchema = z.enum([
  "NeedsScope",
  "NeedsIntegration",
  "NeedsValidation",
  "Attention",
  "Active"
]);

export const ClientPortfolioCoverageSchema = z.object({
  aiApplications: z.number().int().nonnegative(),
  connectedIntegrations: z.number().int().nonnegative(),
  controlSources: z.number().int().nonnegative(),
  healthyIntegrations: z.number().int().nonnegative(),
  missingProofInputs: z.number().int().nonnegative(),
  runners: z.number().int().nonnegative(),
  totalScopes: z.number().int().nonnegative(),
  unhealthyIntegrations: z.number().int().nonnegative(),
  verifiedScopes: z.number().int().nonnegative()
});

export const ClientPortfolioRiskBreakdownSchema = z.object({
  criticalPaths: z.number().int().nonnegative(),
  fixedPaths: z.number().int().nonnegative(),
  highPaths: z.number().int().nonnegative(),
  lowPaths: z.number().int().nonnegative(),
  mediumPaths: z.number().int().nonnegative(),
  openRemediations: z.number().int().nonnegative(),
  verificationPending: z.number().int().nonnegative()
});

export const ClientPortfolioLatestActivitySchema = z.object({
  latestEvidencePackAt: TimestampSchema.nullish(),
  latestReportId: IdSchema.nullish(),
  latestSnapshotAt: TimestampSchema.nullish(),
  latestSnapshotId: IdSchema.nullish(),
  latestValidationRunAt: TimestampSchema.nullish()
});

export const ClientPortfolioSummarySchema = z.object({
  branding: TenantReportBrandingSchema,
  coverage: ClientPortfolioCoverageSchema,
  latestActivity: ClientPortfolioLatestActivitySchema,
  readinessStatus: ClientPortfolioReadinessStatusSchema,
  risk: ClientPortfolioRiskBreakdownSchema,
  tenant: TenantSchema,
  usage: BillingUsageSchema
});

export const MSSPClientPortfolioTotalsSchema = z.object({
  activeClients: z.number().int().nonnegative(),
  attentionClients: z.number().int().nonnegative(),
  clientTenants: z.number().int().nonnegative(),
  evidencePacks: z.number().int().nonnegative(),
  missingProofInputs: z.number().int().nonnegative(),
  needsIntegrationClients: z.number().int().nonnegative(),
  needsScopeClients: z.number().int().nonnegative(),
  needsValidationClients: z.number().int().nonnegative(),
  openRemediations: z.number().int().nonnegative(),
  validationRuns: z.number().int().nonnegative(),
  verifiedScopes: z.number().int().nonnegative(),
  // 3.13 MSSP co-managed ASV: short-term assessment packs count for portfolio/licensing views
  shortTermAssessments: z.number().int().nonnegative()
});

export const MSSPClientPortfolioSchema = z.object({
  clients: z.array(ClientPortfolioSummarySchema),
  generatedAt: TimestampSchema,
  parentTenant: TenantSchema,
  totals: MSSPClientPortfolioTotalsSchema
});

export const UserSchema = TimestampedEntitySchema.extend({
  userId: IdSchema,
  email: z.email(),
  name: z.string().min(1),
  status: UserStatusSchema,
  emailVerifiedAt: TimestampSchema.nullish(),
  mfaEnabledAt: TimestampSchema.nullish()
});

export const MembershipSchema = TimestampedEntitySchema.extend({
  membershipId: IdSchema,
  tenantId: IdSchema,
  userId: IdSchema,
  role: MembershipRoleSchema,
  productPersona: ProductPersonaSchema.nullish(),
  primaryOutcome: ProductOutcomeSchema.nullish(),
  experienceProfileCompletedAt: TimestampSchema.nullish()
});

export const ProductExperienceProfileSchema = z.object({
  membershipId: IdSchema,
  productPersona: ProductPersonaSchema.nullable(),
  primaryOutcome: ProductOutcomeSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  updatedAt: TimestampSchema
});

export const UpdateProductExperienceProfileInputSchema = z.object({
  productPersona: ProductPersonaSchema,
  primaryOutcome: ProductOutcomeSchema
});

export const ActivationMilestoneKeySchema = z.enum([
  "AccountCreated",
  "SourceConnected",
  "ScopeVerified",
  "PolicyPreviewed",
  "MissionCreated",
  "MeasuredResult",
  "RemediationCreated",
  "Revalidated",
  "ProofDelivered"
]);
export const ActivationMilestoneStateSchema = z.enum([
  "Completed",
  "Current",
  "Blocked",
  "Upcoming"
]);
export const ActivationMilestoneSchema = z.object({
  key: ActivationMilestoneKeySchema,
  label: z.string().min(1),
  stage: ProofLoopStageSchema,
  state: ActivationMilestoneStateSchema,
  completedAt: TimestampSchema.nullable(),
  href: z.string().startsWith("/"),
  evidenceBasis: z.string().min(1)
});
export const ActivationDiagnosticSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["Info", "Attention", "Blocking"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  href: z.string().startsWith("/").nullable()
});
export const TenantMaturitySchema = z.enum([
  "New",
  "Activating",
  "Measured",
  "Operating"
]);
export const ProductActivationStateSchema = z.object({
  profile: ProductExperienceProfileSchema,
  maturity: TenantMaturitySchema,
  currentStage: ProofLoopStageSchema,
  completedMilestones: z.number().int().nonnegative(),
  totalMilestones: z.number().int().positive(),
  milestones: z.array(ActivationMilestoneSchema),
  diagnostics: z.array(ActivationDiagnosticSchema),
  nextAction: z.object({
    label: z.string().min(1),
    href: z.string().startsWith("/"),
    reason: z.string().min(1)
  }),
  measuredAt: TimestampSchema
});

export const ProductWorkQueueKindSchema = z.enum([
  "Approval",
  "Prerequisite",
  "UnownedFinding",
  // New unddispositioned validated findings (Monday shift start).
  "NewFinding",
  // Correlated tenant threat alerts still in New status.
  "ThreatAlert",
  "OverdueRemediation",
  "FailedRun",
  "ReadyForRetest",
  "EvidenceIntegrity",
  // Continuous validation program health (Slice 8 / P14-19).
  "SchedulePaused",
  "ScheduleMissedNextRun",
  "ScheduleLastRunFailed"
]);
export const ProductWorkQueueItemSchema = z.object({
  itemId: z.string().min(1),
  kind: ProductWorkQueueKindSchema,
  title: z.string().min(1),
  detail: z.string().min(1),
  count: z.number().int().positive(),
  urgency: z.enum(["Now", "Soon", "Watch"]),
  stage: ProofLoopStageSchema,
  href: z.string().startsWith("/"),
  oldestAt: TimestampSchema.nullable()
});
/** Mixed urgency case-feed row (P18-15). */
export const ProductWorkQueueFeedItemSchema = z.object({
  feedId: z.string().min(1),
  kind: ProductWorkQueueKindSchema,
  title: z.string().min(1),
  detail: z.string().min(1),
  urgency: z.enum(["Now", "Soon", "Watch"]),
  stage: ProofLoopStageSchema,
  href: z.string().startsWith("/"),
  at: TimestampSchema.nullable(),
  severity: z.string().nullable().optional()
});
/**
 * P06-18 Blue shift morning brief — validated program health buckets.
 * Honesty: deep links only; not a SIEM wall or Validation Ops dump.
 */
export const BlueShiftBriefBucketSchema = z.object({
  count: z.number().int().nonnegative(),
  detail: z.string().min(1),
  href: z.string().min(1),
  id: z.string().min(1),
  title: z.string().min(1),
  urgency: z.enum(["Clear", "Now", "Soon", "Watch"])
});

export const BlueShiftBriefSchema = z.object({
  buckets: z.array(BlueShiftBriefBucketSchema),
  falsePositiveByReason: z
    .array(
      z.object({
        count: z.number().int().nonnegative(),
        reasonCode: z.string().min(1)
      })
    )
    .default([]),
  generatedAt: TimestampSchema,
  programNote: z.string().min(1),
  totalActionable: z.number().int().nonnegative()
});

export const ProductWorkQueueSchema = z.object({
  items: z.array(ProductWorkQueueItemSchema),
  /** Queue category count (not sum of bucket sizes) — P14-16. */
  total: z.number().int().nonnegative(),
  workUnits: z.number().int().nonnegative().default(0),
  feed: z.array(ProductWorkQueueFeedItemSchema).default([]),
  generatedAt: TimestampSchema
});

export const SubmitProductFeedbackInputSchema = z
  .object({
    stage: ProofLoopStageSchema,
    route: z.string().startsWith("/").max(240),
    rating: z.number().int().min(1).max(5).nullable().optional(),
    comment: z.string().trim().max(2000).nullable().optional(),
    missionId: IdSchema.nullable().optional(),
    evidencePackId: IdSchema.nullable().optional()
  })
  .refine(
    (input) => input.rating != null || Boolean(input.comment?.trim()),
    "Provide a rating or a comment."
  );
export const ProductFeedbackSchema = TimestampedEntitySchema.extend({
  feedbackId: IdSchema,
  tenantId: IdSchema,
  userId: IdSchema,
  persona: ProductPersonaSchema.nullable(),
  maturity: TenantMaturitySchema,
  stage: ProofLoopStageSchema,
  route: z.string(),
  rating: z.number().int().min(1).max(5).nullable(),
  comment: z.string().nullable(),
  missionId: IdSchema.nullable(),
  evidencePackId: IdSchema.nullable()
});

// A tenant member = a membership joined to the user it belongs to. Powers the
// Admin members roster.
export const TenantMemberSchema = z.object({
  membership: MembershipSchema,
  user: UserSchema
});
export type TenantMember = z.infer<typeof TenantMemberSchema>;

// Cross-entity global search (command palette). Results are UI-agnostic: the
// server returns the entity type + id + human labels, and the client maps a
// type to its route. Only entities with a real destination surface here.
export const GlobalSearchResultTypeSchema = z.enum([
  "Scope",
  "Asset",
  "AttackPath",
  "Remediation",
  "AIApplication",
  "EvidencePack"
]);
export type GlobalSearchResultType = z.infer<
  typeof GlobalSearchResultTypeSchema
>;

export const GlobalSearchResultSchema = z.object({
  type: GlobalSearchResultTypeSchema,
  id: IdSchema,
  label: z.string(),
  sublabel: z.string().nullable()
});
export type GlobalSearchResult = z.infer<typeof GlobalSearchResultSchema>;

export const GlobalSearchResponseSchema = z.object({
  query: z.string(),
  results: z.array(GlobalSearchResultSchema)
});
export type GlobalSearchResponse = z.infer<typeof GlobalSearchResponseSchema>;

export const ScopeSchema = TenantScopedEntitySchema.extend({
  scopeId: IdSchema,
  scopeType: ScopeTypeSchema,
  value: z.string().min(1),
  ...ScopeClassificationSchema.shape,
  effectiveMaxSafetyLevel: ScopeMaxSafetyLevelSchema.default("BASLite"),
  isOperationalTechnology: z.boolean().default(false),
  safetyRestrictionReason: z
    .string()
    .min(1)
    .default("This scope permits validation through BASLite."),
  verificationMethod: z.string().min(1).nullish(),
  verificationStatus: ScopeVerificationStatusSchema,
  verificationToken: z.string().min(1).nullish(),
  verifiedAt: TimestampSchema.nullish(),
  verifiedBy: IdSchema.nullish(),
  // Authorization hygiene: when a verified scope's verification should be
  // re-confirmed (verifiedAt + max age) and whether it is now overdue. stale is
  // informational — it does not by itself block validation.
  verificationExpiresAt: TimestampSchema.nullish(),
  verificationStale: z.boolean().default(false),
  // Continuous posture monitoring: when the measured posture modules last ran
  // for this scope and when the next refresh is due (null until the scope is
  // enrolled by its first posture check).
  lastPostureCheckAt: TimestampSchema.nullish(),
  nextPostureCheckAt: TimestampSchema.nullish(),
  createdBy: IdSchema.nullish()
});

export const CreateScopeInputSchema = ScopeClassificationSchema.extend({
  scopeType: ScopeTypeSchema,
  value: z.string().trim().min(1)
});

export const UpdateScopeClassificationInputSchema =
  ScopeClassificationSchema.partial().refine(
    (input) => Object.keys(input).length > 0,
    {
      message: "At least one scope-classification field is required."
    }
  );

export const IntegrationSchema = TenantScopedEntitySchema.extend({
  integrationId: IdSchema,
  vendor: z.string().min(1),
  product: z.string().min(1),
  category: IntegrationCategorySchema,
  authType: z.string().min(1),
  status: IntegrationStatusSchema,
  healthStatus: IntegrationHealthStatusSchema,
  lastSyncAt: TimestampSchema.nullish(),
  // Recurring sync schedule (continuous validation). Surfaced so a configured
  // schedule can be read back, not only set. null = no recurring sync.
  syncFrequency: ScheduleFrequencySchema.nullish(),
  nextSyncAt: TimestampSchema.nullish(),
  permissionsSummary: IntegrationPermissionsSummarySchema,
  config: LooseObjectSchema.nullish()
});

export const FinancialEstimateRangeSchema = z
  .object({
    minimum: z.number().min(0).max(1_000_000_000_000),
    mostLikely: z.number().min(0).max(1_000_000_000_000),
    maximum: z.number().min(0).max(1_000_000_000_000)
  })
  .refine(
    (range) =>
      range.minimum <= range.mostLikely && range.mostLikely <= range.maximum,
    {
      message: "Expected minimum ≤ most likely ≤ maximum."
    }
  );

export const AssetValuationInputSchema = z.object({
  assumptionNotes: z.string().trim().min(1).max(2_000),
  businessServiceName: z.string().trim().min(1).max(200),
  confidence: z.enum(["Low", "Medium", "High"]),
  currency: z.literal("USD").default("USD"),
  lossEventFrequencyPerYear: FinancialEstimateRangeSchema,
  lossMagnitudeUsd: FinancialEstimateRangeSchema
});

export const AssetValuationSchema = AssetValuationInputSchema.extend({
  updatedAt: TimestampSchema,
  updatedBy: IdSchema
});

export const FinancialExposureEstimateSchema = z.object({
  annualizedLossExposureUsd: z.number().min(0),
  assetId: IdSchema,
  assetName: z.string().min(1),
  businessServiceName: z.string().min(1),
  confidence: z.enum(["Low", "Medium", "High"]),
  currency: z.literal("USD"),
  expectedLossEventFrequencyPerYear: z.number().min(0),
  expectedLossMagnitudeUsd: z.number().min(0),
  lowerBoundUsd: z.number().min(0),
  methodology: z.literal("FAIR-inspired PERT range estimate"),
  upperBoundUsd: z.number().min(0),
  assumptions: z.array(z.string().min(1)).min(1),
  valuationUpdatedAt: TimestampSchema
});

export const AssetSchema = TenantScopedEntitySchema.extend({
  assetId: IdSchema,
  assetType: AssetTypeSchema,
  name: z.string().min(1),
  identifiers: LooseObjectSchema,
  environment: z.string().min(1).nullish(),
  owner: z.string().min(1).nullish(),
  businessCriticality: BusinessCriticalitySchema,
  internetExposed: z.boolean(),
  tags: StringListSchema,
  firstSeenAt: TimestampSchema.nullish(),
  lastSeenAt: TimestampSchema.nullish(),
  status: AssetStatusSchema,
  valuation: AssetValuationSchema.nullish()
});

export const AssetResolutionStatusSchema = z.enum([
  "Created",
  "Matched",
  "ConflictMatched",
  "AmbiguousCreated"
]);

export const AssetSourceObservationSchema = TenantScopedEntitySchema.extend({
  assetId: IdSchema,
  canonicalKeys: z.array(z.string().min(1)),
  conflictFields: z.array(z.string().min(1)),
  evidenceId: IdSchema,
  integrationId: IdSchema,
  observedAt: TimestampSchema,
  observedIdentifiers: LooseObjectSchema,
  observedName: z.string().min(1),
  observedType: AssetTypeSchema,
  resolutionConfidence: z.number().min(0).max(1),
  resolutionStatus: AssetResolutionStatusSchema,
  sourceName: z.string().min(1),
  sourceAssetKey: z.string().regex(/^[a-f0-9]{64}$/u),
  sourceObservationId: IdSchema
});

export const AssetLineageSchema = z.object({
  asset: AssetSchema,
  conflictCount: z.number().int().nonnegative(),
  latestObservedAt: TimestampSchema.nullish(),
  observations: z.array(AssetSourceObservationSchema),
  resolutionSummary: z.object({
    ambiguousObservationCount: z.number().int().nonnegative(),
    averageConfidence: z.number().min(0).max(1),
    sourceCount: z.number().int().nonnegative()
  })
});

export const AssetOwnershipStatusSchema = z.enum([
  "ExactScope",
  "InheritedDomain",
  "UnattributedCandidate"
]);

export const AssetOwnershipLifecycleSchema = z.enum(["New", "Active", "Stale"]);

export const AssetOwnershipReviewDispositionSchema = z.enum([
  "NeedsVerification",
  "Dismissed"
]);

export const AssetOwnershipReviewSchema = TenantScopedEntitySchema.extend({
  assetId: IdSchema,
  assetOwnershipReviewId: IdSchema,
  disposition: AssetOwnershipReviewDispositionSchema,
  note: z.string().min(1),
  reviewedAt: TimestampSchema,
  reviewedBy: IdSchema
});

export const ReviewAssetOwnershipCandidateInputSchema = z.object({
  disposition: AssetOwnershipReviewDispositionSchema,
  note: z.string().trim().min(8).max(1000)
});

export const AssetOwnershipEntrySchema = z.object({
  asset: AssetSchema,
  basis: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidenceIds: z.array(IdSchema),
  hostnames: z.array(z.string().min(1)),
  latestObservedAt: TimestampSchema.nullish(),
  lifecycle: AssetOwnershipLifecycleSchema,
  matchedScopeId: IdSchema.nullish(),
  matchedScopeValue: z.string().min(1).nullish(),
  ownershipStatus: AssetOwnershipStatusSchema,
  review: AssetOwnershipReviewSchema.nullish(),
  sourceCount: z.number().int().nonnegative()
});

export const AssetOwnershipSurfaceSchema = z.object({
  entries: z.array(AssetOwnershipEntrySchema),
  generatedAt: TimestampSchema,
  summary: z.object({
    attributedAssetCount: z.number().int().nonnegative(),
    averageAttributedConfidence: z.number().min(0).max(1),
    internetFacingAssetCount: z.number().int().nonnegative(),
    unattributedCandidateCount: z.number().int().nonnegative(),
    verifiedRootCount: z.number().int().nonnegative()
  })
});

export const DataFabricSourceQualityStateSchema = z.enum([
  "Qualified",
  "Degraded",
  "Stale",
  "PendingFirstSync",
  "Disconnected"
]);

export const DataFabricSourceQualitySchema = z.object({
  ageHours: z.number().nonnegative().nullish(),
  assetObservationCount: z.number().int().nonnegative(),
  freshnessBudgetHours: z.number().positive(),
  healthStatus: IntegrationHealthStatusSchema,
  integrationId: IdSchema,
  issues: z.array(z.string().min(1)),
  label: z.string().min(1),
  lastEvidenceAt: TimestampSchema.nullish(),
  lastSyncAt: TimestampSchema.nullish(),
  signalCount: z.number().int().nonnegative(),
  state: DataFabricSourceQualityStateSchema,
  status: IntegrationStatusSchema
});

/**
 * Scan-file importer product-path honesty (P13-7 / P11R-4 / P19-r4).
 * POST /api/v1/data-fabric/scan-import (operationId importScanFile) is a real
 * tenant-scoped product path that writes Imported signals. Honesty must match
 * the executable API — never permanent NotConfigured while the route ships.
 * Web upload is shipped (uiUpload=true); raw EvidenceArtifact chain remains
 * Partial. Imported ≠ Measured.
 */
export const ScanFileImportHonestySchema = z.object({
  detail: z.string().min(1),
  /** Always Imported — import never claims Measured / Validated re-probe. */
  evidenceBasis: z.literal("Imported"),
  formats: z.array(z.enum(["nessus", "csv", "sarif"])).min(1),
  libraryAvailable: z.literal(true),
  /**
   * ApiAvailable = authenticated POST importScanFile is customer-callable.
   * Not a claim that durable raw-file EvidenceArtifact integrity is complete.
   */
  productPath: z.literal("ApiAvailable"),
  /**
   * Partial: API + web upload real; durable raw-file EvidenceArtifact integrity
   * chain on import is still incomplete (do not claim full evidence chain).
   */
  status: z.literal("Partial"),
  /** Web Assets workbench exposes file/textarea upload for BYO scan files. */
  uiUpload: z.literal(true)
});
export type ScanFileImportHonesty = z.infer<typeof ScanFileImportHonestySchema>;

export function buildScanFileImportHonesty(): ScanFileImportHonesty {
  return {
    detail:
      "POST /api/v1/data-fabric/scan-import accepts scoped Nessus (.nessus), vulnerability CSV, and SARIF bodies and writes signal fabric rows as evidenceBasis=Imported (never Measured or Validated). Connector parsers and the Assets workbench upload path are real (uiUpload=true, productPath=ApiAvailable). Raw-file EvidenceArtifact integrity chain on import remains incomplete — status is Partial, not a full evidence chain. Use live connectors for continuous inventory; treat BYO import as prioritization input only.",
    evidenceBasis: "Imported",
    formats: ["nessus", "csv", "sarif"],
    libraryAvailable: true,
    productPath: "ApiAvailable",
    status: "Partial",
    uiUpload: true
  };
}

export const DataFabricQualitySurfaceSchema = z.object({
  entries: z.array(DataFabricSourceQualitySchema),
  generatedAt: TimestampSchema,
  /** Honest scan-file import posture (ApiAvailable + Partial while UI/raw chain incomplete). */
  scanFileImport: ScanFileImportHonestySchema,
  summary: z.object({
    degraded: z.number().int().nonnegative(),
    disconnected: z.number().int().nonnegative(),
    pendingFirstSync: z.number().int().nonnegative(),
    qualified: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  })
});

/** Customer scan-file import into the unified signal fabric (P13-7). */
export const ScanImportFormatSchema = z.enum(["nessus", "csv", "sarif"]);
export const ImportScanFileInputSchema = z.object({
  format: ScanImportFormatSchema,
  // UTF-8 file body (max ~5 MiB decoded). Prefer scoped exports, not full estate dumps.
  content: z.string().min(1).max(5_000_000),
  // Optional operator label for audit (filename or ticket ref).
  label: z.string().trim().min(1).max(240).nullish()
});
export const ScanImportResultSchema = z.object({
  format: ScanImportFormatSchema,
  findingCount: z.number().int().nonnegative(),
  signalCount: z.number().int().nonnegative(),
  importedAt: TimestampSchema,
  label: z.string().nullish(),
  // Always Imported — never Measured. Periscan did not re-probe these exposures.
  evidenceBasis: z.literal("Imported"),
  disclaimer: z.string().min(1),
  signalIds: z.array(IdSchema).max(500)
});

export const IdentitySchema = TenantScopedEntitySchema.extend({
  identityId: IdSchema,
  provider: z.string().min(1),
  identityType: IdentityTypeSchema,
  username: z.string().min(1).nullish(),
  email: z.email().nullish(),
  privilegeLevel: PrivilegeLevelSchema,
  mfaStatus: MFAStatusSchema,
  groups: StringListSchema,
  roles: StringListSchema,
  riskFlags: StringListSchema,
  firstSeenAt: TimestampSchema.nullish(),
  lastSeenAt: TimestampSchema.nullish()
});

export const NonHumanIdentityTypeSchema = z.enum([
  "ServiceAccount",
  "OAuthClient",
  "OAuthToken",
  "APIKey",
  "WorkloadRole",
  "Certificate"
]);
export const NonHumanIdentityRiskLevelSchema = z.enum([
  "Low",
  "Medium",
  "High",
  "Critical"
]);
export const NonHumanIdentityRiskFlagSchema = z.enum([
  "Orphaned",
  "OverPrivileged",
  "PubliclyExposed",
  "Stale",
  "RotationOverdue",
  "Expired",
  "CrossEnvironment",
  "UnknownLastUse",
  "UnknownRotation"
]);
export const NonHumanIdentityResourceAccessSchema = z
  .object({
    access: z.string().trim().min(1).max(120),
    environment: z.string().trim().min(1).max(120).nullish(),
    resource: z.string().trim().min(1).max(500)
  })
  .strict();
export const RegisterNonHumanIdentityInputSchema = z
  .object({
    credentialFingerprint: z
      .string()
      .regex(
        /^[a-f0-9]{64}$/iu,
        "Use only a SHA-256 fingerprint; never submit a credential."
      )
      .nullish(),
    displayName: z.string().trim().min(1).max(300),
    environment: z.string().trim().min(1).max(120).nullish(),
    evidenceIds: z.array(IdSchema).max(100).default([]),
    expiresAt: TimestampSchema.nullish(),
    externalId: z.string().trim().min(1).max(500),
    identityType: NonHumanIdentityTypeSchema,
    lastUsedAt: TimestampSchema.nullish(),
    owner: z.string().trim().min(1).max(300).nullish(),
    privileges: z.array(z.string().trim().min(1).max(200)).max(200).default([]),
    provider: z.string().trim().min(1).max(200),
    publicExposure: z.boolean().default(false),
    repository: z.string().trim().min(1).max(500).nullish(),
    resourceAccess: z
      .array(NonHumanIdentityResourceAccessSchema)
      .max(500)
      .default([]),
    rotatedAt: TimestampSchema.nullish(),
    sourceIntegrationId: IdSchema.nullish()
  })
  .strict();
export const NonHumanIdentitySchema = TenantScopedEntitySchema.extend({
  credentialFingerprint: z
    .string()
    .regex(/^[a-f0-9]{64}$/iu)
    .nullish(),
  displayName: z.string().min(1),
  environment: z.string().min(1).nullish(),
  evidenceIds: z.array(IdSchema),
  expiresAt: TimestampSchema.nullish(),
  externalIdHash: z.string().regex(/^[a-f0-9]{64}$/u),
  identityType: NonHumanIdentityTypeSchema,
  lastUsedAt: TimestampSchema.nullish(),
  nonHumanIdentityId: IdSchema,
  owner: z.string().min(1).nullish(),
  privileges: z.array(z.string()),
  provider: z.string().min(1),
  publicExposure: z.boolean(),
  repository: z.string().min(1).nullish(),
  resourceAccess: z.array(NonHumanIdentityResourceAccessSchema),
  riskFlags: z.array(NonHumanIdentityRiskFlagSchema),
  riskLevel: NonHumanIdentityRiskLevelSchema,
  riskRationales: z.array(z.string().min(1)),
  riskScore: z.number().int().min(0).max(100),
  rotatedAt: TimestampSchema.nullish(),
  sourceIntegrationId: IdSchema.nullish()
});
export const NonHumanIdentitySummarySchema = z.object({
  critical: z.number().int().nonnegative(),
  high: z.number().int().nonnegative(),
  orphaned: z.number().int().nonnegative(),
  overPrivileged: z.number().int().nonnegative(),
  publiclyExposed: z.number().int().nonnegative(),
  stale: z.number().int().nonnegative(),
  total: z.number().int().nonnegative()
});
export const NonHumanIdentityInventorySchema = z.object({
  identities: z.array(NonHumanIdentitySchema),
  summary: NonHumanIdentitySummarySchema
});

export const DetectionRuleBehaviorSchema = z.enum([
  "Detected",
  "Blocked",
  "Logged",
  "Alerted",
  "Routed",
  "Missed",
  "NoEvidence",
  "NeedsTuning"
]);
export const ExpectedControlBehaviorSchema = z.enum([
  "Detected",
  "Blocked",
  "Logged",
  "Alerted",
  "Routed"
]);
export const ControlSourceSchema = TenantScopedEntitySchema.extend({
  controlSourceId: IdSchema,
  controlType: ControlSourceTypeSchema,
  provider: z.string().min(1),
  integrationId: IdSchema,
  expectedBehaviors: z.array(ExpectedControlBehaviorSchema).min(1),
  telemetryStatus: IntegrationHealthStatusSchema,
  lastValidatedAt: TimestampSchema.nullish(),
  healthStatus: IntegrationHealthStatusSchema
});
export const DetectionRuleCoverageStatusSchema = z.enum([
  "Covered",
  "Blocked",
  "LoggedOnly",
  "Missed",
  "NoEvidence",
  "NeedsTuning",
  "Stale",
  "NotTested"
]);

export const DetectionRuleCoverageTrendSchema = z.enum([
  "Improved",
  "Regressed",
  "Unchanged",
  "New"
]);

export const DetectionRuleCoverageItemSchema = z.object({
  confidence: z.number().min(0).max(1),
  controlSourceId: IdSchema,
  /**
   * Canonical Slice 5 effectiveness state (NotTested | NoEvidence |
   * Inconclusive | TelemetryOnly | Detected | Prevented | Missed).
   * Optional so persisted snapshots that predate the field still parse;
   * the rule-coverage read path always fills it via
   * mapDetectionRuleCoverageStatusToEffectiveness / ensureCoverageItemEffectivenessState.
   */
  effectivenessState: ControlEffectivenessStateSchema.optional(),
  evidenceIds: IdListSchema,
  expectedBehaviors: z.array(DetectionRuleBehaviorSchema),
  lastObservedAt: TimestampSchema.nullish(),
  observedBehaviors: z.array(DetectionRuleBehaviorSchema),
  // Distinct tool vendors whose ingested telemetry backs this technique — makes
  // coverage explainable ("Covered by SentinelOne, Microsoft Defender XDR")
  // rather than an opaque status.
  observedSources: StringListSchema.default([]),
  previousStatus: DetectionRuleCoverageStatusSchema.nullish().default(null),
  recommendation: z.string().min(1),
  scenarioId: z.string().min(1),
  signalIds: IdListSchema,
  status: DetectionRuleCoverageStatusSchema,
  tacticName: z.string().min(1),
  techniqueId: z.string().regex(/^T\d{4}(?:\.\d{3})?$/),
  techniqueName: z.string().min(1),
  title: z.string().min(1),
  trend: DetectionRuleCoverageTrendSchema.default("New")
});

export const ControlRuleCoverageSnapshotPointSchema = z.object({
  blockedTechniques: z.number().int().nonnegative(),
  coveredTechniques: z.number().int().nonnegative(),
  generatedAt: TimestampSchema,
  improvedTechniques: z.number().int().nonnegative().default(0),
  loggedOnlyTechniques: z.number().int().nonnegative(),
  missedTechniques: z.number().int().nonnegative(),
  needsTuningTechniques: z.number().int().nonnegative(),
  noEvidenceTechniques: z.number().int().nonnegative(),
  notTestedTechniques: z.number().int().nonnegative(),
  regressedTechniques: z.number().int().nonnegative().default(0),
  snapshotId: IdSchema,
  staleTechniques: z.number().int().nonnegative(),
  totalTechniques: z.number().int().nonnegative()
});

export const ControlRuleCoverageSummarySchema = z.object({
  blockedTechniques: z.number().int().nonnegative(),
  controlSourceId: IdSchema.nullish(),
  coveredTechniques: z.number().int().nonnegative(),
  generatedAt: TimestampSchema,
  history: z.array(ControlRuleCoverageSnapshotPointSchema).default([]),
  improvedTechniques: z.number().int().nonnegative().default(0),
  items: z.array(DetectionRuleCoverageItemSchema),
  loggedOnlyTechniques: z.number().int().nonnegative(),
  missedTechniques: z.number().int().nonnegative(),
  needsTuningTechniques: z.number().int().nonnegative(),
  noEvidenceTechniques: z.number().int().nonnegative(),
  notTestedTechniques: z.number().int().nonnegative(),
  recommendations: StringListSchema,
  regressedTechniques: z.number().int().nonnegative().default(0),
  snapshotId: IdSchema.nullish().default(null),
  staleTechniques: z.number().int().nonnegative(),
  tenantId: IdSchema,
  totalTechniques: z.number().int().nonnegative()
});

export const AIApplicationSchema = TenantScopedEntitySchema.extend({
  aiAppId: IdSchema,
  name: z.string().min(1),
  appType: AIApplicationTypeSchema,
  endpointUrl: z.url(),
  authMethod: z.string().min(1),
  ragEnabled: z.boolean(),
  toolsEnabled: z.boolean(),
  dataSourcesDescription: z.string().min(1),
  guardrailsDescription: z.string().min(1),
  testAccountNotes: z.string().nullish(),
  owner: z.string().min(1),
  scopeId: IdSchema,
  lastValidatedAt: TimestampSchema.nullish(),
  // Provenance of the most recent validation, surfaced inline so a consumer can
  // see WHAT the latest AI-app validation produced without a separate history
  // call: the module that ran, the honest outcome/validationState (a benign
  // endpoint probe is Inconclusive, never Validated), and when it completed.
  // Null until the app has been validated at least once.
  latestValidation: z
    .object({
      completedAt: TimestampSchema.nullish(),
      moduleId: z.string().min(1),
      outcome: z.string().min(1).nullish(),
      runId: IdSchema,
      status: RunStatusSchema,
      validationState: ValidationStateSchema.nullish()
    })
    .nullish(),
  validationKillSwitch: z
    .object({
      activatedAt: TimestampSchema.nullable(),
      activatedBy: IdSchema.nullable(),
      enabled: z.boolean(),
      reason: z.string().min(1).nullable()
    })
    .optional()
});

export const ExposureSchema = TenantScopedEntitySchema.extend({
  exposureId: IdSchema,
  assetId: IdSchema.nullish(),
  exposureType: z.string().min(1),
  source: z.string().min(1),
  severity: SeveritySchema,
  confidence: z.number().min(0).max(1),
  validationState: ValidationStateSchema,
  firstSeenAt: TimestampSchema.nullish(),
  lastSeenAt: TimestampSchema.nullish(),
  status: ExposureStatusSchema
}).merge(EvidenceLinkedSchema);

export const ScenarioSchema = TenantScopedEntitySchema.extend({
  scenarioId: IdSchema,
  name: z.string().min(1),
  scenarioType: ScenarioTypeSchema,
  description: z.string().nullish(),
  techniqueIds: StringListSchema,
  expectedControlBehaviors: StringListSchema
})
  .merge(ValidationContextSchema)
  .merge(EvidenceLinkedSchema);

export const ValidationMissionSchema = TenantScopedEntitySchema.extend({
  missionId: IdSchema,
  missionType: MissionTypeSchema,
  requestedBy: IdSchema,
  scopeIds: IdListSchema.min(1),
  policyProfile: z.string().min(1).nullish(),
  status: MissionStatusSchema,
  startedAt: TimestampSchema.nullish(),
  completedAt: TimestampSchema.nullish()
})
  .merge(ValidationContextSchema)
  .merge(EvidenceLinkedSchema);

export const ValidationRunSchema = TenantScopedEntitySchema.extend({
  runId: IdSchema,
  missionId: IdSchema,
  moduleId: z.string().min(1),
  runnerId: z.string().min(1).nullish(),
  target: LooseObjectSchema,
  status: RunStatusSchema,
  outcome: z.string().min(1).nullish(),
  validationState: ValidationStateSchema.nullish(),
  startedAt: TimestampSchema.nullish(),
  completedAt: TimestampSchema.nullish(),
  errorSummary: z.string().nullish(),
  techniqueIds: StringListSchema.optional()
})
  .merge(ValidationContextSchema)
  .merge(EvidenceLinkedSchema);

export const MissionStartResultSchema = z.object({
  jobsQueued: z.number().int().nonnegative(),
  mission: ValidationMissionSchema,
  runs: z.array(ValidationRunSchema)
});

export const ExternalValidationAttemptSchema = z.object({
  mission: ValidationMissionSchema,
  runs: z.array(ValidationRunSchema)
});

export const ValidationStimulusTypeSchema = z.enum(["OwnedDomainUrlCanary"]);
export const ValidationStimulusStatusSchema = z.enum([
  "RequiresApproval",
  "Ready",
  "Dispatching",
  "Observing",
  "Completed",
  "Failed",
  "DeniedByPolicy",
  "Cancelled"
]);
export const ControlValidationVerdictSchema = z.enum([
  "Prevented",
  "Detected",
  "TelemetryOnly",
  "Missed",
  "Inconclusive",
  "NotObservedBeforeTimeout"
]);
export const ControlValidationVerdictRecordSchema =
  TenantScopedEntitySchema.extend({
    controlSourceId: IdSchema,
    correlationMatched: z.boolean(),
    evidenceIds: IdListSchema,
    observedAt: TimestampSchema.nullish(),
    observedOutcome: z.string().min(1).nullish(),
    reason: z.string().min(1),
    signalIds: IdListSchema,
    stimulusId: IdSchema,
    verdict: ControlValidationVerdictSchema,
    verdictId: IdSchema
  });
export const ValidationStimulusSchema = TenantScopedEntitySchema.extend({
  cleanupBehavior: z.string().min(1),
  completedAt: TimestampSchema.nullish(),
  controlSourceId: IdSchema,
  createdBy: IdSchema,
  dispatchReceipt: z
    .object({
      latencyMs: z.number().int().nonnegative(),
      method: z.literal("GET"),
      requestBytes: z.number().int().nonnegative(),
      responseStatus: z.number().int().min(100).max(599),
      targetHost: z.string().min(1)
    })
    .nullish(),
  dispatchedAt: TimestampSchema.nullish(),
  errorSummary: z.string().nullish(),
  evidenceIds: IdListSchema,
  expectedControlBehaviors: z.array(ExpectedControlBehaviorSchema).min(1),
  markerFingerprint: z.string().min(8),
  maxRequestBytes: z.number().int().positive(),
  missionId: IdSchema,
  observationDeadlineAt: TimestampSchema.nullish(),
  policyDecisionId: IdSchema,
  rateLimitPerMinute: z.number().int().positive(),
  runId: IdSchema.nullish(),
  safetyLevel: SafetyLevelSchema,
  scopeId: IdSchema,
  status: ValidationStimulusStatusSchema,
  stimulusId: IdSchema,
  stimulusType: ValidationStimulusTypeSchema,
  targetHost: z.string().min(1),
  techniqueId: z.string().regex(/^T\d{4}(?:\.\d{3})?$/),
  ttlSeconds: z.number().int().min(60).max(3600),
  verdict: ControlValidationVerdictRecordSchema.nullish()
});

export const CreateValidationStimulusInputSchema = z.object({
  controlSourceId: IdSchema,
  scopeId: IdSchema,
  stimulusType: ValidationStimulusTypeSchema.default("OwnedDomainUrlCanary"),
  techniqueId: z.string().regex(/^T\d{4}(?:\.\d{3})?$/),
  ttlSeconds: z.number().int().min(60).max(3600).default(600)
});

export const CreateValidationStimulusResponseSchema = z.object({
  policyDecision: z.lazy(() => PolicyDecisionSchema),
  stimulus: ValidationStimulusSchema
});

/**
 * Wave B: signed benign-marker emit→observe DRV product path.
 * Allowlisted `periscan-*` process canary only — not full ATT&CK BAS library.
 */
export const DetectionMarkerProofInputSchema = z.object({
  expectedRule: z.string().min(1).optional(),
  fixtureMode: z.boolean().optional(),
  /**
   * When true, include mock SIEM events containing the marker so the observe
   * half can close in lab/demo. Live paths should pass false and rely on
   * connector observe / supplied observedEvents.
   */
  injectMockObservation: z.boolean().optional(),
  markerId: z
    .string()
    .min(8)
    .max(128)
    .regex(/^periscan-[A-Za-z0-9._:-]{4,120}$/u)
    .optional(),
  observedEvents: z
    .array(z.union([z.string(), z.record(z.string(), z.unknown())]))
    .optional(),
  performEmit: z.boolean().optional(),
  platform: z.enum(["macOS", "Linux"]).optional(),
  platformAnalytics: z.enum(["macOS", "Linux"]).optional(),
  scopeId: IdSchema.optional(),
  techniqueId: z.string().min(1).optional()
});

export const DetectionMarkerProofResultSchema = z.object({
  closedLoop: z.boolean(),
  /** Always benign-marker class — never full ATT&CK library inject. */
  drvClaimClass: z.literal("benign_marker_only"),
  /** Always false: product refuses full ATT&CK BAS library claims. */
  fullAttackLibrary: z.literal(false),
  markerId: z.string().min(1),
  mission: ValidationMissionSchema,
  outcome: z.string().min(1),
  runs: z.array(ValidationRunSchema).min(1),
  summary: z.string().min(1),
  validationState: ValidationStateSchema.nullish()
});

/**
 * Phase C: bounded DNS-exfil *detection* canary product path.
 * Emits allowlisted label only — never real data exfiltration / bulk tunnel.
 */
export const DnsExfilCanaryProofInputSchema = z.object({
  fixtureMode: z.boolean().optional(),
  /**
   * When true, include mock DLP/DNS-monitor events containing the canary so the
   * observe half can close in lab/demo. Live paths should pass false and rely
   * on connector observe / supplied observedEvents.
   */
  injectMockObservation: z.boolean().optional(),
  markerId: z
    .string()
    .min(8)
    .max(128)
    .regex(/^periscan-[A-Za-z0-9._:-]{4,120}$/u)
    .optional(),
  observedEvents: z
    .array(z.union([z.string(), z.record(z.string(), z.unknown())]))
    .optional(),
  scopeId: IdSchema.optional(),
  /** Override hostname; otherwise taken from verified Domain/Subdomain scope. */
  hostname: z.string().min(1).max(253).optional(),
  techniqueId: z.string().min(1).optional()
});

export const DnsExfilCanaryProofResultSchema = z.object({
  closedLoop: z.boolean(),
  /** Always benign canary class — never real exfil. */
  exfilClaimClass: z.literal("benign_marker_only"),
  /** Always false: product never tunnels customer data. */
  realDataExfiltrated: z.literal(false),
  /** Always false: not a multi-vector exfil/malware library. */
  fullExfilLibrary: z.literal(false),
  canaryLabel: z.string().min(1),
  canaryFqdn: z.string().min(1),
  measured: z.boolean(),
  markerId: z.string().min(1),
  mission: ValidationMissionSchema,
  outcome: z.string().min(1),
  runs: z.array(ValidationRunSchema).min(1),
  summary: z.string().min(1),
  validationState: ValidationStateSchema.nullish()
});

export const SignalEnvelopeSchema = TenantScopedEntitySchema.extend({
  signalId: IdSchema,
  sourceIntegrationId: IdSchema.nullish(),
  // Provenance: set when the signal was measured in-network by a runner-agent
  // (null = control-plane-measured).
  sourceRunnerId: IdSchema.nullish(),
  sourceType: z.string().min(1),
  sourceVendor: z.string().min(1),
  signalCategory: SignalCategorySchema,
  signalSubcategory: z.string().min(1).nullish(),
  timestampObserved: TimestampSchema,
  timestampIngested: TimestampSchema,
  confidence: z.number().min(0).max(1).nullish(),
  freshness: z.string().min(1).nullish(),
  sensitivityLevel: SensitivityLevelSchema,
  relatedAssetIds: IdListSchema,
  relatedIdentityIds: IdListSchema,
  relatedControlIds: IdListSchema,
  relatedPathIds: IdListSchema,
  relatedEvidenceIds: IdListSchema,
  techniqueIds: StringListSchema.optional(),
  // Transient host/IP hints carried from a connector to the sync pipeline, where
  // they are resolved to relatedAssetIds against the tenant's assets. Not a
  // persisted column — cleared once resolved.
  relatedAssetHints: StringListSchema.optional(),
  rawPayloadPointer: z.string().min(1).nullish(),
  redactionStatus: RedactionStatusSchema
}).merge(EvidenceLinkedSchema);

export const EvidenceArtifactSchema = z.object({
  evidenceId: IdSchema,
  tenantId: IdSchema,
  artifactType: EvidenceArtifactTypeSchema,
  storageUri: z.string().min(1),
  sha256: z.string().min(1),
  sensitivityLevel: SensitivityLevelSchema,
  redactionStatus: RedactionStatusSchema,
  relatedEntityType: RelatedEntityTypeSchema,
  relatedEntityId: IdSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  // Authorized post-ingest redaction metadata (null until an operator redacts).
  // redactedSha256 is the hash of the redacted copy; the ingest sha256/chain is
  // preserved separately so tamper-evidence still holds.
  redactedAt: TimestampSchema.nullish(),
  redactedSha256: z.string().nullish()
});

export const EvidenceVerificationMethodSchema = z.object({
  algorithm: z.literal("SHA-256"),
  authority: z.literal("Periscan evidence service"),
  description: z.string().min(1),
  signaturePresent: z.literal(false)
});

export const EvidenceChainLinkVerificationStatusSchema = z.enum([
  "Verified",
  "Broken",
  "NotChecked"
]);

export const EvidenceChainLinkVerificationSchema = z.object({
  evidenceId: IdSchema,
  chainSeq: z.string().regex(/^\d+$/),
  prevChainHash: z.string().nullable(),
  chainHash: z.string().min(1),
  status: EvidenceChainLinkVerificationStatusSchema,
  valid: z.boolean(),
  reason: z.string().min(1).nullable()
});

export const EvidenceChainVerificationReportSchema = z.object({
  tenantId: IdSchema,
  valid: z.boolean(),
  checked: z.number().int().nonnegative(),
  totalArtifacts: z.number().int().nonnegative(),
  chainedArtifacts: z.number().int().nonnegative(),
  legacyUnchainedArtifacts: z.number().int().nonnegative(),
  brokenAtSeq: z.string().regex(/^\d+$/).nullable(),
  reason: z.string().min(1).nullable(),
  verifiedAt: TimestampSchema,
  method: EvidenceVerificationMethodSchema,
  links: z.array(EvidenceChainLinkVerificationSchema)
});

export const EvidenceArtifactVerificationStatusSchema = z.enum([
  "Verified",
  "ContentOnly",
  "Broken",
  "Unavailable"
]);

export const EvidenceArtifactVerificationSchema = z.object({
  evidenceId: IdSchema,
  tenantId: IdSchema,
  status: EvidenceArtifactVerificationStatusSchema,
  valid: z.boolean(),
  verifiedAt: TimestampSchema,
  method: EvidenceVerificationMethodSchema,
  content: z.object({
    commitment: z.enum(["Ingest", "RedactedCopy"]),
    computedSha256: z.string().min(1).nullable(),
    recordedSha256: z.string().min(1),
    valid: z.boolean()
  }),
  chain: EvidenceChainLinkVerificationSchema.nullable(),
  reason: z.string().min(1).nullable()
});

/**
 * Graph node type ontology (P11-1 / P11R-1).
 *
 * `GraphNode.nodeType` is a closed registry, not a free string. Writers must use
 * either:
 *
 * 1. A bare PRD-aligned kind from `GRAPH_NODE_BARE_TYPES`
 *    (e.g. `ValidationRun`, `EvidenceArtifact`, `ValidationMission`), or
 * 2. A `Family.Leaf` form where `Family` is in `GRAPH_NODE_TYPE_FAMILIES` and
 *    `Leaf` is on that family's closed allowlist (domain enum or product class).
 *
 * Free-string signal subcategories are **not** graph leaves. Writers must call
 * `resolveGraphNodeType(family, leaf)` so unknown leaves collapse to bare family
 * (subcategory stays on the signal / node properties). Bump
 * `GRAPH_NODE_TYPE_ONTOLOGY_VERSION` when allowlists change incompatibly.
 */
export const GRAPH_NODE_TYPE_ONTOLOGY_VERSION = 2 as const;

/**
 * Bare (unprefixed) graph node kinds — PRD §12.1 plus durable runtime anchors
 * and 1:1 RelatedEntityType projections (P11R-2: Mission ≠ Run, Scope ≠ Asset).
 */
export const GRAPH_NODE_BARE_TYPES = [
  "Asset",
  "Identity",
  "Permission",
  "CloudResource",
  "Repository",
  "Secret",
  "Exposure",
  "Vulnerability",
  "ControlSource",
  "AIApplication",
  "ValidationRun",
  "ValidationMission",
  "Scope",
  "Integration",
  "Runner",
  "RunnerTask",
  "ThreatAdvisory",
  "Scenario",
  "EvidenceArtifact",
  "AttackPath",
  "RemediationTask",
  "VerificationEvent"
] as const;

/**
 * Closed node-type families for `Family.Leaf` forms.
 * Every family either uses a domain enum or an explicit leaf allowlist —
 * never an open free-string escape hatch (P11R-1).
 */
export const GRAPH_NODE_TYPE_FAMILIES = [
  "Asset",
  "Signal",
  "Exposure",
  "Identity",
  "Secret",
  "CloudResource",
  "ControlSource",
  "HeuristicHypothesis",
  "PRD",
  "Vulnerability",
  "Permission",
  "Repository",
  "AIApplication",
  "ValidationRun",
  "ValidationMission",
  "Scope",
  "Integration",
  "Runner",
  "RunnerTask",
  "ThreatAdvisory",
  "Scenario",
  "EvidenceArtifact",
  "AttackPath",
  "RemediationTask",
  "VerificationEvent"
] as const;

/** Legacy Asset.* leaves used in graph tests / historical projections. */
export const GRAPH_NODE_ASSET_LEGACY_LEAVES = [
  "CloudRole",
  "StorageBucket"
] as const;

/**
 * Closed Exposure.* product classes (P11R-1).
 * Free signalSubcategory strings that are not on this list must not become
 * graph leaves — use bare `Exposure` and keep subcategory on properties.
 */
export const GRAPH_NODE_EXPOSURE_LEAVES = [
  "Observed",
  "Secret",
  "SecretExposure",
  "PublicAdmin",
  "RepositorySecret",
  "ImportedScanFinding",
  "ExternalExposure",
  "AIAppRisk",
  "MissedControlObservation",
  "RealExposure",
  "InternetReachablePort",
  "CredentialedCorsExploit",
  "ConfirmedExploitable",
  "CloudMisconfiguration",
  "CloudPostureFinding",
  "Vulnerability",
  "IdentityRisk",
  "NetworkExposure",
  "CredentialExposure",
  "ControlGap",
  "Other"
] as const;

/**
 * Closed Identity.* leaves: IdentityType + PrivilegeLevel product kinds.
 * PrincipalKind (human/service/workload/key) is inventory packaging, not a
 * separate graph family — PascalCase product kinds only here.
 */
export const GRAPH_NODE_IDENTITY_LEAVES = [
  "Human",
  "ServiceAccount",
  "Role",
  "Group",
  "APIKey",
  "Other",
  "Standard",
  "Privileged",
  "Administrator",
  "Unknown"
] as const;

/** Closed Secret.* classes (credential material kinds). */
export const GRAPH_NODE_SECRET_LEAVES = [
  "RepositoryCredential",
  "APIKey",
  "OAuthToken",
  "Certificate",
  "CloudCredential",
  "Password",
  "PrivateKey",
  "Other"
] as const;

/** Closed CloudResource.* classes (inventory / IAM resource kinds). */
export const GRAPH_NODE_CLOUD_RESOURCE_LEAVES = [
  "Role",
  "StorageBucket",
  "Compute",
  "Network",
  "Database",
  "Function",
  "Bucket",
  "Other"
] as const;

const GRAPH_NODE_TYPE_LEAF_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/;

export const GraphNodeBareTypeSchema = z.enum(GRAPH_NODE_BARE_TYPES);
export const GraphNodeTypeFamilySchema = z.enum(GRAPH_NODE_TYPE_FAMILIES);

function isAllowedGraphNodeTypeLeaf(
  family: (typeof GRAPH_NODE_TYPE_FAMILIES)[number],
  leaf: string
): boolean {
  if (!GRAPH_NODE_TYPE_LEAF_PATTERN.test(leaf)) {
    return false;
  }

  switch (family) {
    case "Signal":
      return (SignalCategorySchema.options as readonly string[]).includes(leaf);
    case "Asset":
    case "HeuristicHypothesis":
      return (
        (AssetTypeSchema.options as readonly string[]).includes(leaf) ||
        (GRAPH_NODE_ASSET_LEGACY_LEAVES as readonly string[]).includes(leaf)
      );
    case "ControlSource":
      return (ControlSourceTypeSchema.options as readonly string[]).includes(
        leaf
      );
    case "Exposure":
      return (GRAPH_NODE_EXPOSURE_LEAVES as readonly string[]).includes(leaf);
    case "Identity":
      return (GRAPH_NODE_IDENTITY_LEAVES as readonly string[]).includes(leaf);
    case "Secret":
      return (GRAPH_NODE_SECRET_LEAVES as readonly string[]).includes(leaf);
    case "CloudResource":
      return (GRAPH_NODE_CLOUD_RESOURCE_LEAVES as readonly string[]).includes(
        leaf
      );
    case "AIApplication":
      return (AIApplicationTypeSchema.options as readonly string[]).includes(
        leaf
      );
    case "PRD":
      return (GRAPH_NODE_BARE_TYPES as readonly string[]).includes(leaf);
    default:
      // Bare-only families (ValidationRun, AttackPath, Scope, …): no free leaves.
      return false;
  }
}

/**
 * Returns true when `value` is an allowlisted bare kind or Family.Leaf form.
 * Use on create/update paths; unknown types must be rejected.
 */
export function isAllowedGraphNodeType(value: string): boolean {
  if ((GRAPH_NODE_BARE_TYPES as readonly string[]).includes(value)) {
    return true;
  }

  const separator = value.indexOf(".");
  if (separator <= 0 || separator !== value.lastIndexOf(".")) {
    return false;
  }

  const family = value.slice(0, separator);
  const leaf = value.slice(separator + 1);
  if (!(GRAPH_NODE_TYPE_FAMILIES as readonly string[]).includes(family)) {
    return false;
  }

  return isAllowedGraphNodeTypeLeaf(
    family as (typeof GRAPH_NODE_TYPE_FAMILIES)[number],
    leaf
  );
}

/**
 * Writer helper: Family.Leaf when leaf is allowlisted, else bare family.
 * Never invent free-string ontology from signal subcategories (P11R-1).
 */
export function resolveGraphNodeType(
  family: string,
  leaf?: string | null
): string {
  const trimmedLeaf = leaf?.trim();
  if (trimmedLeaf && trimmedLeaf.length > 0) {
    const candidate = `${family}.${trimmedLeaf}`;
    if (isAllowedGraphNodeType(candidate)) {
      return candidate;
    }
  }
  if (isAllowedGraphNodeType(family)) {
    return family;
  }
  return family;
}

export const GraphNodeTypeSchema = z
  .string()
  .min(1)
  .refine(isAllowedGraphNodeType, {
    message:
      "nodeType must be an allowlisted bare type (e.g. ValidationRun, EvidenceArtifact, ValidationMission) or Family.Leaf form with a closed leaf catalog (e.g. Signal.Repository, Asset.CloudResource, Exposure.SecretExposure). Unknown Exposure/Identity/Secret/CloudResource leaves are rejected — use resolveGraphNodeType(). See GRAPH_NODE_BARE_TYPES and GRAPH_NODE_TYPE_FAMILIES (ontology v2)."
  });


export const GraphNodeSchema = TenantScopedEntitySchema.extend({
  graphNodeId: IdSchema,
  nodeType: GraphNodeTypeSchema,
  nodeKey: z.string().min(1),
  // P09-13: risk partition only — platform types (webhooks, marketplace) are not graph coordinates.
  relatedEntityType: RiskRelatedEntityTypeSchema.nullish(),
  relatedEntityId: IdSchema.nullish(),
  label: z.string().min(1),
  properties: LooseObjectSchema
}).merge(EvidenceLinkedSchema);

export const GraphEdgeSchema = TenantScopedEntitySchema.extend({
  graphEdgeId: IdSchema,
  sourceNodeId: IdSchema,
  targetNodeId: IdSchema,
  relationship: EdgeRelationshipSchema,
  rationale: z.string().min(1).nullish(),
  properties: LooseObjectSchema,
  evidenceBasis: z.enum(["Measured", "Heuristic"]).default("Heuristic"),
  measurementMethod: z.string().min(1).nullish()
}).merge(EvidenceLinkedSchema);

export const PathNodeSchema = TenantScopedEntitySchema.extend({
  pathNodeId: IdSchema,
  pathId: IdSchema,
  entityType: RelatedEntityTypeSchema,
  entityId: IdSchema,
  label: z.string().min(1),
  sequence: z.number().int().nonnegative()
}).merge(EvidenceLinkedSchema);

export const PathEdgeSchema = TenantScopedEntitySchema.extend({
  pathEdgeId: IdSchema,
  pathId: IdSchema,
  sourceNodeId: IdSchema,
  targetNodeId: IdSchema,
  relationship: EdgeRelationshipSchema,
  rationale: z.string().min(1).nullish(),
  // Every hop carries its own certainty. A path may only be called Measured
  // when every persisted edge is Measured; one heuristic hop makes the path
  // heuristic because certainty is derived from the weakest edge.
  evidenceBasis: z.enum(["Measured", "Heuristic"]).default("Heuristic"),
  measurementMethod: z.string().min(1).nullish()
}).merge(EvidenceLinkedSchema);

export const PathBreakerSchema = TenantScopedEntitySchema.extend({
  pathBreakerId: IdSchema,
  pathId: IdSchema,
  title: z.string().min(1),
  description: z.string().min(1),
  priority: z.number().int().min(1).max(5),
  relatedNodeId: IdSchema.nullish()
}).merge(EvidenceLinkedSchema);

export const EvidenceBasisSchema = z.enum(["Measured", "Heuristic"]);

export const AttackPathSchema = TenantScopedEntitySchema.extend({
  pathId: IdSchema,
  name: z.string().min(1),
  entryNodeId: IdSchema,
  impactNodeId: IdSchema,
  confidence: z.number().min(0).max(1),
  impactScore: z.number().min(0),
  // Measured = derived from authoritative config/observed probe; Heuristic =
  // inferred from a known attack pattern. Lets the UI/report avoid presenting an
  // estimated path as if it were proven.
  evidenceBasis: EvidenceBasisSchema.default("Heuristic"),
  methodology: z.string().min(1).nullish(),
  validationState: ValidationStateSchema,
  pathNodes: z.array(PathNodeSchema),
  pathEdges: z.array(PathEdgeSchema),
  pathBreakers: z.array(PathBreakerSchema)
})
  .merge(EvidenceLinkedSchema)
  .extend({
    // Non-snap enrichment: when evidence for this path came from a scheduled non-snapshot
    // Control/AI/Fix pack, attach packType + direct backlink target (packId) + optional schedule ref.
    nonSnapPack: z
      .object({
        evidencePackId: IdSchema,
        packType: EvidencePackTypeSchema,
        scheduleId: IdSchema.nullish()
      })
      .nullish()
  });

// --- Slice 3: edge-level validation plans + measured path edge receipts ---
//
// A path is only Measured when every hop is Measured with evidence. Planning
// surfaces safe ActiveNonInvasive/PassiveReadOnly modules per hop; receipts
// record the measurement outcome so path state can be recomputed without
// upgrading unrelated edges by association.

export const PathEdgeValidationEligibilitySchema = z.enum([
  "Eligible",
  "NeedsScope",
  "NeedsRunner",
  "NeedsIntegration",
  "NeedsApproval",
  "AlreadyMeasured",
  "NoSafeModule",
  /**
   * Hop can be re-imported / graph-verified but never upgrades to Measured
   * path proof (e.g. BloodHound-compatible identity import). P05-4.
   */
  "HeuristicOnly"
]);

export const AttackPathValidationPlanOverallStatusSchema = z.enum([
  "Ready",
  "PartiallyReady",
  "Blocked",
  "FullyMeasured"
]);

export const AttackPathEdgePlanItemSchema = z.object({
  pathEdgeId: IdSchema,
  sequence: z.number().int().nonnegative(),
  relationship: EdgeRelationshipSchema,
  evidenceBasis: EvidenceBasisSchema,
  recommendedModuleIds: StringListSchema,
  safetyLevel: SafetyLevelSchema,
  missionType: MissionTypeSchema,
  requiredScopeTypes: z.array(ScopeTypeSchema),
  requiresInternalRunner: z.boolean(),
  prerequisites: StringListSchema,
  missingTelemetry: StringListSchema,
  eligibility: PathEdgeValidationEligibilitySchema
});

export const AttackPathValidationPlanSchema = z.object({
  pathId: IdSchema,
  claimSummary: z.string().min(1),
  items: z.array(AttackPathEdgePlanItemSchema),
  overallStatus: AttackPathValidationPlanOverallStatusSchema
});

export const PathEdgeReceiptSchema = z.object({
  receiptId: IdSchema,
  // Optional on API DTOs that already scope by session tenant; required when
  // persisted multi-tenant.
  tenantId: IdSchema.optional(),
  pathId: IdSchema,
  pathEdgeId: IdSchema,
  hopKey: z.string().min(1),
  validationRunId: IdSchema.nullish(),
  missionId: IdSchema.nullish(),
  policyDecisionId: IdSchema.nullish(),
  moduleId: z.string().min(1),
  outcome: z.string().min(1),
  validationState: ValidationStateSchema,
  evidenceIds: IdListSchema,
  measuredAt: TimestampSchema,
  measurementMethod: z.string().min(1),
  integrityHash: z.string().min(1).nullish(),
  actor: z.string().min(1).nullish()
});

export const AttackPathMeasurementStateSchema = z.object({
  pathId: IdSchema,
  pathEvidenceBasis: EvidenceBasisSchema,
  measuredEdgeCount: z.number().int().nonnegative(),
  totalEdgeCount: z.number().int().nonnegative(),
  /**
   * measuredEdgeCount / totalEdgeCount from receipt-backed hops only
   * (Measured + non-empty evidenceIds). 0 when the path has no edges.
   */
  measuredHopFraction: z.number().min(0).max(1),
  fullyMeasured: z.boolean(),
  /**
   * Claim-safe path validationState after recomputing from hop receipts.
   * Never upgrades Heuristic/partial paths to Validated/Exploitable.
   */
  claimSafeValidationState: ValidationStateSchema,
  edgeStates: z.array(
    z.object({
      pathEdgeId: IdSchema,
      hopKey: z.string().min(1).nullish(),
      evidenceBasis: EvidenceBasisSchema,
      evidenceIds: IdListSchema,
      measurementMethod: z.string().min(1).nullish(),
      latestReceiptId: IdSchema.nullish()
    })
  )
});

export const ApplyPathEdgeReceiptInputSchema = z.object({
  pathId: IdSchema,
  pathEdgeId: IdSchema,
  hopKey: z.string().min(1).optional(),
  validationRunId: IdSchema.nullish(),
  missionId: IdSchema.nullish(),
  policyDecisionId: IdSchema.nullish(),
  moduleId: z.string().min(1),
  outcome: z.string().min(1),
  validationState: ValidationStateSchema,
  evidenceIds: IdListSchema.min(1),
  measuredAt: TimestampSchema.optional(),
  measurementMethod: z.string().min(1),
  integrityHash: z.string().min(1).nullish(),
  actor: z.string().min(1).nullish()
});

export const LaunchPathEdgeValidationInputSchema = z.object({
  pathId: IdSchema,
  pathEdgeId: IdSchema,
  moduleId: z.string().min(1),
  scopeId: IdSchema,
  missionType: MissionTypeSchema.default("ExposureValidation"),
  safetyLevel: SafetyLevelSchema.default("ActiveNonInvasive"),
  reason: z.string().max(1024).optional()
});

/** Result of applying a hop receipt: receipt plus recomputed measurement state. */
export const ApplyPathEdgeReceiptResultSchema = z.object({
  receipt: PathEdgeReceiptSchema,
  measurementState: AttackPathMeasurementStateSchema,
  attackPath: AttackPathSchema
});

/**
 * Edge-scoped validation launch result. Policy is required on every launch:
 * - Denied never creates a mission and never queues.
 * - Allowed creates a mission and queues the hop-probe module (same path as
 *   startMission) so the Measure hop journey can complete without a second
 *   manual start step. Never fabricates Measured outcomes from launch alone.
 * - RequiresApproval (and other non-Allowed, non-Denied gates) creates a
 *   Draft mission and returns RequiresApproval with queued=false.
 * AttackPathAssessmentSchema / PolicyDecisionSchema are declared later in this
 * module — use lazy so Zod does not require temporal declaration order.
 */
export const PathEdgeValidationLaunchResultSchema = z.object({
  attackPath: z.lazy(() => AttackPathAssessmentSchema),
  pathEdgeId: IdSchema,
  hopKey: z.string().min(1),
  moduleId: z.string().min(1),
  evidenceIds: IdListSchema,
  mission: ValidationMissionSchema.nullish(),
  policyDecision: z.lazy(() => PolicyDecisionSchema),
  queued: z.boolean(),
  status: z.enum(["Queued", "RequiresApproval", "Denied"]),
  verificationPlan: z
    .object({
      nextStep: z.string().min(1),
      reason: z.string().min(1).nullish(),
      requestedAt: TimestampSchema,
      scopeId: IdSchema,
      pathEdgeId: IdSchema,
      hopKey: z.string().min(1),
      moduleId: z.string().min(1)
    })
    .nullish()
});

export const RemediationTaskSchema = TenantScopedEntitySchema.extend({
  remediationId: IdSchema,
  relatedPathId: IdSchema.nullish(),
  relatedExposureId: IdSchema.nullish(),
  // Stable finding fingerprint (SHA-256 hex) of the grouped cause this task
  // remediates. Enables one open remediation per root cause across paths that
  // share a fingerprint. Optional for legacy rows minted before PERISCAN-7.
  relatedFindingFingerprint: z.string().min(1).nullish(),
  owner: z.string().min(1).nullish(),
  dueAt: TimestampSchema.nullable().default(null),
  recommendedAction: z.string().min(1),
  technicalSteps: StringListSchema,
  verificationMethod: z.string().min(1),
  ticketSystem: z.string().min(1).nullish(),
  ticketId: z.string().min(1).nullish(),
  ticketIntegrationId: IdSchema.nullish(),
  ticketState: z.enum(["Open", "InProgress", "Closed", "Unknown"]).nullish(),
  ticketStateLabel: z.string().min(1).nullish(),
  ticketSyncedAt: TimestampSchema.nullish(),
  status: RemediationStatusSchema,
  verificationRequired: z.boolean(),
  // Continuous re-verification: when a fix is settled, lastVerifiedAt records the
  // most recent verification and nextVerificationAt schedules an automatic re-check
  // so a regressed fix is caught instead of trusting a stale "Fixed".
  lastVerifiedAt: TimestampSchema.nullish(),
  nextVerificationAt: TimestampSchema.nullish(),
  // Evidence basis of the targeted exposure (Measured vs Heuristic) so a consumer
  // can judge how grounded this remediation + its verification outcome are.
  relatedPathEvidenceBasis: EvidenceBasisSchema.nullish(),
  // Provenance of the most recent verification, surfaced inline so a consumer can
  // see HOW this fix was proven without a separate call: whether it was a measured
  // re-validation (a real retest actually ran) vs heuristic, the retest method,
  // whether exposure was re-correlated, and the outcome. Null until first verified.
  latestVerification: z
    .object({
      exposureReCorrelated: z.boolean().nullish(),
      measuredRevalidation: z.boolean(),
      outcome: VerificationOutcomeSchema,
      retestMethod: z.string().min(1).nullish(),
      verifiedAt: TimestampSchema
    })
    .nullish()
}).merge(EvidenceLinkedSchema);

export const CreateRemediationInputSchema = z
  .object({
    dueAt: TimestampSchema.optional(),
    // Original finding evidence so fingerprint-only tasks can retest measured
    // modules instead of falling back to compare-only verification.
    evidenceIds: IdListSchema.optional(),
    // Explicit finding fingerprint for open-task reuse. Required when pathId is
    // omitted so signal-only findings can start RemOps without a multi-hop path.
    findingFingerprint: z.string().min(1).optional(),
    owner: z.string().min(1).nullable().optional(),
    // Optional: path-linked remediations remain the preferred path. When only
    // findingFingerprint is set, createRemediation mints a path-less open task.
    pathId: IdSchema.optional()
  })
  .refine((input) => Boolean(input.pathId || input.findingFingerprint), {
    message: "pathId or findingFingerprint is required.",
    path: ["pathId"]
  });

/** P06-20: mobilize Logged-only / Needs tuning / Missed into a detection-eng work item. */
export const CreateControlGapRemediationInputSchema = z.object({
  controlSourceId: IdSchema.optional(),
  coverageStatus: z.enum(["LoggedOnly", "NeedsTuning", "Missed"]),
  dueAt: TimestampSchema.optional(),
  note: z.string().max(2000).optional(),
  owner: z.string().min(1).nullable().optional(),
  techniqueId: z.string().min(1),
  techniqueName: z.string().min(1).optional()
});
export type CreateControlGapRemediationInput = z.infer<
  typeof CreateControlGapRemediationInputSchema
>;

export const CreateRemediationTicketInputSchema = z.object({
  integrationId: IdSchema.optional()
});

export const SyncRemediationTicketInputSchema = z.object({
  integrationId: IdSchema.optional()
});

export const RemediationTicketSchema = z.object({
  remediation: RemediationTaskSchema,
  ticket: z.object({
    evidenceSummary: z.string().min(1),
    integrationId: IdSchema,
    status: RemediationStatusSchema,
    system: z.string().min(1),
    ticketId: z.string().min(1)
  })
});

export const RemediationTicketStateSchema = z.object({
  remediation: RemediationTaskSchema,
  ticket: z.object({
    integrationId: IdSchema,
    observedAt: TimestampSchema,
    state: z.enum(["Open", "InProgress", "Closed", "Unknown"]),
    stateLabel: z.string().min(1),
    system: z.string().min(1),
    ticketId: z.string().min(1)
  })
});

export const RemediationActionTypeSchema = z.enum(["ControlExpectationTuning"]);
export const RemediationActionStateSchema = z.enum([
  "Draft",
  "Previewed",
  "AwaitingApproval",
  "Approved",
  "Executing",
  "Applied",
  "Revalidating",
  "ProvenFixed",
  "StillExposed",
  "RolledBack",
  "Failed"
]);
export const RemediationActionManifestSchema = z.object({
  actionType: RemediationActionTypeSchema,
  approvalRoles: z.array(MembershipRoleSchema).min(1),
  blastRadius: z.string().min(1),
  description: z.string().min(1),
  evidenceProduced: z.array(z.string().min(1)).min(1),
  exactDiff: z.object({
    after: z.array(ExpectedControlBehaviorSchema).min(1),
    before: z.array(ExpectedControlBehaviorSchema).min(1),
    field: z.literal("expectedBehaviors")
  }),
  expectedWriteOperations: z.array(z.string().min(1)).min(1),
  preconditions: z.array(z.string().min(1)).min(1),
  requiredPermissions: z.array(z.string().min(1)).min(1),
  rollback: z.object({
    available: z.literal(true),
    operation: z.string().min(1)
  }),
  target: z.object({
    controlSourceId: IdSchema,
    integrationId: IdSchema,
    provider: z.string().min(1)
  }),
  title: z.string().min(1),
  verification: z.object({
    method: z.string().min(1),
    required: z.literal(true),
    successDoesNotEqualFixed: z.literal(true)
  })
});
export const RemediationActionSchema = TenantScopedEntitySchema.extend({
  actionType: RemediationActionTypeSchema,
  appliedAt: TimestampSchema.nullish(),
  applicationReceipt: z.record(z.string(), z.unknown()).nullish(),
  approvedAt: TimestampSchema.nullish(),
  approvedBy: IdSchema.nullish(),
  failureReason: z.string().min(1).nullish(),
  idempotencyKey: z.string().min(8).max(200),
  manifest: RemediationActionManifestSchema,
  previewHash: z.string().regex(/^[a-f0-9]{64}$/u),
  remediationActionId: IdSchema,
  remediationId: IdSchema,
  rollbackReceipt: z.record(z.string(), z.unknown()).nullish(),
  rolledBackAt: TimestampSchema.nullish(),
  state: RemediationActionStateSchema,
  targetEntityId: IdSchema
});
export const PreviewRemediationActionInputSchema = z.object({
  actionType: z.literal("ControlExpectationTuning"),
  controlSourceId: IdSchema,
  idempotencyKey: z.string().trim().min(8).max(200),
  nextExpectedBehaviors: z.array(ExpectedControlBehaviorSchema).min(1)
});
export const ConfirmRemediationActionInputSchema = z.object({
  previewHash: z.string().regex(/^[a-f0-9]{64}$/u)
});

export const InfrastructureChangeStateSchema = z.enum([
  "AwaitingApproval",
  "Approved",
  "PullRequestOpened",
  "ChecksPassing",
  "ChecksFailed",
  "MergedAwaitingVerification",
  "RolledBack",
  "Failed"
]);

const GitHubCoordinatePartSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_.-]{1,100}$/u);

export const InfrastructureChangeManifestSchema = z.object({
  actionType: z.literal("InfrastructureAsCodePullRequest"),
  afterContent: z.string().max(100_000),
  afterContentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  baseBranch: z.string().regex(/^[A-Za-z0-9._/-]{1,200}$/u),
  beforeContent: z.string().max(100_000),
  beforeContentHash: z.string().regex(/^[a-f0-9]{64}$/u),
  beforeSha: z.string().min(1).max(200),
  blastRadius: z.string().min(1),
  branchName: z.string().regex(/^periscan\/[A-Za-z0-9._/-]{1,180}$/u),
  expectedWriteOperations: z.array(z.string().min(1)).min(1),
  filePath: z
    .string()
    .trim()
    .regex(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9_./-]{1,500}$/u),
  pullRequestBody: z.string().min(1).max(10_000),
  pullRequestTitle: z.string().min(1).max(240),
  repository: z.object({
    name: GitHubCoordinatePartSchema,
    owner: GitHubCoordinatePartSchema
  }),
  rollback: z.object({
    availableUntilMerged: z.literal(true),
    operation: z.string().min(1)
  }),
  unifiedDiff: z.string().min(1).max(220_000),
  verification: z.object({
    ciChecksRequired: z.literal(true),
    freshPeriscanRevalidationRequired: z.literal(true),
    mergeDoesNotEqualFixed: z.literal(true)
  })
});

export const InfrastructureChangeRequestSchema =
  TenantScopedEntitySchema.extend({
    applicationReceipt: z.record(z.string(), z.unknown()).nullish(),
    appliedAt: TimestampSchema.nullish(),
    approvedAt: TimestampSchema.nullish(),
    approvedBy: IdSchema.nullish(),
    failureReason: z.string().min(1).nullish(),
    iacChangeRequestId: IdSchema,
    idempotencyKey: z.string().min(8).max(200),
    integrationId: IdSchema,
    manifest: InfrastructureChangeManifestSchema,
    previewHash: z.string().regex(/^[a-f0-9]{64}$/u),
    remediationId: IdSchema,
    rollbackReceipt: z.record(z.string(), z.unknown()).nullish(),
    rolledBackAt: TimestampSchema.nullish(),
    state: InfrastructureChangeStateSchema
  });

export const PreviewInfrastructureChangeInputSchema = z.object({
  baseBranch: z.string().regex(/^[A-Za-z0-9._/-]{1,200}$/u),
  branchName: z
    .string()
    .regex(/^periscan\/[A-Za-z0-9._/-]{1,180}$/u)
    .optional(),
  expectedBeforeSha: z.string().min(1).max(200).optional(),
  filePath: InfrastructureChangeManifestSchema.shape.filePath,
  idempotencyKey: z.string().trim().min(8).max(200),
  integrationId: IdSchema,
  proposedContent: z.string().min(1).max(100_000),
  pullRequestBody: z.string().trim().min(1).max(10_000),
  pullRequestTitle: z.string().trim().min(1).max(240),
  repository: InfrastructureChangeManifestSchema.shape.repository
});

export const ConfirmInfrastructureChangeInputSchema = z.object({
  previewHash: z.string().regex(/^[a-f0-9]{64}$/u)
});

// Prescriptive Planner (RemOps 3.7): step-by-step mitigation from verdicts/remediations.
// Sourced from operators + model. Used for UI flows and auto-revalidate preview
// (legacy name: auto-mitigate). Planner + revalidate only — never config push.
export const MitigationStepSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  action: z.string().min(1),
  rationale: z.string().min(1),
  iacHint: z.string().optional(),
  safety: z.enum(["safe", "needs_approval"]).default("safe")
});
export const PrescriptivePlanSchema = z.object({
  planId: IdSchema.optional(),
  remediationId: IdSchema.optional(),
  objective: z.string().min(1),
  steps: z.array(MitigationStepSchema),
  source: z.enum(["operator", "model", "hybrid"]).default("operator"),
  generatedAt: TimestampSchema
});

export const VerificationEventSchema = z.object({
  verificationId: IdSchema,
  tenantId: IdSchema,
  remediationId: IdSchema,
  validationRunId: IdSchema.nullish(),
  previousState: ValidationStateSchema.nullish(),
  newState: ValidationStateSchema,
  outcome: VerificationOutcomeSchema,
  // How the fix was verified: measuredRevalidation=true means the exposure was
  // re-measured from authoritative config (connector resync), not just re-tested
  // by a validation module. retestMethod names the mechanism; previousEvidenceBasis
  // records whether the pre-fix path was Measured or Heuristic. Together these make
  // a "Fixed" outcome auditable for how trustworthy it is.
  measuredRevalidation: z.boolean().default(false),
  previousEvidenceBasis: EvidenceBasisSchema.nullish(),
  retestMethod: z.string().min(1).nullish(),
  // WHAT the verification examined and the key comparison RESULT, so the record is
  // self-describing rather than requiring a dig through evidence artifacts:
  // which validation modules ran, which connector configs were re-fetched, and
  // whether the previously-correlated exposure re-correlated from fresh signals.
  selectedModuleIds: StringListSchema.default([]),
  reSyncedConnectorKeys: StringListSchema.default([]),
  exposureReCorrelated: z.boolean().nullish(),
  evidenceIds: IdListSchema,
  verifiedAt: TimestampSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema
});

export const ThreatAdvisoryStatusSchema = z.enum([
  "Imported",
  "Assessed",
  "PlanReady",
  "Closed"
]);

export const ThreatReadinessStatusSchema = z.enum([
  "Ready",
  "MissingSignals",
  "RequiresApproval",
  "NotConfigured"
]);

export const MissingSignalStatusSchema = z.enum([
  "NotConfigured",
  "RequiresIntegration",
  "RequiresVerifiedScope",
  "RequiresInternalRunner",
  "RequiresApproval",
  "NotImplemented"
]);

export const ThreatAdvisorySchema = TenantScopedEntitySchema.extend({
  threatAdvisoryId: IdSchema,
  title: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.url().nullish(),
  summary: z.string().min(1),
  rawEvidenceId: IdSchema,
  cveIds: StringListSchema,
  iocValues: StringListSchema,
  techniqueIds: StringListSchema,
  publishedAt: TimestampSchema.nullish(),
  receivedAt: TimestampSchema,
  status: ThreatAdvisoryStatusSchema
}).merge(EvidenceLinkedSchema);

export const ThreatPackageSchema = TenantScopedEntitySchema.extend({
  threatPackageId: IdSchema,
  threatAdvisoryId: IdSchema,
  title: z.string().min(1),
  cveIds: StringListSchema,
  iocValues: StringListSchema,
  techniqueIds: StringListSchema,
  summary: z.string().min(1)
}).merge(EvidenceLinkedSchema);

export const MissingSignalSchema = TenantScopedEntitySchema.extend({
  missingSignalId: IdSchema,
  relatedEntityType: RelatedEntityTypeSchema,
  relatedEntityId: IdSchema,
  signalType: z.string().min(1),
  reason: z.string().min(1),
  status: MissingSignalStatusSchema,
  requiredIntegrationCategory: IntegrationCategorySchema.nullish()
});

export const AdvisoryImpactAssessmentSchema = TenantScopedEntitySchema.extend({
  advisoryImpactAssessmentId: IdSchema,
  threatAdvisoryId: IdSchema,
  affectedAssetIds: IdListSchema,
  affectedFindingIds: IdListSchema,
  confidence: z.number().min(0).max(1),
  missingSignalIds: IdListSchema,
  summary: z.string().min(1)
}).merge(EvidenceLinkedSchema);

export const ThreatValidationPlanItemSchema = TenantScopedEntitySchema.extend({
  threatValidationPlanItemId: IdSchema,
  threatValidationPlanId: IdSchema,
  title: z.string().min(1),
  missionType: MissionTypeSchema,
  safetyLevel: SafetyLevelSchema,
  status: ValidationStateSchema,
  requiredScopeTypes: z.array(ScopeTypeSchema),
  requiredIntegrationCategories: z.array(IntegrationCategorySchema),
  missingSignalIds: IdListSchema,
  rationale: z.string().min(1)
}).merge(EvidenceLinkedSchema);

export const ThreatValidationPlanSchema = TenantScopedEntitySchema.extend({
  threatValidationPlanId: IdSchema,
  threatAdvisoryId: IdSchema,
  status: ValidationStateSchema,
  planItems: z.array(ThreatValidationPlanItemSchema),
  summary: z.string().min(1)
}).merge(EvidenceLinkedSchema);

export const AdvisoryReadinessReportSchema = TenantScopedEntitySchema.extend({
  advisoryReadinessReportId: IdSchema,
  threatAdvisoryId: IdSchema,
  readinessStatus: ThreatReadinessStatusSchema,
  evidencePackId: IdSchema.nullish(),
  missingSignalIds: IdListSchema,
  summary: z.string().min(1)
}).merge(EvidenceLinkedSchema);

// Genuine "are we exposed to this advisory?" evidence: the specific indicators
// (CVE / MITRE technique / IoC) whose presence in the tenant's completed,
// evidence-backed validation runs makes them exposed, plus how many runs matched
// and the backing evidence. correlated=false with empty matches means imported
// but not corroborated by validation; null (on a detail that omits it) means the
// exposure was not assessed in that view.
export const AdvisoryExposureSchema = z.object({
  correlated: z.boolean(),
  evidenceIds: IdListSchema,
  matchedCveIds: StringListSchema,
  matchedIocValues: StringListSchema,
  matchedTechniqueIds: StringListSchema,
  matchingRunCount: z.number().int().nonnegative()
});
export type AdvisoryExposure = z.infer<typeof AdvisoryExposureSchema>;

export const ThreatAdvisoryDetailSchema = z.object({
  advisory: ThreatAdvisorySchema,
  exposure: AdvisoryExposureSchema.nullish(),
  impactAssessment: AdvisoryImpactAssessmentSchema,
  missingSignals: z.array(MissingSignalSchema),
  package: ThreatPackageSchema,
  readinessReport: AdvisoryReadinessReportSchema,
  rawEvidenceId: IdSchema,
  validationPlan: ThreatValidationPlanSchema
});

export const ImportThreatAdvisoryInputSchema = z.object({
  cveIds: z.array(z.string().min(1)).optional(),
  externalId: z.string().min(1).nullable().optional(),
  iocValues: z.array(z.string().min(1)).optional(),
  publishedAt: TimestampSchema.nullable().optional(),
  rawContent: z.string().min(1),
  sourceCategory: z.string().min(1).nullable().optional(),
  sourceName: z.string().min(1),
  sourceUrl: z.url().nullable().optional(),
  summary: z.string().min(1),
  techniqueIds: z.array(z.string().min(1)).optional(),
  title: z.string().min(1)
});

// --- Automated threat-feed ingestion (C3) ---

// Supported external threat feeds. Start with CISA's Known Exploited
// Vulnerabilities catalog (free, no-auth, authoritative). New feeds register a
// `sourceCategory` slug + a normalizer that maps entries to advisory imports.
export const ThreatFeedSchema = z.enum(["cisa_kev"]);
export type ThreatFeed = z.infer<typeof ThreatFeedSchema>;

// Minimal shape of one CISA KEV catalog entry we depend on; unknown fields are
// ignored so upstream additions never break ingestion.
export const CisaKevVulnerabilitySchema = z.object({
  cveID: z.string().min(1),
  vulnerabilityName: z.string().min(1),
  vendorProject: z.string().optional(),
  product: z.string().optional(),
  dateAdded: z.string().optional(),
  shortDescription: z.string().optional(),
  requiredAction: z.string().optional(),
  knownRansomwareCampaignUse: z.string().optional(),
  notes: z.string().optional()
});

export const CisaKevFeedSchema = z.object({
  title: z.string().optional(),
  catalogVersion: z.string().optional(),
  dateReleased: z.string().optional(),
  vulnerabilities: z.array(CisaKevVulnerabilitySchema)
});
export type CisaKevFeed = z.infer<typeof CisaKevFeedSchema>;

export const ThreatFeedIngestionInputSchema = z.object({
  feed: ThreatFeedSchema.default("cisa_kev"),
  // Max number of (most-recent) entries to import per run; bounds work + cost.
  limit: z.number().int().min(1).max(200).default(25),
  // Optional override for self-hosted mirrors / testing; defaults to the
  // canonical public feed URL resolved server-side.
  feedUrl: z.url().optional()
});
export type ThreatFeedIngestionInput = z.infer<
  typeof ThreatFeedIngestionInputSchema
>;

export const ThreatFeedIngestionResultSchema = z.object({
  feed: ThreatFeedSchema,
  feedUrl: z.string(),
  fetchedCount: z.number().int().min(0),
  importedCount: z.number().int().min(0),
  skippedCount: z.number().int().min(0),
  advisoryIds: z.array(IdSchema),
  ingestedAt: TimestampSchema
});
export type ThreatFeedIngestionResult = z.infer<
  typeof ThreatFeedIngestionResultSchema
>;

/**
 * Risk severity bands. Wire token "Fixed" is presentation-only for charts and
 * badges when verificationStatus === "Fixed" (P09-3 / Fixed multiverse).
 *
 * - calculateRiskScore may emit band Fixed solely via the verification short-
 *   circuit — never from remediationStatus, validationState, or score→band
 *   mapping alone (`toBand` never returns Fixed).
 * - RiskBand Fixed is NOT RemediationTask.status Fixed and must never be used
 *   to write remediation closure. UI/report display should use
 *   {@link formatRiskBandDisplayLabel} ("Closed (risk)") so operators do not
 *   conflate the two.
 * Long-term residual: separate `closureStatus` field and drop Fixed from this
 * severity enum (deferred to avoid wholesale consumer migration).
 */
export const RiskBandSchema = z.enum([
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
  "Fixed"
]);

/**
 * Human-facing label for a risk band. Maps wire token Fixed → "Closed (risk)"
 * so charts/badges never read as remediation status Fixed (P09-3 residual).
 * Other bands pass through unchanged. Wire value stays "Fixed" on the API.
 */
export function formatRiskBandDisplayLabel(band: string): string {
  return band === "Fixed" ? "Closed (risk)" : band;
}

export const RiskFactorSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
  contribution: z.number(),
  rationale: z.string().min(1)
});

export const RiskReachabilitySchema = z.enum([
  "Unknown",
  "NotReachable",
  "Reachable",
  "InternalReachable",
  "InternetExposed"
]);

export const RiskExploitabilitySchema = z.enum([
  "Unknown",
  "NotExploitable",
  "ProofObserved",
  "Exploitable"
]);

export const RiskScoreInputSchema = z.object({
  businessCriticality: BusinessCriticalitySchema,
  confidence: z.number().min(0).max(1),
  controlResponse: ControlStateSchema.nullish(),
  exploitability: RiskExploitabilitySchema.optional(),
  // PRD 3.11: Business Impact Scoring dimensions (financial/regulatory/operational)
  // feed dynamic EXV dashboard; optional for backward compat, default 0 if absent.
  financialImpact: z.number().min(0).max(100).optional(),
  regulatoryImpact: z.number().min(0).max(100).optional(),
  operationalImpact: z.number().min(0).max(100).optional(),
  impactScore: z.number().min(0).max(100),
  internetExposed: z.boolean().default(false),
  knownExploitation: z.boolean().optional(),
  privilegedPath: z.boolean().default(false),
  reachability: RiskReachabilitySchema.optional(),
  recurrence: z.number().int().min(0).optional(),
  remediationStatus: RemediationStatusSchema.nullish(),
  sensitiveData: z.boolean().optional(),
  threatRelevance: z.number().min(0).max(1).optional(),
  validationState: ValidationStateSchema,
  verificationStatus: VerificationOutcomeSchema.nullish()
});

export const RiskScoreSchema = z.object({
  band: RiskBandSchema,
  factors: z.array(RiskFactorSchema),
  score: z.number().int().min(0).max(100),
  summary: z.string().min(1)
});

export const AttackPathAssessmentSchema = z.object({
  attackPath: AttackPathSchema,
  financialExposure: FinancialExposureEstimateSchema.nullish(),
  risk: RiskScoreSchema
});

export const AttackPathChokePointSchema = z.object({
  betweenness: z.number().min(0).max(1),
  evidenceBasis: z.enum(["Measured", "Heuristic", "Mixed"]),
  evidenceIds: IdListSchema,
  label: z.string().min(1),
  nodeId: IdSchema,
  pathCount: z.number().int().nonnegative(),
  pathIds: IdListSchema,
  pathNames: StringListSchema
});

export const AttackPathChokePointAnalysisSchema = z.object({
  analyzedAt: TimestampSchema,
  assumptions: StringListSchema,
  chokePoints: z.array(AttackPathChokePointSchema),
  collapseRatio: z.number().nonnegative(),
  /**
   * Stable honesty pin for scorecard #4. Greedy evidence-weighted breakers only —
   * never market as Leading min-cut / XM-class choke science.
   */
  honestyNote: z.string().min(1),
  methodology: z.literal("GreedyHittingSetApproximation"),
  recommendedCutSet: z.array(AttackPathChokePointSchema),
  tenantId: IdSchema,
  totalPaths: z.number().int().nonnegative()
});

export const VerifyAttackPathInputSchema = z.object({
  reason: z.string().max(1024).optional(),
  scopeId: IdSchema.optional()
});

export const AttackPathVerificationRequestSchema = z.object({
  attackPath: AttackPathAssessmentSchema,
  evidenceIds: IdListSchema,
  mission: ValidationMissionSchema,
  policyDecision: z.lazy(() => PolicyDecisionSchema),
  queued: z.literal(false),
  status: z.literal("RequiresApproval"),
  verificationPlan: z.object({
    nextStep: z.string().min(1),
    reason: z.string().min(1).nullish(),
    requestedAt: TimestampSchema,
    scopeId: IdSchema
  })
});

export const ValidatedFindingCrossLinkSchema = z.object({
  entityId: IdSchema,
  entityType: RelatedEntityTypeSchema,
  label: z.string().min(1),
  relationship: z.string().min(1)
});

export const ValidatedFindingPriorityReasonSchema = z.object({
  businessContext: z.string().min(1),
  controlEffectiveness: z.string().min(1),
  exploitability: z.string().min(1),
  pathContext: z.string().min(1),
  summary: z.string().min(1)
});

export const ValidatedFindingPathProofSchema = z.object({
  blastRadiusSummary: z.string().min(1),
  /**
   * Evidence-backed path breakers (recommendation only). Never claim exact
   * global min-cut or XM-class "Leading" choke science from this list.
   */
  chokePoints: z.array(z.string().min(1)),
  entryPoint: z.string().min(1),
  intermediateSteps: z.array(z.string().min(1)),
  objective: z.string().min(1),
  objectiveState: ObjectiveStateSchema,
  /**
   * Hop measurement honesty (Wave A / A7). Optional for legacy fixtures;
   * path-linked producers should always set from deriveAttackPathClaim.
   * FullyMeasured requires measuredEdgeCount === totalEdgeCount > 0 with
   * receipts — launch alone never upgrades certainty.
   */
  claimDisplayLabel: z.string().min(1).optional(),
  fullyMeasured: z.boolean().optional(),
  measuredEdgeCount: z.number().int().nonnegative().optional(),
  totalEdgeCount: z.number().int().nonnegative().optional()
});

export const ValidatedFindingMissingSignalImpactSchema = z.object({
  confidenceAdjustment: z.number().min(-1).max(0),
  missingSignalCount: z.number().int().nonnegative(),
  missingSignalIds: IdListSchema,
  missingSignalStatuses: z.array(MissingSignalStatusSchema),
  recommendation: z.string().min(1),
  summary: z.string().min(1)
});

// Analyst DISPOSITION — a human triage decision layered on top of the derived
// finding status. It deliberately CANNOT set "Fixed": a finding only becomes
// Fixed through a real verification event, never by an analyst asserting it.
// Dispositions express business judgment (accepted risk, false positive,
// suppressed, acknowledged, escalated) and are fully audited + reversible.
// P09-12 Fixed multiverse: this enum is part of the closed set of writers that
// must never claim Fixed. See assertRemediationFixedOnlyViaVerification in
// fix-verification.ts for the remediation-status chokepoint.
export const FindingDispositionSchema = z.enum([
  "Acknowledged",
  "Escalated",
  "AcceptedRisk",
  "FalsePositive",
  "Suppressed"
]);
export type FindingDisposition = z.infer<typeof FindingDispositionSchema>;

/** Mandatory taxonomy for FalsePositive / Suppressed (P18-6). Stored in note. */
export const FindingDispositionReasonCodeSchema = z.enum([
  "OutOfScope",
  "DuplicateObservation",
  "Benign",
  "Lab",
  "ToolNoise",
  "Other"
]);
export type FindingDispositionReasonCode = z.infer<
  typeof FindingDispositionReasonCodeSchema
>;

export const FINDING_DISPOSITION_REASON_CODES =
  FindingDispositionReasonCodeSchema.options;

export function formatFindingDispositionNote(
  reasonCode: FindingDispositionReasonCode | undefined,
  note: string | undefined
): string | undefined {
  const free = note?.trim() ?? "";
  if (reasonCode) {
    return free ? `[${reasonCode}] ${free}` : `[${reasonCode}]`;
  }
  return free || undefined;
}

export function parseFindingDispositionReasonCode(
  note: string | null | undefined
): FindingDispositionReasonCode | null {
  if (!note) return null;
  const match = /^\[([A-Za-z]+)\]/u.exec(note.trim());
  if (!match) return null;
  const parsed = FindingDispositionReasonCodeSchema.safeParse(match[1]);
  return parsed.success ? parsed.data : null;
}

export const FINDING_DISPOSITION_FINGERPRINT_PREFIX = "fp:" as const;

export function findingDispositionFingerprintKey(fingerprint: string): string {
  return `${FINDING_DISPOSITION_FINGERPRINT_PREFIX}${fingerprint}`;
}

export function isFindingDispositionFingerprintKey(findingId: string): boolean {
  return findingId.startsWith(FINDING_DISPOSITION_FINGERPRINT_PREFIX);
}

export function fingerprintFromDispositionKey(
  findingId: string
): string | null {
  if (!isFindingDispositionFingerprintKey(findingId)) return null;
  return findingId.slice(FINDING_DISPOSITION_FINGERPRINT_PREFIX.length) || null;
}

export const FindingDispositionOverrideSchema = z.object({
  approvedAt: TimestampSchema.nullable().default(null),
  approvedBy: IdSchema.nullable().default(null),
  approvalState: z
    .enum(["NotRequired", "Pending", "Approved", "Expired"])
    .default("NotRequired"),
  disposition: FindingDispositionSchema,
  expiresAt: TimestampSchema.nullable().default(null),
  note: z.string().nullable(),
  ownerId: IdSchema.nullable().default(null),
  updatedAt: TimestampSchema,
  updatedBy: IdSchema,
  inheritedFromFingerprint: z.boolean().optional(),
  fingerprint: z.string().nullable().optional()
});
export type FindingDispositionOverride = z.infer<
  typeof FindingDispositionOverrideSchema
>;

/**
 * Detection-engineering feedback from FalsePositive / Suppressed dispositions
 * (P06-4 / P18-18). Aggregates reason codes and fingerprints for module owners.
 */
export const DispositionFeedbackRowSchema = z.object({
  fingerprint: z.string().nullable(),
  reasonCode: FindingDispositionReasonCodeSchema.nullable(),
  disposition: z.enum(["FalsePositive", "Suppressed"]),
  count: z.number().int().positive(),
  source: z.string().nullable(),
  sampleFindingId: IdSchema.nullable(),
  sampleTitle: z.string().nullable(),
  lastUpdatedAt: TimestampSchema.nullable(),
  expiresAt: TimestampSchema.nullable()
});
export const DispositionFeedbackSummarySchema = z.object({
  generatedAt: TimestampSchema,
  totalFalsePositive: z.number().int().nonnegative(),
  totalSuppressed: z.number().int().nonnegative(),
  byReason: z.array(
    z.object({
      reasonCode: FindingDispositionReasonCodeSchema.nullable(),
      count: z.number().int().positive()
    })
  ),
  byFingerprint: z.array(DispositionFeedbackRowSchema),
  bySource: z.array(
    z.object({
      source: z.string().min(1),
      count: z.number().int().positive()
    })
  )
});
export type DispositionFeedbackSummary = z.infer<
  typeof DispositionFeedbackSummarySchema
>;

export const TransitionFindingInputSchema = z
  .object({
    // null clears any existing disposition (back to the purely derived state).
    disposition: FindingDispositionSchema.nullable(),
    expiresAt: TimestampSchema.optional(),
    ownerId: IdSchema.optional(),
    note: z.string().max(2000).optional(),
    /** Required for FalsePositive / Suppressed; encoded into note as [Code]. */
    reasonCode: FindingDispositionReasonCodeSchema.optional(),
    /**
     * When true (default on server for FP/Suppressed with a fingerprint), also
     * write a fingerprint-scoped mute so sibling group members inherit the
     * disposition. Explicit false = this finding only.
     */
    applyToFingerprint: z.boolean().optional()
  })
  .superRefine((value, context) => {
    if (value.disposition === "AcceptedRisk") {
      if (!value.ownerId) {
        context.addIssue({
          code: "custom",
          message: "Accepted risk requires an owner.",
          path: ["ownerId"]
        });
      }
      if (!value.expiresAt) {
        context.addIssue({
          code: "custom",
          message: "Accepted risk requires an expiry.",
          path: ["expiresAt"]
        });
      }
    }
    if (
      value.disposition === "FalsePositive" ||
      value.disposition === "Suppressed"
    ) {
      const hasReason =
        Boolean(value.reasonCode) ||
        Boolean(parseFindingDispositionReasonCode(value.note));
      const hasNote = Boolean(value.note?.trim());
      if (!hasReason && !hasNote) {
        context.addIssue({
          code: "custom",
          message:
            "False positive and suppressed dispositions require a reason code or note.",
          path: ["reasonCode"]
        });
      }
    }
  });
export type TransitionFindingInput = z.infer<
  typeof TransitionFindingInputSchema
>;

/** Bulk disposition / owner assignment for SOC queue automation (P20-11). */
export const BulkTransitionFindingsInputSchema = z
  .object({
    findingIds: z.array(IdSchema).min(1).max(100),
    disposition: FindingDispositionSchema.nullable(),
    expiresAt: TimestampSchema.optional(),
    ownerId: IdSchema.optional(),
    note: z.string().max(2000).optional(),
    /** Required for FalsePositive / Suppressed (P18-7); encoded into note as [Code]. */
    reasonCode: FindingDispositionReasonCodeSchema.optional(),
    /** Same semantics as TransitionFindingInputSchema.applyToFingerprint. */
    applyToFingerprint: z.boolean().optional()
  })
  .superRefine((value, context) => {
    if (
      value.disposition === "FalsePositive" ||
      value.disposition === "Suppressed"
    ) {
      const hasReason =
        Boolean(value.reasonCode) ||
        Boolean(parseFindingDispositionReasonCode(value.note));
      const hasNote = Boolean(value.note?.trim());
      if (!hasReason && !hasNote) {
        context.addIssue({
          code: "custom",
          message:
            "False positive and suppressed dispositions require a reason code or note.",
          path: ["reasonCode"]
        });
      }
    }
  });
export type BulkTransitionFindingsInput = z.infer<
  typeof BulkTransitionFindingsInputSchema
>;

export const BulkTransitionFindingsResultSchema = z.object({
  results: z.array(
    z.object({
      findingId: IdSchema,
      ok: z.boolean(),
      error: z.string().nullable(),
      code: z.string().nullable()
    })
  ),
  succeeded: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative()
});
export type BulkTransitionFindingsResult = z.infer<
  typeof BulkTransitionFindingsResultSchema
>;

export const ValidatedFindingSchema = TenantScopedEntitySchema.extend({
  findingId: IdSchema,
  title: z.string().min(1),
  sourceMotion: ValidatedFindingSourceMotionSchema,
  source: z.string().min(1),
  sourceEntityType: RelatedEntityTypeSchema,
  sourceEntityId: IdSchema,
  severity: SeveritySchema,
  exploitability: ExploitabilityStateSchema,
  status: ValidatedFindingStatusSchema,
  validationState: ValidationStateSchema,
  // Provenance vantage: true when the finding was measured IN-NETWORK by a
  // runner-agent (stronger reachability evidence for internal targets) vs from
  // the control plane. Defaults false (control-plane / non-signal findings).
  measuredInNetwork: z.boolean().default(false),
  impact: z.string().min(1),
  remediation: z.string().min(1),
  priorityScore: z.number().int().min(0).max(100),
  priorityFormula: z
    .string()
    .min(1)
    .default("Priority = clamp(sum of recorded factor contributions, 0, 100)."),
  riskFactors: z.array(RiskFactorSchema).default([]),
  priorityReason: ValidatedFindingPriorityReasonSchema,
  relatedAssetIds: IdListSchema,
  relatedControlIds: IdListSchema,
  relatedPathIds: IdListSchema,
  relatedRemediationIds: IdListSchema,
  crossLinks: z.array(ValidatedFindingCrossLinkSchema),
  missingSignalImpact: ValidatedFindingMissingSignalImpactSchema.nullish(),
  pathProof: ValidatedFindingPathProofSchema.nullish(),
  // Analyst disposition overlay (null = purely derived, no human decision yet).
  disposition: FindingDispositionOverrideSchema.nullable().default(null),
  // Slice 4 — stable identity + occurrence metadata for operational findings.
  // All fields optional so legacy fixtures and pre-grouping rows still parse and
  // typecheck. Producers should set deterministic fingerprints via
  // @periscan/evidence finding-fingerprint helpers. Treat missing occurrenceCount
  // as 1 (single observation) and missing affectedAssetCount as
  // relatedAssetIds.length. first/last seen and root-cause summary fill in when
  // observations are merged — they do not invent claim language.
  fingerprint: z.string().min(1).optional(),
  groupKey: z.string().min(1).optional(),
  rootCauseSummary: z.string().min(1).optional(),
  firstSeenAt: TimestampSchema.optional(),
  lastSeenAt: TimestampSchema.optional(),
  occurrenceCount: z.number().int().min(1).optional(),
  affectedAssetCount: z.number().int().nonnegative().optional(),
  // PERISCAN-7 — operational owner/SLA projected from the primary linked
  // remediation when present. Never invented: omit when no remediation owner
  // or due date is recorded. ownerId is reserved for real member UUIDs only
  // (do not coerce free-text remediation.owner into an id).
  ownerId: IdSchema.optional(),
  ownerDisplay: z.string().min(1).optional(),
  slaDueAt: TimestampSchema.optional()
})
  .merge(EvidenceLinkedSchema)
  .extend({
    // Non-snap enrichment: when evidence for this finding came from a scheduled non-snapshot
    // Control/AI/Fix pack, attach packType + direct backlink target (packId) + optional schedule ref.
    nonSnapPack: z
      .object({
        evidencePackId: IdSchema,
        packType: EvidencePackTypeSchema,
        scheduleId: IdSchema.nullish()
      })
      .nullish()
  });

export const ValidatedFindingFilterSchema = z.object({
  assetId: IdSchema.optional(),
  exploitability: ExploitabilityStateSchema.optional(),
  severity: SeveritySchema.optional(),
  sourceMotion: ValidatedFindingSourceMotionSchema.optional(),
  status: ValidatedFindingStatusSchema.optional(),
  // Community/mission scope: findings are derived, so callers filter by
  // intersection with validationRun.evidenceIds for this mission.
  missionId: IdSchema.optional(),
  // Filter by evidence-strength state (Validated vs Heuristic vs Hypothesis,
  // etc.) so an operator can isolate proven findings from inferred ones.
  validationState: ValidationStateSchema.optional(),
  owner: z.union([IdSchema, z.literal("unassigned")]).optional(),
  disposition: z
    .union([FindingDispositionSchema, z.literal("none")])
    .optional(),
  // Comma-separated dispositions to drop (Active queue = FalsePositive,Suppressed).
  // Query string form: excludeDisposition=FalsePositive,Suppressed
  // Optional AFTER transform so the output type stays truly optional (not required | undefined).
  excludeDisposition: z
    .string()
    .trim()
    .min(1)
    .transform((value, ctx) => {
      const parts = value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "excludeDisposition must list at least one disposition"
        });
        return z.NEVER;
      }

      const parsed: FindingDisposition[] = [];
      for (const part of parts) {
        const result = FindingDispositionSchema.safeParse(part);
        if (!result.success) {
          ctx.addIssue({
            code: "custom",
            message: `Invalid excludeDisposition value: ${part}`
          });
          return z.NEVER;
        }
        if (!parsed.includes(result.data)) {
          parsed.push(result.data);
        }
      }
      return parsed;
    })
    .optional(),
  priorityMin: z.coerce.number().int().min(0).max(100).optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

export const ValidationSnapshotMetricsSchema = z.object({
  aiRiskCount: z.number().int().nonnegative(),
  controlObservationCount: z.number().int().nonnegative(),
  // Open advisories that actually CORRELATE to the tenant's validation evidence
  // (CVE/technique/IoC overlap) — the genuine "are we exposed?" count.
  correlatedThreatAdvisoryCount: z.number().int().nonnegative(),
  highRiskPathCount: z.number().int().nonnegative(),
  integrationCount: z.number().int().nonnegative(),
  // Open (non-Closed) threat advisories the tenant is tracking — current threat
  // exposure from the continuously-ingested feed, surfaced alongside priority paths.
  openThreatAdvisoryCount: z.number().int().nonnegative(),
  remediationCount: z.number().int().nonnegative(),
  // Settled fixes (Fixed/Mitigated/PartiallyFixed) whose continuous re-verification
  // is overdue — i.e. claimed-resolved items not re-confirmed recently. Surfaces
  // "is our 'Fixed' still true?" instead of trusting stale outcomes.
  staleVerificationCount: z.number().int().nonnegative(),
  topPathCount: z.number().int().nonnegative(),
  verifiedScopeCount: z.number().int().nonnegative()
});

// Statuses that represent a settled fix whose "Fixed" claim must be kept fresh
// by continuous re-verification (exported so consumers share one definition).
export const SETTLED_REMEDIATION_STATUSES = new Set([
  "Fixed",
  "Mitigated",
  "PartiallyFixed"
]);

/**
 * Count settled remediations whose re-verification is overdue as of `asOf`. A
 * settled fix with nextVerificationAt in the past has not been re-confirmed this
 * cycle, so its "Fixed" claim is stale and should be flagged.
 */
export function countStaleVerifications(
  remediations: ReadonlyArray<{
    nextVerificationAt?: string | null;
    status: string;
  }>,
  asOf: Date
): number {
  return remediations.filter(
    (remediation) =>
      SETTLED_REMEDIATION_STATUSES.has(remediation.status) &&
      remediation.nextVerificationAt != null &&
      new Date(remediation.nextVerificationAt).getTime() <= asOf.getTime()
  ).length;
}

export const ValidationSnapshotSummarySchema = z.object({
  headline: z.string().min(1),
  overview: z.string().min(1),
  topRiskBand: RiskBandSchema
});

export const ValidationSnapshotSchema = z.object({
  snapshotId: IdSchema,
  tenantId: IdSchema,
  evidencePack: z.lazy(() => EvidencePackSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  missionId: IdSchema.nullish(),
  scopeIds: IdListSchema,
  integrationIds: IdListSchema,
  summary: ValidationSnapshotSummarySchema,
  metrics: ValidationSnapshotMetricsSchema,
  topAttackPaths: z.array(AttackPathAssessmentSchema).max(10),
  controlObservations: z.array(SignalEnvelopeSchema),
  aiAppRisks: z.array(SignalEnvelopeSchema),
  remediationPriorities: z.array(RemediationTaskSchema),
  verificationPlan: StringListSchema,
  evidenceIds: IdListSchema
});

export const EvidencePackSchema = TenantScopedEntitySchema.extend({
  evidencePackId: IdSchema,
  packType: EvidencePackTypeSchema,
  title: z.string().min(1),
  audience: z.string().min(1),
  redactionLevel: SensitivityLevelSchema,
  status: EvidencePackStatusSchema,
  storageUri: z.string().min(1).nullish()
}).merge(EvidenceLinkedSchema);

export const ReportShareGrantSchema = z.object({
  reportShareId: IdSchema,
  reportId: IdSchema,
  tenantId: IdSchema,
  accessCount: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema,
  lastAccessedAt: TimestampSchema.nullable(),
  revokedAt: TimestampSchema.nullable()
});

export const ReportShareLinkSchema = ReportShareGrantSchema.extend({
  token: z.string().min(1),
  url: z.string().min(1)
});

// --- Reconciled from the parallel build line: model-session eligibility/
// liveness/action helpers + open/resolved remediation counters (pure functions
// the remote line built that this line lacked). See PR #21 reconciliation. ---

// Statuses that count as fully resolved remediation work — Fixed or Mitigated
// ONLY. This is deliberately NARROWER than SETTLED_REMEDIATION_STATUSES (which
// also includes PartiallyFixed) because the open/resolved split treats a
// PartiallyFixed item as still-open work, whereas the stale-verification check
// must keep re-verifying a PartiallyFixed claim. Keep the two sets distinct.
const RESOLVED_REMEDIATION_STATUSES = new Set(["Fixed", "Mitigated"]);

export function countOpenRemediations(
  remediations: ReadonlyArray<{ status: string }>
): number {
  return remediations.filter(
    (remediation) => !RESOLVED_REMEDIATION_STATUSES.has(remediation.status)
  ).length;
}

/**
 * Count remediations that are settled as closed — Fixed or Mitigated. This is
 * the exact complement of `countOpenRemediations`, so passing the FULL tenant
 * remediation set yields (resolved + open) === total. Like its complement, the
 * caller is expected to pass the full tenant set, not the top-N priorities
 * preview embedded in a snapshot, so the "closed remediations" report metric is
 * not capped at the preview size.
 */
export function countResolvedRemediations(
  remediations: ReadonlyArray<{ status: string }>
): number {
  return remediations.filter((remediation) =>
    RESOLVED_REMEDIATION_STATUSES.has(remediation.status)
  ).length;
}

/**
 * Decide what a queued model-gateway turn should do when its session is picked
 * up by the worker:
 *  - `"run"`   — session is Active and still inside its time window.
 *  - `"skip"`  — session is no longer runnable (terminated/expired/blocked/
 *                paused/etc); leave it untouched.
 *  - `"expire"`— session is still status=Active but its expiresAt has passed,
 *                so it must be lazily transitioned to Expired and skipped.
 *
 * The submission path lazily enforces the timeout on enqueue, but a session can
 * cross its expiresAt while the turn waits in the queue (status stays Active
 * until a reaper flips it). Guarding only on status would let a timed-out window
 * run a full autonomous turn — and execute tools — past its window.
 */
export type ModelSessionTurnDecision = "run" | "skip" | "expire";

export function evaluateModelSessionTurnEligibility(
  session: { expiresAt: Date | null; status: string },
  asOf: Date
): ModelSessionTurnDecision {
  if (session.status !== "Active") {
    return "skip";
  }
  if (
    session.expiresAt !== null &&
    session.expiresAt.getTime() <= asOf.getTime()
  ) {
    return "expire";
  }
  return "run";
}

/**
 * Whether a model provider may be used to drive a session turn. Only an
 * `Active` provider is usable; `Disabled` (an operator's deliberate halt — e.g.
 * credential compromise, cost/abuse stop, vendor incident) and `Error` are not.
 *
 * Session creation already refuses a non-Active provider, but an in-flight
 * Active session must re-check this before each turn: otherwise disabling a
 * provider only blocks NEW sessions while every already-running session keeps
 * decrypting that provider's credential and driving the model indefinitely,
 * making the "Disable provider" control decorative for sessions already in
 * flight. This is the single shared predicate behind both gates.
 */
export function isModelProviderUsable(status: string): boolean {
  return status === "Active";
}

/**
 * Whether a per-tenant model tool may execute, given its tenant override row (or
 * `null`/`undefined` when no override exists). A tool with no override defaults
 * to enabled; an explicit `enabled: false` override is an operator's deliberate
 * halt of that specific capability.
 *
 * The tool-request creation gate already denies a disabled tool, but the
 * synchronous human-approved execute path must re-check this before running:
 * otherwise disabling a tool only blocks NEW requests while an already-
 * Allowed/Approved request (queued before the disable, in the create→approve→
 * execute window) still executes — including action tools that queue a real
 * validation mission — making the per-tool disable decorative for in-flight
 * requests. This is the single shared predicate behind both gates.
 */
export function isModelToolEnabled(
  override: { enabled: boolean } | null | undefined
): boolean {
  return override?.enabled ?? true;
}

/**
 * The model tool-request statuses from which `executeModelToolRequest` may run a
 * tool: a request is executable while `Allowed` (auto-allowed by policy) or
 * `Approved` (human-approved), and only those. This is the single source of
 * truth behind both the execute gate and the in-flight cancel sets of the halt
 * controls (session terminate, kill switch).
 *
 * Every control that HALTS in-flight requests — `terminateModelSession` and the
 * gateway kill switch — must cancel every executable status, or it leaves a
 * request the operator deliberately tried to stop in a non-terminal,
 * still-executable state. The kill switch in particular both reports
 * `blockedToolRequests` (which then under-counts the requests it actually
 * halted) and is the operator's tenant-wide emergency stop, so an executable
 * status it forgets to cancel makes the kill switch a decorative control over
 * that request. Deriving the cancel where-clauses from this constant keeps the
 * executable set and the halt sets from drifting apart.
 */
export const MODEL_TOOL_REQUEST_EXECUTABLE_STATUSES = [
  "Allowed",
  "Approved"
] as const;

export function isModelToolRequestExecutable(status: string): boolean {
  return (MODEL_TOOL_REQUEST_EXECUTABLE_STATUSES as readonly string[]).includes(
    status
  );
}

/**
 * The provider status to persist after a connection test, given its CURRENT
 * status and whether the test succeeded.
 *
 * A successful test recovers a provider to `Active` (clearing a prior transient
 * `Error`) and a failed test degrades it to `Error` — EXCEPT when the provider
 * is `Disabled`. `Disabled` is an operator's deliberate halt (credential
 * compromise, cost/abuse stop, vendor incident) that v0.1.187 enforces all the
 * way down to in-flight turn execution; a connection test must never silently
 * resurrect it to `Active` (nor relabel it `Error`), or the "Disable provider"
 * control would be decorative — any admin clicking "Test connection" would
 * re-enable a provider an operator deliberately took offline. Only an explicit
 * `updateModelProvider` status change re-enables a disabled provider. The test
 * still runs and records `lastTestedAt`/its result for a disabled provider; it
 * just leaves the deliberate halt sticky. Fail-closed: the `Disabled` guard is
 * checked first.
 */
export function resolveProviderStatusAfterConnectionTest(
  currentStatus: string,
  testOk: boolean
): ModelProviderStatus {
  if (currentStatus === "Disabled") {
    return "Disabled";
  }
  return testOk ? "Active" : "Error";
}

/**
 * Whether a model session may still perform a privileged gateway operation
 * (build context, enqueue/submit/approve/execute a tool) as of `asOf`:
 *  - `"live"`     — the session is usable.
 *  - `"ended"`    — the session is already Terminated (kill switch) or Expired;
 *                   the operation must be refused.
 *  - `"timedOut"` — the session is otherwise active but its `expiresAt` window
 *                   has passed, so it must be lazily transitioned to Expired and
 *                   the operation refused.
 *
 * This is the single liveness predicate behind the gateway's per-operation
 * guards. Distinguishing `"timedOut"` from `"ended"` lets the caller flip a
 * still-`Active` row to `Expired` exactly once while treating both as refusals,
 * so a session that quietly crossed its window cannot keep granting new tool
 * authorizations or executing actions past it.
 */
export type ModelSessionLiveness = "live" | "ended" | "timedOut";

export function evaluateModelSessionLiveness(
  session: { expiresAt: Date | null; status: string },
  asOf: Date
): ModelSessionLiveness {
  if (session.status === "Terminated" || session.status === "Expired") {
    return "ended";
  }
  if (
    session.expiresAt !== null &&
    session.expiresAt.getTime() <= asOf.getTime()
  ) {
    return "timedOut";
  }
  return "live";
}

/**
 * Gate the privileged tool-request lifecycle (creating and executing tool
 * requests) on a model session. These operations drive real action against the
 * customer's systems, so — exactly like turn submission, which already requires
 * `status === "Active"` — they must run only on a genuinely ACTIVE session, not
 * merely a "live" one.
 *
 * `evaluateModelSessionLiveness` deliberately reports "live" for a Paused or
 * Blocked session (a deliberate operator/safety halt) and for a never-started
 * Created session (which has no enforced time window yet, since the window is
 * stamped at start). Guarding tool create/execute on liveness alone therefore
 * lets a deliberately-halted or unstarted session keep creating and executing
 * tools — a decorative pause/block control. This layers the Active requirement
 * on top of liveness/timeout enforcement:
 *  - "ended"     — Terminated/Expired: the session is over.
 *  - "timedOut"  — past expiresAt though status has not been reaped yet; the
 *                  caller should lazily transition it to Expired.
 *  - "notActive" — live but Paused/Blocked/Created: not runnable.
 *  - "allow"     — Active and inside its window.
 */
export type ModelSessionActionGate =
  | "allow"
  | "ended"
  | "timedOut"
  | "notActive";

export function evaluateModelSessionAction(
  session: { expiresAt: Date | null; status: string },
  asOf: Date
): ModelSessionActionGate {
  const liveness = evaluateModelSessionLiveness(session, asOf);
  if (liveness === "ended") {
    return "ended";
  }
  if (liveness === "timedOut") {
    return "timedOut";
  }
  if (session.status !== "Active") {
    return "notActive";
  }
  return "allow";
}

export const CTEMStageSchema = z.enum([
  "Scope",
  "Discover",
  "Prioritize",
  "Validate",
  "Mobilize",
  "Verify"
]);

export const CTEMStageSummarySchema = z.object({
  stage: CTEMStageSchema,
  status: z.enum(["OnTrack", "NeedsAttention", "NotStarted"]),
  evidenceCount: z.number().int().nonnegative(),
  openItemCount: z.number().int().nonnegative(),
  trend: z.enum(["Improving", "Stable", "Worsening"])
});

export const CTEMProgramSummarySchema = z.object({
  tenantId: IdSchema,
  generatedAt: TimestampSchema,
  source: z.enum(["Snapshot", "LiveTenantStateBaseline"]).default("Snapshot"),
  snapshotId: IdSchema.nullish(),
  topRiskBand: RiskBandSchema,
  stages: z.array(CTEMStageSummarySchema).length(6),
  // CTEM depth (P): non-snap scheduled packs contribute to Validate/Verify stages for continuous programs
  nonSnapValidateEvidence: z.number().int().nonnegative().optional(),
  nonSnapVerifyEvidence: z.number().int().nonnegative().optional()
});

export const PolicyDecisionSchema = TenantScopedEntitySchema.extend({
  policyDecisionId: IdSchema,
  userId: IdSchema.nullish(),
  scopeId: IdSchema,
  missionType: MissionTypeSchema,
  safetyLevel: SafetyLevelSchema,
  target: LooseObjectSchema,
  executionEnvironment: ExecutionEnvironmentSchema,
  requestedAction: PolicyRequestedActionSchema,
  outcome: PolicyDecisionOutcomeSchema,
  approvalState: ApprovalStateSchema,
  rationale: z.string().min(1),
  approvedAt: TimestampSchema.nullish(),
  approvedBy: IdSchema.nullish(),
  expiresAt: TimestampSchema.nullish()
});

export const AuditEventSchema = z.object({
  auditEventId: IdSchema,
  tenantId: IdSchema.nullish(),
  userId: IdSchema.nullish(),
  action: AuditEventActionSchema,
  actorType: z.string().min(1),
  entityType: RelatedEntityTypeSchema,
  entityId: IdSchema.nullish(),
  metadata: LooseObjectSchema,
  createdAt: TimestampSchema
});

export const AuditEventFilterSchema = z.object({
  action: AuditEventActionSchema.optional(),
  actorType: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  from: TimestampSchema.optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().max(1_000_000).default(0),
  search: z.string().trim().min(1).max(200).optional(),
  to: TimestampSchema.optional(),
  userId: IdSchema.optional()
});

export const JobSchema = TenantScopedEntitySchema.extend({
  jobId: IdSchema,
  missionId: IdSchema.nullish(),
  validationRunId: IdSchema.nullish(),
  queueName: z.string().min(1),
  status: JobStatusSchema,
  attempts: z.number().int().nonnegative(),
  payload: LooseObjectSchema,
  dedupeKey: z.string().min(1).nullish(),
  availableAt: TimestampSchema,
  startedAt: TimestampSchema.nullish(),
  completedAt: TimestampSchema.nullish(),
  errorMessage: z.string().nullish()
});

export const MissionScheduleSchema = TenantScopedEntitySchema.extend({
  scheduleId: IdSchema,
  missionType: MissionTypeSchema,
  createdBy: IdSchema,
  frequency: ScheduleFrequencySchema,
  status: ScheduleStatusSchema,
  nextRunAt: TimestampSchema,
  lastRunAt: TimestampSchema.nullish(),
  lastSnapshotId: IdSchema.nullish(),
  lastMissionId: IdSchema.nullish(),
  scopeIds: IdListSchema,
  config: LooseObjectSchema,
  lastDiff: LooseObjectSchema.nullish()
});

/** Prior schedule runs for ops history (P06-10) — last N with failure reasons. */
export const ScheduleRunHistoryEntrySchema = z.object({
  runId: z.string().min(1),
  at: TimestampSchema.nullable(),
  outcome: z.string().nullable(),
  status: z.string().nullable().optional(),
  missionId: IdSchema.nullable().optional(),
  denyReason: z.string().nullable().optional(),
  errorSummary: z.string().nullable().optional(),
  packId: z.string().nullable().optional(),
  packType: z.string().nullable().optional(),
  diff: LooseObjectSchema.nullable().optional()
});
export type ScheduleRunHistoryEntry = z.infer<
  typeof ScheduleRunHistoryEntrySchema
>;

export const MissionScheduleDetailSchema = MissionScheduleSchema.extend({
  runHistory: z.array(ScheduleRunHistoryEntrySchema).default([]),
  /** @deprecated Prefer runHistory — kept for transitional clients. */
  priorDiffs: z.array(ScheduleRunHistoryEntrySchema).optional()
});
export type MissionScheduleDetail = z.infer<typeof MissionScheduleDetailSchema>;

export const CreateMissionScheduleInputSchema = z.object({
  audience: z.string().min(1).optional(),
  blackoutWindows: z.array(ScheduleBlackoutWindowSchema).max(10).default([]),
  config: LooseObjectSchema.optional(),
  dayOfMonth: z.number().int().min(1).max(28).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  frequency: ScheduleFrequencySchema,
  maxTopItems: z.number().int().min(3).max(5).optional(),
  missionType: z
    .enum([
      "ValidationSnapshot",
      "ContinuousValidation",
      "AIAppValidation",
      "ControlValidation",
      "FixVerification"
    ])
    .optional(),
  /** Optional soft runner preference for scheduled fires (P10-2). Ranking only. */
  preferredRunnerId: IdSchema.optional(),
  /** Optional hard network-segment affinity for scheduled runner selection (P10-2). */
  networkSegment: z.string().trim().min(1).max(128).optional(),
  nextRunAt: TimestampSchema.optional(),
  runAtLocalTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default("09:00"),
  scopeIds: z.array(IdSchema).min(1).optional(),
  /** Optional hard site affinity for scheduled runner selection (P10-2). */
  siteId: z.string().trim().min(1).max(128).optional(),
  timeZone: z.string().min(1).default("UTC")
});

export const UpdateMissionScheduleInputSchema =
  CreateMissionScheduleInputSchema.omit({ nextRunAt: true })
    .partial()
    .refine((input) => Object.keys(input).length > 0, {
      message: "At least one schedule field is required."
    });

export const ScheduleDiffSchema = z.object({
  addedPathIds: IdListSchema,
  currentSnapshotId: IdSchema,
  previousSnapshotId: IdSchema.nullish(),
  removedPathIds: IdListSchema,
  reopenedPathIds: IdListSchema,
  riskScoreDelta: z.number(),
  status: ScheduleDiffStatusSchema,
  summary: z.string().min(1)
});

export const ScheduledRunResultSchema = z.object({
  diff: ScheduleDiffSchema,
  schedule: MissionScheduleSchema,
  snapshot: ValidationSnapshotSchema.nullish() // nullish for non-snapshot scheduled mission types (AI/Control/FixVerification)
});

export const DueScheduleRunSummarySchema = z.object({
  results: z.array(ScheduledRunResultSchema),
  runCount: z.number().int().nonnegative()
});

export const SignalTriggerRuleSchema = z.object({
  triggerId: z.string().min(1),
  triggerType: SignalTriggerTypeSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  enabled: z.boolean(),
  signalCategories: z.array(SignalCategorySchema),
  signalSubcategories: StringListSchema,
  recommendedMissionType: MissionTypeSchema,
  safetyLevel: SafetyLevelSchema,
  requiredIntegrationCategories: z.array(IntegrationCategorySchema),
  requiredScopeTypes: z.array(ScopeTypeSchema)
});

export const SignalTriggerEvaluationSchema = z.object({
  triggerId: z.string().min(1),
  triggerType: SignalTriggerTypeSchema,
  status: SignalTriggerEvaluationStatusSchema,
  reason: z.string().min(1),
  matchedSignalIds: IdListSchema,
  matchedAuditEventIds: IdListSchema,
  evidenceIds: IdListSchema,
  missingPrerequisites: StringListSchema,
  recommendedMissionType: MissionTypeSchema,
  recommendedModuleIds: StringListSchema,
  requiresApproval: z.boolean()
});

export const SignalTriggerActivitySchema = z.object({
  activityId: z.string().min(1),
  triggerId: z.string().min(1),
  triggerType: SignalTriggerTypeSchema,
  title: z.string().min(1),
  status: SignalTriggerEvaluationStatusSchema,
  summary: z.string().min(1),
  createdAt: TimestampSchema,
  signalIds: IdListSchema,
  auditEventIds: IdListSchema,
  evidenceIds: IdListSchema,
  recommendedMissionType: MissionTypeSchema
});

export const SignalTriggerEvaluationSummarySchema = z.object({
  needsApproval: z.number().int().nonnegative(),
  notConfigured: z.number().int().nonnegative(),
  requiresIntegration: z.number().int().nonnegative(),
  requiresInternalRunner: z.number().int().nonnegative(),
  requiresVerifiedScope: z.number().int().nonnegative()
});

export const SignalTriggerEvaluationResponseSchema = z.object({
  tenantId: IdSchema,
  evaluatedAt: TimestampSchema,
  rules: z.array(SignalTriggerRuleSchema),
  evaluations: z.array(SignalTriggerEvaluationSchema),
  activity: z.array(SignalTriggerActivitySchema),
  summary: SignalTriggerEvaluationSummarySchema
});

export const SignalTriggerRoutingDecisionSchema = z.object({
  deliveries: z.array(
    z.object({
      connectorKey: z.string().min(1).nullish(),
      deliveredAt: TimestampSchema.nullish(),
      detail: z.string().min(1),
      integrationId: IdSchema,
      status: SignalTriggerRoutingDeliveryStatusSchema
    })
  ),
  enabled: z.boolean(),
  escalationRole: MembershipRoleSchema,
  notificationIntegrationIds: IdListSchema,
  nextActions: StringListSchema,
  status: SignalTriggerRoutingStatusSchema,
  summary: z.string().min(1),
  workflowDestinationIntegrationIds: IdListSchema
});

export const SignalTriggerApprovalResponseSchema = z.object({
  evaluation: SignalTriggerEvaluationSchema,
  mission: ValidationMissionSchema,
  policyDecision: PolicyDecisionSchema,
  routing: SignalTriggerRoutingDecisionSchema
});

export const ValidationJobPayloadSchema = z.object({
  jobId: IdSchema,
  missionId: IdSchema,
  runId: IdSchema,
  tenantId: IdSchema,
  // Originating API request id (x-request-id), carried through so worker logs
  // can be correlated back to the request that enqueued the job. Optional:
  // jobs enqueued outside a request (schedulers, internal re-verification).
  requestId: z.string().min(1).nullish()
});

export const ModelGatewayTurnJobPayloadSchema = z.object({
  turnId: IdSchema,
  modelSessionId: IdSchema,
  tenantId: IdSchema,
  userId: IdSchema,
  queueLane: z.enum(["Standard", "Priority"]).default("Standard"),
  prompt: z.string().min(1).max(16384)
});

// ---------------------------------------------------------------------------
// Frontier Gateway (model gateway) contracts
// ---------------------------------------------------------------------------

export const ModelProviderTypeSchema = z.enum([
  "AnthropicCompatible",
  "OpenAICompatible",
  "GoogleCompatible",
  "MicrosoftCompatible",
  "AWSBedrockCompatible",
  "LocalOpenAICompatible",
  "CustomerPrivateEndpoint",
  "SpecializedCyberModel",
  "Other"
]);

export const ModelDeploymentTypeSchema = z.enum([
  "Cloud",
  "CustomerVPC",
  "OnPrem",
  "LocalRunner",
  "AirGappedFuture"
]);

export const ModelProviderStatusSchema = z.enum([
  "Active",
  "Disabled",
  "Error"
]);

export const ModelSessionModeSchema = z.enum([
  "PlanOnly",
  "ReadOnlyEvidence",
  "SafeValidation",
  "GuidedRemediation",
  "HighAssurance"
]);

export const ModelSessionStatusSchema = z.enum([
  "Created",
  "Active",
  "Paused",
  "Terminated",
  "Blocked",
  "Expired",
  "Archived"
]);

export const ModelToolRequestStatusSchema = z.enum([
  "Requested",
  "Allowed",
  "Denied",
  "RequiresApproval",
  "Approved",
  "Running",
  "Completed",
  "Failed",
  "Cancelled",
  "Expired"
]);

export const ModelGatewayEventTypeSchema = z.enum([
  "SessionCreated",
  "SessionStarted",
  "ContextBundleCreated",
  "ToolRequested",
  "ToolAllowed",
  "ToolDenied",
  "ApprovalRequested",
  "ToolExecuted",
  "ToolFailed",
  "ToolResultReturned",
  "RedactionApplied",
  "SensitiveDataBlocked",
  "SessionPaused",
  "SessionTerminated",
  "KillSwitchActivated",
  "SemanticCacheHit",
  "SemanticCacheStored",
  "InterventionLinkIssued",
  "InterventionResumed",
  "InterventionCancelled",
  "InterventionExpired",
  "InterventionRejected"
]);

export const ModelToolSafetyClassSchema = z.enum([
  "ReadOnly",
  "Plan",
  "Validation",
  "Remediation",
  "Reporting"
]);

export const ModelPrecisionModeSchema = z.enum([
  "ProviderManaged",
  "FP32",
  "TF32",
  "BF16",
  "FP16",
  "INT8",
  "INT4"
]);

export const ModelAdapterAliasSchema = z.object({
  alias: z.string().min(1).max(160),
  model: z.string().min(1).max(512),
  status: z.enum(["Active", "Disabled"]).default("Active")
});

export const ModelServingCapabilitiesSchema = z
  .object({
    adapterAliases: z.array(ModelAdapterAliasSchema).max(100).default([]),
    defaultPrecisionMode: ModelPrecisionModeSchema.default("ProviderManaged"),
    maxConcurrentTurns: z.number().int().positive().max(100_000).nullish(),
    precisionModes: z
      .array(ModelPrecisionModeSchema)
      .min(1)
      .default(["ProviderManaged"]),
    source: z
      .enum(["ProviderDeclared", "ConnectionVerified"])
      .default("ProviderDeclared"),
    supportsAdapterHotSwap: z.boolean().default(false),
    supportsUsageByAdapter: z.boolean().default(false)
  })
  .superRefine((value, context) => {
    const aliases = value.adapterAliases.map((item) => item.alias);
    if (new Set(aliases).size !== aliases.length) {
      context.addIssue({
        code: "custom",
        message: "Adapter aliases must be unique.",
        path: ["adapterAliases"]
      });
    }
    if (!value.precisionModes.includes(value.defaultPrecisionMode)) {
      context.addIssue({
        code: "custom",
        message: "The default precision mode must be in precisionModes.",
        path: ["defaultPrecisionMode"]
      });
    }
  });

export const ModelProviderSchema = TenantScopedEntitySchema.extend({
  modelProviderId: IdSchema,
  providerType: ModelProviderTypeSchema,
  providerName: z.string().min(1),
  endpointUrl: z.string().min(1),
  authMethod: z.string().min(1),
  hasCredential: z.boolean(),
  deploymentType: ModelDeploymentTypeSchema,
  status: ModelProviderStatusSchema,
  allowedUseCases: StringListSchema,
  dataResidency: z.string().nullish(),
  servingCapabilities: ModelServingCapabilitiesSchema,
  servingCapabilitiesVerifiedAt: TimestampSchema.nullish(),
  lastTestedAt: TimestampSchema.nullish(),
  createdBy: IdSchema
});

export const CreateModelProviderInputSchema = z.object({
  providerType: ModelProviderTypeSchema,
  providerName: z.string().min(1).max(160),
  endpointUrl: z.string().url().max(2048),
  authMethod: z.string().min(1).max(64).default("bearer"),
  apiKey: z.string().min(1).max(8192).nullish(),
  deploymentType: ModelDeploymentTypeSchema,
  allowedUseCases: z.array(z.string().min(1)).default([]),
  dataResidency: z.string().min(1).max(160).nullish(),
  servingCapabilities: ModelServingCapabilitiesSchema.optional()
});

export const UpdateModelProviderInputSchema = z.object({
  providerName: z.string().min(1).max(160).optional(),
  endpointUrl: z.string().url().max(2048).optional(),
  authMethod: z.string().min(1).max(64).optional(),
  apiKey: z.string().min(1).max(8192).nullish(),
  deploymentType: ModelDeploymentTypeSchema.optional(),
  status: ModelProviderStatusSchema.optional(),
  allowedUseCases: z.array(z.string().min(1)).optional(),
  dataResidency: z.string().min(1).max(160).nullish(),
  servingCapabilities: ModelServingCapabilitiesSchema.optional()
});

export const ModelProviderConnectionTestResultSchema = z.object({
  ok: z.boolean(),
  providerType: ModelProviderTypeSchema,
  message: z.string(),
  testedAt: TimestampSchema,
  availableModels: StringListSchema.optional()
});

export const ModelPolicyProfileSchema = TenantScopedEntitySchema.extend({
  modelPolicyProfileId: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  allowedModes: z.array(ModelSessionModeSchema),
  allowedTools: StringListSchema,
  blockedTools: StringListSchema,
  maxSafetyLevel: SafetyLevelSchema,
  approvalRequiredAboveLevel: SafetyLevelSchema,
  allowRawEvidence: z.boolean(),
  allowSensitiveContext: z.boolean(),
  allowTicketCreation: z.boolean(),
  allowRunnerTasks: z.boolean(),
  allowExternalValidation: z.boolean(),
  allowInternalValidation: z.boolean(),
  allowedDataClasses: StringListSchema,
  redactionPolicy: z.string().min(1),
  sessionTimeoutMinutes: z.number().int().positive(),
  createdBy: IdSchema
});

export const CreateModelPolicyProfileInputSchema = z.object({
  name: z.string().min(1).max(160),
  description: z.string().min(1).max(2048),
  allowedModes: z.array(ModelSessionModeSchema).min(1),
  allowedTools: z.array(z.string().min(1)).default([]),
  blockedTools: z.array(z.string().min(1)).default([]),
  maxSafetyLevel: SafetyLevelSchema.default("ActiveNonInvasive"),
  approvalRequiredAboveLevel: SafetyLevelSchema.default("ActiveNonInvasive"),
  allowRawEvidence: z.boolean().default(false),
  allowSensitiveContext: z.boolean().default(false),
  allowTicketCreation: z.boolean().default(false),
  allowRunnerTasks: z.boolean().default(false),
  allowExternalValidation: z.boolean().default(false),
  allowInternalValidation: z.boolean().default(false),
  allowedDataClasses: z.array(z.string().min(1)).default([]),
  redactionPolicy: z.string().min(1).max(64).default("default"),
  sessionTimeoutMinutes: z.number().int().positive().max(1440).default(60)
});

export const UpdateModelPolicyProfileInputSchema =
  CreateModelPolicyProfileInputSchema.partial();

export const ModelSessionSchema = TenantScopedEntitySchema.extend({
  modelSessionId: IdSchema,
  modelProviderId: IdSchema,
  modelPolicyProfileId: IdSchema,
  userId: IdSchema,
  purpose: z.string().min(1),
  scopeIds: IdListSchema,
  mode: ModelSessionModeSchema,
  requestedModel: z.string().nullish(),
  adapterAlias: z.string().nullish(),
  precisionMode: ModelPrecisionModeSchema,
  status: ModelSessionStatusSchema,
  startedAt: TimestampSchema.nullish(),
  endedAt: TimestampSchema.nullish(),
  expiresAt: TimestampSchema.nullish()
});

export const CreateModelSessionInputSchema = z.object({
  modelProviderId: IdSchema,
  modelPolicyProfileId: IdSchema,
  purpose: z.string().min(1).max(2048),
  scopeIds: z.array(IdSchema).min(1),
  mode: ModelSessionModeSchema,
  requestedModel: z.string().min(1).max(512).nullish(),
  adapterAlias: z.string().min(1).max(160).nullish(),
  precisionMode: ModelPrecisionModeSchema.optional()
});

export const ContextBundleItemSchema = z.object({
  contextBundleItemId: IdSchema,
  contextBundleId: IdSchema,
  entityType: RelatedEntityTypeSchema,
  entityId: IdSchema,
  evidenceIds: IdListSchema,
  redactionStatus: RedactionStatusSchema,
  includedReason: z.string().min(1),
  createdAt: TimestampSchema
});

export const ContextPruningManifestSchema = z.object({
  applied: z.boolean(),
  omittedItems: z.array(
    z.object({
      digest: z.string().regex(/^[a-f0-9]{64}$/u),
      entityId: IdSchema,
      entityType: RelatedEntityTypeSchema
    })
  ),
  retainedEvidenceIds: IdListSchema,
  retainedItemCount: z.number().int().nonnegative(),
  retainedTokenEstimate: z.number().int().nonnegative(),
  sourceItemCount: z.number().int().nonnegative(),
  sourceTokenEstimate: z.number().int().nonnegative(),
  strategy: z.literal("EvidencePriorityDeterministicV1"),
  tokenBudget: z.number().int().positive(),
  version: z.literal(1)
});

export const ContextBundleSchema = z.object({
  contextBundleId: IdSchema,
  tenantId: IdSchema,
  modelSessionId: IdSchema,
  scopeIds: IdListSchema,
  redactionPolicy: z.string().min(1),
  sensitivityLevel: SensitivityLevelSchema,
  pruningManifest: ContextPruningManifestSchema,
  sourceTokenEstimate: z.number().int().nonnegative(),
  tokenBudget: z.number().int().positive(),
  tokenEstimate: z.number().int().nonnegative(),
  createdAt: TimestampSchema,
  expiresAt: TimestampSchema.nullish(),
  items: z.array(ContextBundleItemSchema)
});

export const CreateContextBundleInputSchema = z.object({
  maxTokenEstimate: z.number().int().min(40).max(100_000).optional(),
  scopeIds: z.array(IdSchema).min(1).optional()
});

export const ModelToolDefinitionSchema = z.object({
  toolName: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  safetyClass: ModelToolSafetyClassSchema,
  safetyLevel: SafetyLevelSchema,
  requiredRole: z.string().min(1),
  approvalRequiredByDefault: z.boolean(),
  allowedModes: z.array(ModelSessionModeSchema),
  inputSchema: LooseObjectSchema,
  outputSchema: LooseObjectSchema
});

export const ModelToolSchema = TenantScopedEntitySchema.extend({
  toolName: z.string().min(1),
  enabled: z.boolean(),
  approvalRequired: z.boolean(),
  allowedSessionModes: z.array(ModelSessionModeSchema),
  definition: ModelToolDefinitionSchema
});

export const UpdateModelToolInputSchema = z.object({
  enabled: z.boolean().optional(),
  approvalRequired: z.boolean().optional(),
  allowedSessionModes: z.array(ModelSessionModeSchema).optional()
});

// --- MCP server (expose Periscan's read-only tools to a customer's AI client) ---
// The MCP catalog is READ-ONLY by construction: every tool maps to a
// tenant-scoped read, and offensive/mutating capabilities are never exposed.
// Wave H: advertise read-only honesty + required API-key scopes so clients and
// the console cannot mistake MCP for a mutate surface.
export const McpToolAnnotationsSchema = z.object({
  destructiveHint: z.literal(false),
  idempotentHint: z.boolean(),
  openWorldHint: z.literal(false),
  readOnlyHint: z.literal(true)
});
export type McpToolAnnotations = z.infer<typeof McpToolAnnotationsSchema>;

export const McpToolInfoSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  inputSchema: LooseObjectSchema,
  // Always true — catalog never exposes mutate/offensive tools.
  readOnly: z.literal(true),
  // Coarse API-key scopes that satisfy MCP access (session users use role gates).
  requiredScopes: z.array(z.enum(["read", "admin"])).min(1),
  annotations: McpToolAnnotationsSchema
});
export type McpToolInfo = z.infer<typeof McpToolInfoSchema>;

export const McpActivityEntrySchema = z.object({
  toolName: z.string().min(1),
  status: z.enum(["ok", "error"]),
  invokedAt: TimestampSchema
});
export type McpActivityEntry = z.infer<typeof McpActivityEntrySchema>;

// --- Offensive-validation authorization (the "enable offensive" flip) ---
// Governance only: a tenant admin authorizes adversarial validation, which
// raises the policy engine's ceiling to AdvancedAdversarial. The hard safety
// floor (destructive/exfiltration/persistence/credential-theft/uncontrolled
// chaining) is NEVER lifted — offensive validation proves exploitability
// without causing harm.
export const TenantSafetySettingsSchema = z.object({
  offensiveValidationEnabled: z.boolean(),
  authorizedBy: IdSchema.nullable(),
  authorizedAt: TimestampSchema.nullable(),
  authorizationReference: z.string().nullable(),
  // The effective policy ceiling this setting produces.
  effectiveMaxSafetyLevel: SafetyLevelSchema,
  // The top governance tier — governed destructive / real-payload validation.
  destructiveValidationEnabled: z.boolean(),
  destructiveAuthorizedBy: IdSchema.nullable(),
  destructiveAuthorizedAt: TimestampSchema.nullable(),
  destructiveAuthorizationReference: z.string().nullable()
});
export type TenantSafetySettings = z.infer<typeof TenantSafetySettingsSchema>;

export const SetOffensiveValidationInputSchema = z
  .object({
    enabled: z.boolean(),
    authorizationReference: z.string().min(1).max(2000).optional(),
    totpCode: z.string().min(6).max(12).optional()
  })
  .refine((value) => !value.enabled || Boolean(value.authorizationReference), {
    message:
      "authorizationReference is required to enable offensive validation.",
    path: ["authorizationReference"]
  });
export type SetOffensiveValidationInput = z.infer<
  typeof SetOffensiveValidationInputSchema
>;

export const SetDestructiveValidationInputSchema = z
  .object({
    enabled: z.boolean(),
    authorizationReference: z.string().min(1).max(2000).optional(),
    totpCode: z.string().min(6).max(12).optional()
  })
  .refine((value) => !value.enabled || Boolean(value.authorizationReference), {
    message:
      "authorizationReference is required to enable destructive validation.",
    path: ["authorizationReference"]
  });
export type SetDestructiveValidationInput = z.infer<
  typeof SetDestructiveValidationInputSchema
>;

// Tenant force-MFA for password auth. Complements deployment-wide
// PERISCAN_REQUIRE_MFA. When enabled, password sessions without enrolled MFA
// are limited to the MFA setup path; SSO is unaffected.
export const SetTenantRequireMfaInputSchema = z.object({
  enabled: z.boolean(),
  totpCode: z.string().min(6).max(12).optional()
});
export type SetTenantRequireMfaInput = z.infer<
  typeof SetTenantRequireMfaInputSchema
>;

export const TenantRequireMfaSettingsSchema = z.object({
  requireMfa: z.boolean(),
  // True when deployment env PERISCAN_REQUIRE_MFA also forces MFA regardless
  // of the tenant flag.
  envRequireMfa: z.boolean(),
  // Effective enforcement for password auth (env OR tenant).
  effectiveRequireMfa: z.boolean()
});
export type TenantRequireMfaSettings = z.infer<
  typeof TenantRequireMfaSettingsSchema
>;

export const ModelToolResultSchema = z.object({
  toolResultId: IdSchema,
  tenantId: IdSchema,
  toolRequestId: IdSchema,
  validationRunId: IdSchema.nullish(),
  evidenceIds: IdListSchema,
  outputPayloadRedacted: LooseObjectSchema,
  sensitivityLevel: SensitivityLevelSchema,
  returnedToModel: z.boolean(),
  createdAt: TimestampSchema
});

export const ModelToolRequestSchema = z.object({
  toolRequestId: IdSchema,
  tenantId: IdSchema,
  modelSessionId: IdSchema,
  toolName: z.string().min(1),
  requestedByModel: z.boolean(),
  requestReason: z.string().min(1),
  inputPayloadHash: z.string().min(1),
  inputPayloadRedacted: LooseObjectSchema,
  scopeIds: IdListSchema,
  policyDecisionId: IdSchema.nullish(),
  status: ModelToolRequestStatusSchema,
  denialReason: z.string().nullish(),
  createdAt: TimestampSchema,
  approvedAt: TimestampSchema.nullish(),
  approvedBy: IdSchema.nullish(),
  completedAt: TimestampSchema.nullish(),
  updatedAt: TimestampSchema,
  result: ModelToolResultSchema.nullish()
});

export const CreateModelToolRequestInputSchema = z.object({
  toolName: z.string().min(1),
  requestReason: z.string().min(1).max(2048),
  input: LooseObjectSchema.default({}),
  scopeIds: z.array(IdSchema).optional()
});

export const ModelGatewayAuditEventSchema = z.object({
  eventId: IdSchema,
  tenantId: IdSchema,
  modelSessionId: IdSchema.nullish(),
  eventType: ModelGatewayEventTypeSchema,
  userId: IdSchema.nullish(),
  modelProviderId: IdSchema.nullish(),
  toolName: z.string().nullish(),
  toolRequestId: IdSchema.nullish(),
  policyDecisionId: IdSchema.nullish(),
  evidenceIds: IdListSchema,
  metadata: LooseObjectSchema,
  createdAt: TimestampSchema
});

export const CreateModelSessionTurnInputSchema = z.object({
  prompt: z.string().min(1).max(16384),
  queueLane: z.enum(["Standard", "Priority"]).default("Standard")
});

export const ModelSessionTurnAcceptedSchema = z.object({
  modelSessionId: IdSchema,
  jobId: IdSchema.nullish(),
  status: ModelSessionStatusSchema,
  enqueuedAt: TimestampSchema
});

export const ActivateKillSwitchInputSchema = z.object({
  // When false, clears the durable tenant kill switch (sessions stay Terminated).
  // Defaults to true so existing clients keep activate-only semantics.
  enabled: z.boolean().default(true),
  reason: z.string().min(1).max(2048)
});

export const KillSwitchResultSchema = z.object({
  tenantId: IdSchema,
  terminatedSessions: z.number().int().nonnegative(),
  blockedToolRequests: z.number().int().nonnegative(),
  activatedAt: TimestampSchema,
  /** Durable tenant flag after this call (env force-on is reported separately). */
  enabled: z.boolean(),
  /** True when process env PERISCAN_MODEL_GATEWAY_KILL_SWITCH forces kill on. */
  envForceActive: z.boolean().default(false),
  reason: z.string().min(1).max(2048).nullish()
});

export type Tenant = z.infer<typeof TenantSchema>;
export type DataResidencyRegion = z.infer<typeof DataResidencyRegionSchema>;
export type DataResidencyOptions = z.infer<typeof DataResidencyOptionsSchema>;
export type TenantReportBranding = z.infer<typeof TenantReportBrandingSchema>;
export type TenantDesignPartnerSettings = z.infer<
  typeof TenantDesignPartnerSettingsSchema
>;
export type TenantSsoProviderType = z.infer<typeof TenantSsoProviderTypeSchema>;
export type TenantSsoStatus = z.infer<typeof TenantSsoStatusSchema>;
export type TenantSsoRoleMappingRule = z.infer<
  typeof TenantSsoRoleMappingRuleSchema
>;
export type TenantSsoConfig = z.infer<typeof TenantSsoConfigSchema>;
export type TenantSsoConfigResponse = z.infer<
  typeof TenantSsoConfigResponseSchema
>;
export type UpdateTenantSsoConfigInput = z.infer<
  typeof UpdateTenantSsoConfigInputSchema
>;
export type TenantSsoAuthorizationUrlInput = z.infer<
  typeof TenantSsoAuthorizationUrlInputSchema
>;
export type TenantSsoAuthorizationUrl = z.infer<
  typeof TenantSsoAuthorizationUrlSchema
>;
export type StartTenantSsoLoginInput = z.infer<
  typeof StartTenantSsoLoginInputSchema
>;
export type TenantSsoLoginStartResult = z.infer<
  typeof TenantSsoLoginStartResultSchema
>;
export type CompleteTenantSsoLoginInput = z.infer<
  typeof CompleteTenantSsoLoginInputSchema
>;
export type SignalTriggerRoutingStatus = z.infer<
  typeof SignalTriggerRoutingStatusSchema
>;
export type SignalTriggerRoutingDeliveryStatus = z.infer<
  typeof SignalTriggerRoutingDeliveryStatusSchema
>;
export type SignalTriggerRoutingSettings = z.infer<
  typeof SignalTriggerRoutingSettingsSchema
>;
export type DesignPartnerChecklistStatus = z.infer<
  typeof DesignPartnerChecklistStatusSchema
>;
export type DesignPartnerChecklistItem = z.infer<
  typeof DesignPartnerChecklistItemSchema
>;
export type DesignPartnerSnapshotRequestStatus = z.infer<
  typeof DesignPartnerSnapshotRequestStatusSchema
>;
export type DesignPartnerReportNote = z.infer<
  typeof DesignPartnerReportNoteSchema
>;
export type DesignPartnerSessionOutcome = z.infer<
  typeof DesignPartnerSessionOutcomeSchema
>;
export type DesignPartnerSessionNote = z.infer<
  typeof DesignPartnerSessionNoteSchema
>;
export type AppendDesignPartnerSessionNoteInput = z.infer<
  typeof AppendDesignPartnerSessionNoteInputSchema
>;
export type DesignPartnerSessionLearning = z.infer<
  typeof DesignPartnerSessionLearningSchema
>;
export type DesignPartnerAnalystEvidence = z.infer<
  typeof DesignPartnerAnalystEvidenceSchema
>;
export type DesignPartnerWorkspace = z.infer<
  typeof DesignPartnerWorkspaceSchema
>;
export type TrustSafetyConnectedIntegration = z.infer<
  typeof TrustSafetyConnectedIntegrationSchema
>;
export type TrustSafetyEvidenceRetention = z.infer<
  typeof TrustSafetyEvidenceRetentionSchema
>;
export type TrustSafetyDataGovernance = z.infer<
  typeof TrustSafetyDataGovernanceSchema
>;
export type TrustSafetyOperationalReadinessControl = z.infer<
  typeof TrustSafetyOperationalReadinessControlSchema
>;
export type TrustSafetyOperationalReadiness = z.infer<
  typeof TrustSafetyOperationalReadinessSchema
>;
export type TrustSafetyVendorAssurance = z.infer<
  typeof TrustSafetyVendorAssuranceSchema
>;
export type TrustSafetyPrinciple = z.infer<typeof TrustSafetyPrincipleSchema>;
export type TrustSafetyRunnerModel = z.infer<
  typeof TrustSafetyRunnerModelSchema
>;
export type TrustSafetySummary = z.infer<typeof TrustSafetySummarySchema>;
export type User = z.infer<typeof UserSchema>;
export type Membership = z.infer<typeof MembershipSchema>;
export type ProductPersona = z.infer<typeof ProductPersonaSchema>;
export type ProductOutcome = z.infer<typeof ProductOutcomeSchema>;
export type ProofLoopStage = z.infer<typeof ProofLoopStageSchema>;
export type ProductExperienceProfile = z.infer<
  typeof ProductExperienceProfileSchema
>;
export type UpdateProductExperienceProfileInput = z.infer<
  typeof UpdateProductExperienceProfileInputSchema
>;
export type ActivationMilestoneKey = z.infer<
  typeof ActivationMilestoneKeySchema
>;
export type ProductActivationState = z.infer<
  typeof ProductActivationStateSchema
>;
export type ProductWorkQueue = z.infer<typeof ProductWorkQueueSchema>;
export type ProductWorkQueueFeedItem = z.infer<typeof ProductWorkQueueFeedItemSchema>;
export type BlueShiftBrief = z.infer<typeof BlueShiftBriefSchema>;
export type BlueShiftBriefBucket = z.infer<typeof BlueShiftBriefBucketSchema>;
export type TenantMaturity = z.infer<typeof TenantMaturitySchema>;
export type SubmitProductFeedbackInput = z.infer<
  typeof SubmitProductFeedbackInputSchema
>;
export type ProductFeedback = z.infer<typeof ProductFeedbackSchema>;
export type Scope = z.infer<typeof ScopeSchema>;
export type ScopeAssetClass = z.infer<typeof ScopeAssetClassSchema>;
export type PurdueLevel = z.infer<typeof PurdueLevelSchema>;
export type ScopeClassification = z.infer<typeof ScopeClassificationSchema>;
export type ScopeMaxSafetyLevel = z.infer<typeof ScopeMaxSafetyLevelSchema>;
export type CreateScopeInput = z.infer<typeof CreateScopeInputSchema>;
export type UpdateScopeClassificationInput = z.infer<
  typeof UpdateScopeClassificationInputSchema
>;
export type Integration = z.infer<typeof IntegrationSchema>;
export type IntegrationPermissionsSummary = z.infer<
  typeof IntegrationPermissionsSummarySchema
>;
export type Asset = z.infer<typeof AssetSchema>;
export type AssetResolutionStatus = z.infer<typeof AssetResolutionStatusSchema>;
export type AssetSourceObservation = z.infer<
  typeof AssetSourceObservationSchema
>;
export type AssetLineage = z.infer<typeof AssetLineageSchema>;
export type AssetOwnershipEntry = z.infer<typeof AssetOwnershipEntrySchema>;
export type AssetOwnershipReview = z.infer<typeof AssetOwnershipReviewSchema>;
export type AssetOwnershipReviewDisposition = z.infer<
  typeof AssetOwnershipReviewDispositionSchema
>;
export type ReviewAssetOwnershipCandidateInput = z.input<
  typeof ReviewAssetOwnershipCandidateInputSchema
>;
export type AssetOwnershipLifecycle = z.infer<
  typeof AssetOwnershipLifecycleSchema
>;
export type AssetOwnershipStatus = z.infer<typeof AssetOwnershipStatusSchema>;
export type AssetOwnershipSurface = z.infer<typeof AssetOwnershipSurfaceSchema>;
export type DataFabricQualitySurface = z.infer<
  typeof DataFabricQualitySurfaceSchema
>;
export type ScanImportFormat = z.infer<typeof ScanImportFormatSchema>;
export type ImportScanFileInput = z.input<typeof ImportScanFileInputSchema>;
export type ScanImportResult = z.infer<typeof ScanImportResultSchema>;
export type DataFabricSourceQuality = z.infer<
  typeof DataFabricSourceQualitySchema
>;
export type DataFabricSourceQualityState = z.infer<
  typeof DataFabricSourceQualityStateSchema
>;
export type AssetValuation = z.infer<typeof AssetValuationSchema>;
export type AssetValuationInput = z.input<typeof AssetValuationInputSchema>;
export type FinancialEstimateRange = z.infer<
  typeof FinancialEstimateRangeSchema
>;
export type FinancialExposureEstimate = z.infer<
  typeof FinancialExposureEstimateSchema
>;
export type Identity = z.infer<typeof IdentitySchema>;
export type NonHumanIdentityType = z.infer<typeof NonHumanIdentityTypeSchema>;
export type NonHumanIdentityRiskLevel = z.infer<
  typeof NonHumanIdentityRiskLevelSchema
>;
export type NonHumanIdentityRiskFlag = z.infer<
  typeof NonHumanIdentityRiskFlagSchema
>;
export type NonHumanIdentityResourceAccess = z.infer<
  typeof NonHumanIdentityResourceAccessSchema
>;
export type RegisterNonHumanIdentityInput = z.input<
  typeof RegisterNonHumanIdentityInputSchema
>;
export type NonHumanIdentity = z.infer<typeof NonHumanIdentitySchema>;
export type NonHumanIdentitySummary = z.infer<
  typeof NonHumanIdentitySummarySchema
>;
export type NonHumanIdentityInventory = z.infer<
  typeof NonHumanIdentityInventorySchema
>;
export type ControlSource = z.infer<typeof ControlSourceSchema>;
export type DetectionRuleBehavior = z.infer<typeof DetectionRuleBehaviorSchema>;
export type ExpectedControlBehavior = z.infer<
  typeof ExpectedControlBehaviorSchema
>;
export type DetectionRuleCoverageStatus = z.infer<
  typeof DetectionRuleCoverageStatusSchema
>;
export type DetectionRuleCoverageItem = z.infer<
  typeof DetectionRuleCoverageItemSchema
>;
export type ControlRuleCoverageSummary = z.infer<
  typeof ControlRuleCoverageSummarySchema
>;
export type ControlRuleCoverageSnapshotPoint = z.infer<
  typeof ControlRuleCoverageSnapshotPointSchema
>;
export type DetectionRuleCoverageTrend = z.infer<
  typeof DetectionRuleCoverageTrendSchema
>;
export type AIApplication = z.infer<typeof AIApplicationSchema>;
export type Exposure = z.infer<typeof ExposureSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
export type ValidationMission = z.infer<typeof ValidationMissionSchema>;
export type ValidationRun = z.infer<typeof ValidationRunSchema>;
export type MissionStartResult = z.infer<typeof MissionStartResultSchema>;
export type ExternalValidationAttempt = z.infer<
  typeof ExternalValidationAttemptSchema
>;
export type ValidationStimulusType = z.infer<
  typeof ValidationStimulusTypeSchema
>;
export type ValidationStimulusStatus = z.infer<
  typeof ValidationStimulusStatusSchema
>;
export type ControlValidationVerdict = z.infer<
  typeof ControlValidationVerdictSchema
>;
export type ControlValidationVerdictRecord = z.infer<
  typeof ControlValidationVerdictRecordSchema
>;
export type ValidationStimulus = z.infer<typeof ValidationStimulusSchema>;
export type CreateValidationStimulusInput = z.infer<
  typeof CreateValidationStimulusInputSchema
>;
export type CreateValidationStimulusResponse = z.infer<
  typeof CreateValidationStimulusResponseSchema
>;
export type DetectionMarkerProofInput = z.input<
  typeof DetectionMarkerProofInputSchema
>;
export type DetectionMarkerProofResult = z.infer<
  typeof DetectionMarkerProofResultSchema
>;
export type DnsExfilCanaryProofInput = z.input<
  typeof DnsExfilCanaryProofInputSchema
>;
export type DnsExfilCanaryProofResult = z.infer<
  typeof DnsExfilCanaryProofResultSchema
>;
export type SignalEnvelope = z.infer<typeof SignalEnvelopeSchema>;
export type EvidenceArtifact = z.infer<typeof EvidenceArtifactSchema>;
export type EvidenceArtifactVerification = z.infer<
  typeof EvidenceArtifactVerificationSchema
>;
export type EvidenceArtifactVerificationStatus = z.infer<
  typeof EvidenceArtifactVerificationStatusSchema
>;
export type EvidenceChainLinkVerification = z.infer<
  typeof EvidenceChainLinkVerificationSchema
>;
export type EvidenceChainLinkVerificationStatus = z.infer<
  typeof EvidenceChainLinkVerificationStatusSchema
>;
export type EvidenceChainVerificationReport = z.infer<
  typeof EvidenceChainVerificationReportSchema
>;
export type EvidenceVerificationMethod = z.infer<
  typeof EvidenceVerificationMethodSchema
>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type PathNode = z.infer<typeof PathNodeSchema>;
export type PathEdge = z.infer<typeof PathEdgeSchema>;
export type PathBreaker = z.infer<typeof PathBreakerSchema>;
export type EvidenceBasis = z.infer<typeof EvidenceBasisSchema>;
export type AttackPath = z.infer<typeof AttackPathSchema>;
export type PathEdgeValidationEligibility = z.infer<
  typeof PathEdgeValidationEligibilitySchema
>;
export type AttackPathValidationPlanOverallStatus = z.infer<
  typeof AttackPathValidationPlanOverallStatusSchema
>;
export type AttackPathEdgePlanItem = z.infer<
  typeof AttackPathEdgePlanItemSchema
>;
export type AttackPathValidationPlan = z.infer<
  typeof AttackPathValidationPlanSchema
>;
export type PathEdgeReceipt = z.infer<typeof PathEdgeReceiptSchema>;
export type AttackPathMeasurementState = z.infer<
  typeof AttackPathMeasurementStateSchema
>;
export type ApplyPathEdgeReceiptInput = z.infer<
  typeof ApplyPathEdgeReceiptInputSchema
>;
export type ApplyPathEdgeReceiptResult = z.infer<
  typeof ApplyPathEdgeReceiptResultSchema
>;
export type LaunchPathEdgeValidationInput = z.infer<
  typeof LaunchPathEdgeValidationInputSchema
>;
export type PathEdgeValidationLaunchResult = z.infer<
  typeof PathEdgeValidationLaunchResultSchema
>;
export type RiskFactor = z.infer<typeof RiskFactorSchema>;
export type RiskScoreInput = z.infer<typeof RiskScoreInputSchema>;
export type RiskScore = z.infer<typeof RiskScoreSchema>;
export type AttackPathAssessment = z.infer<typeof AttackPathAssessmentSchema>;
export type AttackPathChokePoint = z.infer<typeof AttackPathChokePointSchema>;
export type AttackPathChokePointAnalysis = z.infer<
  typeof AttackPathChokePointAnalysisSchema
>;
export type VerifyAttackPathInput = z.infer<typeof VerifyAttackPathInputSchema>;
export type AttackPathVerificationRequest = z.infer<
  typeof AttackPathVerificationRequestSchema
>;
export type ValidatedFinding = z.infer<typeof ValidatedFindingSchema>;
export type ValidatedFindingFilter = z.infer<
  typeof ValidatedFindingFilterSchema
>;
export type ValidatedFindingSourceMotion = z.infer<
  typeof ValidatedFindingSourceMotionSchema
>;
export type ValidatedFindingStatus = z.infer<
  typeof ValidatedFindingStatusSchema
>;
export type ValidatedFindingMissingSignalImpact = z.infer<
  typeof ValidatedFindingMissingSignalImpactSchema
>;
export type ExploitabilityState = z.infer<typeof ExploitabilityStateSchema>;
export type ValidationSnapshotMetrics = z.infer<
  typeof ValidationSnapshotMetricsSchema
>;
export type ValidationSnapshotSummary = z.infer<
  typeof ValidationSnapshotSummarySchema
>;
export type ValidationSnapshot = z.infer<typeof ValidationSnapshotSchema>;
export type RemediationTask = z.infer<typeof RemediationTaskSchema>;
export type CreateRemediationInput = z.infer<
  typeof CreateRemediationInputSchema
>;
export type CreateRemediationTicketInput = z.infer<
  typeof CreateRemediationTicketInputSchema
>;
export type SyncRemediationTicketInput = z.infer<
  typeof SyncRemediationTicketInputSchema
>;
export type RemediationTicketResult = z.infer<typeof RemediationTicketSchema>;
export type RemediationTicketStateResult = z.infer<
  typeof RemediationTicketStateSchema
>;
export type RemediationAction = z.infer<typeof RemediationActionSchema>;
export type RemediationActionManifest = z.infer<
  typeof RemediationActionManifestSchema
>;
export type PreviewRemediationActionInput = z.infer<
  typeof PreviewRemediationActionInputSchema
>;
export type ConfirmRemediationActionInput = z.infer<
  typeof ConfirmRemediationActionInputSchema
>;
export type InfrastructureChangeState = z.infer<
  typeof InfrastructureChangeStateSchema
>;
export type InfrastructureChangeManifest = z.infer<
  typeof InfrastructureChangeManifestSchema
>;
export type InfrastructureChangeRequest = z.infer<
  typeof InfrastructureChangeRequestSchema
>;
export type PreviewInfrastructureChangeInput = z.infer<
  typeof PreviewInfrastructureChangeInputSchema
>;
export type ConfirmInfrastructureChangeInput = z.infer<
  typeof ConfirmInfrastructureChangeInputSchema
>;
export type MitigationStep = z.infer<typeof MitigationStepSchema>;
export type PrescriptivePlan = z.infer<typeof PrescriptivePlanSchema>;
export type VerificationEvent = z.infer<typeof VerificationEventSchema>;
export type ThreatAdvisory = z.infer<typeof ThreatAdvisorySchema>;
export type ThreatPackage = z.infer<typeof ThreatPackageSchema>;
export type MissingSignal = z.infer<typeof MissingSignalSchema>;
export type AdvisoryImpactAssessment = z.infer<
  typeof AdvisoryImpactAssessmentSchema
>;
export type ThreatValidationPlanItem = z.infer<
  typeof ThreatValidationPlanItemSchema
>;
export type ThreatValidationPlan = z.infer<typeof ThreatValidationPlanSchema>;
export type AdvisoryReadinessReport = z.infer<
  typeof AdvisoryReadinessReportSchema
>;
export type ThreatAdvisoryDetail = z.infer<typeof ThreatAdvisoryDetailSchema>;
export type ImportThreatAdvisoryInput = z.infer<
  typeof ImportThreatAdvisoryInputSchema
>;
export type EvidencePack = z.infer<typeof EvidencePackSchema>;
export type ReportShareGrant = z.infer<typeof ReportShareGrantSchema>;
export type ReportShareLink = z.infer<typeof ReportShareLinkSchema>;
export type ReportExportFormat = z.infer<typeof ReportExportFormatSchema>;
export type UsageMeterName = z.infer<typeof UsageMeterNameSchema>;
export type UsageMeter = z.infer<typeof UsageMeterSchema>;
export type UsageMeterDefinition = z.infer<typeof UsageMeterDefinitionSchema>;
export type BillingPackage = z.infer<typeof BillingPackageSchema>;
export type BillingPackageKey = z.infer<typeof BillingPackageKeySchema>;
export type BillingUsage = z.infer<typeof BillingUsageSchema>;
export type TrialStatus = z.infer<typeof TrialStatusSchema>;
export type StartTenantTrialInput = z.input<typeof StartTenantTrialInputSchema>;
export type ConvertTenantTrialInput = z.infer<
  typeof ConvertTenantTrialInputSchema
>;
export type CancelTenantTrialInput = z.infer<
  typeof CancelTenantTrialInputSchema
>;
export type TenantTrial = z.infer<typeof TenantTrialSchema>;
export type ComplianceFrameworkKey = z.infer<
  typeof ComplianceFrameworkKeySchema
>;
export type ComplianceSignoffStatus = z.infer<
  typeof ComplianceSignoffStatusSchema
>;
export type UpdateComplianceControlGovernanceInput = z.input<
  typeof UpdateComplianceControlGovernanceInputSchema
>;
export type ComplianceControlGovernance = z.infer<
  typeof ComplianceControlGovernanceSchema
>;
export type ComplianceGovernanceInventory = z.infer<
  typeof ComplianceGovernanceInventorySchema
>;
export type ComplianceGovernanceChange = z.infer<
  typeof ComplianceGovernanceChangeSchema
>;
export type ComplianceFrameworkGovernanceSummary = z.infer<
  typeof ComplianceFrameworkGovernanceSummarySchema
>;
export type ComplianceGovernanceMultiFrameworkSummary = z.infer<
  typeof ComplianceGovernanceMultiFrameworkSummarySchema
>;
export type BatchComplianceGovernanceInput = z.input<
  typeof BatchComplianceGovernanceInputSchema
>;
export type BatchComplianceGovernanceResult = z.infer<
  typeof BatchComplianceGovernanceResultSchema
>;
export type MultiFrameworkComplianceExportInput = z.input<
  typeof MultiFrameworkComplianceExportInputSchema
>;
export type MultiFrameworkComplianceExportResult = z.infer<
  typeof MultiFrameworkComplianceExportResultSchema
>;
export type TenantIsolationProofControl = z.infer<
  typeof TenantIsolationProofControlSchema
>;
export type TenantIsolationProof = z.infer<typeof TenantIsolationProofSchema>;

// Provider-agnostic entitlement checks (no payment SDK). These are the decision
// boundary a server-side enforcement guard calls: a capability/meter is entitled
// only when the tenant's active package explicitly includes it. A null package
// (no active subscription) is entitled to nothing. measured≠assumed: entitlement
// is derived from the package's declared inclusions, never inferred.
export function isCapabilityEntitled(
  pkg: BillingPackage | null | undefined,
  capability: string
): boolean {
  return pkg?.includedCapabilities.includes(capability) ?? false;
}

export function isMeterEntitled(
  pkg: BillingPackage | null | undefined,
  meterName: UsageMeterName
): boolean {
  return pkg?.includedMeterNames.includes(meterName) ?? false;
}

export interface EntitlementDecision {
  entitled: boolean;
  reason: string;
}

// Decision-object form (mirrors the policy-decision shape) for an action gated
// by a required capability. Used by the enforcement guard so denials are
// explainable + auditable.
export function evaluateCapabilityEntitlement(input: {
  package: BillingPackage | null | undefined;
  requiredCapability: string;
}): EntitlementDecision {
  if (!input.package) {
    return {
      entitled: false,
      reason: "No active subscription package for this tenant."
    };
  }
  if (!input.package.includedCapabilities.includes(input.requiredCapability)) {
    return {
      entitled: false,
      reason: `The ${input.package.label} package does not include "${input.requiredCapability}".`
    };
  }

  return {
    entitled: true,
    reason: `Included in the ${input.package.label} package.`
  };
}
export type ExecutiveTrendDirection = z.infer<
  typeof ExecutiveTrendDirectionSchema
>;
export type ExecutiveTrendMetric = z.infer<typeof ExecutiveTrendMetricSchema>;
export type RemediationVelocitySummary = z.infer<
  typeof RemediationVelocitySummarySchema
>;
export type ProofDeliverySummary = z.infer<typeof ProofDeliverySummarySchema>;
export type ExecutiveTrendSummary = z.infer<typeof ExecutiveTrendSummarySchema>;
export type ExecutiveTrendSeriesPoint = z.infer<
  typeof ExecutiveTrendSeriesPointSchema
>;
export type ExecutiveTrendSeriesMetric = z.infer<
  typeof ExecutiveTrendSeriesMetricSchema
>;
export type ExecutiveTrendSeries = z.infer<typeof ExecutiveTrendSeriesSchema>;
export type OperationalMetricsWindow = z.infer<
  typeof OperationalMetricsWindowSchema
>;
export type MissionStartLatencyEvent = z.infer<
  typeof MissionStartLatencyEventSchema
>;
export type MissionStartLatencySummary = z.infer<
  typeof MissionStartLatencySummarySchema
>;
export type PolicyDenialEvent = z.infer<typeof PolicyDenialEventSchema>;
export type PolicyDenialSummary = z.infer<typeof PolicyDenialSummarySchema>;
export type ConnectorSyncTimingEvent = z.infer<
  typeof ConnectorSyncTimingEventSchema
>;
export type ConnectorSyncTimingSummary = z.infer<
  typeof ConnectorSyncTimingSummarySchema
>;
export type TenantOperationalMetrics = z.infer<
  typeof TenantOperationalMetricsSchema
>;
export type ClientPortfolioReadinessStatus = z.infer<
  typeof ClientPortfolioReadinessStatusSchema
>;
export type ClientPortfolioCoverage = z.infer<
  typeof ClientPortfolioCoverageSchema
>;
export type ClientPortfolioRiskBreakdown = z.infer<
  typeof ClientPortfolioRiskBreakdownSchema
>;
export type ClientPortfolioLatestActivity = z.infer<
  typeof ClientPortfolioLatestActivitySchema
>;
export type ClientPortfolioSummary = z.infer<
  typeof ClientPortfolioSummarySchema
>;
export type MSSPClientPortfolioTotals = z.infer<
  typeof MSSPClientPortfolioTotalsSchema
>;
export type MSSPClientPortfolio = z.infer<typeof MSSPClientPortfolioSchema>;
export type PolicyDecision = z.infer<typeof PolicyDecisionSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;
export type AuditEventFilter = z.infer<typeof AuditEventFilterSchema>;
export type Job = z.infer<typeof JobSchema>;
export type MissionSchedule = z.infer<typeof MissionScheduleSchema>;
export type ScheduleFrequency = z.infer<typeof ScheduleFrequencySchema>;
export type ScheduleBlackoutWindow = z.infer<
  typeof ScheduleBlackoutWindowSchema
>;
export type ScheduleTiming = z.infer<typeof ScheduleTimingSchema>;
export type CreateMissionScheduleInput = z.input<
  typeof CreateMissionScheduleInputSchema
>;
export type UpdateMissionScheduleInput = z.input<
  typeof UpdateMissionScheduleInputSchema
>;
export type ScheduleStatus = z.infer<typeof ScheduleStatusSchema>;
export type ScheduleDiffStatus = z.infer<typeof ScheduleDiffStatusSchema>;
export type ScheduleDiff = z.infer<typeof ScheduleDiffSchema>;
export type ScheduledRunResult = z.infer<typeof ScheduledRunResultSchema>;
export type DueScheduleRunSummary = z.infer<typeof DueScheduleRunSummarySchema>;
export type SignalTriggerType = z.infer<typeof SignalTriggerTypeSchema>;
export type SignalTriggerEvaluationStatus = z.infer<
  typeof SignalTriggerEvaluationStatusSchema
>;
export type SignalTriggerRule = z.infer<typeof SignalTriggerRuleSchema>;
export type SignalTriggerEvaluation = z.infer<
  typeof SignalTriggerEvaluationSchema
>;
export type SignalTriggerActivity = z.infer<typeof SignalTriggerActivitySchema>;
export type SignalTriggerEvaluationSummary = z.infer<
  typeof SignalTriggerEvaluationSummarySchema
>;
export type SignalTriggerEvaluationResponse = z.infer<
  typeof SignalTriggerEvaluationResponseSchema
>;
export type SignalTriggerRoutingDecision = z.infer<
  typeof SignalTriggerRoutingDecisionSchema
>;
export type SignalTriggerApprovalResponse = z.infer<
  typeof SignalTriggerApprovalResponseSchema
>;
export type ValidationJobPayload = z.infer<typeof ValidationJobPayloadSchema>;
export type ModelGatewayTurnJobPayload = z.infer<
  typeof ModelGatewayTurnJobPayloadSchema
>;
export type CTEMStage = z.infer<typeof CTEMStageSchema>;
export type CTEMStageSummary = z.infer<typeof CTEMStageSummarySchema>;
export type CTEMProgramSummary = z.infer<typeof CTEMProgramSummarySchema>;

export type TenantType = z.infer<typeof TenantTypeSchema>;
export type UserStatus = z.infer<typeof UserStatusSchema>;
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;
export type ScopeType = z.infer<typeof ScopeTypeSchema>;
export type ScopeVerificationStatus = z.infer<
  typeof ScopeVerificationStatusSchema
>;
export type IntegrationCategory = z.infer<typeof IntegrationCategorySchema>;
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;
export type IntegrationHealthStatus = z.infer<
  typeof IntegrationHealthStatusSchema
>;
export type IntegrationImplementationTier = z.infer<
  typeof IntegrationImplementationTierSchema
>;
export type IntegrationExecutionReadiness = z.infer<
  typeof IntegrationExecutionReadinessSchema
>;
export type ValidationState = z.infer<typeof ValidationStateSchema>;
export type ControlState = z.infer<typeof ControlStateSchema>;
export type RemediationStatus = z.infer<typeof RemediationStatusSchema>;
export type RiskBand = z.infer<typeof RiskBandSchema>;
export type SafetyLevel = z.infer<typeof SafetyLevelSchema>;
export type RunMode = z.infer<typeof RunModeSchema>;

// Autonomous engagement: a governed, multi-step orchestration over a verified
// scope. Every step is dispatched through the standard governed path
// (executeInlineValidation / signed runner task) — the engagement layer never
// executes a tool directly. PlanOnly returns the plan without executing.
export const EngagementModeSchema = z.enum(["PlanOnly", "Execute"]);

export const ScenarioBranchPredicateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("Always") }),
  z.object({
    allowedStatuses: z
      .array(z.enum(["executed", "denied", "failed", "skipped"]))
      .min(1)
      .default(["executed"]),
    kind: z.literal("PriorStep"),
    minimumEvidenceCount: z.number().int().nonnegative().default(0),
    minimumSignalCount: z.number().int().nonnegative().default(0),
    stepId: z.string().min(1),
    validationStates: z.array(ValidationStateSchema).default([])
  })
]);

export const ScenarioBundleStepSchema = z.object({
  dependsOn: z.array(z.string().min(1)).default([]),
  expectedObservations: z.array(z.string().min(1)).default([]),
  moduleId: z.string().min(1),
  name: z.string().min(1),
  stepId: z.string().min(1),
  target: z.record(z.string(), z.unknown()).default({}),
  when: ScenarioBranchPredicateSchema.default({ kind: "Always" })
});

export const ScenarioBundleSignatureSchema = z.object({
  algorithm: z.literal("EdDSA"),
  digestSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  keyId: z.string().min(1),
  signature: z.string().min(1)
});

export const ScenarioFeedbackStatusSchema = z.enum([
  "Idle",
  "Running",
  "Completed",
  "Failed",
  "Stopped",
  "Exhausted"
]);

export const ScenarioBundleSchema = TenantScopedEntitySchema.extend({
  allowedScopeTypes: z.array(ScopeTypeSchema).min(1),
  approvedAt: TimestampSchema.nullish(),
  approvedBy: IdSchema.nullish(),
  bundleVersion: z.number().int().positive(),
  compiledAt: TimestampSchema,
  compiledHash: z.string().regex(/^[a-f0-9]{64}$/u),
  description: z.string().min(1),
  expectedObservations: z.array(z.string().min(1)).default([]),
  feedbackCycleCount: z.number().int().nonnegative().default(0),
  feedbackFailedCycleCount: z.number().int().nonnegative().default(0),
  feedbackLastCompletedAt: TimestampSchema.nullish(),
  feedbackLastError: z.string().min(1).nullish(),
  feedbackLastReason: z.string().min(1).nullish(),
  feedbackLastReviewReference: z.string().min(1).nullish(),
  feedbackLastStartedAt: TimestampSchema.nullish(),
  feedbackLastStatus: ScenarioFeedbackStatusSchema.default("Idle"),
  feedbackStopReason: z.string().min(1).nullish(),
  feedbackStopReviewReference: z.string().min(1).nullish(),
  feedbackStoppedAt: TimestampSchema.nullish(),
  feedbackStoppedBy: IdSchema.nullish(),
  intent: z.string().min(3).max(2000),
  legalClassification: z.enum([
    "PassiveAuthorized",
    "ControlledAuthorized",
    "IsolatedLabOnly"
  ]),
  maximumIterations: z.number().int().min(1).max(20),
  name: z.string().min(1),
  prerequisites: z.array(z.string().min(1)).default([]),
  safetyCeiling: SafetyLevelSchema,
  sbom: z.array(
    z.object({
      executionMode: ExecutionEnvironmentSchema,
      moduleId: z.string().min(1),
      safetyLevel: SafetyLevelSchema,
      version: z.string().min(1)
    })
  ),
  scenarioBundleId: IdSchema,
  scopeId: IdSchema,
  signature: ScenarioBundleSignatureSchema,
  source: z.object({
    kind: z.enum(["OperatorIntent", "ReviewedImport", "ThreatMapping"]),
    reference: z.string().min(1).nullish()
  }),
  status: z.enum(["Draft", "Approved", "Revoked", "Deprecated"]),
  steps: z.array(ScenarioBundleStepSchema).min(1).max(20),
  techniqueIds: z.array(z.string().min(1)).default([])
});

export const CompileScenarioInputSchema = z.object({
  intent: z.string().trim().min(3).max(2000),
  maximumIterations: z.number().int().min(1).max(20).default(3),
  maximumSteps: z.number().int().min(1).max(12).default(6),
  scopeId: IdSchema,
  techniqueIds: z.array(z.string().min(1)).max(20).default([])
});

export const CompileScenarioResponseSchema = z.object({
  bundle: ScenarioBundleSchema,
  preview: z.object({
    branchCount: z.number().int().nonnegative(),
    compiledHash: z.string().regex(/^[a-f0-9]{64}$/u),
    executable: z.literal(false),
    moduleCount: z.number().int().positive(),
    nextStep: z.literal("ApproveScenarioBundle")
  })
});

export const ExecuteScenarioInputSchema = z.object({
  compiledHash: z.string().regex(/^[a-f0-9]{64}$/u),
  expectedFeedbackCycleCount: z.number().int().nonnegative().optional(),
  reason: z
    .string()
    .trim()
    .min(12)
    .max(1000)
    .default("Run the next approved feedback cycle."),
  reviewReference: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .default("scenario-execution")
});

export const StopScenarioFeedbackInputSchema = z.object({
  expectedFeedbackCycleCount: z.number().int().nonnegative(),
  reason: z.string().trim().min(12).max(1000),
  reviewReference: z.string().trim().min(3).max(200)
});

export const EngagementStepRequestSchema = z.object({
  dependsOn: z.array(z.string().min(1)).default([]),
  moduleId: z.string().min(1),
  stepId: z.string().min(1).optional(),
  target: z.record(z.string(), z.unknown()).default({}),
  when: ScenarioBranchPredicateSchema.default({ kind: "Always" })
});

export const EngagementRunRequestSchema = z.object({
  approvalId: z.string().trim().min(1).max(2000).nullish(),
  authorizedOffensive: z.boolean().default(false),
  mode: EngagementModeSchema.default("Execute"),
  plan: z.array(EngagementStepRequestSchema).default([]),
  compiledHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/u)
    .nullish(),
  scenarioBundleId: IdSchema.nullish(),
  scopeId: IdSchema
});

export const EngagementStepStatusSchema = z.enum([
  "planned",
  "executed",
  "denied",
  "failed",
  "skipped"
]);

export const EngagementStepResultSchema = z.object({
  branchDecision: z
    .object({
      evidence: z.array(z.string().min(1)).default([]),
      matched: z.boolean(),
      predicate: ScenarioBranchPredicateSchema
    })
    .nullish(),
  evidenceIds: IdListSchema.default([]),
  moduleId: z.string().min(1),
  reason: z.string().min(1).nullish(),
  runId: IdSchema.nullish(),
  runMode: RunModeSchema,
  signalCount: z.number().int().nonnegative().default(0),
  status: EngagementStepStatusSchema,
  stepId: z.string().min(1).nullish(),
  validationState: ValidationStateSchema.nullish()
});

export const EngagementResultSchema = z.object({
  approvalId: z.string().min(1).nullable().default(null),
  engagementId: IdSchema,
  evidenceIds: IdListSchema.default([]),
  feedbackCycleNumber: z.number().int().positive().nullable().default(null),
  compiledHash: z
    .string()
    .regex(/^[a-f0-9]{64}$/u)
    .nullable()
    .default(null),
  generatedAt: TimestampSchema,
  mode: EngagementModeSchema,
  scenarioBundleId: IdSchema.nullable().default(null),
  scopeId: IdSchema,
  status: z.enum(["Planned", "Completed", "Denied", "Empty"]),
  steps: z.array(EngagementStepResultSchema),
  tenantId: IdSchema
});

export const ScenarioExecutionResultSchema = z.object({
  bundle: ScenarioBundleSchema,
  engagement: EngagementResultSchema,
  feedback: z.object({
    cycleNumber: z.number().int().positive(),
    maximumIterations: z.number().int().positive(),
    reason: z.string().min(1),
    remainingIterations: z.number().int().nonnegative(),
    reviewReference: z.string().min(1),
    status: ScenarioFeedbackStatusSchema
  }),
  integrity: z.object({
    compiledHash: z.string().regex(/^[a-f0-9]{64}$/u),
    executionMatchedPreview: z.literal(true)
  })
});

export type EngagementMode = z.infer<typeof EngagementModeSchema>;
export type ScenarioBranchPredicate = z.infer<
  typeof ScenarioBranchPredicateSchema
>;
export type ScenarioBundleStep = z.infer<typeof ScenarioBundleStepSchema>;
export type ScenarioBundle = z.infer<typeof ScenarioBundleSchema>;
export type CompileScenarioInput = z.infer<typeof CompileScenarioInputSchema>;
export type CompileScenarioResponse = z.infer<
  typeof CompileScenarioResponseSchema
>;
export type ExecuteScenarioInput = z.infer<typeof ExecuteScenarioInputSchema>;
export type StopScenarioFeedbackInput = z.infer<
  typeof StopScenarioFeedbackInputSchema
>;
export type ScenarioFeedbackStatus = z.infer<
  typeof ScenarioFeedbackStatusSchema
>;
export type ScenarioExecutionResult = z.infer<
  typeof ScenarioExecutionResultSchema
>;
export type EngagementRunRequest = z.infer<typeof EngagementRunRequestSchema>;
export type EngagementStepResult = z.infer<typeof EngagementStepResultSchema>;
export type EngagementResult = z.infer<typeof EngagementResultSchema>;
export type SignalCategory = z.infer<typeof SignalCategorySchema>;
export type SensitivityLevel = z.infer<typeof SensitivityLevelSchema>;
export type RedactionStatus = z.infer<typeof RedactionStatusSchema>;
export type AssetType = z.infer<typeof AssetTypeSchema>;
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type BusinessCriticality = z.infer<typeof BusinessCriticalitySchema>;
export type IdentityType = z.infer<typeof IdentityTypeSchema>;
export type MFAStatus = z.infer<typeof MFAStatusSchema>;
export type PrivilegeLevel = z.infer<typeof PrivilegeLevelSchema>;
export type ControlSourceType = z.infer<typeof ControlSourceTypeSchema>;
export type AIApplicationType = z.infer<typeof AIApplicationTypeSchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type ExposureStatus = z.infer<typeof ExposureStatusSchema>;
export type ScenarioType = z.infer<typeof ScenarioTypeSchema>;
export type MissionType = z.infer<typeof MissionTypeSchema>;
export type MissionStatus = z.infer<typeof MissionStatusSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type EvidenceArtifactType = z.infer<typeof EvidenceArtifactTypeSchema>;
export type RelatedEntityType = z.infer<typeof RelatedEntityTypeSchema>;
export type EdgeRelationship = z.infer<typeof EdgeRelationshipSchema>;
export type VerificationOutcome = z.infer<typeof VerificationOutcomeSchema>;
export type EvidencePackType = z.infer<typeof EvidencePackTypeSchema>;
export type EvidencePackStatus = z.infer<typeof EvidencePackStatusSchema>;
export type PolicyDecisionOutcome = z.infer<typeof PolicyDecisionOutcomeSchema>;
export type ApprovalState = z.infer<typeof ApprovalStateSchema>;
export type ExecutionEnvironment = z.infer<typeof ExecutionEnvironmentSchema>;
export type PolicyRequestedAction = z.infer<typeof PolicyRequestedActionSchema>;
export type AuditEventAction = z.infer<typeof AuditEventActionSchema>;
export type TenantApiKey = z.infer<typeof TenantApiKeySchema>;
export type TenantApiKeyWithSecret = z.infer<
  typeof TenantApiKeyWithSecretSchema
>;
export type CreateTenantApiKeyInput = z.infer<
  typeof CreateTenantApiKeyInputSchema
>;
export type WebhookEventType = z.infer<typeof WebhookEventTypeSchema>;
export type WebhookEventDataSummary = z.infer<
  typeof WebhookEventDataSummarySchema
>;
export type WebhookEventCatalog = z.infer<typeof WebhookEventCatalogSchema>;
export type WebhookDeliveryStatus = z.infer<typeof WebhookDeliveryStatusSchema>;
export type TenantWebhook = z.infer<typeof TenantWebhookSchema>;
export type TenantWebhookWithSecret = z.infer<
  typeof TenantWebhookWithSecretSchema
>;
export type WebhookDelivery = z.infer<typeof WebhookDeliverySchema>;
export type CreateTenantWebhookInput = z.infer<
  typeof CreateTenantWebhookInputSchema
>;
export type UpdateTenantWebhookInput = z.infer<
  typeof UpdateTenantWebhookInputSchema
>;

export type ModelProviderType = z.infer<typeof ModelProviderTypeSchema>;
export type ModelPrecisionMode = z.infer<typeof ModelPrecisionModeSchema>;
export type ModelServingCapabilities = z.infer<
  typeof ModelServingCapabilitiesSchema
>;
export type ModelDeploymentType = z.infer<typeof ModelDeploymentTypeSchema>;
export type ModelProviderStatus = z.infer<typeof ModelProviderStatusSchema>;
export type ModelSessionMode = z.infer<typeof ModelSessionModeSchema>;
export type ModelSessionStatus = z.infer<typeof ModelSessionStatusSchema>;
export type ModelToolRequestStatus = z.infer<
  typeof ModelToolRequestStatusSchema
>;
export type ModelGatewayEventType = z.infer<typeof ModelGatewayEventTypeSchema>;
export type ModelToolSafetyClass = z.infer<typeof ModelToolSafetyClassSchema>;
export type ModelProvider = z.infer<typeof ModelProviderSchema>;
export type CreateModelProviderInput = z.infer<
  typeof CreateModelProviderInputSchema
>;
export type UpdateModelProviderInput = z.infer<
  typeof UpdateModelProviderInputSchema
>;
export type ModelProviderConnectionTestResult = z.infer<
  typeof ModelProviderConnectionTestResultSchema
>;
export type ModelPolicyProfile = z.infer<typeof ModelPolicyProfileSchema>;
export type CreateModelPolicyProfileInput = z.infer<
  typeof CreateModelPolicyProfileInputSchema
>;
export type UpdateModelPolicyProfileInput = z.infer<
  typeof UpdateModelPolicyProfileInputSchema
>;
export type ModelSession = z.infer<typeof ModelSessionSchema>;
export type CreateModelSessionInput = z.infer<
  typeof CreateModelSessionInputSchema
>;
export type ContextBundleItem = z.infer<typeof ContextBundleItemSchema>;
export type ContextPruningManifest = z.infer<
  typeof ContextPruningManifestSchema
>;
export type ContextBundle = z.infer<typeof ContextBundleSchema>;
export type CreateContextBundleInput = z.infer<
  typeof CreateContextBundleInputSchema
>;
export type ModelToolDefinition = z.infer<typeof ModelToolDefinitionSchema>;
export type ModelTool = z.infer<typeof ModelToolSchema>;
export type UpdateModelToolInput = z.infer<typeof UpdateModelToolInputSchema>;
export type ModelToolResult = z.infer<typeof ModelToolResultSchema>;
export type ModelToolRequest = z.infer<typeof ModelToolRequestSchema>;
export type CreateModelToolRequestInput = z.infer<
  typeof CreateModelToolRequestInputSchema
>;
export type ModelGatewayAuditEvent = z.infer<
  typeof ModelGatewayAuditEventSchema
>;
export type CreateModelSessionTurnInput = z.infer<
  typeof CreateModelSessionTurnInputSchema
>;
export type ModelSessionTurnAccepted = z.infer<
  typeof ModelSessionTurnAcceptedSchema
>;
export type ActivateKillSwitchInput = z.infer<
  typeof ActivateKillSwitchInputSchema
>;
export type KillSwitchResult = z.infer<typeof KillSwitchResultSchema>;
