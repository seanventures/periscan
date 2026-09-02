import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const PROOFPOINT_PRINCIPAL = "proofpoint-service-principal";
const PROOFPOINT_SECRET = "proofpoint-secret-service-key";
const PROOFPOINT_BASE_URL = "https://tap-api-v2.proofpoint.com";

const EXPECTED_AUTHORIZATION = `Basic ${Buffer.from(
  `${PROOFPOINT_PRINCIPAL}:${PROOFPOINT_SECRET}`
).toString("base64")}`;

/**
 * Recorded-fixture contract test for the live `proofpoint` connector.
 *
 * The captured shape mirrors a real Proofpoint TAP SIEM `/v2/siem/all`
 * response containing one blocked message event (with a quarantine rule) and
 * one delivered/detected message event. We stub global `fetch` so CI verifies
 * the outbound request contract and response normalization without any live API
 * call. The connector reads via `connectorFetch`, which delegates to
 * `globalThis.fetch`.
 */
function buildProofpointSiemResponse() {
  return new Response(
    JSON.stringify({
      messagesBlocked: [
        {
          GUID: "blocked-message-guid-1",
          campaignId: "campaign-1",
          classification: "Phish",
          fromAddress: ["attacker@example.invalid"],
          messageID: "<blocked-1@periscan.local>",
          messageTime: "2026-06-01T14:00:00.000Z",
          quarantineRule: "Phishing quarantine",
          senderIP: "198.51.100.44",
          threatStatus: "active",
          threatsInfoMap: [
            {
              classification: "Phish",
              threat: "https://example.invalid/phish",
              threatId: "threat-blocked-1",
              threatType: "URL"
            }
          ]
        }
      ],
      messagesDelivered: [
        {
          GUID: "delivered-message-guid-2",
          campaignId: "campaign-2",
          classification: "Spam",
          fromAddress: ["sender@example.invalid"],
          messageID: "<delivered-2@periscan.local>",
          messageTime: "2026-06-01T15:30:00.000Z",
          senderIP: "203.0.113.77",
          threatStatus: "active",
          threatsInfoMap: [
            {
              classification: "Spam",
              threat: "https://example.invalid/spam",
              threatId: "threat-detected-2",
              threatType: "URL"
            }
          ]
        }
      ],
      queryEndTime: "2026-06-01T16:00:00.000Z"
    }),
    {
      headers: {
        "content-type": "application/json"
      },
      status: 200
    }
  );
}

function buildContext(overrides: Record<string, unknown> = {}) {
  return {
    authType: "basicAuth",
    config: {
      baseUrl: PROOFPOINT_BASE_URL,
      connectorKey: "proofpoint",
      principal: PROOFPOINT_PRINCIPAL,
      secret: PROOFPOINT_SECRET
    },
    integrationId: "11111111-1111-4111-8111-111111111111",
    mockMode: false,
    tenantId: "22222222-2222-4222-8222-222222222222",
    ...overrides
  } as const;
}

describe("proofpoint contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented TAP SIEM request and normalizes blocked + detected events", async () => {
    const connector = getConnectorByKey("proofpoint");

    expect(connector).toBeDefined();

    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => buildProofpointSiemResponse());
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals(buildContext());

    // ---- Request contract -------------------------------------------------
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]!;

    const url = new URL(String(requestUrl));
    expect(url.origin + url.pathname).toBe(
      `${PROOFPOINT_BASE_URL}/v2/siem/all`
    );
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("sinceSeconds")).toBe("3600");
    expect(requestInit?.method).toBe("GET");

    const headers = requestInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe(EXPECTED_AUTHORIZATION);
    expect(headers.accept).toBe("application/json");

    // ---- Normalization ----------------------------------------------------
    const categories = new Set(signals.map((signal) => signal.signalCategory));
    expect(categories).toEqual(new Set(["ControlObservation"]));

    const blockedSignals = signals.filter(
      (signal) => signal.sourceType === "proofpoint.tap.siem.threat_blocked"
    );
    const detectedSignals = signals.filter(
      (signal) => signal.sourceType === "proofpoint.tap.siem.threat_detected"
    );
    expect(blockedSignals).toHaveLength(1);
    expect(detectedSignals).toHaveLength(1);
    expect(blockedSignals[0]?.signalSubcategory).toBe("EmailThreatBlocked");
    expect(detectedSignals[0]?.signalSubcategory).toBe("EmailThreatDetected");

    const metadataSignal = signals.find(
      (signal) => signal.sourceType === "proofpoint.tap.siem.metadata"
    );
    expect(metadataSignal?.signalSubcategory).toBe("EmailSecurityControl");

    // Secrets must never appear in normalized output.
    expect(JSON.stringify(signals)).not.toContain(PROOFPOINT_SECRET);
  });

  it("observes a Blocked control outcome from quarantined event evidence", async () => {
    const connector = getConnectorByKey("proofpoint");
    const fetchMock = vi.fn(async () => buildProofpointSiemResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!(
      buildContext({
        integrationId: "33333333-3333-4333-8333-333333333333",
        tenantId: "44444444-4444-4444-8444-444444444444"
      })
    );

    expect(result.outcome).toBe("Blocked");
    expect(result.sourceType).toBe("proofpoint_tap.observer");
    expect(JSON.stringify(result)).not.toContain(PROOFPOINT_SECRET);
  });

  it("runs a live sync that emits assets and event signals without leaking secrets", async () => {
    const connector = getConnectorByKey("proofpoint");
    const fetchMock = vi.fn(async () => buildProofpointSiemResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync(
      buildContext({
        integrationId: "55555555-5555-4555-8555-555555555555",
        tenantId: "66666666-6666-4666-8666-666666666666"
      })
    );

    expect(result.health.status).toBe("Healthy");
    expect(result.assets).toHaveLength(1);
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining(["EmailThreatBlocked", "EmailThreatDetected"])
    );
    expect(JSON.stringify(result)).not.toContain(PROOFPOINT_SECRET);
  });
});
