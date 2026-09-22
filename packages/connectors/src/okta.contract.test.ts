import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const OKTA_API_TOKEN = "okta-secret-ssws-api-token";
const OKTA_ORG_URL = "https://periscan.okta.test";
const OKTA_CLIENT_ID = "okta-oauth-client-id";
const OKTA_CLIENT_SECRET = "okta-oauth-client-secret";
const OKTA_ACCESS_TOKEN = "okta-oauth-access-token";
const OKTA_TOKEN_URL = `${OKTA_ORG_URL}/oauth2/v1/token`;
const TENANT_ID = "55555555-5555-4555-8555-555555555555";
const INTEGRATION_ID = "66666666-6666-4666-8666-666666666666";

/**
 * Recorded-fixture contract test for the live `okta` connector.
 *
 * The captured shapes mirror real Okta REST responses: a privileged admin user
 * with an ACTIVE MFA factor, a standard user without factors, a privileged
 * group, an application, and the `/api/v1/users/me` health probe. We stub
 * global `fetch` so CI verifies the outbound request contract (SSWS auth) and
 * identity-signal normalization without any live Okta call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

const ADMIN_USER = {
  id: "00u-admin",
  profile: {
    displayName: "Periscan Admin",
    email: "admin@example.com",
    firstName: "Periscan",
    lastName: "Admin",
    login: "admin@example.com"
  },
  status: "ACTIVE"
};

const STANDARD_USER = {
  id: "00u-eng",
  profile: {
    displayName: "Engineer One",
    email: "engineer-one@example.com",
    firstName: "Engineer",
    lastName: "One",
    login: "engineer-one@example.com"
  },
  status: "ACTIVE"
};

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

function buildFetchMock() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    void init;
    const url = String(input);

    if (url.includes("/api/v1/users/me")) {
      return jsonResponse({
        id: "00u-me",
        profile: { login: "service-account@example.com" }
      });
    }

    if (url.includes("/api/v1/users/00u-admin/factors")) {
      return jsonResponse([
        {
          factorType: "token:software:totp",
          id: "opf-admin",
          provider: "OKTA",
          status: "ACTIVE"
        }
      ]);
    }

    if (url.includes("/api/v1/users/00u-eng/factors")) {
      return jsonResponse([]);
    }

    if (url.includes("/api/v1/users")) {
      return jsonResponse([ADMIN_USER, STANDARD_USER]);
    }

    if (url.includes("/api/v1/groups")) {
      return jsonResponse([
        {
          id: "00g-admins",
          profile: {
            description: "Tenant administrators with privileged access.",
            name: "Okta Administrators"
          },
          type: "OKTA_GROUP"
        }
      ]);
    }

    if (url.includes("/api/v1/apps")) {
      return jsonResponse([
        {
          id: "0oa-prod",
          label: "Production Console",
          name: "prod-console",
          signOnMode: "SAML_2_0",
          status: "ACTIVE"
        }
      ]);
    }

    return new Response(JSON.stringify({ errorSummary: "not found" }), {
      status: 404
    });
  });
}

const baseConfig = {
  apiToken: OKTA_API_TOKEN,
  connectorKey: "okta",
  orgUrl: OKTA_ORG_URL
} as const;

describe("okta contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues SSWS-authenticated inventory requests and normalizes identity signals", async () => {
    const connector = getConnectorByKey("okta");

    expect(connector).toBeDefined();

    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    // ---- Request contract -------------------------------------------------
    const calls = fetchMock.mock.calls as FetchArgs[];
    const requestedUrls = calls.map(([input]) => String(input));

    // Inventory fans out across users, groups, apps, and per-user factors.
    expect(
      requestedUrls.some((url) =>
        url.startsWith(`${OKTA_ORG_URL}/api/v1/users?limit=200`)
      )
    ).toBe(true);
    expect(
      requestedUrls.some((url) =>
        url.startsWith(`${OKTA_ORG_URL}/api/v1/groups?limit=200`)
      )
    ).toBe(true);
    expect(
      requestedUrls.some((url) =>
        url.startsWith(`${OKTA_ORG_URL}/api/v1/apps?limit=200`)
      )
    ).toBe(true);
    expect(requestedUrls).toContain(
      `${OKTA_ORG_URL}/api/v1/users/00u-admin/factors`
    );
    expect(requestedUrls).toContain(
      `${OKTA_ORG_URL}/api/v1/users/00u-eng/factors`
    );
    // collectSignals does not run the health probe.
    expect(requestedUrls.some((url) => url.includes("/api/v1/users/me"))).toBe(
      false
    );

    for (const [, init] of calls) {
      const headers = init?.headers as Record<string, string>;
      expect(headers.authorization).toBe(`SSWS ${OKTA_API_TOKEN}`);
      expect(headers.accept).toBe("application/json");
    }

    // ---- Normalization ----------------------------------------------------
    const categories = new Set(signals.map((signal) => signal.signalCategory));
    expect(categories).toEqual(new Set(["Identity", "Asset"]));

    const bySource = (sourceType: string) =>
      signals.filter((signal) => signal.sourceType === sourceType);

    expect(bySource("okta.identity_store.metadata")).toHaveLength(1);

    const userSignals = bySource("okta.user.metadata");
    expect(userSignals).toHaveLength(2);
    expect(userSignals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining(["PrivilegedIdentity", "UserAccount"])
    );

    const mfaSignals = bySource("okta.user.mfa_posture");
    expect(mfaSignals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining(["MFAEnabled", "MFADisabled"])
    );

    const groupSignals = bySource("okta.group.metadata");
    expect(groupSignals).toHaveLength(1);
    expect(groupSignals[0]!.signalSubcategory).toBe("PrivilegedGroup");

    const appSignals = bySource("okta.application.metadata");
    expect(appSignals).toHaveLength(1);
    expect(appSignals[0]!.signalCategory).toBe("Asset");
    expect(appSignals[0]!.signalSubcategory).toBe("SaaSApplication");

    // Secrets must never appear in normalized output.
    expect(JSON.stringify(signals)).not.toContain(OKTA_API_TOKEN);
  });

  it("runs a live sync that emits assets, signals, and a healthy probe without leaking secrets", async () => {
    const connector = getConnectorByKey("okta");
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    // sync additionally calls the /users/me health probe.
    const requestedUrls = (fetchMock.mock.calls as FetchArgs[]).map(([input]) =>
      String(input)
    );
    expect(requestedUrls.some((url) => url.includes("/api/v1/users/me"))).toBe(
      true
    );

    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(result.assets.length).toBeGreaterThanOrEqual(1);
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "PrivilegedGroup",
        "SaaSApplication"
      ])
    );
    expect(JSON.stringify(result)).not.toContain(OKTA_API_TOKEN);
  });
});

function tokenBody(init?: RequestInit): URLSearchParams {
  const raw = init?.body;
  if (raw instanceof URLSearchParams) {
    return raw;
  }
  return new URLSearchParams(String(raw ?? ""));
}

function oauthInventoryFetch(
  assertToken: (init?: RequestInit) => void,
  apiStatus = 200
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url === OKTA_TOKEN_URL || url.includes("/oauth2/v1/token")) {
      expect(init?.method).toBe("POST");
      assertToken(init);
      return new Response(
        JSON.stringify({
          access_token: OKTA_ACCESS_TOKEN,
          expires_in: 3600,
          token_type: "Bearer"
        }),
        {
          headers: { "content-type": "application/json" },
          status: 200
        }
      );
    }

    if (apiStatus !== 200) {
      return new Response("unauthorized", { status: apiStatus });
    }

    expect(init?.method ?? "GET").toBe("GET");
    expect(
      (init?.headers as Record<string, string> | undefined)?.authorization
    ).toBe(`Bearer ${OKTA_ACCESS_TOKEN}`);
    expect((init?.headers as Record<string, string> | undefined)?.accept).toBe(
      "application/json"
    );

    if (url.includes("/api/v1/users/me")) {
      return jsonResponse({
        id: "00u-me",
        profile: { login: "okta-oauth-app@example.com" }
      });
    }

    if (url.includes("/api/v1/users/00u-admin/factors")) {
      return jsonResponse([
        {
          factorType: "token:software:totp",
          id: "opf-admin",
          provider: "OKTA",
          status: "ACTIVE"
        }
      ]);
    }

    if (url.includes("/api/v1/users/00u-eng/factors")) {
      return jsonResponse([]);
    }

    if (url.includes("/api/v1/users")) {
      return jsonResponse([ADMIN_USER, STANDARD_USER]);
    }

    if (url.includes("/api/v1/groups")) {
      return jsonResponse([
        {
          id: "00g-admins",
          profile: {
            description: "Tenant administrators with privileged access.",
            name: "Okta Administrators"
          },
          type: "OKTA_GROUP"
        }
      ]);
    }

    if (url.includes("/api/v1/apps")) {
      return jsonResponse([
        {
          id: "0oa-prod",
          label: "Production Console",
          name: "prod-console",
          signOnMode: "SAML_2_0",
          status: "ACTIVE"
        }
      ]);
    }

    return new Response(JSON.stringify({ errorSummary: "not found" }), {
      status: 404
    });
  });
}

const oauthConfig = {
  clientId: OKTA_CLIENT_ID,
  clientSecret: OKTA_CLIENT_SECRET,
  connectorKey: "okta",
  lastRotatedAt: "2026-09-01T00:00:00.000Z",
  orgUrl: OKTA_ORG_URL,
  scopes: [
    "okta.users.read",
    "okta.groups.read",
    "okta.apps.read",
    "okta.factors.read"
  ],
  tokenUrl: OKTA_TOKEN_URL
} as const;

const oauthContext = {
  authType: "oauth2ClientCredentials",
  config: oauthConfig,
  integrationId: INTEGRATION_ID,
  mockMode: false,
  tenantId: TENANT_ID
} as const;

describe("okta OAuth2 client_credentials grant", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("advertises OAuth2 client_credentials while keeping SSWS apiToken", () => {
    const connector = getConnectorByKey("okta");
    const kinds = connector!.manifest.authMethods.map((method) => method.kind);

    expect(kinds).toEqual(
      expect.arrayContaining(["mock", "apiToken", "oauth2ClientCredentials"])
    );

    const oauth = connector!.manifest.authMethods.find(
      (method) => method.kind === "oauth2ClientCredentials"
    );
    expect(oauth?.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(["orgUrl", "clientId", "clientSecret"])
    );
    expect(
      oauth?.fields.find((field) => field.key === "clientSecret")?.secret
    ).toBe(true);

    const ssws = connector!.manifest.authMethods.find(
      (method) => method.kind === "apiToken"
    );
    expect(ssws?.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(["orgUrl", "apiToken"])
    );
    expect(ssws?.fields.find((field) => field.key === "apiToken")?.secret).toBe(
      true
    );
  });

  it("exchanges client_credentials then reads inventory with Bearer and never logs tokens", async () => {
    const fetchMock = oauthInventoryFetch((init) => {
      const body = tokenBody(init);
      expect(body.get("grant_type")).toBe("client_credentials");
      expect(body.get("client_id")).toBe(OKTA_CLIENT_ID);
      expect(body.get("client_secret")).toBe(OKTA_CLIENT_SECRET);
      expect(body.get("scope")).toBe(
        "okta.users.read okta.groups.read okta.apps.read okta.factors.read"
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("okta");
    const result = await connector!.sync(oauthContext);

    expect(
      fetchMock.mock.calls.some((call) => String(call[0]) === OKTA_TOKEN_URL)
    ).toBe(true);
    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(result.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining([
        "IdentityStore",
        "PrivilegedIdentity",
        "MFAEnabled",
        "PrivilegedGroup",
        "SaaSApplication"
      ])
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(OKTA_CLIENT_SECRET);
    expect(serialized).not.toContain(OKTA_ACCESS_TOKEN);
    expect(serialized).not.toContain(OKTA_API_TOKEN);
  });

  it("maps vendor 401 on token exchange to Degraded with empty findings", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: "invalid_client",
            error_description: `bad secret ${OKTA_CLIENT_SECRET}`
          }),
          { status: 401 }
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("okta");
    const result = await connector!.sync(oauthContext);

    expect(result.health.status).toBe("Degraded");
    expect(result.health.authorizationVerified).toBe(false);
    expect(result.assets).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.identityCandidates ?? []).toEqual([]);
    expect(result.health.detail).not.toContain(OKTA_CLIENT_SECRET);
    expect(JSON.stringify(result)).not.toContain(OKTA_CLIENT_SECRET);
    expect(JSON.stringify(result)).not.toContain(OKTA_ACCESS_TOKEN);
  });

  it("maps Okta API 401 after a token to Degraded instead of inventing findings", async () => {
    const fetchMock = oauthInventoryFetch(() => undefined, 401);
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("okta");
    const result = await connector!.sync(oauthContext);

    expect(result.health.status).toBe("Degraded");
    expect(result.health.authorizationVerified).toBe(false);
    expect(result.assets).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.identityCandidates ?? []).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(OKTA_CLIENT_SECRET);
    expect(JSON.stringify(result)).not.toContain(OKTA_ACCESS_TOKEN);
  });
});
