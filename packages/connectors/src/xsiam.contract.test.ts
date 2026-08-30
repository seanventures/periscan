import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const API_KEY = "xsiam-secret-api-key";
const AUTH_ID = "84";
const BASE_URL = "https://api-periscan.xdr.us.paloaltonetworks.com";

function buildIncidentResponse() {
  return new Response(
    JSON.stringify({
      reply: {
        incidents: [
          {
            alert_categories: ["Credential Access"],
            creation_time: 1_780_313_600_000,
            hosts: ["production-api-01"],
            incident_id: "xsiam-7001",
            incident_name: "Prevented credential access",
            mitre_techniques_ids_and_names: ["T1003 - OS Credential Dumping"],
            severity: "high",
            status: "resolved_prevented"
          }
        ],
        total_count: 1
      }
    }),
    {
      headers: { "content-type": "application/json" },
      status: 200
    }
  );
}

describe("palo-cortex-xsiam contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the documented incident API and normalizes XSIAM evidence", async () => {
    const connector = getConnectorByKey("palo-cortex-xsiam");
    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async () => buildIncidentResponse());
    vi.stubGlobal("fetch", fetchMock);

    expect(connector?.manifest.product).toBe("Cortex XSIAM");
    expect(connector?.manifest.customerVisibleDescription).toMatch(
      /Partial depth/i
    );
    expect(connector?.manifest.customerVisibleDescription).toMatch(
      /Cortex XDR-compatible|get_incidents/i
    );
    expect(connector?.manifest.customerVisibleDescription).toMatch(
      /not full XSIAM|data-lake|XQL/i
    );
    const signals = await connector!.collectSignals({
      authType: "apiToken",
      config: {
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        connectorKey: "palo-cortex-xsiam",
        xdrAuthId: AUTH_ID
      },
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [requestUrl, requestInit] = fetchMock.mock.calls[0]!;
    expect(String(requestUrl)).toBe(
      `${BASE_URL}/public_api/v1/incidents/get_incidents`
    );
    expect(requestInit?.method).toBe("POST");
    expect(requestInit?.headers).toMatchObject({
      authorization: API_KEY,
      "content-type": "application/json",
      "x-xdr-auth-id": AUTH_ID
    });

    const incident = signals.find(
      (signal) => signal.sourceType === "palo_alto_cortex_xsiam.incident"
    );
    expect(incident).toMatchObject({
      relatedAssetHints: ["production-api-01"],
      signalCategory: "ControlObservation",
      signalSubcategory: "IncidentBlocked",
      techniqueIds: ["T1003"]
    });
    expect(JSON.stringify(signals)).not.toContain(API_KEY);
  });

  it("syncs an XSIAM asset and healthy read-only incident evidence", async () => {
    const connector = getConnectorByKey("palo-cortex-xsiam");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => buildIncidentResponse())
    );

    const result = await connector!.sync({
      authType: "apiToken",
      config: {
        apiKey: API_KEY,
        baseUrl: BASE_URL,
        connectorKey: "palo-cortex-xsiam",
        xdrAuthId: AUTH_ID
      },
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.health).toMatchObject({
      authorizationVerified: true,
      status: "Healthy"
    });
    expect(result.assets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "Palo Alto Networks Cortex XSIAM" })
      ])
    );
    expect(result.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "palo_alto_cortex_xsiam.incident"
        })
      ])
    );
    expect(JSON.stringify(result)).not.toContain(API_KEY);
  });
});
