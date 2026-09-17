import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey, getConnectorCatalogEntryByKey } from "./index.js";

const context = {
  authType: "oauth2ClientCredentials",
  config: {
    apiVersion: "67.0",
    clientId: "consumer-key",
    clientSecret: "consumer-secret",
    includeLoginHistory: true,
    loginUrl: "https://login.salesforce.test",
    maxRecords: 500
  },
  integrationId: "11111111-1111-4111-8111-111111111111",
  mockMode: false,
  tenantId: "22222222-2222-4222-8222-222222222222"
};

describe("Salesforce connector contract", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is a real read-only OAuth/query connector with isolated mock support", async () => {
    const connector = getConnectorByKey("salesforce");
    expect(getConnectorCatalogEntryByKey("salesforce")).toMatchObject({
      availability: "Beta",
      connectorKey: "salesforce",
      implementationTier: "DedicatedClient",
      live: true
    });

    const result = await connector!.sync({
      ...context,
      authType: "mock",
      config: {},
      mockMode: true
    });
    expect(result.health.status).toBe("Healthy");
    expect(result.assets[0]).toMatchObject({
      assetType: "IdentityStore",
      name: "Periscan Customer"
    });
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining([
        "PrivilegedIdentity",
        "StaleUserAccount",
        "FailedAuthenticationObserved"
      ])
    );
  });

  it("uses client credentials and only versioned query GETs", async () => {
    const requests: Array<{ init?: RequestInit; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);
        requests.push({ init, url });

        if (url.endsWith("/services/oauth2/token")) {
          return new Response(
            JSON.stringify({
              access_token: "access-token",
              instance_url: "https://customer.my.salesforce.com"
            }),
            { status: 200 }
          );
        }
        const decoded = decodeURIComponent(url);
        if (decoded.includes("FROM Organization")) {
          return new Response(
            JSON.stringify({
              done: true,
              records: [
                {
                  Id: "00D-live",
                  IsSandbox: false,
                  Name: "Live Customer",
                  OrganizationType: "Enterprise Edition"
                }
              ]
            }),
            { status: 200 }
          );
        }
        if (decoded.includes("FROM User")) {
          return new Response(
            JSON.stringify({
              done: true,
              records: [
                {
                  Id: "005-live",
                  IsActive: true,
                  LastLoginDate: null,
                  Name: "Admin",
                  Profile: { Name: "System Administrator" },
                  UserType: "Standard",
                  Username: "admin@example.test"
                }
              ]
            }),
            { status: 200 }
          );
        }
        if (decoded.includes("FROM LoginHistory")) {
          return new Response(JSON.stringify({ done: true, records: [] }), {
            status: 200
          });
        }
        throw new Error(`Unexpected Salesforce request: ${url}`);
      })
    );

    const result = await getConnectorByKey("salesforce")!.sync(context);
    expect(result.assets[0]?.name).toBe("Live Customer");
    expect(requests[0]).toMatchObject({
      init: { method: "POST" },
      url: "https://login.salesforce.test/services/oauth2/token"
    });
    expect(
      requests
        .slice(1)
        .every(
          (request) =>
            request.init?.method === "GET" &&
            request.url.startsWith(
              "https://customer.my.salesforce.com/services/data/v67.0/query"
            )
        )
    ).toBe(true);
  });
});
