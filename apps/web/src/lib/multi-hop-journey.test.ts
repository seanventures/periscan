import { describe, expect, it } from "vitest";

import type { AttackPath, AttackPathAssessment } from "@periscan/shared";

import {
  MULTI_HOP_OPERATOR_JOURNEY,
  resolveMultiHopMeasureCta,
  resolvePathDetailMeasureCta
} from "./multi-hop-journey";

const now = "2026-07-14T20:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const pathId = "22222222-2222-4222-8222-222222222222";
const pathId2 = "33333333-3333-4333-8333-333333333333";
const entryNodeId = "44444444-4444-4444-8444-444444444444";
const objectiveNodeId = "55555555-5555-4555-8555-555555555555";
const edgeId = "66666666-6666-4666-8666-666666666666";
const evidenceId = "77777777-7777-4777-8777-777777777777";

function basePath(overrides: Partial<AttackPath> = {}): AttackPath {
  return {
    confidence: 0.8,
    createdAt: now,
    entryNodeId,
    evidenceBasis: "Heuristic",
    evidenceIds: [evidenceId],
    impactNodeId: objectiveNodeId,
    impactScore: 70,
    methodology: "Evidence graph correlation",
    name: "Test path",
    nonSnapPack: null,
    pathBreakers: [],
    pathEdges: [],
    pathId,
    pathNodes: [],
    tenantId,
    updatedAt: now,
    validationState: "Validated",
    ...overrides
  };
}

function heuristicEdge(
  overrides: Partial<AttackPath["pathEdges"][number]> = {}
): AttackPath["pathEdges"][number] {
  return {
    createdAt: now,
    evidenceBasis: "Heuristic",
    evidenceIds: [evidenceId],
    measurementMethod: null,
    pathEdgeId: edgeId,
    pathId,
    rationale: "Hypothesis hop",
    relationship: "CAN_ACCESS",
    sourceNodeId: entryNodeId,
    targetNodeId: objectiveNodeId,
    tenantId,
    updatedAt: now,
    ...overrides
  };
}

function assessment(
  path: AttackPath,
  score = 80
): AttackPathAssessment {
  return {
    attackPath: path,
    financialExposure: null,
    risk: {
      band: "High",
      factors: [],
      score,
      summary: "test"
    }
  };
}

describe("resolveMultiHopMeasureCta", () => {
  it("returns open-paths empty CTA when no paths", () => {
    const cta = resolveMultiHopMeasureCta({
      paths: [],
      scopeVerified: true
    });
    expect(cta).toMatchObject({
      href: "/attack-paths",
      label: "Open attack paths",
      measureReady: false,
      firstPathId: null
    });
  });

  it("surfaces Measure path hops when unmeasured hops + verified scope", () => {
    const cta = resolveMultiHopMeasureCta({
      paths: [
        assessment(
          basePath({
            pathEdges: [heuristicEdge()]
          })
        )
      ],
      scopeVerified: true
    });
    expect(cta.measureReady).toBe(true);
    expect(cta.label).toBe("Measure path hops");
    expect(cta.href).toBe(`/attack-paths/${pathId}#hop-measurement`);
    expect(cta.unmeasuredPathCount).toBe(1);
    expect(cta.hopsTotal).toBe(1);
    expect(cta.hopsMeasured).toBe(0);
  });

  it("does not claim Measure primary without verified scope", () => {
    const cta = resolveMultiHopMeasureCta({
      paths: [
        assessment(
          basePath({
            pathEdges: [heuristicEdge()]
          })
        )
      ],
      scopeVerified: false
    });
    expect(cta.measureReady).toBe(false);
    expect(cta.label).toMatch(/authorize scope/i);
    expect(cta.href).toBe(`/attack-paths/${pathId}#hop-measurement`);
  });

  it("does not claim Measure when every hop is already Measured (receipts)", () => {
    const cta = resolveMultiHopMeasureCta({
      paths: [
        assessment(
          basePath({
            evidenceBasis: "Measured",
            pathEdges: [
              heuristicEdge({
                evidenceBasis: "Measured",
                measurementMethod: "reachability-probe"
              })
            ]
          })
        )
      ],
      scopeVerified: true
    });
    expect(cta.measureReady).toBe(false);
    expect(cta.label).not.toBe("Measure path hops");
    expect(cta.hopsMeasured).toBe(1);
    expect(cta.unmeasuredPathCount).toBe(0);
  });

  it("prefers highest-risk unmeasured path for deep-link", () => {
    const low = assessment(
      basePath({
        pathId: pathId2,
        name: "Low risk unmeasured",
        pathEdges: [
          heuristicEdge({
            pathId: pathId2,
            pathEdgeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
          })
        ]
      }),
      20
    );
    const high = assessment(
      basePath({
        pathId,
        name: "High risk unmeasured",
        pathEdges: [heuristicEdge()]
      }),
      95
    );
    const cta = resolveMultiHopMeasureCta({
      paths: [low, high],
      scopeVerified: true
    });
    expect(cta.firstPathId).toBe(pathId);
    expect(cta.href).toBe(`/attack-paths/${pathId}#hop-measurement`);
    expect(cta.label).toBe("Measure path hops");
  });

  it("never invents FullyMeasured from empty edges", () => {
    const cta = resolveMultiHopMeasureCta({
      paths: [assessment(basePath({ pathEdges: [] }))],
      scopeVerified: true
    });
    expect(cta.measureReady).toBe(false);
    expect(cta.hopsTotal).toBe(0);
    expect(cta.label).toBe("Inspect path");
  });
});

