import {
  AttackPathEdgePlanItemSchema,
  AttackPathValidationPlanSchema,
  type AttackPath,
  type AttackPathEdgePlanItem,
  type AttackPathValidationPlan,
  type AttackPathValidationPlanOverallStatus,
  type EdgeRelationship,
  type PathEdge,
  type PathEdgeValidationEligibility,
  type PathNode,
  type SafetyLevel,
  type ScopeType
} from "@periscan/shared";

/**
 * Tenant readiness inputs used only to decide hop eligibility. Planning never
 * fabricates Measured claims — that requires receipts with evidence IDs.
 */
export type EdgeValidationPlanReadiness = {
  hasVerifiedScope?: boolean;
  hasRunner?: boolean;
  /** Connected integration categories, e.g. SecurityControl, Cloud, Identity. */
  connectedIntegrationCategories?: readonly string[];
  /** When true, ActiveNonInvasive missions require approval before launch. */
  requiresApprovalForActive?: boolean;
};

export type BuildAttackPathValidationPlanInput = {
  path: Pick<
    AttackPath,
    "pathId" | "evidenceBasis" | "pathEdges" | "pathNodes" | "validationState"
  >;
  readiness?: EdgeValidationPlanReadiness;
};

/** Safe hop-probe modules only — ActiveNonInvasive or PassiveReadOnly. */
export const SAFE_HOP_PROBE_MODULES = {
  tcpReachability: "periscan.tcp_reachability",
  dnsResolution: "periscan.dns_resolution_check",
  httpHealth: "periscan.http_health_check",
  tlsCertificate: "periscan.tls_certificate_check",
  /**
   * Identity hop "measurement" is import + re-import verification only
   * (BloodHound-compatible graph). Never live credential abuse / SharpHound.
   * Import outcomes stay Heuristic/Inconclusive — not Exploitable path proof.
   */
  identityGraphImport: "bloodhound.identity_pathing"
} as const;

const SAFE_MODULE_SET = new Set<string>(Object.values(SAFE_HOP_PROBE_MODULES));

type HopModuleRecommendation = {
  moduleIds: string[];
  safetyLevel: SafetyLevel;
  requiredScopeTypes: ScopeType[];
  requiresInternalRunner: boolean;
  missingTelemetry: string[];
  prerequisites: string[];
};

function nodeById(
  nodes: readonly PathNode[]
): Map<string, PathNode> {
  return new Map(nodes.map((node) => [node.pathNodeId, node]));
}

function edgeSequence(
  edge: PathEdge,
  nodes: Map<string, PathNode>,
  fallback: number
): number {
  const source = nodes.get(edge.sourceNodeId);
  if (source) {
    return source.sequence;
  }
  return fallback;
}

function isAlreadyMeasured(edge: PathEdge): boolean {
  return (
    edge.evidenceBasis === "Measured" &&
    Array.isArray(edge.evidenceIds) &&
    edge.evidenceIds.length > 0
  );
}

/**
 * Map a hop (relationship + endpoint entity types) to safe probe modules.
 * Prefer built-in Periscan TCP/DNS/HTTP/TLS checks. Never recommend destructive
 * or credential-theft modules.
 */
