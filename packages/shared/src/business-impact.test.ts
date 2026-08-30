import { describe, expect, it } from "vitest";

import {
  BUSINESS_IMPACT_SCENARIOS,
  BusinessImpactScenarioSchema,
  ReviewAssetValuationVersionInputSchema,
  SubmitAssetValuationVersionInputSchema
} from "./business-impact";

const validInput = {
  assumptionNotes: "Includes recovery, response, and lost transaction costs.",
  businessServiceName: "Payments",
  changeReason: "Initial finance-reviewed estimate for the payment service.",
  confidence: "Medium" as const,
  currency: "USD" as const,
  lossEventFrequencyPerYear: {
    maximum: 2,
    minimum: 0.1,
    mostLikely: 0.5
  },
  lossMagnitudeUsd: {
    maximum: 1_000_000,
    minimum: 100_000,
    mostLikely: 300_000
  },
  scenarioId: "availability-disruption" as const,
  sources: [
    {
      asOfDate: "2026-07-01",
      note: "Reviewed quarterly service interruption history.",
      owner: "Finance operations",
      reference: "FIN-RISK-2026-Q3",
      sourceType: "FinanceModel" as const
    }
  ]
};

describe("business-impact contracts", () => {
  it("ships scenario prompts without fabricated benchmark values", () => {
    expect(BUSINESS_IMPACT_SCENARIOS).toHaveLength(4);
    for (const scenario of BUSINESS_IMPACT_SCENARIOS) {
      expect(() => BusinessImpactScenarioSchema.parse(scenario)).not.toThrow();
      expect(JSON.stringify(scenario)).not.toMatch(
        /minimum|maximum|mostLikely/u
      );
    }
  });

  it("requires ordered assumptions, named provenance, and a change reason", () => {
    expect(
      SubmitAssetValuationVersionInputSchema.parse(validInput)
    ).toMatchObject({
      currency: "USD",
      scenarioId: "availability-disruption",
      sources: [{ reference: "FIN-RISK-2026-Q3" }]
    });
    expect(() =>
      SubmitAssetValuationVersionInputSchema.parse({
        ...validInput,
        sources: []
      })
    ).toThrow();
  });

  it("requires a review decision, durable reference, and useful note", () => {
    expect(
      ReviewAssetValuationVersionInputSchema.parse({
        decision: "Approve",
        reviewNote: "Finance confirmed the range and stated scenario boundary.",
        reviewReference: "RISK-COMMITTEE-2026-07-16"
      }).decision
    ).toBe("Approve");
    expect(() =>
      ReviewAssetValuationVersionInputSchema.parse({
        decision: "Approve",
        reviewNote: "ok",
        reviewReference: "x"
      })
    ).toThrow();
  });
});
