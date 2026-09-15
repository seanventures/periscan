import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const XRAY_TOKEN = "jfrog-xray-secret-token";
const XRAY_BASE = "https://acme.jfrog.io";

/**
 * Recorded-fixture contract test for the live `jfrog-xray` connector. The shape
 * mirrors a real Xray `POST /xray/api/v1/violations` response; we stub global
 * `fetch` so CI verifies the request contract + normalization with no live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function violationsResponse() {
  return new Response(
    JSON.stringify({
      total_violations: 2,
      violations: [
        { severity: "High", type: "security", watch_name: "prod-watch" },
        { severity: "Low", type: "license", watch_name: "prod-watch" }
      ]
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
    config: { apiBaseUrl: XRAY_BASE, apiToken: XRAY_TOKEN, queryLimit: 50 },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("jfrog-xray connector contract", () => {
  it("issues the documented read-only violations query and normalizes results", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => violationsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("jfrog-xray");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe(`${XRAY_BASE}/xray/api/v1/violations`);
    expect(init?.method).toBe("POST");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${XRAY_TOKEN}`);
    const body = JSON.parse(String(init?.body ?? "{}"));
    expect(body.pagination.limit).toBe(50);

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    const vuln = signals.find(
      (s) => s.signalSubcategory === "ArtifactVulnerability"
    );
    expect(vuln?.sensitivityLevel).toBe("High");
    const license = signals.find(
      (s) => s.signalSubcategory === "LicenseComplianceIssue"
    );
    expect(license?.sensitivityLevel).toBe("Low");

    expect(JSON.stringify(signals)).not.toContain(XRAY_TOKEN);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => violationsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("jfrog-xray");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    const body = JSON.parse(String(fetchMock.mock.calls[0]![1]?.body ?? "{}"));
    expect(body.pagination.limit).toBe(1);
  });
});
