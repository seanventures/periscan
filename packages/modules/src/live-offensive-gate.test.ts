import { randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  evaluateModuleStartConstraints,
  executeModuleById,
  getModuleById,
  ModuleExecutionContextSchema
} from "./index.js";

const LIVE_OFFENSIVE_ENV = "PERISCAN_LIVE_OFFENSIVE";
const TEST_SOW_ID = "test-sow";

function setLiveOffensiveEnv(value: string | undefined) {
  if (value === undefined) {
    delete process.env[LIVE_OFFENSIVE_ENV];
    return;
  }
  process.env[LIVE_OFFENSIVE_ENV] = value;
}

function startConstraints(
  moduleId: string,
  target: Record<string, unknown>
) {
  const module = getModuleById(moduleId);
  expect(module).toBeDefined();
  return evaluateModuleStartConstraints({
    executionEnvironment:
      module!.manifest.executionMode === "InternalRunner"
        ? "InternalRunner"
        : "ControlPlane",
    moduleManifests: [module!.manifest],
    runnerId:
      module!.manifest.executionMode === "InternalRunner"
        ? randomUUID()
        : null,
    target
  });
}

function createContext(overrides: Record<string, unknown> = {}) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: null,
    runId: randomUUID(),
    runnerId: null,
    safetyLevel: "BASLite",
    scopeId: randomUUID(),
    target: {},
    tenantId: randomUUID(),
    ...overrides
  });
}

describe("live-offensive triple-gate (PERISCAN-460)", () => {
  beforeEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  afterEach(() => {
    setLiveOffensiveEnv(undefined);
  });

  it("denies Atomic live when PERISCAN_LIVE_OFFENSIVE is unset", () => {
    expect(
      startConstraints("atomic.control_validation_safe", {
        dryRun: false,
        sowId: TEST_SOW_ID
      })
    ).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled"
    });
  });

  it("denies Atomic live when env is set but sowId is missing", () => {
    setLiveOffensiveEnv("1");
    expect(
      startConstraints("atomic.control_validation_safe", {
        dryRun: false
      })
    ).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled"
    });
  });

  it("denies Atomic live when env is set but sowId is empty", () => {
    setLiveOffensiveEnv("1");
    expect(
      startConstraints("atomic.control_validation_safe", {
        dryRun: false,
        sowId: ""
      })
    ).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled"
    });
  });

  it("denies Atomic live when env is not exactly 1", () => {
    setLiveOffensiveEnv("true");
    expect(
      startConstraints("atomic.control_validation_safe", {
        dryRun: false,
        sowId: TEST_SOW_ID
      })
    ).toMatchObject({
      allowed: false,
      code: "atomic_live_disabled"
    });
  });

  it("allows Atomic start only when env=1, sowId=test-sow, and dryRun=false", () => {
    setLiveOffensiveEnv("1");
    expect(
      startConstraints("atomic.control_validation_safe", {
        dryRun: false,
        sowId: TEST_SOW_ID
      })
    ).toMatchObject({
      allowed: true
    });
  });

  it("still allows Atomic dry-run import without the live-offensive env", () => {
    expect(
      startConstraints("atomic.control_validation_safe", {
        dryRun: true
      })
    ).toMatchObject({ allowed: true });
  });

  it("does not execute Atomic techniques even when the start gate is open", async () => {
    setLiveOffensiveEnv("1");
    const output = await executeModuleById(
      "atomic.control_validation_safe",
      createContext({
        safetyLevel: "BASLite",
        target: {
          controlSourceId: randomUUID(),
          dryRun: false,
          sowId: TEST_SOW_ID,
          techniqueId: "T1595"
        }
      })
    );

    expect(output.outcome).toBe("live_execution_disabled");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.signals).toHaveLength(0);
  });

  it("denies Caldera live when the triple-gate is closed", () => {
    expect(
      startConstraints("caldera.advanced_adversarial", {
        approvalId: randomUUID(),
        authorizedOffensive: true,
        dryRun: false,
        scopeVerified: true
      })
    ).toMatchObject({
      allowed: false,
      code: "caldera_live_disabled"
    });
  });

  it("denies Caldera live even when env and sowId are set", () => {
    setLiveOffensiveEnv("1");
    expect(
      startConstraints("caldera.advanced_adversarial", {
        approvalId: randomUUID(),
        authorizedOffensive: true,
        dryRun: false,
        scopeVerified: true,
        sowId: TEST_SOW_ID
      })
    ).toMatchObject({
      allowed: false,
      code: "caldera_live_disabled"
    });
  });

  it("keeps SharpHound collectorExecution denied under the triple-gate", () => {
    setLiveOffensiveEnv("1");
    expect(
      startConstraints("bloodhound.identity_pathing", {
        collectorExecution: true,
        dryRun: false,
        sowId: TEST_SOW_ID
      })
    ).toMatchObject({
      allowed: false,
      code: "sharphound_collector_legal_review_blocked"
    });
  });

  it("keeps Metasploit live denied under the triple-gate (no payload)", () => {
    setLiveOffensiveEnv("1");
    expect(
      startConstraints("exploit.metasploit_check", {
        approvalId: randomUUID(),
        authorizedDestructive: true,
        authorizedOffensive: true,
        dryRun: false,
        scopeVerified: true,
        sowId: TEST_SOW_ID
      })
    ).toMatchObject({
      allowed: false,
      code: "exploit_metasploit_check_live_permanently_disabled"
    });
  });
});
