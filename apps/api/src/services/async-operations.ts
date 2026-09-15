import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@prisma/client";
import {
  AsyncOperationsEventSchema,
  AsyncOperationsPolicyInputSchema,
  AsyncOperationsPolicySchema,
  AsyncOperationsReasonInputSchema,
  AsyncOperationsReconcileResultSchema,
  AsyncOperationsWorkspaceSchema,
  AsyncRecoveryDecisionInputSchema,
  AsyncRecoveryDecisionResultSchema,
  type AsyncOperationsEvent,
  type AsyncOperationsPolicy,
  type AsyncOperationsWorkspace,
  type AsyncRecoveryDecisionInput
} from "@periscan/shared";

import {
  AppServiceError,
  TENANT_ADMIN_ROLES,
  requireRole,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

type AsyncOperationsServices = Pick<
  AppServices,
  | "getAsyncOperationsWorkspace"
  | "reconcileAsyncOperations"
  | "recordAsyncRecoveryDecision"
  | "updateAsyncOperationsPolicy"
>;

type EventRecord = {
  createdAt: Date;
  createdBy: string;
  eventHash: string;
  eventId: string;
  eventType: string;
  previousEventHash: string | null;
  reason: string;
  recoveryMissionId: string | null;
  reference: string;
  result: Prisma.JsonValue;
  sequence: number;
  tenantId: string;
  workloadId: string | null;
  workloadKind: string | null;
};

const ACTIVE_RUNNER_TASK_STATUSES = [
  "Queued",
  "Leased",
  "Running",
  "Accepted"
] as const;
const FAILED_JOB_STATUSES = ["Failed", "DeniedByPolicy"] as const;
const FAILED_RUNNER_TASK_STATUSES = [
  "Failed",
  "Rejected",
  "Expired",
  "DeniedByLocalPolicy",
  "DeniedByServerPolicy"
] as const;
const TERMINAL_JOB_STATUSES = [
  "Completed",
  "Failed",
  "DeniedByPolicy",
  "Cancelled"
] as const;
const TERMINAL_RUNNER_TASK_STATUSES = [
  "Completed",
  "Failed",
  "Rejected",
  "Expired",
  "Cancelled",
  "DeniedByLocalPolicy",
  "DeniedByServerPolicy"
] as const;
const DAY_MS = 24 * 60 * 60 * 1_000;
const JOB_STUCK_SUMMARY =
  "Validation job exceeded the tenant-reviewed execution target; async operations reconciliation marked it failed.";
const RUNNER_EXPIRED_SUMMARY =
  "Runner task passed its signed expiry without a terminal result; async operations reconciliation marked it expired.";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

function hashEvent(input: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function eventHashInput(record: {
  createdAt: Date;
  createdBy: string;
  eventType: string;
  previousEventHash: string | null;
  reason: string;
  recoveryMissionId: string | null;
  reference: string;
  result: unknown;
  sequence: number;
  tenantId: string;
  workloadId: string | null;
  workloadKind: string | null;
}) {
  return {
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    eventType: record.eventType,
    previousEventHash: record.previousEventHash,
    reason: record.reason,
    recoveryMissionId: record.recoveryMissionId,
    reference: record.reference,
    result: record.result,
    sequence: record.sequence,
    tenantId: record.tenantId,
    workloadId: record.workloadId,
    workloadKind: record.workloadKind
  };
}

function serializeEvents(records: EventRecord[]): AsyncOperationsEvent[] {
  let previousHash: string | null = null;
  let chainValid = true;
  const serialized = records.map((record) => {
    const expected = hashEvent(eventHashInput(record));
    chainValid =
      chainValid &&
      record.previousEventHash === previousHash &&
      record.eventHash === expected;
    previousHash = record.eventHash;
    return AsyncOperationsEventSchema.parse({
      ...record,
      createdAt: record.createdAt.toISOString(),
      integrityVerified: chainValid,
      result: record.result
    });
  });
  return serialized.reverse();
}

function serializePolicy(record: {
  createdAt: Date;
  escalationChannel: string;
  queueAgeTargetSeconds: number;
  reviewReference: string;
  reviewedAt: Date;
  reviewedBy: string;
  runnerLeaseWarningSeconds: number;
  runningTimeoutSeconds: number;
  supportOwner: string;
  tenantId: string;
  updatedAt: Date;
}): AsyncOperationsPolicy {
  return AsyncOperationsPolicySchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    reviewedAt: record.reviewedAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  });
}

