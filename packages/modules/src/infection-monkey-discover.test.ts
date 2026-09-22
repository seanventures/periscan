import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ENGINE_LAB_THEATER_TOOL_IDS,
  isCommunityValidationToolId,
  isCopyleftOptInModuleId
} from "@periscan/shared";

import {
  evaluateModuleStartConstraints,
  executeModuleById,
  getModuleById,
  ModuleExecutionContextSchema
} from "./index.js";
import {
  INFECTION_MONKEY_AUTHORIZATION_REQUIRED,
  INFECTION_MONKEY_COMMUNITY_DEFAULT_DENIED,
  INFECTION_MONKEY_DISCOVER_NOT_STARTABLE,
  INFECTION_MONKEY_LIVE_DISABLED,
  INFECTION_MONKEY_POLICY_NOT_ALLOWED,
  INFECTION_MONKEY_QUALIFICATION_REQUIRED,
  planInfectionMonkeyDiscoverStart,
  queueInfectionMonkeyDiscoverStart
} from "./infection-monkey-discover.js";

const LIVE_OFFENSIVE_ENV = "PERISCAN_LIVE_OFFENSIVE";
const VERIFIED_HOSTS = ["lab-web.example.test", "lab-db.example.test"];

function setLiveOffensiveEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LIVE_OFFENSIVE_ENV];
    return;
  }
  process.env[LIVE_OFFENSIVE_ENV] = value;
}

function createContext(overrides: Record<string, unknown> = {}) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: null,
    runId: randomUUID(),
    runnerId: null,
    safetyLevel: "ActiveNonInvasive",
    scopeId: randomUUID(),
    target: {},
    tenantId: randomUUID(),
    ...overrides
  });
}

function licensedTarget(overrides: Record<string, unknown> = {}) {
  return {
    plugins: ["ping_scanner", "tcp_scanner"],
    qualified: true,
    tenantAuthorized: true,
    upstreamLicenseAcceptedToolIds: ["infection-monkey"],
    verifiedScopeHosts: VERIFIED_HOSTS,
    ...overrides
  };
}

