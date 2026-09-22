import { describe, expect, it, vi } from "vitest";

import {
  BAS_BENIGN_MARKER_SCENARIO_ID,
  LIVE_OFFENSIVE_PACK_DENY_REASONS,
  StartAtomicTestResultSchema,
  listAtomicTestCatalog
} from "@periscan/shared";

import { runAtomicTestStart } from "./bas-atomic-testing.js";

const SCOPE_ID = "11111111-1111-4111-8111-111111111111";
const POLICY_ID = "22222222-2222-4222-8222-222222222222";
const MISSION_ID = "33333333-3333-4333-8333-333333333333";
const TENANT_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";
const RUNNER_ID = "66666666-6666-4666-8666-666666666666";
const ASSET_ID = "77777777-7777-4777-8777-777777777777";
const RUN_ID = "88888888-8888-4888-8888-888888888888";

const context = {
  membership: {
    membershipId: "m1",
    role: "Owner",
    tenantId: TENANT_ID,
    userId: USER_ID
  },
  session: {
    authMethod: "password" as const,
    defaultTenantId: TENANT_ID,
    userId: USER_ID
  },
  tenant: {
    name: "Lab",
    requireMfa: false,
    tenantId: TENANT_ID,
    type: "Organization" as const
  },
  user: {
    email: "owner@periscan.test",
    mfaEnabledAt: null,
    name: "Owner",
    userId: USER_ID
  }
};

function allowedDecision() {
  return {
    approvalState: "NotRequired",
    approvedAt: null,
    approvedBy: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    executionEnvironment: "ControlPlane",
    expiresAt: "2026-09-18T00:00:00.000Z",
    missionType: "ControlValidation",
    outcome: "Allowed",
    policyDecisionId: POLICY_ID,
    rationale: "Verified scope permits ActiveNonInvasive ControlValidation.",
    requestedAction: {
      credentialTheft: false,
      destructive: false,
      persistence: false,
      realDataExfiltration: false,
      requiresInternalRunner: false,
      requiresTimeWindow: false,
      uncontrolledExploitChaining: false
    },
    safetyLevel: "ActiveNonInvasive",
    scopeId: SCOPE_ID,
    target: {},
    tenantId: TENANT_ID,
    updatedAt: "2026-09-17T00:00:00.000Z",
    userId: USER_ID
  };
}

function missionRecord() {
  return {
    completedAt: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    evidenceIds: [],
    missionId: MISSION_ID,
    missionType: "ControlValidation" as const,
    policyDecisionId: POLICY_ID,
    policyProfile: "bas-atomic-test",
    requestedBy: USER_ID,
    safetyLevel: "ActiveNonInvasive" as const,
    scopeId: SCOPE_ID,
    scopeIds: [SCOPE_ID],
    startedAt: null,
    status: "Queued" as const,
    tenantId: TENANT_ID,
    updatedAt: "2026-09-17T00:00:00.000Z"
  };
}

function benignRequest() {
  return {
    runnerId: RUNNER_ID,
    scenarioPin: {
      provider: "ControlPlane" as const,
      typedInputs: {},
      upstreamId: BAS_BENIGN_MARKER_SCENARIO_ID
    },
    scopeId: SCOPE_ID
  };
}

describe("listAtomicTestCatalog", () => {
  it("exposes one startable pin and keeps live Atomic unstartable", () => {
    const catalog = listAtomicTestCatalog();
    expect(catalog.liveSupported).toBe(false);
    expect(catalog.items.filter((item) => item.startable)).toHaveLength(1);
    expect(
      catalog.items.find((item) => item.upstreamId === "atomic.live")?.startable
    ).toBe(false);
  });
});

