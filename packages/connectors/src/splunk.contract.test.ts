import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SPLUNK_TOKEN = "splunk-secret-api-token";
const SPLUNK_BASE_URL = "https://splunk.periscan.test:8089";

/**
 * Recorded-fixture contract test for the live `splunk` connector.
 *
 * The captured shape mirrors a real Splunk
 * `POST /services/search/jobs/export` streaming response in `output_mode=json`,
 * which emits newline-delimited JSON rows containing a `result` envelope with
 * `_raw` log evidence. We stub global `fetch` so CI verifies the outbound
 * request contract and observer normalization without any live Splunk call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function exportWithResults() {
  // Splunk export endpoint returns newline-delimited JSON rows.
  const rows = [
    JSON.stringify({
      preview: false,
      result: {
        _raw: "2026-06-08 periscan validation event technique=T1059 host=prod-api-01",
        _time: "2026-06-08T12:00:00.000+00:00",
        source: "periscan",
        sourcetype: "json"
      }
    })
  ].join("\n");

  return new Response(rows, {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

function exportWithoutResults() {
  return new Response("", {
    headers: { "content-type": "application/json" },
    status: 200
  });
}

const baseConfig = {
  baseUrl: SPLUNK_BASE_URL,
  connectorKey: "splunk",
  earliestTime: "-48h",
  index: "main",
  latestTime: "now",
  techniqueId: "T1059",
  token: SPLUNK_TOKEN
} as const;

describe("splunk contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented search export request and observes Logged", async () => {
    const connector = getConnectorByKey("splunk");

    expect(connector).toBeDefined();
    expect(connector!.observeControl).toBeDefined();

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) => {
        void input;
        void init;

        return exportWithResults();
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    // ---- Request contract -------------------------------------------------
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0] as FetchArgs;

    expect(String(requestUrl)).toBe(
      `${SPLUNK_BASE_URL}/services/search/jobs/export`
    );
    expect(requestInit?.method).toBe("POST");

    const headers = requestInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`Bearer ${SPLUNK_TOKEN}`);
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");

    const body = requestInit?.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("output_mode")).toBe("json");
    expect(body.get("earliest_time")).toBe("-48h");
    expect(body.get("latest_time")).toBe("now");
    const search = body.get("search") ?? "";
    expect(search).toContain("index=main");
    expect(search).toContain("T1059");

    // ---- Normalization ----------------------------------------------------
    expect(result.outcome).toBe("Logged");
    expect(result.sourceType).toBe("splunk.search.observer");

    // Secrets must never appear in normalized output.
    expect(JSON.stringify(result)).not.toContain(SPLUNK_TOKEN);
  });

  it("observes NoEvidence when the export returns no matching rows", async () => {
    const connector = getConnectorByKey("splunk");
    const fetchMock = vi.fn(async () => exportWithoutResults());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.outcome).toBe("NoEvidence");
    expect(result.sourceType).toBe("splunk.search.observer");
    expect(JSON.stringify(result)).not.toContain(SPLUNK_TOKEN);
  });

  it("queries an exact safe-stimulus marker before claiming correlation", async () => {
    const connector = getConnectorByKey("splunk")!;
    const correlationToken =
      "periscan-scv-11111111-1111-4111-8111-111111111111";
    const fetchMock = vi.fn(async () => exportWithResults());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector.observeControl!({
      authType: "apiToken",
      config: { ...baseConfig, correlationToken },
      integrationId: "44444444-4444-4444-8444-444444444444",
      mockMode: false,
      tenantId: "55555555-5555-4555-8555-555555555555"
    });

    const [, requestInit] = fetchMock.mock.calls[0] as unknown as FetchArgs;
    const body = requestInit?.body as URLSearchParams;
    expect(body.get("search")).toContain(correlationToken);
    expect(body.get("search")).not.toContain("T1059");
    expect(result).toMatchObject({
      correlationMatched: true,
      outcome: "Logged"
    });
  });

  function exportWithNotable() {
    const rows = [
      JSON.stringify({ preview: true, result: { partial: "ignore-me" } }),
      JSON.stringify({
        preview: false,
        result: {
          _raw: "2026-06-08 periscan validation event src_ip=10.4.2.7 host=fin-workstation-07",
          _time: "2026-06-08T12:00:00.000+00:00",
          "annotations.mitre_attack": ["T1059"],
          host: "fin-workstation-07",
          signature: "Suspicious PowerShell execution",
          src_ip: "10.4.2.7"
        }
      })
    ].join("\n");

    return new Response(rows, {
      headers: { "content-type": "application/json" },
      status: 200
    });
  }

  it("ingests live search results into correlatable ControlObservation signals", async () => {
    const connector = getConnectorByKey("splunk");

    expect(connector!.collectSignals).toBeDefined();

    const fetchMock = vi.fn(async () => exportWithNotable());
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "55555555-5555-4555-8555-555555555555",
      mockMode: false,
      tenantId: "66666666-6666-4666-8666-666666666666"
    });

    // Same single export request as the observer.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown as FetchArgs)[0])).toBe(
      `${SPLUNK_BASE_URL}/services/search/jobs/export`
    );

    const detection = signals.find(
      (signal) => signal.sourceType === "splunk.detection"
    );
    expect(detection).toBeDefined();
    expect(detection!.signalCategory).toBe("ControlObservation");

    // Normalized with the data that makes it COUNT toward coverage + asset
    // correlation (preview row was skipped, so exactly one detection).
    expect(
      signals.filter((signal) => signal.sourceType === "splunk.detection")
        .length
    ).toBe(1);
    expect(detection!.techniqueIds).toEqual(["T1059"]);
    expect(detection!.relatedAssetHints).toEqual([
      "fin-workstation-07",
      "10.4.2.7"
    ]);
    expect(detection!.timestampObserved).toBe("2026-06-08T12:00:00.000Z");

    const serialized = JSON.stringify(signals);
    expect(serialized).not.toContain(SPLUNK_TOKEN);
  });

  it("emits a no-evidence signal (not a fabricated detection) when the search returns no rows", async () => {
    const connector = getConnectorByKey("splunk");
    const fetchMock = vi.fn(async () => exportWithoutResults());
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "77777777-7777-4777-8777-777777777777",
      mockMode: false,
      tenantId: "88888888-8888-4888-8888-888888888888"
    });

    expect(
      signals.some(
        (signal) => signal.sourceType === "splunk.search.no_evidence"
      )
    ).toBe(true);
    expect(
      signals.some((signal) => signal.sourceType === "splunk.detection")
    ).toBe(false);
  });

  it("sync wraps live search ingest with a healthy read-only status", async () => {
    const connector = getConnectorByKey("splunk");
    const fetchMock = vi.fn(async () => exportWithNotable());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiToken",
      config: baseConfig,
      integrationId: "99999999-9999-4999-8999-999999999999",
      mockMode: false,
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    const detection = result.signals.find(
      (signal) => signal.sourceType === "splunk.detection"
    );
    expect(detection!.techniqueIds).toEqual(["T1059"]);
  });

  it("mock mode ingests a fixture result without any network call", async () => {
    const connector = getConnectorByKey("splunk");
    const fetchMock = vi.fn(async () => {
      throw new Error("mock mode must not hit the network");
    });
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals({
      authType: "mock",
      config: { connectorKey: "splunk", mockMode: true },
      integrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      mockMode: true,
      tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const detection = signals.find(
      (signal) => signal.sourceType === "splunk.detection"
    );
    expect(detection).toBeDefined();
    expect(detection!.techniqueIds).toEqual(["T1059"]);
    expect(detection!.relatedAssetHints).toContain("fixture-siem-host-01");
  });
});
