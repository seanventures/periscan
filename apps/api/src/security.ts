import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  SignJWT,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload
} from "jose";

import type { SessionClaims } from "./runtime-services.js";

export const SESSION_COOKIE_NAME = "periscan_session";
/** Non-HttpOnly cookie readable by the browser for double-submit CSRF. */
export const CSRF_COOKIE_NAME = "periscan_csrf";
/** Header the browser must echo with the CSRF cookie on mutating cookie-auth. */
export const CSRF_HEADER_NAME = "x-csrf-token";
const REPORT_SHARE_TOKEN_TYPE = "report-share";
const CSRF_HMAC_PREFIX = "periscan-csrf-v1:";

/** Default kid when a bare secret string is passed (tests / single-key deploys). */
export const DEFAULT_SESSION_JWT_KID = "sess-v1";
export const DEFAULT_REPORT_SHARE_JWT_KID = "share-v1";
export const PREVIOUS_SESSION_JWT_KID = "sess-v0";
export const PREVIOUS_REPORT_SHARE_JWT_KID = "share-v0";

/**
 * HS256 keyring for purpose-split JWT signing with optional rotation.
 *
 * New tokens are signed with `activeKid`. Verification prefers the token's
 * `kid` header when present and known; otherwise every secret in the ring is
 * tried (legacy tokens minted before kid support).
 */
export interface JwtKeyring {
  activeKid: string;
  /** kid → raw secret material */
  secrets: Record<string, string>;
}

export type JwtSigningMaterial = string | JwtKeyring;

function getSecret(secret: string) {
  return new TextEncoder().encode(secret);
}

export function toJwtKeyring(
  material: JwtSigningMaterial,
  defaultKid: string
): JwtKeyring {
  if (typeof material === "string") {
    return {
      activeKid: defaultKid,
      secrets: { [defaultKid]: material }
    };
  }

  if (!material.secrets[material.activeKid]) {
    throw new Error(
      `JWT keyring activeKid "${material.activeKid}" is missing from secrets.`
    );
  }

  return material;
}

/**
 * Build a session JWT keyring from env.
 *
 * - `PERISCAN_JWT_SECRET` (required for minting) — active key
 * - `PERISCAN_JWT_KID` (optional, default sess-v1)
 * - `PERISCAN_JWT_SECRET_PREVIOUS` (optional) — dual-verify during rotation
 * - `PERISCAN_JWT_PREVIOUS_KID` (optional, default sess-v0)
 */
export function resolveSessionJwtKeyring(
  env: NodeJS.ProcessEnv = process.env,
  fallbackSecret = "periscan-dev-session-secret"
): JwtKeyring {
  const activeSecret = env.PERISCAN_JWT_SECRET ?? fallbackSecret;
  const activeKid = env.PERISCAN_JWT_KID?.trim() || DEFAULT_SESSION_JWT_KID;
  const secrets: Record<string, string> = { [activeKid]: activeSecret };

  const previous = env.PERISCAN_JWT_SECRET_PREVIOUS?.trim();
  if (previous) {
    const previousKid =
      env.PERISCAN_JWT_PREVIOUS_KID?.trim() || PREVIOUS_SESSION_JWT_KID;
    secrets[previousKid] = previous;
  }

  return { activeKid, secrets };
}

/**
 * Build a report-share JWT keyring. Production must set
 * `PERISCAN_REPORT_SHARE_SECRET` (enforced by getReportShareSecret); this
 * helper attaches optional previous-key rotation the same way as sessions.
 */
export function resolveReportShareJwtKeyring(
  env: NodeJS.ProcessEnv = process.env,
  activeSecret: string
): JwtKeyring {
  const activeKid =
    env.PERISCAN_REPORT_SHARE_KID?.trim() || DEFAULT_REPORT_SHARE_JWT_KID;
  const secrets: Record<string, string> = { [activeKid]: activeSecret };

  const previous = env.PERISCAN_REPORT_SHARE_SECRET_PREVIOUS?.trim();
  if (previous) {
    const previousKid =
      env.PERISCAN_REPORT_SHARE_PREVIOUS_KID?.trim() ||
      PREVIOUS_REPORT_SHARE_JWT_KID;
    secrets[previousKid] = previous;
  }

  return { activeKid, secrets };
}

