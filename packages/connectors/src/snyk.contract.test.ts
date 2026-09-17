import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SNYK_API_KEY = "snyk-secret-api-token";
const SNYK_ORG = "11111111-2222-3333-4444-555555555555";

/**
 * Recorded-fixture contract test for the live `snyk` connector.
 *
 * The captured shape mirrors a real Snyk REST `GET /rest/orgs/{orgId}/issues`
 * (JSON:API) response. We stub global `fetch` so CI verifies the outbound
 * request contract (URL, version/limit query, `Authorization: token` header,
 * JSON:API accept) and signal normalization without any live Snyk call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function issuesResponse() {
  return new Response(
    JSON.stringify({
      data: [
        {
          attributes: {
            effective_severity_level: "critical",
            key: "SNYK-JS-LODASH-1018905",
            status: "open",
            title: "Prototype Pollution in lodash",
            type: "package_vulnerability"
          },
          id: "issue-1",
          type: "issue"
        },
        {
          attributes: {
            effective_severity_level: "low",
            key: "SNYK-CODE-1",
            status: "open",
            title: "Hardcoded secret",
            type: "code_vulnerability"
          },
          id: "issue-2",
          type: "issue"
        }
      ]
    }),
    { headers: { "content-type": "application/vnd.api+json" }, status: 200 }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("snyk connector contract", () => {
  function configuredContext() {
    return {
      authType: "apiToken" as const,
      config: {
        apiKey: SNYK_API_KEY,
        apiVersion: "2024-10-15",
        orgId: SNYK_ORG,
        queryLimit: 50
      },
      integrationId: "99999999-8888-4777-a666-555555555555",
      mockMode: false,
      tenantId: "12121212-3434-4565-a787-989898989898"
    };
  }

  it("issues the documented read-only request and normalizes issues to exposure signals", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => issuesResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("snyk");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    // Request contract.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const requestUrl = String(url);
    expect(requestUrl).toContain(`/rest/orgs/${SNYK_ORG}/issues`);
    expect(requestUrl).toContain("version=2024-10-15");
    expect(requestUrl).toContain("limit=50");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe(`token ${SNYK_API_KEY}`);
    expect(headers.accept).toBe("application/vnd.api+json");
    expect(init?.method).toBe("GET");

    // Normalization: two exposure signals, severity-mapped, with the right subcategory.
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    expect(signals.map((s) => s.sourceType)).toEqual([
      "snyk.issue",
      "snyk.issue"
    ]);
    const dep = signals.find(
      (s) => s.signalSubcategory === "DependencyVulnerability"
    );
    expect(dep?.sensitivityLevel).toBe("High");
    const code = signals.find(
      (s) => s.signalSubcategory === "ApplicationVulnerability"
    );
    expect(code?.sensitivityLevel).toBe("Low");

    // The API token never leaks into normalized output.
    expect(JSON.stringify(signals)).not.toContain(SNYK_API_KEY);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => issuesResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("snyk");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(health.authorizationVerified).toBe(true);
    // Health uses a limit=1 bounded probe.
    expect(String(fetchMock.mock.calls[0]![0])).toContain("limit=1");
  });
});
