import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_ID = "22222222-2222-4222-8222-222222222222";

describe("SIEM live sync health grounding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("verifies Elastic Security sync health without fabricating live signals", async () => {
    const connector = getConnectorByKey("elastic-security");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe(
          "https://elastic.example.com/_cluster/health"
        );
        expect(init?.method).toBe("GET");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "ApiKey elastic-secret-key"
        );

        return new Response(JSON.stringify({ status: "green" }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiToken",
      config: {
        apiKey: "elastic-secret-key",
        baseUrl: "https://elastic.example.com",
        connectorKey: "elastic-security"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("elastic-secret-key");
  });

  it("verifies Datadog Cloud SIEM sync health without fabricating live signals", async () => {
    const connector = getConnectorByKey("datadog-siem");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe("https://api.datadoghq.com/api/v1/validate");
        expect(init?.method).toBe("GET");
        const headers = init?.headers as Record<string, string>;
        expect(headers["DD-API-KEY"]).toBe("datadog-secret-api-key");
        expect(headers["DD-APPLICATION-KEY"]).toBe(
          "datadog-secret-application-key"
        );

        return new Response(JSON.stringify({ valid: true }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiToken",
      config: {
        apiBaseUrl: "https://api.datadoghq.com",
        apiKey: "datadog-secret-api-key",
        applicationKey: "datadog-secret-application-key",
        connectorKey: "datadog-siem"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("datadog-secret-api-key");
    expect(JSON.stringify(result)).not.toContain(
      "datadog-secret-application-key"
    );
  });

  it("verifies Google SecOps sync health without fabricating live signals", async () => {
    const connector = getConnectorByKey("google-chronicle");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.origin).toBe("https://chronicle.googleapis.com");
        expect(url.pathname).toBe(
          "/v1alpha/projects/secops-project/locations/us/instances/customer-instance:udmSearch"
        );
        expect(url.searchParams.get("query")).toBe('metadata.event_type != ""');
        expect(init?.method).toBe("GET");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer google-secops-access-token"
        );

        return new Response(JSON.stringify({ events: [] }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "accessToken",
      config: {
        accessToken: "google-secops-access-token",
        apiBaseUrl: "https://chronicle.googleapis.com",
        connectorKey: "google-chronicle",
        from: "2026-06-03T00:00:00.000Z",
        instance:
          "projects/secops-project/locations/us/instances/customer-instance",
        limit: 5,
        queryDialect: "YL2",
        to: "2026-06-04T00:00:00.000Z"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("google-secops-access-token");
  });

  it("verifies Rapid7 InsightIDR sync health without fabricating live signals", async () => {
    const connector = getConnectorByKey("rapid7-insightidr");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(String(input));
        expect(url.origin).toBe("https://us.rest.logs.insight.rapid7.com");
        expect(url.pathname).toBe("/query/logsets");
        expect(url.searchParams.get("query")).toBe("where(/periscan/)");
        expect(url.searchParams.get("per_page")).toBe("1");
        expect(init?.method).toBe("GET");
        expect((init?.headers as Record<string, string>)["x-api-key"]).toBe(
          "rapid7-secret-api-key"
        );

        return new Response(JSON.stringify({ events: [] }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiKey",
      config: {
        apiBaseUrl: "https://us.rest.logs.insight.rapid7.com",
        apiKey: "rapid7-secret-api-key",
        connectorKey: "rapid7-insightidr"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("rapid7-secret-api-key");
  });

  it("verifies Microsoft Sentinel sync health without fabricating live signals", async () => {
    const connector = getConnectorByKey("microsoft-sentinel");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input);

        if (
          url ===
          "https://login.microsoftonline.com/sentinel-tenant/oauth2/v2.0/token"
        ) {
          expect(init?.method).toBe("POST");
          const body = new URLSearchParams(String(init?.body));
          expect(body.get("client_id")).toBe("sentinel-client-id");
          expect(body.get("client_secret")).toBe("sentinel-client-secret");

          return new Response(
            JSON.stringify({ access_token: "sentinel-token" }),
            {
              headers: { "content-type": "application/json" },
              status: 200
            }
          );
        }

        expect(url).toBe(
          "https://api.loganalytics.io/v1/workspaces/sentinel-workspace/query"
        );
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer sentinel-token"
        );
        expect(String(init?.body)).toContain("PeriscanHealth");

        return new Response(JSON.stringify({ tables: [] }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: {
        clientId: "sentinel-client-id",
        clientSecret: "sentinel-client-secret",
        connectorKey: "microsoft-sentinel",
        tenantId: "sentinel-tenant",
        workspaceId: "sentinel-workspace"
      },
      integrationId: INTEGRATION_ID,
      mockMode: false,
      tenantId: TENANT_ID
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain("sentinel-client-secret");
    expect(JSON.stringify(result)).not.toContain("sentinel-token");
  });
});
