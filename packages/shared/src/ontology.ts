/**
 * P11-18 — Ontology module (first-class product IP)
 * -------------------------------------------------
 * Palantir-shaped moat aligned with Periscan honesty — not a Foundry clone UI.
 *
 * Single governed registry for:
 * - object types (risk vs platform partitions)
 * - link types (edge relationships)
 * - allowed actions (create mission, approve, verify fix, …)
 * - claim predicates (when Measured is legal)
 * - UI href templates (honest deep-links only)
 * - graph node property shape hints
 *
 * OpenAPI tags / nav can import from here so new surfaces do not re-invent labels.
 */

import { z } from "zod";

import {
  EdgeRelationshipSchema,
  type EdgeRelationship
} from "./domain";
import {
  isRiskRelatedEntityType,
  RISK_RELATED_ENTITY_TYPES,
  type PlatformRelatedEntityType,
  type RiskRelatedEntityType
} from "./related-entity-partitions";
import { type OntologyLawId } from "./ontology-laws";
import {
  relatedEntityTypeToGraphNodeType,
  graphNodeTypeToRelatedEntityType
} from "./ontology-mapping";

const EDGE_RELATIONSHIP_VALUES = EdgeRelationshipSchema.options;

export const ONTOLOGY_MODULE_VERSION = "1.0.0" as const;

// ---------------------------------------------------------------------------
// Object type registry
// ---------------------------------------------------------------------------

export const OntologyObjectKindSchema = z.enum(["risk", "platform"]);
export type OntologyObjectKind = z.infer<typeof OntologyObjectKindSchema>;

export type OntologyObjectTypeDef = {
  type: RiskRelatedEntityType | PlatformRelatedEntityType;
  kind: OntologyObjectKind;
  /** Preferred operator label (one name per type). */
  label: string;
  /** OpenAPI / docs tag when surface-owned. */
  openApiTag: string | null;
  /** Primary product pillar for nav generation. */
  navGroup:
    | "missions"
    | "findings"
    | "assets"
    | "evidence"
    | "remediation"
    | "runners"
    | "integrations"
    | "admin"
    | "labs"
    | null;
  /** May appear as GraphNode.relatedEntityType. */
  graphEligible: boolean;
  /** Preferred GraphNode.nodeType bare family when graphEligible. */
  graphNodeType: string | null;
};

function riskDef(
  type: RiskRelatedEntityType,
  label: string,
  opts: Partial<Omit<OntologyObjectTypeDef, "type" | "kind" | "label">> = {}
): OntologyObjectTypeDef {
  const graphNodeType = relatedEntityTypeToGraphNodeType(type as never);
  return {
    type,
    kind: "risk",
    label,
    openApiTag: opts.openApiTag ?? null,
    navGroup: opts.navGroup ?? null,
    graphEligible: opts.graphEligible ?? true,
    graphNodeType: opts.graphNodeType ?? graphNodeType
  };
}

function platformDef(
  type: PlatformRelatedEntityType,
  label: string,
  opts: Partial<
    Pick<OntologyObjectTypeDef, "openApiTag" | "navGroup">
  > = {}
): OntologyObjectTypeDef {
  return {
    type,
    kind: "platform",
    label,
    openApiTag: opts.openApiTag ?? null,
    navGroup: opts.navGroup ?? "admin",
    graphEligible: false,
    graphNodeType: null
  };
}

