import { generateKeyPairSync } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const TENANT_ID = "93939393-9393-4939-8939-939393939393";
const INTEGRATION_ID = "92929292-9292-4929-8929-929292929292";
const ENTRA_DIRECTORY_ID = "tenant-live";
const CLIENT_ID = "entra-client-id";
const CLIENT_SECRET = "entra-secret";
const ACCESS_TOKEN = "entra-access-token";
const FEDERATED_ASSERTION =
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJha3Mtd29ya2xvYWQifQ.entra-federated-assertion";
const THUMBPRINT = "00112233445566778899aabbccddeeff00112233";
const TOKEN_URL = `https://login.microsoftonline.com/${ENTRA_DIRECTORY_ID}/oauth2/v2.0/token`;

function tokenBody(init?: RequestInit): URLSearchParams {
  const raw = init?.body;
  if (raw instanceof URLSearchParams) {
    return raw;
  }
  return new URLSearchParams(String(raw ?? ""));
}

function pemBodyLine(pem: string): string {
  const line = pem
    .split(/\n/u)
    .find(
      (candidate) =>
        candidate.length > 20 &&
        !candidate.includes("BEGIN") &&
        !candidate.includes("END")
    );
  if (!line) {
    throw new Error("expected a PEM body line");
  }
  return line;
}

function graphCollection(pathName: string, init?: RequestInit) {
  expect(init?.method ?? "GET").toBe("GET");
  expect(
    (init?.headers as Record<string, string> | undefined)?.authorization
  ).toBe(`Bearer ${ACCESS_TOKEN}`);

  if (pathName.includes("/organization?")) {
    return new Response(
      JSON.stringify({
        value: [{ displayName: "Periscan Directory", id: ENTRA_DIRECTORY_ID }]
      })
    );
  }

  if (pathName.includes("/users?")) {
    return new Response(
      JSON.stringify({
        value: [
          {
            accountEnabled: true,
            displayName: "Security Admin",
            id: "user-1",
            mail: "security-admin@example.com",
            userPrincipalName: "security-admin@example.com",
            userType: "Member"
          }
        ]
      })
    );
  }

  if (pathName.includes("/groups?")) {
    return new Response(
      JSON.stringify({
        value: [
          {
            description: "Privileged administrators.",
            displayName: "Global Administrators",
            id: "group-1",
            securityEnabled: true
          }
        ]
      })
    );
  }

  if (pathName.includes("/applications?")) {
    return new Response(
      JSON.stringify({
        value: [
          {
            appId: "app-client-id",
            displayName: "Production Operations App",
            id: "app-1",
            signInAudience: "AzureADMyOrg"
          }
        ]
      })
    );
  }

  if (pathName.includes("/directoryRoles?")) {
    return new Response(
      JSON.stringify({
        value: [
          {
            description: "Can manage all directory settings.",
            displayName: "Global Administrator",
            id: "role-1"
          }
        ]
      })
    );
  }

  return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
}

function tokenThenGraph(assertToken: (init?: RequestInit) => void) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/oauth2/v2.0/token")) {
      expect(init?.method).toBe("POST");
      assertToken(init);
      return new Response(JSON.stringify({ access_token: ACCESS_TOKEN }));
    }
    return graphCollection(url, init);
  });
}