async function appendEvent(
  tx: Prisma.TransactionClient,
  input: {
    createdBy: string;
    eventType:
      | "PolicyConfigured"
      | "Reconciled"
      | "RecoveryPrepared"
      | "TerminalAccepted";
    reason: string;
    recoveryMissionId?: string | null;
    reference: string;
    result: Record<string, unknown>;
    tenantId: string;
    workloadId?: string | null;
    workloadKind?: "ValidationJob" | "RunnerTask" | null;
  }
) {
  const previous = await tx.asyncOperationsEvent.findFirst({
    orderBy: { sequence: "desc" },
    where: { tenantId: input.tenantId }
  });
  const createdAt = new Date();
  const record = {
    createdAt,
    createdBy: input.createdBy,
    eventType: input.eventType,
    previousEventHash: previous?.eventHash ?? null,
    reason: input.reason,
    recoveryMissionId: input.recoveryMissionId ?? null,
    reference: input.reference,
    result: input.result as Prisma.InputJsonValue,
    sequence: (previous?.sequence ?? 0) + 1,
    tenantId: input.tenantId,
    workloadId: input.workloadId ?? null,
    workloadKind: input.workloadKind ?? null
  };
  return tx.asyncOperationsEvent.create({
    data: {
      ...record,
      eventHash: hashEvent(eventHashInput(record))
    }
  });
}

function ageSeconds(from: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1_000));
}

function jobWorkItem(
  job: {
    attempts: number;
    availableAt: Date;
    completedAt: Date | null;
    createdAt: Date;
    errorMessage: string | null;
    jobId: string;
    missionId: string | null;
    queueName: string;
    startedAt: Date | null;
    status: string;
    validationRunId: string | null;
  },
  policy: AsyncOperationsPolicy | null,
  decidedIds: Set<string>,
  now: Date
) {
  const age = ageSeconds(job.createdAt, now);
  const isFailure = (FAILED_JOB_STATUSES as readonly string[]).includes(
    job.status
  );
  const isTerminal = (TERMINAL_JOB_STATUSES as readonly string[]).includes(
    job.status
  );
  const waiting =
    job.status === "Queued" &&
    Boolean(
      policy && ageSeconds(job.availableAt, now) > policy.queueAgeTargetSeconds
    );
  const stalled =
    job.status === "Running" &&
    Boolean(
      policy &&
      job.startedAt &&
      ageSeconds(job.startedAt, now) > policy.runningTimeoutSeconds
    );
  const operationalState =
    job.status === "Completed"
      ? "TerminalSuccess"
      : job.status === "Cancelled"
        ? "Cancelled"
        : isFailure
          ? "TerminalFailure"
          : stalled
            ? "Stalled"
            : waiting
              ? "WaitingTooLong"
              : job.status === "Running"
                ? "Running"
                : "OnTime";
  const nextAction = stalled
    ? "Reconcile"
    : isFailure
      ? decidedIds.has(`ValidationJob:${job.jobId}`)
        ? "None"
        : "PrepareRecovery"
      : isTerminal
        ? "None"
        : waiting
          ? "Monitor"
          : "Monitor";
  return {
    ageSeconds: age,
    attempts: job.attempts,
    availableAt: job.availableAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    detail: stalled
      ? "Execution exceeded the tenant-reviewed running target."
      : waiting
        ? "Queue age exceeded the tenant-reviewed target; no automatic replay is permitted."
        : `Control-plane job in ${job.queueName}.`,
    errorSummary: job.errorMessage,
    expiresAt: null,
    missionId: job.missionId,
    moduleId: null,
    nextAction,
    operationalState,
    queueName: job.queueName,
    runId: job.validationRunId,
    runnerId: null,
    startedAt: job.startedAt?.toISOString() ?? null,
    status: job.status,
    workloadId: job.jobId,
    workloadKind: "ValidationJob" as const
  };
}

