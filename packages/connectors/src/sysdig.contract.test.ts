import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SYSDIG_TOKEN = "sysdig-secret-api-token";

/**
 * Recorded-fixture contract test for the live `sysdig` connector. The shape
 * mirrors a real Sysdig Secure `GET /api/v1/secureEvents` response; we stub
 * global `fetch` so CI verifies the request contract + normalization with no
 * live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

const SECURE_EVENTS_RESPONSE = {
  data: [
    {
      category: "runtime",
      id: "evt-high",
      name: "Terminal shell in container",
      ruleName: "Terminal shell in container",
      severity: 1
    },
    {
      category: "posture",
      id: "evt-mod",
      name: "Privileged container",
      ruleName: "Privileged container",
      severity: 5
    },
    {
      category: "runtime",
      id: "evt-low",
      name: "Informational rule match",
      ruleName: "Info",
      severity: 7
    }
  ],
  page: { matched: 3, total: 3 }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function configuredContext() {
  return {
    authType: "bearer" as const,
    config: { apiBaseUrl: "https://secure.sysdig.com", apiToken: SYSDIG_TOKEN },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("sysdig connector contract", () => {
  it("reads secure events and maps severity to sensitivity", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(SECURE_EVENTS_RESPONSE), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("sysdig");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    // One bounded request to the Secure Events API with the Bearer token.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      "/api/v1/secureEvents"
    );
    const headers = (fetchMock.mock.calls[0]![1]?.headers ?? {}) as Record<
      string,
      string
    >;
    expect(headers.authorization).toBe(`Bearer ${SYSDIG_TOKEN}`);

    expect(signals).toHaveLength(3);
    expect(signals.every((s) => s.signalCategory === "Cloud")).toBe(true);
    expect(
      signals.every((s) => s.signalSubcategory === "CloudWorkloadRisk")
    ).toBe(true);
    // Syslog-style severity: 1 -> High, 5 -> Moderate, 7 -> Low.
    expect(signals.map((s) => s.sensitivityLevel)).toEqual([
      "High",
      "Moderate",
      "Low"
    ]);

    expect(JSON.stringify(signals)).not.toContain(SYSDIG_TOKEN);
  });

  it("verifies health via a single bounded lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () =>
        new Response(JSON.stringify(SECURE_EVENTS_RESPONSE), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("sysdig");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Health probe requests a single event (limit=1).
    expect(String(fetchMock.mock.calls[0]![0])).toContain("limit=1");
  });

  it("surfaces an unhealthy status when the API rejects the token", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => new Response("unauthorized", { status: 401 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("sysdig");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Unhealthy");
    expect(health.authorizationVerified).toBe(false);
  });
});
