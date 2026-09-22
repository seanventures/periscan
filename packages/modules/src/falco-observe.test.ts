import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_FIRST_HOUR_MODULE_IDS,
  COMMUNITY_VALIDATION_SUITE,
  isCommunityValidationModuleId
} from "@periscan/shared";

import { COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS } from "./community-popular-oss-catalog.js";
import {
  FALCO_LIVE_KERNEL_DENIED,
  FALCO_OBSERVE_AUTHORIZATION_REQUIRED,
  FALCO_OBSERVE_COMMUNITY_DEFAULT_DENIED,
  FALCO_OBSERVE_MODULE_ID,
  FALCO_OBSERVE_NOT_STARTABLE,
  FALCO_OBSERVE_PARSER,
  FALCO_OBSERVE_POLICY_NOT_ALLOWED,
  FALCO_OBSERVE_QUALIFICATION_REQUIRED,
  FALCO_OBSERVE_SPDX_LICENSE_ID,
  correlateFalcoObserve,
  evaluateFalcoObserveStart,
  importFalcoObserveFindings,
  mapFalcoObserveAlerts,
  queueFalcoObserveStart
} from "./falco-observe.js";

const FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/falco/falco-observe-fixture.json"
);
const RULES_VALIDATE_FIXTURE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/falco/falco-fixture.json"
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
  expectedRuleId: "Periscan Benign Marker",
  injectedAt: "2026-09-17T14:00:05.000Z",
  marker: MARKER,
  runId: "11111111-1111-4111-8111-111111111111",
  stepId: "22222222-2222-4222-8222-222222222222"
};

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
    fixtureMode: true,
    policyOutcome: "Allowed",
    qualified: true,
    startable: true,
    tenantAuthorized: true,
    ...overrides
  };
}

