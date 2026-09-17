import { describe, expect, it } from "vitest";

import {
  decryptIntegrationConfig,
  decryptSecret,
  encryptIntegrationConfig,
  encryptSecret,
  getIntegrationCredentialKeyMaterial,
  integrationSecretFieldKeys,
  isIntegrationSecretReference
} from "./integration-credentials.js";

const ENV = { PERISCAN_INTEGRATION_CREDENTIAL_KEY: "unit-test-key" };

describe("integration credential key material", () => {
  it("uses the dedicated key in any environment", () => {
    expect(
      getIntegrationCredentialKeyMaterial({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_INTEGRATION_CREDENTIAL_KEY: "dedicated-key"
      })
    ).toBe("dedicated-key");
  });

  it("allows non-production fallback keys for local development", () => {
    expect(
      getIntegrationCredentialKeyMaterial({
        PERISCAN_JWT_SECRET: "dev-jwt-secret"
      })
    ).toBe("dev-jwt-secret");
    expect(
      getIntegrationCredentialKeyMaterial({
        PERISCAN_MODEL_CREDENTIAL_KEY: "local-model-key"
      })
    ).toBe("local-model-key");
    expect(getIntegrationCredentialKeyMaterial({})).toBe(
      "periscan-dev-integration-credential-key"
    );
    expect(
      getIntegrationCredentialKeyMaterial({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "staging"
      })
    ).toBe("periscan-dev-integration-credential-key");
  });

  it("refuses fallback keys in production (fails closed)", () => {
    expect(() =>
      getIntegrationCredentialKeyMaterial({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_JWT_SECRET: "jwt-secret"
      })
    ).toThrow(
      /refusing to encrypt integration credentials with a fallback key/u
    );
    expect(() =>
      getIntegrationCredentialKeyMaterial({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_MODEL_CREDENTIAL_KEY: "model-key"
      })
    ).toThrow(/fallback key/u);
  });

  it("still round-trips secrets with a real key configured in production", () => {
    const prodEnv = {
      PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
      PERISCAN_INTEGRATION_CREDENTIAL_KEY: "prod-grade-key"
    };
    const ref = encryptSecret("crowdstrike-client-secret", prodEnv);
    expect(ref).not.toContain("crowdstrike-client-secret");
    expect(decryptSecret(ref, prodEnv)).toBe("crowdstrike-client-secret");
  });
});

describe("integration credentials", () => {
  it("round-trips a secret and produces an opaque reference", () => {
    const ref = encryptSecret("super-secret-token", ENV);
    expect(ref).not.toContain("super-secret-token");
    expect(isIntegrationSecretReference(ref)).toBe(true);
    expect(decryptSecret(ref, ENV)).toBe("super-secret-token");
  });

  it("rejects tampered or malformed references", () => {
    expect(isIntegrationSecretReference("plaintext")).toBe(false);
    expect(() => decryptSecret("v1.bad.ref", ENV)).toThrow();
  });

  it("encrypts only secret fields and is idempotent", () => {
    const secretKeys = ["apiSecret", "apiToken"];
    const config = {
      apiSecret: "shhh",
      apiToken: "tok",
      baseUrl: "https://api.example.com",
      connectorKey: "darktrace",
      mockMode: false
    };
    const encrypted = encryptIntegrationConfig(config, secretKeys, ENV);

    // Non-secret fields stay readable for lookups/filters.
    expect(encrypted.baseUrl).toBe("https://api.example.com");
    expect(encrypted.connectorKey).toBe("darktrace");
    expect(encrypted.mockMode).toBe(false);
    // Secret fields are ciphertext references, not plaintext.
    expect(encrypted.apiSecret).not.toBe("shhh");
    expect(encrypted.apiToken).not.toBe("tok");
    expect(isIntegrationSecretReference(encrypted.apiSecret)).toBe(true);

    // Re-encrypting an already-encrypted config does not double-wrap.
    const reEncrypted = encryptIntegrationConfig(encrypted, secretKeys, ENV);
    expect(reEncrypted.apiSecret).toBe(encrypted.apiSecret);

    // Decrypt restores plaintext for runtime use.
    const decrypted = decryptIntegrationConfig(encrypted, secretKeys, ENV);
    expect(decrypted.apiSecret).toBe("shhh");
    expect(decrypted.apiToken).toBe("tok");
  });

  it("passes through legacy plaintext on decrypt (incremental rollout)", () => {
    const decrypted = decryptIntegrationConfig(
      { apiToken: "legacy-plaintext", baseUrl: "https://x" },
      ["apiToken"],
      ENV
    );
    expect(decrypted.apiToken).toBe("legacy-plaintext");
  });

  it("derives secret field keys from a connector manifest auth method", () => {
    const connector = {
      manifest: {
        authMethods: [
          { fields: [], kind: "mock" },
          {
            fields: [
              { key: "baseUrl", secret: false },
              { key: "apiToken", secret: true },
              { key: "apiSecret", secret: true }
            ],
            kind: "apiKeys"
          }
        ]
      }
    } as unknown as Parameters<typeof integrationSecretFieldKeys>[0];

    expect(integrationSecretFieldKeys(connector, "apiKeys")).toEqual([
      "apiToken",
      "apiSecret"
    ]);
    expect(integrationSecretFieldKeys(connector, "mock")).toEqual([]);
    expect(integrationSecretFieldKeys(connector, "unknown")).toEqual([]);
  });
});
