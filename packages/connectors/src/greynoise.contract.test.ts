import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const GREYNOISE_API_KEY = "greynoise-secret-api-key";
const GREYNOISE_BASE_URL = "https://api.greynoise.io/v3/community";
const NOISE_IP = "203.0.113.44";
const RIOT_IP = "198.51.100.22";

/**
 * Recorded-fixture contract test for the live `greynoise` connector.
 *
 * The captured shapes mirror real GreyNoise Community API
 * `GET /v3/community/{ip}` responses: one malicious internet-scanner record
 * (`noise: true`) and one benign RIOT record (`riot: true`). We stub global
 * `fetch` so CI verifies the outbound request contract and signal
 * normalization without any live GreyNoise call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function noiseResponse() {
  return new Response(
    JSON.stringify({
      classification: "malicious",
      ip: NOISE_IP,
      last_seen: "2026-06-01",
      link: `https://viz.greynoise.io/ip/${NOISE_IP}`,
      message: "Success",
      name: "Example Scanner",
      noise: true,
      riot: false
    }),
    {
      headers: { "content-type": "application/json" },
      status: 200
    }
  );
}

function riotResponse() {
  return new Response(
    JSON.stringify({
      classification: "benign",
      ip: RIOT_IP,
      last_seen: "2026-06-01",
      link: `https://viz.greynoise.io/riot/${RIOT_IP}`,
      message: "Success",
      name: "Example CDN",
      noise: false,
      riot: true
    }),
    {
      headers: { "content-type": "application/json" },
      status: 200
    }
  );
}

function buildFetchMock() {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    void init;
    const url = String(input);

    if (url.endsWith(encodeURIComponent(NOISE_IP))) {
      return noiseResponse();
    }

    if (url.endsWith(encodeURIComponent(RIOT_IP))) {
      return riotResponse();
    }

    return new Response(JSON.stringify({ message: "not found" }), {
      status: 404
    });
  });
}

const baseConfig = {
  apiBaseUrl: GREYNOISE_BASE_URL,
  apiKey: GREYNOISE_API_KEY,
  connectorKey: "greynoise",
  ipAddresses: [NOISE_IP, RIOT_IP]
} as const;

describe("greynoise contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented Community GET lookups and normalizes Exposure signals", async () => {
    const connector = getConnectorByKey("greynoise");

    expect(connector).toBeDefined();

    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    // ---- Request contract -------------------------------------------------
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as FetchArgs[];

    const requestedUrls = calls.map(([input]) => String(input));
    expect(requestedUrls).toEqual([
      `${GREYNOISE_BASE_URL}/${encodeURIComponent(NOISE_IP)}`,
      `${GREYNOISE_BASE_URL}/${encodeURIComponent(RIOT_IP)}`
    ]);

    for (const [, init] of calls) {
      expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
      const headers = init?.headers as Record<string, string>;
      // Community API authenticates via the `key` header, not a bearer token.
      expect(headers.key).toBe(GREYNOISE_API_KEY);
      expect(headers.accept).toBe("application/json");
      expect(headers.authorization).toBeUndefined();
    }

    // ---- Normalization ----------------------------------------------------
    const categories = new Set(signals.map((signal) => signal.signalCategory));
    expect(categories).toEqual(new Set(["Exposure"]));

    const subcategories = signals.map((signal) => signal.signalSubcategory);
    // Each IP yields a base ThreatIntelObservation; the noise IP adds a
    // MaliciousInternetScanner signal and the RIOT IP adds a BenignRiotService.
    expect(subcategories).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "MaliciousInternetScanner",
        "BenignRiotService"
      ])
    );
    expect(
      subcategories.filter((value) => value === "ThreatIntelObservation")
    ).toHaveLength(2);

    const sourceTypes = new Set(signals.map((signal) => signal.sourceType));
    expect(sourceTypes).toEqual(
      new Set(["greynoise.community", "greynoise.noise", "greynoise.riot"])
    );

    // Secrets must never appear in normalized output.
    expect(JSON.stringify(signals)).not.toContain(GREYNOISE_API_KEY);
  });

  it("runs a live sync that emits the same normalized signals without leaking secrets", async () => {
    const connector = getConnectorByKey("greynoise");
    const fetchMock = buildFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining([
        "ThreatIntelObservation",
        "MaliciousInternetScanner",
        "BenignRiotService"
      ])
    );
    expect(JSON.stringify(result)).not.toContain(GREYNOISE_API_KEY);
  });
});
