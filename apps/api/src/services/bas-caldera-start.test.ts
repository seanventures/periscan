import { afterEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_FIRST_HOUR_MODULE_IDS,
  PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID
} from "@periscan/shared";

import {
  CALDERA_COMMUNITY_DEFAULT_DENIED,
  CALDERA_ENDPOINT_NOT_CONFIGURED,
  resolveCalderaEndpoint,
  selectCalderaQualifiedCampaignStart,
  startBasCalderaDiscovery
} from "./bas-caldera-start.js";

const API_KEY = "test-caldera-key";
const ISOLATED_BASE_URL = "http://127.0.0.1:8888";

type FetchHit = { method: string; url: string };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}

function recordingFetch(hits: FetchHit[], operationId = "op-api-1") {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    hits.push({
      method: init?.method ?? "GET",
      url: input
    });
    if (input.endsWith("/adversaries") && init?.method === "POST") {
      return jsonResponse({ adversary_id: "adv-1", atomic_ordering: [] });
    }
    if (input.endsWith("/operations") && init?.method === "POST") {
      return jsonResponse({ id: operationId, name: "periscan", state: "paused" });
    }
    return jsonResponse({ error: "unhandled" }, 404);
  };
}

function qualifiedInput(
  overrides: Record<string, unknown> = {},
  hits: FetchHit[] = []
) {
  return {
    abilityIds: [PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID],
    apiKey: API_KEY,
    baseUrl: ISOLATED_BASE_URL,
    fetchImpl: recordingFetch(hits),
    policyOutcome: "Allowed",
    qualified: true,
    startGate: { startable: true },
    tenantAuthorized: true,
    ...overrides
  };
}

describe("resolveCalderaEndpoint", () => {
  afterEach(() => {
    delete process.env.PERISCAN_CALDERA_BASE_URL;
    delete process.env.PERISCAN_CALDERA_API_KEY;
  });

  it("returns explicit isolated URL and key", () => {
    expect(
      resolveCalderaEndpoint({
        apiKey: API_KEY,
        baseUrl: ISOLATED_BASE_URL
      })
    ).toEqual({ apiKey: API_KEY, baseUrl: ISOLATED_BASE_URL });
  });

  it("returns null when URL or key is missing", () => {
    expect(resolveCalderaEndpoint({ apiKey: API_KEY, baseUrl: "" })).toBeNull();
    expect(
      resolveCalderaEndpoint({ apiKey: "", baseUrl: ISOLATED_BASE_URL })
    ).toBeNull();
    expect(resolveCalderaEndpoint({})).toBeNull();
  });

  it("reads isolated lab env when explicit values are omitted", () => {
    process.env.PERISCAN_CALDERA_BASE_URL = ISOLATED_BASE_URL;
    process.env.PERISCAN_CALDERA_API_KEY = API_KEY;
    expect(resolveCalderaEndpoint()).toEqual({
      apiKey: API_KEY,
      baseUrl: ISOLATED_BASE_URL
    });
  });
});

describe("selectCalderaQualifiedCampaignStart", () => {
  it("falls through when there are no Caldera pins", () => {
    expect(
      selectCalderaQualifiedCampaignStart({
        endpointConfigured: true,
        pins: [
          {
            provider: "AtomicRedTeam",
            upstreamId: "atomic:486e88ea-4f56-470f-9b57-3f4d73f39133"
          }
        ],
        startable: true
      })
    ).toBe("fallthrough");
  });

  it("falls through when startable is false so the existing deny path owns the reason", () => {
    expect(
      selectCalderaQualifiedCampaignStart({
        endpointConfigured: true,
        pins: [
          {
            provider: "Caldera",
            upstreamId: PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID
          }
        ],
        startable: false
      })
    ).toBe("fallthrough");
  });

  it("selects queue for allowlisted discovery when the isolated endpoint is configured", () => {
    expect(
      selectCalderaQualifiedCampaignStart({
        endpointConfigured: true,
        pins: [
          {
            provider: "Caldera",
            upstreamId: PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID
          }
        ],
        startable: true
      })
    ).toBe("queue");
  });

  it("denies startable Caldera when the isolated URL and key are missing", () => {
    expect(
      selectCalderaQualifiedCampaignStart({
        endpointConfigured: false,
        pins: [
          {
            provider: "Caldera",
            upstreamId: PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID
          }
        ],
        startable: true
      })
    ).toBe("deny");
  });

  it("denies startable Caldera live pins that are not allowlisted discovery", () => {
    expect(
      selectCalderaQualifiedCampaignStart({
        endpointConfigured: true,
        pins: [{ provider: "Caldera", upstreamId: "caldera.live" }],
        startable: true
      })
    ).toBe("deny");
  });
});

describe("startBasCalderaDiscovery", () => {
  afterEach(() => {
    delete process.env.PERISCAN_LIVE_OFFENSIVE;
  });

  it("queues allowlisted discovery against an isolated Caldera when the start gate is open", async () => {
    const hits: FetchHit[] = [];
    const result = await startBasCalderaDiscovery(qualifiedInput({}, hits));

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.operationId).toBe("op-api-1");
    expect(result.denyCode).toBeNull();
    expect(hits.some((hit) => hit.url.endsWith("/operations"))).toBe(true);
  });

  it("queues zero jobs when the start gate is not startable", async () => {
    const hits: FetchHit[] = [];
    const result = await startBasCalderaDiscovery(
      qualifiedInput({ startGate: { startable: false } }, hits)
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe("caldera_discovery_not_startable");
    expect(hits).toHaveLength(0);
  });

  it("queues zero jobs when unqualified, unauthorized, or policy is not Allowed", async () => {
    const hits: FetchHit[] = [];
    const unqualified = await startBasCalderaDiscovery(
      qualifiedInput({ qualified: false }, hits)
    );
    const unauthorized = await startBasCalderaDiscovery(
      qualifiedInput({ tenantAuthorized: false }, hits)
    );
    const deniedPolicy = await startBasCalderaDiscovery(
      qualifiedInput({ policyOutcome: "Denied" }, hits)
    );

    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.denyCode).toBe("qualification_required");
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.denyCode).toBe("caldera_tenant_authorization_required");
    expect(deniedPolicy.jobsQueued).toBe(0);
    expect(deniedPolicy.denyCode).toBe("caldera_policy_not_allowed");
    expect(hits).toHaveLength(0);
  });

  it("queues zero jobs when isolated Caldera URL and key are missing", async () => {
    const result = await startBasCalderaDiscovery(
      qualifiedInput({ apiKey: "", baseUrl: "" })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe(CALDERA_ENDPOINT_NOT_CONFIGURED);
    expect(result.liveSupported).toBe(false);
  });

  it("queues zero jobs for Community default start", async () => {
    const hits: FetchHit[] = [];
    const result = await startBasCalderaDiscovery(
      qualifiedInput({ communityDefaultPack: true }, hits)
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.denyCode).toBe(CALDERA_COMMUNITY_DEFAULT_DENIED);
    expect(hits).toHaveLength(0);
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).toEqual([
      "gitleaks.repo_secrets"
    ]);
  });

  it("still queues nothing for live Caldera when PERISCAN_LIVE_OFFENSIVE=1", async () => {
    process.env.PERISCAN_LIVE_OFFENSIVE = "1";
    const hits: FetchHit[] = [];
    const result = await startBasCalderaDiscovery(
      qualifiedInput(
        { liveOffensive: true, scenarioId: "caldera.live" },
        hits
      )
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.denyCode).toBe("caldera_live_disabled");
    expect(result.liveSupported).toBe(false);
    expect(hits).toHaveLength(0);
  });
});
