import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const CORTEX_API_KEY = "cortex-xdr-secret-api-key";
const CORTEX_AUTH_ID = "42";
const CORTEX_BASE_URL = "https://api-periscan.xdr.us.paloaltonetworks.com";

/**
 * Recorded-fixture contract test for the live `palo-cortex-xdr` connector.
 *
 * The captured shape mirrors a real Cortex XDR
 * `/public_api/v1/incidents/get_incidents` response containing one blocked
 * (prevented) incident and one detected incident. We stub global `fetch` so
 * CI verifies the outbound request contract and response normalization without
 * any live API call.
 */
function buildCortexIncidentsResponse() {
  return new Response(
    JSON.stringify({
      reply: {
        incidents: [
          {
            alert_count: 2,
            alert_categories: ["Malware"],
            creation_time: 1_780_313_600_000,
            critical_severity_alert_count: 1,
            description: "Malicious binary execution on production endpoint.",
            high_severity_alert_count: 1,
            hosts: ["prod-api-01"],
            incident_id: "7001",
            incident_name: "Prevented malware execution",
            incident_sources: ["XDR Agent"],
            mitre_techniques_ids_and_names: [
              "T1059 - Command and Scripting Interpreter"
            ],
            modification_time: 1_780_313_700_000,
            severity: "critical",
            status: "resolved_prevented"
          },
          {
            alert_count: 1,
            alert_categories: ["Credential Access"],
            creation_time: 1_780_313_800_000,
            critical_severity_alert_count: 0,
            description: "Suspicious credential access alert under triage.",
            high_severity_alert_count: 1,
            hosts: ["build-runner-03"],
            incident_id: "7002",
            incident_name: "Detected credential access",
            incident_sources: ["XDR Agent"],
            mitre_techniques_ids_and_names: ["T1003 - OS Credential Dumping"],
            modification_time: 1_780_313_900_000,
            severity: "high",
            status: "new"
          }
        ],
        total_count: 2
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

describe("palo-cortex-xdr contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented incidents request and normalizes blocked + detected incidents", async () => {
    const connector = getConnectorByKey("palo-cortex-xdr");

    expect(connector).toBeDefined();

    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => buildCortexIncidentsResponse());
    vi.stubGlobal("fetch", fetchMock);

    const context = {
      authType: "apiToken",
      config: {
        apiKey: CORTEX_API_KEY,
        baseUrl: CORTEX_BASE_URL,
        connectorKey: "palo-cortex-xdr",
        xdrAuthId: CORTEX_AUTH_ID
      },
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    } as const;

    const signals = await connector!.collectSignals(context);

    // ---- Request contract -------------------------------------------------
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]!;

    expect(String(requestUrl)).toBe(
      `${CORTEX_BASE_URL}/public_api/v1/incidents/get_incidents`
    );
    expect(requestInit?.method).toBe("POST");

    const headers = requestInit?.headers as Record<string, string>;
    expect(headers.authorization).toBe(CORTEX_API_KEY);
    expect(headers["x-xdr-auth-id"]).toBe(CORTEX_AUTH_ID);
    expect(headers["content-type"]).toBe("application/json");

    const requestBody = JSON.parse(String(requestInit?.body)) as {
      request_data?: {
        search_from?: number;
        sort?: { field?: string; keyword?: string };
      };
    };
    expect(requestBody.request_data).toBeDefined();
    expect(requestBody.request_data?.sort?.field).toBe("creation_time");
    expect(requestBody.request_data?.sort?.keyword).toBe("desc");
    expect(requestBody.request_data?.search_from).toBe(0);

    // ---- Normalization ----------------------------------------------------
    const categories = new Set(signals.map((signal) => signal.signalCategory));
    expect(categories).toEqual(new Set(["ControlObservation"]));

    const subcategories = signals.map((signal) => signal.signalSubcategory);
    expect(subcategories).toEqual(
      expect.arrayContaining([
        "IncidentObservation",
        "IncidentBlocked",
        "IncidentDetected"
      ])
    );

    const incidentSignals = signals.filter(
      (signal) => signal.sourceType === "palo_alto_cortex_xdr.incident"
    );
    expect(incidentSignals).toHaveLength(2);
    expect(
      incidentSignals.filter(
        (signal) => signal.signalSubcategory === "IncidentBlocked"
      )
    ).toHaveLength(1);
    expect(
      incidentSignals.filter(
        (signal) => signal.signalSubcategory === "IncidentDetected"
      )
    ).toHaveLength(1);

    const metadataSignal = signals.find(
      (signal) =>
        signal.sourceType === "palo_alto_cortex_xdr.incidents.metadata"
    );
    expect(metadataSignal?.signalSubcategory).toBe("IncidentObservation");

    // Secrets must never appear in normalized output.
    expect(JSON.stringify(signals)).not.toContain(CORTEX_API_KEY);
  });

  it("observes a Blocked control outcome from prevented incident evidence", async () => {
    const connector = getConnectorByKey("palo-cortex-xdr");
    const fetchMock = vi.fn(async () => buildCortexIncidentsResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!({
      authType: "apiToken",
      config: {
        apiKey: CORTEX_API_KEY,
        baseUrl: CORTEX_BASE_URL,
        connectorKey: "palo-cortex-xdr",
        xdrAuthId: CORTEX_AUTH_ID
      },
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.outcome).toBe("Blocked");
    expect(result.sourceType).toBe("palo_alto_cortex_xdr.incidents.observer");
    expect(JSON.stringify(result)).not.toContain(CORTEX_API_KEY);
  });

  it("runs a live sync that emits assets and incident signals without leaking secrets", async () => {
    const connector = getConnectorByKey("palo-cortex-xdr");
    const fetchMock = vi.fn(async () => buildCortexIncidentsResponse());
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "apiToken",
      config: {
        apiKey: CORTEX_API_KEY,
        baseUrl: CORTEX_BASE_URL,
        connectorKey: "palo-cortex-xdr",
        xdrAuthId: CORTEX_AUTH_ID
      },
      integrationId: "55555555-5555-4555-8555-555555555555",
      mockMode: false,
      tenantId: "66666666-6666-4666-8666-666666666666"
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.assets).toHaveLength(1);
    expect(result.signals.map((signal) => signal.signalSubcategory)).toEqual(
      expect.arrayContaining(["IncidentBlocked", "IncidentDetected"])
    );
    expect(JSON.stringify(result)).not.toContain(CORTEX_API_KEY);
  });
});
