import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_VALIDATION_SUITE,
  applySecurityFeedYaml,
  checkSecurityFeed,
  isCommunityValidationModuleId,
  listSecurityFeeds
} from "@periscan/shared";

import {
  RUSTINEL_AUTHORIZATION_REQUIRED,
  RUSTINEL_COMMUNITY_DEFAULT_DENIED,
  RUSTINEL_COMMUNITY_PACK_ELIGIBLE,
  RUSTINEL_LIVE_AGENT_DENIED,
  RUSTINEL_MODULE_ID,
  RUSTINEL_NOT_STARTABLE,
  RUSTINEL_PARSER,
  RUSTINEL_POLICY_NOT_ALLOWED,
  RUSTINEL_QUALIFICATION_REQUIRED,
  RUSTINEL_SPDX_LICENSE_ID,
  RUSTINEL_YAML_EVAL_DENIED,
  correlateRustinelDetection,
  evaluateRustinelStart,
  importRustinelAlerts,
  mapRustinelAlerts,
  queueRustinelObserveImportStart
} from "./rustinel-endpoint.js";

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/rustinel/rustinel-fixture.ndjson"
);

const MARKER = "periscan-r11111111-s22222222-whoami";
const WINDOW_START = "2026-09-17T14:00:00.000Z";
const WINDOW_END = "2026-09-17T14:10:00.000Z";

const HEALTHY_OBSERVER = {
  healthStatus: "Healthy" as const,
  lastValidatedAt: "2026-09-17T14:09:00.000Z",
  telemetryStatus: "Healthy" as const,
  windowEnd: WINDOW_END,
  windowStart: WINDOW_START
};

const INJECT = {
  emitted: true,
  expectedRuleId: "Whoami Execution",
  injectedAt: "2026-09-17T14:00:05.000Z",
  marker: MARKER,
  runId: "11111111-1111-4111-8111-111111111111",
  stepId: "22222222-2222-4222-8222-222222222222"
};

