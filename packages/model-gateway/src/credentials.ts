import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync
} from "node:crypto";

const CREDENTIAL_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;

/**
 * Resolve the master key used to encrypt BYO model-provider credentials at
 * rest. Production deployments must set PERISCAN_MODEL_CREDENTIAL_KEY. Local
 * and test runs may fall back to the JWT signing secret (and finally a dev
 * constant) so developer setup stays lightweight without weakening production
 * key separation.
 */
const DEV_MODEL_CREDENTIAL_KEY = "periscan-dev-model-credential-key";

export function getModelCredentialKeyMaterial(
  env: NodeJS.ProcessEnv = process.env
): string {
  if (env.PERISCAN_MODEL_CREDENTIAL_KEY) {
    return env.PERISCAN_MODEL_CREDENTIAL_KEY;
  }

  // Fail closed in production: BYO model credentials need a dedicated key so
  // token-signing rotation and model-provider credential rotation are separate.
  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production") {
    throw new Error(
      "Set PERISCAN_MODEL_CREDENTIAL_KEY in production; refusing to encrypt model credentials with a fallback key."
    );
  }

  if (env.PERISCAN_JWT_SECRET) {
    return env.PERISCAN_JWT_SECRET;
  }

  return DEV_MODEL_CREDENTIAL_KEY;
}

function deriveKey(keyMaterial: string, salt: Buffer): Buffer {
  return scryptSync(keyMaterial, salt, KEY_LENGTH);
}

/**
 * Encrypt a plaintext credential (e.g. a customer's frontier-model API key)
 * into an opaque, self-describing reference string safe to store in the
 * database. The plaintext is never logged and never persisted.
 */
export function encryptModelCredential(
  plaintext: string,
  env: NodeJS.ProcessEnv = process.env
): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(getModelCredentialKeyMaterial(env), salt);
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

/**
 * Decrypt a credential reference produced by encryptModelCredential. Throws if
 * the reference is malformed or the master key cannot authenticate it.
 */
export function decryptModelCredential(
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
    throw new Error("Unrecognized model credential reference format.");
  }

  const salt = Buffer.from(saltB64, "base64url");
  const iv = Buffer.from(ivB64, "base64url");
  const authTag = Buffer.from(authTagB64, "base64url");
  const ciphertext = Buffer.from(ciphertextB64, "base64url");
  const key = deriveKey(getModelCredentialKeyMaterial(env), salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString("utf8");
}

export function isModelCredentialReference(
  value: string | null | undefined
): boolean {
  return (
    typeof value === "string" && value.startsWith(`${CREDENTIAL_VERSION}.`)
  );
}
