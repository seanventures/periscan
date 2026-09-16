import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const ANOMALI_USER = "soc@acme.test";
const ANOMALI_KEY = "anomali-secret-api-key";

/**
 * Recorded-fixture contract test for the live `anomali` (ThreatStream) connector.
 * The shape mirrors a real `GET /api/v2/intelligence/` response; we stub global
 * `fetch` so CI verifies the request contract + normalization with no live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function intelResponse() {
  return new Response(
    JSON.stringify({
      meta: { limit: 50, total_count: 2 },
      objects: [
        {
          confidence: 90,
          id: 778001,
          itype: "c2_ip",
          severity: "very-high",
          value: "198.51.100.7"
        },
        {
          confidence: 50,
          id: 778002,
          itype: "suspicious_domain",
          severity: "medium",
          value: "bad.example.test"
        }
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
    authType: "apiKey" as const,
    config: { apiKey: ANOMALI_KEY, apiUser: ANOMALI_USER, queryLimit: 50 },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("anomali connector contract", () => {
  it("issues the documented read-only intelligence request and normalizes indicators", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => intelResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("anomali");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const requestUrl = String(url);
    expect(requestUrl).toContain("/api/v2/intelligence/");
    expect(requestUrl).toContain("limit=50");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe(`apikey ${ANOMALI_USER}:${ANOMALI_KEY}`);
    expect(init?.method).toBe("GET");

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    expect(
      signals.every((s) => s.signalSubcategory === "ThreatIntelIndicator")
    ).toBe(true);
    // very-high severity -> High; confidence 90 -> 0.9.
    expect(signals[0]!.sensitivityLevel).toBe("High");
    expect(signals[0]!.confidence).toBeCloseTo(0.9, 5);
    expect(signals[1]!.sensitivityLevel).toBe("Moderate");

    expect(JSON.stringify(signals)).not.toContain(ANOMALI_KEY);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => intelResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("anomali");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("limit=1");
  });
});
