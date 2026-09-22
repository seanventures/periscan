import { generateKeyPairSync } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectorOAuthGrantSchema } from "@periscan/shared";

import { decryptSecret, encryptSecret } from "./integration-credentials.js";
import {
  connectorOAuthGrantFromConfig,
  redactConnectorOAuthSecrets,
  refreshConnectorOAuthGrant,
  type ConnectorOAuthAccessToken
} from "./connector-oauth-grant.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTOR_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "splunk-app-client-id";
const CLIENT_SECRET = "splunk-super-secret-client-secret";
const ACCESS_TOKEN = "ephemeral-splunk-access-token";
const TOKEN_URL = "https://login.microsoftonline.com/contoso/oauth2/v2.0/token";
const TEST_ENV = { PERISCAN_INTEGRATION_CREDENTIAL_KEY: "unit-test-oauth-key" };

type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function grant() {
  return ConnectorOAuthGrantSchema.parse(
    connectorOAuthGrantFromConfig({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      connectorId: CONNECTOR_ID,
      encryptSecret: (value) => encryptSecret(value, TEST_ENV),
      lastRotatedAt: "2026-09-01T00:00:00.000Z",
      scopes: ["https://splunk.example/.default"],
      tenantId: TENANT_ID,
      tokenUrl: TOKEN_URL
    })
  );
}

function tokenResponse(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      access_token: ACCESS_TOKEN,
      expires_in: 3600,
      token_type: "Bearer",
      ...overrides
    }),
    {
      headers: { "content-type": "application/json" },
      status: 200
    }
  );
}

