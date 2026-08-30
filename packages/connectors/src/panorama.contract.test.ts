import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const PANORAMA_API_KEY = "panorama-secret-pan-os-key";
const PANORAMA_BASE_URL = "https://panorama-periscan.example.net";

/**
 * Recorded-fixture contract test for the live `palo-panorama` connector.
 *
 * The captured shape mirrors a real PAN-OS XML API log query response
 * (`type=log&log-type=threat&action=get`) containing one blocked (deny) entry
 * and one allowed (alert) entry. We stub global `fetch` so CI verifies the
 * outbound request contract and XML parsing/normalization without any live
 * API call.
 */
function buildPanoramaLogResponse() {
  return new Response(
    `<?xml version="1.0"?>
<response status="success">
  <result>
    <log>
      <logs count="2" progress="100">
        <entry logid="1">
          <seqno>700001</seqno>
          <receive_time>2026/06/01 19:00:00</receive_time>
          <action>deny</action>
          <app>web-browsing</app>
          <src>198.51.100.10</src>
          <dst>203.0.113.10</dst>
          <rule>Periscan block policy</rule>
          <severity>high</severity>
          <threatid>Exploit kit landing page</threatid>
        </entry>
        <entry logid="2">
          <seqno>700002</seqno>
          <receive_time>2026/06/01 19:05:00</receive_time>
          <action>alert</action>
          <app>ssl</app>
          <src>198.51.100.20</src>
          <dst>203.0.113.20</dst>
          <rule>Periscan monitor policy</rule>
          <severity>medium</severity>
          <threatid>Suspicious TLS handshake</threatid>
        </entry>
      </logs>
    </log>
  </result>
</response>`,
    {
      headers: {
        "content-type": "application/xml"
      },
      status: 200
    }
  );
}

describe("palo-panorama contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented PAN-OS log query and normalizes blocked + allowed entries", async () => {
    const connector = getConnectorByKey("palo-panorama");

    expect(connector).toBeDefined();

    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => buildPanoramaLogResponse());
    vi.stubGlobal("fetch", fetchMock);

    const context = {
      authType: "apiKey",
      config: {
        apiKey: PANORAMA_API_KEY,
        baseUrl: PANORAMA_BASE_URL,
        connectorKey: "palo-panorama",
        logType: "threat"
      },
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    } as const;

    const signals = await connector!.collectSignals(context);

    // ---- Request contract -------------------------------------------------
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]!;

    expect(String(requestUrl)).toBe(`${PANORAMA_BASE_URL}/api/`);
    expect(requestInit?.method).toBe("POST");

    const headers = requestInit?.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    expect(headers.accept).toBe("application/xml,text/xml");

    const body = new URLSearchParams(String(requestInit?.body));
    expect(body.get("type")).toBe("log");
    expect(body.get("action")).toBe("get");
    expect(body.get("log-type")).toBe("threat");
    expect(body.get("key")).toBe(PANORAMA_API_KEY);

    // ---- Normalization ----------------------------------------------------
    const categories = new Set(signals.map((signal) => signal.signalCategory));
    expect(categories).toEqual(new Set(["ControlObservation"]));

    const subcategories = signals.map((signal) => signal.signalSubcategory);
    expect(subcategories).toEqual(
      expect.arrayContaining([
        "FirewallLogObservation",
        "FirewallLogBlocked",
        "FirewallLogDetected"
      ])
    );

    const entrySignals = signals.filter(
      (signal) => signal.sourceType === "palo_alto_panorama.log_entry"
    );
    expect(entrySignals).toHaveLength(2);
    expect(
      entrySignals.filter(
        (signal) => signal.signalSubcategory === "FirewallLogBlocked"
      )
    ).toHaveLength(1);
    expect(
      entrySignals.filter(
        (signal) => signal.signalSubcategory === "FirewallLogDetected"
      )
    ).toHaveLength(1);

    const metadataSignal = signals.find(
      (signal) => signal.sourceType === "palo_alto_panorama.logs.metadata"
    );
    expect(metadataSignal?.signalSubcategory).toBe("FirewallLogObservation");

    // The PAN-OS API key must never appear in normalized output.
    expect(JSON.stringify(signals)).not.toContain(PANORAMA_API_KEY);
  });

  it("observes a Blocked control outcome from a deny log entry", async () => {
    const connector = getConnectorByKey("palo-panorama");
    const fetchMock = vi.fn(async () => buildPanoramaLogResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!({
      authType: "apiKey",
      config: {
        apiKey: PANORAMA_API_KEY,
        baseUrl: PANORAMA_BASE_URL,
        connectorKey: "palo-panorama",
        logType: "threat"
      },
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.outcome).toBe("Blocked");
    expect(result.sourceType).toBe("palo_alto_panorama.logs.observer");
    expect(JSON.stringify(result)).not.toContain(PANORAMA_API_KEY);
  });

  it("runs a live sync that emits assets and firewall log signals without leaking secrets", async () => {
    const connector = getConnectorByKey("palo-panorama");
    const fetchMock = vi.fn(async () => buildPanoramaLogResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiKey",
      config: {
        apiKey: PANORAMA_API_KEY,
        baseUrl: PANORAMA_BASE_URL,
        connectorKey: "palo-panorama",
        logType: "threat"
      },
      integrationId: "55555555-5555-4555-8555-555555555555",
      mockMode: false,
      tenantId: "66666666-6666-4666-8666-666666666666"
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.assets).toHaveLength(1);
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining(["FirewallLogBlocked", "FirewallLogDetected"])
    );
    expect(JSON.stringify(result)).not.toContain(PANORAMA_API_KEY);
  });
});
