import { describe, expect, it, vi } from "vitest";

import {
  enforceExecutionPolicy,
  enforceFreshPolicyEvaluation,
  enqueueWithExecutionPolicy,
  isExecutionPolicyAllowance,
  type ExecutionPolicyAllowance
} from "./policy-enforcement-point.js";

function baseScope(overrides: Record<string, unknown> = {}) {
  return {
    assetClass: "Other" as const,
    businessCriticality: "Moderate" as const,
    externalValidationProfileId: null,
    maxSafetyLevel: "BASLite" as const,
    purdueLevel: null,
    scopeId: "scope-1",
    scopeType: "Domain" as const,
    segmentName: null,
    sensitivity: "Moderate" as const,
    tags: [] as string[],
    verificationStatus: "Verified" as const,
    ...overrides
  };
}

function baseDecision(overrides: Record<string, unknown> = {}) {
  return {
    approvalState: "NotRequired" as const,
    executionEnvironment: "ControlPlane" as const,
    expiresAt: null as Date | null,
    missionType: "ExposureValidation" as const,
    outcome: "Allowed" as const,
    policyDecisionId: "pd-1",
    rationale: "ok",
    requestedAction: {
      credentialTheft: false,
      destructive: false,
      persistence: false,
      realDataExfiltration: false,
      requiresInternalRunner: false,
      requiresTimeWindow: false,
      uncontrolledExploitChaining: false
    },
    safetyLevel: "PassiveReadOnly" as const,
    scopeId: "scope-1",
    ...overrides
  };
}

function mockPrisma(tenantFlags: {
  offensive?: boolean;
  destructive?: boolean;
} = {}) {
  return {
    auditEvent: {
      create: vi.fn(async () => ({}))
    },
    tenant: {
      findUnique: vi.fn(async () => ({
        destructiveValidationEnabled: tenantFlags.destructive ?? false,
        offensiveValidationEnabled: tenantFlags.offensive ?? false
      }))
    }
  };
}

describe("enforceFreshPolicyEvaluation", () => {
  it("mints an allowance only for Allowed outcomes", () => {
    const allowed = enforceFreshPolicyEvaluation({
      entrypoint: "runner_task_create",
      outcome: "Allowed",
      policyDecisionId: "pd-allowed",
      rationale: "ok",
      tenantId: "t1"
    });
    expect(allowed.verdict).toBe("Allowed");
    expect(allowed.allowance).not.toBeNull();
    expect(isExecutionPolicyAllowance(allowed.allowance)).toBe(true);

    const denied = enforceFreshPolicyEvaluation({
      entrypoint: "runner_task_create",
      outcome: "Denied",
      policyDecisionId: "pd-denied",
      rationale: "no",
      tenantId: "t1"
    });
    expect(denied.verdict).toBe("Denied");
    expect(denied.allowance).toBeNull();

    const pending = enforceFreshPolicyEvaluation({
      entrypoint: "runner_task_create",
      outcome: "RequiresApproval",
      policyDecisionId: "pd-pending",
      rationale: "need approval",
      tenantId: "t1"
    });
    expect(pending.verdict).toBe("RequiresApproval");
    expect(pending.allowance).toBeNull();
  });
});