describe("refreshConnectorOAuthGrant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("posts client_credentials with the decrypted secret and never logs tokens", async () => {
    const fetchImpl = vi.fn(async () => tokenResponse());
    const now = () => new Date("2026-09-17T12:00:00.000Z");

    const result = await refreshConnectorOAuthGrant(grant(), {
      decryptSecret: (value) => decryptSecret(value, TEST_ENV),
      fetchImpl,
      now
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected token refresh to succeed");
    }

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as FetchArgs;
    expect(String(url)).toBe(TOKEN_URL);
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["content-type"]).toBe(
      "application/x-www-form-urlencoded"
    );

    const body = init?.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_id")).toBe(CLIENT_ID);
    expect(body.get("client_secret")).toBe(CLIENT_SECRET);
    expect(body.get("scope")).toBe("https://splunk.example/.default");

    expect(result.token.accessToken).toBe(ACCESS_TOKEN);
    expect(result.token.tokenType).toBe("Bearer");
    expect(result.token.expiresAt).toBe("2026-09-17T13:00:00.000Z");

    const serialized = JSON.stringify(
      redactConnectorOAuthSecrets({
        grant: grant(),
        result
      })
    );
    expect(serialized).not.toContain(CLIENT_SECRET);
    expect(serialized).not.toContain(ACCESS_TOKEN);
  });

  it("reuses a cached token that has not expired", async () => {
    const fetchImpl = vi.fn(async () => tokenResponse());
    const cached: ConnectorOAuthAccessToken = {
      accessToken: ACCESS_TOKEN,
      expiresAt: "2026-09-17T12:30:00.000Z",
      tokenType: "Bearer"
    };

    const result = await refreshConnectorOAuthGrant(grant(), {
      cachedToken: cached,
      fetchImpl,
      now: () => new Date("2026-09-17T12:00:00.000Z")
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token).toEqual(cached);
    }
  });

  it("refreshes when the cached token is expired", async () => {
    const fetchImpl = vi.fn(async () => tokenResponse({ expires_in: 120 }));
    const cached: ConnectorOAuthAccessToken = {
      accessToken: "expired-token",
      expiresAt: "2026-09-17T11:59:00.000Z",
      tokenType: "Bearer"
    };

    const result = await refreshConnectorOAuthGrant(grant(), {
      cachedToken: cached,
      decryptSecret: (value) => decryptSecret(value, TEST_ENV),
      fetchImpl,
      now: () => new Date("2026-09-17T12:00:00.000Z")
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.token.accessToken).toBe(ACCESS_TOKEN);
      expect(result.token.expiresAt).toBe("2026-09-17T12:02:00.000Z");
    }
  });

  it("maps vendor 401 to Degraded with zero invented findings", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: `bad secret ${CLIENT_SECRET}`
          }),
          { status: 401 }
        )
    );

    const result = await refreshConnectorOAuthGrant(grant(), {
      decryptSecret: (value) => decryptSecret(value, TEST_ENV),
      fetchImpl,
      now: () => new Date("2026-09-17T12:00:00.000Z")
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected 401 refresh to fail");
    }

    expect(result.health.status).toBe("Degraded");
    expect(result.health.authorizationVerified).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.assets).toEqual([]);
    expect(result.status).toBe(401);

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(CLIENT_SECRET);
    expect(serialized).not.toContain(ACCESS_TOKEN);
    expect(result.health.detail).not.toContain(CLIENT_SECRET);
  });

  it("lets CrowdStrike, Sentinel, Entra, Okta, and Elastic consume the grant type", () => {
    const vendors = [
      {
        connectorId: "crowdstrike",
        scopes: [] as string[],
        tokenUrl: "https://api.crowdstrike.com/oauth2/token"
      },
      {
        connectorId: "microsoft-sentinel",
        scopes: ["https://api.loganalytics.io/.default"],
        tokenUrl: "https://login.microsoftonline.com/contoso/oauth2/v2.0/token"
      },
      {
        connectorId: "microsoft-entra-id",
        scopes: ["https://graph.microsoft.com/.default"],
        tokenUrl: "https://login.microsoftonline.com/contoso/oauth2/v2.0/token"
      },
      {
        connectorId: "okta",
        scopes: ["okta.users.read", "okta.logs.read"],
        tokenUrl: "https://periscan.okta.test/oauth2/v1/token"
      },
      {
        connectorId: "elastic-security",
        scopes: [],
        tokenUrl: "https://elastic.example/_security/oauth2/token"
      }
    ];

    for (const vendor of vendors) {
      const parsed = ConnectorOAuthGrantSchema.parse(
        connectorOAuthGrantFromConfig({
          clientId: `${vendor.connectorId}-client`,
          clientSecret: CLIENT_SECRET,
          connectorId: vendor.connectorId,
          encryptSecret: (value) => encryptSecret(value, TEST_ENV),
          lastRotatedAt: null,
          scopes: vendor.scopes,
          tenantId: TENANT_ID,
          tokenUrl: vendor.tokenUrl
        })
      );

      expect(parsed.connectorId).toBe(vendor.connectorId);
      expect(parsed.tokenUrl).toBe(vendor.tokenUrl);
      expect(parsed.clientSecretEncrypted).not.toBe(CLIENT_SECRET);
      expect(parsed.clientSecretEncrypted?.startsWith("v1.")).toBe(true);
    }
  });

  it("posts a certificate grant with x5t thumbprint assertion and never logs the private key", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" }
    });
    const thumbprint = "00112233445566778899aabbccddeeff00112233";
    const expectedX5t = Buffer.from(thumbprint, "hex").toString("base64url");
    const fetchImpl = vi.fn(async () => tokenResponse());
    const grant = ConnectorOAuthGrantSchema.parse(
      connectorOAuthGrantFromConfig({
        certificateThumbprint: thumbprint,
        clientId: CLIENT_ID,
        connectorId: CONNECTOR_ID,
        encryptSecret: (value) => encryptSecret(value, TEST_ENV),
        grantType: "certificate",
        lastRotatedAt: null,
        privateKey,
        scopes: ["https://graph.microsoft.com/.default"],
        tenantId: TENANT_ID,
        tokenUrl: TOKEN_URL
      })
    );

    const result = await refreshConnectorOAuthGrant(grant, {
      decryptSecret: (value) => decryptSecret(value, TEST_ENV),
      fetchImpl,
      now: () => new Date("2026-09-17T12:00:00.000Z")
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] as unknown as FetchArgs;
    const body = init?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_secret")).toBeNull();
    expect(body.get("client_assertion_type")).toBe(
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
    );
    const assertion = body.get("client_assertion");
    expect(assertion).toEqual(expect.stringMatching(/^eyJ/u));
    const header = JSON.parse(
      Buffer.from(assertion!.split(".")[0]!, "base64url").toString("utf8")
    ) as { x5t?: string };
    expect(header.x5t).toBe(expectedX5t);

    const serialized = JSON.stringify(
      redactConnectorOAuthSecrets({
        assertion,
        grant,
        privateKey,
        result
      })
    );
    expect(serialized).not.toContain(privateKey);
    expect(serialized).not.toContain(ACCESS_TOKEN);
    expect(serialized).not.toContain(assertion);
  });

  it("posts a federated grant assertion and never logs it", async () => {
    const federatedAssertion =
      "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJnaXRodWItYWN0aW9ucyJ9.federated-signature";
    const fetchImpl = vi.fn(async () => tokenResponse());
    const grant = ConnectorOAuthGrantSchema.parse(
      connectorOAuthGrantFromConfig({
        clientAssertion: federatedAssertion,
        clientId: CLIENT_ID,
        connectorId: CONNECTOR_ID,
        encryptSecret: (value) => encryptSecret(value, TEST_ENV),
        grantType: "federated",
        lastRotatedAt: null,
        scopes: ["https://graph.microsoft.com/.default"],
        tenantId: TENANT_ID,
        tokenUrl: TOKEN_URL
      })
    );

    const result = await refreshConnectorOAuthGrant(grant, {
      decryptSecret: (value) => decryptSecret(value, TEST_ENV),
      fetchImpl
    });

    expect(result.ok).toBe(true);
    const [, init] = fetchImpl.mock.calls[0] as unknown as FetchArgs;
    const body = init?.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("client_secret")).toBeNull();
    expect(body.get("client_assertion")).toBe(federatedAssertion);

    const serialized = JSON.stringify(
      redactConnectorOAuthSecrets({
        grant,
        result
      })
    );
    expect(serialized).not.toContain(federatedAssertion);
    expect(serialized).not.toContain(ACCESS_TOKEN);
  });

  it("maps certificate grant 401 to Degraded with zero invented findings", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" }
    });
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "invalid_client" }), {
          status: 401
        })
    );
    const grant = ConnectorOAuthGrantSchema.parse(
      connectorOAuthGrantFromConfig({
        certificateThumbprint: "00112233445566778899aabbccddeeff00112233",
        clientId: CLIENT_ID,
        connectorId: CONNECTOR_ID,
        encryptSecret: (value) => encryptSecret(value, TEST_ENV),
        grantType: "certificate",
        privateKey,
        tenantId: TENANT_ID,
        tokenUrl: TOKEN_URL
      })
    );

    const result = await refreshConnectorOAuthGrant(grant, {
      decryptSecret: (value) => decryptSecret(value, TEST_ENV),
      fetchImpl
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected certificate 401 refresh to fail");
    }
    expect(result.health.status).toBe("Degraded");
    expect(result.findings).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.assets).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(privateKey);
  });
});
