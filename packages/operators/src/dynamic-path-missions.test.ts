import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  AttackPath,
  AttackPathMeasurementState,
  AttackPathValidationPlan,
  SignalEnvelope
} from "@periscan/shared";

import { generateDynamicPathMissionRecommendation } from "./dynamic-path-missions.js";

const timestamp = "2026-08-01T12:00:00.000Z";

function makePath(overrides: Partial<AttackPath> = {}): AttackPath {
  const tenantId = overrides.tenantId ?? randomUUID();
  const pathId = overrides.pathId ?? randomUUID();
  const evidenceId = overrides.evidenceIds?.[0] ?? randomUUID();
  const entryNodeId = randomUUID();
  const midNodeId = randomUUID();
  const impactNodeId = randomUUID();
  const edge1 = randomUUID();
  const edge2 = randomUUID();

  return {
    confidence: 0.7,
    createdAt: timestamp,
    entryNodeId,
    evidenceBasis: "Heuristic",
    evidenceIds: [evidenceId],
    impactNodeId,
    impactScore: 80,
    methodology: null,
    name: "Repo secret to cloud role",
    pathBreakers: [
      {
        createdAt: timestamp,
        description: "Rotate exposed token.",
        evidenceIds: [evidenceId],
        pathBreakerId: randomUUID(),
        pathId,
        priority: 1,
        relatedNodeId: midNodeId,
        tenantId,
        title: "Rotate token",
        updatedAt: timestamp
      }
    ],
    pathEdges: [
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [evidenceId],
        measurementMethod: null,
        pathEdgeId: edge1,
        pathId,
        rationale: "secret leak",
        relationship: "EXPOSES",
        sourceNodeId: entryNodeId,
        targetNodeId: midNodeId,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [evidenceId],
        measurementMethod: null,
        pathEdgeId: edge2,
        pathId,
        rationale: "role assume",
        relationship: "CAN_ACCESS",
        sourceNodeId: midNodeId,
        targetNodeId: impactNodeId,
        tenantId,
        updatedAt: timestamp
      }
    ],
    pathId,
    pathNodes: [],
    tenantId,
    updatedAt: timestamp,
    validationState: "Discovered",
    ...overrides
  };
}

function makeSignal(
  path: AttackPath,
  overrides: Partial<SignalEnvelope> = {}
): SignalEnvelope {
  return {
    confidence: 0.8,
    createdAt: timestamp,
    evidenceIds: path.evidenceIds.slice(0, 1),
    freshness: "Fresh",
    rawPayloadPointer: null,
    redactionStatus: "Redacted",
    relatedAssetIds: [],
    relatedControlIds: [],
    relatedEvidenceIds: path.evidenceIds.slice(0, 1),
    relatedIdentityIds: [],
    relatedPathIds: [path.pathId],
    sensitivityLevel: "Moderate",
    signalCategory: "Exposure",
    signalId: randomUUID(),
    signalSubcategory: "DependencyAdvisory",
    sourceIntegrationId: null,
    sourceType: "osv.advisory",
    sourceVendor: "OSV",
    techniqueIds: [],
    tenantId: path.tenantId,
    timestampIngested: timestamp,
    timestampObserved: timestamp,
    updatedAt: timestamp,
    ...overrides
  };
}

function makePlan(path: AttackPath): AttackPathValidationPlan {
  return {
    claimSummary: "Heuristic multi-hop path awaiting hop measurement.",
    items: path.pathEdges.map((edge, index) => ({
      eligibility: "Eligible" as const,
      evidenceBasis: edge.evidenceBasis,
      missingTelemetry: [],
      missionType: "ExposureValidation" as const,
      pathEdgeId: edge.pathEdgeId,
      prerequisites: [],
      recommendedModuleIds: ["periscan.tcp_reachability"],
      relationship: edge.relationship,
      requiredScopeTypes: ["Domain" as const],
      requiresInternalRunner: false,
      safetyLevel: "ActiveNonInvasive" as const,
      sequence: index
    })),
    overallStatus: "Ready",
    pathId: path.pathId
  };
}

function makeMeasurement(
  path: AttackPath,
  measured: number
): AttackPathMeasurementState {
  const total = path.pathEdges.length;
  return {
    claimSafeValidationState: "Discovered",
    edgeStates: path.pathEdges.map((edge, index) => ({
      evidenceBasis: index < measured ? ("Measured" as const) : ("Heuristic" as const),
      evidenceIds: index < measured ? edge.evidenceIds : [],
      hopKey: null,
      latestReceiptId: null,
      measurementMethod: index < measured ? "tcp_probe" : null,
      pathEdgeId: edge.pathEdgeId
    })),
    fullyMeasured: measured >= total && total > 0,
    measuredEdgeCount: measured,
    measuredHopFraction: total === 0 ? 0 : measured / total,
    pathEvidenceBasis: measured >= total && total > 0 ? "Measured" : "Heuristic",
    pathId: path.pathId,
    totalEdgeCount: total
  };
}

