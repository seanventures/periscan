import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SEMGREP_TOKEN = "semgrep-secret-token";
const SEMGREP_SLUG = "acme-org";

/**
 * Recorded-fixture contract test for the live `semgrep` connector. The shape
 * mirrors a real Semgrep `GET /api/v1/deployments/{slug}/findings` response; we
 * stub global `fetch` so CI verifies the request contract + normalization with
 * no live call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function findingsResponse() {
  return new Response(
    JSON.stringify({
      findings: [
        {
          confidence: "high",
          id: 9001,
          rule_name: "javascript.express.security.injection.tainted-sql-string",
          severity: "high",
          state: "open"
        },
        {
          confidence: "low",
          id: 9002,
          rule_name: "generic.secrets.security.detected-generic-secret",
          severity: "low",
          state: "open"
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
    config: {
      apiToken: SEMGREP_TOKEN,
      deploymentSlug: SEMGREP_SLUG,
      queryLimit: 50
    },
    integrationId: "99999999-8888-4777-a666-555555555555",
    mockMode: false,
    tenantId: "12121212-3434-4565-a787-989898989898"
  };
}

describe("semgrep connector contract", () => {
  it("issues the documented read-only request and normalizes findings to exposure signals", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => findingsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("semgrep");
    expect(connector).toBeDefined();
    const signals = await connector!.collectSignals(configuredContext());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    const requestUrl = String(url);
    expect(requestUrl).toContain(
      `/api/v1/deployments/${SEMGREP_SLUG}/findings`
    );
    expect(requestUrl).toContain("page_size=50");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${SEMGREP_TOKEN}`);
    expect(init?.method).toBe("GET");

    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s.signalCategory === "Exposure")).toBe(true);
    const sast = signals.find(
      (s) => s.signalSubcategory === "ApplicationVulnerability"
    );
    expect(sast?.sensitivityLevel).toBe("High");
    // secrets rule -> LeakedSecret subcategory.
    const secret = signals.find((s) => s.signalSubcategory === "LeakedSecret");
    expect(secret).toBeDefined();

    expect(JSON.stringify(signals)).not.toContain(SEMGREP_TOKEN);
  });

  it("verifies health via a bounded read-only lookup", async () => {
    const fetchMock = vi.fn<(...args: FetchArgs) => Promise<Response>>(
      async () => findingsResponse()
    );
    vi.stubGlobal("fetch", fetchMock);

    const connector = getConnectorByKey("semgrep");
    const health = await connector!.healthCheck(configuredContext());
    expect(health.status).toBe("Healthy");
    expect(String(fetchMock.mock.calls[0]![0])).toContain("page_size=1");
  });
});
