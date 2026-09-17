import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SSC_KEY = "securityscorecard-secret-token";
const SSC_ID = "acme.test";

/**
 * Recorded-fixture contract test for the live `securityscorecard` connector. The
 * shape mirrors a real `GET /companies/{id}/factors` response; we stub global
 * `fetch` so CI verifies the request contract + normalization with no live call.
 * Beta: endpoint/auth follow public docs, pending live-smoke.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function factorsResponse() {
  return new Response(
    JSON.stringify({
      entries: [
        { grade: "F", name: "network_security", score: 42 },
        { grade: "A", name: "dns_health", score: 95 }
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
    config: { apiKey: SSC_KEY, scorecardIdentifier: SSC_ID },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("securityscorecard connector contract", () => {
  it("issues the documented factors request and normalizes ratings by grade", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => factorsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("securityscorecard");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain(`/companies/${SSC_ID}/factors`);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe(`Token ${SSC_KEY}`);

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    expect(signals.every((s) => s.signalSubcategory === "SecurityRating")).toBe(
      true
    );
    // grade F -> High; grade A -> Low.
    expect(signals[0]!.sensitivityLevel).toBe("High");
    expect(signals[1]!.sensitivityLevel).toBe("Low");

    expect(JSON.stringify(signals)).not.toContain(SSC_KEY);
  });

  it("verifies health via a read-only factors lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => factorsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("securityscorecard");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(health.authorizationVerified).toBe(true);
  });
});
