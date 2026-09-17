import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const CENSYS_ID = "censys-api-id";
const CENSYS_SECRET = "censys-secret-value";
const CENSYS_QUERY = "services.port: 3389";

/**
 * Recorded-fixture contract test for the live `censys` connector. The shape
 * mirrors a real Censys `GET /api/v2/hosts/search` response; we stub global
 * `fetch` so CI verifies the request contract + normalization with no live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function searchResponse() {
  return new Response(
    JSON.stringify({
      result: {
        hits: [
          {
            autonomous_system: { name: "ACME-AS" },
            ip: "203.0.113.20",
            services: [
              { port: 3389, service_name: "RDP", transport_protocol: "TCP" }
            ]
          },
          {
            autonomous_system: { name: "ACME-AS" },
            ip: "203.0.113.21",
            services: [
              { port: 443, service_name: "HTTP", transport_protocol: "TCP" }
            ]
          }
        ],
        total: 2
      },
      status: "OK"
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
    config: {
      apiId: CENSYS_ID,
      apiSecret: CENSYS_SECRET,
      query: CENSYS_QUERY,
      queryLimit: 50
    },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("censys connector contract", () => {
  it("issues the documented read-only host search with Basic auth and normalizes hits", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => searchResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("censys");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const requestUrl = String(url);
    expect(requestUrl).toContain("/api/v2/hosts/search");
    expect(requestUrl).toContain("per_page=50");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const expectedAuth = `Basic ${Buffer.from(
      `${CENSYS_ID}:${CENSYS_SECRET}`
    ).toString("base64")}`;
    expect(headers.authorization).toBe(expectedAuth);
    expect(init?.method).toBe("GET");

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    expect(
      signals.every((s) => s.signalSubcategory === "ExternalAttackSurface")
    ).toBe(true);
    // 3389/RDP exposed -> Moderate; 443-only -> Low.
    expect(signals[0]!.sensitivityLevel).toBe("Moderate");
    expect(signals[1]!.sensitivityLevel).toBe("Low");

    // The secret must not leak into normalized output.
    expect(JSON.stringify(signals)).not.toContain(CENSYS_SECRET);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => searchResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("censys");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("per_page=1");
  });
});
