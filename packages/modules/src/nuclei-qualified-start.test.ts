import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_FIRST_HOUR_MODULE_IDS,
  COMMUNITY_VALIDATION_SUITE,
  NUCLEI_ENGINE_VERSION_PIN,
  NUCLEI_TEMPLATES_VERSION_PIN,
  WEB_API_NUCLEI_MODULE_ID,
  WEB_API_ZAP_MODULE_ID,
  ZAP_ENGINE_VERSION_PIN,
  compileWebApiScenarioVersion,
  communityFirstHourStartModuleIds
} from "@periscan/shared";

import { COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS } from "./community-popular-oss-catalog.js";
import { COMMUNITY_POPULAR_OSS_SPECS } from "./community-popular-oss.js";
import {
  NUCLEI_ZAP_AUTHORIZATION_REQUIRED,
  NUCLEI_ZAP_COMMUNITY_DEFAULT_DENIED,
  NUCLEI_ZAP_COMMUNITY_FIRST_HOUR_DENIED,
  NUCLEI_ZAP_EXPLOIT_TEMPLATE_DENIED,
  NUCLEI_ZAP_INTERNET_WIDE_DENIED,
  NUCLEI_ZAP_LIVE_EXPLOIT_DENIED,
  NUCLEI_ZAP_NOT_STARTABLE,
  NUCLEI_ZAP_POLICY_NOT_ALLOWED,
  NUCLEI_ZAP_QUALIFICATION_REQUIRED,
  queueNucleiZapQualifiedStart,
  type NucleiZapQualifiedStartInput
} from "./nuclei-qualified-start.js";

const LIVE_OFFENSIVE_ENV = "PERISCAN_LIVE_OFFENSIVE";

function setLiveOffensiveEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LIVE_OFFENSIVE_ENV];
    return;
  }
  process.env[LIVE_OFFENSIVE_ENV] = value;
}

function qualifiedNucleiInput(
  overrides: Partial<NucleiZapQualifiedStartInput> = {}
): NucleiZapQualifiedStartInput {
  return {
    engine: "nuclei",
    policyOutcome: "Allowed",
    profileId: "safe-baseline",
    qualified: true,
    startable: true,
    tenantAuthorized: true,
    ...overrides
  };
}

function qualifiedZapInput(
  overrides: Partial<NucleiZapQualifiedStartInput> = {}
): NucleiZapQualifiedStartInput {
  return qualifiedNucleiInput({
    engine: "zap",
    profileId: "zap-baseline",
    ...overrides
  });
}

describe("existing Nuclei/ZAP compile deny stays fail-closed", () => {
  it("still rejects exploit, fuzzing, attack, and internet-wide profiles without queuing", () => {
    const fuzzing = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "fuzzing"
    });
    const exploit = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "exploit"
    });
    const attack = compileWebApiScenarioVersion({
      engine: "zap",
      profileId: "attack"
    });
    const internetWide = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "internet-wide"
    });

    expect(fuzzing.ok).toBe(false);
    expect(exploit.ok).toBe(false);
    expect(attack.ok).toBe(false);
    expect(internetWide.ok).toBe(false);
    if (!fuzzing.ok) {
      expect(fuzzing.jobsQueued).toBe(0);
      expect(fuzzing.liveSupported).toBe(false);
    }
    if (!exploit.ok) {
      expect(exploit.jobsQueued).toBe(0);
    }
    if (!attack.ok) {
      expect(attack.jobsQueued).toBe(0);
    }
    if (!internetWide.ok) {
      expect(internetWide.jobsQueued).toBe(0);
    }
  });

  it("compile still does not queue or start ExternalPoA from the Community primary path", () => {
    const compiled = compileWebApiScenarioVersion({
      engine: "nuclei",
      profileId: "safe-baseline"
    });
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) {
      return;
    }
    expect(compiled.version.jobsQueued).toBe(0);
    expect(compiled.version.startsExternalPoa).toBe(false);
    expect(compiled.version.communityPrimaryStart).toBe(false);
  });
});