async function verifyWithKeyring(
  token: string,
  keyring: JwtKeyring
): Promise<JWTPayload> {
  let preferredKid: string | undefined;
  try {
    preferredKid = decodeProtectedHeader(token).kid;
  } catch {
    preferredKid = undefined;
  }

  const tryOrder =
    preferredKid && keyring.secrets[preferredKid]
      ? [
          preferredKid,
          ...Object.keys(keyring.secrets).filter((kid) => kid !== preferredKid)
        ]
      : Object.keys(keyring.secrets);

  let lastError: unknown;
  for (const kid of tryOrder) {
    const secret = keyring.secrets[kid];
    if (!secret) {
      continue;
    }
    try {
      const { payload } = await jwtVerify(token, getSecret(secret), {
        algorithms: ["HS256"]
      });
      return payload;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("JWT verification failed for all keyring secrets.");
}

export async function createSessionToken(
  claims: SessionClaims,
  material: JwtSigningMaterial
) {
  const keyring = toJwtKeyring(material, DEFAULT_SESSION_JWT_KID);
  const secret = keyring.secrets[keyring.activeKid]!;

  return new SignJWT({
    ...claims
  } satisfies JWTPayload)
    .setProtectedHeader({
      alg: "HS256",
      kid: keyring.activeKid
    })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret(secret));
}

export async function verifySessionToken(
  token: string,
  material: JwtSigningMaterial
) {
  const keyring = toJwtKeyring(material, DEFAULT_SESSION_JWT_KID);
  const payload = await verifyWithKeyring(token, keyring);

  const claims: SessionClaims = {
    authMethod:
      payload.authMethod === "api_key" ||
      payload.authMethod === "sso" ||
      payload.authMethod === "system"
        ? payload.authMethod
        : "password",
    defaultTenantId: String(payload.defaultTenantId),
    userId: String(payload.userId)
  };

  if (
    typeof payload.sessionVersion === "number" &&
    Number.isInteger(payload.sessionVersion) &&
    payload.sessionVersion >= 0
  ) {
    claims.sessionVersion = payload.sessionVersion;
  }

  return claims;
}

export interface ReportShareClaims {
  reportId: string;
  reportShareId: string;
  tenantId: string;
}

export async function createReportShareToken(
  claims: ReportShareClaims,
  material: JwtSigningMaterial,
  expiresIn = "7d"
) {
  const keyring = toJwtKeyring(material, DEFAULT_REPORT_SHARE_JWT_KID);
  const secret = keyring.secrets[keyring.activeKid]!;

  return new SignJWT({
    reportId: claims.reportId,
    reportShareId: claims.reportShareId,
    tenantId: claims.tenantId,
    type: REPORT_SHARE_TOKEN_TYPE
  } satisfies JWTPayload)
    .setProtectedHeader({
      alg: "HS256",
      kid: keyring.activeKid
    })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret(secret));
}

export async function verifyReportShareToken(
  token: string,
  material: JwtSigningMaterial
) {
  const keyring = toJwtKeyring(material, DEFAULT_REPORT_SHARE_JWT_KID);
  const payload = await verifyWithKeyring(token, keyring);

  if (payload.type !== REPORT_SHARE_TOKEN_TYPE) {
    throw new Error("Invalid report share token type.");
  }

  return {
    reportId: String(payload.reportId),
    reportShareId: String(payload.reportShareId),
    tenantId: String(payload.tenantId)
  } satisfies ReportShareClaims;
}

/**
 * Active signing secret for a keyring or bare secret string.
 * Used to bind CSRF tokens to the current session JWT material.
 */