/** Governed object type catalog (risk + platform). */
export const ONTOLOGY_OBJECT_TYPES: OntologyObjectTypeDef[] = [
  riskDef("Asset", "Asset", { navGroup: "assets", openApiTag: "assets" }),
  riskDef("Identity", "Identity", { navGroup: "assets" }),
  riskDef("NonHumanIdentity", "Non-human identity", { navGroup: "assets" }),
  riskDef("Exposure", "Exposure", { navGroup: "findings", openApiTag: "findings" }),
  riskDef("AttackPath", "Attack path", {
    navGroup: "findings",
    openApiTag: "attack-paths"
  }),
  riskDef("RemediationTask", "Remediation", {
    navGroup: "remediation",
    openApiTag: "remediation"
  }),
  riskDef("RemediationAction", "Remediation action", { navGroup: "remediation" }),
  riskDef("VerificationEvent", "Verification event", { navGroup: "remediation" }),
  riskDef("EvidencePack", "Evidence pack", {
    navGroup: "evidence",
    openApiTag: "evidence"
  }),
  riskDef("ValidationMission", "Mission", {
    navGroup: "missions",
    openApiTag: "missions"
  }),
  riskDef("ValidationRun", "Validation run", { navGroup: "missions" }),
  riskDef("Scope", "Scope", { navGroup: "assets", graphEligible: true }),
  riskDef("ControlSource", "Control source", {
    navGroup: "integrations",
    openApiTag: "controls"
  }),
  riskDef("Integration", "Integration", {
    navGroup: "integrations",
    openApiTag: "integrations"
  }),
  riskDef("AIApplication", "AI application", {
    navGroup: "labs",
    openApiTag: "ai-apps"
  }),
  riskDef("Runner", "Runner", { navGroup: "runners", openApiTag: "runners" }),
  riskDef("RunnerTask", "Runner task", { navGroup: "runners" }),
  riskDef("ThreatAdvisory", "Threat advisory", {
    navGroup: "findings",
    openApiTag: "threat-center"
  }),
  riskDef("ThreatPackage", "Threat package", { navGroup: "findings" }),
  riskDef("Scenario", "Scenario", { navGroup: "labs" }),
  riskDef("MissingSignal", "Missing signal", { navGroup: "findings" }),
  riskDef("OperatorRecommendation", "Operator recommendation", {
    navGroup: "remediation"
  }),
  riskDef("AdvisoryImpactAssessment", "Advisory impact", { navGroup: "findings" }),
  riskDef("ThreatValidationPlan", "Threat validation plan", {
    navGroup: "missions"
  }),
  riskDef("ThreatValidationPlanItem", "Threat validation plan item", {
    navGroup: "missions"
  }),
  riskDef("AdvisoryReadinessReport", "Advisory readiness", {
    navGroup: "findings"
  }),
  riskDef("ComplianceControlGovernance", "Control governance", {
    navGroup: "integrations"
  }),
  riskDef("ValidationStimulus", "Validation stimulus", { navGroup: "missions" }),

  platformDef("Tenant", "Tenant"),
  platformDef("TenantWebhook", "Webhook", { openApiTag: "webhooks" }),
  platformDef("AssetValuationVersion", "Asset valuation version"),
  platformDef("AuditEvent", "Audit event", { openApiTag: "audit" }),
  platformDef("ThirdPartyTool", "Third-party tool", { openApiTag: "registry" }),
  platformDef("ThirdPartyToolCandidate", "Tool candidate"),
  platformDef(
    "ThirdPartyToolImplementationWorkOrder",
    "Tool implementation work order"
  ),
  platformDef("ThirdPartyToolPromotionPackage", "Tool promotion package"),
  platformDef(
    "ThirdPartyToolPromotionCertification",
    "Tool promotion certification"
  ),
  platformDef(
    "ThirdPartyToolUpstreamVersionCheck",
    "Tool upstream version check"
  ),
  platformDef("ThirdPartyToolUpdateRecommendation", "Tool update recommendation"),
  platformDef("ToolLicenseAcceptance", "Tool license acceptance"),
  platformDef("ModelProvider", "Model provider", { openApiTag: "model-gateway" }),
  platformDef("ModelPolicyProfile", "Model policy profile"),
  platformDef("ModelSession", "Model session"),
  platformDef("ModelToolRequest", "Model tool request"),
  platformDef("Engagement", "Engagement", { navGroup: "labs" }),
  platformDef("ScenarioBundle", "Scenario bundle", { navGroup: "labs" })
];

const OBJECT_TYPE_BY_NAME = new Map(
  ONTOLOGY_OBJECT_TYPES.map((row) => [row.type, row] as const)
);

export function getOntologyObjectType(
  type: string
): OntologyObjectTypeDef | undefined {
  return OBJECT_TYPE_BY_NAME.get(type as never);
}

export function listGraphEligibleObjectTypes(): OntologyObjectTypeDef[] {
  return ONTOLOGY_OBJECT_TYPES.filter((row) => row.graphEligible);
}

// ---------------------------------------------------------------------------
// Link types
// ---------------------------------------------------------------------------

