import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const NS_TOKEN = "netskope-secret-api-token";
const NS_TENANT = "https://acme.goskope.com";

/**
 * Recorded-fixture contract test for the live `netskope` connector — the first
 * real control *observer* among the market-leader set. The shape mirrors a real
 * Netskope REST v2 `GET /api/v2/events/data/alert` response; we stub global
 * `fetch` so CI verifies the request contract, observeControl outcome, and
 * signal normalization with no live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function alertsResponse() {
  return new Response(
    JSON.stringify({
      result: [
        {
          action: "blocked",
          alert_name: "DLP: Source Code Exfiltration",
          alert_type: "DLP",
          severity: "high",
          timestamp: 1_717_900_000
        },
        {
          action: "alerted",
          alert_name: "Anomaly: Bulk Download",
          alert_type: "anomaly",
          severity: "medium",
          timestamp: 1_717_900_500
        }
      ],
      status: "success"
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
    config: { apiToken: NS_TOKEN, queryLimit: 50, tenantUrl: NS_TENANT },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("netskope connector contract", () => {
  it("observes control enforcement as a Blocked outcome", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => alertsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("netskope");
    expect(connector).toBeDefined();
    expect(connector!.observeControl).toBeDefined();
    const observation = await connector!.observeControl!(configuredContext());

    const [url, init] = fetchMock.mock.calls[0]!;
    const requestUrl = String(url);
    expect(requestUrl).toContain("/api/v2/events/data/alert");
    expect(requestUrl).toContain("timeperiod=86400");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["Netskope-Api-Token"]).toBe(NS_TOKEN);
    expect(init?.method).toBe("GET");

    // A blocked alert in the window -> Blocked outcome.
    expect(observation.outcome).toBe("Blocked");
    expect(observation.sourceType).toBe("netskope.alert.observer");
    expect(JSON.stringify(observation)).not.toContain(NS_TOKEN);
  });

  it("normalizes alerts to ControlObservation signals", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => alertsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("netskope");
    const signals = await connector!.collectSignals(configuredContext());
    expect(signals).toHaveLength(2);
    expect(
      signals.every((s) => s.signalCategory === "ControlObservation")
    ).toBe(true);
    const blocked = signals.find(
      (s) => s.signalSubcategory === "SsePolicyBlocked"
    );
    expect(blocked?.sensitivityLevel).toBe("High");
    expect(JSON.stringify(signals)).not.toContain(NS_TOKEN);
  });

  it("reports NoEvidence when the window has no alerts", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify({ result: [], status: "success" }), {
          status: 200
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("netskope");
    const observation = await connector!.observeControl!(configuredContext());
    expect(observation.outcome).toBe("NoEvidence");
  });
});