describe("enforceExecutionPolicy dual gate", () => {
  it("denies a Rejected stored decision without minting allowance", async () => {
    const prisma = mockPrisma();
    const result = await enforceExecutionPolicy({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      decision: baseDecision({ approvalState: "Rejected", outcome: "Allowed" }) as any,
      entrypoint: "mission_start",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scope: baseScope() as any,
      tenantId: "t1",
      userId: "u1",
      userRole: "Admin"
    });
    expect(result.verdict).toBe("Denied");
    expect(result.allowance).toBeNull();
    expect(result.storedGate).toBe("denied");
  });

  it("denies an expired authorization", async () => {
    const prisma = mockPrisma();
    const result = await enforceExecutionPolicy({
      decision: baseDecision({
        expiresAt: new Date("2000-01-01T00:00:00.000Z")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      entrypoint: "mission_start",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scope: baseScope() as any,
      tenantId: "t1",
      userId: "u1",
      userRole: "Admin"
    });
    expect(result.verdict).toBe("Denied");
    expect(result.allowance).toBeNull();
  });

  it("denies when scope is no longer verified (live gate)", async () => {
    const prisma = mockPrisma();
    const result = await enforceExecutionPolicy({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      decision: baseDecision() as any,
      entrypoint: "schedule_fire",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scope: baseScope({ verificationStatus: "Unverified" }) as any,
      tenantId: "t1",
      userId: "u1",
      userRole: "Admin"
    });
    expect(result.verdict).toBe("Denied");
    expect(result.code).toBe("verified_scope_required");
    expect(result.allowance).toBeNull();
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });

  it("returns RequiresApproval for pending RequiresApproval decisions", async () => {
    const prisma = mockPrisma();
    const result = await enforceExecutionPolicy({
      decision: baseDecision({
        approvalState: "Pending",
        outcome: "RequiresApproval",
        safetyLevel: "BASLite"
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
      entrypoint: "mission_start",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scope: baseScope() as any,
      tenantId: "t1",
      userId: "u1",
      userRole: "Analyst"
    });
    expect(result.verdict).toBe("RequiresApproval");
    expect(result.allowance).toBeNull();
  });

  it("allows a verified PassiveReadOnly Allowed decision and mints allowance", async () => {
    const prisma = mockPrisma();
    const result = await enforceExecutionPolicy({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      decision: baseDecision() as any,
      entrypoint: "mission_start",
      expected: {
        missionType: "ExposureValidation",
        safetyLevel: "PassiveReadOnly",
        scopeId: "scope-1"
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scope: baseScope() as any,
      tenantId: "t1",
      userId: "u1",
      userRole: "Admin"
    });
    expect(result.verdict).toBe("Allowed");
    expect(result.allowance).not.toBeNull();
    expect(result.allowance?.tenantId).toBe("t1");
    expect(result.allowance?.policyDecisionId).toBe("pd-1");
  });

  it("denies binding mismatch without allowance", async () => {
    const prisma = mockPrisma();
    const result = await enforceExecutionPolicy({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      decision: baseDecision() as any,
      entrypoint: "mission_start",
      expected: { scopeId: "other-scope" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prisma: prisma as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scope: baseScope() as any,
      tenantId: "t1",
      userId: "u1",
      userRole: "Admin"
    });
    expect(result.verdict).toBe("Denied");
    expect(result.code).toBe("policy_decision_scope_mismatch");
    expect(result.allowance).toBeNull();
  });
});

describe("enqueueWithExecutionPolicy — Denied never queued", () => {
  it("refuses enqueue without a valid PEP allowance", async () => {
    const enqueueValidationJob = vi.fn(async () => undefined);
    await expect(
      enqueueWithExecutionPolicy(
        { enqueueValidationJob },
        // forge without brand
        {
          entrypoint: "mission_start",
          issuedAt: new Date().toISOString(),
          policyDecisionId: "pd-x",
          tenantId: "t1"
        } as ExecutionPolicyAllowance,
        {
          jobId: "j1",
          missionId: "m1",
          runId: "r1",
          tenantId: "t1"
        }
      )
    ).rejects.toThrow(/missing or invalid execution policy allowance/);
    expect(enqueueValidationJob).not.toHaveBeenCalled();
  });

  it("refuses enqueue when tenant IDs mismatch", async () => {
    const enqueueValidationJob = vi.fn(async () => undefined);
    const pep = enforceFreshPolicyEvaluation({
      entrypoint: "mission_start",
      outcome: "Allowed",
      policyDecisionId: "pd-1",
      rationale: "ok",
      tenantId: "tenant-a"
    });
    await expect(
      enqueueWithExecutionPolicy(
        { enqueueValidationJob },
        pep.allowance!,
        {
          jobId: "j1",
          missionId: "m1",
          runId: "r1",
          tenantId: "tenant-b"
        }
      )
    ).rejects.toThrow(/tenant does not match/);
    expect(enqueueValidationJob).not.toHaveBeenCalled();
  });

  it("enqueues only when PEP allowance is present and tenants match", async () => {
    const enqueueValidationJob = vi.fn(async () => undefined);
    const pep = enforceFreshPolicyEvaluation({
      entrypoint: "fix_verification",
      outcome: "Allowed",
      policyDecisionId: "pd-1",
      rationale: "ok",
      tenantId: "tenant-a"
    });
    await enqueueWithExecutionPolicy(
      { enqueueValidationJob },
      pep.allowance!,
      {
        jobId: "j1",
        missionId: "m1",
        runId: "r1",
        tenantId: "tenant-a"
      }
    );
    expect(enqueueValidationJob).toHaveBeenCalledOnce();
  });

  it("Denied fresh evaluation never yields an enqueueable allowance", () => {
    const denied = enforceFreshPolicyEvaluation({
      entrypoint: "schedule_fire",
      outcome: "Denied",
      policyDecisionId: "pd-denied",
      rationale: "tenant policy denies",
      tenantId: "t1"
    });
    expect(denied.allowance).toBeNull();
    // Type-level: callers cannot pass null to enqueueWithExecutionPolicy
    // without a cast; runtime guard also rejects non-branded objects.
  });
});
