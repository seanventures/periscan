import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const TENANT_ID = "33333333-3333-4333-8333-333333333333";
const INTEGRATION_ID = "44444444-4444-4444-8444-444444444444";

describe("workflow connector live sync health grounding", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("verifies Jira sync health without fabricating live ticket signals", async () => {
    const connector = getConnectorByKey("jira");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe(
          "https://acme.atlassian.net/rest/api/3/myself"
        );
        expect((init?.headers as Record<string, string>).authorization).toBe(
          `Basic ${Buffer.from(
            "jira-user@example.com:jira-secret-token"
          ).toString("base64")}`
        );

        return new Response(JSON.stringify({ accountId: "account-1" }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiToken",
      config: {
        apiToken: "jira-secret-token",
        email: "jira-user@example.com",
        projectKey: "SEC",
        siteUrl: "https://acme.atlassian.net"
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
    expect(JSON.stringify(result)).not.toContain("jira-secret-token");
  });

  it("verifies GitHub Issues sync health without fabricating live ticket signals", async () => {
    const connector = getConnectorByKey("github-issues");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe("https://api.github.com/repos/acme/app");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "Bearer github-issues-secret-token"
        );

        return new Response(JSON.stringify({ full_name: "acme/app" }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "accessToken",
      config: {
        accessToken: "github-issues-secret-token",
        repositoryFullName: "acme/app"
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
    expect(JSON.stringify(result)).not.toContain("github-issues-secret-token");
  });

  it("verifies Linear sync health without fabricating live ticket signals", async () => {
    const connector = getConnectorByKey("linear");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe("https://api.linear.app/graphql");
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "linear-secret-api-key"
        );
        expect(String(init?.body)).toContain("PeriscanLinearViewer");

        return new Response(
          JSON.stringify({
            data: { viewer: { id: "viewer-1", name: "SecOps" } }
          }),
          {
            headers: { "content-type": "application/json" },
            status: 200
          }
        );
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "linear-secret-api-key",
        teamId: "team-1"
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
    expect(JSON.stringify(result)).not.toContain("linear-secret-api-key");
  });

  it("verifies Opsgenie sync health without fabricating live alert signals", async () => {
    const connector = getConnectorByKey("opsgenie");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe("https://api.opsgenie.com/v2/account");
        expect((init?.headers as Record<string, string>).authorization).toBe(
          "GenieKey opsgenie-secret-api-key"
        );

        return new Response(JSON.stringify({ data: { name: "Ops" } }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: "opsgenie-secret-api-key"
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
    expect(JSON.stringify(result)).not.toContain("opsgenie-secret-api-key");
  });

  it("verifies ServiceNow sync health without fabricating live ticket signals", async () => {
    const connector = getConnectorByKey("servicenow");
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        expect(String(input)).toBe(
          "https://acme.service-now.com/api/now/table/incident?sysparm_limit=1&sysparm_fields=sys_id,number,short_description"
        );
        expect((init?.headers as Record<string, string>).authorization).toBe(
          `Basic ${Buffer.from(
            "servicenow-user:servicenow-secret-password"
          ).toString("base64")}`
        );

        return new Response(JSON.stringify({ result: [] }), {
          headers: { "content-type": "application/json" },
          status: 200
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "basicAuth",
      config: {
        instanceUrl: "https://acme.service-now.com",
        password: "servicenow-secret-password",
        username: "servicenow-user"
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
    expect(JSON.stringify(result)).not.toContain("servicenow-secret-password");
  });
});
