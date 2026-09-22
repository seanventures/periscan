import { describe, expect, it } from "vitest";

import {
  BAS_BENIGN_MARKER_MODULE_ID,
  BAS_BENIGN_MARKER_SCENARIO_ID,
  LIVE_OFFENSIVE_PACK_DENY_REASONS
} from "./bas-control-plane.js";
import {
  AtomicTestCatalogSchema,
  StartAtomicTestInputSchema,
  StartAtomicTestResultSchema,
  atomicTestImmediateResult,
  evaluateAtomicTestStartability,
  listAtomicTestCatalog,
  listAtomicTestsFromInjects
} from "./atomic-testing.js";
import {
  BAS_INJECT_COPY_FORBIDDEN,
  BasInjectSchema,
  type BasInject
} from "./bas-inject.js";

const SCOPE_ID = "22222222-2222-4222-8222-222222222222";
const RUNNER_ID = "33333333-3333-4333-8333-333333333333";
const ASSET_ID = "44444444-4444-4444-8444-444444444444";
const POLICY_ID = "55555555-5555-4555-8555-555555555555";

const benignPin = {
  provider: "ControlPlane" as const,
  upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID,
  typedInputs: {}
};

const atomicPin = {
  provider: "AtomicRedTeam" as const,
  upstreamId: "atomic.live",
  typedInputs: {}
};

const dangerPin = {
  provider: "HighDanger" as const,
  upstreamId: "exploitation.impact_t1486",
  typedInputs: {}
};

describe("atomic testing catalog", () => {
  it("lists startable ControlPlane pins and keeps live Atomic unstartable", () => {
    const catalog = AtomicTestCatalogSchema.parse(listAtomicTestCatalog());
    expect(catalog.liveSupported).toBe(false);

    const qualified = catalog.items.filter((item) => item.startable);
    expect(qualified.map((item) => item.upstreamId)).toEqual([
      BAS_BENIGN_MARKER_SCENARIO_ID
    ]);
    expect(qualified.every((item) => item.section === "Qualified")).toBe(true);

    const atomic = catalog.items.find(
      (item) => item.upstreamId === "atomic.live"
    );
    expect(atomic).toMatchObject({
      livePack: "atomic",
      section: "Qualification required",
      startable: false
    });
    expect(atomic?.denyReason).toBe(LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic);

    const caldera = catalog.items.find(
      (item) => item.upstreamId === "caldera.live"
    );
    const metasploit = catalog.items.find(
      (item) => item.upstreamId === "metasploit.live"
    );
    expect(caldera?.startable).toBe(false);
    expect(metasploit?.startable).toBe(false);
  });

  it("keeps T1486, spray, harvest, and kill-chain in the High danger section", () => {
    const catalog = listAtomicTestCatalog();
    const danger = catalog.items.filter(
      (item) => item.section === "High danger"
    );
    expect(danger.map((item) => item.upstreamId)).toEqual(
      expect.arrayContaining([
        "exploitation.impact_t1486",
        "exploitation.killchain.engine",
        "identity.cred_spray",
        "identity.credential_harvest"
      ])
    );
    expect(danger.every((item) => item.startable === false)).toBe(true);
    expect(danger.every((item) => item.dangerClass != null)).toBe(true);
  });
});

describe("StartAtomicTestInputSchema", () => {
  it("requires a scenario pin, scope, and a bound asset or runner", () => {
    expect(
      StartAtomicTestInputSchema.safeParse({
        scenarioPin: benignPin,
        scopeId: SCOPE_ID,
        runnerId: RUNNER_ID
      }).success
    ).toBe(true);
    expect(
      StartAtomicTestInputSchema.safeParse({
        scenarioPin: benignPin,
        scopeId: SCOPE_ID,
        assetId: ASSET_ID
      }).success
    ).toBe(true);
    expect(
      StartAtomicTestInputSchema.safeParse({
        scenarioPin: benignPin,
        scopeId: SCOPE_ID
      }).success
    ).toBe(false);
    expect(
      StartAtomicTestInputSchema.safeParse({
        liveSupported: true,
        scenarioPin: benignPin,
        scopeId: SCOPE_ID,
        runnerId: RUNNER_ID
      }).success
    ).toBe(false);
  });
});

describe("evaluateAtomicTestStartability", () => {
  it("allows a verified-scope ControlPlane pin bound to an active runner", () => {
    expect(
      evaluateAtomicTestStartability({
        hasBoundTarget: true,
        pin: benignPin,
        runnerStatus: "Active",
        scopeVerified: true
      })
    ).toEqual({
      dangerClass: null,
      denyReason: null,
      livePack: "none",
      section: "Qualified",
      startable: true
    });
  });

  it("does not start unqualified live Atomic and never implies a queue", () => {
    const result = evaluateAtomicTestStartability({
      hasBoundTarget: true,
      pin: atomicPin,
      runnerStatus: "Active",
      scopeVerified: true
    });
    expect(result.startable).toBe(false);
    expect(result.section).toBe("Qualification required");
    expect(result.livePack).toBe("atomic");
    expect(result.denyReason).toBe(LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic);
  });

  it("requires High-danger acknowledgement before a danger catalog pin can pass the gate", () => {
    const withoutAck = evaluateAtomicTestStartability({
      hasBoundTarget: true,
      pin: dangerPin,
      runnerStatus: "Active",
      scopeVerified: true
    });
    expect(withoutAck).toMatchObject({
      dangerClass: "ransomware_impact",
      denyReason: "danger_acknowledgement_required",
      section: "High danger",
      startable: false
    });

    const withAck = evaluateAtomicTestStartability({
      dangerAckDigest: "a".repeat(16),
      dangerAcknowledged: true,
      hasBoundTarget: true,
      pin: dangerPin,
      policyAllowed: true,
      runnerStatus: "Active",
      scopeVerified: true,
      tenantAuthorized: true
    });
    expect(withAck.startable).toBe(false);
    expect(withAck.denyReason).toBe("qualification_required");
    expect(withAck.section).toBe("High danger");
  });

  it("fails closed without a bound runner/asset or verified scope", () => {
    expect(
      evaluateAtomicTestStartability({
        hasBoundTarget: false,
        pin: benignPin,
        runnerStatus: null,
        scopeVerified: true
      }).startable
    ).toBe(false);
    expect(
      evaluateAtomicTestStartability({
        hasBoundTarget: true,
        pin: benignPin,
        runnerStatus: "Revoked",
        scopeVerified: true
      }).startable
    ).toBe(false);
    expect(
      evaluateAtomicTestStartability({
        hasBoundTarget: true,
        pin: benignPin,
        runnerStatus: "Active",
        scopeVerified: false
      }).startable
    ).toBe(false);
  });
});

