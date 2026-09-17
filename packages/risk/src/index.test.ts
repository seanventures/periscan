import { describe, expect, it } from "vitest";

import { calculateRiskScore, countHighRiskAttackPaths } from "./index";

describe("@periscan/risk", () => {
  it("re-exports the canonical evidence-backed risk scoring engine", () => {
    const score = calculateRiskScore({
      businessCriticality: "Critical",
      confidence: 0.95,
      controlResponse: "Missed",
      exploitability: "ProofObserved",
      impactScore: 92,
      internetExposed: true,
      privilegedPath: true,
      reachability: "InternetExposed",
      validationState: "Validated"
    });

    expect(score.band).toBe("Critical");
    expect(score.factors.map((factor) => factor.key)).toContain("confidence");
  });

  it("keeps high-risk path counting available from the risk package", () => {
    expect(
      countHighRiskAttackPaths([
        {
          attackPath: {
            confidence: 0.95,
            createdAt: new Date().toISOString(),
            entryNodeId: "entry",
            evidenceBasis: "Measured",
            evidenceIds: ["evidence-1"],
            impactNodeId: "impact",
            impactScore: 92,
            name: "critical path",
            pathBreakers: [],
            pathEdges: [],
            pathId: "path-1",
            pathNodes: [],
            tenantId: "tenant",
            updatedAt: new Date().toISOString(),
            validationState: "Validated"
          },
          risk: {
            band: "High",
            factors: [],
            score: 82,
            summary: "High-risk path."
          }
        }
      ])
    ).toBe(1);
  });
});
