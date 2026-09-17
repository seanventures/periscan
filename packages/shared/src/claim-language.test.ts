import { describe, expect, it } from "vitest";

import type { AttackPath, AttackPathAssessment } from "./domain";
import {
  buildAttackPathRiskSummary,
  buildValidationSnapshotPathLanguage,
  claimSafePathValidationState,
  claimSafePathValidationStateForWrite,
  deriveAttackPathClaim,
  projectPathValidationState,
  summarizeExecutivePathClaimHonesty
} from "./claim-language";

function path(input?: {
  edgeBases?: Array<"Heuristic" | "Measured">;
  /** When true, Measured edges omit evidenceIds (dishonest stamp for honesty tests). */
  stripMeasuredEvidenceIds?: boolean;
  evidenceBasis?: "Heuristic" | "Measured";
  validationState?: AttackPath["validationState"];
}): AttackPath {
  const edgeBases = input?.edgeBases ?? ["Heuristic", "Heuristic"];
  return {
    confidence: 0.92,
    createdAt: "2026-07-16T12:00:00.000Z",
    entryNodeId: "11111111-1111-4111-8111-111111111111",
    evidenceBasis: input?.evidenceBasis ?? "Heuristic",
    evidenceIds: [],
    impactNodeId: "22222222-2222-4222-8222-222222222222",
    impactScore: 95,
    methodology: "Test path",
    name: "Internet to production",
    nonSnapPack: null,
    pathBreakers: [],
    pathEdges: edgeBases.map((evidenceBasis, index) => ({
      createdAt: "2026-07-16T12:00:00.000Z",
      evidenceBasis,
      // Wave A honesty: Measured hops need evidence IDs to count as measured.
      evidenceIds:
        evidenceBasis === "Measured" && !input?.stripMeasuredEvidenceIds
          ? [`55555555-5555-4555-8555-${String(index + 1).padStart(12, "0")}`]
          : [],
      measurementMethod:
        evidenceBasis === "Measured" ? "signed safe probe" : null,
      pathEdgeId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      pathId: "33333333-3333-4333-8333-333333333333",
      rationale: "Test edge",
      relationship: "LEADS_TO",
      sourceNodeId: "11111111-1111-4111-8111-111111111111",
      targetNodeId: "22222222-2222-4222-8222-222222222222",
      tenantId: "44444444-4444-4444-8444-444444444444",
      updatedAt: "2026-07-16T12:00:00.000Z"
    })),
    pathId: "33333333-3333-4333-8333-333333333333",
    pathNodes: [],
    tenantId: "44444444-4444-4444-8444-444444444444",
    updatedAt: "2026-07-16T12:00:00.000Z",
    validationState: input?.validationState ?? "Discovered"
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
      summary: "placeholder"
    }
  };
}

