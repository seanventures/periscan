import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SENTINELONE_API_TOKEN = "sentinelone-secret-api-token";
const SENTINELONE_BASE_URL = "https://periscan.sentinelone.net";

/**
 * Recorded-fixture contract test for the live `sentinelone` connector.
 *
 * The captured shape mirrors a real SentinelOne Singularity
 * `/web/api/v2.1/threats` response containing one mitigated (blocked) threat
 * and one un-mitigated (detected) threat. We stub global `fetch` so CI verifies
 * the outbound request contract and response normalization without any live API
 * call. The connector reads via `connectorFetch`, which delegates to
 * `globalThis.fetch`.
 */
function buildSentinelOneThreatsResponse() {
  return new Response(
    JSON.stringify({
      data: [
        {
          id: "threat-9001",
          agentDetectionInfo: {
            agentIpV4: "10.20.30.40"
          },
          agentRealtimeInfo: {
            agentComputerName: "edr-host-01"
          },
          indicators: [
            {
              category: "Malicious Process",
              tactics: [
                {
                  name: "Execution",
                  techniques: [
                    {
                      link: "https://attack.mitre.org/techniques/T1059",
                      name: "T1059 Command and Scripting Interpreter"
                    }
                  ]
                }
              ]
            }
          ],
          threatInfo: {
            analystVerdict: "true_positive",
            classification: "Malware",
            confidenceLevel: "malicious",
            createdAt: "2026-06-01T14:00:00.000Z",
            mitigationStatus: "mitigated",
            threatName: "blocked-malware.exe"
          }
        },
        {
          id: "threat-9002",
          threatInfo: {
            analystVerdict: "suspicious",
            classification: "PUA",
            confidenceLevel: "suspicious",
            createdAt: "2026-06-01T15:30:00.000Z",
            mitigationStatus: "not_mitigated",
            threatName: "suspicious-activity"
          }
        }
      ],
      pagination: {
        nextCursor: null,
        totalItems: 2
      }
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
    authType: "apiToken",
    config: {
      apiToken: SENTINELONE_API_TOKEN,
      baseUrl: SENTINELONE_BASE_URL,
      connectorKey: "sentinelone"
    },
    integrationId: "11111111-1111-4111-8111-111111111111",
    mockMode: false,
    tenantId: "22222222-2222-4222-8222-222222222222",
    ...overrides
  } as const;
}

describe("sentinelone contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented threats request and normalizes blocked + detected threats", async () => {
    const connector = getConnectorByKey("sentinelone");

    expect(connector).toBeDefined();

    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => buildSentinelOneThreatsResponse());
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals(buildContext());

    // ---- Request contract -------------------------------------------------
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]!;

    const url = new URL(String(requestUrl));
    expect(url.origin + url.pathname).toBe(
      `${SENTINELONE_BASE_URL}/web/api/v2.1/threats`
    );
    expect(url.searchParams.get("sortBy")).toBe("createdAt");
    expect(url.searchParams.get("sortOrder")).toBe("desc");
    expect(url.searchParams.get("limit")).toBe("10");
    expect(requestInit?.method).toBe("GET");

    const headers = requestInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe(`ApiToken ${SENTINELONE_API_TOKEN}`);
    expect(headers.accept).toBe("application/json");

    // ---- Normalization ----------------------------------------------------
    const categories = new Set(signals.map((signal) => signal.signalCategory));
    expect(categories).toEqual(new Set(["ControlObservation"]));

    const threatSignals = signals.filter(
      (signal) => signal.sourceType === "sentinelone.threat"
    );
    expect(threatSignals).toHaveLength(2);
    expect(
      threatSignals.filter(
        (signal) => signal.signalSubcategory === "EndpointThreatBlocked"
      )
    ).toHaveLength(1);
    expect(
      threatSignals.filter(
        (signal) => signal.signalSubcategory === "EndpointThreatDetected"
      )
    ).toHaveLength(1);

    const metadataSignal = signals.find(
      (signal) => signal.sourceType === "sentinelone.threats.metadata"
    );
    expect(metadataSignal?.signalSubcategory).toBe("EndpointThreatObservation");

    // MITRE technique ids are extracted from the threat's indicators so the
    // ingested ControlObservation signal drives control-rule coverage. The
    // blocked threat carries T1059; the bare detected threat carries none.
    const blockedThreat = threatSignals.find(
      (signal) => signal.signalSubcategory === "EndpointThreatBlocked"
    );
    expect(blockedThreat?.techniqueIds).toContain("T1059");
    const detectedThreat = threatSignals.find(
      (signal) => signal.signalSubcategory === "EndpointThreatDetected"
    );
    expect(detectedThreat?.techniqueIds ?? []).toEqual([]);

    // Host/IP hints are extracted from agent info so sync can attribute the
    // telemetry to the right tenant asset (resolved during persistence).
    expect(blockedThreat?.relatedAssetHints).toContain("edr-host-01");
    expect(blockedThreat?.relatedAssetHints).toContain("10.20.30.40");

    // Secrets must never appear in normalized output.
    expect(JSON.stringify(signals)).not.toContain(SENTINELONE_API_TOKEN);
  });

  it("observes a Blocked control outcome from mitigated threat evidence", async () => {
    const connector = getConnectorByKey("sentinelone");
    const fetchMock = vi.fn(async () => buildSentinelOneThreatsResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!(
      buildContext({
        integrationId: "33333333-3333-4333-8333-333333333333",
        tenantId: "44444444-4444-4444-8444-444444444444"
      })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.outcome).toBe("Blocked");
    expect(result.sourceType).toBe("sentinelone.threats.observer");
    expect(JSON.stringify(result)).not.toContain(SENTINELONE_API_TOKEN);
  });

  it("runs a live sync that emits assets and threat signals without leaking secrets", async () => {
    const connector = getConnectorByKey("sentinelone");
    const fetchMock = vi.fn(async () => buildSentinelOneThreatsResponse());
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
      expect.arrayContaining([
        "EndpointThreatBlocked",
        "EndpointThreatDetected"
      ])
    );
    expect(JSON.stringify(result)).not.toContain(SENTINELONE_API_TOKEN);
  });
});
