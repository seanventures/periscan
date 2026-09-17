import { describe, expect, it } from "vitest";

import {
  calculateModelCostMicrousd,
  evaluateModelBudget,
  selectSafeModelProviderRoute
} from "./finops.js";

describe("model gateway FinOps", () => {
  it("prices cached and uncached tokens without floating-point drift", () => {
    expect(
      calculateModelCostMicrousd(
        { cachedInputTokens: 400, inputTokens: 1_000, outputTokens: 200 },
        {
          cachedInputMicrousdPerMillion: 250_000,
          inputMicrousdPerMillion: 1_000_000,
          modelProviderId: "00000000-0000-4000-8000-000000000001",
          outputMicrousdPerMillion: 2_000_000
        }
      )
    ).toBe(1_100n);
  });

  it("only fails over before a turn to an explicitly routed active provider", () => {
    expect(
      selectSafeModelProviderRoute({
        primaryProviderId: "primary",
        providers: [
          { modelProviderId: "primary", status: "Error" },
          { modelProviderId: "fallback", status: "Active" }
        ],
        routingProviderIds: ["fallback"]
      })
    ).toMatchObject({ modelProviderId: "fallback" });
    expect(
      selectSafeModelProviderRoute({
        primaryProviderId: "primary",
        providers: [{ modelProviderId: "primary", status: "Error" }],
        routingProviderIds: []
      })
    ).toBeNull();
  });

  it("enforces both monthly cost and request-rate ceilings", () => {
    expect(
      evaluateModelBudget({
        enforcementEnabled: true,
        minuteRequestCount: 1,
        monthlyCostMicrousd: 100n,
        monthlyLimitMicrousd: 100n,
        perMinuteRequestLimit: 10
      })
    ).toMatchObject({ allowed: false });
    expect(
      evaluateModelBudget({
        enforcementEnabled: true,
        minuteRequestCount: 10,
        monthlyCostMicrousd: 0n,
        monthlyLimitMicrousd: 100n,
        perMinuteRequestLimit: 10
      })
    ).toMatchObject({ allowed: false });
  });
});
