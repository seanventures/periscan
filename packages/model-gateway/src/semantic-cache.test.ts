import { describe, expect, it } from "vitest";

import {
  buildModelSemanticCacheKey,
  digestModelContext,
  fingerprintModelIntent,
  hashModelPrompt,
  isSemanticCacheEligible,
  redactModelTextForStorage
} from "./semantic-cache.js";

describe("model semantic cache policy", () => {
  it("matches canonicalized intent without retaining prompt text", () => {
    const first = fingerprintModelIntent(
      "Show the validated exposures, please"
    );
    const second = fingerprintModelIntent("validated exposure show");

    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashModelPrompt("secret prompt")).not.toContain("secret");
  });

  it("isolates cache keys by provider, model, policy, mode, and context", () => {
    const base = {
      adapterAlias: null,
      contextDigest: "context-a",
      model: "model-a",
      modelPolicyProfileId: "policy-a",
      modelProviderId: "provider-a",
      precisionMode: "ProviderManaged",
      semanticFingerprint: "intent-a",
      sessionMode: "PlanOnly" as const
    };

    expect(buildModelSemanticCacheKey(base)).not.toBe(
      buildModelSemanticCacheKey({ ...base, modelProviderId: "provider-b" })
    );
  });

  it("only admits current low/moderate read-only context", () => {
    const now = new Date("2026-07-15T00:00:00.000Z");
    expect(
      isSemanticCacheEligible({
        bundleExpiresAt: null,
        mode: "ReadOnlyEvidence",
        now,
        sensitivityLevel: "Moderate"
      })
    ).toBe(true);
    expect(
      isSemanticCacheEligible({
        bundleExpiresAt: null,
        mode: "SafeValidation",
        now,
        sensitivityLevel: "Low"
      })
    ).toBe(false);
    expect(
      isSemanticCacheEligible({
        bundleExpiresAt: null,
        mode: "PlanOnly",
        now,
        sensitivityLevel: "Restricted"
      })
    ).toBe(false);
  });

  it("creates stable context digests and redacts stored responses", () => {
    const context = {
      items: [
        {
          entityId: "asset-a",
          entityType: "Asset",
          evidenceIds: ["evidence-b", "evidence-a"],
          redactionStatus: "Redacted"
        }
      ],
      redactionPolicy: "default",
      sensitivityLevel: "Moderate" as const
    };
    expect(digestModelContext(context)).toBe(digestModelContext(context));
    expect(
      redactModelTextForStorage("Authorization: Bearer very-secret-token")
    ).not.toContain("very-secret-token");
  });
});
