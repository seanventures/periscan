import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_VALIDATION_SUITE,
  isCommunityValidationModuleId
} from "@periscan/shared";

import { startBasRustinelObserveImport } from "./bas-rustinel-start.js";

const LIVE_OFFENSIVE_ENV = "PERISCAN_LIVE_OFFENSIVE";

function setLiveOffensiveEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LIVE_OFFENSIVE_ENV];
    return;
  }
  process.env[LIVE_OFFENSIVE_ENV] = value;
}

function qualifiedInput(overrides: Record<string, unknown> = {}) {
  return {
    policyOutcome: "Allowed",
    qualified: true,
    startGate: { startable: true },
    tenantAuthorized: true,
    ...overrides
  };
}

describe("startBasRustinelObserveImport", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("records an observe/import plan when the start gate is qualified, authorized, and Allowed", () => {
    const result = startBasRustinelObserveImport(qualifiedInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recordedPlan?.kind).toBe("observe-import");
    expect(result.recordedPlan?.liveSupported).toBe(false);
    expect(result.recordedPlan?.liveAgent).toBe(false);
    expect(result.recordedPlan?.yamlEval).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.liveAgent).toBe(false);
    expect(result.yamlEval).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.spdxLicenseId).toBe("Apache-2.0");
  });

  it("queues zero jobs when the start gate is not startable", () => {
    const result = startBasRustinelObserveImport(
      qualifiedInput({ startGate: { startable: false } })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recordedPlan).toBeNull();
    expect(result.code).toBe("rustinel_observe_import_not_startable");
  });

  it("queues zero jobs when unqualified, unauthorized, or policy is not Allowed", () => {
    const unqualified = startBasRustinelObserveImport(
      qualifiedInput({ qualified: false })
    );
    const unauthorized = startBasRustinelObserveImport(
      qualifiedInput({ tenantAuthorized: false })
    );
    const deniedPolicy = startBasRustinelObserveImport(
      qualifiedInput({ policyOutcome: "Denied" })
    );

    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.code).toBe("rustinel_qualification_required");
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.code).toBe("rustinel_authorization_required");
    expect(deniedPolicy.jobsQueued).toBe(0);
    expect(deniedPolicy.recordedPlan).toBeNull();
    expect(deniedPolicy.code).toBe("rustinel_policy_not_allowed");
  });

  it("queues zero jobs for live agent, YAML-eval, or Community default pack", () => {
    const live = startBasRustinelObserveImport(
      qualifiedInput({ liveAgent: true })
    );
    const yaml = startBasRustinelObserveImport(
      qualifiedInput({ yamlEval: true })
    );
    const community = startBasRustinelObserveImport(
      qualifiedInput({ communityDefaultPack: true })
    );

    expect(live.jobsQueued).toBe(0);
    expect(live.code).toBe("rustinel_live_agent_denied");
    expect(live.liveSupported).toBe(false);
    expect(yaml.jobsQueued).toBe(0);
    expect(yaml.yamlEval).toBe(false);
    expect(yaml.code).toBe("rustinel_yaml_eval_denied");
    expect(community.jobsQueued).toBe(0);
    expect(community.communityDefaultPack).toBe(false);
    expect(community.code).toBe("rustinel_community_default_denied");
  });

  it("does not add Rustinel to the Community default pack", () => {
    const result = startBasRustinelObserveImport(qualifiedInput());

    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(isCommunityValidationModuleId("rustinel.endpoint_observe")).toBe(
      false
    );
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain("rustinel.endpoint_observe");
  });
});
