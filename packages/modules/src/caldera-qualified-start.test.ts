import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  BasPackQualificationSchema,
  PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
  TenantBasPackAuthorizationSchema,
  evaluateBasCampaignStartability,
  resolveBasScenarioStart,
  tenantBasPackAuthorizationDigest
} from "@periscan/shared";

import { queueCalderaQualifiedStart } from "./caldera-qualified-start.js";
import { evaluateModuleStartConstraints, getModuleById } from "./index.js";

const API_KEY = "test-caldera-key";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const SCOPE_ID = "22222222-2222-4222-8222-222222222222";
const APPROVER_ID = "55555555-5555-4555-8555-555555555555";
const SHA = "a".repeat(64);
const UNREVIEWED_EXFIL_ABILITY_ID = "ea713bc4-63f0-491c-9a6f-0b01d560b87e";
const ISOLATED_BASE_URL = "http://127.0.0.1:8888";

type FetchHit = {
  body: unknown;
  method: string;
  url: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status
  });
}

function recordingFetch(hits: FetchHit[], operationId = "op-qualified-1") {
  return async (input: string, init?: RequestInit): Promise<Response> => {
    const raw = typeof init?.body === "string" ? init.body : "";
    hits.push({
      body: raw ? JSON.parse(raw) : null,
      method: init?.method ?? "GET",
      url: input
    });
    if (input.endsWith("/adversaries") && init?.method === "POST") {
      const body = raw ? (JSON.parse(raw) as { adversary_id?: string }) : {};
      return jsonResponse({
        adversary_id: body.adversary_id,
        atomic_ordering: (JSON.parse(raw) as { atomic_ordering?: string[] })
          .atomic_ordering
      });
    }
    if (input.endsWith("/operations") && init?.method === "POST") {
      return jsonResponse({
        id: operationId,
        name: (JSON.parse(raw) as { name?: string }).name,
        state: "paused"
      });
    }
    return jsonResponse({ error: "unhandled" }, 404);
  };
}

function discoveryPin(upstreamId = PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID) {
  return {
    contentSha256: SHA,
    dependsOn: [] as string[],
    provider: "Caldera" as const,
    typedInputs: {},
    upstreamId
  };
}

function calderaQualification(
  pinIds: string[] = [PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID]
) {
  return BasPackQualificationSchema.parse({
    labReceiptHash: SHA,
    pack: "caldera",
    pinIds,
    qualifiedAt: "2026-09-17T00:00:00.000Z"
  });
}

function calderaAuthorization() {
  const base = {
    approver: APPROVER_ID,
    expiresAt: "2026-12-01T00:00:00.000Z",
    pack: "caldera" as const,
    scopeId: SCOPE_ID,
    tenantId: TENANT_ID
  };
  return TenantBasPackAuthorizationSchema.parse({
    ...base,
    digest: tenantBasPackAuthorizationDigest(base)
  });
}

function allowedInput(
  overrides: Record<string, unknown> = {},
  hits: FetchHit[] = []
) {
  return {
    abilityIds: [PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID],
    apiKey: API_KEY,
    baseUrl: ISOLATED_BASE_URL,
    fetchImpl: recordingFetch(hits),
    name: "qualified-discovery",
    policyOutcome: "Allowed",
    qualified: true,
    startable: true,
    tenantAuthorized: true,
    ...overrides
  };
}

