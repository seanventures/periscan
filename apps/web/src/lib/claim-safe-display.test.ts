import { describe, expect, it } from "vitest";

import type { AttackPath, AttackPathAssessment, ValidatedFinding } from "@periscan/shared";

import {
  buildAttackPathClaimAriaLabel,
  formatPathClaimSnippet,
  formatSnapshotPathClaimPreview,
  projectFindingClaimDisplay
} from "./claim-safe-display";

const timestamp = "2026-07-16T12:00:00.000Z";
const tenantId = "44444444-4444-4444-8444-444444444444";
const pathId = "33333333-3333-4333-8333-333333333333";
const findingId = "11111111-1111-4111-8111-111111111111";

function baseFinding(
  overrides: Partial<ValidatedFinding> = {}
): ValidatedFinding {
  return {
    createdAt: timestamp,
    crossLinks: [],
    disposition: null,
    evidenceIds: [],
    exploitability: "Unknown",
    findingId,
    impact: "Test impact",
    measuredInNetwork: false,
    missingSignalImpact: null,
    nonSnapPack: null,
    pathProof: null,
    priorityReason: {
      businessContext: "n/a",
      controlEffectiveness: "n/a",
      exploitability: "n/a",
      pathContext: "n/a",
      summary: "n/a"
    },
    priorityFormula: "n/a",
    priorityScore: 10,
    riskFactors: [],
    relatedAssetIds: [],
    relatedControlIds: [],
    relatedPathIds: [],
    relatedRemediationIds: [],
    remediation: "n/a",
    severity: "Medium",
    source: "test",
    sourceEntityId: findingId,
    sourceEntityType: "Exposure",
    sourceMotion: "EXV",
    status: "New",
    tenantId,
    title: "Test finding",
    updatedAt: timestamp,
    validationState: "Discovered",
    ...overrides
  } as ValidatedFinding;
}

function heuristicPath(
  validationState: AttackPath["validationState"] = "Validated"
): AttackPath {
  return {
    confidence: 0.9,
    createdAt: timestamp,
    entryNodeId: "11111111-1111-4111-8111-111111111111",
    evidenceBasis: "Heuristic",
    evidenceIds: [],
    impactNodeId: "22222222-2222-4222-8222-222222222222",
    impactScore: 90,
    methodology: "test",
    name: "Heuristic path",
    nonSnapPack: null,
    pathBreakers: [],
    pathEdges: [
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [],
        measurementMethod: null,
        pathEdgeId: "00000000-0000-4000-8000-000000000001",
        pathId,
        rationale: "hop",
        relationship: "LEADS_TO",
        sourceNodeId: "11111111-1111-4111-8111-111111111111",
        targetNodeId: "22222222-2222-4222-8222-222222222222",
        tenantId,
        updatedAt: timestamp
      }
    ],
    pathId,
    pathNodes: [],
    tenantId,
    updatedAt: timestamp,
    validationState
  };
}

function assessment(attackPath: AttackPath): AttackPathAssessment {
  return {
    attackPath,
    financialExposure: null,
    risk: {
      band: "Critical",
      factors: [],
      score: 95,
      summary: "test"
    }
  };
}

