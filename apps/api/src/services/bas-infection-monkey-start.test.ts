import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ENGINE_LAB_THEATER_TOOL_IDS,
  isCommunityValidationToolId
} from "@periscan/shared";

import { startBasInfectionMonkeyDiscover } from "./bas-infection-monkey-start.js";

const LIVE_OFFENSIVE_ENV = "PERISCAN_LIVE_OFFENSIVE";
const VERIFIED_HOSTS = ["lab-web.example.test", "lab-db.example.test"];

function setLiveOffensiveEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LIVE_OFFENSIVE_ENV];
    return;
  }
  process.env[LIVE_OFFENSIVE_ENV] = value;
}

function qualifiedInput(overrides: Record<string, unknown> = {}) {
  return {
    copyleftOptIn: true,
    plugins: ["ping_scanner", "tcp_scanner"],
    policyOutcome: "Allowed",
    qualified: true,
    startGate: { startable: true },
    tenantAuthorized: true,
    verifiedScopeHosts: VERIFIED_HOSTS,
    ...overrides
  };
}

describe("startBasInfectionMonkeyDiscover", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("records a discover-only plan when the start gate is qualified, authorized, and Allowed", () => {
    const result = startBasInfectionMonkeyDiscover(qualifiedInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recordedPlan?.plugins).toEqual([
      "ping_scanner",
      "tcp_scanner"
    ]);
    expect(result.recordedPlan?.liveSupported).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.propagation).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.license.disposition).toBe("RequiresLegalReview");
  });

  it("queues zero jobs when the start gate is not startable", () => {
    const result = startBasInfectionMonkeyDiscover(
      qualifiedInput({ startGate: { startable: false } })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.recordedPlan).toBeNull();
    expect(result.denyCode).toBe("infection_monkey_not_startable");
  });

  it("queues zero jobs when unqualified, unauthorized, or policy is not Allowed", () => {
    const unqualified = startBasInfectionMonkeyDiscover(
      qualifiedInput({ qualified: false })
    );
    const unauthorized = startBasInfectionMonkeyDiscover(
      qualifiedInput({ tenantAuthorized: false })
    );
    const deniedPolicy = startBasInfectionMonkeyDiscover(
      qualifiedInput({ policyOutcome: "Denied" })
    );

    expect(unqualified.jobsQueued).toBe(0);
    expect(unqualified.denyCode).toBe(
      "infection_monkey_qualification_required"
    );
    expect(unauthorized.jobsQueued).toBe(0);
    expect(unauthorized.denyCode).toBe(
      "infection_monkey_authorization_required"
    );
    expect(deniedPolicy.jobsQueued).toBe(0);
    expect(deniedPolicy.recordedPlan).toBeNull();
    expect(deniedPolicy.denyCode).toBe("infection_monkey_policy_not_allowed");
  });

  it("queues zero jobs for Community default pack or live-offensive", () => {
    const community = startBasInfectionMonkeyDiscover(
      qualifiedInput({ communityDefaultPack: true })
    );
    const live = startBasInfectionMonkeyDiscover(
      qualifiedInput({
        liveOffensive: true,
        scenarioId: "infection-monkey.live"
      })
    );

    expect(community.jobsQueued).toBe(0);
    expect(community.communityDefaultPack).toBe(false);
    expect(community.denyCode).toBe(
      "infection_monkey_community_default_denied"
    );
    expect(live.jobsQueued).toBe(0);
    expect(live.liveSupported).toBe(false);
    expect(live.denyCode).toBe(
      "infection_monkey_discover_live_permanently_disabled"
    );
  });

  it("never queues ransomware or credential harvest", () => {
    const ransomware = startBasInfectionMonkeyDiscover(
      qualifiedInput({ plugins: ["ransomware"] })
    );
    const harvest = startBasInfectionMonkeyDiscover(
      qualifiedInput({
        dangerAckDigest: "a".repeat(16),
        dangerAcknowledged: true,
        plugins: ["mimikatz"]
      })
    );

    expect(ransomware.jobsQueued).toBe(0);
    expect(ransomware.ransomwarePayload).toBe(false);
    expect(harvest.jobsQueued).toBe(0);
    expect(harvest.credentialTheft).toBe(false);
  });

  it("does not add Infection Monkey to the Community default pack", () => {
    const result = startBasInfectionMonkeyDiscover(qualifiedInput());

    expect(result.communityDefaultPack).toBe(false);
    expect(result.license.redistributableInDefaultPack).toBe(false);
    expect(result.license.spdxLicenseId).toBe("GPL-3.0");
    expect(isCommunityValidationToolId("infection-monkey")).toBe(false);
    expect(ENGINE_LAB_THEATER_TOOL_IDS).toContain("infection-monkey");
  });
});