describe("resolvePathDetailMeasureCta", () => {
  it("surfaces Measure hops only when unmeasured hops + verified scope", () => {
    const cta = resolvePathDetailMeasureCta({
      fullyMeasured: false,
      totalEdgeCount: 2,
      measuredEdgeCount: 0,
      scopeVerified: true,
      hasBreakers: false
    });
    expect(cta).toEqual({
      href: "#hop-measurement",
      label: "Measure hops",
      measureReady: true
    });
  });

  it("does not claim Measure without verified scope", () => {
    const cta = resolvePathDetailMeasureCta({
      fullyMeasured: false,
      totalEdgeCount: 2,
      measuredEdgeCount: 1,
      scopeVerified: false,
      hasBreakers: false
    });
    expect(cta.measureReady).toBe(false);
    expect(cta.label).toMatch(/authorize scope/i);
    expect(cta.label).not.toBe("Measure hops");
    expect(cta.label).not.toBe("Measure path hops");
  });

  it("does not claim Measure when path is fully measured", () => {
    const withBreakers = resolvePathDetailMeasureCta({
      fullyMeasured: true,
      totalEdgeCount: 2,
      measuredEdgeCount: 2,
      scopeVerified: true,
      hasBreakers: true
    });
    expect(withBreakers.measureReady).toBe(false);
    expect(withBreakers.label).toBe("Choose a path breaker");
    expect(withBreakers.href).toBe("#path-breakers");

    const noBreakers = resolvePathDetailMeasureCta({
      fullyMeasured: true,
      totalEdgeCount: 2,
      measuredEdgeCount: 2,
      scopeVerified: true,
      hasBreakers: false
    });
    expect(noBreakers.label).toBe("Inspect hop receipts");
    expect(noBreakers.label).not.toBe("Measure hops");
    expect(noBreakers.label).not.toBe("Measure path hops");
  });

  it("never invents Measure when no edges exist", () => {
    const cta = resolvePathDetailMeasureCta({
      fullyMeasured: false,
      totalEdgeCount: 0,
      measuredEdgeCount: 0,
      scopeVerified: true,
      hasBreakers: false
    });
    expect(cta.measureReady).toBe(false);
    expect(cta.label).toBe("Inspect path");
  });
});

describe("MULTI_HOP_OPERATOR_JOURNEY", () => {
  it("points at in-product paths hub and getting-started", () => {
    expect(MULTI_HOP_OPERATOR_JOURNEY.pathsHref).toBe("/attack-paths");
    expect(MULTI_HOP_OPERATOR_JOURNEY.gettingStartedHref).toBe(
      "/getting-started"
    );
    expect(MULTI_HOP_OPERATOR_JOURNEY.label).toMatch(/multi-hop/i);
  });
});
