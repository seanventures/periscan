/**
 * P09-13 — RelatedEntityType partitions
 * -------------------------------------
 * RelatedEntityType grew into a universal type system (risk inventory + platform
 * marketplace + model gateway + tool promotion). That is not a type theory:
 * graph/evidence coordinates must not dilute into webhooks and promotion packages.
 *
 * Split:
 * - RiskRelatedEntityType — security/risk ontology (graph, paths, findings)
 * - PlatformRelatedEntityType — control-plane / marketplace / ops entities
 *
 * RelatedEntityType remains the union for audit links and polymorphic FK bags.
 * GraphNode.relatedEntityType accepts only the risk subset.
 */

import { z } from "zod";

/** Risk / security ontology entities that may appear on the evidence graph. */
export const RISK_RELATED_ENTITY_TYPES = [
  "Scope",
  "Integration",
  "Asset",
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
  "Runner",
  "RunnerTask",
  "ThreatAdvisory",
  "ThreatPackage",
  "AdvisoryImpactAssessment",
  "MissingSignal",
  "ThreatValidationPlan",
  "ThreatValidationPlanItem",
  "AdvisoryReadinessReport",
  "ValidationStimulus",
  "OperatorRecommendation"
] as const;

/**
 * Platform / marketplace / control-plane entities. Valid for audit and
 * polymorphic product links, but not for GraphNode.relatedEntityType.
 */
export const PLATFORM_RELATED_ENTITY_TYPES = [
  "Tenant",
  "TenantWebhook",
  "AssetValuationVersion",
  "AuditEvent",
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
  "ScenarioBundle"
] as const;

export const RiskRelatedEntityTypeSchema = z.enum(RISK_RELATED_ENTITY_TYPES);
export const PlatformRelatedEntityTypeSchema = z.enum(
  PLATFORM_RELATED_ENTITY_TYPES
);

export type RiskRelatedEntityType = z.infer<typeof RiskRelatedEntityTypeSchema>;
export type PlatformRelatedEntityType = z.infer<
  typeof PlatformRelatedEntityTypeSchema
>;

const RISK_SET = new Set<string>(RISK_RELATED_ENTITY_TYPES);
const PLATFORM_SET = new Set<string>(PLATFORM_RELATED_ENTITY_TYPES);

export function isRiskRelatedEntityType(
  value: string
): value is RiskRelatedEntityType {
  return RISK_SET.has(value);
}

export function isPlatformRelatedEntityType(
  value: string
): value is PlatformRelatedEntityType {
  return PLATFORM_SET.has(value);
}

/**
 * Partition label for docs/lint. Unknown strings are "unknown" (not silently
 * risk) so writers cannot invent graph coordinates.
 */
export function relatedEntityPartition(
  value: string
): "risk" | "platform" | "unknown" {
  if (isRiskRelatedEntityType(value)) return "risk";
  if (isPlatformRelatedEntityType(value)) return "platform";
  return "unknown";
}
