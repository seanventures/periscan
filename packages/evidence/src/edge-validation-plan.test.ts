import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { AttackPath } from "@periscan/shared";

import {
  SAFE_HOP_PROBE_MODULES,
  buildAttackPathValidationPlan,
  recommendSafeModulesForHop
} from "./edge-validation-plan";

function createHeuristicPath(overrides?: {
  firstEdgeBasis?: "Measured" | "Heuristic";
  firstEdgeEvidenceIds?: string[];
  secondRelationship?: AttackPath["pathEdges"][number]["relationship"];
  secondTargetType?: AttackPath["pathNodes"][number]["entityType"];
}): AttackPath {
  const timestamp = new Date().toISOString();
  const tenantId = randomUUID();
  const pathId = randomUUID();
  const exposureNodeId = randomUUID();
  const assetNodeId = randomUUID();
  const targetNodeId = randomUUID();
  const evidenceId = randomUUID();
  const firstEdgeId = randomUUID();
  const secondEdgeId = randomUUID();

  return {
    confidence: 0.8,
    createdAt: timestamp,
    entryNodeId: exposureNodeId,
    evidenceBasis: "Heuristic",
    evidenceIds: [evidenceId],
    impactNodeId: targetNodeId,
    impactScore: 70,
    name: "Exposure to production asset",
    pathBreakers: [],
    pathEdges: [
      {
        createdAt: timestamp,
        evidenceBasis: overrides?.firstEdgeBasis ?? "Heuristic",
        evidenceIds: overrides?.firstEdgeEvidenceIds ?? [evidenceId],
        pathEdgeId: firstEdgeId,
        pathId,
        rationale: "Exposed surface",
        relationship: "EXPOSES",
        sourceNodeId: exposureNodeId,
        targetNodeId: assetNodeId,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [evidenceId],
        pathEdgeId: secondEdgeId,
        pathId,
        rationale: "Lateral access",
        relationship: overrides?.secondRelationship ?? "CAN_ACCESS",
        sourceNodeId: assetNodeId,
        targetNodeId: targetNodeId,
        tenantId,
        updatedAt: timestamp
      }
    ],
    pathId,
    pathNodes: [
      {
        createdAt: timestamp,
        entityId: randomUUID(),
        entityType: "Exposure",
        evidenceIds: [evidenceId],
        label: "Public exposure",
        pathId,
        pathNodeId: exposureNodeId,
        sequence: 0,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        entityId: randomUUID(),
        entityType: "Asset",
        evidenceIds: [evidenceId],
        label: "Edge host",
        pathId,
        pathNodeId: assetNodeId,
        sequence: 1,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        entityId: randomUUID(),
        entityType: overrides?.secondTargetType ?? "Asset",
        evidenceIds: [evidenceId],
        label: "Production asset",
        pathId,
        pathNodeId: targetNodeId,
        sequence: 2,
        tenantId,
        updatedAt: timestamp
      }
    ],
    tenantId,
    updatedAt: timestamp,
    validationState: "Discovered"
  };
}

describe("recommendSafeModulesForHop", () => {
  it("prefers TCP/HTTP/TLS for access hops", () => {
    const recommendation = recommendSafeModulesForHop({
      relationship: "CAN_ACCESS",
      sourceEntityType: "Asset",
      targetEntityType: "Asset"
    });

    expect(recommendation.moduleIds).toContain(
      SAFE_HOP_PROBE_MODULES.tcpReachability
    );
    expect(recommendation.moduleIds).toContain(
      SAFE_HOP_PROBE_MODULES.httpHealth
    );
    expect(recommendation.safetyLevel).toBe("ActiveNonInvasive");
    expect(recommendation.moduleIds.every((id) => id.startsWith("periscan."))).toBe(
      true
    );
  });

  it("does not recommend network probes for control-observation hops", () => {
    const recommendation = recommendSafeModulesForHop({
      relationship: "MISSED_BY",
      sourceEntityType: "Exposure",
      targetEntityType: "ControlSource"
    });

    expect(recommendation.moduleIds).toEqual([]);
    expect(recommendation.missingTelemetry).toContain("control_observation");
  });

  it("recommends identity graph import only — never live credential probes (P05-5)", () => {
    const recommendation = recommendSafeModulesForHop({
      relationship: "CAN_ACCESS",
      sourceEntityType: "Identity",
      targetEntityType: "Asset"
    });

    expect(recommendation.moduleIds).toEqual([
      SAFE_HOP_PROBE_MODULES.identityGraphImport
    ]);
    expect(recommendation.safetyLevel).toBe("PassiveReadOnly");
    expect(recommendation.missingTelemetry).toEqual([]);
    expect(recommendation.prerequisites.join(" ")).toMatch(/BloodHound/i);
    expect(recommendation.prerequisites.join(" ")).toMatch(/never Exploitable/i);
    // Hard floor: no spray / kerbrute / SharpHound live modules.
    expect(recommendation.moduleIds.every((id) => !/cred_spray|kerbrute|netexec|sharphound/i.test(id))).toBe(
      true
    );
  });
});

