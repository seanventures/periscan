import { describe, expect, it } from "vitest";

import {
  assessAttackPathRisk,
  calculateRiskScore,
  estimateFinancialExposure
} from "./risk";

// Inputs that, absent any fixed/verification override, score as Critical — used
// to prove the Fixed short-circuit genuinely overrides residual risk.
const HIGH_RISK_INPUT = {
  businessCriticality: "Critical" as const,
  confidence: 0.94,
  controlResponse: "Missed" as const,
  impactScore: 91,
  internetExposed: true,
  privilegedPath: true,
  validationState: "Validated" as const,
  verificationStatus: null
};

describe("calculateRiskScore band coverage", () => {
  it("does not accept a Fixed state as proof without an explicit verification outcome", () => {
    const risk = calculateRiskScore({
      ...HIGH_RISK_INPUT,
      validationState: "Fixed"
    });

    expect(risk.band).not.toBe("Fixed");
    expect(risk.summary).not.toContain("fixed based on");
  });

  it("scores a path Fixed when a verification event marks it Fixed", () => {
    const risk = calculateRiskScore({
      ...HIGH_RISK_INPUT,
      verificationStatus: "Fixed"
    });

    expect(risk.band).toBe("Fixed");
    expect(risk.score).toBe(0);
    // Presentation residual: risk band closed wording, not remediation Fixed write
    expect(risk.summary).toMatch(/Risk band closed \(verified\)/i);
    expect(risk.summary).toMatch(/Remediation Fixed remains/i);
  });

  it("is monotonic in impact: a higher-impact path never scores below a lower-impact one", () => {
    const base = {
      businessCriticality: "Moderate" as const,
      confidence: 0.6,
      controlResponse: null,
      internetExposed: false,
      privilegedPath: false,
      validationState: "Validated" as const,
      verificationStatus: null
    };
    const high = calculateRiskScore({ ...base, impactScore: 95 });
    const low = calculateRiskScore({ ...base, impactScore: 20 });

    expect(high.score).toBeGreaterThanOrEqual(low.score);
    // A genuinely-present, unfixed path scores above zero (not a Fixed override).
    expect(high.score).toBeGreaterThan(0);
    expect(high.band).not.toBe("Fixed");
  });

  it("uses explicit PRD risk inputs without requiring existing callers to supply every field", () => {
    const highContext = calculateRiskScore({
      ...HIGH_RISK_INPUT,
      exploitability: "Exploitable",
      knownExploitation: true,
      reachability: "InternetExposed",
      recurrence: 2,
      remediationStatus: "StillExposed",
      sensitiveData: true,
      threatRelevance: 0.95
    });
    const lowerContext = calculateRiskScore({
      ...HIGH_RISK_INPUT,
      controlResponse: "Blocked",
      exploitability: "NotExploitable",
      knownExploitation: false,
      reachability: "NotReachable",
      recurrence: 0,
      remediationStatus: "Mitigated",
      sensitiveData: false,
      threatRelevance: 0.1
    });

    expect(highContext.score).toBeGreaterThan(lowerContext.score);
    expect(highContext.factors.map((factor) => factor.key)).toEqual(
      expect.arrayContaining([
        "reachability",
        "exploitability",
        "control-response",
        "threat-relevance",
        "known-exploitation",
        "recurrence",
        "sensitive-data",
        "remediation-status"
      ])
    );
    const contributionSum = highContext.factors.reduce(
      (total, factor) => total + factor.contribution,
      0
    );
    expect(Math.min(100, Math.max(0, contributionSum))).toBe(highContext.score);
  });

  it("does not mark remediation-status Fixed as a verified fix without verification evidence", () => {
    const risk = calculateRiskScore({
      ...HIGH_RISK_INPUT,
      remediationStatus: "Fixed"
    });

    expect(risk.band).not.toBe("Fixed");
    expect(risk.score).toBeGreaterThan(0);
    expect(risk.factors).toContainEqual(
      expect.objectContaining({
        key: "remediation-status",
        value: "Fixed"
      })
    );
  });

  it("derives assessment wording from hop evidence instead of risk severity", () => {
    const assessment = assessAttackPathRisk({
      confidence: 0.95,
      createdAt: "2026-07-16T12:00:00.000Z",
      entryNodeId: "11111111-1111-4111-8111-111111111111",
      evidenceBasis: "Heuristic",
      evidenceIds: [],
      impactNodeId: "22222222-2222-4222-8222-222222222222",
      impactScore: 100,
      methodology: "Heuristic correlation",
      name: "Internet to production admin",
      nonSnapPack: null,
      pathBreakers: [],
      pathEdges: [
        {
          createdAt: "2026-07-16T12:00:00.000Z",
          evidenceBasis: "Heuristic",
          evidenceIds: [],
          measurementMethod: null,
          pathEdgeId: "33333333-3333-4333-8333-333333333333",
          pathId: "44444444-4444-4444-8444-444444444444",
          rationale: "Inferred relationship",
          relationship: "LEADS_TO",
          sourceNodeId: "11111111-1111-4111-8111-111111111111",
          targetNodeId: "22222222-2222-4222-8222-222222222222",
          tenantId: "55555555-5555-4555-8555-555555555555",
          updatedAt: "2026-07-16T12:00:00.000Z"
        }
      ],
      pathId: "44444444-4444-4444-8444-444444444444",
      pathNodes: [],
      tenantId: "55555555-5555-4555-8555-555555555555",
      updatedAt: "2026-07-16T12:00:00.000Z",
      validationState: "Validated"
    });

    expect(assessment.risk.band).toBe("Critical");
    expect(assessment.risk.summary).toContain("heuristic path hypothesis");
    expect(assessment.risk.summary).not.toContain("Validated high-impact");
  });
});

describe("estimateFinancialExposure", () => {
  it("calculates transparent PERT annualized loss exposure from user-supplied ranges", () => {
    const estimate = estimateFinancialExposure({
      assetId: "11111111-1111-4111-8111-111111111111",
      assetName: "Production payments API",
      valuation: {
        assumptionNotes:
          "Range includes incident response, lost transactions, and customer notification.",
        businessServiceName: "Payments",
        confidence: "Medium",
        currency: "USD",
        lossEventFrequencyPerYear: {
          maximum: 2,
          minimum: 0.5,
          mostLikely: 1
        },
        lossMagnitudeUsd: {
          maximum: 400_000,
          minimum: 100_000,
          mostLikely: 200_000
        },
        updatedAt: "2026-07-14T12:00:00.000Z",
        updatedBy: "22222222-2222-4222-8222-222222222222"
      }
    });

    expect(estimate.expectedLossEventFrequencyPerYear).toBeCloseTo(1.08, 2);
    expect(estimate.expectedLossMagnitudeUsd).toBeCloseTo(216_666.67, 2);
    expect(estimate.annualizedLossExposureUsd).toBeCloseTo(234_722.22, 2);
    expect(estimate.lowerBoundUsd).toBe(50_000);
    expect(estimate.upperBoundUsd).toBe(800_000);
    expect(estimate.assumptions.at(-1)).toContain("not measured loss history");
  });
});
