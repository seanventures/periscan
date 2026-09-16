import { afterEach, describe, expect, it, vi } from "vitest";

import { getConnectorByKey } from "./index.js";

const SUMO_ACCESS_ID = "sumo-access-id-secret";
const SUMO_ACCESS_KEY = "sumo-access-key-secret";
const SUMO_BASE_URL = "https://api.sumologic.com";
const SEARCH_JOB_ID = "search-job-12345";

const EXPECTED_AUTHORIZATION = `Basic ${Buffer.from(
  `${SUMO_ACCESS_ID}:${SUMO_ACCESS_KEY}`
).toString("base64")}`;

/**
 * Recorded-fixture contract test for the live `sumo-logic` connector.
 *
 * The real (non-mock) fetch path is the control observer: it POSTs a Search Job
 * to `/api/v1/search/jobs`, polls `/api/v1/search/jobs/{id}` for completion, and
 * reads `/api/v1/search/jobs/{id}/messages`. We stub global `fetch` and route by
 * URL so CI verifies the outbound request contract and verdict normalization
 * without any live API call. The connector reads via `connectorFetch`, which
 * delegates to `globalThis.fetch`.
 *
 * Non-mock `sync` uses the same Search Job API only to verify health and returns
 * no fabricated signals; control verdict evidence is produced by `observeControl`.
 */
function buildSumoSearchJobResponses() {
  const createResponse = () =>
    new Response(JSON.stringify({ id: SEARCH_JOB_ID }), {
      headers: { "content-type": "application/json" },
      status: 202
    });
  const statusResponse = () =>
    new Response(
      JSON.stringify({
        messageCount: 3,
        recordCount: 0,
        state: "DONE GATHERING RESULTS"
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200
      }
    );
  const messagesResponse = () =>
    new Response(
      JSON.stringify({
        fields: [{ fieldType: "string", name: "_raw" }],
        messages: [
          {
            map: {
              _messagetime: "1780000000000",
              _raw: "periscan validation event observed",
              _sourcecategory: "security/validation"
            }
          }
        ]
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200
      }
    );

  return { createResponse, messagesResponse, statusResponse };
}

function routeSumoFetch(
  url: string,
  method: string,
  responses: ReturnType<typeof buildSumoSearchJobResponses>
) {
  if (url.endsWith("/api/v1/search/jobs") && method === "POST") {
    return responses.createResponse();
  }

  if (url.includes(`/api/v1/search/jobs/${SEARCH_JOB_ID}/messages`)) {
    return responses.messagesResponse();
  }

  if (url.endsWith(`/api/v1/search/jobs/${SEARCH_JOB_ID}`)) {
    return responses.statusResponse();
  }

  throw new Error(`Unexpected Sumo Logic request: ${method} ${url}`);
}

function buildContext(overrides: Record<string, unknown> = {}) {
  return {
    authType: "basicAuth",
    config: {
      accessId: SUMO_ACCESS_ID,
      accessKey: SUMO_ACCESS_KEY,
      apiBaseUrl: SUMO_BASE_URL,
      connectorKey: "sumo-logic",
      maxStatusPolls: 1,
      query: "_sourceCategory=security/* | limit 10",
      statusPollMs: 0
    },
    integrationId: "11111111-1111-4111-8111-111111111111",
    mockMode: false,
    tenantId: "22222222-2222-4222-8222-222222222222",
    ...overrides
  } as const;
}

describe("sumo-logic contract", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("issues the documented Search Job requests and normalizes a Logged verdict", async () => {
    const connector = getConnectorByKey("sumo-logic");

    expect(connector).toBeDefined();

    const responses = buildSumoSearchJobResponses();
    const fetchMock = vi.fn<
      (input: string | URL | Request, init?: RequestInit) => Promise<Response>
    >(async (input, init) =>
      routeSumoFetch(
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
    expect(String(createUrl)).toBe(`${SUMO_BASE_URL}/api/v1/search/jobs`);
    expect(createInit?.method).toBe("POST");

    const createHeaders = createInit?.headers as Record<string, string>;
    expect(createHeaders.authorization).toBe(EXPECTED_AUTHORIZATION);
    expect(createHeaders["content-type"]).toBe("application/json");
    expect(createHeaders.accept).toBe("application/json");

    const createBody = JSON.parse(String(createInit?.body)) as {
      from?: string;
      query?: string;
      timeZone?: string;
      to?: string;
    };
    expect(createBody.query).toBe("_sourceCategory=security/* | limit 10");
    expect(createBody.timeZone).toBe("UTC");
    expect(typeof createBody.from).toBe("string");
    expect(typeof createBody.to).toBe("string");

    const statusCall = calls.find(
      ([url, init]) =>
        String(url).endsWith(`/api/v1/search/jobs/${SEARCH_JOB_ID}`) &&
        (init?.method ?? "GET").toUpperCase() === "GET"
    );
    expect(statusCall).toBeDefined();

    const messagesCall = calls.find(([url]) =>
      String(url).includes(`/api/v1/search/jobs/${SEARCH_JOB_ID}/messages`)
    );
    expect(messagesCall).toBeDefined();
    expect(String(messagesCall![0])).toContain("offset=0");
    expect(String(messagesCall![0])).toContain("limit=10");
    expect((messagesCall![1]?.method ?? "GET").toUpperCase()).toBe("GET");

    // ---- Normalization ----------------------------------------------------
    expect(result.outcome).toBe("Logged");
    expect(result.sourceType).toBe("sumo_logic.search_job.observer");

    // Secrets must never appear in normalized output.
    expect(JSON.stringify(result)).not.toContain(SUMO_ACCESS_ID);
    expect(JSON.stringify(result)).not.toContain(SUMO_ACCESS_KEY);
    expect(JSON.stringify(result)).not.toContain(EXPECTED_AUTHORIZATION);
  });

  it("normalizes a NoEvidence verdict when the Search Job returns no messages", async () => {
    const connector = getConnectorByKey("sumo-logic");

    const responses = buildSumoSearchJobResponses();
    responses.messagesResponse = () =>
      new Response(JSON.stringify({ fields: [], messages: [] }), {
        headers: { "content-type": "application/json" },
        status: 200
      });

    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) =>
        routeSumoFetch(
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
    expect(result.sourceType).toBe("sumo_logic.search_job.observer");
    expect(JSON.stringify(result)).not.toContain(SUMO_ACCESS_KEY);
  });

  it("verifies non-mock sync health with Search Job API without fabricating signals", async () => {
    const connector = getConnectorByKey("sumo-logic");
    const responses = buildSumoSearchJobResponses();
    const fetchMock = vi.fn(
      async (input: string | URL | Request, init?: RequestInit) =>
        routeSumoFetch(
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
    expect(String(healthUrl)).toBe(`${SUMO_BASE_URL}/api/v1/search/jobs`);
    expect(healthInit?.method).toBe("POST");
    expect(result.assets).toHaveLength(0);
    expect(result.signals).toHaveLength(0);
    expect(result.health.status).toBe("Healthy");
    expect(result.health.authorizationVerified).toBe(true);
    expect(JSON.stringify(result)).not.toContain(SUMO_ACCESS_KEY);
  });
});
