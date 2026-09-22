import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_FIRST_HOUR_MODULE_IDS,
  COMMUNITY_VALIDATION_SUITE,
  isCommunityValidationModuleId
} from "@periscan/shared";

import { startBasFalcoObserve } from "./bas-falco-start.js";

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
    fixtureMode: true,
    policyOutcome: "Allowed",
    qualified: true,
    startGate: { startable: true },
    tenantAuthorized: true,
    ...overrides
  };
}

describe("startBasFalcoObserve", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("records an observe-only plan when the start gate is qualified, authorized, and Allowed", () => {
    const result = startBasFalcoObserve(qualifiedInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recordedPlan?.kind).toBe("observe");
    expect(result.recordedPlan?.liveSupported).toBe(false);
    expect(result.recordedPlan?.liveKernel).toBe(false);
    expect(result.recordedPlan?.observeOnly).toBe(true);
    expect(result.recordedPlan?.executed).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.liveKernel).toBe(false);
    expect(result.observeOnly).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.spdxLicenseId).toBe("Apache-2.0");
    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.findings.every((finding) => finding.observeOnly)).toBe(true);
  });

  it("queues zero jobs when the start gate is not startable", () => {
    const result = startBasFalcoObserve(
      qualifiedInput({ startGate: { startable: false } })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recordedPlan).toBeNull();
    expect(result.findings).toEqual([]);
    expect(result.code).toBe("falco_observe_not_startable");
  });

  it("queues zero jobs when unqualified, unauthorized, or policy is not Allowed", () => {
    const unqualified = startBasFalcoObserve(
      qualifiedInput({ qualified: false })
    );
    const unauthorized = startBasFalcoObserve(
      qualifiedInput({ tenantAuthorized: false })
    );
    const deniedPolicy = startBasFalcoObserve(
      qualifiedInput({ policyOutcome: "Denied" })
    );

    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.code).toBe("falco_observe_qualification_required");
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.code).toBe("falco_observe_authorization_required");
    expect(deniedPolicy.jobsQueued).toBe(0);
    expect(deniedPolicy.recordedPlan).toBeNull();
    expect(deniedPolicy.code).toBe("falco_observe_policy_not_allowed");
  });

  it("queues zero jobs for live kernel or Community default pack", () => {
    const live = startBasFalcoObserve(qualifiedInput({ liveKernel: true }));
    const community = startBasFalcoObserve(
      qualifiedInput({ communityDefaultPack: true })
    );

    expect(live.jobsQueued).toBe(0);
    expect(live.code).toBe("falco_live_kernel_denied");
    expect(live.liveSupported).toBe(false);
    expect(live.liveKernel).toBe(false);
    expect(community.jobsQueued).toBe(0);
    expect(community.communityDefaultPack).toBe(false);
    expect(community.code).toBe("falco_observe_community_default_denied");
  });

  it("does not add Falco observe to the Community first-hour pack", () => {
    const result = startBasFalcoObserve(qualifiedInput());

    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(isCommunityValidationModuleId("falco.observe")).toBe(false);
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).toContain("falco.rules_validate");
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain("falco.observe");
    expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).toEqual(["gitleaks.repo_secrets"]);
  });

  it("still queues nothing for live kernel when PERISCAN_LIVE_OFFENSIVE=1", () => {
    setLiveOffensiveEnv("1");
    const live = startBasFalcoObserve(qualifiedInput({ liveKernel: true }));

    expect(live.jobsQueued).toBe(0);
    expect(live.code).toBe("falco_live_kernel_denied");
    expect(live.liveSupported).toBe(false);
  });
});