export type OntologyLinkTypeDef = {
  relationship: EdgeRelationship;
  label: string;
  /** Whether hop certainty (Measured/Heuristic) applies. */
  carriesHopCertainty: boolean;
};

export const ONTOLOGY_LINK_TYPES: OntologyLinkTypeDef[] =
  EDGE_RELATIONSHIP_VALUES.map((relationship) => ({
    relationship,
    label: relationship.replaceAll("_", " ").toLowerCase(),
    carriesHopCertainty: [
      "CAN_ACCESS",
      "EXPOSES",
      "LEADS_TO",
      "VALIDATED_BY",
      "DETECTED_BY",
      "BLOCKED_BY",
      "MISSED_BY"
    ].includes(relationship)
  }));

// ---------------------------------------------------------------------------
// Allowed actions
// ---------------------------------------------------------------------------

export const OntologyActionIdSchema = z.enum([
  "create_mission",
  "approve_mission",
  "deny_mission",
  "queue_runner_task",
  "verify_fix",
  "approve_recommendation",
  "export_evidence_pack",
  "upsert_graph_node",
  "upsert_graph_edge",
  "import_scan_file",
  "rotate_runner_credentials",
  "activate_kill_switch"
]);

export type OntologyActionId = z.infer<typeof OntologyActionIdSchema>;

export type OntologyActionDef = {
  id: OntologyActionId;
  label: string;
  /** Object types this action may target. */
  targetTypes: readonly string[];
  /** Required ontology laws that must hold. */
  requiresLaws: readonly OntologyLawId[];
  /** Policy decision required before queue/side effects. */
  requiresPolicyDecision: boolean;
};

export const ONTOLOGY_ACTIONS: OntologyActionDef[] = [
  {
    id: "create_mission",
    label: "Create mission",
    targetTypes: ["Scope", "AttackPath", "Exposure", "AIApplication"],
    requiresLaws: ["authorization"],
    requiresPolicyDecision: true
  },
  {
    id: "approve_mission",
    label: "Approve mission",
    targetTypes: ["ValidationMission"],
    requiresLaws: ["authorization"],
    requiresPolicyDecision: true
  },
  {
    id: "deny_mission",
    label: "Deny mission",
    targetTypes: ["ValidationMission"],
    requiresLaws: ["authorization"],
    requiresPolicyDecision: true
  },
  {
    id: "queue_runner_task",
    label: "Queue runner task",
    targetTypes: ["Runner", "ValidationRun"],
    requiresLaws: ["authorization"],
    requiresPolicyDecision: true
  },
  {
    id: "verify_fix",
    label: "Verify fix",
    targetTypes: ["RemediationTask", "AttackPath", "Exposure"],
    requiresLaws: ["authorization", "closure", "grounding"],
    requiresPolicyDecision: true
  },
  {
    id: "approve_recommendation",
    label: "Approve recommendation",
    targetTypes: ["OperatorRecommendation"],
    requiresLaws: ["authorization"],
    requiresPolicyDecision: true
  },
  {
    id: "export_evidence_pack",
    label: "Export evidence pack",
    targetTypes: ["EvidencePack", "AttackPath", "ValidationRun"],
    requiresLaws: ["grounding"],
    requiresPolicyDecision: false
  },
  {
    id: "upsert_graph_node",
    label: "Upsert graph node",
    targetTypes: RISK_RELATED_ENTITY_TYPES as unknown as string[],
    requiresLaws: ["grounding"],
    requiresPolicyDecision: false
  },
  {
    id: "upsert_graph_edge",
    label: "Upsert graph edge",
    targetTypes: ["AttackPath"],
    requiresLaws: ["weakest_link", "grounding"],
    requiresPolicyDecision: false
  },
  {
    id: "import_scan_file",
    label: "Import scan file",
    targetTypes: ["Integration", "Asset"],
    requiresLaws: ["grounding", "authorization"],
    requiresPolicyDecision: true
  },
  {
    id: "rotate_runner_credentials",
    label: "Rotate runner credentials",
    targetTypes: ["Runner"],
    requiresLaws: ["authorization"],
    requiresPolicyDecision: false
  },
  {
    id: "activate_kill_switch",
    label: "Activate kill switch",
    targetTypes: ["Runner"],
    requiresLaws: ["authorization"],
    requiresPolicyDecision: true
  }
];