describe("atomicTestImmediateResult", () => {
  it("maps denied or unqueued starts to Inconclusive", () => {
    expect(
      atomicTestImmediateResult({
        jobsQueued: 0,
        outcome: "Denied",
        queued: false,
        startable: false
      })
    ).toBe("Inconclusive");
  });

  it("maps a queued Allowed start without observation to Logged", () => {
    expect(
      atomicTestImmediateResult({
        jobsQueued: 1,
        outcome: "Allowed",
        queued: true,
        startable: true
      })
    ).toBe("Logged");
  });

  it("maps observed Prevented and Validated outcomes", () => {
    expect(
      atomicTestImmediateResult({
        jobsQueued: 1,
        observedOutcome: "Prevented",
        outcome: "Allowed",
        queued: true,
        startable: true
      })
    ).toBe("Prevented");
    expect(
      atomicTestImmediateResult({
        jobsQueued: 1,
        observedOutcome: "Detected",
        outcome: "Allowed",
        queued: true,
        startable: true
      })
    ).toBe("Validated");
  });
});

describe("listAtomicTestsFromInjects", () => {
  const SHA = "a".repeat(64);
  const ASSET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  function injectForPin(overrides: {
    moduleId: string;
    provider: "ControlPlane" | "AtomicRedTeam" | "Caldera";
    stepKey: string;
    upstreamId: string;
  }): BasInject {
    return BasInjectSchema.parse({
      actionRef: {
        moduleId: overrides.moduleId,
        pin: {
          contentSha256: SHA,
          provider: overrides.provider,
          typedInputs: {},
          upstreamId: overrides.upstreamId
        }
      },
      dependsOn: [],
      expectedObservation: "logged",
      kind: "technical",
      scheduledAt: "2026-09-17T14:00:00.000Z",
      stepKey: overrides.stepKey,
      targetRef: { assetId: ASSET_ID, kind: "asset" }
    });
  }

  it("lists imported Injects as atomic tests without flipping liveSupported", () => {
    const catalog = AtomicTestCatalogSchema.parse(
      listAtomicTestsFromInjects([
        injectForPin({
          moduleId: BAS_BENIGN_MARKER_MODULE_ID,
          provider: "ControlPlane",
          stepKey: "marker",
          upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
        }),
        injectForPin({
          moduleId: "atomic.control_validation_safe",
          provider: "AtomicRedTeam",
          stepKey: "atomic",
          upstreamId: "atomic.live"
        }),
        injectForPin({
          moduleId: "imported.scenario.hostname",
          provider: "ControlPlane",
          stepKey: "imported",
          upstreamId: "imported.scenario.hostname"
        })
      ])
    );

    expect(catalog.liveSupported).toBe(false);

    const marker = catalog.items.find(
      (item) => item.upstreamId === BAS_BENIGN_MARKER_SCENARIO_ID
    );
    expect(marker).toMatchObject({
      section: "Qualified",
      startable: true
    });

    const atomic = catalog.items.find(
      (item) => item.upstreamId === "atomic.live"
    );
    expect(atomic).toMatchObject({
      livePack: "atomic",
      section: "Qualification required",
      startable: false
    });

    const imported = catalog.items.find(
      (item) => item.upstreamId === "imported.scenario.hostname"
    );
    expect(imported).toMatchObject({
      section: "Qualification required",
      startable: false
    });
    expect(imported?.denyReason).toMatch(/imported|qualified/i);
    for (const item of catalog.items) {
      for (const forbidden of BAS_INJECT_COPY_FORBIDDEN) {
        expect(item.title).not.toMatch(new RegExp(forbidden, "i"));
        expect(item.description).not.toMatch(new RegExp(forbidden, "i"));
        if (item.denyReason) {
          expect(item.denyReason).not.toMatch(new RegExp(forbidden, "i"));
        }
      }
    }
  });
});

describe("StartAtomicTestResultSchema", () => {
  it("rejects liveSupported flips and denied queues", () => {
    const denied = {
      boundAssetId: null,
      boundRunnerId: RUNNER_ID,
      claimClass: "qualification_required",
      denyReason: LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic,
      jobsQueued: 0,
      liveSupported: false,
      mission: null,
      outcome: "Denied",
      policyDecisionId: POLICY_ID,
      queued: false,
      rationale: LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic,
      result: "Inconclusive",
      runs: [],
      scenarioPin: atomicPin,
      startable: false
    };
    expect(StartAtomicTestResultSchema.parse(denied).jobsQueued).toBe(0);
    expect(
      StartAtomicTestResultSchema.safeParse({
        ...denied,
        liveSupported: true
      }).success
    ).toBe(false);
    expect(
      StartAtomicTestResultSchema.safeParse({
        ...denied,
        jobsQueued: 1,
        queued: true
      }).success
    ).toBe(false);
  });
});
