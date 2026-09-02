/**
 * Policy Enforcement Point (PEP) — P03-20
 *
 * Single chokepoint for execution-authorization decisions before validation work
 * may be queued or a runner task may be accepted.
 *
 * SECURITY INVARIANT: Denied work must never be queued. Callers obtain an
 * opaque {@link ExecutionPolicyAllowance} only when the dual gate returns
 * Allowed; {@link enqueueWithExecutionPolicy} refuses to enqueue without it.
 *
 * Dual gate (same as historical mission-start behavior):
 *  1. Stored decision gate — approvalState, outcome, expiresAt
 *  2. Live re-evaluation — scope still Verified + evaluatePolicy against current
 *     tenant flips / scope ceiling (prior admin approval honored)
 *
 * Entrypoints that must call this PEP before queue / dispatch:
 *  - mission_start (startMission)
 *  - schedule_fire (runSchedule / due sweep)
 *  - hop_launch (path edge validation — via startMission after preview)
 *  - fix_verification (remediation retest queue)
 *  - runner_task_create / runner_task_accept
 *  - stimulus_dispatch
 *
 * See docs/residuals/P03-20-pep-interceptor-honesty.md for residual honesty.
 */

import { evaluatePolicy } from "@periscan/policy";
import type { Membership, PolicyDecision, Prisma, Scope } from "@prisma/client";

import type { MissionQueue } from "./mission-queue.js";
import {
  evaluatePolicyDecisionGate,
  loadDestructiveValidationAuthorized,
  loadOffensiveValidationAuthorized,
  writeAuditEvent
} from "./runtime-services.js";
import {
  PolicyRequestedActionSchema,
  type ValidationJobPayload
} from "@periscan/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExecutionEntrypoint =
  | "mission_start"
  | "schedule_fire"
  | "hop_launch"
  | "fix_verification"
  | "runner_task_create"
  | "runner_task_accept"
  | "stimulus_dispatch"
  | "snapshot_bind";

export type PepVerdict = "Allowed" | "RequiresApproval" | "Denied";

/**
 * Opaque allow-token. Only {@link enforceExecutionPolicy} /
 * {@link enforceFreshPolicyEvaluation} may mint these. Queue producers must
 * pass the token to {@link enqueueWithExecutionPolicy}.
 */
export interface ExecutionPolicyAllowance {
  readonly __pepAllowance: true;
  readonly entrypoint: ExecutionEntrypoint;
  readonly issuedAt: string;
  readonly policyDecisionId: string;
  readonly tenantId: string;
}

export interface EnforceExecutionPolicyInput {
  /** When true (default), emit audit events for deny/pending live rechecks. */
  audit?: boolean;
  decision: Pick<
    PolicyDecision,
    | "approvalState"
    | "executionEnvironment"
    | "expiresAt"
    | "missionType"
    | "outcome"
    | "policyDecisionId"
    | "requestedAction"
    | "safetyLevel"
    | "scopeId"
  > & {
    rationale?: string | null;
  };
  entrypoint: ExecutionEntrypoint;
  /**
   * Optional binding expectations (mission/schedule). Mismatch → Denied with a
   * binding code (never queues).
   */
  expected?: {
    missionType?: string;
    safetyLevel?: string;
    scopeId?: string;
  };
  missionId?: string | null;
  prisma: Prisma.TransactionClient | {
    auditEvent: { create: (args: unknown) => Promise<unknown> };
    tenantSetting?: unknown;
  };
  scope: Pick<
    Scope,
    | "assetClass"
    | "businessCriticality"
    | "externalValidationProfileId"
    | "maxSafetyLevel"
    | "purdueLevel"
    | "scopeId"
    | "scopeType"
    | "segmentName"
    | "sensitivity"
    | "tags"
    | "verificationStatus"
  >;
  tenantId: string;
  userId: string | null;
  userRole: Membership["role"];
}

export interface EnforceExecutionPolicyResult {
  allowance: ExecutionPolicyAllowance | null;
  code: string;
  liveOutcome: string | null;
  liveRationale: string | null;
  /** Stored-decision gate result before live recheck. */
  storedGate: "start" | "pending" | "denied";
  verdict: PepVerdict;
}