export function getOntologyAction(
  id: OntologyActionId
): OntologyActionDef | undefined {
  return ONTOLOGY_ACTIONS.find((row) => row.id === id);
}

// ---------------------------------------------------------------------------
// Claim predicates — when Measured is legal
// ---------------------------------------------------------------------------

export type HopCertaintyInput = {
  evidenceBasis: "Measured" | "Heuristic";
  evidenceIds: readonly string[];
  measurementMethod?: string | null;
};

/**
 * Law 2 + Law 3: a hop may be Measured only with evidence ids and a method.
 * Severity never upgrades certainty — callers must not use this for scores.
 */
export function isMeasuredHopLegal(hop: HopCertaintyInput): boolean {
  if (hop.evidenceBasis !== "Measured") return true; // Heuristic always legal
  if (!hop.evidenceIds || hop.evidenceIds.length === 0) return false;
  if (!hop.measurementMethod || hop.measurementMethod.trim().length === 0) {
    return false;
  }
  return true;
}

/**
 * Path-level Measured claim is legal only when every hop is Measured and legal.
 */
export function isMeasuredPathClaimLegal(
  hops: readonly HopCertaintyInput[]
): boolean {
  if (hops.length === 0) return false;
  return hops.every(
    (hop) => hop.evidenceBasis === "Measured" && isMeasuredHopLegal(hop)
  );
}

export function pathWeakestEvidenceBasis(
  hops: readonly HopCertaintyInput[]
): "Measured" | "Heuristic" {
  if (hops.length === 0) return "Heuristic";
  return hops.every((h) => h.evidenceBasis === "Measured")
    ? "Measured"
    : "Heuristic";
}

// ---------------------------------------------------------------------------
// UI href templates (honest only) — single SoT for deep-links (P11R-3)
// ---------------------------------------------------------------------------

export type OntologyHrefTemplate = {
  type: string;
  /**
   * Build an href for the entity id, or null when no honest page exists.
   * Prefer real object pages; generic /objects/:type/:id is allowed for risk
   * types that lack a dedicated workbench (P11-7).
   */
  href: (id: string) => string | null;
};

export type OntologyEntityHrefFn = (id: string) => string;

/**
 * Dedicated routes with real pages. Single source of truth for operator
 * deep-links (P11R-3). Web `entity-routes` re-exports these — do not maintain
 * a parallel map. Asset primary product URL is `/assets` (P07-18).
 *
 * Includes product aliases used by audit/explorer that are not RelatedEntityType
 * members (Finding, ValidatedFinding, Signal, Evidence, schedules, threat feed).
 */
export const DEDICATED_HREF: Record<string, OntologyEntityHrefFn> = {
  AttackPath: (id) => `/attack-paths/${id}`,
  RemediationTask: (id) => `/remediation/${id}`,
  EvidencePack: () => "/reports",
  Evidence: (id) => `/evidence?evidenceId=${encodeURIComponent(id)}`,
  EvidenceArtifact: (id) => `/evidence?evidenceId=${encodeURIComponent(id)}`,
  ValidationMission: () => "/missions",
  ValidationRun: () => "/missions",
  AIApplication: () => "/ai-apps",
  ControlSource: () => "/controls",
  ThreatAdvisory: () => "/threat-center",
  Runner: () => "/runners",
  RunnerTask: () => "/runners",
  Integration: () => "/integrations",
  ThirdPartyTool: () => "/registries",
  // P07-18 / P11R-3: customer surface is Assets & Scope at /assets
  Asset: (id) =>
    id
      ? `/assets?assetId=${encodeURIComponent(id)}`
      : "/assets",
  Exposure: () => "/findings",
  Finding: (id) =>
    id ? `/findings?q=${encodeURIComponent(id)}` : "/findings",
  ValidatedFinding: (id) =>
    id ? `/findings?q=${encodeURIComponent(id)}` : "/findings",
  Signal: (id) =>
    id ? `/signal-activity?q=${encodeURIComponent(id)}` : "/signal-activity",
  SignalEnvelope: (id) =>
    id ? `/signal-activity?q=${encodeURIComponent(id)}` : "/signal-activity",
  OperatorRecommendation: () => "/operators",
  MissionSchedule: () => "/schedules",
  Schedule: () => "/schedules",
  TenantThreatAlert: () => "/threat-feed",
  ThreatAlert: () => "/threat-feed",
  Identity: () => "/non-human-identities",
  NonHumanIdentity: (id) =>
    id
      ? `/non-human-identities?id=${encodeURIComponent(id)}`
      : "/non-human-identities",
  AuditEvent: () => "/audit",
  ModelSession: () => "/model-gateway",
  ModelProvider: () => "/model-gateway",
  Engagement: () => "/engagements"
};

