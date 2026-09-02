import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SQ_TOKEN = "sonarqube-secret-token";
const SQ_PROJECT = "acme:web";

/**
 * Recorded-fixture contract test for the live `sonarqube` connector. The shape
 * mirrors a real SonarQube `GET /api/issues/search` response; we stub global
 * `fetch` so CI verifies the request contract and normalization with no live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function issuesResponse() {
  return new Response(
    JSON.stringify({
      issues: [
        {
          component: "acme:src/auth.ts",
          key: "AY1-1",
          rule: "typescript:S2076",
          severity: "BLOCKER",
          type: "VULNERABILITY"
        },
        {
          component: "acme:src/util.ts",
          key: "AY1-2",
          rule: "typescript:S1481",
          severity: "MINOR",
          type: "CODE_SMELL"
        }
      ],
      total: 2
    }),
    { headers: { "content-type": "application/json" }, status: 200 }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function configuredContext() {
  return {
    authType: "apiToken" as const,
    config: { apiToken: SQ_TOKEN, componentKeys: SQ_PROJECT, queryLimit: 100 },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("sonarqube connector contract", () => {
  it("issues the documented read-only request and normalizes issues to exposure signals", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => issuesResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("sonarqube");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const requestUrl = String(url);
    expect(requestUrl).toContain("/api/issues/search");
    expect(requestUrl).toContain(
      `componentKeys=${encodeURIComponent(SQ_PROJECT)}`
    );
    expect(requestUrl).toContain("resolved=false");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${SQ_TOKEN}`);
    expect(init?.method).toBe("GET");

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    const vuln = signals.find(
      (s) => s.signalSubcategory === "ApplicationVulnerability"
    );
    expect(vuln?.sensitivityLevel).toBe("High");
    const smell = signals.find(
      (s) => s.signalSubcategory === "CodeQualityIssue"
    );
    expect(smell?.sensitivityLevel).toBe("Low");

    expect(JSON.stringify(signals)).not.toContain(SQ_TOKEN);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => issuesResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("sonarqube");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("ps=1");
  });
});
