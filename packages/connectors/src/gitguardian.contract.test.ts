import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const GG_API_KEY = "gitguardian-secret-api-token";

/**
 * Recorded-fixture contract test for the live `gitguardian` connector.
 *
 * The captured shape mirrors a real GitGuardian REST
 * `GET /v1/incidents/secrets` response (a JSON array of incidents). We stub
 * global `fetch` so CI verifies the request contract (URL, per_page query,
 * `Authorization: Token` header) and signal normalization without any live
 * GitGuardian call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function incidentsResponse() {
  return new Response(
    JSON.stringify([
      {
        detector: { name: "AWS Access Key" },
        id: 4567,
        severity: "high",
        status: "TRIGGERED",
        validity: "valid"
      },
      {
        detector: { name: "Generic High Entropy Secret" },
        id: 4568,
        severity: "low",
        status: "TRIGGERED",
        validity: "no_checker"
      }
    ]),
    { headers: { "content-type": "application/json" }, status: 200 }
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function configuredContext() {
  return {
    authType: "apiToken" as const,
    config: { apiKey: GG_API_KEY, queryLimit: 50 },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("gitguardian connector contract", () => {
  it("issues the documented read-only request and normalizes incidents to exposure signals", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => incidentsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("gitguardian");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const requestUrl = String(url);
    expect(requestUrl).toContain("/v1/incidents/secrets");
    expect(requestUrl).toContain("per_page=50");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe(`Token ${GG_API_KEY}`);
    expect(init?.method).toBe("GET");

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    expect(signals.every((s) => s.signalSubcategory === "LeakedSecret")).toBe(
      true
    );
    expect(signals.every((s) => s.sourceType === "gitguardian.incident")).toBe(
      true
    );
    // high severity -> High; low severity but no_checker validity -> Low.
    expect(signals[0]!.sensitivityLevel).toBe("High");
    expect(signals[1]!.sensitivityLevel).toBe("Low");

    expect(JSON.stringify(signals)).not.toContain(GG_API_KEY);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => incidentsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("gitguardian");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(health.authorizationVerified).toBe(true);
    expect(String(fetchMock.mock.calls[0]![0])).toContain("per_page=1");
  });
});