describe("Infection Monkey discover Engine Lab (GPL-3.0)", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("registers infection-monkey.discover as Engine Lab, liveSupported false", () => {
    const module = getModuleById("infection-monkey.discover");
    expect(module).not.toBeNull();
    expect(module?.manifest.liveSupported).toBe(false);
    expect(module?.manifest.license).toBe("GPL-3.0");
    expect(module?.manifest.licenseRisk).toBe("RequiresLegalReview");
    expect(module?.manifest.toolIds).toEqual(["infection-monkey"]);
    expect(module?.manifest.canModifyTarget).toBe(false);
    expect(module?.manifest.canExfiltrateData).toBe(false);
    expect(isCopyleftOptInModuleId("infection-monkey.discover")).toBe(false);
    expect(isCommunityValidationToolId("infection-monkey")).toBe(false);
    expect(ENGINE_LAB_THEATER_TOOL_IDS).toContain("infection-monkey");
  });

  it("queues a discover plan only with copyleft opt-in, qualify, and authorize", () => {
    const result = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: true,
      plugins: ["ping_scanner", "tcp_scanner"],
      qualified: true,
      startable: true,
      tenantAuthorized: true,
      verifiedScopeHosts: VERIFIED_HOSTS
    });

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.propagation).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(
      result.candidates.every((row) => row.promotion === "promote-to-scope")
    ).toBe(true);
    expect(
      result.candidates.every((row) => row.autoAddedToScope === false)
    ).toBe(true);
  });

  it("queues nothing without opt-in, qualify, or authorize", () => {
    const missingLicense = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: false,
      qualified: true,
      startable: true,
      tenantAuthorized: true,
      verifiedScopeHosts: VERIFIED_HOSTS
    });
    expect(missingLicense.jobsQueued).toBe(0);
    expect(missingLicense.denyCode).toBe("infection_monkey_license_required");

    const missingQual = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: true,
      qualified: false,
      startable: true,
      tenantAuthorized: true,
      verifiedScopeHosts: VERIFIED_HOSTS
    });
    expect(missingQual.jobsQueued).toBe(0);
    expect(missingQual.denyCode).toBe(
      "infection_monkey_qualification_required"
    );

    const missingAuth = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: true,
      qualified: true,
      startable: true,
      tenantAuthorized: false,
      verifiedScopeHosts: VERIFIED_HOSTS
    });
    expect(missingAuth.jobsQueued).toBe(0);
    expect(missingAuth.denyCode).toBe(
      "infection_monkey_authorization_required"
    );
  });

  it("default-denies Mimikatz, Zerologon, and ransomware even when gated open", () => {
    const mimikatz = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: true,
      dangerAckDigest: "a".repeat(16),
      dangerAcknowledged: true,
      plugins: ["mimikatz"],
      qualified: true,
      startable: true,
      tenantAuthorized: true,
      verifiedScopeHosts: VERIFIED_HOSTS
    });
    expect(mimikatz.jobsQueued).toBe(0);
    expect(mimikatz.credentialTheft).toBe(false);
    expect(mimikatz.denyCode).toBe("infection_monkey_credential_steal_denied");

    const zerologon = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: true,
      plugins: ["zerologon"],
      qualified: true,
      startable: true,
      tenantAuthorized: true,
      verifiedScopeHosts: VERIFIED_HOSTS
    });
    expect(zerologon.jobsQueued).toBe(0);
    expect(zerologon.denyCode).toBe("infection_monkey_exploiter_denied");

    const ransomware = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: true,
      plugins: ["ransomware"],
      qualified: true,
      startable: true,
      tenantAuthorized: true,
      verifiedScopeHosts: VERIFIED_HOSTS
    });
    expect(ransomware.jobsQueued).toBe(0);
    expect(ransomware.ransomwarePayload).toBe(false);
    expect(ransomware.denyCode).toBe("infection_monkey_ransomware_denied");
  });

  it("requires high-danger ack before even evaluating Mimikatz", () => {
    const result = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: true,
      dangerAcknowledged: false,
      plugins: ["mimikatz"],
      qualified: true,
      startable: true,
      tenantAuthorized: true,
      verifiedScopeHosts: VERIFIED_HOSTS
    });
    expect(result.jobsQueued).toBe(0);
    expect(result.denyCode).toBe("danger_acknowledgement_required");
  });

  it("does not lift deny when PERISCAN_LIVE_OFFENSIVE=1", () => {
    setLiveOffensiveEnv("1");
    const result = planInfectionMonkeyDiscoverStart({
      copyleftOptIn: true,
      liveOffensive: true,
      plugins: ["zerologon"],
      qualified: true,
      startable: true,
      tenantAuthorized: true,
      verifiedScopeHosts: VERIFIED_HOSTS
    });
    expect(result.jobsQueued).toBe(0);
    expect(result.liveSupported).toBe(false);
    expect(result.denyCode).toBe("infection_monkey_exploiter_denied");
  });

  it("keeps start constraints fail-closed without license or for live crawl", () => {
    const module = getModuleById("infection-monkey.discover");
    expect(module).toBeDefined();
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [module!.manifest],
        runnerId: randomUUID(),
        target: { verifiedScopeHosts: VERIFIED_HOSTS }
      })
    ).toMatchObject({
      allowed: false,
      code: "upstream_license_required"
    });
    expect(
      evaluateModuleStartConstraints({
        executionEnvironment: "InternalRunner",
        moduleManifests: [module!.manifest],
        runnerId: randomUUID(),
        target: {
          dryRun: false,
          ...licensedTarget()
        }
      })
    ).toMatchObject({
      allowed: false,
      code: "infection_monkey_discover_live_permanently_disabled"
    });
  });

  it("execute records a discover plan as candidates, never measured hops", async () => {
    const output = await executeModuleById(
      "infection-monkey.discover",
      createContext({
        target: licensedTarget({
          islandReport: {
            edges: [
              {
                relationship: "scanned",
                source: "lab-web.example.test",
                target: "lab-db.example.test"
              }
            ],
            nodes: [
              { id: "lab-web.example.test", name: "lab-web", type: "Host" },
              { id: "lab-db.example.test", name: "lab-db", type: "Host" }
            ]
          }
        })
      })
    );

    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("infection_monkey_discover_plan_recorded");
    expect(output.signals).toHaveLength(0);
    const attrs = output.evidence[0]?.attributes ?? {};
    expect(attrs.measured).toBe(false);
    expect(attrs.jobsQueued).toBe(1);
    expect(attrs.liveSupported).toBe(false);
    expect(attrs.importedGraphIsHypothesis).toBe(true);
    expect(attrs.autoAddedToScope).toBe(false);
    expect(JSON.stringify(output)).not.toMatch(
      /mimikatz|zerologon|ransomware/i
    );
  });
});

function qualifiedDiscoverInput(overrides: Record<string, unknown> = {}) {
  return {
    copyleftOptIn: true,
    plugins: ["ping_scanner", "tcp_scanner"],
    policyOutcome: "Allowed",
    qualified: true,
    startable: true,
    tenantAuthorized: true,
    verifiedScopeHosts: VERIFIED_HOSTS,
    ...overrides
  };
}

