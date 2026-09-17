import type { ModelProviderPricing } from "@periscan/shared";

export interface NormalizedModelUsage {
  cachedInputTokens: number;
  inputTokens: number;
  outputTokens: number;
}

export function calculateModelCostMicrousd(
  usage: NormalizedModelUsage,
  pricing: ModelProviderPricing
) {
  const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
  const uncached = usage.inputTokens - cached;
  const numerator =
    BigInt(uncached) * BigInt(pricing.inputMicrousdPerMillion) +
    BigInt(cached) * BigInt(pricing.cachedInputMicrousdPerMillion) +
    BigInt(usage.outputTokens) * BigInt(pricing.outputMicrousdPerMillion);
  return (numerator + 999_999n) / 1_000_000n;
}

export function selectSafeModelProviderRoute(input: {
  primaryProviderId: string;
  providers: Array<{ modelProviderId: string; status: string }>;
  routingProviderIds: string[];
}) {
  const byId = new Map(
    input.providers.map((provider) => [provider.modelProviderId, provider])
  );
  const primary = byId.get(input.primaryProviderId);
  if (primary?.status === "Active") {
    return {
      modelProviderId: primary.modelProviderId,
      reason: "Session primary provider is active; no failover was needed."
    };
  }
  for (const providerId of input.routingProviderIds) {
    const provider = byId.get(providerId);
    if (provider?.status === "Active") {
      return {
        modelProviderId: providerId,
        reason:
          "Primary provider was unavailable before the turn started; routed at the safe pre-turn checkpoint."
      };
    }
  }
  return null;
}

export function evaluateModelBudget(input: {
  enforcementEnabled: boolean;
  monthlyCostMicrousd: bigint;
  monthlyLimitMicrousd: bigint;
  minuteRequestCount: number;
  perMinuteRequestLimit: number;
}) {
  if (!input.enforcementEnabled) {
    return { allowed: true, reason: "Budget enforcement is disabled." };
  }
  if (input.monthlyCostMicrousd >= input.monthlyLimitMicrousd) {
    return {
      allowed: false,
      reason: "Monthly model budget is exhausted."
    };
  }
  if (input.minuteRequestCount >= input.perMinuteRequestLimit) {
    return {
      allowed: false,
      reason: "Per-minute model request limit is exhausted."
    };
  }
  return {
    allowed: true,
    reason: "Budget and request-rate limits allow the turn."
  };
}