export function recommendSafeModulesForHop(input: {
  relationship: EdgeRelationship;
  sourceEntityType?: string | null;
  targetEntityType?: string | null;
}): HopModuleRecommendation {
  const sourceType = input.sourceEntityType ?? null;
  const targetType = input.targetEntityType ?? null;
  const relationship = input.relationship;

  // Control-observation edges need SIEM/control telemetry, not network probes.
  if (
    relationship === "DETECTED_BY" ||
    relationship === "BLOCKED_BY" ||
    relationship === "MISSED_BY" ||
    relationship === "OBSERVED_BY" ||
    targetType === "ControlSource"
  ) {
    return {
      moduleIds: [],
      safetyLevel: "PassiveReadOnly",
      requiredScopeTypes: ["ControlSource"],
      requiresInternalRunner: false,
      missingTelemetry: ["control_observation", "detection_telemetry"],
      prerequisites: [
        "Connect a SecurityControl integration to measure detection/block edges"
      ]
    };
  }

  // Identity privilege edges: no live credential/lateral abuse. Safe path is
  // BloodHound-compatible graph import + re-import verification (P05-5).
  // Never recommend netexec/kerbrute/SharpHound. Import is not Exploitable proof.
  if (
    sourceType === "Identity" ||
    targetType === "Identity" ||
    sourceType === "NonHumanIdentity" ||
    targetType === "NonHumanIdentity"
  ) {
    return {
      moduleIds: [SAFE_HOP_PROBE_MODULES.identityGraphImport],
      safetyLevel: "PassiveReadOnly",
      requiredScopeTypes: ["InternalNetwork", "ControlSource"],
      requiresInternalRunner: false,
      missingTelemetry: [],
      prerequisites: [
        "Import an approved BloodHound-compatible identity graph (collector execution disabled). Re-import to re-verify privileged edges. Graph import is Heuristic evidence — never Exploitable path proof from import alone."
      ]
    };
  }

  // Repository / code exposure hops.
  if (
    sourceType === "Exposure" ||
    targetType === "Exposure" ||
    relationship === "EXPOSES"
  ) {
    // Exposure → asset/app: measure reachability of the exposed surface.
    if (
      targetType === "Asset" ||
      targetType === "AIApplication" ||
      targetType === null
    ) {
      return {
        moduleIds: [
          SAFE_HOP_PROBE_MODULES.tcpReachability,
          SAFE_HOP_PROBE_MODULES.httpHealth,
          SAFE_HOP_PROBE_MODULES.tlsCertificate
        ],
        safetyLevel: "ActiveNonInvasive",
        requiredScopeTypes: ["Domain", "Subdomain", "IPRange"],
        requiresInternalRunner: false,
        missingTelemetry: [],
        prerequisites: ["Verified scope covering the exposed host or domain"]
      };
    }
  }

  // AI application endpoints.
  if (sourceType === "AIApplication" || targetType === "AIApplication") {
    return {
      moduleIds: [
        SAFE_HOP_PROBE_MODULES.httpHealth,
        SAFE_HOP_PROBE_MODULES.tlsCertificate,
        SAFE_HOP_PROBE_MODULES.tcpReachability
      ],
      safetyLevel: "ActiveNonInvasive",
      requiredScopeTypes: ["AIApplicationEndpoint", "Domain", "Subdomain"],
      requiresInternalRunner: false,
      missingTelemetry: [],
      prerequisites: ["Verified scope covering the AI application endpoint"]
    };
  }

  // Generic access / lateral hops between assets — prefer TCP reachability.
  if (
    relationship === "CAN_ACCESS" ||
    relationship === "LEADS_TO" ||
    relationship === "RELATES_TO" ||
    relationship === "AFFECTED_BY"
  ) {
    return {
      moduleIds: [
        SAFE_HOP_PROBE_MODULES.tcpReachability,
        SAFE_HOP_PROBE_MODULES.dnsResolution,
        SAFE_HOP_PROBE_MODULES.httpHealth,
        SAFE_HOP_PROBE_MODULES.tlsCertificate
      ],
      safetyLevel: "ActiveNonInvasive",
      requiredScopeTypes: ["Domain", "Subdomain", "IPRange", "InternalNetwork"],
      requiresInternalRunner: false,
      missingTelemetry: [],
      prerequisites: ["Verified scope covering source and target hosts"]
    };
  }

  // Remediation / validation edges are historical links, not probe targets.
  if (
    relationship === "FIXED_BY" ||
    relationship === "REOPENED_BY" ||
    relationship === "REMEDIATED_BY" ||
    relationship === "VALIDATED_BY"
  ) {
    return {
      moduleIds: [],
      safetyLevel: "PassiveReadOnly",
      requiredScopeTypes: [],
      requiresInternalRunner: false,
      missingTelemetry: [],
      prerequisites: [
        "Historical link edge — re-measure the underlying exposure hop instead"
      ]
    };
  }

  return {
    moduleIds: [],
    safetyLevel: "PassiveReadOnly",
    requiredScopeTypes: [],
    requiresInternalRunner: false,
    missingTelemetry: ["unsupported_hop_shape"],
    prerequisites: [
      `No first-customer safe module mapped for relationship ${relationship}`
    ]
  };
}