describe("attack-path claim language", () => {
  it("never upgrades a heuristic critical path to validated", () => {
    const attackPath = path({ validationState: "Validated" });
    const claim = deriveAttackPathClaim(attackPath);

    expect(claim.kind).toBe("HeuristicHypothesis");
    expect(claim.canClaimValidated).toBe(false);
    expect(buildAttackPathRiskSummary(attackPath, "Critical")).toBe(
      "Critical-risk heuristic path hypothesis requires measurement before any reachable or validated-path claim."
    );
  });

  it("calls a mixed path partially measured and reports exact hop coverage", () => {
    const attackPath = path({
      edgeBases: ["Measured", "Heuristic"],
      validationState: "Exploitable"
    });
    const claim = deriveAttackPathClaim(attackPath);

    expect(claim).toMatchObject({
      canClaimExploitable: false,
      kind: "PartiallyMeasuredHypothesis",
      measuredEdgeCount: 1,
      totalEdgeCount: 2
    });
    expect(buildAttackPathRiskSummary(attackPath, "Critical")).toContain(
      "1/2 hops measured"
    );
  });

  it("allows validated and exploitable language only for fully measured paths", () => {
    const validated = deriveAttackPathClaim(
      path({
        edgeBases: ["Measured", "Measured"],
        evidenceBasis: "Measured",
        validationState: "Validated"
      })
    );
    const exploitable = deriveAttackPathClaim(
      path({
        edgeBases: ["Measured", "Measured"],
        evidenceBasis: "Measured",
        validationState: "Exploitable"
      })
    );

    expect(validated.kind).toBe("MeasuredValidated");
    expect(validated.canClaimValidated).toBe(true);
    expect(exploitable.kind).toBe("MeasuredExploitable");
    expect(exploitable.canClaimExploitable).toBe(true);
  });

  it("does not upgrade path claims for non-path ValidationState partitions (P09-1)", () => {
    for (const validationState of [
      "Detected",
      "Blocked",
      "Fixed",
      "RequiresIntegration"
    ] as const) {
      const claim = deriveAttackPathClaim(
        path({
          edgeBases: ["Measured", "Measured"],
          evidenceBasis: "Measured",
          validationState
        })
      );
      expect(claim.kind).toBe("MeasuredPath");
      expect(claim.canClaimReachable).toBe(false);
      expect(claim.canClaimValidated).toBe(false);
      expect(claim.canClaimExploitable).toBe(false);
    }
  });

  it("does not treat a zero-hop path as fully measured", () => {
    expect(
      deriveAttackPathClaim(
        path({
          edgeBases: [],
          evidenceBasis: "Measured",
          validationState: "Validated"
        })
      ).kind
    ).toBe("HeuristicHypothesis");
  });

  it("never treats Measured hops without evidence IDs as measured (Wave A)", () => {
    const attackPath = path({
      edgeBases: ["Measured", "Measured"],
      evidenceBasis: "Measured",
      stripMeasuredEvidenceIds: true,
      validationState: "Validated"
    });
    const claim = deriveAttackPathClaim(attackPath);

    expect(claim.kind).toBe("HeuristicHypothesis");
    expect(claim.fullyMeasured).toBe(false);
    expect(claim.measuredEdgeCount).toBe(0);
    expect(claim.canClaimValidated).toBe(false);
    expect(claim.canClaimExploitable).toBe(false);
    expect(
      projectPathValidationState(attackPath).claimSafeValidationState
    ).toBe("Discovered");
  });

  it("never upgrades partially-measured Validated to claim-safe Validated", () => {
    const attackPath = path({
      edgeBases: ["Measured", "Heuristic"],
      evidenceBasis: "Heuristic",
      validationState: "Validated"
    });
    const projection = projectPathValidationState(attackPath);
    expect(projection.claim.kind).toBe("PartiallyMeasuredHypothesis");
    expect(projection.claim.canClaimValidated).toBe(false);
    expect(projection.claimSafeValidationState).toBe("Discovered");
    expect(projection.remapped).toBe(true);
  });

  it("builds snapshot headlines and counts from evidence certainty", () => {
    const heuristic = assessment(path({ validationState: "Validated" }));
    const measured = assessment(
      path({
        edgeBases: ["Measured", "Measured"],
        evidenceBasis: "Measured",
        validationState: "Validated"
      })
    );

    expect(buildValidationSnapshotPathLanguage([heuristic])).toMatchObject({
      headline: "Critical-risk path hypothesis requires validation."
    });
    expect(
      buildValidationSnapshotPathLanguage([measured, heuristic]).overview
    ).toContain("1 measured validated path");
  });
});