function runnerTaskWorkItem(
  task: {
    acceptedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    errorSummary: string | null;
    expiresAt: Date;
    issuedAt: Date;
    leasedAt: Date | null;
    missionId: string;
    moduleId: string;
    rejectedReason: string | null;
    runId: string;
    runnerId: string;
    status: string;
    taskId: string;
  },
  policy: AsyncOperationsPolicy | null,
  decidedIds: Set<string>,
  now: Date
) {
  const age = ageSeconds(task.createdAt, now);
  const isFailure = (FAILED_RUNNER_TASK_STATUSES as readonly string[]).includes(
    task.status
  );
  const isTerminal = (
    TERMINAL_RUNNER_TASK_STATUSES as readonly string[]
  ).includes(task.status);
  const isActive = (ACTIVE_RUNNER_TASK_STATUSES as readonly string[]).includes(
    task.status
  );
  const stalled = isActive && task.expiresAt.getTime() <= now.getTime();
  const waiting =
    task.status === "Queued" &&
    Boolean(
      policy && ageSeconds(task.issuedAt, now) > policy.queueAgeTargetSeconds
    );
  const leaseWarning =
    isActive &&
    Boolean(
      policy &&
      task.leasedAt &&
      ageSeconds(task.leasedAt, now) > policy.runnerLeaseWarningSeconds
    );
  const operationalState =
    task.status === "Completed"
      ? "TerminalSuccess"
      : task.status === "Cancelled"
        ? "Cancelled"
        : isFailure
          ? "TerminalFailure"
          : stalled
            ? "Stalled"
            : waiting
              ? "WaitingTooLong"
              : task.status === "Queued"
                ? "OnTime"
                : "Running";
  const nextAction = stalled
    ? "Reconcile"
    : isFailure
      ? decidedIds.has(`RunnerTask:${task.taskId}`)
        ? "None"
        : "PrepareRecovery"
      : isTerminal
        ? "None"
        : "Monitor";
  return {
    ageSeconds: age,
    attempts: null,
    availableAt: task.issuedAt.toISOString(),
    completedAt: task.completedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    detail: stalled
      ? "The signed runner-task expiry passed without a terminal result."
      : leaseWarning
        ? "The runner lease is older than the warning target but remains inside its signed expiry."
        : waiting
          ? "Runner pickup exceeded the tenant-reviewed queue-age target."
          : `Signed runner task for ${task.moduleId}.`,
    errorSummary: task.errorSummary ?? task.rejectedReason,
    expiresAt: task.expiresAt.toISOString(),
    missionId: task.missionId,
    moduleId: task.moduleId,
    nextAction,
    operationalState,
    queueName: "runner-task",
    runId: task.runId,
    runnerId: task.runnerId,
    startedAt:
      task.acceptedAt?.toISOString() ?? task.leasedAt?.toISOString() ?? null,
    status: task.status,
    workloadId: task.taskId,
    workloadKind: "RunnerTask" as const
  };
}