describe("generateDynamicPathMissionRecommendation", () => {
  it("prefers unmeasured-hop mission when hops lack Measured receipts", () => {
    const path = makePath();
    const scopeId = randomUUID();
    const rec = generateDynamicPathMissionRecommendation({
      attackPath: path,
      generatedAt: timestamp,
      measurementState: makeMeasurement(path, 0),
      signals: [],
      tenantId: path.tenantId,
      validationPlan: makePlan(path),
      verifiedScopeId: scopeId
    });

    expect(rec).not.toBeNull();
    expect(rec!.kind).toBe("DynamicPathNextMission");
    expect(rec!.drivers).toContain("UnmeasuredHop");
    expect(rec!.approvalRequired).toBe(true);
    expect(rec!.status).toBe("Proposed");
    expect(rec!.missionPlan.approvalRequired).toBe(true);
    expect(rec!.missionPlan.moduleIds).toContain("periscan.tcp_reachability");
    expect(rec!.missionPlan.scopeId).toBe(scopeId);
    expect(rec!.unmeasuredEdgeCount).toBe(2);
    expect(rec!.honestyNotes.some((n) => /not autonomous/i.test(n))).toBe(
      true
    );
  });

  it("uses signal-driven CVE revalidation when hops are measured and CVE matches", () => {
    const path = makePath({
      pathEdges: makePath().pathEdges.map((edge) => ({
        ...edge,
        evidenceBasis: "Measured" as const
      }))
    });
    // Rebuild measured edges with correct pathId linkage
    const pathId = path.pathId;
    const measuredPath = makePath({
      evidenceIds: path.evidenceIds,
      pathId,
      pathEdges: path.pathEdges.map((edge) => ({
        ...edge,
        evidenceBasis: "Measured",
        pathId
      })),
      tenantId: path.tenantId
    });
    const signal = makeSignal(measuredPath, {
      signalCategory: "Exposure",
      signalSubcategory: "DependencyAdvisory"
    });

    const rec = generateDynamicPathMissionRecommendation({
      attackPath: measuredPath,
      generatedAt: timestamp,
      measurementState: makeMeasurement(measuredPath, measuredPath.pathEdges.length),
      signals: [signal],
      tenantId: measuredPath.tenantId,
      validationPlan: {
        ...makePlan(measuredPath),
        items: makePlan(measuredPath).items.map((item) => ({
          ...item,
          eligibility: "AlreadyMeasured",
          evidenceBasis: "Measured"
        })),
        overallStatus: "FullyMeasured"
      },
      verifiedScopeId: randomUUID()
    });

    expect(rec).not.toBeNull();
    expect(rec!.drivers).toContain("SignalCve");
    expect(rec!.matchedSignalIds).toContain(signal.signalId);
    expect(rec!.matchedTriggerIds).toContain("trigger.cve");
    expect(rec!.missionPlan.missionType).toBe("ExposureValidation");
    expect(rec!.approvalRequired).toBe(true);
  });

  it("marks NotActionable without verified scope", () => {
    const path = makePath();
    const rec = generateDynamicPathMissionRecommendation({
      attackPath: path,
      generatedAt: timestamp,
      measurementState: makeMeasurement(path, 0),
      validationPlan: makePlan(path),
      verifiedScopeId: null,
      tenantId: path.tenantId
    });

    expect(rec?.status).toBe("NotActionable");
    expect(rec?.missionPlan.scopeId ?? null).toBeNull();
  });

  it("returns null when path has no evidence", () => {
    const path = makePath({ evidenceIds: [] });
    const rec = generateDynamicPathMissionRecommendation({
      attackPath: path,
      generatedAt: timestamp,
      tenantId: path.tenantId,
      verifiedScopeId: randomUUID()
    });
    expect(rec).toBeNull();
  });

  it("recommends path-breaker verify when fully measured and no signal drivers", () => {
    const path = makePath();
    const measuredPath = {
      ...path,
      pathEdges: path.pathEdges.map((edge) => ({
        ...edge,
        evidenceBasis: "Measured" as const
      }))
    };
    const rec = generateDynamicPathMissionRecommendation({
      attackPath: measuredPath,
      generatedAt: timestamp,
      measurementState: makeMeasurement(measuredPath, measuredPath.pathEdges.length),
      signals: [],
      tenantId: path.tenantId,
      validationPlan: {
        ...makePlan(measuredPath),
        items: makePlan(measuredPath).items.map((item) => ({
          ...item,
          eligibility: "AlreadyMeasured",
          evidenceBasis: "Measured"
        })),
        overallStatus: "FullyMeasured"
      },
      verifiedScopeId: randomUUID()
    });

    expect(rec?.drivers).toContain("PathBreakerVerify");
    expect(rec?.missionPlan.missionType).toBe("FixVerification");
  });
});