describe("projectPathValidationState (P09-2)", () => {
  it("explicitly remaps overclaiming certainty states on heuristic paths", () => {
    for (const recorded of ["Exploitable", "Validated", "Reachable"] as const) {
      const projection = projectPathValidationState(
        path({ validationState: recorded })
      );
      expect(projection.recordedValidationState).toBe(recorded);
      expect(projection.claimSafeValidationState).toBe("Discovered");
      expect(projection.remapped).toBe(true);
      expect(projection.remapReason).toMatch(/not fully measured/);
      expect(claimSafePathValidationState(path({ validationState: recorded }))).toBe(
        "Discovered"
      );
    }
  });

  it("keeps certainty states only when fully measured hop evidence supports them", () => {
    const fullyMeasured = {
      edgeBases: ["Measured", "Measured"] as Array<"Measured">,
      evidenceBasis: "Measured" as const
    };

    expect(
      projectPathValidationState(
        path({ ...fullyMeasured, validationState: "Exploitable" })
      )
    ).toMatchObject({
      claimSafeValidationState: "Exploitable",
      remapped: false,
      remapReason: null
    });
    expect(
      projectPathValidationState(
        path({ ...fullyMeasured, validationState: "Validated" })
      )
    ).toMatchObject({
      claimSafeValidationState: "Validated",
      remapped: false
    });
    expect(
      projectPathValidationState(
        path({ ...fullyMeasured, validationState: "Reachable" })
      )
    ).toMatchObject({
      claimSafeValidationState: "Reachable",
      remapped: false
    });
  });

  it("never upgrades Discovered/Inconclusive to Validated without measurement", () => {
    for (const recorded of ["Discovered", "Inconclusive"] as const) {
      const projection = projectPathValidationState(
        path({
          edgeBases: ["Measured", "Measured"],
          evidenceBasis: "Measured",
          validationState: recorded
        })
      );
      expect(projection.claimSafeValidationState).toBe(recorded);
      expect(projection.remapped).toBe(false);
    }
  });

  it("passes non-certainty states through for write clamp", () => {
    expect(
      claimSafePathValidationStateForWrite({
        evidenceBasis: "Heuristic",
        pathEdges: path().pathEdges,
        requestedValidationState: "Fixed"
      })
    ).toBe("Fixed");
    expect(
      claimSafePathValidationStateForWrite({
        evidenceBasis: "Heuristic",
        pathEdges: path().pathEdges,
        requestedValidationState: "Validated"
      })
    ).toBe("Discovered");
  });

  it("remaps partially measured paths that overclaim Exploitable", () => {
    const projection = projectPathValidationState(
      path({
        edgeBases: ["Measured", "Heuristic"],
        validationState: "Exploitable"
      })
    );
    expect(projection.claimSafeValidationState).toBe("Discovered");
    expect(projection.remapped).toBe(true);
    expect(projection.claim.kind).toBe("PartiallyMeasuredHypothesis");
  });

  it("summarizes executive path claim honesty (P04-11)", () => {
    const risk = (band: "High" | "Critical", score: number) => ({
      band,
      factors: [] as [],
      score,
      summary: "test"
    });
    const heuristicOnly: AttackPathAssessment[] = [
      {
        attackPath: path({ edgeBases: ["Heuristic", "Heuristic"] }),
        financialExposure: null,
        risk: risk("High", 80)
      }
    ];
    const honesty = summarizeExecutivePathClaimHonesty(heuristicOnly);
    expect(honesty.hypothesisMode).toBe(true);
    expect(honesty.fullyMeasuredCount).toBe(0);
    expect(honesty.heuristicPathCount).toBe(1);
    expect(honesty.measuredPathCount).toBe(0);

    const measured: AttackPathAssessment[] = [
      {
        attackPath: path({
          edgeBases: ["Measured", "Measured"],
          evidenceBasis: "Measured",
          validationState: "Validated"
        }),
        financialExposure: null,
        risk: risk("Critical", 95)
      }
    ];
    const measuredHonesty = summarizeExecutivePathClaimHonesty(measured);
    expect(measuredHonesty.hypothesisMode).toBe(false);
    expect(measuredHonesty.fullyMeasuredCount).toBe(1);
    expect(measuredHonesty.fullyMeasuredRatio).toBe(1);
  });
});