describe("identity hop eligibility (P05-4)", () => {
  it("marks identity hops HeuristicOnly — not Eligible for Measured upgrade", () => {
    const base = createHeuristicPath();
    const identityNodeId = randomUUID();
    const assetNodeId = randomUUID();
    const edgeId = randomUUID();
    const timestamp = base.createdAt;
    const path: AttackPath = {
      ...base,
      entryNodeId: identityNodeId,
      impactNodeId: assetNodeId,
      pathNodes: [
        {
          createdAt: timestamp,
          entityId: randomUUID(),
          entityType: "Identity",
          evidenceIds: [],
          label: "Privileged user",
          pathId: base.pathId,
          pathNodeId: identityNodeId,
          sequence: 0,
          tenantId: base.tenantId,
          updatedAt: timestamp
        },
        {
          createdAt: timestamp,
          entityId: randomUUID(),
          entityType: "Asset",
          evidenceIds: [],
          label: "Domain controller",
          pathId: base.pathId,
          pathNodeId: assetNodeId,
          sequence: 1,
          tenantId: base.tenantId,
          updatedAt: timestamp
        }
      ],
      pathEdges: [
        {
          createdAt: timestamp,
          evidenceBasis: "Heuristic",
          evidenceIds: [],
          pathEdgeId: edgeId,
          pathId: base.pathId,
          rationale: "AdminTo",
          relationship: "CAN_ACCESS",
          sourceNodeId: identityNodeId,
          targetNodeId: assetNodeId,
          tenantId: base.tenantId,
          updatedAt: timestamp
        }
      ]
    };
    const plan = buildAttackPathValidationPlan({
      path,
      readiness: { hasVerifiedScope: true, hasRunner: true }
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]?.eligibility).toBe("HeuristicOnly");
    expect(plan.items[0]?.recommendedModuleIds).toEqual([
      SAFE_HOP_PROBE_MODULES.identityGraphImport
    ]);
  });
});

describe("buildAttackPathValidationPlan", () => {
  it("marks hops Eligible when verified scope is present", () => {
    const path = createHeuristicPath();
    const plan = buildAttackPathValidationPlan({
      path,
      readiness: { hasVerifiedScope: true, hasRunner: true }
    });

    expect(plan.pathId).toBe(path.pathId);
    expect(plan.items).toHaveLength(2);
    expect(plan.items.every((item) => item.eligibility === "Eligible")).toBe(
      true
    );
    expect(plan.overallStatus).toBe("Ready");
    expect(plan.items[0]?.recommendedModuleIds.length).toBeGreaterThan(0);
    expect(
      plan.items.every((item) =>
        item.recommendedModuleIds.every((id) => id.startsWith("periscan."))
      )
    ).toBe(true);
  });

  it("returns NeedsScope when verified scope is missing", () => {
    const path = createHeuristicPath();
    const plan = buildAttackPathValidationPlan({
      path,
      readiness: { hasVerifiedScope: false }
    });

    expect(plan.items.every((item) => item.eligibility === "NeedsScope")).toBe(
      true
    );
    expect(plan.overallStatus).toBe("Blocked");
  });

  it("never marks AlreadyMeasured without Measured basis and evidenceIds", () => {
    const path = createHeuristicPath({
      firstEdgeBasis: "Measured",
      firstEdgeEvidenceIds: []
    });
    const plan = buildAttackPathValidationPlan({
      path,
      readiness: { hasVerifiedScope: true }
    });

    const first = plan.items.find(
      (item) => item.pathEdgeId === path.pathEdges[0]?.pathEdgeId
    );
    expect(first?.eligibility).not.toBe("AlreadyMeasured");
  });

  it("marks AlreadyMeasured only with Measured + evidenceIds", () => {
    const evidenceId = randomUUID();
    const path = createHeuristicPath({
      firstEdgeBasis: "Measured",
      firstEdgeEvidenceIds: [evidenceId]
    });
    const plan = buildAttackPathValidationPlan({
      path,
      readiness: { hasVerifiedScope: true }
    });

    const first = plan.items.find(
      (item) => item.pathEdgeId === path.pathEdges[0]?.pathEdgeId
    );
    const second = plan.items.find(
      (item) => item.pathEdgeId === path.pathEdges[1]?.pathEdgeId
    );

    expect(first?.eligibility).toBe("AlreadyMeasured");
    expect(first?.recommendedModuleIds).toEqual([]);
    expect(second?.eligibility).toBe("Eligible");
    expect(plan.overallStatus).toBe("PartiallyReady");
  });

  it("returns NeedsIntegration for control hops without SIEM", () => {
    const path = createHeuristicPath({
      secondRelationship: "MISSED_BY",
      secondTargetType: "ControlSource"
    });
    const plan = buildAttackPathValidationPlan({
      path,
      readiness: {
        hasVerifiedScope: true,
        connectedIntegrationCategories: []
      }
    });

    const controlItem = plan.items.find(
      (item) => item.relationship === "MISSED_BY"
    );
    expect(controlItem?.eligibility).toBe("NeedsIntegration");
    expect(controlItem?.recommendedModuleIds).toEqual([]);
  });

  it("returns NeedsApproval when policy requires approval for active probes", () => {
    const path = createHeuristicPath();
    const plan = buildAttackPathValidationPlan({
      path,
      readiness: {
        hasVerifiedScope: true,
        requiresApprovalForActive: true
      }
    });

    expect(
      plan.items.every((item) => item.eligibility === "NeedsApproval")
    ).toBe(true);
  });

  it("reports FullyMeasured when every hop is already measured with evidence", () => {
    const evidenceId = randomUUID();
    const path = createHeuristicPath({
      firstEdgeBasis: "Measured",
      firstEdgeEvidenceIds: [evidenceId]
    });
    path.pathEdges = path.pathEdges.map((edge) => ({
      ...edge,
      evidenceBasis: "Measured",
      evidenceIds: [evidenceId]
    }));
    path.evidenceBasis = "Measured";

    const plan = buildAttackPathValidationPlan({
      path,
      readiness: { hasVerifiedScope: true }
    });

    expect(plan.overallStatus).toBe("FullyMeasured");
    expect(
      plan.items.every((item) => item.eligibility === "AlreadyMeasured")
    ).toBe(true);
  });
});