describe("projectFindingClaimDisplay", () => {
  it("passes non-path findings through without remap", () => {
    const finding = baseFinding({ validationState: "Validated" });
    const display = projectFindingClaimDisplay(finding);
    expect(display.pathLinked).toBe(false);
    expect(display.displayValidationState).toBe("Validated");
    expect(display.remapped).toBe(false);
    expect(display.ariaLabel).toBe("Validation state Validated");
  });

  it("never displays raw Validated for path-linked partial measurement", () => {
    const finding = baseFinding({
      sourceEntityType: "AttackPath",
      relatedPathIds: [pathId],
      validationState: "Validated",
      pathProof: {
        blastRadiusSummary: "assets",
        chokePoints: ["breaker"],
        claimDisplayLabel: "Partially measured hypothesis",
        entryPoint: "A",
        fullyMeasured: false,
        intermediateSteps: [],
        measuredEdgeCount: 1,
        objective: "B",
        objectiveState: "Unknown",
        totalEdgeCount: 2
      }
    });
    const display = projectFindingClaimDisplay(finding);
    expect(display.pathLinked).toBe(true);
    expect(display.displayValidationState).toBe("Discovered");
    expect(display.remapped).toBe(true);
    expect(display.claimDisplayLabel).toBe("Partially measured hypothesis");
    expect(display.ariaLabel).toMatch(/claim-safe/i);
    expect(display.ariaLabel).toMatch(/remapped from recorded Validated/i);
    expect(display.remapReason).toMatch(/1\/2 hops Measured/i);
  });

  it("keeps Validated when pathProof is fully measured", () => {
    const finding = baseFinding({
      sourceEntityType: "AttackPath",
      relatedPathIds: [pathId],
      validationState: "Validated",
      pathProof: {
        blastRadiusSummary: "assets",
        chokePoints: ["breaker"],
        claimDisplayLabel: "Measured validated path",
        entryPoint: "A",
        fullyMeasured: true,
        intermediateSteps: [],
        measuredEdgeCount: 2,
        objective: "B",
        objectiveState: "Reached",
        totalEdgeCount: 2
      }
    });
    const display = projectFindingClaimDisplay(finding);
    expect(display.displayValidationState).toBe("Validated");
    expect(display.remapped).toBe(false);
    expect(display.fullyMeasured).toBe(true);
    expect(display.ariaLabel).toMatch(/claim-safe/i);
    expect(display.ariaLabel).not.toMatch(/remapped from/i);
  });

  it("remaps path-linked certainty when hop proof is missing", () => {
    const finding = baseFinding({
      sourceEntityType: "AttackPath",
      relatedPathIds: [pathId],
      validationState: "Exploitable",
      pathProof: null
    });
    const display = projectFindingClaimDisplay(finding);
    expect(display.displayValidationState).toBe("Discovered");
    expect(display.remapped).toBe(true);
    expect(display.claimDisplayLabel).toBe("Heuristic hypothesis");
  });
});

describe("buildAttackPathClaimAriaLabel", () => {
  it("includes claim-safe and remapped note for overclaiming Validated", () => {
    const label = buildAttackPathClaimAriaLabel(heuristicPath("Validated"));
    expect(label).toMatch(/claim-safe/i);
    expect(label).toMatch(/remapped from recorded Validated/i);
    expect(label).toMatch(/Heuristic hypothesis/i);
    // P08: title always shows recorded vs evidence certainty.
    expect(label).toMatch(
      /recorded Validated vs evidence certainty Heuristic hypothesis/i
    );
  });

  it("includes claim-safe without remapped when states agree", () => {
    const label = buildAttackPathClaimAriaLabel(heuristicPath("Discovered"));
    expect(label).toMatch(/claim-safe/i);
    expect(label).not.toMatch(/remapped from/i);
    expect(label).toMatch(
      /recorded Discovered vs evidence certainty Heuristic hypothesis/i
    );
  });
});

describe("formatPathClaimSnippet / formatSnapshotPathClaimPreview", () => {
  it("formats path snippet claim-safe with remap disclosure", () => {
    const snippet = formatPathClaimSnippet(heuristicPath("Validated"));
    expect(snippet).toMatch(/Heuristic hypothesis/i);
    expect(snippet).toMatch(/claim-safe/i);
    expect(snippet).toMatch(/remapped from Validated/i);
    expect(snippet).not.toMatch(/^Validated/);
  });

  it("formats snapshot list preview from assessments", () => {
    const preview = formatSnapshotPathClaimPreview([
      assessment(heuristicPath("Validated"))
    ]);
    expect(preview).toMatch(/claim-safe/i);
    expect(preview).toMatch(/hypothesis/i);
    expect(preview).toMatch(/Heuristic hypothesis/i);
  });

  it("empty snapshot preview stays honest", () => {
    expect(formatSnapshotPathClaimPreview([])).toMatch(/claim-safe empty state/i);
  });
});
