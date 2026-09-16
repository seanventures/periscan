import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SPUR_KEY = "spur-secret-api-key";
const IP_A = "198.51.100.9";
const IP_B = "203.0.113.30";

/**
 * Recorded-fixture contract test for the live `spur` connector. The shape
 * mirrors a real Spur `GET /v2/context/{ip}` response; we stub global `fetch` so
 * CI verifies the per-IP request contract + normalization with no live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function contextFor(url: string) {
  if (url.includes(IP_A)) {
    return new Response(
      JSON.stringify({
        as: { organization: "Anon VPN LLC" },
        ip: IP_A,
        risks: ["WEB_SCRAPING", "TUNNEL"],
        tunnels: [{ type: "VPN" }]
      }),
      { status: 200 }
    );
  }
  return new Response(
    JSON.stringify({ as: { organization: "Acme ISP" }, ip: IP_B, risks: [] }),
    { status: 200 }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function configuredContext() {
  return {
    authType: "apiKey" as const,
    config: { apiKey: SPUR_KEY, ipAddresses: [IP_A, IP_B] },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("spur connector contract", () => {
  it("looks up each configured IP and flags anonymous infrastructure", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async (input) => contextFor(String(input))
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("spur");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    // One request per configured IP, with the Token header.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]![0])).toContain(
      `/v2/context/${IP_A}`
    );
    const headers = (fetchMock.mock.calls[0]![1]?.headers ?? {}) as Record<
      string,
      string
    >;
    expect(headers.Token).toBe(SPUR_KEY);

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    // VPN/risks IP -> anonymous infrastructure, High; clean IP -> IpContext, Low.
    const anon = signals.find(
      (s) => s.signalSubcategory === "AnonymousInfrastructure"
    );
    expect(anon?.sensitivityLevel).toBe("High");
    const clean = signals.find((s) => s.signalSubcategory === "IpContext");
    expect(clean?.sensitivityLevel).toBe("Low");

    expect(JSON.stringify(signals)).not.toContain(SPUR_KEY);
  });

  it("verifies health via a single bounded lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async (input) => contextFor(String(input))
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("spur");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    // Health probes only the first IP.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
