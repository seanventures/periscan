import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SHODAN_KEY = "shodan-secret-api-key";
const SHODAN_QUERY = "net:203.0.113.0/24";

/**
 * Recorded-fixture contract test for the live `shodan` connector. The shape
 * mirrors a real Shodan `GET /shodan/host/search` response; we stub global
 * `fetch` so CI verifies the request contract + normalization with no live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function searchResponse() {
  return new Response(
    JSON.stringify({
      matches: [
        {
          ip_str: "203.0.113.10",
          org: "Acme Corp",
          port: 3389,
          product: "Microsoft Terminal Services",
          transport: "tcp",
          vulns: ["CVE-2019-0708"]
        },
        {
          ip_str: "203.0.113.11",
          org: "Acme Corp",
          port: 443,
          product: "nginx",
          transport: "tcp"
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
    authType: "apiKey" as const,
    config: { apiKey: SHODAN_KEY, query: SHODAN_QUERY, queryLimit: 50 },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("shodan connector contract", () => {
  it("issues the documented read-only host search and normalizes matches to exposure signals", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => searchResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("shodan");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]![0]);
    expect(requestUrl).toContain("/shodan/host/search");
    expect(requestUrl).toContain(`key=${SHODAN_KEY}`);
    expect(requestUrl).toContain("query=net");

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    // The host with a CVE is a vulnerable-service exposure at High sensitivity.
    const vulnerable = signals.find(
      (s) => s.signalSubcategory === "ExposedVulnerableService"
    );
    expect(vulnerable?.sensitivityLevel).toBe("High");
    // 443/nginx with no vuln is plain external attack surface.
    const surface = signals.find(
      (s) => s.signalSubcategory === "ExternalAttackSurface"
    );
    expect(surface).toBeDefined();

    // Signals must not embed the API key (it lives only in the request URL).
    expect(JSON.stringify(signals)).not.toContain(SHODAN_KEY);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => searchResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("shodan");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("limit=1");
  });
});
