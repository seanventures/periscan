import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync
} from "node:crypto";

// Integration connector credentials (CrowdStrike client secrets, Splunk tokens,
// Tenable secret keys, PAN-OS API keys, etc.) are encrypted at rest inside
// Integration.config. Only fields the connector manifest marks secret:true are
// encrypted; non-secret config (connectorKey, mockMode, baseUrl) stays readable
// so existing lookups/filters keep working. Mirrors the model-gateway credential
// cipher (packages/model-gateway/src/credentials.ts).

const CREDENTIAL_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

const DEV_INTEGRATION_CREDENTIAL_KEY =
  "periscan-dev-integration-credential-key";

export type IntegrationSecretConnector = {
  manifest: {
    authMethods: Array<{
      fields: Array<{ key: string; secret?: boolean }>;
      kind: string;
    }>;
  };
};

export function getIntegrationCredentialKeyMaterial(
  env: NodeJS.ProcessEnv = process.env
): string {
  if (env.PERISCAN_INTEGRATION_CREDENTIAL_KEY) {
    return env.PERISCAN_INTEGRATION_CREDENTIAL_KEY;
  }

  // Fail closed in production: integration credentials need a key isolated from
  // token signing and model-provider credentials so key rotation and blast radius
  // are explicit customer deployment decisions.
  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production") {
    throw new Error(
      "Set PERISCAN_INTEGRATION_CREDENTIAL_KEY in production; refusing to encrypt integration credentials with a fallback key."
    );
  }

  const configuredFallback =
    env.PERISCAN_MODEL_CREDENTIAL_KEY ?? env.PERISCAN_JWT_SECRET;
  if (configuredFallback) {
    return configuredFallback;
  }

  return DEV_INTEGRATION_CREDENTIAL_KEY;
}

function deriveKey(keyMaterial: string, salt: Buffer): Buffer {
  return scryptSync(keyMaterial, salt, KEY_LENGTH);
}

export function isIntegrationSecretReference(value: unknown): value is string {
  return (
    typeof value === "string" && value.startsWith(`${CREDENTIAL_VERSION}.`)
  );
}

export function encryptSecret(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(getIntegrationCredentialKeyMaterial(env), salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  return [
    CREDENTIAL_VERSION,
    salt.toString("base64url"),
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}

export function decryptSecret(
  reference: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const parts = reference.split(".");
  const [version, saltB64, ivB64, authTagB64, ciphertextB64] = parts;
  if (
    parts.length !== 5 ||
    version !== CREDENTIAL_VERSION ||
    !saltB64 ||
    !ivB64 ||
    !authTagB64 ||
    ciphertextB64 === undefined
  ) {
    throw new Error("Unrecognized integration credential reference format.");
  }

  const salt = Buffer.from(saltB64, "base64url");
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(authTagB64, "base64url");
  const ciphertext = Buffer.from(ciphertextB64, "base64url");
  const key = deriveKey(getIntegrationCredentialKeyMaterial(env), salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString("utf8");
}

// Resolve the secret field keys for a connector + chosen auth method from its
// manifest (authMethods[].fields[].secret).
export function integrationSecretFieldKeys(
  connector: IntegrationSecretConnector,
  authType: string
): string[] {
  const method = connector.manifest.authMethods.find(
    (candidate) => candidate.kind === authType
  );
  if (!method) {
    return [];
  }
  return method.fields
    .filter((field) => field.secret)
    .map((field) => field.key);
}

function isPlainConfig(config: unknown): config is Record<string, unknown> {
  return (
    typeof config === "object" && config !== null && !Array.isArray(config)
  );
}

// Encrypt every secret field present as a non-empty plaintext string. Already
// encrypted references are left as-is (idempotent re-writes).
export function encryptIntegrationConfig(
  config: unknown,
  secretKeys: string[],
  env: NodeJS.ProcessEnv = process.env
): Record<string, unknown> {
  const base = isPlainConfig(config) ? { ...config } : {};
  for (const key of secretKeys) {
    const value = base[key];
    if (
      typeof value === "string" &&
      value.length > 0 &&
      !isIntegrationSecretReference(value)
    ) {
      base[key] = encryptSecret(value, env);
    }
  }
  return base;
}

// Decrypt secret fields for runtime use. Legacy plaintext values (not yet
// migrated) pass through unchanged, so this is safe to roll out incrementally.
export function decryptIntegrationConfig(
  config: unknown,
  secretKeys: string[],
  env: NodeJS.ProcessEnv = process.env
): Record<string, unknown> {
  const base = isPlainConfig(config) ? { ...config } : {};
  for (const key of secretKeys) {
    const value = base[key];
    if (isIntegrationSecretReference(value)) {
      base[key] = decryptSecret(value, env);
    }
  }
  return base;
}