describe("Falco observe (Apache-2.0 JSON alerts, not live kernel)", () => {
  it("is Apache-2.0, not Community first-hour, liveSupported false", () => {
    expect(FALCO_OBSERVE_SPDX_LICENSE_ID).toBe("Apache-2.0");
    expect(FALCO_OBSERVE_MODULE_ID).toBe("falco.observe");
    expect(FALCO_OBSERVE_PARSER).toBe("periscan.falco.observe.v1");
    expect(isCommunityValidationModuleId(FALCO_OBSERVE_MODULE_ID)).toBe(false);
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain(FALCO_OBSERVE_MODULE_ID);
    expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).toEqual(["gitleaks.repo_secrets"]);
    expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).not.toContain(
      FALCO_OBSERVE_MODULE_ID
    );

    const falcoTool = COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS.find(
      (tool) => tool.toolId === "falco"
    );
    expect(falcoTool?.moduleIds).toContain("falco.rules_validate");
    expect(falcoTool?.license).toBe("Apache-2.0");
    expect(falcoTool?.notes).toMatch(/does not attach to a live kernel/i);
    expect(falcoTool?.notes).toMatch(/exported JSON alert observe/i);

    const start = evaluateFalcoObserveStart({
      authorized: true,
      qualified: true
    });
    expect(start.liveSupported).toBe(false);
    expect(start.liveKernel).toBe(false);
    expect(start.communityStart).toBe(false);
    expect(start.observeOnly).toBe(true);
    expect(start.executed).toBe(false);
    expect(start.spdxLicenseId).toBe("Apache-2.0");
  });

  it("maps fixture/lab Falco JSON alerts to observe-only findings and omits trap secrets", () => {
    const raw = readFileSync(FIXTURE_PATH, "utf8");
    expect(raw).toMatch(/AKIAIOSFODNN7EXAMPLE/);
    expect(raw).toMatch(/BEGIN RSA PRIVATE KEY/);
    expect(raw).toMatch(MARKER);

    const findings = mapFalcoObserveAlerts(raw);
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      hostname: "lab-node",
      marker: MARKER,
      observeOnly: true,
      processName: "echo",
      rule: "Periscan Benign Marker",
      source: "syscall",
      timestamp: "2026-09-17T14:01:00.000Z"
    });
    expect(findings[1]).toMatchObject({
      observeOnly: true,
      processName: "cat",
      rule: "Read sensitive file"
    });

    const blob = JSON.stringify(findings);
    expect(blob).not.toMatch(/AKIA/);
    expect(blob).not.toMatch(/BEGIN RSA PRIVATE KEY/);
    expect(blob).not.toMatch(/hashed_secret/);
    expect(blob).not.toMatch(/output_fields_debug/);
  });

  it("yields zero findings for empty, malformed, summary-only, or rules-lint load JSON", () => {
    expect(mapFalcoObserveAlerts(undefined)).toEqual([]);
    expect(mapFalcoObserveAlerts(null)).toEqual([]);
    expect(mapFalcoObserveAlerts("")).toEqual([]);
    expect(mapFalcoObserveAlerts("{}")).toEqual([]);
    expect(mapFalcoObserveAlerts("[]")).toEqual([]);
    expect(mapFalcoObserveAlerts("{not json")).toEqual([]);
    expect(
      mapFalcoObserveAlerts(
        JSON.stringify({
          alert_count: 99,
          events: []
        })
      )
    ).toEqual([]);
    expect(
      mapFalcoObserveAlerts(readFileSync(RULES_VALIDATE_FIXTURE_PATH, "utf8"))
    ).toEqual([]);
    expect(
      mapFalcoObserveAlerts({
        error_count: 99,
        falco_load_results: [
          {
            errors: [{ code: "LOAD_ERR_YAML_VALIDATE", message: "bad" }],
            name: "falco_rules.yaml",
            successful: false
          }
        ]
      })
    ).toEqual([]);
    expect(
      importFalcoObserveFindings({ fixtureMode: true, raw: "" }).findings
    ).toEqual([]);
  });

  it("replays fixtureMode from the observe fixture and does not invent findings", () => {
    const imported = importFalcoObserveFindings({ fixtureMode: true });
    expect(imported.findings).toHaveLength(2);
    expect(imported.invented).toBe(false);
    expect(imported.executed).toBe(false);
    expect(imported.liveKernel).toBe(false);
    expect(imported.liveSupported).toBe(false);
    expect(imported.observeOnly).toBe(true);
    expect(imported.parser).toBe("periscan.falco.observe.v1");
  });

  it("Alerted when a Falco JSON alert carries the exact marker and expected rule", () => {
    const result = correlateFalcoObserve({
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

  it("records Alerted from a matching Falco alert and never Missed when the observer is Unhealthy", () => {
    const matched = correlateFalcoObserve({
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

    const noMatch = correlateFalcoObserve({
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
    const missed = correlateFalcoObserve({
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

    const stale = correlateFalcoObserve({
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

  it("does not queue a live kernel module until the start gate is open", () => {
    expect(evaluateFalcoObserveStart({}).jobsQueued).toBe(0);
    expect(evaluateFalcoObserveStart({ authorized: true }).code).toBe(
      FALCO_OBSERVE_QUALIFICATION_REQUIRED
    );
    const started = evaluateFalcoObserveStart({
      authorized: true,
      qualified: true
    });
    expect(started.allowed).toBe(true);
    expect(started.jobsQueued).toBe(1);
    expect(started.liveSupported).toBe(false);
    expect(started.liveKernel).toBe(false);
    expect(started.observeOnly).toBe(true);
    expect(started.executed).toBe(false);
  });

  it("keeps falco_live_kernel_denied and never queues a live kernel module", () => {
    const live = evaluateFalcoObserveStart({
      authorized: true,
      liveKernel: true,
      qualified: true
    });
    expect(live.allowed).toBe(false);
    expect(live.code).toBe(FALCO_LIVE_KERNEL_DENIED);
    expect(live.jobsQueued).toBe(0);
    expect(live.liveKernel).toBe(false);
    expect(live.liveSupported).toBe(false);
  });
});

describe("Falco qualified observe queue", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("queues observe-only findings from a fixture/lab Falco load when qualified, authorized, and Allowed", () => {
    const result = queueFalcoObserveStart(qualifiedObserveInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.code).toBeNull();
    expect(result.liveSupported).toBe(false);
    expect(result.liveKernel).toBe(false);
    expect(result.observeOnly).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.spdxLicenseId).toBe("Apache-2.0");
    expect(result.findings).toHaveLength(2);
    expect(result.findings[0]?.marker).toBe(MARKER);
    expect(result.findings.every((finding) => finding.observeOnly)).toBe(true);
    expect(result.observePlan).toEqual({
      executed: false,
      executable: false,
      kind: "observe",
      liveKernel: false,
      liveSupported: false,
      moduleId: FALCO_OBSERVE_MODULE_ID,
      observeOnly: true,
      parser: FALCO_OBSERVE_PARSER
    });
    expect(isCommunityValidationModuleId(FALCO_OBSERVE_MODULE_ID)).toBe(false);
    expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).not.toContain(
      FALCO_OBSERVE_MODULE_ID
    );
  });

  it("queues nothing when the start gate is not startable", () => {
    const result = queueFalcoObserveStart(
      qualifiedObserveInput({ startable: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.observePlan).toBeNull();
    expect(result.code).toBe(FALCO_OBSERVE_NOT_STARTABLE);
    expect(result.liveSupported).toBe(false);
  });

  it("queues nothing when the observe adapter is unqualified", () => {
    const result = queueFalcoObserveStart(
      qualifiedObserveInput({ qualified: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.observePlan).toBeNull();
    expect(result.code).toBe(FALCO_OBSERVE_QUALIFICATION_REQUIRED);
  });

  it("queues nothing when the tenant has not authorized the pack", () => {
    const result = queueFalcoObserveStart(
      qualifiedObserveInput({ tenantAuthorized: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.observePlan).toBeNull();
    expect(result.code).toBe(FALCO_OBSERVE_AUTHORIZATION_REQUIRED);
  });

  it("queues nothing when policy is not Allowed", () => {
    const result = queueFalcoObserveStart(
      qualifiedObserveInput({ policyOutcome: "Denied" })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.observePlan).toBeNull();
    expect(result.liveSupported).toBe(false);
    expect(result.code).toBe(FALCO_OBSERVE_POLICY_NOT_ALLOWED);
  });

  it("keeps falco_live_kernel_denied and never queues a live kernel module", () => {
    const result = queueFalcoObserveStart(
      qualifiedObserveInput({ liveKernel: true })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.observePlan).toBeNull();
    expect(result.liveKernel).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.code).toBe(FALCO_LIVE_KERNEL_DENIED);
  });

  it("queues nothing when requested as Community default pack", () => {
    const result = queueFalcoObserveStart(
      qualifiedObserveInput({ communityDefaultPack: true })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.findings).toEqual([]);
    expect(result.observePlan).toBeNull();
    expect(result.code).toBe(FALCO_OBSERVE_COMMUNITY_DEFAULT_DENIED);
    expect(isCommunityValidationModuleId(FALCO_OBSERVE_MODULE_ID)).toBe(false);
  });

  it("still queues nothing for live kernel when PERISCAN_LIVE_OFFENSIVE=1", () => {
    setLiveOffensiveEnv("1");
    const live = queueFalcoObserveStart(
      qualifiedObserveInput({ liveKernel: true })
    );
    const community = queueFalcoObserveStart(
      qualifiedObserveInput({ communityDefaultPack: true })
    );

    expect(live.jobsQueued).toBe(0);
    expect(live.code).toBe(FALCO_LIVE_KERNEL_DENIED);
    expect(live.liveSupported).toBe(false);
    expect(community.jobsQueued).toBe(0);
    expect(community.code).toBe(FALCO_OBSERVE_COMMUNITY_DEFAULT_DENIED);
  });

  it("does not replace Gitleaks as the first-hour door", () => {
    const result = queueFalcoObserveStart(qualifiedObserveInput());

    expect(result.communityStart).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).toEqual(["gitleaks.repo_secrets"]);
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).toContain("falco.rules_validate");
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain(FALCO_OBSERVE_MODULE_ID);
  });
});