function resolveEligibility(input: {
  edge: PathEdge;
  recommendation: HopModuleRecommendation;
  readiness: EdgeValidationPlanReadiness;
}): {
  eligibility: PathEdgeValidationEligibility;
  prerequisites: string[];
  missingTelemetry: string[];
} {
  const prerequisites = [...input.recommendation.prerequisites];
  const missingTelemetry = [...input.recommendation.missingTelemetry];

  if (isAlreadyMeasured(input.edge)) {
    return {
      eligibility: "AlreadyMeasured",
      prerequisites: [],
      missingTelemetry: []
    };
  }

  // Evidence basis Measured without evidence IDs is dishonest — treat as not measured.
  if (
    input.edge.evidenceBasis === "Measured" &&
    (!input.edge.evidenceIds || input.edge.evidenceIds.length === 0)
  ) {
    prerequisites.push(
      "Edge marked Measured without evidence IDs — re-measure before claiming"
    );
  }

  if (input.recommendation.moduleIds.length === 0) {
    if (missingTelemetry.length > 0) {
      const hasSecurityControl = (
        input.readiness.connectedIntegrationCategories ?? []
      ).some(
        (category) =>
          category === "SecurityControl" ||
          category === "Identity" ||
          category === "Cloud"
      );
      if (!hasSecurityControl && missingTelemetry.includes("control_observation")) {
        return {
          eligibility: "NeedsIntegration",
          prerequisites,
          missingTelemetry
        };
      }
      if (
        !hasSecurityControl &&
        (missingTelemetry.includes("identity_posture") ||
          missingTelemetry.includes("detection_telemetry"))
      ) {
        return {
          eligibility: "NeedsIntegration",
          prerequisites,
          missingTelemetry
        };
      }
    }
    return {
      eligibility: "NoSafeModule",
      prerequisites,
      missingTelemetry
    };
  }

  if (input.readiness.hasVerifiedScope === false) {
    return {
      eligibility: "NeedsScope",
      prerequisites: [
        ...prerequisites,
        "Add and verify authorized scope before launching hop probes"
      ],
      missingTelemetry
    };
  }

  if (
    input.recommendation.requiresInternalRunner &&
    input.readiness.hasRunner === false
  ) {
    return {
      eligibility: "NeedsRunner",
      prerequisites: [
        ...prerequisites,
        "Register an internal runner for AgentLocal hop probes"
      ],
      missingTelemetry
    };
  }

  // InternalNetwork-only recommendations without a runner when scope is internal.
  if (
    input.recommendation.requiredScopeTypes.includes("InternalNetwork") &&
    input.recommendation.requiredScopeTypes.length === 1 &&
    input.readiness.hasRunner === false
  ) {
    return {
      eligibility: "NeedsRunner",
      prerequisites: [
        ...prerequisites,
        "Internal-network hop probes require an enrolled runner"
      ],
      missingTelemetry
    };
  }

  if (
    input.readiness.requiresApprovalForActive === true &&
    (input.recommendation.safetyLevel === "ActiveNonInvasive" ||
      input.recommendation.safetyLevel === "ControlledValidation" ||
      input.recommendation.safetyLevel === "BASLite" ||
      input.recommendation.safetyLevel === "AdvancedAdversarial")
  ) {
    return {
      eligibility: "NeedsApproval",
      prerequisites: [
        ...prerequisites,
        "Tenant policy requires approval above PassiveReadOnly"
      ],
      missingTelemetry
    };
  }

  // Filter out any non-safe module IDs as a hard safety belt.
  const safeModules = input.recommendation.moduleIds.filter((id) =>
    SAFE_MODULE_SET.has(id)
  );
  if (safeModules.length === 0) {
    return {
      eligibility: "NoSafeModule",
      prerequisites: [
        ...prerequisites,
        "Recommended modules failed the safe-module allowlist"
      ],
      missingTelemetry
    };
  }

  // P05-4: identity graph import is Heuristic-only — never "Measure hop (safe)"
  // as if it could mint Measured edge receipts.
  const identityImportOnly =
    safeModules.length > 0 &&
    safeModules.every(
      (id) => id === SAFE_HOP_PROBE_MODULES.identityGraphImport
    );
  if (identityImportOnly) {
    return {
      eligibility: "HeuristicOnly",
      prerequisites: [
        ...prerequisites,
        "Re-import graph for Heuristic verification only — import cannot mint Measured path proof"
      ],
      missingTelemetry
    };
  }

  return {
    eligibility: "Eligible",
    prerequisites,
    missingTelemetry
  };
}

