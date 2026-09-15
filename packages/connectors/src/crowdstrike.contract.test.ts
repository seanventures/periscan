import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const CROWDSTRIKE_CLIENT_ID = "falcon-client-id";
const CROWDSTRIKE_CLIENT_SECRET = "falcon-super-secret-client-secret";
const CROWDSTRIKE_ACCESS_TOKEN = "falcon-ephemeral-access-token";
const CROWDSTRIKE_BASE_URL = "https://api.us-2.crowdstrike.com";

/**
 * Recorded-fixture contract test for the live `crowdstrike` connector.
 *
 * The captured shapes mirror a real Falcon OAuth2 token exchange
 * (`POST /oauth2/token`), a detection-id query
 * (`GET /detects/queries/detects/v1`), and a detection-summary lookup
 * (`POST /detects/entities/summaries/GET/v1`). We stub global `fetch` so CI
 * verifies the outbound request contract and observer normalization without any
 * live Falcon API call.
 */
type FetchArgs = [input: string | URL | Request, init?: RequestInit];

function tokenResponse() {
  return new Response(
    JSON.stringify({
      access_token: CROWDSTRIKE_ACCESS_TOKEN,
      expires_in: 1799,
      token_type: "bearer"
    }),
    {
      headers: { "content-type": "application/json" },
      status: 200
    }
  );
}

function detectionQueryResponse() {
  return new Response(
    JSON.stringify({
      meta: { pagination: { limit: 1, offset: 0, total: 1 } },
      resources: ["ldt:abc123:9001"]
    }),
    {
      headers: { "content-type": "application/json" },
      status: 200
    }
  );
}

function detectionSummaryResponse(disposition: "prevented" | "detected") {
  return new Response(
    JSON.stringify({
      resources: [
        {
          detection_id: "ldt:abc123:9001",
          created_timestamp: "2026-06-07T12:00:00Z",
          device: {
            hostname: "fin-workstation-07",
            local_ip: "10.4.2.7"
          },
          max_severity_displayname: "Critical",
          status: "new",
          behaviors: [
            {
              technique_id: "T1059",
              tactic: "Execution",
              pattern_disposition_description:
                disposition === "prevented"
                  ? "Process prevented and quarantined by Falcon."
                  : "Process detected by Falcon sensor."
            }
          ]
        }
      ]
    }),
    {
      headers: { "content-type": "application/json" },
      status: 200
    }
  );
}

function buildFetchMock(disposition: "prevented" | "detected") {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    void init;
    const url = String(input);

    if (url.includes("/oauth2/token")) {
      return tokenResponse();
    }

    if (url.includes("/detects/queries/detects/v1")) {
      return detectionQueryResponse();
    }

    if (url.includes("/detects/entities/summaries/GET/v1")) {
      return detectionSummaryResponse(disposition);
    }

    return new Response(JSON.stringify({ errors: ["not found"] }), {
      status: 404
    });
  });
}

const baseConfig = {
  baseUrl: CROWDSTRIKE_BASE_URL,
  clientId: CROWDSTRIKE_CLIENT_ID,
  clientSecret: CROWDSTRIKE_CLIENT_SECRET,
  connectorKey: "crowdstrike",
  detectionFilter: "behaviors.technique_id:'T1059'"
} as const;