async function loadWorkspace(
  prisma: PrismaClient,
  tenantId: string,
  now = new Date()
): Promise<AsyncOperationsWorkspace> {
  const policyRecord = await prisma.asyncOperationsPolicy.findUnique({
    where: { tenantId }
  });
  const policy = policyRecord ? serializePolicy(policyRecord) : null;
  const [jobs, runnerTasks, eventRecords] = await Promise.all([
    prisma.job.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      where: { tenantId }
    }),
    prisma.runnerTask.findMany({
      orderBy: [{ createdAt: "desc" }],
      take: 200,
      where: { tenantId }
    }),
    prisma.asyncOperationsEvent.findMany({
      orderBy: { sequence: "asc" },
      where: { tenantId }
    })
  ]);
  const events = serializeEvents(eventRecords);
  const decidedIds = new Set(
    events
      .filter((event) =>
        ["RecoveryPrepared", "TerminalAccepted"].includes(event.eventType)
      )
      .flatMap((event) =>
        event.workloadId && event.workloadKind
          ? [`${event.workloadKind}:${event.workloadId}`]
          : []
      )
  );
  const workItems = [
    ...jobs.map((job) => jobWorkItem(job, policy, decidedIds, now)),
    ...runnerTasks.map((task) =>
      runnerTaskWorkItem(task, policy, decidedIds, now)
    )
  ].sort((left, right) => {
    const rank = (state: string) =>
      ({ Stalled: 0, WaitingTooLong: 1, TerminalFailure: 2 })[state] ?? 3;
    return (
      rank(left.operationalState) - rank(right.operationalState) ||
      right.ageSeconds - left.ageSeconds
    );
  });
  const activeItems = workItems.filter((item) =>
    ["OnTime", "WaitingTooLong", "Running", "Stalled"].includes(
      item.operationalState
    )
  );
  const stalledCount = workItems.filter(
    (item) => item.operationalState === "Stalled"
  ).length;
  const waitingTooLongCount = workItems.filter(
    (item) => item.operationalState === "WaitingTooLong"
  ).length;
  const terminalFailureCount = workItems.filter(
    (item) => item.operationalState === "TerminalFailure"
  ).length;
  return AsyncOperationsWorkspaceSchema.parse({
    events,
    generatedAt: now.toISOString(),
    limitations: [
      "Targets are tenant-reviewed operating thresholds, not externally audited availability SLOs.",
      "The control room displays the 200 most recent jobs and 200 most recent runner tasks; it does not claim a qualified 10,000-concurrent-workload result.",
      "Reconciliation only marks objectively stale work terminal. Recovery creates a new Draft mission with no policy decision and never directly replays work."
    ],
    policy,
    summary: {
      activeCount: activeItems.length,
      configured: Boolean(policy),
      health: !policy
        ? "NotConfigured"
        : stalledCount > 0
          ? "Critical"
          : waitingTooLongCount > 0 || terminalFailureCount > 0
            ? "Attention"
            : "Healthy",
      oldestActiveAgeSeconds: Math.max(
        0,
        ...activeItems.map((item) => item.ageSeconds)
      ),
      queuedCount: workItems.filter((item) => item.status === "Queued").length,
      recentSuccessCount: workItems.filter(
        (item) =>
          item.operationalState === "TerminalSuccess" &&
          item.completedAt &&
          new Date(item.completedAt).getTime() >= now.getTime() - DAY_MS
      ).length,
      runningCount: workItems.filter(
        (item) => item.operationalState === "Running"
      ).length,
      stalledCount,
      terminalFailureCount,
      waitingTooLongCount
    },
    workItems
  });
}

async function terminalWorkload(
  tx: Prisma.TransactionClient,
  tenantId: string,
  input: AsyncRecoveryDecisionInput
) {
  if (input.workloadKind === "ValidationJob") {
    const job = await tx.job.findFirst({
      include: { mission: true },
      where: { jobId: input.workloadId, tenantId }
    });
    if (!job) {
      throw new AppServiceError(
        "Validation job not found.",
        404,
        "job_not_found"
      );
    }
    if (!(FAILED_JOB_STATUSES as readonly string[]).includes(job.status)) {
      throw new AppServiceError(
        "Only a failed or policy-denied validation job can receive a recovery decision.",
        409,
        "async_workload_not_failed"
      );
    }
    return { mission: job.mission, status: job.status };
  }

  const task = await tx.runnerTask.findFirst({
    include: { mission: true },
    where: { taskId: input.workloadId, tenantId }
  });
  if (!task) {
    throw new AppServiceError(
      "Runner task not found.",
      404,
      "runner_task_not_found"
    );
  }
  if (
    !(FAILED_RUNNER_TASK_STATUSES as readonly string[]).includes(task.status)
  ) {
    throw new AppServiceError(
      "Only a failed, rejected, expired, or denied runner task can receive a recovery decision.",
      409,
      "async_workload_not_failed"
    );
  }
  return { mission: task.mission, status: task.status };
}