/** Catalog entries for Object Explorer light (type label + home href). */
export const OBJECT_EXPLORER_TYPES: Array<{
  type: string;
  label: string;
  homeHref: string;
  description: string;
}> = [
  {
    type: "AttackPath",
    label: "Attack path",
    homeHref: "/attack-paths",
    description: "Measured multi-hop paths and hop receipts"
  },
  {
    type: "ValidatedFinding",
    label: "Finding",
    homeHref: "/findings",
    description: "Validated exposure queue with disposition and fingerprint"
  },
  {
    type: "Asset",
    label: "Asset",
    homeHref: "/assets",
    description: "Canonical inventory and ownership lineage"
  },
  {
    type: "Evidence",
    label: "Evidence",
    homeHref: "/evidence",
    description: "Tamper-evident artifacts and integrity chain"
  },
  {
    type: "RemediationTask",
    label: "Remediation",
    homeHref: "/remediation",
    description: "Fix tasks with verification-only Fixed"
  },
  {
    type: "ValidationMission",
    label: "Mission / run",
    homeHref: "/missions",
    description: "Validation Snapshot and mission runs"
  },
  {
    type: "MissionSchedule",
    label: "Schedule",
    homeHref: "/schedules",
    description: "Continuous validation schedule health"
  },
  {
    type: "Integration",
    label: "Integration",
    homeHref: "/integrations",
    description: "Live connectors and source quality"
  },
  {
    type: "Runner",
    label: "Runner",
    homeHref: "/runners",
    description: "Customer runners and kill switch"
  },
  {
    type: "Signal",
    label: "Signal",
    homeHref: "/signal-activity",
    description: "Normalized signal fabric activity"
  },
  {
    type: "ThreatAlert",
    label: "Threat alert",
    homeHref: "/threat-feed",
    description: "Correlated tenant threat alerts"
  },
  {
    type: "ControlSource",
    label: "Control",
    homeHref: "/controls",
    description: "Control effectiveness observations"
  },
  {
    type: "NonHumanIdentity",
    label: "Non-human identity",
    homeHref: "/non-human-identities",
    description: "Service accounts, keys, and workload roles"
  }
];

/**
 * Resolve an operator deep-link. Platform types without a dedicated page
 * return null (no lying link). Risk types without a dedicated page use the
 * generic object workspace `/objects/:type/:id` (P11-7).
 */
export function ontologyEntityHref(
  entityType: string,
  entityId?: string | null
): string | null {
  const id = entityId && entityId.trim().length > 0 ? entityId.trim() : "";
  const dedicated = DEDICATED_HREF[entityType];
  if (dedicated) {
    return dedicated(id);
  }

  // Scope intentionally has no object page (P11-20 / P11R-18) — not /missions.
  if (entityType === "Scope") {
    return null;
  }

  if (isRiskRelatedEntityType(entityType) && id.length > 0) {
    return `/objects/${encodeURIComponent(entityType)}/${encodeURIComponent(id)}`;
  }

  return null;
}

export function ontologyHasEntityHref(entityType: string): boolean {
  if (entityType in DEDICATED_HREF) return true;
  if (entityType === "Scope") return false;
  return isRiskRelatedEntityType(entityType);
}

/** Alias used by web entity-routes re-export (P11R-3). */
export function entityHref(
  entityType: string,
  entityId?: string | null
): string | null {
  return ontologyEntityHref(entityType, entityId);
}

/** True when the type has a dedicated product route (not only /objects shell). */
export function hasEntityRoute(entityType: string): boolean {
  return entityType in DEDICATED_HREF;
}

