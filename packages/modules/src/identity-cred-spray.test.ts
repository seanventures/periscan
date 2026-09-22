import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  evaluateModuleStartConstraints,
  executeModuleById,
  getModuleById,
  ModuleExecutionContextSchema
} from "./index.js";

const POLICY_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function ownedAccountTarget(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    approvalId: randomUUID(),
    auditRequired: true,
    authorizedOffensive: true,
    persistCredentials: false,
    policyDecisionId: POLICY_ID,
    purpose: "password_policy",
    rateLimitPerMinute: 4,
    scopeVerified: true,
    sprayMode: "owned_account",
    targetHost: "dc01.corp.internal",
    ownedIdentities: [
      {
        inVerifiedScope: true,
        ownership: "customer_owned",
        username: "lab-lockout-test"
      }
    ],
    ...overrides
  };
}

function startSpray(target: Record<string, unknown>) {
  const module = getModuleById("identity.cred_spray");
  expect(module).toBeDefined();
  return evaluateModuleStartConstraints({
    executionEnvironment: "InternalRunner",
    moduleManifests: [module!.manifest],
    runnerId: randomUUID(),
    target
  });
}

function createContext(target: Record<string, unknown>) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: POLICY_ID,
    runId: randomUUID(),
    runnerId: randomUUID(),
    safetyLevel: "ControlledValidation",
    scopeId: randomUUID(),
    target,
    tenantId: randomUUID()
  });
}

describe("identity.cred_spray owned-account start/execute", () => {
  afterEach(() => {
    delete process.env.PERISCAN_LIVE_OFFENSIVE;
  });

  it("starts only as an owned-account password-policy test", () => {
    expect(getModuleById("identity.cred_spray")?.manifest.liveSupported).toBe(
      false
    );
    expect(startSpray(ownedAccountTarget())).toMatchObject({
      allowed: true,
      code: null
    });
  });

  it("keeps unscoped/internet spray Forbidden with jobsQueued=0 semantics", () => {
    process.env.PERISCAN_LIVE_OFFENSIVE = "1";
    expect(
      startSpray(
        ownedAccountTarget({
          dryRun: false,
          sowId: "test-sow",
          sprayMode: "internet",
          targetHost: "login.microsoftonline.com"
        })
      )
    ).toMatchObject({
      allowed: false,
      code: "identity_cred_spray_internet_forbidden"
    });
    expect(
      startSpray(ownedAccountTarget({ ownedIdentities: [] }))
    ).toMatchObject({
      allowed: false,
      code: "identity_cred_spray_owned_identities_required"
    });
  });

  it("execute never persists credentials or sprays the internet", async () => {
    const owned = await executeModuleById(
      "identity.cred_spray",
      createContext(
        ownedAccountTarget({
          dryRun: false,
          password: "never-store-this-secret"
        })
      )
    );
    expect(owned.outcome).toBe("owned_account_password_policy_test");
    expect(owned.validationState).toBe("Inconclusive");
    expect(owned.signals).toHaveLength(0);
    expect(owned.evidence[0]?.attributes.measured).toBe(false);
    expect(owned.evidence[0]?.attributes.persistCredentials).toBe(false);
    expect(owned.evidence[0]?.attributes.liveNetexec).toBe(false);
    expect(JSON.stringify(owned.evidence)).not.toContain("never-store-this-secret");

    const internet = await executeModuleById(
      "identity.cred_spray",
      createContext({
        dryRun: false,
        password: "never-store-this-secret",
        sprayMode: "internet",
        targetHost: "login.microsoftonline.com"
      })
    );
    expect(internet.outcome).toBe("credential_spray_forbidden");
    expect(internet.validationState).toBe("Inconclusive");
    expect(JSON.stringify(internet.evidence)).not.toContain(
      "never-store-this-secret"
    );
  });
});