function overallStatus(
  items: readonly AttackPathEdgePlanItem[]
): AttackPathValidationPlanOverallStatus {
  if (items.length === 0) {
    return "Blocked";
  }

  if (items.every((item) => item.eligibility === "AlreadyMeasured")) {
    return "FullyMeasured";
  }

  const eligibleCount = items.filter(
    (item) =>
      item.eligibility === "Eligible" || item.eligibility === "HeuristicOnly"
  ).length;
  const measuredCount = items.filter(
    (item) => item.eligibility === "AlreadyMeasured"
  ).length;
  const blockedCount = items.filter(
    (item) =>
      item.eligibility !== "Eligible" &&
      item.eligibility !== "HeuristicOnly" &&
      item.eligibility !== "AlreadyMeasured"
  ).length;

  if (eligibleCount === 0) {
    return "Blocked";
  }

  // All remaining hops can launch and none are measured yet → Ready.
  if (blockedCount === 0 && measuredCount === 0) {
    return "Ready";
  }

  // Mix of measured / eligible / blocked → partial progress or partial readiness.
  return "PartiallyReady";
}

function buildClaimSummary(
  path: BuildAttackPathValidationPlanInput["path"],
  items: readonly AttackPathEdgePlanItem[]
): string {
  const measured = items.filter(
    (item) => item.eligibility === "AlreadyMeasured"
  ).length;
  const total = items.length;
  const eligible = items.filter((item) => item.eligibility === "Eligible").length;
  const blocked = items.filter(
    (item) =>
      item.eligibility !== "Eligible" &&
      item.eligibility !== "AlreadyMeasured"
  ).length;

  if (total === 0) {
    return "Path has no edges to measure.";
  }

  if (measured === total) {
    return `All ${total} hops are Measured with evidence; path claim remains governed by weakest-edge basis (${path.evidenceBasis}).`;
  }

  return `Hypothesis path: ${measured}/${total} hops Measured with evidence; ${eligible} eligible for safe hop probes; ${blocked} blocked by scope, runner, integration, approval, or missing safe module.`;
}

/**
 * Pure edge-level validation planner. Does not persist, enqueue, or claim
 * Measured without evidence. Safe modules only.
 */
export function buildAttackPathValidationPlan(
  input: BuildAttackPathValidationPlanInput
): AttackPathValidationPlan {
  const readiness: EdgeValidationPlanReadiness = {
    hasVerifiedScope: input.readiness?.hasVerifiedScope,
    hasRunner: input.readiness?.hasRunner,
    connectedIntegrationCategories:
      input.readiness?.connectedIntegrationCategories ?? [],
    requiresApprovalForActive: input.readiness?.requiresApprovalForActive
  };

  const nodes = nodeById(input.path.pathNodes);
  const orderedEdges = [...input.path.pathEdges].sort(
    (left, right) =>
      edgeSequence(left, nodes, 0) - edgeSequence(right, nodes, 0)
  );

  const items: AttackPathEdgePlanItem[] = orderedEdges.map((edge, index) => {
    const source = nodes.get(edge.sourceNodeId);
    const target = nodes.get(edge.targetNodeId);
    const recommendation = recommendSafeModulesForHop({
      relationship: edge.relationship,
      sourceEntityType: source?.entityType,
      targetEntityType: target?.entityType
    });

    // Hard safety belt: never recommend modules outside the safe allowlist.
    const safeModuleIds = recommendation.moduleIds.filter((id) =>
      SAFE_MODULE_SET.has(id)
    );
    const gatedRecommendation: HopModuleRecommendation = {
      ...recommendation,
      moduleIds: safeModuleIds
    };

    const resolved = resolveEligibility({
      edge,
      recommendation: gatedRecommendation,
      readiness
    });

    return AttackPathEdgePlanItemSchema.parse({
      pathEdgeId: edge.pathEdgeId,
      sequence: edgeSequence(edge, nodes, index),
      relationship: edge.relationship,
      evidenceBasis: edge.evidenceBasis,
      recommendedModuleIds:
        resolved.eligibility === "AlreadyMeasured" ? [] : safeModuleIds,
      safetyLevel: gatedRecommendation.safetyLevel,
      missionType: "ExposureValidation",
      requiredScopeTypes: gatedRecommendation.requiredScopeTypes,
      requiresInternalRunner: gatedRecommendation.requiresInternalRunner,
      prerequisites: resolved.prerequisites,
      missingTelemetry: resolved.missingTelemetry,
      eligibility: resolved.eligibility
    });
  });

  return AttackPathValidationPlanSchema.parse({
    pathId: input.path.pathId,
    claimSummary: buildClaimSummary(input.path, items),
    items,
    overallStatus: overallStatus(items)
  });
}