/**
 * Light Object Explorer instance URL. Prefer a real workspace deep-link when
 * known; otherwise return the generic /objects/:type/:id shell.
 */
export function objectExplorerHref(
  entityType: string,
  entityId?: string | null
): string {
  const deep = ontologyEntityHref(entityType, entityId);
  if (deep) return deep;
  const type = encodeURIComponent(entityType);
  if (entityId && entityId.trim().length > 0) {
    return `/objects/${type}/${encodeURIComponent(entityId)}`;
  }
  return `/objects/${type}`;
}

// ---------------------------------------------------------------------------
// Graph node property shape hints (P11-14 foundation)
// ---------------------------------------------------------------------------

export const GraphHopCertaintyPropertiesSchema = z.object({
  evidenceBasis: z.enum(["Measured", "Heuristic"]).default("Heuristic"),
  measurementMethod: z.string().min(1).nullish()
});

/** Common property bags validated on graph upsert when present. */
export const GraphNodePropertySchemas = {
  Asset: z
    .object({
      assetType: z.string().min(1).optional(),
      crownJewel: z.boolean().optional(),
      category: z.string().min(1).optional()
    })
    .passthrough(),
  Exposure: z
    .object({
      exposureType: z.string().min(1).optional(),
      severity: z.string().min(1).optional(),
      category: z.string().min(1).optional()
    })
    .passthrough(),
  Identity: z
    .object({
      principalType: z.string().min(1).optional(),
      category: z.string().min(1).optional()
    })
    .passthrough(),
  ValidationRun: z
    .object({
      moduleId: z.string().min(1).optional(),
      missionId: z.string().uuid().optional()
    })
    .passthrough(),
  default: z.record(z.string(), z.unknown())
} as const;

export function parseGraphNodeProperties(
  nodeType: string,
  properties: unknown
): { success: true; data: Record<string, unknown> } | { success: false; error: string } {
  const family = nodeType.includes(".") ? nodeType.split(".")[0]! : nodeType;
  const schema =
    family in GraphNodePropertySchemas
      ? GraphNodePropertySchemas[family as keyof typeof GraphNodePropertySchemas]
      : GraphNodePropertySchemas.default;
  const result = schema.safeParse(properties ?? {});
  if (!result.success) {
    return { success: false, error: result.error.message };
  }
  return {
    success: true,
    data: result.data as Record<string, unknown>
  };
}

// ---------------------------------------------------------------------------
// OpenAPI tag generation from ontology
// ---------------------------------------------------------------------------

export function ontologyOpenApiTags(): Array<{ name: string; description: string }> {
  const tags = new Map<string, string>();
  for (const obj of ONTOLOGY_OBJECT_TYPES) {
    if (obj.openApiTag) {
      tags.set(
        obj.openApiTag,
        `${obj.label} APIs (ontology ${ONTOLOGY_MODULE_VERSION})`
      );
    }
  }
  tags.set("graph", "Evidence graph read plane (neighborhood / object workspace)");
  tags.set("ontology", "Ontology registry and object workspace");
  return [...tags.entries()].map(([name, description]) => ({ name, description }));
}

/** Primary nav seeds derived from ontology (labels only — routes stay product-owned). */
export function ontologyNavSeeds(): Array<{
  group: NonNullable<OntologyObjectTypeDef["navGroup"]>;
  types: string[];
}> {
  const byGroup = new Map<
    NonNullable<OntologyObjectTypeDef["navGroup"]>,
    string[]
  >();
  for (const obj of ONTOLOGY_OBJECT_TYPES) {
    if (!obj.navGroup) continue;
    const list = byGroup.get(obj.navGroup) ?? [];
    list.push(obj.type);
    byGroup.set(obj.navGroup, list);
  }
  return [...byGroup.entries()].map(([group, types]) => ({ group, types }));
}

export function assertGraphRelatedEntityType(
  value: string | null | undefined
): void {
  if (value == null) return;
  if (!isRiskRelatedEntityType(value)) {
    throw new Error(
      `GraphNode.relatedEntityType must be a RiskRelatedEntityType; got ${value} (platform types belong on audit links only — P09-13).`
    );
  }
}

export { graphNodeTypeToRelatedEntityType as projectGraphNodeTypeToRelated };
