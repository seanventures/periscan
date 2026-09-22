import { createSign, randomUUID } from "node:crypto";

import { z } from "zod";

import {
  ConnectorOAuthGrantSchema,
  emptyFindingsOnVendorAuthFailure,
  vendorAuthFailureHealthStatus,
  type ConnectorOAuthGrant,
  type ConnectorOAuthGrantType
} from "@periscan/shared";

import { connectorFetch, type FetchImpl } from "./http.js";
import {
  decryptSecret as decryptIntegrationSecret,
  encryptSecret as encryptIntegrationSecret,
  isIntegrationSecretReference
} from "./integration-credentials.js";

const DEFAULT_SKEW_MS = 60_000;
const CLIENT_ASSERTION_TYPE =
  "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";

const SECRET_KEY =
  /^(access_token|accessToken|assertion|authorization|certificateThumbprint|client_secret|clientAssertion|clientAssertionEncrypted|clientSecret|clientSecretEncrypted|privateKey|privateKeyEncrypted|privateKeyPem|refresh_token|refreshToken)$/iu;

export type ConnectorOAuthAccessToken = {
  accessToken: string;
  expiresAt: string;
  scope?: string;
  tokenType: string;
};

export type ConnectorOAuthRefreshSuccess = {
  ok: true;
  token: ConnectorOAuthAccessToken;
};

export type ConnectorOAuthRefreshFailure = {
  assets: [];
  findings: [];
  health: {
    authorizationVerified: false;
    checkedAt: string;
    detail: string;
    latencyMs: number;
    status: "Degraded" | "Unhealthy";
  };
  ok: false;
  signals: [];
  status: number | null;
};

export type ConnectorOAuthRefreshResult =
  | ConnectorOAuthRefreshSuccess
  | ConnectorOAuthRefreshFailure;

export type ConnectorOAuthGrantConfigInput = {
  certificateThumbprint?: string;
  clientAssertion?: string;
  clientId: string;
  clientSecret?: string;
  connectorId: string;
  encryptSecret?: (value: string) => string;
  grantType?: ConnectorOAuthGrantType;
  lastRotatedAt?: string | null;
  privateKey?: string;
  scopes?: string[] | string;
  tenantId: string;
  tokenUrl: string;
};

function normalizeScopes(scopes: string[] | string | undefined): string[] {
  if (Array.isArray(scopes)) {
    return scopes.filter((scope) => scope.length > 0);
  }

  if (typeof scopes === "string" && scopes.trim().length > 0) {
    return scopes.trim().split(/\s+/u);
  }

  return [];
}

function encryptField(
  value: string | undefined,
  encrypt: (plaintext: string) => string
): string | undefined {
  if (value == null || value.length === 0) {
    return undefined;
  }

  return isIntegrationSecretReference(value) ? value : encrypt(value);
}

export function connectorOAuthGrantFromConfig(
  input: ConnectorOAuthGrantConfigInput
): ConnectorOAuthGrant {
  const encrypt = input.encryptSecret ?? encryptIntegrationSecret;

  return ConnectorOAuthGrantSchema.parse({
    certificateThumbprint: input.certificateThumbprint,
    clientAssertionEncrypted: encryptField(input.clientAssertion, encrypt),
    clientId: input.clientId,
    clientSecretEncrypted: encryptField(input.clientSecret, encrypt),
    connectorId: input.connectorId,
    grantType: input.grantType ?? "client_credentials",
    lastRotatedAt: input.lastRotatedAt ?? null,
    privateKeyEncrypted: encryptField(input.privateKey, encrypt),
    scopes: normalizeScopes(input.scopes),
    tenantId: input.tenantId,
    tokenUrl: input.tokenUrl
  });
}

