import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const UMB_ID = "umbrella-key-id";
const UMB_SECRET = "umbrella-secret-value";
const UMB_TOKEN = "umbrella-access-token";

/**
 * Recorded-fixture contract test for the live `cisco-umbrella` observer. Exercises
 * the OAuth2 token exchange + activity report: first call mints a token, second
 * reads activity. We stub global `fetch` so CI verifies the contract with no live
 * call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function respondByUrl(url: string) {
  if (url.includes("/auth/v2/token")) {
    return new Response(
      JSON.stringify({ access_token: UMB_TOKEN, expires_in: 3600 }),
      { status: 200 }
    );
  }
  return new Response(
    JSON.stringify({
      data: [
        {
          categories: ["Malware"],
          domain: "malware.example.test",
          verdict: "blocked"
        },
        {
          categories: ["Newly Seen Domains"],
          domain: "suspicious.example.test",
          verdict: "allowed"
        }
      ]
    }),
    { status: 200 }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function configuredContext() {
  return {
    authType: "apiKey" as const,
    config: { apiKeyId: UMB_ID, apiKeySecret: UMB_SECRET, queryLimit: 50 },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("cisco-umbrella connector contract", () => {
  it("mints an OAuth2 token then reads activity and observes a Blocked outcome", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async (input) => respondByUrl(String(input))
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("cisco-umbrella");
    expect(connector?.observeControl).toBeDefined();
    const observation = await connector!.observeControl!(configuredContext());

    // Two calls: token (Basic + client_credentials), then activity (Bearer).
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0]!;
    expect(String(tokenUrl)).toContain("/auth/v2/token");
    const tokenHeaders = (tokenInit?.headers ?? {}) as Record<string, string>;
    const expectedBasic = `Basic ${Buffer.from(
      `${UMB_ID}:${UMB_SECRET}`
    ).toString("base64")}`;
    expect(tokenHeaders.authorization).toBe(expectedBasic);
    expect(String(tokenInit?.body)).toContain("grant_type=client_credentials");

    const [actUrl, actInit] = fetchMock.mock.calls[1]!;
    expect(String(actUrl)).toContain("/reports/v2/activity");
    const actHeaders = (actInit?.headers ?? {}) as Record<string, string>;
    expect(actHeaders.authorization).toBe(`Bearer ${UMB_TOKEN}`);

    expect(observation.outcome).toBe("Blocked");
    expect(observation.sourceType).toBe("cisco-umbrella.activity.observer");
    expect(JSON.stringify(observation)).not.toContain(UMB_SECRET);
  });

  it("normalizes activity to ControlObservation signals", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async (input) => respondByUrl(String(input))
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("cisco-umbrella");
    const signals = await connector!.collectSignals(configuredContext());
    expect(signals).toHaveLength(2);
    expect(
      signals.every((s) => s.signalCategory === "ControlObservation")
    ).toBe(true);
    expect(signals.some((s) => s.signalSubcategory === "DnsLayerBlocked")).toBe(
      true
    );
    expect(JSON.stringify(signals)).not.toContain(UMB_SECRET);
  });
});
