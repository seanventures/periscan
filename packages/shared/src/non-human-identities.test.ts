import { describe, expect, it } from "vitest";

import { RegisterNonHumanIdentityInputSchema } from "./domain.js";

describe("non-human identity contracts", () => {
  it("accepts only metadata and rejects secret-bearing fields", () => {
    const safe = RegisterNonHumanIdentityInputSchema.parse({
      credentialFingerprint:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      displayName: "Production deployer",
      externalId: "deploy-key-17",
      identityType: "APIKey",
      provider: "GitHub"
    });
    expect(safe.privileges).toEqual([]);
    expect(safe.resourceAccess).toEqual([]);

    expect(() =>
      RegisterNonHumanIdentityInputSchema.parse({
        displayName: "Unsafe key",
        externalId: "key-18",
        identityType: "APIKey",
        provider: "GitHub",
        secret: "plaintext-credential"
      })
    ).toThrow();
    expect(() =>
      RegisterNonHumanIdentityInputSchema.parse({
        credentialFingerprint: "not-a-sha256-fingerprint",
        displayName: "Unsafe fingerprint",
        externalId: "key-19",
        identityType: "APIKey",
        provider: "GitHub"
      })
    ).toThrow(/SHA-256 fingerprint/u);
  });
});