export function getActiveJwtSecret(material: JwtSigningMaterial): string {
  const keyring = toJwtKeyring(material, DEFAULT_SESSION_JWT_KID);
  return keyring.secrets[keyring.activeKid]!;
}

/**
 * Session-bound CSRF token (HMAC of the session JWT). Double-submit compares
 * the readable cookie value to the `x-csrf-token` header; both must equal this
 * derived value so a stolen cookie alone is insufficient without XSS.
 */
export function createCsrfToken(
  sessionJwt: string,
  material: JwtSigningMaterial
): string {
  const secret = getActiveJwtSecret(material);
  return createHmac("sha256", secret)
    .update(`${CSRF_HMAC_PREFIX}${sessionJwt}`)
    .digest("base64url");
}

function safeEqualString(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return timingSafeEqual(leftBuf, rightBuf);
}

/**
 * Validate double-submit CSRF for a cookie session.
 * Returns true when cookie and header both match the session-bound token.
 */
export function verifyCsrfDoubleSubmit(input: {
  sessionJwt: string;
  cookieToken: string | undefined;
  headerToken: string | undefined;
  material: JwtSigningMaterial;
}): boolean {
  if (!input.cookieToken || !input.headerToken) {
    return false;
  }
  const expected = createCsrfToken(input.sessionJwt, input.material);
  return (
    safeEqualString(input.cookieToken, expected) &&
    safeEqualString(input.headerToken, expected)
  );
}

/**
 * Whether mutating cookie-auth requests must carry a valid CSRF double-submit.
 *
 * - Production (`PERISCAN_DEPLOYMENT_ENVIRONMENT=production`) → always on;
 *   `PERISCAN_CSRF_ENFORCE=false` is hard-ignored (and refused at startup).
 * - `PERISCAN_CSRF_ENFORCE=true` → always on (including vitest)
 * - `PERISCAN_CSRF_ENFORCE=false` → off only outside production
 * - default → on outside test/vitest so existing cookie unit tests stay green
 */
export function isCsrfEnforced(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production") {
    // Fail closed: never allow CSRF disable in production deployment.
    return true;
  }
  const flag = env.PERISCAN_CSRF_ENFORCE?.trim().toLowerCase();
  if (flag === "true" || flag === "1") {
    return true;
  }
  if (flag === "false" || flag === "0") {
    return false;
  }
  return env.NODE_ENV !== "test" && env.VITEST !== "true";
}

/**
 * Startup guard: refuse explicit CSRF disable when deployment is production.
 * Prefer calling this from `buildApp` so misconfigured deploys fail fast.
 */
export function assertCsrfProductionConfig(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT !== "production") {
    return;
  }
  const flag = env.PERISCAN_CSRF_ENFORCE?.trim().toLowerCase();
  if (flag === "false" || flag === "0") {
    throw new Error(
      "PERISCAN_CSRF_ENFORCE=false is not allowed when PERISCAN_DEPLOYMENT_ENVIRONMENT=production."
    );
  }
}

/**
 * Hash API key material for rate-limit identity keys.
 * Never use the raw Bearer token as a cache/store key (P20-8).
 */
export function hashRateLimitApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

/**
 * Purpose-split secret for model-tool intervention HMAC tokens.
 * Production refuses to fall back to the session JWT secret.
 */
export function resolveInterventionSigningSecret(
  env: NodeJS.ProcessEnv = process.env,
  sessionFallback?: string
): string {
  const dedicated = env.PERISCAN_INTERVENTION_SIGNING_SECRET?.trim();
  if (dedicated) {
    return dedicated;
  }

  if (env.PERISCAN_DEPLOYMENT_ENVIRONMENT === "production") {
    throw new Error(
      "PERISCAN_INTERVENTION_SIGNING_SECRET must be set in production; refusing to sign intervention tokens with the session JWT secret."
    );
  }

  return (
    sessionFallback ??
    env.PERISCAN_JWT_SECRET ??
    "periscan-dev-intervention-secret"
  );
}
