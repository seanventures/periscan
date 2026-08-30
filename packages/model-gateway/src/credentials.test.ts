import { describe, expect, it } from "vitest";

import {
  decryptModelCredential,
  encryptModelCredential,
  getModelCredentialKeyMaterial,
  isModelCredentialReference
} from "./credentials.js";

const env = { PERISCAN_MODEL_CREDENTIAL_KEY: "unit-test-master-key" };

describe("model credential key material", () => {
  it("uses a dedicated configured key in any environment", () => {
    expect(
      getModelCredentialKeyMaterial({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_MODEL_CREDENTIAL_KEY: "real-key"
      })
    ).toBe("real-key");
  });

  it("allows fallback keys only outside production", () => {
    expect(
      getModelCredentialKeyMaterial({
        PERISCAN_JWT_SECRET: "jwt-key"
      })
    ).toBe("jwt-key");
    expect(getModelCredentialKeyMaterial({})).toBe(
      "periscan-dev-model-credential-key"
    );
  });

  it("refuses fallback keys in production", () => {
    expect(() =>
      getModelCredentialKeyMaterial({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_JWT_SECRET: "jwt-key"
      })
    ).toThrow(/refusing to encrypt model credentials with a fallback key/u);
  });
});

describe("model credential encryption", () => {
  it("round-trips a credential and never stores the plaintext", () => {
    const secret = "sk-test-abc123-very-secret";
    const reference = encryptModelCredential(secret, env);

    expect(reference).not.toContain(secret);
    expect(isModelCredentialReference(reference)).toBe(true);
    expect(decryptModelCredential(reference, env)).toBe(secret);
  });

  it("produces a different ciphertext each time (random iv/salt)", () => {
    const a = encryptModelCredential("same-secret", env);
    const b = encryptModelCredential("same-secret", env);

    expect(a).not.toEqual(b);
    expect(decryptModelCredential(a, env)).toBe("same-secret");
    expect(decryptModelCredential(b, env)).toBe("same-secret");
  });

  it("fails to decrypt with the wrong key", () => {
    const reference = encryptModelCredential("secret", env);

    expect(() =>
      decryptModelCredential(reference, {
        PERISCAN_MODEL_CREDENTIAL_KEY: "a-different-key"
      })
    ).toThrow();
  });

  it("rejects malformed references", () => {
    expect(() => decryptModelCredential("not-a-real-ref", env)).toThrow(
      /Unrecognized model credential reference/
    );
    expect(isModelCredentialReference("plain")).toBe(false);
  });
});