export interface FreshPolicyEvaluationInput {
  entrypoint: ExecutionEntrypoint;
  outcome: PolicyDecision["outcome"];
  policyDecisionId: string;
  rationale: string;
  tenantId: string;
}

// ---------------------------------------------------------------------------
// Allowance minting (private constructor pattern)
// ---------------------------------------------------------------------------

function mintAllowance(input: {
  entrypoint: ExecutionEntrypoint;
  policyDecisionId: string;
  tenantId: string;
}): ExecutionPolicyAllowance {
  return {
    __pepAllowance: true,
    entrypoint: input.entrypoint,
    issuedAt: new Date().toISOString(),
    policyDecisionId: input.policyDecisionId,
    tenantId: input.tenantId
  };
}

export function isExecutionPolicyAllowance(
  value: unknown
): value is ExecutionPolicyAllowance {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as ExecutionPolicyAllowance).__pepAllowance === true &&
    typeof (value as ExecutionPolicyAllowance).policyDecisionId === "string" &&
    typeof (value as ExecutionPolicyAllowance).tenantId === "string"
  );
}

// ---------------------------------------------------------------------------
// Fresh evaluation path (runner task create, fix-verification module eval)
// ---------------------------------------------------------------------------

/**
 * Convert a just-evaluated policy outcome into a PEP verdict + optional
 * allowance. Use when no stored decision recheck is needed (or recheck already
 * happened via evaluatePolicy). Denied / non-Allowed never mints an allowance.
 */
export function enforceFreshPolicyEvaluation(
  input: FreshPolicyEvaluationInput
): EnforceExecutionPolicyResult {
  if (input.outcome === "Allowed") {
    return {
      allowance: mintAllowance({
        entrypoint: input.entrypoint,
        policyDecisionId: input.policyDecisionId,
        tenantId: input.tenantId
      }),
      code: "pep_allowed",
      liveOutcome: input.outcome,
      liveRationale: input.rationale,
      storedGate: "start",
      verdict: "Allowed"
    };
  }

  if (input.outcome === "RequiresApproval") {
    return {
      allowance: null,
      code: "pep_requires_approval",
      liveOutcome: input.outcome,
      liveRationale: input.rationale,
      storedGate: "pending",
      verdict: "RequiresApproval"
    };
  }

  return {
    allowance: null,
    code: "pep_denied",
    liveOutcome: input.outcome,
    liveRationale: input.rationale,
    storedGate: "denied",
    verdict: "Denied"
  };
}

// ---------------------------------------------------------------------------
// Dual-gate enforcement (mission start, schedule fire, stimulus, hop)
// ---------------------------------------------------------------------------

/**
 * Dual-gate policy enforcement. Fail-closed: any binding mismatch, expired
 * decision, rejection, unverified scope, or live deny → Denied / no allowance.
 */