describe("Nuclei/ZAP qualified import/safe-scan queue", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("queues a Nuclei safe-exposure import/safe-scan plan when qualified, authorized, and Allowed", () => {
    const result = queueNucleiZapQualifiedStart(qualifiedNucleiInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recorded).toBe(true);
    expect(result.allowed).toBe(true);
    expect(result.denyCode).toBeNull();
    expect(result.code).toBeNull();
    expect(result.executed).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.importOnly).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.startsExternalPoa).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.communityFirstHour).toBe(false);
    expect(result.communityPrimaryStart).toBe(false);
    expect(result.moduleId).toBe(WEB_API_NUCLEI_MODULE_ID);
    expect(result.safeScanPlan).toEqual({
      engine: "nuclei",
      executed: false,
      executable: false,
      importOnly: true,
      kind: "import-safe-scan",
      liveSupported: false,
      moduleId: WEB_API_NUCLEI_MODULE_ID,
      pin: {
        nuclei: NUCLEI_ENGINE_VERSION_PIN,
        nucleiTemplates: NUCLEI_TEMPLATES_VERSION_PIN
      },
      profileId: "safe-baseline",
      startsExternalPoa: false
    });
  });

  it("queues a ZAP baseline import/safe-scan plan when qualified, authorized, and Allowed", () => {
    const result = queueNucleiZapQualifiedStart(qualifiedZapInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.executed).toBe(false);
    expect(result.importOnly).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.communityFirstHour).toBe(false);
    expect(result.moduleId).toBe(WEB_API_ZAP_MODULE_ID);
    expect(result.safeScanPlan).toMatchObject({
      engine: "zap",
      executed: false,
      kind: "import-safe-scan",
      liveSupported: false,
      moduleId: WEB_API_ZAP_MODULE_ID,
      pin: { zap: ZAP_ENGINE_VERSION_PIN },
      profileId: "zap-baseline"
    });
  });

  it.each(["fingerprint", "headers", "metadata"] as const)(
    "queues Nuclei allowlisted profile %s as import/safe-scan, not executed",
    (profileId) => {
      const result = queueNucleiZapQualifiedStart(
        qualifiedNucleiInput({ profileId })
      );

      expect(result.jobsQueued).toBe(1);
      expect(result.queued).toBe(true);
      expect(result.executed).toBe(false);
      expect(result.liveSupported).toBe(false);
      expect(result.safeScanPlan?.profileId).toBe(profileId);
    }
  );

  it("queues nothing when the start gate is not startable", () => {
    const result = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ startable: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recorded).toBe(false);
    expect(result.safeScanPlan).toBeNull();
    expect(result.executed).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.denyCode).toBe(NUCLEI_ZAP_NOT_STARTABLE);
  });

  it("queues nothing when the adapter is unqualified", () => {
    const result = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ qualified: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.safeScanPlan).toBeNull();
    expect(result.denyCode).toBe(NUCLEI_ZAP_QUALIFICATION_REQUIRED);
  });

  it("queues nothing when the tenant has not authorized the pin", () => {
    const result = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ tenantAuthorized: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe(NUCLEI_ZAP_AUTHORIZATION_REQUIRED);
  });

  it("queues nothing when policy is not Allowed", () => {
    const result = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ policyOutcome: "Denied" })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recorded).toBe(false);
    expect(result.safeScanPlan).toBeNull();
    expect(result.liveSupported).toBe(false);
    expect(result.denyCode).toBe(NUCLEI_ZAP_POLICY_NOT_ALLOWED);
  });

  it("queues nothing for exploit templates even when the other gates are open", () => {
    const flag = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ exploitTemplates: true })
    );
    const profile = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ profileId: "exploit" })
    );
    const fuzzing = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ profileId: "fuzzing" })
    );
    const zapAttack = queueNucleiZapQualifiedStart(
      qualifiedZapInput({ profileId: "attack" })
    );

    expect(flag.jobsQueued).toBe(0);
    expect(flag.denyCode).toBe(NUCLEI_ZAP_EXPLOIT_TEMPLATE_DENIED);
    expect(profile.jobsQueued).toBe(0);
    expect(profile.denyCode).toBe(NUCLEI_ZAP_EXPLOIT_TEMPLATE_DENIED);
    expect(fuzzing.jobsQueued).toBe(0);
    expect(fuzzing.liveSupported).toBe(false);
    expect(zapAttack.jobsQueued).toBe(0);
    expect(zapAttack.executed).toBe(false);
  });

  it("queues nothing for internet-wide scans", () => {
    const flag = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ internetWide: true })
    );
    const profile = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ profileId: "internet-wide" })
    );

    expect(flag.jobsQueued).toBe(0);
    expect(flag.queued).toBe(false);
    expect(flag.denyCode).toBe(NUCLEI_ZAP_INTERNET_WIDE_DENIED);
    expect(profile.jobsQueued).toBe(0);
    expect(profile.denyCode).toBe(NUCLEI_ZAP_INTERNET_WIDE_DENIED);
    expect(flag.liveSupported).toBe(false);
  });

  it("queues nothing when requested as Community default pack or first-hour door", () => {
    const community = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ communityDefaultPack: true })
    );
    const firstHour = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ communityFirstHour: true })
    );

    expect(community.jobsQueued).toBe(0);
    expect(community.communityDefaultPack).toBe(false);
    expect(community.communityFirstHour).toBe(false);
    expect(community.denyCode).toBe(NUCLEI_ZAP_COMMUNITY_DEFAULT_DENIED);
    expect(firstHour.jobsQueued).toBe(0);
    expect(firstHour.communityFirstHour).toBe(false);
    expect(firstHour.denyCode).toBe(NUCLEI_ZAP_COMMUNITY_FIRST_HOUR_DENIED);
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).toEqual([
      "gitleaks.repo_secrets"
    ]);
    expect(
      communityFirstHourStartModuleIds([
        "gitleaks.repo_secrets",
        WEB_API_NUCLEI_MODULE_ID,
        WEB_API_ZAP_MODULE_ID
      ])
    ).toEqual(["gitleaks.repo_secrets"]);
  });

  it("queues nothing for live-exploit pins even when the other gates are open", () => {
    const liveFlag = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ liveExploit: true })
    );
    const livePin = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({
        liveOffensive: true,
        scenarioId: "nuclei.live"
      })
    );

    expect(liveFlag.jobsQueued).toBe(0);
    expect(liveFlag.liveSupported).toBe(false);
    expect(liveFlag.denyCode).toBe(NUCLEI_ZAP_LIVE_EXPLOIT_DENIED);
    expect(livePin.jobsQueued).toBe(0);
    expect(livePin.executed).toBe(false);
    expect(livePin.denyCode).toBe(NUCLEI_ZAP_LIVE_EXPLOIT_DENIED);
  });

  it("still queues nothing for denied starts when PERISCAN_LIVE_OFFENSIVE=1", () => {
    setLiveOffensiveEnv("1");
    const denied = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({ startable: false })
    );
    const livePin = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({
        exploitTemplates: true,
        liveOffensiveEnv: "1"
      })
    );
    const internetWide = queueNucleiZapQualifiedStart(
      qualifiedNucleiInput({
        internetWide: true,
        liveOffensiveEnv: "1"
      })
    );

    expect(denied.jobsQueued).toBe(0);
    expect(livePin.jobsQueued).toBe(0);
    expect(livePin.liveSupported).toBe(false);
    expect(livePin.denyCode).toBe(NUCLEI_ZAP_EXPLOIT_TEMPLATE_DENIED);
    expect(internetWide.jobsQueued).toBe(0);
    expect(internetWide.denyCode).toBe(NUCLEI_ZAP_INTERNET_WIDE_DENIED);
  });

  it("does not treat import/safe-scan as executed coverage or live exploit", () => {
    const nuclei = queueNucleiZapQualifiedStart(qualifiedNucleiInput());
    const zap = queueNucleiZapQualifiedStart(qualifiedZapInput());

    expect(nuclei.jobsQueued).toBe(1);
    expect(nuclei.executed).toBe(false);
    expect(nuclei.executable).toBe(false);
    expect(nuclei.importOnly).toBe(true);
    expect(nuclei.safeScanPlan?.executed).toBe(false);
    expect(nuclei.liveSupported).toBe(false);
    expect(zap.jobsQueued).toBe(1);
    expect(zap.executed).toBe(false);
    expect(zap.liveSupported).toBe(false);
  });

  it("keeps Gitleaks as Community first-hour and Nuclei/ZAP out of popular OSS first-hour", () => {
    const result = queueNucleiZapQualifiedStart(qualifiedNucleiInput());

    expect(result.communityFirstHour).toBe(false);
    expect(result.communityPrimaryStart).toBe(false);
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).toEqual([
      "gitleaks.repo_secrets"
    ]);
    expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).not.toContain(
      WEB_API_NUCLEI_MODULE_ID
    );
    expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).not.toContain(
      WEB_API_ZAP_MODULE_ID
    );
    expect(
      COMMUNITY_POPULAR_OSS_SPECS.some(
        (spec) => spec.toolId === "nuclei" || spec.toolId === "zaproxy"
      )
    ).toBe(false);
    expect(
      COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS.some(
        (tool) => tool.toolId === "nuclei" || tool.toolId === "zaproxy"
      )
    ).toBe(false);
    expect(
      COMMUNITY_VALIDATION_SUITE.some(
        (entry) => entry.moduleId === "gitleaks.repo_secrets"
      )
    ).toBe(true);
  });
});
