import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const DT_USER = "iris-user";
const DT_KEY = "domaintools-secret-key";

/**
 * Recorded-fixture contract test for the live `domaintools` (Iris Investigate)
 * connector. The shape mirrors a real `GET /v1/iris-investigate/` response; we
 * stub global `fetch` so CI verifies the request contract + normalization with no
 * live call. Beta: endpoint/auth follow public Iris docs, pending live-smoke.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function irisResponse() {
  return new Response(
    JSON.stringify({
      response: {
        results: [
          { domain: "phishy.example.test", domain_risk: { risk_score: 92 } },
          {
            domain: "acme-partner.example.test",
            domain_risk: { risk_score: 18 }
          }
        ]
      }
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
      apiKey: DT_KEY,
      apiUser: DT_USER,
      domains: ["phishy.example.test", "acme-partner.example.test"]
    },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("domaintools connector contract", () => {
  it("issues the documented Iris Investigate request and normalizes domain risk", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => irisResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("domaintools");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = String(fetchMock.mock.calls[0]![0]);
    expect(requestUrl).toContain("/v1/iris-investigate/");
    expect(requestUrl).toContain(`api_username=${DT_USER}`);
    expect(requestUrl).toContain("domain=phishy.example.test");

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    expect(signals.every((s) => s.signalSubcategory === "DomainIntel")).toBe(
      true
    );
    // risk 92 -> High; risk 18 -> Low.
    expect(signals[0]!.sensitivityLevel).toBe("High");
    expect(signals[1]!.sensitivityLevel).toBe("Low");

    expect(JSON.stringify(signals)).not.toContain(DT_KEY);
  });

  it("verifies health via a single-domain bounded lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => irisResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("domaintools");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    // Health probes only the first domain.
    expect(String(fetchMock.mock.calls[0]![0])).not.toContain(
      "acme-partner.example.test"
    );
  });
});