describe("runAtomicTestStart", () => {
  it("does not queue unqualified live Atomic against a bound runner", async () => {
    const createMission = vi.fn();
    const startMission = vi.fn();
    const result = await runAtomicTestStart({
      context: context as never,
      createMission,
      loadAsset: async () => null,
      loadRunner: async () => ({ runnerId: RUNNER_ID, status: "Active" }),
      loadScope: async () => ({
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID,
        verificationStatus: "Verified"
      }),
      previewPolicyDecision: vi.fn(async () => allowedDecision()),
      request: {
        runnerId: RUNNER_ID,
        scenarioPin: {
          provider: "AtomicRedTeam",
          typedInputs: {},
          upstreamId: "atomic.live"
        },
        scopeId: SCOPE_ID
      },
      startMission
    });

    expect(createMission).not.toHaveBeenCalled();
    expect(startMission).not.toHaveBeenCalled();
    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.liveSupported).toBe(false);
    expect(result.result).toBe("Inconclusive");
    expect(result.startable).toBe(false);
    expect(result.denyReason).toBe(LIVE_OFFENSIVE_PACK_DENY_REASONS.atomic);
    expect(StartAtomicTestResultSchema.parse(result).jobsQueued).toBe(0);
  });

  it("queues a startable ControlPlane pin bound to an active runner", async () => {
    const createMission = vi.fn(async () => missionRecord());
    const startMission = vi.fn(async () => ({
      jobsQueued: 1,
      mission: missionRecord(),
      runs: [
        {
          completedAt: null,
          createdAt: "2026-09-17T00:00:00.000Z",
          errorSummary: null,
          evidenceIds: [],
          missionId: MISSION_ID,
          moduleId: "periscan.detection_marker_emit_observe",
          outcome: null,
          policyDecisionId: POLICY_ID,
          runId: RUN_ID,
          runnerId: RUNNER_ID,
          safetyLevel: "ActiveNonInvasive",
          scopeId: SCOPE_ID,
          startedAt: null,
          status: "Queued",
          target: {},
          tenantId: TENANT_ID,
          techniqueIds: ["T1059"],
          updatedAt: "2026-09-17T00:00:00.000Z",
          validationState: null
        }
      ]
    }));

    const result = await runAtomicTestStart({
      context: context as never,
      createMission,
      loadAsset: async () => null,
      loadRunner: async () => ({ runnerId: RUNNER_ID, status: "Active" }),
      loadScope: async () => ({
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID,
        verificationStatus: "Verified"
      }),
      previewPolicyDecision: vi.fn(async () => allowedDecision()),
      request: benignRequest(),
      startMission
    });

    expect(startMission).toHaveBeenCalledOnce();
    expect(startMission.mock.calls[0]?.[2]).toMatchObject({
      runnerId: RUNNER_ID
    });
    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.liveSupported).toBe(false);
    expect(result.result).toBe("Logged");
    expect(result.startable).toBe(true);
    expect(result.boundRunnerId).toBe(RUNNER_ID);
  });

  it("does not queue High-danger catalog pins without ack, and still does not queue after ack", async () => {
    const startMission = vi.fn();
    const withoutAck = await runAtomicTestStart({
      context: context as never,
      createMission: vi.fn(),
      loadAsset: async () => ({ assetId: ASSET_ID }),
      loadRunner: async () => null,
      loadScope: async () => ({
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID,
        verificationStatus: "Verified"
      }),
      previewPolicyDecision: vi.fn(async () => allowedDecision()),
      request: {
        assetId: ASSET_ID,
        scenarioPin: {
          provider: "HighDanger",
          typedInputs: {},
          upstreamId: "exploitation.impact_t1486"
        },
        scopeId: SCOPE_ID
      },
      startMission
    });
    expect(withoutAck.jobsQueued).toBe(0);
    expect(withoutAck.denyReason).toBe("danger_acknowledgement_required");
    expect(withoutAck.result).toBe("Inconclusive");

    const withAck = await runAtomicTestStart({
      context: context as never,
      createMission: vi.fn(),
      loadAsset: async () => ({ assetId: ASSET_ID }),
      loadRunner: async () => null,
      loadScope: async () => ({
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID,
        verificationStatus: "Verified"
      }),
      previewPolicyDecision: vi.fn(async () => allowedDecision()),
      request: {
        assetId: ASSET_ID,
        dangerAckDigest: "a".repeat(16),
        dangerAcknowledged: true,
        scenarioPin: {
          provider: "HighDanger",
          typedInputs: {},
          upstreamId: "exploitation.impact_t1486"
        },
        scopeId: SCOPE_ID
      },
      startMission
    });
    expect(startMission).not.toHaveBeenCalled();
    expect(withAck.jobsQueued).toBe(0);
    expect(withAck.queued).toBe(false);
    expect(withAck.liveSupported).toBe(false);
    expect(withAck.result).toBe("Inconclusive");
    expect(withAck.denyReason).toBe("qualification_required");
  });
});
