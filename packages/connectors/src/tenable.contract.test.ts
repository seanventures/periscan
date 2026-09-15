import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const TENABLE_ACCESS_KEY = "tenable-secret-access-key";
const TENABLE_SECRET_KEY = "tenable-secret-secret-key";
const TENABLE_BASE_URL = "https://cloud.tenable.com";

/**
 * Recorded-fixture contract test for the live `tenable` connector.
 *
 * The captured shapes mirror real Tenable Vulnerability Management Workbenches
 * responses: `/workbenches/assets` returns asset summaries and
 * `/workbenches/vulnerabilities` returns vulnerability summaries (one critical,
 * one high with CVEs). We stub global `fetch` so CI verifies the outbound
 * request contract and response normalization without any live API call.
 */
function buildAssetsResponse() {
  return new Response(
    JSON.stringify({
      assets: [
        {
          acr_score: 9,
          asset_uuid: "tenable-asset-prod-api",
          fqdn: ["prod-api-01.periscan.example"],
          hostname: ["prod-api-01"],
          id: "tenable-asset-prod-api",
          ipv4: ["203.0.113.40"],
          last_seen: "2026-06-01T12:00:00.000Z",
          operating_systems: ["Ubuntu 22.04"],
          severity_counts: { critical: 2, high: 3, low: 1, medium: 4 }
        }
      ],
      total_asset_count: 1
    }),
    {
      headers: {
        "content-type": "application/json"
      },
      status: 200
    }
  );
}

function buildVulnerabilitiesResponse() {
  return new Response(
    JSON.stringify({
      total_vulnerability_count: 2,
      vulnerabilities: [
        {
          count: 5,
          cve: ["CVE-2026-0001"],
          plugin_id: 500001,
          plugin_name: "Critical RCE in example service",
          severity: "critical",
          severity_id: 4,
          vpr_score: 9.1,
          vulnerability_state: "open"
        },
        {
          count: 2,
          cves: ["CVE-2026-0002", "CVE-2026-0003"],
          plugin_id: 500002,
          plugin_name: "High severity privilege escalation",
          severity: "high",
          severity_id: 3,
          vpr_score: 7.4,
          vulnerability_state: "open"
        }
      ]
    }),
    {
      headers: {
        "content-type": "application/json"
      },
      status: 200
    }
  );
}

function buildWorkbenchFetchMock() {
  return vi.fn<
    (input: string | URL | Request, init?: RequestInit) => Promise<Response>
  >(async (input) => {
    const url = String(input);

    if (url.includes("/workbenches/assets")) {
      return buildAssetsResponse();
    }

    if (url.includes("/workbenches/vulnerabilities")) {
      return buildVulnerabilitiesResponse();
    }

    return new Response(JSON.stringify({ error: "not found" }), {
      status: 404
    });
  });
}

describe("tenable contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented workbench requests and normalizes assets + vulnerabilities", async () => {
    const connector = getConnectorByKey("tenable");

    expect(connector).toBeDefined();

    const fetchMock = buildWorkbenchFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const context = {
      authType: "apiKey",
      config: {
        accessKey: TENABLE_ACCESS_KEY,
        apiBaseUrl: TENABLE_BASE_URL,
        assetLimit: 50,
        connectorKey: "tenable",
        secretKey: TENABLE_SECRET_KEY,
        vulnerabilityLimit: 50
      },
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    } as const;

    const signals = await connector!.collectSignals(context);

    // ---- Request contract -------------------------------------------------
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const requestedUrls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(
      requestedUrls.some((url) =>
        url.startsWith(`${TENABLE_BASE_URL}/workbenches/assets?limit=50`)
      )
    ).toBe(true);
    expect(
      requestedUrls.some((url) =>
        url.startsWith(
          `${TENABLE_BASE_URL}/workbenches/vulnerabilities?limit=50`
        )
      )
    ).toBe(true);

    for (const call of fetchMock.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      const headers = init?.headers as Record<string, string>;
      expect(headers["x-apikeys"]).toBe(
        `accessKey=${TENABLE_ACCESS_KEY}; secretKey=${TENABLE_SECRET_KEY}`
      );
      expect(headers.accept).toBe("application/json");
    }

    // ---- Normalization ----------------------------------------------------
    const assetSignal = signals.find(
      (signal) => signal.sourceType === "tenable.asset.summary"
    );
    expect(assetSignal?.signalCategory).toBe("Asset");
    expect(assetSignal?.signalSubcategory).toBe("VulnerabilityManagedAsset");

    const vulnerabilitySummaries = signals.filter(
      (signal) => signal.sourceType === "tenable.vulnerability.summary"
    );
    expect(vulnerabilitySummaries).toHaveLength(2);
    expect(
      vulnerabilitySummaries.every(
        (signal) => signal.signalCategory === "Exposure"
      )
    ).toBe(true);
    expect(
      vulnerabilitySummaries.map((signal) => signal.signalSubcategory)
    ).toEqual(
      expect.arrayContaining(["CriticalVulnerability", "HighVulnerability"])
    );

    const cveSignals = signals.filter(
      (signal) => signal.sourceType === "tenable.vulnerability.cve"
    );
    expect(cveSignals).toHaveLength(3);
    expect(
      cveSignals.every(
        (signal) =>
          signal.signalCategory === "Exposure" &&
          signal.signalSubcategory === "CveObserved"
      )
    ).toBe(true);

    // Secrets must never appear in normalized output.
    const serialized = JSON.stringify(signals);
    expect(serialized).not.toContain(TENABLE_ACCESS_KEY);
    expect(serialized).not.toContain(TENABLE_SECRET_KEY);
  });

  it("runs a live sync that emits assets and exposure signals without leaking secrets", async () => {
    const connector = getConnectorByKey("tenable");
    const fetchMock = buildWorkbenchFetchMock();
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiKey",
      config: {
        accessKey: TENABLE_ACCESS_KEY,
        apiBaseUrl: TENABLE_BASE_URL,
        assetLimit: 50,
        connectorKey: "tenable",
        secretKey: TENABLE_SECRET_KEY,
        vulnerabilityLimit: 50
      },
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]?.name).toContain("tenable/");
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining([
        "VulnerabilityManagedAsset",
        "CriticalVulnerability",
        "HighVulnerability",
        "CveObserved"
      ])
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(TENABLE_ACCESS_KEY);
    expect(serialized).not.toContain(TENABLE_SECRET_KEY);
  });
});
