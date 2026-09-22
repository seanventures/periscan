import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_FIRST_HOUR_MODULE_IDS,
  NUCLEI_ENGINE_VERSION_PIN,
  WEB_API_NUCLEI_MODULE_ID,
  WEB_API_ZAP_MODULE_ID,
  ZAP_ENGINE_VERSION_PIN
} from "@periscan/shared";

import { startBasNucleiZapSafeScan } from "./bas-nuclei-start.js";

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
    engine: "nuclei" as const,
    policyOutcome: "Allowed",
    profileId: "safe-baseline",
    qualified: true,
    startGate: { startable: true },
    tenantAuthorized: true,
    ...overrides
  };
}

describe("startBasNucleiZapSafeScan", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("records an import/safe-scan plan when the start gate is qualified, authorized, and Allowed", () => {
    const result = startBasNucleiZapSafeScan(qualifiedInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recordedPlan?.kind).toBe("import-safe-scan");
    expect(result.recordedPlan?.executed).toBe(false);
    expect(result.recordedPlan?.moduleId).toBe(WEB_API_NUCLEI_MODULE_ID);
    expect(result.recordedPlan?.pin.nuclei).toBe(NUCLEI_ENGINE_VERSION_PIN);
    expect(result.liveSupported).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.importOnly).toBe(true);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityFirstHour).toBe(false);
    expect(result.startsExternalPoa).toBe(false);
  });

  it("records a ZAP baseline import/safe-scan plan on the same helper", () => {
    const result = startBasNucleiZapSafeScan(
      qualifiedInput({ engine: "zap", profileId: "zap-baseline" })
    );

    expect(result.jobsQueued).toBe(1);
    expect(result.recordedPlan?.engine).toBe("zap");
    expect(result.recordedPlan?.moduleId).toBe(WEB_API_ZAP_MODULE_ID);
    expect(result.recordedPlan?.pin.zap).toBe(ZAP_ENGINE_VERSION_PIN);
    expect(result.executed).toBe(false);
    expect(result.liveSupported).toBe(false);
  });

  it("queues zero jobs when the start gate is not startable", () => {
    const result = startBasNucleiZapSafeScan(
      qualifiedInput({ startGate: { startable: false } })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recordedPlan).toBeNull();
    expect(result.denyCode).toBe("nuclei_zap_not_startable");
  });

  it("queues zero jobs when unqualified, unauthorized, or policy is not Allowed", () => {
    const unqualified = startBasNucleiZapSafeScan(
      qualifiedInput({ qualified: false })
    );
    const unauthorized = startBasNucleiZapSafeScan(
      qualifiedInput({ tenantAuthorized: false })
    );
    const deniedPolicy = startBasNucleiZapSafeScan(
      qualifiedInput({ policyOutcome: "Denied" })
    );

    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.denyCode).toBe("nuclei_zap_qualification_required");
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.denyCode).toBe("nuclei_zap_authorization_required");
    expect(deniedPolicy.jobsQueued).toBe(0);
    expect(deniedPolicy.recordedPlan).toBeNull();
    expect(deniedPolicy.denyCode).toBe("nuclei_zap_policy_not_allowed");
  });

  it("queues zero jobs for Community default, first-hour, exploit templates, or internet-wide", () => {
    const community = startBasNucleiZapSafeScan(
      qualifiedInput({ communityDefaultPack: true })
    );
    const firstHour = startBasNucleiZapSafeScan(
      qualifiedInput({ communityFirstHour: true })
    );
    const exploit = startBasNucleiZapSafeScan(
      qualifiedInput({ exploitTemplates: true, profileId: "exploit" })
    );
    const internetWide = startBasNucleiZapSafeScan(
      qualifiedInput({ internetWide: true })
    );

    expect(community.jobsQueued).toBe(0);
    expect(community.communityDefaultPack).toBe(false);
    expect(community.denyCode).toBe("nuclei_zap_community_default_denied");
    expect(firstHour.jobsQueued).toBe(0);
    expect(firstHour.communityFirstHour).toBe(false);
    expect(firstHour.denyCode).toBe("nuclei_zap_community_first_hour_denied");
    expect(exploit.jobsQueued).toBe(0);
    expect(exploit.denyCode).toBe("nuclei_zap_exploit_template_denied");
    expect(internetWide.jobsQueued).toBe(0);
    expect(internetWide.denyCode).toBe("nuclei_zap_internet_wide_denied");
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).toEqual([
      "gitleaks.repo_secrets"
    ]);
  });

  it("does not treat PERISCAN_LIVE_OFFENSIVE=1 as an enablement path", () => {
    setLiveOffensiveEnv("1");
    const live = startBasNucleiZapSafeScan(
      qualifiedInput({
        liveOffensive: true,
        liveOffensiveEnv: "1",
        scenarioId: "nuclei.live"
      })
    );

    expect(live.jobsQueued).toBe(0);
    expect(live.liveSupported).toBe(false);
    expect(live.recordedPlan).toBeNull();
    expect(live.denyCode).toBe("nuclei_zap_live_exploit_denied");
  });
});
