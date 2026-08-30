import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const BS_TOKEN = "bitsight-secret-token";
const BS_GUID = "11111111-2222-3333-4444-555555555555";

/**
 * Recorded-fixture contract test for the live `bitsight` connector. The shape
 * mirrors a real `GET /ratings/v1/companies/{guid}/findings` response; we stub
 * global `fetch` so CI verifies the request contract (incl. HTTP Basic with the
 * token as username) + normalization. Beta: pending live-smoke.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function findingsResponse() {
  return new Response(
    JSON.stringify({
      results: [
        {
          risk_category: "Diligence",
          risk_vector_label: "Open Ports",
          severity_category: "severe"
        },
        {
          risk_category: "Diligence",
          risk_vector_label: "TLS/SSL Configurations",
          severity_category: "minor"
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
    authType: "apiToken" as const,
    config: { apiToken: BS_TOKEN, companyGuid: BS_GUID, queryLimit: 50 },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("bitsight connector contract", () => {
  it("issues the documented findings request with Basic auth and normalizes by severity", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => findingsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("bitsight");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain(`/ratings/v1/companies/${BS_GUID}/findings`);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const expectedBasic = `Basic ${Buffer.from(`${BS_TOKEN}:`).toString(
      "base64"
    )}`;
    expect(headers.authorization).toBe(expectedBasic);

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    expect(signals.every((s) => s.signalSubcategory === "SecurityRating")).toBe(
      true
    );
    // severe -> High; minor -> Low.
    expect(signals[0]!.sensitivityLevel).toBe("High");
    expect(signals[1]!.sensitivityLevel).toBe("Low");

    expect(JSON.stringify(signals)).not.toContain(BS_TOKEN);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => findingsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("bitsight");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("limit=1");
  });
});
