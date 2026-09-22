import { describe, expect, it, vi } from "vitest";

import { StartBasScenarioResultSchema } from "@periscan/shared";

import type { AppServiceError } from "../runtime-services.js";
import { runBasScenarioStart } from "./bas-control-plane.js";

const SCOPE_ID = "11111111-1111-4111-8111-111111111111";
const POLICY_ID = "22222222-2222-4222-8222-222222222222";
const MISSION_ID = "33333333-3333-4333-8333-333333333333";
const TENANT_ID = "44444444-4444-4444-8444-444444444444";
const USER_ID = "55555555-5555-4555-8555-555555555555";

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

function deniedDecision(overrides: Record<string, unknown> = {}) {
  return {
    approvalState: "Rejected",
    approvedAt: null,
    approvedBy: null,
    createdAt: "2026-09-17T00:00:00.000Z",
    executionEnvironment: "ControlPlane",
    expiresAt: "2026-09-18T00:00:00.000Z",
    missionType: "ControlValidation",
    outcome: "Denied",
    policyDecisionId: POLICY_ID,
    rationale:
      "Atomic adapter qualification is required before live execution. Denied tasks are never queued.",
    requestedAction: {
      credentialTheft: false,
      destructive: false,
      persistence: false,
      realDataExfiltration: false,
      requiresInternalRunner: false,
      requiresTimeWindow: false,
      uncontrolledExploitChaining: false
    },
    safetyLevel: "BASLite",
    scopeId: SCOPE_ID,
    target: {},
    tenantId: TENANT_ID,
    updatedAt: "2026-09-17T00:00:00.000Z",
    userId: USER_ID,
    ...overrides
  };
}

function allowedDecision() {
  return {
    ...deniedDecision({
      approvalState: "NotRequired",
      outcome: "Allowed",
      rationale: "Verified scope permits ActiveNonInvasive ControlValidation.",
      safetyLevel: "ActiveNonInvasive"
    })
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
    policyProfile: "bas-control-plane",
    requestedBy: USER_ID,
    safetyLevel: "ActiveNonInvasive" as const,
    scopeId: SCOPE_ID,
    scopeIds: [SCOPE_ID],
    startedAt: null,
    status: "Draft" as const,
    tenantId: TENANT_ID,
    updatedAt: "2026-09-17T00:00:00.000Z"
  };
}

describe("runBasScenarioStart", () => {
  it("does not queue live Atomic even if a stale Allowed decision is returned", async () => {
    const previewPolicyDecision = vi.fn(async () => allowedDecision());
    const createMission = vi.fn();
    const startMission = vi.fn();

    const result = await runBasScenarioStart({
      context: context as never,
      createMission,
      loadScope: async () => ({
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID,
        verificationStatus: "Verified"
      }),
      previewPolicyDecision,
      request: { scenarioId: "atomic.live", scopeId: SCOPE_ID },
      startMission
    });

    expect(previewPolicyDecision).toHaveBeenCalledOnce();
    expect(previewPolicyDecision.mock.calls[0]?.[2]).toMatchObject({
      missionType: "ControlValidation",
      target: expect.objectContaining({
        livePack: "atomic",
        scenarioId: "atomic.live"
      })
    });
    expect(createMission).not.toHaveBeenCalled();
    expect(startMission).not.toHaveBeenCalled();
    expect(result.jobsQueued).toBe(0);
    expect(result.queued).toBe(false);
    expect(result.outcome).toBe("Denied");
    expect(result.policyDecisionId).toBe(POLICY_ID);
    expect(result.denyReason).toMatch(/Atomic adapter qualification/i);
    expect(result.denyReason).toMatch(/never queued/i);
    expect(StartBasScenarioResultSchema.parse(result).queued).toBe(false);
  });

  it("does not queue when policy mints Denied for live Atomic", async () => {
    const startMission = vi.fn();
    const result = await runBasScenarioStart({
      context: context as never,
      createMission: vi.fn(),
      loadScope: async () => ({
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID,
        verificationStatus: "Verified"
      }),
      previewPolicyDecision: vi.fn(async () => deniedDecision()),
      request: { scenarioId: "atomic.live", scopeId: SCOPE_ID },
      startMission
    });

    expect(startMission).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      claimClass: "qualification_required",
      jobsQueued: 0,
      queued: false,
      outcome: "Denied"
    });
  });

  it("queues a benign_marker_only ControlValidation after an Allowed decision", async () => {
    const previewPolicyDecision = vi.fn(async () => allowedDecision());
    const createMission = vi.fn(async () => missionRecord());
    const startMission = vi.fn(async () => ({
      jobsQueued: 1,
      mission: { ...missionRecord(), status: "Queued" as const },
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
          runId: "66666666-6666-4666-8666-666666666666",
          runnerId: null,
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

    const result = await runBasScenarioStart({
      context: context as never,
      createMission,
      loadScope: async () => ({
        scopeId: SCOPE_ID,
        tenantId: TENANT_ID,
        verificationStatus: "Verified"
      }),
      previewPolicyDecision,
      request: {
        scenarioId: "control.detection.benign-marker",
        scopeId: SCOPE_ID
      },
      startMission
    });

    expect(createMission).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        missionType: "ControlValidation",
        policyDecisionId: POLICY_ID,
        scopeId: SCOPE_ID
      })
    );
    expect(startMission).toHaveBeenCalledWith(
      context,
      MISSION_ID,
      expect.objectContaining({
        moduleIds: ["periscan.detection_marker_emit_observe"]
      })
    );
    expect(result.jobsQueued).toBe(1);
    expect(result.queued).toBe(true);
    expect(result.claimClass).toBe("benign_marker_only");
    expect(result.outcome).toBe("Allowed");
    expect(result.denyReason).toBeNull();
    expect(StartBasScenarioResultSchema.parse(result).jobsQueued).toBe(1);
  });

  it("never queues when startMission is not allowed to run for Caldera/Metasploit", async () => {
    const startMission = vi.fn();
    for (const scenarioId of ["caldera.live", "metasploit.live"] as const) {
      startMission.mockClear();
      const result = await runBasScenarioStart({
        context: context as never,
        createMission: vi.fn(),
        loadScope: async () => ({
          scopeId: SCOPE_ID,
          tenantId: TENANT_ID,
          verificationStatus: "Verified"
        }),
        previewPolicyDecision: vi.fn(async () =>
          deniedDecision({
            rationale: `Live ${scenarioId.split(".")[0]} execution is denied. Denied tasks are never queued.`
          })
        ),
        request: { scenarioId, scopeId: SCOPE_ID },
        startMission
      });
      expect(startMission).not.toHaveBeenCalled();
      expect(result.jobsQueued).toBe(0);
      expect(result.queued).toBe(false);
    }
  });

  it("fails closed when the scope is missing", async () => {
    await expect(
      runBasScenarioStart({
        context: context as never,
        createMission: vi.fn(),
        loadScope: async () => null,
        previewPolicyDecision: vi.fn(),
        request: {
          scenarioId: "control.detection.benign-marker",
          scopeId: SCOPE_ID
        },
        startMission: vi.fn()
      })
    ).rejects.toMatchObject({
      code: "scope_not_found",
      statusCode: 404
    } satisfies Partial<AppServiceError>);
  });
});