describe("Rustinel endpoint observe (Apache-2.0 ECS NDJSON)", () => {
  it("is Apache-2.0 Community-eligible, not Community start, liveSupported false until start gate", () => {
    expect(RUSTINEL_SPDX_LICENSE_ID).toBe("Apache-2.0");
    expect(RUSTINEL_COMMUNITY_PACK_ELIGIBLE).toBe(true);
    expect(RUSTINEL_MODULE_ID).toBe("rustinel.endpoint_observe");
    expect(RUSTINEL_PARSER).toBe("periscan.rustinel.v1");
    expect(isCommunityValidationModuleId(RUSTINEL_MODULE_ID)).toBe(false);
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain(RUSTINEL_MODULE_ID);
    expect(
      COMMUNITY_VALIDATION_SUITE.some((entry) =>
        /GPL|LGPL|AGPL/i.test(entry.toolLicense)
      )
    ).toBe(false);

    const start = evaluateRustinelStart({
      authorized: true,
      qualified: true
    });
    expect(start.liveSupported).toBe(false);
    expect(start.communityStart).toBe(false);
    expect(start.communityPackEligible).toBe(true);
    expect(start.spdxLicenseId).toBe("Apache-2.0");
  });

  it("maps the ECS NDJSON fixture to two alerts and omits trap secrets", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    expect(raw).toMatch(/AKIAIOSFODNN7EXAMPLE/);
    expect(raw).toMatch(/BEGIN RSA PRIVATE KEY/);
    expect(raw).toMatch(MARKER);

    const alerts = mapRustinelAlerts(raw);
    expect(alerts).toHaveLength(2);
    expect(alerts[0]).toMatchObject({
      category: "process_creation",
      kind: "alert",
      processName: "whoami",
      ruleId: "a7c3e1d2-4b91-4f0a-9c11-rustinelwhoami",
      ruleName: "Whoami Execution"
    });
    expect(alerts[1]).toMatchObject({
      category: "file_event",
      kind: "alert",
      ruleName: "YARA FakeAwsKey"
    });

    const blob = JSON.stringify(alerts);
    expect(blob).not.toMatch(/AKIA/);
    expect(blob).not.toMatch(/BEGIN RSA PRIVATE KEY/);
    expect(blob).not.toMatch(/hashed_secret/);
    expect(blob).not.toMatch(/match_debug/);
  });

  it("yields zero detections for empty, malformed, metric, or summary-only JSON", () => {
    expect(mapRustinelAlerts(undefined)).toEqual([]);
    expect(mapRustinelAlerts(null)).toEqual([]);
    expect(mapRustinelAlerts("")).toEqual([]);
    expect(mapRustinelAlerts("{}")).toEqual([]);
    expect(mapRustinelAlerts("[]")).toEqual([]);
    expect(mapRustinelAlerts("{not json")).toEqual([]);
    expect(
      mapRustinelAlerts(
        JSON.stringify({
          alert_count: 99,
          alerts: []
        })
      )
    ).toEqual([]);
    expect(
      mapRustinelAlerts(
        JSON.stringify({
          "@timestamp": "2026-09-17T14:01:00.000Z",
          event: { kind: "metric" },
          rule: { name: "Whoami Execution" }
        })
      )
    ).toEqual([]);
    expect(importRustinelAlerts({ fixtureMode: true, raw: "" }).alerts).toEqual(
      []
    );
  });

  it("replays fixtureMode from the fixture file and does not invent alerts", () => {
    const imported = importRustinelAlerts({ fixtureMode: true });
    expect(imported.alerts).toHaveLength(2);
    expect(imported.invented).toBe(false);
    expect(imported.liveSupported).toBe(false);
    expect(imported.parser).toBe("periscan.rustinel.v1");
  });

  it("Alerted when an ECS alert carries the exact marker and expected rule", () => {
    const result = correlateRustinelDetection({
      inject: INJECT,
      observation: {
        windowComplete: true,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      },
      observer: HEALTHY_OBSERVER,
      raw: readFileSync(FIXTURE_PATH, "utf8")
    });
    expect(result.verdict).toBe("Alerted");
    expect(result.matchedEventIds.length).toBeGreaterThan(0);
    expect(result.missedEligible).toBe(false);
  });

  it("records Alerted from a matching ECS alert and never Missed when the observer is Unhealthy", () => {
    const matched = correlateRustinelDetection({
      inject: INJECT,
      observation: {
        windowComplete: true,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      },
      observer: {
        ...HEALTHY_OBSERVER,
        healthStatus: "Unhealthy",
        telemetryStatus: "Unhealthy"
      },
      raw: readFileSync(FIXTURE_PATH, "utf8")
    });
    expect(matched.verdict).toBe("Alerted");
    expect(matched.missedEligible).toBe(false);

    const noMatch = correlateRustinelDetection({
      inject: INJECT,
      observation: {
        windowComplete: true,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      },
      observer: {
        ...HEALTHY_OBSERVER,
        healthStatus: "Unhealthy",
        telemetryStatus: "Unhealthy"
      },
      raw: ""
    });
    expect(noMatch.verdict).toBe("Inconclusive");
    expect(noMatch.missedEligible).toBe(false);
  });

  it("claims Missed only when a healthy observer covers the window with zero matching alerts", () => {
    const missed = correlateRustinelDetection({
      inject: INJECT,
      observation: {
        windowComplete: true,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      },
      observer: HEALTHY_OBSERVER,
      raw: ""
    });
    expect(missed.verdict).toBe("Missed");
    expect(missed.missedEligible).toBe(true);
    expect(missed.matchedEventIds).toEqual([]);

    const stale = correlateRustinelDetection({
      inject: INJECT,
      observation: {
        windowComplete: true,
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      },
      observer: {
        healthStatus: "Healthy",
        lastValidatedAt: "2026-09-17T13:00:00.000Z",
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      },
      raw: ""
    });
    expect(stale.verdict).toBe("Inconclusive");
    expect(stale.missedEligible).toBe(false);
  });

  it("does not queue a live endpoint agent until the start gate is open", () => {
    expect(evaluateRustinelStart({}).jobsQueued).toBe(0);
    expect(evaluateRustinelStart({ authorized: true }).code).toBe(
      "rustinel_qualification_required"
    );
    const started = evaluateRustinelStart({
      authorized: true,
      qualified: true
    });
    expect(started.allowed).toBe(true);
    expect(started.jobsQueued).toBe(1);
    expect(started.liveSupported).toBe(false);
    expect(started.liveAgent).toBe(false);
  });

  it("keeps rustinel_live_agent_denied and never queues a live endpoint agent", () => {
    const live = evaluateRustinelStart({
      authorized: true,
      liveAgent: true,
      qualified: true
    });
    expect(live.allowed).toBe(false);
    expect(live.code).toBe("rustinel_live_agent_denied");
    expect(live.jobsQueued).toBe(0);
    expect(live.liveAgent).toBe(false);
    expect(live.liveSupported).toBe(false);
  });
});

const LIVE_OFFENSIVE_ENV = "PERISCAN_LIVE_OFFENSIVE";

function setLiveOffensiveEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LIVE_OFFENSIVE_ENV];
    return;
  }
  process.env[LIVE_OFFENSIVE_ENV] = value;
}

function qualifiedObserveInput(overrides: Record<string, unknown> = {}) {
  return {
    policyOutcome: "Allowed",
    qualified: true,
    startable: true,
    tenantAuthorized: true,
    ...overrides
  };
}