export async function enforceExecutionPolicy(
  input: EnforceExecutionPolicyInput
): Promise<EnforceExecutionPolicyResult> {
  const {
    decision,
    entrypoint,
    expected,
    missionId = null,
    prisma,
    scope,
    tenantId,
    userId,
    userRole
  } = input;
  const shouldAudit = input.audit !== false;

  // --- Binding checks (fail closed) ---
  if (expected?.scopeId && decision.scopeId !== expected.scopeId) {
    return denyResult({
      code: "policy_decision_scope_mismatch",
      liveOutcome: null,
      liveRationale:
        "Policy decision scope no longer matches the execution request.",
      storedGate: "denied"
    });
  }
  if (expected?.missionType && decision.missionType !== expected.missionType) {
    return denyResult({
      code: "policy_decision_mission_type_mismatch",
      liveOutcome: null,
      liveRationale:
        "Policy decision mission type no longer matches the execution request.",
      storedGate: "denied"
    });
  }
  if (expected?.safetyLevel && decision.safetyLevel !== expected.safetyLevel) {
    return denyResult({
      code: "policy_decision_safety_level_mismatch",
      liveOutcome: null,
      liveRationale:
        "Policy decision safety level no longer matches the execution request.",
      storedGate: "denied"
    });
  }

  // --- Gate 1: stored decision ---
  const storedGate = evaluatePolicyDecisionGate(decision);

  if (storedGate === "pending") {
    return {
      allowance: null,
      code: "policy_requires_approval",
      liveOutcome: decision.outcome,
      liveRationale: decision.rationale ?? "Policy decision requires approval.",
      storedGate,
      verdict: "RequiresApproval"
    };
  }

  if (storedGate === "denied") {
    return denyResult({
      code: "policy_decision_denied",
      liveOutcome: decision.outcome,
      liveRationale:
        decision.rationale ??
        "Policy decision is denied, rejected, or expired.",
      storedGate
    });
  }

  // --- Gate 2a: scope still verified ---
  if (scope.verificationStatus !== "Verified") {
    if (shouldAudit) {
      await writeAuditEvent(prisma as Parameters<typeof writeAuditEvent>[0], {
        action: "policy.decision",
        actorType: "System",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          code: "verified_scope_required",
          entrypoint,
          missionId,
          outcome: "RequiresVerifiedScope",
          rationale:
            "Execution requires the bound scope to remain verified; the stored policy decision is not sufficient once verification is revoked.",
          scopeId: scope.scopeId,
          scopeVerificationStatus: scope.verificationStatus,
          startGateRecheck: true
        },
        tenantId,
        userId
      });
    }
    return denyResult({
      code: "verified_scope_required",
      liveOutcome: "RequiresVerifiedScope",
      liveRationale:
        "Execution requires the bound scope to remain verified.",
      storedGate
    });
  }

  // --- Gate 2b: live evaluatePolicy recheck ---
  let requestedAction;
  try {
    requestedAction = PolicyRequestedActionSchema.parse(decision.requestedAction);
  } catch {
    if (shouldAudit) {
      await writeAuditEvent(prisma as Parameters<typeof writeAuditEvent>[0], {
        action: "policy.decision",
        actorType: "System",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          code: "policy_requested_action_invalid",
          entrypoint,
          missionId,
          outcome: "Denied",
          rationale:
            "Stored policy decision requestedAction is invalid; fail closed and do not queue.",
          scopeId: scope.scopeId,
          startGateRecheck: true
        },
        tenantId,
        userId
      });
    }
    return denyResult({
      code: "policy_requested_action_invalid",
      liveOutcome: "Denied",
      liveRationale:
        "Stored policy decision requestedAction is invalid; fail closed.",
      storedGate
    });
  }

  const priorApprovalGranted = decision.approvalState === "Approved";
  const [offensiveValidationAuthorized, destructiveValidationAuthorized] =
    await Promise.all([
      loadOffensiveValidationAuthorized(
        prisma as Parameters<typeof loadOffensiveValidationAuthorized>[0],
        tenantId
      ),
      loadDestructiveValidationAuthorized(
        prisma as Parameters<typeof loadDestructiveValidationAuthorized>[0],
        tenantId
      )
    ]);

  const liveEvaluation = evaluatePolicy({
    adminApproval: priorApprovalGranted,
    destructiveValidationAuthorized,
    executionEnvironment: decision.executionEnvironment,
    explicitMissionApproval: priorApprovalGranted,
    missionType: decision.missionType,
    offensiveValidationAuthorized,
    requestedAction,
    safetyLevel: decision.safetyLevel,
    scopeContext: scope,
    scopeVerificationStatus: scope.verificationStatus,
    timeWindowApproved: priorApprovalGranted || decision.outcome === "Allowed",
    userRole
  });

  const liveGate = evaluatePolicyDecisionGate({
    approvalState:
      liveEvaluation.outcome === "RequiresApproval" && priorApprovalGranted
        ? "Approved"
        : liveEvaluation.approvalState,
    expiresAt: decision.expiresAt,
    outcome: liveEvaluation.outcome
  });

  if (liveGate === "pending") {
    if (shouldAudit) {
      await writeAuditEvent(prisma as Parameters<typeof writeAuditEvent>[0], {
        action: "policy.decision",
        actorType: "System",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          code: "policy_reevaluation_requires_approval",
          entrypoint,
          missionId,
          outcome: liveEvaluation.outcome,
          rationale: liveEvaluation.rationale,
          scopeId: scope.scopeId,
          startGateRecheck: true
        },
        tenantId,
        userId
      });
    }
    return {
      allowance: null,
      code: "policy_reevaluation_requires_approval",
      liveOutcome: liveEvaluation.outcome,
      liveRationale: liveEvaluation.rationale,
      storedGate,
      verdict: "RequiresApproval"
    };
  }

  if (liveGate === "denied") {
    if (shouldAudit) {
      await writeAuditEvent(prisma as Parameters<typeof writeAuditEvent>[0], {
        action: "policy.decision",
        actorType: "System",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          code: "policy_reevaluation_denied",
          entrypoint,
          missionId,
          outcome: liveEvaluation.outcome,
          rationale: liveEvaluation.rationale,
          scopeId: scope.scopeId,
          startGateRecheck: true
        },
        tenantId,
        userId
      });
    }
    return denyResult({
      code: "policy_reevaluation_denied",
      liveOutcome: liveEvaluation.outcome,
      liveRationale: liveEvaluation.rationale,
      storedGate
    });
  }

  // --- Allowed: mint allowance ---
  return {
    allowance: mintAllowance({
      entrypoint,
      policyDecisionId: decision.policyDecisionId,
      tenantId
    }),
    code: "pep_allowed",
    liveOutcome: liveEvaluation.outcome,
    liveRationale: liveEvaluation.rationale,
    storedGate,
    verdict: "Allowed"
  };
}

