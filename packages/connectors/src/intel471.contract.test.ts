import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const I471_USER = "soc@acme.test";
const I471_KEY = "intel471-secret-key";

/**
 * Recorded-fixture contract test for the live `intel471` (Titan) connector. The
 * shape mirrors a real `GET /v1/reports` response; we stub global `fetch` so CI
 * verifies the request contract (HTTP Basic email:key) + normalization. Beta:
 * pending live-smoke.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function reportsResponse() {
  return new Response(
    JSON.stringify({
      reportTotalCount: 2,
      reports: [
        {
          admiralty_code: "A1",
          subject: "Threat actor targeting financial sector",
          uid: "report-1"
        },
        {
          admiralty_code: "C3",
          subject: "Commodity malware update",
          uid: "report-2"
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
    config: { apiKey: I471_KEY, apiUser: I471_USER, queryLimit: 50 },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("intel471 connector contract", () => {
  it("issues the documented reports request with Basic auth and normalizes by admiralty grade", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => reportsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("intel471");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("/v1/reports");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const expectedBasic = `Basic ${Buffer.from(
      `${I471_USER}:${I471_KEY}`
    ).toString("base64")}`;
    expect(headers.authorization).toBe(expectedBasic);

    expect(signals).toHaveLength(2);
    expect(
      signals.every((s) => s.signalSubcategory === "ThreatIntelReport")
    ).toBe(true);
    // admiralty A1 -> High; C3 -> Moderate.
    expect(signals[0]!.sensitivityLevel).toBe("High");
    expect(signals[1]!.sensitivityLevel).toBe("Moderate");

    expect(JSON.stringify(signals)).not.toContain(I471_KEY);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => reportsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("intel471");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("count=1");
  });
});