describe("Rustinel qualified observe/import queue", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("queues an observe/import plan when qualified, tenant-authorized, and policy Allowed", () => {
    const result = queueRustinelObserveImportStart(qualifiedObserveInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.code).toBeNull();
    expect(result.liveSupported).toBe(false);
    expect(result.liveAgent).toBe(false);
    expect(result.yamlEval).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.communityPackEligible).toBe(true);
    expect(result.spdxLicenseId).toBe("Apache-2.0");
    expect(result.observeImportPlan).toEqual({
      kind: "observe-import",
      liveAgent: false,
      liveSupported: false,
      moduleId: RUSTINEL_MODULE_ID,
      parser: RUSTINEL_PARSER,
      yamlEval: false
    });
    expect(isCommunityValidationModuleId(RUSTINEL_MODULE_ID)).toBe(false);
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain(RUSTINEL_MODULE_ID);
  });

  it("queues nothing when the start gate is not startable", () => {
    const result = queueRustinelObserveImportStart(
      qualifiedObserveInput({ startable: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.observeImportPlan).toBeNull();
    expect(result.code).toBe(RUSTINEL_NOT_STARTABLE);
    expect(result.liveSupported).toBe(false);
  });

  it("queues nothing when the observe/import adapter is unqualified", () => {
    const result = queueRustinelObserveImportStart(
      qualifiedObserveInput({ qualified: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.observeImportPlan).toBeNull();
    expect(result.code).toBe(RUSTINEL_QUALIFICATION_REQUIRED);
  });

  it("queues nothing when the tenant has not authorized the pack", () => {
    const result = queueRustinelObserveImportStart(
      qualifiedObserveInput({ tenantAuthorized: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.observeImportPlan).toBeNull();
    expect(result.code).toBe(RUSTINEL_AUTHORIZATION_REQUIRED);
  });

  it("queues nothing when policy is not Allowed", () => {
    const result = queueRustinelObserveImportStart(
      qualifiedObserveInput({ policyOutcome: "Denied" })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.observeImportPlan).toBeNull();
    expect(result.liveSupported).toBe(false);
    expect(result.code).toBe(RUSTINEL_POLICY_NOT_ALLOWED);
  });

  it("keeps rustinel_live_agent_denied and never queues a live agent", () => {
    const result = queueRustinelObserveImportStart(
      qualifiedObserveInput({ liveAgent: true })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.observeImportPlan).toBeNull();
    expect(result.liveAgent).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.code).toBe(RUSTINEL_LIVE_AGENT_DENIED);
  });

  it("never evals rustinel-rules YAML and queues nothing when YAML-eval is requested", () => {
    const result = queueRustinelObserveImportStart(
      qualifiedObserveInput({ yamlEval: true })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.observeImportPlan).toBeNull();
    expect(result.yamlEval).toBe(false);
    expect(result.code).toBe(RUSTINEL_YAML_EVAL_DENIED);
  });

  it("queues nothing when requested as Community default pack", () => {
    const result = queueRustinelObserveImportStart(
      qualifiedObserveInput({ communityDefaultPack: true })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.observeImportPlan).toBeNull();
    expect(result.code).toBe(RUSTINEL_COMMUNITY_DEFAULT_DENIED);
    expect(isCommunityValidationModuleId(RUSTINEL_MODULE_ID)).toBe(false);
  });

  it("still queues nothing for live agent when PERISCAN_LIVE_OFFENSIVE=1", () => {
    setLiveOffensiveEnv("1");
    const live = queueRustinelObserveImportStart(
      qualifiedObserveInput({ liveAgent: true })
    );
    const yaml = queueRustinelObserveImportStart(
      qualifiedObserveInput({ yamlEval: true })
    );

    expect(live.jobsQueued).toBe(0);
    expect(live.code).toBe(RUSTINEL_LIVE_AGENT_DENIED);
    expect(live.liveSupported).toBe(false);
    expect(yaml.jobsQueued).toBe(0);
    expect(yaml.yamlEval).toBe(false);
    expect(yaml.code).toBe(RUSTINEL_YAML_EVAL_DENIED);
  });

  it("keeps DRL rustinel-rules fail-closed in the Community pack and never evals YAML", () => {
    const rustinelRules = listSecurityFeeds().find(
      (feed) => feed.id === "rustinel-rules"
    );
    expect(rustinelRules?.spdxLicenseId).toBe("LicenseRef-DRL-1.1");
    expect(rustinelRules?.defaultPackEligible).toBe(false);
    expect(rustinelRules?.pin).toEqual({ kind: "unpinned", value: null });

    const checked = checkSecurityFeed(rustinelRules!, {
      checkedAt: "2026-09-18T00:00:00.000Z",
      requestedDefaultPack: true
    });
    expect(checked.defaultPackDecision).toBe("fail_closed");
    expect(checked.code).toBe("spdx_not_community_permissive");
    expect(checked.yamlEvaluated).toBe(false);
    expect(checked.executablePinFlipped).toBe(false);

    const yaml = applySecurityFeedYaml({
      feed: rustinelRules!,
      yaml: "run: curl | sh"
    });
    expect(yaml.evaluated).toBe(false);
    expect(yaml.applied).toBe(false);
    expect(yaml.code).toBe("unpinned_yaml_rejected");

    const queued = queueRustinelObserveImportStart(qualifiedObserveInput());
    expect(queued.communityDefaultPack).toBe(false);
    expect(queued.yamlEval).toBe(false);
    expect(queued.liveSupported).toBe(false);
  });
});