describe("Microsoft Entra certificate and federated grants", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("advertises certificate and federated auth while keeping client secret", () => {
    const connector = getConnectorByKey("microsoft-entra-id");
    const kinds = connector!.manifest.authMethods.map((method) => method.kind);

    expect(kinds).toEqual(
      expect.arrayContaining([
        "mock",
        "oauth2ClientCredentials",
        "certificate",
        "federated"
      ])
    );

    const certificate = connector!.manifest.authMethods.find(
      (method) => method.kind === "certificate"
    );
    expect(certificate?.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining([
        "tenantId",
        "clientId",
        "certificateThumbprint",
        "privateKeyPem"
      ])
    );
    expect(
      certificate?.fields.find((field) => field.key === "privateKeyPem")?.secret
    ).toBe(true);

    const federated = connector!.manifest.authMethods.find(
      (method) => method.kind === "federated"
    );
    expect(federated?.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(["tenantId", "clientId", "clientAssertion"])
    );
    expect(
      federated?.fields.find((field) => field.key === "clientAssertion")?.secret
    ).toBe(true);

    const secret = connector!.manifest.authMethods.find(
      (method) => method.kind === "oauth2ClientCredentials"
    );
    expect(secret?.fields.map((field) => field.key)).toEqual(
      expect.arrayContaining(["tenantId", "clientId", "clientSecret"])
    );
  });

  it("exchanges a certificate grant then reads Graph without logging thumbprint or key", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" }
    });
    const privateKeyPem = privateKey;
    const expectedX5t = Buffer.from(THUMBPRINT, "hex").toString("base64url");
    const fetchMock = tokenThenGraph((init) => {
      const body = tokenBody(init);
      expect(body.get("client_secret")).toBeNull();
      expect(body.get("client_id")).toBe(CLIENT_ID);
      expect(body.get("grant_type")).toBe("client_credentials");
      expect(body.get("client_assertion_type")).toBe(
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"
      );
      const assertion = body.get("client_assertion");
      expect(assertion).toEqual(expect.stringMatching(/^eyJ/u));
      const header = JSON.parse(
        Buffer.from(assertion!.split(".")[0]!, "base64url").toString("utf8")
      ) as { x5t?: string };
      expect(header.x5t).toBe(expectedX5t);
    });
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("microsoft-entra-id");
    const result = await connector!.sync({
      authType: "certificate",
      config: {
        certificateThumbprint: THUMBPRINT,
        clientId: CLIENT_ID,
        connectorKey: "microsoft-entra-id",
        privateKeyPem,
        tenantId: ENTRA_DIRECTORY_ID
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.assets.map((asset) => asset.assetType)).toEqual(
      expect.arrayContaining(["IdentityStore", "Application"])
    );
    expect(fetchMock.mock.calls.some((call) => String(call[0]) === TOKEN_URL)).toBe(
      true
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(ACCESS_TOKEN);
    expect(serialized).not.toContain(THUMBPRINT);
    expect(serialized).not.toContain(pemBodyLine(privateKeyPem));
  });

  it("exchanges a federated assertion then reads Graph without logging the assertion", async () => {
    const fetchMock = tokenThenGraph((init) => {
      const body = tokenBody(init);
      expect(body.get("client_secret")).toBeNull();
      expect(body.get("client_assertion")).toBe(FEDERATED_ASSERTION);
    });
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("microsoft-entra-id");
    const result = await connector!.sync({
      authType: "federated",
      config: {
        clientAssertion: FEDERATED_ASSERTION,
        clientId: CLIENT_ID,
        connectorKey: "microsoft-entra-id",
        tenantId: ENTRA_DIRECTORY_ID
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining(["IdentityStore", "PrivilegedIdentity"])
    );
    expect(JSON.stringify(result)).not.toContain(FEDERATED_ASSERTION);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
  });

  it("keeps the client-secret path for scratch Entra app registrations", async () => {
    const fetchMock = tokenThenGraph((init) => {
      expect(String(init?.body)).toContain(`client_secret=${CLIENT_SECRET}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("microsoft-entra-id");
    const result = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        connectorKey: "microsoft-entra-id",
        tenantId: ENTRA_DIRECTORY_ID
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(result.health.status).toBe("Healthy");
    expect(JSON.stringify(result)).not.toContain(CLIENT_SECRET);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
  });

  it("maps vendor 401 on certificate token exchange to Degraded with empty findings", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { format: "pem", type: "pkcs8" },
      publicKeyEncoding: { format: "pem", type: "spki" }
    });
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ error: "invalid_client" }), {
          status: 401
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("microsoft-entra-id");
    const result = await connector!.sync({
      authType: "certificate",
      config: {
        certificateThumbprint: THUMBPRINT,
        clientId: CLIENT_ID,
        privateKeyPem: privateKey,
        tenantId: ENTRA_DIRECTORY_ID
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(result.health.status).toBe("Degraded");
    expect(result.health.authorizationVerified).toBe(false);
    expect(result.assets).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(result.identityCandidates ?? []).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(pemBodyLine(privateKey));
    expect(JSON.stringify(result)).not.toContain(THUMBPRINT);
  });

  it("maps Graph 401 after a federated token to Degraded instead of inventing findings", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void init;
        if (String(input).includes("/oauth2/v2.0/token")) {
          return new Response(JSON.stringify({ access_token: ACCESS_TOKEN }));
        }
        return new Response("unauthorized", { status: 401 });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("microsoft-entra-id");
    const result = await connector!.sync({
      authType: "federated",
      config: {
        clientAssertion: FEDERATED_ASSERTION,
        clientId: CLIENT_ID,
        tenantId: ENTRA_DIRECTORY_ID
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(result.health.status).toBe("Degraded");
    expect(result.assets).toEqual([]);
    expect(result.signals).toEqual([]);
    expect(JSON.stringify(result)).not.toContain(FEDERATED_ASSERTION);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN);
  });
});