describe("crowdstrike contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("performs the documented OAuth + detection-query + summary flow and observes Blocked", async () => {
    const connector = getConnectorByKey("crowdstrike");

    expect(connector).toBeDefined();
    expect(connector!.observeControl).toBeDefined();

    const fetchMock = buildFetchMock("prevented");
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: baseConfig,
      integrationId: "11111111-1111-4111-8111-111111111111",
      mockMode: false,
      tenantId: "22222222-2222-4222-8222-222222222222"
    });

    // ---- Request contract -------------------------------------------------
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const calls = fetchMock.mock.calls as FetchArgs[];

    // 1) OAuth2 token exchange.
    const [tokenUrl, tokenInit] = calls[0]!;
    expect(String(tokenUrl)).toBe(`${CROWDSTRIKE_BASE_URL}/oauth2/token`);
    expect(tokenInit?.method).toBe("POST");
    const tokenHeaders = tokenInit?.headers as Record<string, string>;
    expect(tokenHeaders["content-type"]).toBe(
      "application/x-www-form-urlencoded"
    );
    const tokenBody = tokenInit?.body as URLSearchParams;
    expect(tokenBody).toBeInstanceOf(URLSearchParams);
    expect(tokenBody.get("client_id")).toBe(CROWDSTRIKE_CLIENT_ID);
    expect(tokenBody.get("client_secret")).toBe(CROWDSTRIKE_CLIENT_SECRET);

    // 2) Detection-id query with the bearer token from step 1.
    const [queryUrl, queryInit] = calls[1]!;
    const parsedQueryUrl = new URL(String(queryUrl));
    expect(parsedQueryUrl.origin + parsedQueryUrl.pathname).toBe(
      `${CROWDSTRIKE_BASE_URL}/detects/queries/detects/v1`
    );
    expect(parsedQueryUrl.searchParams.get("limit")).toBe("1");
    expect(parsedQueryUrl.searchParams.get("filter")).toBe(
      "behaviors.technique_id:'T1059'"
    );
    const queryHeaders = queryInit?.headers as Record<string, string>;
    expect(queryHeaders.authorization).toBe(
      `Bearer ${CROWDSTRIKE_ACCESS_TOKEN}`
    );

    // 3) Detection-summary lookup (POST) with the bearer token.
    const [summaryUrl, summaryInit] = calls[2]!;
    expect(String(summaryUrl)).toBe(
      `${CROWDSTRIKE_BASE_URL}/detects/entities/summaries/GET/v1`
    );
    expect(summaryInit?.method).toBe("POST");
    const summaryHeaders = summaryInit?.headers as Record<string, string>;
    expect(summaryHeaders.authorization).toBe(
      `Bearer ${CROWDSTRIKE_ACCESS_TOKEN}`
    );
    expect(summaryHeaders["content-type"]).toBe("application/json");
    const summaryBody = JSON.parse(String(summaryInit?.body)) as {
      ids?: string[];
    };
    expect(summaryBody.ids).toEqual(["ldt:abc123:9001"]);

    // ---- Normalization ----------------------------------------------------
    expect(result.outcome).toBe("Blocked");
    expect(result.sourceType).toBe("crowdstrike.falcon.observer");

    // Secrets must never appear in normalized output.
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(CROWDSTRIKE_CLIENT_SECRET);
    expect(serialized).not.toContain(CROWDSTRIKE_ACCESS_TOKEN);
  });

  it("observes Detected when the summary lacks a prevention disposition", async () => {
    const connector = getConnectorByKey("crowdstrike");
    const fetchMock = buildFetchMock("detected");
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!({
      authType: "oauth2ClientCredentials",
      config: baseConfig,
      integrationId: "33333333-3333-4333-8333-333333333333",
      mockMode: false,
      tenantId: "44444444-4444-4444-8444-444444444444"
    });

    expect(result.outcome).toBe("Detected");
    expect(result.sourceType).toBe("crowdstrike.falcon.observer");
    expect(JSON.stringify(result)).not.toContain(CROWDSTRIKE_CLIENT_SECRET);
    expect(JSON.stringify(result)).not.toContain(CROWDSTRIKE_ACCESS_TOKEN);
  });

  it("ingests live detections into correlatable ControlObservation signals", async () => {
    const connector = getConnectorByKey("crowdstrike");

    expect(connector!.collectSignals).toBeDefined();

    const fetchMock = buildFetchMock("prevented");
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals({
      authType: "oauth2ClientCredentials",
      config: baseConfig,
      integrationId: "55555555-5555-4555-8555-555555555555",
      mockMode: false,
      tenantId: "66666666-6666-4666-8666-666666666666"
    });

    // Same OAuth + query + summary contract as the observer path.
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // A metadata signal plus one per detection (no inert empties).
    const detectionSignal = signals.find(
      (signal) => signal.sourceType === "crowdstrike.detection"
    );
    expect(detectionSignal).toBeDefined();
    expect(detectionSignal!.signalCategory).toBe("ControlObservation");

    // The detection is normalized with the data that makes it COUNT toward
    // control-rule coverage and asset correlation, not left inert.
    expect(detectionSignal!.techniqueIds).toEqual(["T1059"]);
    expect(detectionSignal!.relatedAssetHints).toEqual([
      "fin-workstation-07",
      "10.4.2.7"
    ]);
    expect(detectionSignal!.signalSubcategory).toBe("EndpointThreatBlocked");
    expect(detectionSignal!.timestampObserved).toBe("2026-06-07T12:00:00Z");

    // Secrets never leak into normalized telemetry.
    const serialized = JSON.stringify(signals);
    expect(serialized).not.toContain(CROWDSTRIKE_CLIENT_SECRET);
    expect(serialized).not.toContain(CROWDSTRIKE_ACCESS_TOKEN);
  });

  it("emits a no-evidence signal (not a fabricated detection) when Falcon returns no detections", async () => {
    const connector = getConnectorByKey("crowdstrike");

    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/oauth2/token")) {
        return tokenResponse();
      }
      if (url.includes("/detects/queries/detects/v1")) {
        return new Response(
          JSON.stringify({
            meta: { pagination: { limit: 1, offset: 0, total: 0 } },
            resources: []
          }),
          { headers: { "content-type": "application/json" }, status: 200 }
        );
      }
      return new Response(JSON.stringify({ errors: ["unexpected"] }), {
        status: 500
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const signals = await connector!.collectSignals({
      authType: "oauth2ClientCredentials",
      config: baseConfig,
      integrationId: "77777777-7777-4777-8777-777777777777",
      mockMode: false,
      tenantId: "88888888-8888-4888-8888-888888888888"
    });

    // No summary lookup when there were no detection ids.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      signals.some(
        (signal) => signal.sourceType === "crowdstrike.detections.no_evidence"
      )
    ).toBe(true);
    expect(
      signals.some((signal) => signal.sourceType === "crowdstrike.detection")
    ).toBe(false);
  });

  it("mock mode ingests a fixture detection without any network call", async () => {
    const connector = getConnectorByKey("crowdstrike");
    const fetchMock = vi.fn(async () => {
      throw new Error("mock mode must not hit the network");
    });
    vi.stubGlobal("fetch", fetchMock);

    // An unconfigured mock connector now defaults to the neutral no-detection
    // verdict ("Missed" for Falcon, which lacks a "NoEvidence" verdict) and
    // emits no fabricated detection. Request a detection explicitly to exercise
    // the fixture-detection ingest path.
    const signals = await connector!.collectSignals({
      authType: "mock",
      config: {
        connectorKey: "crowdstrike",
        fixtureOutcome: "Detected",
        mockMode: true
      },
      integrationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      mockMode: true,
      tenantId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    });

    expect(fetchMock).not.toHaveBeenCalled();
    const detection = signals.find(
      (signal) => signal.sourceType === "crowdstrike.detection"
    );
    expect(detection).toBeDefined();
    expect(detection!.techniqueIds).toEqual(["T1059.001"]);
    expect(detection!.relatedAssetHints).toEqual([
      "fixture-endpoint-01",
      "10.0.0.10"
    ]);
  });

  it("sync wraps live detection ingest with a healthy read-only status", async () => {
    const connector = getConnectorByKey("crowdstrike");
    const fetchMock = buildFetchMock("detected");
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync({
      authType: "oauth2ClientCredentials",
      config: baseConfig,
      integrationId: "99999999-9999-4999-8999-999999999999",
      mockMode: false,
      tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    });

    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    const detection = result.signals.find(
      (signal) => signal.sourceType === "crowdstrike.detection"
    );
    expect(detection).toBeDefined();
    expect(detection!.techniqueIds).toEqual(["T1059"]);
    expect(detection!.signalSubcategory).toBe("EndpointThreatDetected");
  });
});
