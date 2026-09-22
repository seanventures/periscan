import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_VALIDATION_SUITE,
  isCommunityValidationModuleId
} from "@periscan/shared";

import { startBasStrixImport } from "./bas-strix-start.js";

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
    executionEnvironment: "LabDocker" as const,
    policyOutcome: "Allowed",
    qualified: true,
    scenarioId: "strix.pentest_import",
    startGate: { startable: true },
    tenantAuthorized: true,
    ...overrides
  };
}

describe("startBasStrixImport", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("records an import-only plan when the start gate is qualified, authorized, and Allowed", () => {
    const result = startBasStrixImport(qualifiedInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recordedPlan?.parser).toBe("periscan.strix.v1");
    expect(result.recordedPlan?.executionEnvironment).toBe("LabDocker");
    expect(result.recordedPlan?.executed).toBe(false);
    expect(result.recordedPlan?.importOnly).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.liveExploit).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.spdxLicenseId).toBe("Apache-2.0");
  });

  it("queues zero jobs when the start gate is not startable", () => {
    const result = startBasStrixImport(
      qualifiedInput({ startGate: { startable: false } })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recordedPlan).toBeNull();
    expect(result.denyCode).toBe("strix_not_startable");
  });

  it("queues zero jobs when unqualified, unauthorized, or policy is not Allowed", () => {
    const unqualified = startBasStrixImport(
      qualifiedInput({ qualified: false })
    );
    const unauthorized = startBasStrixImport(
      qualifiedInput({ tenantAuthorized: false })
    );
    const deniedPolicy = startBasStrixImport(
      qualifiedInput({ policyOutcome: "Denied" })
    );

    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.denyCode).toBe("strix_qualification_required");
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.denyCode).toBe("strix_authorization_required");
    expect(deniedPolicy.jobsQueued).toBe(0);
    expect(deniedPolicy.recordedPlan).toBeNull();
    expect(deniedPolicy.denyCode).toBe("strix_policy_not_allowed");
  });

  it("queues zero jobs for Community default pack or live-exploit", () => {
    const community = startBasStrixImport(
      qualifiedInput({ communityDefaultPack: true })
    );
    const live = startBasStrixImport(
      qualifiedInput({
        liveOffensive: true,
        scenarioId: "strix.live"
      })
    );

    expect(community.jobsQueued).toBe(0);
    expect(community.communityDefaultPack).toBe(false);
    expect(community.denyCode).toBe("strix_community_default_denied");
    expect(live.jobsQueued).toBe(0);
    expect(live.liveSupported).toBe(false);
    expect(live.denyCode).toBe("strix_live_exploit_denied");
  });

  it("queues zero jobs for cloud-shell or ControlPlane", () => {
    const cloudShell = startBasStrixImport(
      qualifiedInput({ unrestrictedShell: true })
    );
    const controlPlane = startBasStrixImport(
      qualifiedInput({ executionEnvironment: "ControlPlane" })
    );

    expect(cloudShell.jobsQueued).toBe(0);
    expect(cloudShell.unrestrictedShell).toBe(false);
    expect(cloudShell.denyCode).toBe("strix_cloud_shell_forbidden");
    expect(controlPlane.jobsQueued).toBe(0);
    expect(controlPlane.recordedPlan).toBeNull();
    expect(controlPlane.denyCode).toBe("strix_runner_or_lab_required");
  });

  it("does not add Strix to the Community default pack", () => {
    const result = startBasStrixImport(qualifiedInput());

    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityStart).toBe(false);
    expect(result.moduleId).toBe("strix.pentest_import");
    expect(isCommunityValidationModuleId("strix.pentest_import")).toBe(false);
    expect(
      COMMUNITY_VALIDATION_SUITE.map((entry) => entry.moduleId as string)
    ).not.toContain("strix.pentest_import");
  });
});