describe("Caldera qualified discovery queue (PERISCAN-587)", () => {
  afterEach(() => {
    delete process.env.PERISCAN_LIVE_OFFENSIVE;
  });

  it("queues a bounded allowlisted discovery ability when startable, qualified, authorized, allowed, and reviewed", async () => {
    const hits: FetchHit[] = [];
    const startability = evaluateBasCampaignStartability({
      authorizations: [calderaAuthorization()],
      pins: [discoveryPin()],
      policyOutcome: "Allowed",
      qualifications: [calderaQualification()],
      runnerStatus: "Active",
      scopeId: SCOPE_ID,
      scopeVerified: true,
      tenantId: TENANT_ID
    });
    expect(startability.startable).toBe(true);

    const result = await queueCalderaQualifiedStart(
      allowedInput({ startable: startability.startable }, hits)
    );

    expect(result.jobsQueued).toBeGreaterThan(0);
    expect(result.queued).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.denyCode).toBeNull();
    expect(result.operationId).toBe("op-qualified-1");
    expect(result.abilityIds).toEqual([
      PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID
    ]);
    expect(hits.some((hit) => hit.url.endsWith("/adversaries"))).toBe(true);
    expect(hits.some((hit) => hit.url.endsWith("/operations"))).toBe(true);
    expect(hits.every((hit) => hit.method !== "PATCH")).toBe(true);
    expect(
      hits.every(
        (hit) => !hit.url.includes("/runner") && !hit.url.includes("mitre.org")
      )
    ).toBe(true);
  });

  it("queues the reviewed T1033 Current User ability against an isolated Caldera API", async () => {
    const hits: FetchHit[] = [];
    const result = await queueCalderaQualifiedStart(
      allowedInput(
        {
          abilityIds: [PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID],
          name: "qualified-t1033"
        },
        hits
      )
    );

    expect(result.jobsQueued).toBeGreaterThan(0);
    expect(result.queued).toBe(true);
    expect(result.liveSupported).toBe(false);
    const adversary = hits.find((hit) => hit.url.endsWith("/adversaries"));
    expect(adversary?.body).toMatchObject({
      atomic_ordering: [PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID]
    });
  });

  it("queues nothing when the start gate is not startable", async () => {
    const hits: FetchHit[] = [];
    const result = await queueCalderaQualifiedStart(
      allowedInput({ startable: false }, hits)
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.operationId).toBeNull();
    expect(result.denyCode).toBe("caldera_discovery_not_startable");
    expect(hits).toHaveLength(0);
  });

  it("queues nothing when the discovery pin is unqualified", async () => {
    const hits: FetchHit[] = [];
    const startability = evaluateBasCampaignStartability({
      authorizations: [calderaAuthorization()],
      pins: [discoveryPin()],
      policyOutcome: "Allowed",
      qualifications: [],
      runnerStatus: "Active",
      scopeId: SCOPE_ID,
      scopeVerified: true,
      tenantId: TENANT_ID
    });
    expect(startability.startable).toBe(false);

    const result = await queueCalderaQualifiedStart(
      allowedInput({ qualified: false, startable: true }, hits)
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe("qualification_required");
    expect(hits).toHaveLength(0);
  });

  it("queues nothing when the tenant has not authorized the Caldera pack", async () => {
    const hits: FetchHit[] = [];
    const result = await queueCalderaQualifiedStart(
      allowedInput({ tenantAuthorized: false }, hits)
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe("caldera_tenant_authorization_required");
    expect(hits).toHaveLength(0);
  });

  it("queues nothing when policy is not Allowed", async () => {
    const hits: FetchHit[] = [];
    const result = await queueCalderaQualifiedStart(
      allowedInput({ policyOutcome: "Denied" }, hits)
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe("caldera_policy_not_allowed");
    expect(hits).toHaveLength(0);
  });

  it("fails closed before HTTP when an unreviewed ability is requested", async () => {
    const hits: FetchHit[] = [];
    const result = await queueCalderaQualifiedStart(
      allowedInput(
        {
          abilityIds: [
            PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
            UNREVIEWED_EXFIL_ABILITY_ID
          ]
        },
        hits
      )
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe("ability_not_allowlisted");
    expect(hits).toHaveLength(0);
  });

  it("queues nothing for live-offensive pins even when the other gates are open", async () => {
    const hits: FetchHit[] = [];
    const result = await queueCalderaQualifiedStart(
      allowedInput(
        {
          liveOffensive: true,
          scenarioId: "caldera.live"
        },
        hits
      )
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.denyCode).toBe("caldera_live_disabled");
    expect(hits).toHaveLength(0);
  });

  it("still queues nothing for a denied live start when PERISCAN_LIVE_OFFENSIVE=1", async () => {
    process.env.PERISCAN_LIVE_OFFENSIVE = "1";
    const hits: FetchHit[] = [];
    const denied = await queueCalderaQualifiedStart(
      allowedInput({ startable: false }, hits)
    );
    const livePin = await queueCalderaQualifiedStart(
      allowedInput({ liveOffensive: true, scenarioId: "caldera.live" }, hits)
    );

    expect(denied.jobsQueued).toBe(0);
    expect(denied.queued).toBe(false);
    expect(livePin.jobsQueued).toBe(0);
    expect(livePin.denyCode).toBe("caldera_live_disabled");
    expect(hits).toHaveLength(0);

    const resolved = resolveBasScenarioStart({
      scenarioId: "caldera.live",
      scopeId: randomUUID()
    });
    expect(resolved.queueable).toBe(false);
  });

  it("keeps caldera.advanced_adversarial liveSupported false and module live starts denied", () => {
    expect(process.env.PERISCAN_LIVE_OFFENSIVE).toBeUndefined();
    const caldera = getModuleById("caldera.advanced_adversarial");
    expect(caldera?.manifest.liveSupported).toBe(false);

    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [caldera!.manifest],
        runnerId: randomUUID(),
        target: {
          approvalId: randomUUID(),
          authorizedOffensive: true,
          dryRun: false,
          scopeVerified: true
        }
      })
    ).toMatchObject({
      allowed: false,
      code: "caldera_live_disabled"
    });
  });

  it("refuses a public Caldera host even when the start gate is open", async () => {
    const hits: FetchHit[] = [];
    const result = await queueCalderaQualifiedStart(
      allowedInput(
        {
          baseUrl: "https://caldera.mitre.org",
          fetchImpl: recordingFetch(hits)
        },
        hits
      )
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe("isolated_url_required");
    expect(hits).toHaveLength(0);
  });
});