export function createAsyncOperationsServices(
  deps: RuntimeServiceDeps
): AsyncOperationsServices {
  const { prisma } = deps;

  return {
    async getAsyncOperationsWorkspace(context) {
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async updateAsyncOperationsPolicy(context, rawInput) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "configure asynchronous operations targets"
      );
      const input = AsyncOperationsPolicyInputSchema.parse(rawInput);
      const now = new Date();
      await prisma.$transaction(
        async (tx) => {
          await tx.asyncOperationsPolicy.upsert({
            create: {
              ...input,
              reviewedAt: now,
              reviewedBy: context.user.userId,
              tenantId: context.tenant.tenantId
            },
            update: {
              ...input,
              reviewedAt: now,
              reviewedBy: context.user.userId
            },
            where: { tenantId: context.tenant.tenantId }
          });
          await appendEvent(tx, {
            createdBy: context.user.userId,
            eventType: "PolicyConfigured",
            reason:
              "Tenant asynchronous operations targets were reviewed and configured.",
            reference: input.reviewReference,
            result: {
              escalationChannel: input.escalationChannel,
              queueAgeTargetSeconds: input.queueAgeTargetSeconds,
              runnerLeaseWarningSeconds: input.runnerLeaseWarningSeconds,
              runningTimeoutSeconds: input.runningTimeoutSeconds,
              supportOwner: input.supportOwner
            },
            tenantId: context.tenant.tenantId
          });
          await writeAuditEvent(tx, {
            action: "async_operations.policy_configured",
            actorType: "User",
            entityId: context.tenant.tenantId,
            entityType: "Tenant",
            metadata: { reviewReference: input.reviewReference },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async reconcileAsyncOperations(context, rawInput) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "reconcile asynchronous operations"
      );
      const input = AsyncOperationsReasonInputSchema.parse(rawInput);
      const tenantId = context.tenant.tenantId;
      const now = new Date();
      const result = await prisma.$transaction(
        async (tx) => {
          const policy = await tx.asyncOperationsPolicy.findUnique({
            where: { tenantId }
          });
          if (!policy) {
            throw new AppServiceError(
              "Configure and review asynchronous operations targets before reconciling work.",
              409,
              "async_operations_policy_required"
            );
          }
          const stuckJobs = await tx.job.findMany({
            select: { jobId: true, validationRunId: true },
            where: {
              startedAt: {
                lte: new Date(
                  now.getTime() - policy.runningTimeoutSeconds * 1_000
                )
              },
              status: "Running",
              tenantId
            }
          });
          const expiredTasks = await tx.runnerTask.findMany({
            select: { runId: true, taskId: true },
            where: {
              expiresAt: { lte: now },
              status: { in: [...ACTIVE_RUNNER_TASK_STATUSES] },
              tenantId
            }
          });
          if (stuckJobs.length > 0) {
            await tx.job.updateMany({
              data: {
                completedAt: now,
                errorMessage: JOB_STUCK_SUMMARY,
                status: "Failed"
              },
              where: {
                jobId: { in: stuckJobs.map((job) => job.jobId) },
                status: "Running",
                tenantId
              }
            });
          }
          if (expiredTasks.length > 0) {
            await tx.runnerTask.updateMany({
              data: {
                completedAt: now,
                errorSummary: RUNNER_EXPIRED_SUMMARY,
                status: "Expired"
              },
              where: {
                status: { in: [...ACTIVE_RUNNER_TASK_STATUSES] },
                taskId: { in: expiredTasks.map((task) => task.taskId) },
                tenantId
              }
            });
          }
          const runIds = [
            ...new Set([
              ...stuckJobs.flatMap((job) =>
                job.validationRunId ? [job.validationRunId] : []
              ),
              ...expiredTasks.map((task) => task.runId)
            ])
          ];
          const failedRuns =
            runIds.length > 0
              ? await tx.validationRun.updateMany({
                  data: {
                    completedAt: now,
                    errorSummary:
                      "Asynchronous work reached its reviewed terminalization boundary.",
                    status: "Failed"
                  },
                  where: {
                    runId: { in: runIds },
                    status: { in: ["Queued", "Running"] },
                    tenantId
                  }
                })
              : { count: 0 };
          const event = await appendEvent(tx, {
            createdBy: context.user.userId,
            eventType: "Reconciled",
            reason: input.reason,
            reference: input.reference,
            result: {
              expiredRunnerTaskCount: expiredTasks.length,
              failedJobCount: stuckJobs.length,
              failedRunCount: failedRuns.count
            },
            tenantId
          });
          await writeAuditEvent(tx, {
            action: "async_operations.reconciled",
            actorType: "User",
            entityId: tenantId,
            entityType: "Tenant",
            metadata: {
              expiredRunnerTaskCount: expiredTasks.length,
              failedJobCount: stuckJobs.length,
              failedRunCount: failedRuns.count,
              reference: input.reference
            },
            tenantId,
            userId: context.user.userId
          });
          return {
            event,
            expiredRunnerTaskCount: expiredTasks.length,
            failedJobCount: stuckJobs.length,
            failedRunCount: failedRuns.count
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      const workspace = await loadWorkspace(prisma, tenantId);
      const event = workspace.events.find(
        (candidate) => candidate.eventId === result.event.eventId
      );
      if (!event)
        throw new Error("Reconciliation event could not be reloaded.");
      return AsyncOperationsReconcileResultSchema.parse({
        ...result,
        event,
        workspace
      });
    },

    async recordAsyncRecoveryDecision(context, rawInput) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "record asynchronous recovery decisions"
      );
      const input = AsyncRecoveryDecisionInputSchema.parse(rawInput);
      const tenantId = context.tenant.tenantId;
      const transactionResult = await prisma.$transaction(
        async (tx) => {
          const existingDecision = await tx.asyncOperationsEvent.findFirst({
            where: {
              eventType: { in: ["RecoveryPrepared", "TerminalAccepted"] },
              tenantId,
              workloadId: input.workloadId,
              workloadKind: input.workloadKind
            }
          });
          if (existingDecision) {
            throw new AppServiceError(
              "This failed workload already has a terminal recovery decision.",
              409,
              "async_recovery_decision_exists"
            );
          }
          const workload = await terminalWorkload(tx, tenantId, input);
          let recoveryMissionId: string | null = null;
          if (input.decision === "PrepareRecovery") {
            if (!workload.mission) {
              throw new AppServiceError(
                "This workload has no source mission to recover.",
                409,
                "async_recovery_source_missing"
              );
            }
            const scopeIds = [
              ...new Set([
                workload.mission.scopeId,
                ...workload.mission.scopeIds
              ])
            ];
            const verifiedScopeCount = await tx.scope.count({
              where: {
                scopeId: { in: scopeIds },
                tenantId,
                verificationStatus: "Verified"
              }
            });
            if (verifiedScopeCount !== scopeIds.length) {
              throw new AppServiceError(
                "Every source scope must still be verified before a recovery draft can be prepared.",
                409,
                "async_recovery_scope_not_verified"
              );
            }
            const mission = await tx.validationMission.create({
              data: {
                evidenceIds: [],
                missionType: workload.mission.missionType,
                policyDecisionId: null,
                policyProfile: workload.mission.policyProfile,
                requestedBy: context.user.userId,
                safetyLevel: workload.mission.safetyLevel,
                scopeId: workload.mission.scopeId,
                scopeIds: workload.mission.scopeIds,
                status: "Draft",
                tenantId
              }
            });
            recoveryMissionId = mission.missionId;
          }
          const eventType =
            input.decision === "PrepareRecovery"
              ? "RecoveryPrepared"
              : "TerminalAccepted";
          const event = await appendEvent(tx, {
            createdBy: context.user.userId,
            eventType,
            reason: input.reason,
            recoveryMissionId,
            reference: input.reference,
            result: {
              directReplay: false,
              originalStatus: workload.status,
              policyDecisionCopied: false,
              recoveryMissionStatus: recoveryMissionId ? "Draft" : null
            },
            tenantId,
            workloadId: input.workloadId,
            workloadKind: input.workloadKind
          });
          await writeAuditEvent(tx, {
            action:
              input.decision === "PrepareRecovery"
                ? "async_operations.recovery_prepared"
                : "async_operations.terminal_accepted",
            actorType: "User",
            entityId:
              recoveryMissionId ??
              workload.mission?.missionId ??
              input.workloadId,
            entityType:
              recoveryMissionId || workload.mission
                ? "ValidationMission"
                : "RunnerTask",
            metadata: {
              directReplay: false,
              reference: input.reference,
              workloadId: input.workloadId,
              workloadKind: input.workloadKind
            },
            tenantId,
            userId: context.user.userId
          });
          return { eventId: event.eventId, recoveryMissionId };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
      const workspace = await loadWorkspace(prisma, tenantId);
      const event = workspace.events.find(
        (candidate) => candidate.eventId === transactionResult.eventId
      );
      if (!event)
        throw new Error("Recovery decision event could not be reloaded.");
      return AsyncRecoveryDecisionResultSchema.parse({
        event,
        recoveryMissionId: transactionResult.recoveryMissionId,
        workspace
      });
    }
  };
}