function denyResult(partial: {
  code: string;
  liveOutcome: string | null;
  liveRationale: string;
  storedGate: "start" | "pending" | "denied";
}): EnforceExecutionPolicyResult {
  return {
    allowance: null,
    code: partial.code,
    liveOutcome: partial.liveOutcome,
    liveRationale: partial.liveRationale,
    storedGate: partial.storedGate,
    verdict: "Denied"
  };
}

// ---------------------------------------------------------------------------
// Guarded enqueue — the only supported path for mission queue producers
// ---------------------------------------------------------------------------

/**
 * Enqueue a validation job only when a valid PEP allowance is presented and
 * tenant IDs match. Denied decisions never produce an allowance, so they can
 * never reach this function successfully.
 */
export async function enqueueWithExecutionPolicy(
  missionQueue: MissionQueue,
  allowance: ExecutionPolicyAllowance,
  payload: ValidationJobPayload
): Promise<void> {
  if (!isExecutionPolicyAllowance(allowance)) {
    throw new Error(
      "PEP: enqueue refused — missing or invalid execution policy allowance (Denied never queues)."
    );
  }
  if (allowance.tenantId !== payload.tenantId) {
    throw new Error(
      "PEP: enqueue refused — allowance tenant does not match job payload tenant."
    );
  }
  await missionQueue.enqueueValidationJob(payload);
}

/**
 * Assert an allowance exists (for non-queue dispatch paths such as runner task
 * create). Throws if verdict is not Allowed.
 */
export function assertExecutionAllowed(
  result: EnforceExecutionPolicyResult,
  surface: string
): asserts result is EnforceExecutionPolicyResult & {
  allowance: ExecutionPolicyAllowance;
  verdict: "Allowed";
} {
  if (result.verdict !== "Allowed" || !result.allowance) {
    throw new Error(
      `PEP: ${surface} refused — verdict=${result.verdict} code=${result.code}`
    );
  }
}

/** Product-facing honesty string for residual / OpenAPI language. */
export const PEP_COVERAGE_HONESTY =
  "Execution PEP (enforceExecutionPolicy / enqueueWithExecutionPolicy) gates mission start, schedule fire, hop launch (via startMission), fix-verification enqueue, runner task create, and stimulus dispatch. Model-gateway tool PEP remains separate in packages/model-gateway. Architecture test forbids direct missionQueue.enqueueValidationJob from service producers.";
