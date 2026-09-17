import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const QRADAR_API_TOKEN = "qradar-secret-sec-token";
const QRADAR_BASE_URL = "https://qradar.periscan.local";
const SEARCH_ID = "ariel-search-abc123";

/**
 * Recorded-fixture contract test for the live `ibm-qradar` connector.
 *
 * The real (non-mock) fetch path is the control observer: it POSTs an Ariel AQL
 * search to `/api/ariel/searches`, polls `/api/ariel/searches/{id}` for
 * completion, and reads `/api/ariel/searches/{id}/results`. We stub global
 * `fetch` and route by URL so CI verifies the outbound request contract and
 * verdict normalization without any live API call. The connector reads via
 * `connectorFetch`, which delegates to `globalThis.fetch`.
 *
 * Non-mock `sync` uses the same Ariel API only to verify health and returns no
 * fabricated signals; control verdict evidence is produced by `observeControl`.
 */
function buildQradarResponses() {
  const createResponse = () =>
    new Response(JSON.stringify({ search_id: SEARCH_ID, status: "EXECUTE" }), {
      headers: { "content-type": "application/json" },
      status: 201
    });
  const statusResponse = () =>
    new Response(
      JSON.stringify({
        progress: 100,
        record_count: 2,
        search_id: SEARCH_ID,
        status: "COMPLETED"
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200
      }
    );
  const resultsResponse = () =>
    new Response(
      JSON.stringify({
        events: [
          {
            logsourceid: 63,
            qid: 5_000_023,
            sourceip: "198.51.100.44",
            starttime: 1_780_000_000_000,
            username: "periscan-validation"
          },
          {
            logsourceid: 63,
            qid: 5_000_024,
            sourceip: "203.0.113.77",
            starttime: 1_780_000_100_000,
            username: "periscan-validation"
          }
        ]
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200
      }
    );

  return { createResponse, resultsResponse, statusResponse };
}

function routeQradarFetch(
  url: string,
  method: string,
  responses: ReturnType<typeof buildQradarResponses>
) {
  if (url.endsWith("/api/ariel/searches") && method === "POST") {
    return responses.createResponse();
  }

  if (url.includes(`/api/ariel/searches/${SEARCH_ID}/results`)) {
    return responses.resultsResponse();
  }

  if (url.endsWith(`/api/ariel/searches/${SEARCH_ID}`)) {
    return responses.statusResponse();
  }

  throw new Error(`Unexpected IBM QRadar request: ${method} ${url}`);
}

function buildContext(overrides: Record<string, unknown> = {}) {
  return {
    authType: "apiToken",
    config: {
      apiBaseUrl: QRADAR_BASE_URL,
      apiToken: QRADAR_API_TOKEN,
      connectorKey: "ibm-qradar",
      maxStatusPolls: 1,
      queryExpression: "SELECT * FROM events LIMIT 10 LAST 24 HOURS",
      statusPollMs: 0
    },
    integrationId: "11111111-1111-4111-8111-111111111111",
    mockMode: false,
    tenantId: "22222222-2222-4222-8222-222222222222",
    ...overrides
  } as const;
}

describe("ibm-qradar contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented Ariel search requests and normalizes a Logged verdict", async () => {
    const connector = getConnectorByKey("ibm-qradar");

    expect(connector).toBeDefined();

    const responses = buildQradarResponses();
    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async (input, init) =>
      routeQradarFetch(
        String(input),
        (init?.method ?? "GET").toUpperCase(),
        responses
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!(buildContext());

    // ---- Request contract -------------------------------------------------
    const calls = fetchMock.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(3);

    const [createUrl, createInit] = calls[0]!;
    expect(String(createUrl)).toBe(`${QRADAR_BASE_URL}/api/ariel/searches`);
    expect(createInit?.method).toBe("POST");

    const createHeaders = createInit?.headers as Record<string, string>;
    expect(createHeaders.SEC).toBe(QRADAR_API_TOKEN);
    expect(createHeaders.Version).toBe("20.0");
    expect(createHeaders.accept).toBe("application/json");
    expect(createHeaders["content-type"]).toBe(
      "application/x-www-form-urlencoded"
    );

    const createBody = new URLSearchParams(String(createInit?.body));
    expect(createBody.get("query_expression")).toBe(
      "SELECT * FROM events LIMIT 10 LAST 24 HOURS"
    );

    const statusCall = calls.find(
      ([url, init]) =>
        String(url).endsWith(`/api/ariel/searches/${SEARCH_ID}`) &&
        (init?.method ?? "GET").toUpperCase() === "GET"
    );
    expect(statusCall).toBeDefined();
    expect((statusCall![1]?.headers as Record<string, string>).SEC).toBe(
      QRADAR_API_TOKEN
    );

    const resultsCall = calls.find(([url]) =>
      String(url).includes(`/api/ariel/searches/${SEARCH_ID}/results`)
    );
    expect(resultsCall).toBeDefined();
    expect((resultsCall![1]?.method ?? "GET").toUpperCase()).toBe("GET");
    const resultsHeaders = resultsCall![1]?.headers as Record<string, string>;
    expect(resultsHeaders.Range).toBe("items=0-9");
    expect(resultsHeaders.SEC).toBe(QRADAR_API_TOKEN);

    // ---- Normalization ----------------------------------------------------
    expect(result.outcome).toBe("Logged");
    expect(result.sourceType).toBe("ibm_qradar.ariel_search.observer");

    // Secrets must never appear in normalized output.
    expect(JSON.stringify(result)).not.toContain(QRADAR_API_TOKEN);
  });

  it("normalizes a NoEvidence verdict when the Ariel search returns no results", async () => {
    const connector = getConnectorByKey("ibm-qradar");

    const responses = buildQradarResponses();
    responses.resultsResponse = () =>
      new Response(JSON.stringify({ events: [] }), {
        headers: { "content-type": "application/json" },
        status: 200
      });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) =>
        routeQradarFetch(
          String(input),
          (init?.method ?? "GET").toUpperCase(),
          responses
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.observeControl!(
      buildContext({
        integrationId: "33333333-3333-4333-8333-333333333333",
        tenantId: "44444444-4444-4444-8444-444444444444"
      })
    );

    expect(result.outcome).toBe("NoEvidence");
    expect(result.sourceType).toBe("ibm_qradar.ariel_search.observer");
    expect(JSON.stringify(result)).not.toContain(QRADAR_API_TOKEN);
  });

  it("verifies non-mock sync health with Ariel API without fabricating signals", async () => {
    const connector = getConnectorByKey("ibm-qradar");
    const responses = buildQradarResponses();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) =>
        routeQradarFetch(
          String(input),
          (init?.method ?? "GET").toUpperCase(),
          responses
        )
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await connector!.sync(
      buildContext({
        integrationId: "55555555-5555-4555-8555-555555555555",
        tenantId: "66666666-6666-4666-8666-666666666666"
      })
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [healthUrl, healthInit] = fetchMock.mock.calls[0]!;
    expect(String(healthUrl)).toBe(`${QRADAR_BASE_URL}/api/ariel/searches`);
    expect(healthInit?.method).toBe("POST");
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(JSON.stringify(result)).not.toContain(QRADAR_API_TOKEN);
  });
});