export function certificateThumbprintToX5t(thumbprint: string): string {
  const hex = thumbprint.replace(/[:\s]/gu, "");
  if (/^[0-9a-fA-F]{40}$/u.test(hex)) {
    return Buffer.from(hex, "hex").toString("base64url");
  }

  return thumbprint;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function normalizePem(value: string): string {
  return value.replace(/\\n/gu, "\n");
}

function createCertificateClientAssertion(input: {
  clientId: string;
  now: Date;
  privateKeyPem: string;
  thumbprint: string;
  tokenUrl: string;
}): string {
  const nowSeconds = Math.floor(input.now.getTime() / 1000);
  const signingInput = [
    base64UrlJson({
      alg: "RS256",
      typ: "JWT",
      x5t: certificateThumbprintToX5t(input.thumbprint)
    }),
    base64UrlJson({
      aud: input.tokenUrl,
      exp: nowSeconds + 600,
      iat: nowSeconds,
      iss: input.clientId,
      jti: randomUUID(),
      nbf: nowSeconds,
      sub: input.clientId
    })
  ].join(".");
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();

  return `${signingInput}.${signer
    .sign(normalizePem(input.privateKeyPem))
    .toString("base64url")}`;
}

function decryptField(
  value: string | undefined,
  decrypt: (reference: string) => string
): string {
  if (!value) {
    return "";
  }

  return isIntegrationSecretReference(value) ? decrypt(value) : value;
}

function tokenRequestBody(
  grant: ConnectorOAuthGrant,
  decrypt: (reference: string) => string,
  now: Date
): URLSearchParams {
  const body = new URLSearchParams({
    client_id: grant.clientId,
    grant_type: "client_credentials"
  });

  if (grant.grantType === "certificate") {
    body.set("client_assertion_type", CLIENT_ASSERTION_TYPE);
    body.set(
      "client_assertion",
      createCertificateClientAssertion({
        clientId: grant.clientId,
        now,
        privateKeyPem: decryptField(grant.privateKeyEncrypted, decrypt),
        thumbprint: grant.certificateThumbprint ?? "",
        tokenUrl: grant.tokenUrl
      })
    );
  } else if (grant.grantType === "federated") {
    body.set("client_assertion_type", CLIENT_ASSERTION_TYPE);
    body.set(
      "client_assertion",
      decryptField(grant.clientAssertionEncrypted, decrypt)
    );
  } else {
    body.set(
      "client_secret",
      decryptField(grant.clientSecretEncrypted, decrypt)
    );
  }

  if (grant.scopes.length > 0) {
    body.set("scope", grant.scopes.join(" "));
  }

  return body;
}

function isExpired(
  token: ConnectorOAuthAccessToken,
  now: Date,
  skewMs: number
): boolean {
  const expiresAt = Date.parse(token.expiresAt);
  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return expiresAt - skewMs <= now.getTime();
}

function tokenFromResponse(
  json: Record<string, unknown>,
  now: Date
): ConnectorOAuthAccessToken {
  const parsed = z
    .object({
      access_token: z.string().min(1),
      expires_in: z.number().int().positive().optional(),
      scope: z.string().min(1).optional(),
      token_type: z.string().min(1).optional()
    })
    .parse(json);

  const expiresInSeconds = parsed.expires_in ?? 3600;

  return {
    accessToken: parsed.access_token,
    expiresAt: new Date(now.getTime() + expiresInSeconds * 1000).toISOString(),
    scope: parsed.scope,
    tokenType: parsed.token_type ?? "Bearer"
  };
}

function authFailure(
  status: number | null,
  now: Date,
  latencyMs: number
): ConnectorOAuthRefreshFailure {
  const healthStatus =
    vendorAuthFailureHealthStatus(status ?? 0) ?? "Unhealthy";
  const empty = emptyFindingsOnVendorAuthFailure();

  return {
    assets: empty.assets,
    findings: empty.findings,
    health: {
      authorizationVerified: false,
      checkedAt: now.toISOString(),
      detail:
        status === null
          ? "Vendor token endpoint request failed."
          : `Vendor token endpoint returned HTTP ${status}.`,
      latencyMs,
      status: healthStatus
    },
    ok: false,
    signals: empty.signals,
    status
  };
}

export async function refreshConnectorOAuthGrant(
  grant: ConnectorOAuthGrant,
  options?: {
    cachedToken?: ConnectorOAuthAccessToken | null;
    decryptSecret?: (value: string) => string;
    fetchImpl?: FetchImpl;
    now?: () => Date;
    skewMs?: number;
  }
): Promise<ConnectorOAuthRefreshResult> {
  const parsedGrant = ConnectorOAuthGrantSchema.parse(grant);
  const now = options?.now?.() ?? new Date();
  const skewMs = options?.skewMs ?? DEFAULT_SKEW_MS;

  if (options?.cachedToken && !isExpired(options.cachedToken, now, skewMs)) {
    return { ok: true, token: options.cachedToken };
  }

  const decrypt = options?.decryptSecret ?? decryptIntegrationSecret;
  const body = tokenRequestBody(parsedGrant, decrypt, now);

  const startedAt = Date.now();
  let response: Response;

  try {
    response = await connectorFetch(
      parsedGrant.tokenUrl,
      {
        body,
        headers: {
          "content-type": "application/x-www-form-urlencoded"
        },
        method: "POST"
      },
      {
        fetchImpl: options?.fetchImpl,
        retryNonIdempotent: false
      }
    );
  } catch {
    return authFailure(null, now, Date.now() - startedAt);
  }

  if (!response.ok) {
    return authFailure(response.status, now, Date.now() - startedAt);
  }

  const json = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  try {
    return {
      ok: true,
      token: tokenFromResponse(json, now)
    };
  } catch {
    return authFailure(response.status, now, Date.now() - startedAt);
  }
}

export function redactConnectorOAuthSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactConnectorOAuthSecrets(item));
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, nested]) => {
        if (SECRET_KEY.test(key)) {
          return [key, "[redacted]"];
        }

        return [key, redactConnectorOAuthSecrets(nested)];
      }
    );

    return Object.fromEntries(entries);
  }

  return value;
}