describe("Infection Monkey qualified discover-only queue", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("queues a discover-only plan when qualified, tenant-authorized, and policy Allowed", () => {
    const result = queueInfectionMonkeyDiscoverStart(qualifiedDiscoverInput());

    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.recorded).toBe(true);
    expect(result.denyCode).toBeNull();
    expect(result.liveSupported).toBe(false);
    expect(result.executable).toBe(false);
    expect(result.propagation).toBe(false);
    expect(result.exploitersEnabled).toBe(false);
    expect(result.credentialTheft).toBe(false);
    expect(result.ransomwarePayload).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.license.spdxLicenseId).toBe("GPL-3.0");
    expect(result.license.disposition).toBe("RequiresLegalReview");
    expect(result.license.redistributableInDefaultPack).toBe(false);
    expect(result.discoverPlan?.plugins).toEqual([
      "ping_scanner",
      "tcp_scanner"
    ]);
    expect(
      result.candidates.every((row) => row.promotion === "promote-to-scope")
    ).toBe(true);
    expect(
      result.candidates.every((row) => row.autoAddedToScope === false)
    ).toBe(true);
  });

  it("queues nothing when the start gate is not startable", () => {
    const result = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({ startable: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.discoverPlan).toBeNull();
    expect(result.denyCode).toBe(INFECTION_MONKEY_DISCOVER_NOT_STARTABLE);
  });

  it("queues nothing when the Engine Lab adapter is unqualified", () => {
    const result = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({ qualified: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe(INFECTION_MONKEY_QUALIFICATION_REQUIRED);
  });

  it("queues nothing when the tenant has not authorized the pack", () => {
    const result = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({ tenantAuthorized: false })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.denyCode).toBe(INFECTION_MONKEY_AUTHORIZATION_REQUIRED);
  });

  it("queues nothing when policy is not Allowed", () => {
    const result = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({ policyOutcome: "Denied" })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.discoverPlan).toBeNull();
    expect(result.liveSupported).toBe(false);
    expect(result.denyCode).toBe(INFECTION_MONKEY_POLICY_NOT_ALLOWED);
  });

  it("queues nothing when requested as Community default pack", () => {
    const result = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({ communityDefaultPack: true })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.communityDefaultPack).toBe(false);
    expect(result.denyCode).toBe(INFECTION_MONKEY_COMMUNITY_DEFAULT_DENIED);
  });

  it("queues nothing for live-offensive pins even when the other gates are open", () => {
    const result = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({
        liveOffensive: true,
        scenarioId: "infection-monkey.live"
      })
    );

    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.denyCode).toBe(INFECTION_MONKEY_LIVE_DISABLED);
  });

  it("still queues nothing for live-offensive when PERISCAN_LIVE_OFFENSIVE=1", () => {
    setLiveOffensiveEnv("1");
    const denied = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({ startable: false })
    );
    const livePin = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({
        liveOffensive: true,
        scenarioId: "infection-monkey.live"
      })
    );

    expect(denied.jobsQueued).toBe(0);
    expect(livePin.jobsQueued).toBe(0);
    expect(livePin.liveSupported).toBe(false);
    expect(livePin.denyCode).toBe(INFECTION_MONKEY_LIVE_DISABLED);
  });

  it("never queues ransomware or credential harvest even when gated open", () => {
    const ransomware = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({ plugins: ["ransomware"] })
    );
    const mimikatz = queueInfectionMonkeyDiscoverStart(
      qualifiedDiscoverInput({
        dangerAckDigest: "a".repeat(16),
        dangerAcknowledged: true,
        plugins: ["mimikatz"]
      })
    );

    expect(ransomware.jobsQueued).toBe(0);
    expect(ransomware.ransomwarePayload).toBe(false);
    expect(ransomware.denyCode).toBe("infection_monkey_ransomware_denied");
    expect(mimikatz.jobsQueued).toBe(0);
    expect(mimikatz.credentialTheft).toBe(false);
    expect(mimikatz.denyCode).toBe("infection_monkey_credential_steal_denied");
  });

  it("keeps infection-monkey.discover liveSupported false", () => {
    const module = getModuleById("infection-monkey.discover");
    expect(module?.manifest.liveSupported).toBe(false);
    expect(module?.manifest.licenseRisk).toBe("RequiresLegalReview");
    expect(isCopyleftOptInModuleId("infection-monkey.discover")).toBe(false);
    expect(isCommunityValidationToolId("infection-monkey")).toBe(false);
  });
});
