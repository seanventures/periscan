// @ts-nocheck
import { randomUUID } from "node:crypto";

import { EvidencePackType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { evaluatePolicy } from "@periscan/policy";

import { getModuleById } from "@periscan/modules";

import type {
  MissionSchedule,
  MissionScheduleDetail,
  PolicyDecision,
  ScheduleTiming,
  Scope,
  ScheduleDiff,
  ScheduleRunHistoryEntry,
  ScheduledRunResult,
  ValidationSnapshot,
  ValidationJobPayload
} from "@periscan/shared";
import {
  enrichContinuousEasmDiffSummary,
  pickRunnerIdByAffinity,
  resolveContinuousEasmModuleIds,
  resolveRunnerRoutingHint,
  scheduleRequestsCommunityValidation,
  toRunnerAffinityCandidate
} from "@periscan/shared";

import {
  enforceExecutionPolicy,
  enqueueWithExecutionPolicy,
  type ExecutionPolicyAllowance
} from "../policy-enforcement-point.js";
import {
  AppServiceError,
  appendScheduleRunHistory,
  BILLING_PACKAGE_CATALOG,
  buildReopenVerificationEventData,
  buildScheduleDiff,
  calculateNextRunAt,
  evaluatePolicyDecisionGate,
  loadValidationSnapshot,
  loadDestructiveValidationAuthorized,
  loadOffensiveValidationAuthorized,
  requireCapability,
  requireRole,
  SCOPE_EDITOR_ROLES,
  serializeMissionSchedule,
  writeAuditEvent
} from "../runtime-services.js";
import type {
  AppServices,
  AuthenticatedContext,
  RuntimeServiceDeps
} from "../runtime-services.js";

interface ScheduledNonSnapshotPackInfo {
  evidenceCount: number;
  evidencePackId: string;
  missionId: string;
  modelSessionId?: string;
  moduleId: string;
  packType: EvidencePackType;
  runId: string;
  status: "queued";
}

interface ScheduledCommunityStartInfo {
  failures: Array<{ reason: string; scopeId: string }>;
  missionIds: string[];
  moduleIds: string[];
  nucleiMissionIds: string[];
}

interface ValidationRunTargetRecord {
  evidencePackId?: string;
  lastDiff?: unknown;
  packId?: string;
  packType?: string;
}

const SUPPORTED_SCHEDULED_MISSION_TYPES = [
  "ValidationSnapshot",
  "ContinuousValidation",
  "AIAppValidation",
  "ControlValidation",
  "FixVerification"
] as const;

type SupportedScheduledMissionType =
  (typeof SUPPORTED_SCHEDULED_MISSION_TYPES)[number];

function isSupportedScheduledMissionType(
  missionType: string
): missionType is SupportedScheduledMissionType {
  return SUPPORTED_SCHEDULED_MISSION_TYPES.some(
    (supportedMissionType) => supportedMissionType === missionType
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readStringIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string" && item.length > 0
      )
    : [];
}

function buildCommunityScheduleDiff(
  packInfo: ScheduledCommunityStartInfo
): ScheduleDiff {
  const scopeCount = packInfo.missionIds.length;
  const failNote =
    packInfo.failures.length > 0
      ? ` ${packInfo.failures.length} verified scope(s) did not start.`
      : "";
  return {
    addedPathIds: [],
    currentSnapshotId: packInfo.missionIds[0]!,
    previousSnapshotId: null,
    removedPathIds: [],
    reopenedPathIds: [],
    riskScoreDelta: 0,
    status: "NoPreviousRun",
    summary: `Queued Community validation pack for ${scopeCount} verified scope${scopeCount === 1 ? "" : "s"}. Snapshot report was not composed.${failNote}`
  };
}

function readTargetRecord(value: unknown): ValidationRunTargetRecord {
  const record = asRecord(value);

  return {
    evidencePackId:
      typeof record.evidencePackId === "string"
        ? record.evidencePackId
        : undefined,
    lastDiff: record.lastDiff,
    packId: typeof record.packId === "string" ? record.packId : undefined,
    packType: typeof record.packType === "string" ? record.packType : undefined
  };
}

function buildNonSnapshotScheduleDiff(
  packInfo: ScheduledNonSnapshotPackInfo
): ScheduleDiff {
  return {
    addedPathIds: [],
    currentSnapshotId: packInfo.evidencePackId,
    previousSnapshotId: null,
    removedPathIds: [],
    reopenedPathIds: [],
    riskScoreDelta: 0,
    status: "NoPreviousRun",
    summary: `Scheduled ${packInfo.packType} run ${packInfo.runId} queued for execution.`
  };
}

function assertScheduleTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new AppServiceError(
      "Schedule timezone must be a valid IANA timezone.",
      400,
      "invalid_schedule_timezone"
    );
  }
}

function timingFromSchedule(schedule: {
  config: unknown;
  frequency: MissionSchedule["frequency"];
  nextRunAt: Date;
}): ScheduleTiming {
  const config = asRecord(schedule.config);
  const stored = asRecord(config.scheduleTiming);
  const fallbackTime = `${String(schedule.nextRunAt.getUTCHours()).padStart(2, "0")}:${String(schedule.nextRunAt.getUTCMinutes()).padStart(2, "0")}`;
  return {
    blackoutWindows: Array.isArray(stored.blackoutWindows)
      ? (stored.blackoutWindows as ScheduleTiming["blackoutWindows"])
      : [],
    dayOfMonth:
      typeof stored.dayOfMonth === "number"
        ? stored.dayOfMonth
        : schedule.nextRunAt.getUTCDate(),
    dayOfWeek:
      typeof stored.dayOfWeek === "number"
        ? stored.dayOfWeek
        : schedule.nextRunAt.getUTCDay(),
    runAtLocalTime:
      typeof stored.runAtLocalTime === "string"
        ? stored.runAtLocalTime
        : fallbackTime,
    timeZone: typeof stored.timeZone === "string" ? stored.timeZone : "UTC"
  };
}

function mergeScheduleTiming(
  current: ScheduleTiming,
  input: {
    blackoutWindows?: ScheduleTiming["blackoutWindows"];
    dayOfMonth?: number;
    dayOfWeek?: number;
    runAtLocalTime?: string;
    timeZone?: string;
  }
): ScheduleTiming {
  const timing = {
    blackoutWindows: input.blackoutWindows ?? current.blackoutWindows,
    dayOfMonth: input.dayOfMonth ?? current.dayOfMonth,
    dayOfWeek: input.dayOfWeek ?? current.dayOfWeek,
    runAtLocalTime: input.runAtLocalTime ?? current.runAtLocalTime,
    timeZone: input.timeZone ?? current.timeZone
  };
  assertScheduleTimeZone(timing.timeZone);
  return timing;
}

/**
 * P10-2: merge optional schedule affinity fields into config for later fire-time
 * auto-selection when preferredRunnerId is unset.
 */
function mergeScheduleAffinityConfig(
  config: Record<string, unknown>,
  input: {
    networkSegment?: string | null;
    preferredRunnerId?: string | null;
    siteId?: string | null;
  }
): Record<string, unknown> {
  const next = { ...config };
  if (input.preferredRunnerId !== undefined) {
    if (input.preferredRunnerId) {
      next.preferredRunnerId = input.preferredRunnerId;
    } else {
      delete next.preferredRunnerId;
    }
  }
  if (input.siteId !== undefined) {
    if (input.siteId) {
      next.siteId = input.siteId;
    } else {
      delete next.siteId;
    }
  }
  if (input.networkSegment !== undefined) {
    if (input.networkSegment) {
      next.networkSegment = input.networkSegment;
    } else {
      delete next.networkSegment;
    }
  }
  return next;
}

/**
 * P10-2 residual: when preferredRunnerId is unset, score tenant runners by
 * site/segment affinity (from schedule config and/or scope.segmentName) and pin
 * the best eligible runner on the scheduled run. Unbound hybrid path: returns
 * null when no topology preference/constraint is present.
 */
async function resolveScheduledRunnerId(
  prisma: RuntimeServiceDeps["prisma"],
  tenantId: string,
  config: Record<string, unknown>,
  scopes: Array<{ segmentName?: string | null }>
): Promise<string | null> {
  const scopeSegmentName =
    scopes
      .map((scope) =>
        typeof scope.segmentName === "string" && scope.segmentName.trim()
          ? scope.segmentName.trim()
          : null
      )
      .find((value): value is string => Boolean(value)) ?? null;

  const hint = resolveRunnerRoutingHint({
    config,
    scopeSegmentName
  });

  if (!hint.preferredRunnerId && !hint.siteId && !hint.networkSegment) {
    return null;
  }

  const runners = await prisma.runner.findMany({
    select: {
      networkSegment: true,
      runnerId: true,
      segmentProfileId: true,
      siteId: true,
      status: true
    },
    where: {
      killSwitchActive: false,
      status: { notIn: ["Revoked", "KillSwitchActive"] },
      tenantId
    }
  });

  return pickRunnerIdByAffinity(
    runners.map((runner) => toRunnerAffinityCandidate(runner)),
    hint
  );
}

/**
 * Wave C: queue allowlisted continuous EASM modules for ContinuousValidation.
 * One mission per verified scope that has matching modules; Denied work never
 * reaches here (caller already PEP-gated schedule fire).
 */
async function queueContinuousEasmForSchedule(input: {
  affinityConfig: Record<string, unknown>;
  configModuleIds: unknown;
  context: AuthenticatedContext;
  missionQueue: RuntimeServiceDeps["missionQueue"];
  prisma: RuntimeServiceDeps["prisma"];
  scheduleAllowances: ExecutionPolicyAllowance[];
  scheduleExecutionAllowance: ExecutionPolicyAllowance;
  scheduleId: string;
  scopes: Array<{
    externalValidationProfileId?: string | null;
    scopeId: string;
    scopeType: string;
    value: string;
    verificationStatus: string;
  }>;
}): Promise<{ missionId: string | null; moduleIds: string[] }> {
  const {
    affinityConfig,
    configModuleIds,
    context,
    missionQueue,
    prisma,
    scheduleAllowances,
    scheduleExecutionAllowance,
    scheduleId,
    scopes
  } = input;

  const queuedModuleIds: string[] = [];
  let firstMissionId: string | null = null;

  for (let index = 0; index < scopes.length; index += 1) {
    const scope = scopes[index]!;
    if (scope.verificationStatus !== "Verified") {
      continue;
    }
    const moduleIds = resolveContinuousEasmModuleIds({
      configModuleIds,
      scopeType: scope.scopeType
    }).filter((moduleId) => {
      const module = getModuleById(moduleId);
      return (
        Boolean(module) &&
        module!.manifest.supportedMissionTypes.includes("ContinuousValidation")
      );
    });
    if (moduleIds.length === 0) {
      continue;
    }

    const allowance = scheduleAllowances[index] ?? scheduleExecutionAllowance;
    if (!allowance) {
      continue;
    }

    const affinityRunnerId = await resolveScheduledRunnerId(
      prisma,
      context.tenant.tenantId,
      affinityConfig,
      [scope as Scope]
    );

    const templateProfile =
      typeof scope.externalValidationProfileId === "string" &&
      scope.externalValidationProfileId.length > 0
        ? scope.externalValidationProfileId
        : "safe-baseline";

    const mission = await prisma.validationMission.create({
      data: {
        missionType: "ContinuousValidation",
        policyDecisionId: allowance.policyDecisionId,
        status: "Queued",
        tenantId: context.tenant.tenantId,
        requestedBy: context.user.userId,
        safetyLevel: "ActiveNonInvasive",
        scopeId: scope.scopeId,
        scopeIds: [scope.scopeId]
      }
    });

    if (!firstMissionId) {
      firstMissionId = mission.missionId;
    }

    for (const moduleId of moduleIds) {
      const manifest = getModuleById(moduleId)?.manifest;
      if (!manifest) continue;

      const target: Record<string, unknown> = {
        scheduled: true,
        scheduleId,
        continuousEasm: true,
        hostname: scope.value,
        domain: scope.value,
        host: scope.value,
        targets: scope.value,
        templateProfile,
        moduleHint: moduleId
      };
      if (affinityRunnerId) {
        target.affinitySelectedRunnerId = affinityRunnerId;
      }

      const run = await prisma.validationRun.create({
        data: {
          evidenceIds: [],
          missionId: mission.missionId,
          moduleId,
          policyDecisionId: allowance.policyDecisionId,
          runnerId:
            manifest.executionMode === "InternalRunner"
              ? affinityRunnerId
              : null,
          safetyLevel: manifest.safetyLevel,
          scopeId: scope.scopeId,
          status: "Queued",
          target: target as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId
        }
      });

      const jobId = randomUUID();
      const payload: ValidationJobPayload = {
        jobId,
        missionId: mission.missionId,
        runId: run.runId,
        tenantId: context.tenant.tenantId
      };
      await enqueueWithExecutionPolicy(missionQueue, allowance, payload);
      queuedModuleIds.push(moduleId);
    }

    await writeAuditEvent(prisma, {
      action: "mission.created",
      actorType: "System",
      entityId: mission.missionId,
      entityType: "ValidationMission",
      metadata: {
        continuousEasm: true,
        moduleIds,
        scheduleId,
        scopeId: scope.scopeId,
        stage: "schedule_fire"
      },
      tenantId: context.tenant.tenantId,
      userId: context.user.userId
    });
  }

  return {
    missionId: firstMissionId,
    moduleIds: [...new Set(queuedModuleIds)]
  };
}

// Recurring validation schedule service group (D1 Phase 2 closure decomposition).
// Cross-/intra-group calls (createSnapshot, runSchedule) go through `this`, which
// binds to the composed AppServices object at call time.
export function createScheduleServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "createSchedule"
  | "deleteSchedule"
  | "getSchedule"
  | "listSchedules"
  | "pauseSchedule"
  | "resumeSchedule"
  | "runDueSchedules"
  | "runSchedule"
  | "updateSchedule"
> {
  const { emitTenantWebhook, prisma, missionQueue } = deps;

  async function evaluateScheduleScopes(
    context: AuthenticatedContext,
    scopes: Array<
      Pick<
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
      >
    >,
    missionType: MissionSchedule["missionType"],
    stage: "create" | "run",
    scheduleId?: string,
    options?: { communityValidation?: boolean }
  ) {
    const [offensiveValidationAuthorized, destructiveValidationAuthorized] =
      await Promise.all([
        loadOffensiveValidationAuthorized(prisma, context.tenant.tenantId),
        loadDestructiveValidationAuthorized(prisma, context.tenant.tenantId)
      ]);
    // ContinuousValidation is continuous EASM on verified scopes: ActiveNonInvasive
    // so allowlisted ExternalPoA (nuclei.safe) + recon modules may queue. Snapshot-only
    // ValidationSnapshot stays PassiveReadOnly unless the schedule opts into the
    // Community pack (engines need ActiveNonInvasive; snapshot report is separate).
    const safetyLevel: PolicyDecision["safetyLevel"] =
      missionType === "ValidationSnapshot" && !options?.communityValidation
        ? "PassiveReadOnly"
        : "ActiveNonInvasive";
    const results = [];
    for (const scope of scopes) {
      const requestedAction = {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: scope.scopeType === "InternalNetwork",
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      };
      const executionEnvironment: PolicyDecision["executionEnvironment"] =
        scope.scopeType === "InternalNetwork"
          ? "InternalRunner"
          : "ExternalPoA";
      const evaluated = evaluatePolicy({
        adminApproval: false,
        destructiveValidationAuthorized,
        executionEnvironment,
        explicitMissionApproval: false,
        missionType,
        offensiveValidationAuthorized,
        requestedAction,
        safetyLevel,
        scopeContext: scope,
        scopeVerificationStatus: scope.verificationStatus,
        timeWindowApproved: false,
        userRole: context.membership.role
      });
      results.push({
        approvalState: evaluated.approvalState,
        executionEnvironment,
        missionType,
        outcome: evaluated.outcome,
        rationale: evaluated.rationale,
        requestedAction,
        safetyLevel,
        scopeId: scope.scopeId,
        stage,
        target: { scheduleId: scheduleId ?? null, scheduled: true, stage }
      });
    }
    return results;
  }

  async function persistSchedulePolicyDecisions(
    context: AuthenticatedContext,
    evaluations: Awaited<ReturnType<typeof evaluateScheduleScopes>>
  ) {
    const decisions = [];
    for (const evaluated of evaluations) {
      const decision = await prisma.policyDecision.create({
        data: {
          approvalState: evaluated.approvalState,
          executionEnvironment: evaluated.executionEnvironment,
          missionType: evaluated.missionType,
          outcome: evaluated.outcome,
          rationale: evaluated.rationale,
          requestedAction: evaluated.requestedAction as Prisma.InputJsonValue,
          safetyLevel: evaluated.safetyLevel,
          scopeId: evaluated.scopeId,
          target: evaluated.target as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });
      decisions.push(decision);
      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          outcome: decision.outcome,
          scheduleId: evaluated.target.scheduleId,
          scheduled: true,
          scopeId: evaluated.scopeId,
          stage: evaluated.stage
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    }
    return decisions;
  }

  return {
    async listSchedules(context) {
      const schedules = await prisma.missionSchedule.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return schedules.map(serializeMissionSchedule);
    },

    async getSchedule(
      context,
      scheduleId
    ): Promise<MissionScheduleDetail | null> {
      const schedule = await prisma.missionSchedule.findFirst({
        where: {
          scheduleId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!schedule) {
        return null;
      }

      const base = serializeMissionSchedule(schedule);

      // P06-10: last 10 runs with mission link + failure / deny reasons.
      let runHistory: ScheduleRunHistoryEntry[] = [];
      try {
        const byTarget = await prisma.validationRun.findMany({
          where: {
            tenantId: context.tenant.tenantId,
            target: { path: ["scheduleId"], equals: scheduleId }
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            runId: true,
            completedAt: true,
            createdAt: true,
            outcome: true,
            status: true,
            errorSummary: true,
            missionId: true,
            target: true,
            validationState: true
          }
        });
        const storedConfig = asRecord(schedule.config);
        const communityMissionIds = [
          ...readStringIds(storedConfig.communityMissionIds),
          ...readStringIds(asRecord(storedConfig.lastCommunityStart).missionIds)
        ];
        const missionIds = [
          ...new Set(
            [
              schedule.lastMissionId,
              ...byTarget.map((run) => run.missionId),
              ...communityMissionIds
            ].filter((id): id is string => Boolean(id))
          )
        ];
        const byMission =
          missionIds.length > 0
            ? await prisma.validationRun.findMany({
                where: {
                  tenantId: context.tenant.tenantId,
                  missionId: { in: missionIds }
                },
                orderBy: { createdAt: "desc" },
                take: 10,
                select: {
                  runId: true,
                  completedAt: true,
                  createdAt: true,
                  outcome: true,
                  status: true,
                  errorSummary: true,
                  missionId: true,
                  target: true,
                  validationState: true
                }
              })
            : [];
        const merged = new Map<string, (typeof byTarget)[number]>();
        for (const run of [...byTarget, ...byMission]) {
          if (!merged.has(run.runId)) merged.set(run.runId, run);
        }
        const config = asRecord(schedule.config);
        const denyReason =
          typeof config.lastDenyReason === "string"
            ? config.lastDenyReason
            : typeof config.lastPolicyDenyReason === "string"
              ? config.lastPolicyDenyReason
              : null;
        runHistory = [...merged.values()]
          .sort(
            (left, right) =>
              (right.completedAt ?? right.createdAt).getTime() -
              (left.completedAt ?? left.createdAt).getTime()
          )
          .slice(0, 10)
          .map((run) => {
            const target = readTargetRecord(run.target);
            const failed =
              run.status === "Failed" ||
              (typeof run.outcome === "string" &&
                /fail|denied|error/i.test(run.outcome));
            return {
              at:
                run.completedAt?.toISOString() ??
                run.createdAt.toISOString() ??
                null,
              denyReason: failed ? denyReason : null,
              diff:
                (target.lastDiff as Record<string, unknown> | undefined) ??
                (run.target as Record<string, unknown> | null) ??
                null,
              errorSummary: run.errorSummary ?? null,
              missionId: run.missionId,
              outcome: run.outcome,
              packId: target.evidencePackId ?? target.packId ?? null,
              packType: target.packType ?? null,
              runId: run.runId,
              status: run.status
            };
          });
      } catch {
        // History is best-effort; the schedule read itself remains authoritative.
      }

      return {
        ...base,
        priorDiffs: runHistory,
        runHistory
      };
    },

    async createSchedule(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create schedules"
      );

      const scopeWhere = input.scopeIds
        ? {
            scopeId: {
              in: input.scopeIds
            }
          }
        : {
            verificationStatus: "Verified" as const
          };
      const scopes = await prisma.scope.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          ...scopeWhere,
          tenantId: context.tenant.tenantId
        }
      });
      const unverifiedScope = scopes.find(
        (scope) => scope.verificationStatus !== "Verified"
      );

      if (input.scopeIds && scopes.length !== input.scopeIds.length) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }

      if (unverifiedScope || scopes.length === 0) {
        throw new AppServiceError(
          "Schedules require at least one verified scope.",
          400,
          "verified_scope_required"
        );
      }

      const missionType = input.missionType ?? "ValidationSnapshot";
      const incomingConfig = { ...(input.config ?? {}) };
      if (!scheduleRequestsCommunityValidation(missionType, incomingConfig)) {
        delete incomingConfig.communityValidation;
      }

      if (!isSupportedScheduledMissionType(missionType)) {
        throw new AppServiceError(
          `Only ${SUPPORTED_SCHEDULED_MISSION_TYPES.join(", ")} schedules are supported.`,
          400,
          "unsupported_schedule_mission_type"
        );
      }

      if (
        missionType !== "ValidationSnapshot" &&
        missionType !== "ContinuousValidation" &&
        scopes.length > 1
      ) {
        throw new AppServiceError(
          "Execution schedules run one scope at a time; create one schedule per scope.",
          400,
          "multi_scope_schedule_unsupported"
        );
      }

      const creationPolicy = await evaluateScheduleScopes(
        context,
        scopes,
        missionType,
        "create",
        undefined,
        {
          communityValidation: scheduleRequestsCommunityValidation(
            missionType,
            incomingConfig
          )
        }
      );
      if (
        creationPolicy.some(
          (decision) => evaluatePolicyDecisionGate(decision) !== "start"
        )
      ) {
        throw new AppServiceError(
          "The current tenant policy does not allow this recurring validation. Adjust the safety policy or use an approved manual mission.",
          400,
          "schedule_policy_denied"
        );
      }

      const nowDate = new Date();
      const timing: ScheduleTiming = {
        blackoutWindows: input.blackoutWindows ?? [],
        dayOfMonth: input.dayOfMonth,
        dayOfWeek: input.dayOfWeek,
        runAtLocalTime: input.runAtLocalTime ?? "09:00",
        timeZone: input.timeZone ?? "UTC"
      };
      assertScheduleTimeZone(timing.timeZone);
      const nextRunAt = input.nextRunAt
        ? new Date(input.nextRunAt)
        : calculateNextRunAt(input.frequency, nowDate, timing);

      if (Number.isNaN(nextRunAt.getTime())) {
        throw new AppServiceError(
          "Invalid nextRunAt value.",
          400,
          "invalid_next_run_at"
        );
      }

      const schedule = await prisma.missionSchedule.create({
        data: {
          config: mergeScheduleAffinityConfig(
            {
              audience: input.audience ?? "Security Team",
              maxTopItems: Math.max(3, Math.min(input.maxTopItems ?? 5, 5)),
              ...incomingConfig,
              scheduleTiming: timing
            },
            {
              networkSegment: input.networkSegment,
              preferredRunnerId: input.preferredRunnerId,
              siteId: input.siteId
            }
          ),
          createdBy: context.user.userId,
          frequency: input.frequency,
          missionType,
          nextRunAt,
          scopeIds: scopes.map((scope) => scope.scopeId),
          status: "Active",
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "mission.created",
        actorType: "User",
        entityId: schedule.scheduleId,
        entityType: "ValidationMission",
        metadata: {
          frequency: schedule.frequency,
          scheduleId: schedule.scheduleId,
          scheduled: true
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeMissionSchedule(schedule);
    },

    async updateSchedule(context, scheduleId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "update schedules"
      );
      const schedule = await prisma.missionSchedule.findFirst({
        where: { scheduleId, tenantId: context.tenant.tenantId }
      });
      if (!schedule) {
        throw new AppServiceError(
          "Schedule not found.",
          404,
          "schedule_not_found"
        );
      }
      const scopeIds = input.scopeIds ?? schedule.scopeIds;
      const scopes = await prisma.scope.findMany({
        where: {
          scopeId: { in: scopeIds },
          tenantId: context.tenant.tenantId
        }
      });
      if (
        scopes.length !== scopeIds.length ||
        scopes.some((scope) => scope.verificationStatus !== "Verified")
      ) {
        throw new AppServiceError(
          "Schedules require verified tenant scopes.",
          400,
          "verified_scope_required"
        );
      }
      const missionType = input.missionType ?? schedule.missionType;
      const incomingConfig = { ...(input.config ?? {}) };
      if (
        missionType !== "ValidationSnapshot" &&
        missionType !== "ContinuousValidation" &&
        scopes.length > 1
      ) {
        throw new AppServiceError(
          "Execution schedules run one scope at a time; create one schedule per scope.",
          400,
          "multi_scope_schedule_unsupported"
        );
      }
      const policy = await evaluateScheduleScopes(
        context,
        scopes,
        missionType,
        "create",
        scheduleId,
        {
          communityValidation: scheduleRequestsCommunityValidation(
            missionType,
            { ...asRecord(schedule.config), ...incomingConfig }
          )
        }
      );
      if (
        policy.some(
          (decision) => evaluatePolicyDecisionGate(decision) !== "start"
        )
      ) {
        throw new AppServiceError(
          "The current tenant policy does not allow this recurring validation.",
          400,
          "schedule_policy_denied"
        );
      }
      const currentTiming = timingFromSchedule(schedule);
      const timing = mergeScheduleTiming(currentTiming, input);
      const frequency = input.frequency ?? schedule.frequency;
      const currentConfig = asRecord(schedule.config);
      const nextConfig = mergeScheduleAffinityConfig(
        {
          ...currentConfig,
          ...incomingConfig,
          ...(input.audience ? { audience: input.audience } : {}),
          ...(typeof input.maxTopItems === "number"
            ? { maxTopItems: input.maxTopItems }
            : {}),
          scheduleTiming: timing
        },
        {
          networkSegment: input.networkSegment,
          preferredRunnerId: input.preferredRunnerId,
          siteId: input.siteId
        }
      );
      if (!scheduleRequestsCommunityValidation(missionType, nextConfig)) {
        delete nextConfig.communityValidation;
      }
      const updated = await prisma.missionSchedule.update({
        data: {
          config: nextConfig as Prisma.InputJsonValue,
          frequency,
          missionType,
          nextRunAt: calculateNextRunAt(frequency, new Date(), timing),
          scopeIds
        },
        where: { scheduleId }
      });
      await writeAuditEvent(prisma, {
        action: "mission.created",
        actorType: "User",
        entityId: scheduleId,
        entityType: "ValidationMission",
        metadata: { operation: "schedule.updated", scheduleId },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeMissionSchedule(updated);
    },

    async deleteSchedule(context, scheduleId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "delete schedules"
      );
      const schedule = await prisma.missionSchedule.findFirst({
        where: { scheduleId, tenantId: context.tenant.tenantId }
      });
      if (!schedule) {
        throw new AppServiceError(
          "Schedule not found.",
          404,
          "schedule_not_found"
        );
      }
      await prisma.missionSchedule.delete({ where: { scheduleId } });
      await writeAuditEvent(prisma, {
        action: "mission.cancelled",
        actorType: "User",
        entityId: scheduleId,
        entityType: "ValidationMission",
        metadata: { operation: "schedule.deleted", scheduleId },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
    },

    async pauseSchedule(context, scheduleId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "pause schedules"
      );

      const schedule = await prisma.missionSchedule.findFirst({
        where: {
          scheduleId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!schedule) {
        throw new AppServiceError(
          "Schedule not found.",
          404,
          "schedule_not_found"
        );
      }

      return serializeMissionSchedule(
        await prisma.missionSchedule.update({
          data: {
            status: "Paused"
          },
          where: {
            scheduleId
          }
        })
      );
    },

    async resumeSchedule(context, scheduleId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "resume schedules"
      );

      const schedule = await prisma.missionSchedule.findFirst({
        where: {
          scheduleId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!schedule) {
        throw new AppServiceError(
          "Schedule not found.",
          404,
          "schedule_not_found"
        );
      }

      return serializeMissionSchedule(
        await prisma.missionSchedule.update({
          data: {
            nextRunAt: calculateNextRunAt(
              schedule.frequency,
              new Date(),
              timingFromSchedule(schedule)
            ),
            status: "Active"
          },
          where: {
            scheduleId
          }
        })
      );
    },

    async runSchedule(this: AppServices, context, scheduleId) {
      requireRole(context.membership.role, SCOPE_EDITOR_ROLES, "run schedules");

      const schedule = await prisma.missionSchedule.findFirst({
        where: {
          scheduleId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!schedule) {
        throw new AppServiceError(
          "Schedule not found.",
          404,
          "schedule_not_found"
        );
      }

      // A paused schedule is the operator's deliberate halt; honor it on the
      // manual "Run now" path the same way the due-schedule sweep does (it only
      // picks up status:"Active" rows). Running a paused schedule by hand would
      // mint a snapshot mission and recompute nextRunAt while supposedly halted,
      // so refuse it until the schedule is resumed.
      if (schedule.status !== "Active") {
        throw new AppServiceError(
          "Schedule must be Active to run. Resume the schedule first.",
          409,
          "schedule_not_runnable"
        );
      }

      // Claim before creating missions/snapshots/packs. Overlapping sweeps and
      // multi-instance run-due previously both observed the same due nextRunAt
      // and double-fired because nextRunAt advanced only after success.
      const claimedNextRunAt = calculateNextRunAt(
        schedule.frequency,
        new Date(),
        timingFromSchedule(schedule)
      );
      const claim = await prisma.missionSchedule.updateMany({
        data: {
          nextRunAt: claimedNextRunAt
        },
        where: {
          nextRunAt: schedule.nextRunAt,
          scheduleId: schedule.scheduleId,
          status: "Active",
          tenantId: context.tenant.tenantId
        }
      });
      if (claim.count !== 1) {
        throw new AppServiceError(
          "Schedule was already claimed by another runner.",
          409,
          "schedule_already_claimed"
        );
      }
      // Keep in-memory row aligned with the durable claim for later updates.
      schedule.nextRunAt = claimedNextRunAt;

      const supported = [
        "ValidationSnapshot",
        "ContinuousValidation",
        "AIAppValidation",
        "ControlValidation",
        "FixVerification"
      ];

      if (!supported.includes(schedule.missionType)) {
        throw new AppServiceError(
          `Only ${supported.join(", ")} schedules are supported.`,
          400,
          "unsupported_schedule_mission_type"
        );
      }

      let config = asRecord(schedule.config);
      const wantsCommunityValidation = scheduleRequestsCommunityValidation(
        schedule.missionType,
        config
      );
      const scopes = await prisma.scope.findMany({
        where: {
          scopeId: { in: schedule.scopeIds },
          tenantId: context.tenant.tenantId
        }
      });
      if (
        scopes.length !== schedule.scopeIds.length ||
        scopes.some((scope) => scope.verificationStatus !== "Verified")
      ) {
        throw new AppServiceError(
          "A scheduled run requires all bound scopes to remain verified.",
          400,
          "verified_scope_required"
        );
      }

      let policyDecisions: Awaited<
        ReturnType<typeof persistSchedulePolicyDecisions>
      > = [];
      const pendingIds = Array.isArray(config.pendingPolicyDecisionIds)
        ? config.pendingPolicyDecisionIds.filter(
            (value): value is string => typeof value === "string"
          )
        : [];
      if (pendingIds.length === scopes.length) {
        const pending = await prisma.policyDecision.findMany({
          where: {
            policyDecisionId: { in: pendingIds },
            tenantId: context.tenant.tenantId
          }
        });
        if (
          pending.length === scopes.length &&
          pending.every(
            (decision) => evaluatePolicyDecisionGate(decision) === "start"
          ) &&
          (!wantsCommunityValidation ||
            pending.every(
              (decision) => decision.safetyLevel !== "PassiveReadOnly"
            ))
        ) {
          // Dual-gate residual: stored Allowed/Approved is not enough if live
          // conditions drifted (scope ceiling, offensive/destructive flips).
          // Re-evaluate against current tenant policy; never queue denied work.
          const liveEvaluations = await evaluateScheduleScopes(
            context,
            scopes,
            schedule.missionType,
            "run",
            scheduleId,
            { communityValidation: wantsCommunityValidation }
          );
          const liveStartable = liveEvaluations.every((evaluation) => {
            const priorApproved = pending.some(
              (decision) =>
                decision.scopeId === evaluation.scopeId &&
                decision.approvalState === "Approved"
            );
            const gate = evaluatePolicyDecisionGate({
              approvalState:
                evaluation.outcome === "RequiresApproval" && priorApproved
                  ? "Approved"
                  : evaluation.approvalState,
              expiresAt: null,
              outcome: evaluation.outcome
            });
            return gate === "start";
          });
          if (liveStartable) {
            policyDecisions = pending;
          } else {
            throw new AppServiceError(
              "Policy conditions changed since this schedule was approved; live re-evaluation denied the run. No task was queued.",
              409,
              "schedule_policy_live_denied"
            );
          }
        } else if (
          pending.some(
            (decision) => evaluatePolicyDecisionGate(decision) === "pending"
          )
        ) {
          throw new AppServiceError(
            "This scheduled run is waiting for approval. Approve its policy decision before retrying.",
            409,
            "schedule_policy_approval_required"
          );
        }
      }
      if (policyDecisions.length === 0) {
        const evaluations = await evaluateScheduleScopes(
          context,
          scopes,
          schedule.missionType,
          "run",
          scheduleId,
          { communityValidation: wantsCommunityValidation }
        );
        policyDecisions = await persistSchedulePolicyDecisions(
          context,
          evaluations
        );
        if (
          policyDecisions.some(
            (decision) => evaluatePolicyDecisionGate(decision) !== "start"
          )
        ) {
          // P06-10: persist deny reason in run history so ops can see why a
          // due schedule did not fire without audit archaeology.
          config = appendScheduleRunHistory(
            {
              ...config,
              pendingPolicyDecisionIds: policyDecisions.map(
                (decision) => decision.policyDecisionId
              )
            },
            {
              denyReason:
                "Policy approval is required before this scheduled run can queue work.",
              missionId: null,
              outcome: "DeniedByPolicy",
              scheduledAt: new Date().toISOString(),
              snapshotId: null
            }
          );
          await prisma.missionSchedule.update({
            data: { config: config as Prisma.InputJsonValue },
            where: { scheduleId }
          });
          await emitTenantWebhook(context.tenant.tenantId, "schedule.failed", {
            denyReason:
              "Policy approval is required before this scheduled run can queue work.",
            outcome: "DeniedByPolicy",
            scheduleId
          });
          throw new AppServiceError(
            "Policy approval is required before this scheduled run can queue work. No task was queued.",
            409,
            "schedule_policy_approval_required"
          );
        }
      }
      config = {
        ...config,
        lastPolicyDecisionIds: policyDecisions.map(
          (decision) => decision.policyDecisionId
        ),
        pendingPolicyDecisionIds: []
      };
      await prisma.missionSchedule.update({
        data: { config: config as Prisma.InputJsonValue },
        where: { scheduleId }
      });

      await requireCapability(prisma, context, "ValidationRuns");

      // P03-20: PEP dual-gate on every schedule-fire policy decision before any
      // mission/run/job is created. Denied work never queues.
      const scheduleAllowances: ExecutionPolicyAllowance[] = [];
      for (const decision of policyDecisions) {
        const boundScope = scopes.find((s) => s.scopeId === decision.scopeId);
        if (!boundScope) {
          throw new AppServiceError(
            "Schedule policy decision is not bound to a verified scope in this run.",
            400,
            "schedule_policy_scope_missing"
          );
        }
        const pep = await enforceExecutionPolicy({
          decision,
          entrypoint: "schedule_fire",
          expected: { scopeId: boundScope.scopeId },
          prisma,
          scope: boundScope,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId,
          userRole: context.membership.role
        });
        if (pep.verdict !== "Allowed" || !pep.allowance) {
          config = appendScheduleRunHistory(
            {
              ...config,
              pendingPolicyDecisionIds: policyDecisions.map(
                (d) => d.policyDecisionId
              )
            },
            {
              denyReason:
                pep.liveRationale ??
                "Policy enforcement denied this scheduled run; no task was queued.",
              missionId: null,
              outcome: "DeniedByPolicy",
              scheduledAt: new Date().toISOString(),
              snapshotId: null
            }
          );
          await prisma.missionSchedule.update({
            data: { config: config as Prisma.InputJsonValue },
            where: { scheduleId }
          });
          await emitTenantWebhook(context.tenant.tenantId, "schedule.failed", {
            code: pep.code,
            denyReason: pep.liveRationale,
            outcome: "DeniedByPolicy",
            scheduleId
          });
          throw new AppServiceError(
            "Policy enforcement denied this scheduled run. No task was queued.",
            409,
            "schedule_policy_pep_denied"
          );
        }
        scheduleAllowances.push(pep.allowance);
      }
      const scheduleExecutionAllowance = scheduleAllowances[0];

      const isSnapshotSchedule =
        !wantsCommunityValidation &&
        (schedule.missionType === "ValidationSnapshot" ||
          schedule.missionType === "ContinuousValidation");

      const previousSnapshot = schedule.lastSnapshotId
        ? await loadValidationSnapshot(prisma, context, schedule.lastSnapshotId)
        : null;
      let snapshot: ValidationSnapshot | null = null;
      let nonSnapshotPackInfo: ScheduledNonSnapshotPackInfo | null = null;
      let communityStartInfo: ScheduledCommunityStartInfo | null = null;
      if (wantsCommunityValidation) {
        // Opt-in Community pack: start engines per verified scope. Snapshot
        // composition is a separate product path and is not implied here.
        // Multi-scope: each bound verified scope is started independently
        // (ValidationSnapshot already allows multi-scope binding; first-only
        // would silently skip authorized scope).
        if (typeof this.startCommunityValidation !== "function") {
          throw new AppServiceError(
            "Community validation start is not available on this runtime.",
            500,
            "schedule_community_validation_unavailable"
          );
        }
        const failures: ScheduledCommunityStartInfo["failures"] = [];
        const missionIds: string[] = [];
        const moduleIds: string[] = [];
        const nucleiMissionIds: string[] = [];
        for (const scope of scopes) {
          if (scope.verificationStatus !== "Verified") {
            continue;
          }
          const decision = policyDecisions.find(
            (row) => row.scopeId === scope.scopeId
          );
          if (!decision) {
            failures.push({
              reason: "Schedule fire has no policy decision for this scope.",
              scopeId: scope.scopeId
            });
            continue;
          }
          try {
            const started = await this.startCommunityValidation(context, {
              policyDecisionId: decision.policyDecisionId,
              scopeId: scope.scopeId
            });
            if (started.mission.status === "DeniedByPolicy") {
              failures.push({
                reason:
                  "Policy denied the Community pack for this scope. No task was queued.",
                scopeId: scope.scopeId
              });
              continue;
            }
            missionIds.push(started.mission.missionId);
            moduleIds.push(...started.moduleIds);
            if (started.nucleiMissionId) {
              nucleiMissionIds.push(started.nucleiMissionId);
            }
          } catch (error) {
            failures.push({
              reason:
                error instanceof AppServiceError
                  ? error.message
                  : "Community validation did not start.",
              scopeId: scope.scopeId
            });
          }
        }
        if (missionIds.length === 0) {
          const denyReason =
            failures[0]?.reason ??
            "Community validation did not start. No task was queued.";
          config = appendScheduleRunHistory(
            {
              ...config,
              lastCommunityStart: {
                failures,
                missionIds,
                moduleIds: [...new Set(moduleIds)],
                nucleiMissionIds,
                startedAt: new Date().toISOString()
              }
            },
            {
              denyReason,
              missionId: null,
              outcome: "Failed",
              scheduledAt: new Date().toISOString(),
              snapshotId: null
            }
          );
          await prisma.missionSchedule.update({
            data: { config: config as Prisma.InputJsonValue },
            where: { scheduleId }
          });
          await emitTenantWebhook(context.tenant.tenantId, "schedule.failed", {
            denyReason,
            outcome: "Failed",
            scheduleId
          });
          throw new AppServiceError(
            `${denyReason} Snapshot report was not composed.`,
            409,
            "schedule_community_validation_failed"
          );
        }
        communityStartInfo = {
          failures,
          missionIds,
          moduleIds: [...new Set(moduleIds)],
          nucleiMissionIds
        };
        await writeAuditEvent(prisma, {
          action: "mission.created",
          actorType: "System",
          entityId: missionIds[0]!,
          entityType: "ValidationMission",
          metadata: {
            communityValidation: true,
            failures,
            missionIds,
            nucleiMissionIds,
            scheduleId,
            stage: "schedule_fire"
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      } else if (
        schedule.missionType === "ValidationSnapshot" ||
        schedule.missionType === "ContinuousValidation"
      ) {
        snapshot = await this.createSnapshot(context, {
          audience:
            typeof config.audience === "string"
              ? config.audience
              : "Security Team",
          maxTopItems:
            typeof config.maxTopItems === "number" ? config.maxTopItems : 5
        });
      } else {
        // Non-snapshot scheduled support (AIAppValidation / ControlValidation / FixVerification).
        // Creates mission + run + enqueues for worker. Uses schedule.config for richer target if supplied
        // (e.g. { aiAppId, controlSourceId, remediationId }).
        // Note: billing entitlement ("ValidationRuns") is enforced at mission execution / start time in practice;
        // requiring here broke plain dev tenants in acceptance (402). Gate at start if stricter policy needed.

        if (!scheduleExecutionAllowance) {
          throw new AppServiceError(
            "Schedule fire requires a PEP allowance before queueing work.",
            409,
            "schedule_policy_pep_denied"
          );
        }

        const cfgTarget =
          config && typeof config === "object" ? asRecord(config.target) : {};
        const baseTarget = {
          scheduled: true,
          missionType: schedule.missionType,
          ...cfgTarget
        };

        let chosenModuleId = "ai_app.safe_validation";
        if (schedule.missionType === "ControlValidation") {
          chosenModuleId = "atomic.control_validation_safe";
        } else if (schedule.missionType === "FixVerification") {
          chosenModuleId = "periscan.fix_verification.compare";
        } else if (schedule.missionType === "AIAppValidation") {
          chosenModuleId = "ai_app.safe_validation";
        }

        // Create draft pack first so we can link its id into the mission/run targets
        // for later evidence attachment and reporting.
        const derivedPackType =
          schedule.missionType === "ControlValidation"
            ? EvidencePackType.ControlValidationReport
            : schedule.missionType === "AIAppValidation"
              ? EvidencePackType.AIAppValidationReport
              : schedule.missionType === "FixVerification"
                ? EvidencePackType.FixVerificationReport
                : EvidencePackType.ValidationSnapshotReport;

        const evidencePack = await prisma.evidencePack.create({
          data: {
            audience:
              typeof config.audience === "string"
                ? config.audience
                : "Security Team",
            evidenceIds: [],
            packType: derivedPackType,
            redactionLevel: "Moderate",
            status: "Draft",
            tenantId: context.tenant.tenantId,
            title: `${schedule.missionType} (scheduled ${new Date().toISOString().slice(0, 10)})`
          }
        });

        const runExtra: Record<string, unknown> = {
          ...baseTarget,
          scheduleId,
          evidencePackId: evidencePack.evidencePackId,
          packType: derivedPackType
        };

        // Substance enrichment: for AI/Fix non-snap, ensure key fields are at root of target for module contract
        // (picker already puts aiAppId/controlSourceId/remediationId inside .target in config; we surface + normalize)
        if (
          schedule.missionType === "AIAppValidation" &&
          typeof runExtra.aiAppId === "string" &&
          typeof runExtra.endpointUrl !== "string"
        ) {
          runExtra.endpointUrl = `https://ai-app-${runExtra.aiAppId.slice(0, 8)}.example.test`;
        }
        if (
          schedule.missionType === "FixVerification" &&
          typeof runExtra.remediationId === "string"
        ) {
          // pass through; module expects it at target root
        }

        const mission = await prisma.validationMission.create({
          data: {
            missionType: schedule.missionType,
            policyDecisionId: policyDecisions[0]?.policyDecisionId ?? null,
            status: "Queued",
            tenantId: context.tenant.tenantId,
            requestedBy: context.user.userId,
            safetyLevel: "ActiveNonInvasive",
            scopeId: schedule.scopeIds[0] || "",
            scopeIds: schedule.scopeIds
            // no arbitrary target on mission; use run target for links
          }
        });

        // P10-2: auto-select runner by site/segment affinity when preferred unset.
        // Soft preferredRunnerId ranks first; hard mismatch still denied at task gates.
        const affinityRunnerId = await resolveScheduledRunnerId(
          prisma,
          context.tenant.tenantId,
          config,
          scopes
        );

        const runTarget = {
          ...runExtra,
          moduleHint: chosenModuleId,
          ...(affinityRunnerId
            ? {
                affinitySelectedRunnerId: affinityRunnerId,
                preferredRunnerId:
                  typeof config.preferredRunnerId === "string"
                    ? config.preferredRunnerId
                    : null
              }
            : {})
        };
        const run = await prisma.validationRun.create({
          data: {
            missionId: mission.missionId,
            moduleId: chosenModuleId,
            policyDecisionId: policyDecisions[0]?.policyDecisionId ?? null,
            runnerId: affinityRunnerId,
            status: "Queued",
            safetyLevel: "ActiveNonInvasive",
            scopeId: schedule.scopeIds[0] || "",
            target: runTarget,
            tenantId: context.tenant.tenantId,
            evidenceIds: []
          }
        });

        const jobId = randomUUID();
        const payload: ValidationJobPayload = {
          jobId,
          missionId: mission.missionId,
          runId: run.runId,
          tenantId: context.tenant.tenantId
        };
        await enqueueWithExecutionPolicy(
          missionQueue,
          scheduleExecutionAllowance,
          payload
        );

        nonSnapshotPackInfo = {
          missionId: mission.missionId,
          evidencePackId: evidencePack.evidencePackId,
          packType: derivedPackType,
          runId: run.runId,
          // Rich info for CTEM + UI lastDiff
          evidenceCount: 0, // populated on completion by processor
          moduleId: chosenModuleId,
          status: "queued"
        };

        snapshot = nonSnapshotPackInfo as unknown as ValidationSnapshot;

        // Slice G: Deep wire of Frontier / model-gateway into non-snapshot scheduled missions
        // (ControlValidation, AIAppValidation, FixVerification). When the tenant package
        // grants "Model-assisted remediation" (or similar) *and* the tenant has configured
        // model providers + policy profiles, we automatically create a model session for
        // analysis of the scheduled run. This ties model context (redacted) to the
        // validation/fix outcome. Safe no-op in envs without providers (tests, basic tenants).
        try {
          const tenantRec = await prisma.tenant.findUnique({
            where: { tenantId: context.tenant.tenantId },
            select: { billingPackageKey: true }
          });
          const activePkg = BILLING_PACKAGE_CATALOG.find(
            (p) => p.packageKey === tenantRec?.billingPackageKey
          );
          const hasAssist = !!activePkg?.includedCapabilities?.some(
            (c) =>
              /model|frontier|assist/i.test(c) ||
              c === "Model-assisted remediation"
          );
          if (hasAssist) {
            const [provider, profile] = await Promise.all([
              prisma.modelProvider.findFirst({
                where: { tenantId: context.tenant.tenantId }
              }),
              prisma.modelPolicyProfile.findFirst({
                where: { tenantId: context.tenant.tenantId }
              })
            ]);
            if (provider && profile) {
              const sess = await this.createModelSession(context, {
                modelProviderId: provider.modelProviderId,
                modelPolicyProfileId: profile.modelPolicyProfileId,
                purpose: `Automated Frontier analysis for scheduled ${schedule.missionType}`,
                scopeIds: schedule.scopeIds,
                mode: "SafeValidation"
              }).catch(() => null);

              if (sess?.modelSessionId) {
                // Enqueue an initial turn so Frontier actually processes analysis for this non-snap run.
                await this.enqueueModelSessionTurn(
                  context,
                  sess.modelSessionId,
                  {
                    prompt: `Provide a concise analysis of the scheduled ${schedule.missionType} run. Highlight key observations, risks, or recommended actions based on the mission context.`,
                    queueLane: "Standard"
                  }
                ).catch(() => {
                  // Model turns are advisory; the queued validation run remains valid.
                });

                // Surface the model session in the non-snap result for UI/results/CTEM linkage.
                if (nonSnapshotPackInfo) {
                  nonSnapshotPackInfo.modelSessionId = sess.modelSessionId;
                }
                // Persist linkage on pack for synth/consumption in reports/CTEM (BUILD-L)
                await prisma.evidencePack
                  .update({
                    where: { evidencePackId: evidencePack.evidencePackId },
                    data: {
                      title: `${evidencePack.title} | model:${sess.modelSessionId.slice(0, 8)}`
                    }
                  })
                  .catch(() => {});
              }
            }
          }
        } catch {
          // best effort only
        }
      }

      // Wave C: ContinuousValidation also queues allowlisted safe external/recon
      // modules on verified scopes (External PoA + recon). Snapshot path above
      // still computes path/risk drift — not a living map claim.
      let continuousEasmMissionId: string | null = null;
      let continuousEasmModuleIds: string[] = [];
      if (
        schedule.missionType === "ContinuousValidation" &&
        scheduleExecutionAllowance
      ) {
        const easmQueue = await queueContinuousEasmForSchedule({
          affinityConfig: config,
          context,
          missionQueue,
          prisma,
          scheduleId,
          scheduleExecutionAllowance,
          scheduleAllowances,
          scopes,
          configModuleIds: config.moduleIds
        });
        continuousEasmMissionId = easmQueue.missionId;
        continuousEasmModuleIds = easmQueue.moduleIds;
      }

      let diff: ScheduleDiff = communityStartInfo
        ? buildCommunityScheduleDiff(communityStartInfo)
        : nonSnapshotPackInfo
          ? buildNonSnapshotScheduleDiff(nonSnapshotPackInfo)
          : {
              addedPathIds: [],
              currentSnapshotId: schedule.scheduleId,
              previousSnapshotId: null,
              removedPathIds: [],
              reopenedPathIds: [],
              riskScoreDelta: 0,
              status: "NoPreviousRun",
              summary: "Scheduled run did not produce a snapshot result."
            };
      if (isSnapshotSchedule) {
        if (!snapshot) {
          throw new AppServiceError(
            "Scheduled snapshot did not produce a result.",
            500,
            "schedule_snapshot_missing"
          );
        }
        diff = buildScheduleDiff({
          current: snapshot,
          previous: previousSnapshot
        });
        if (schedule.missionType === "ContinuousValidation") {
          diff = {
            ...diff,
            summary: enrichContinuousEasmDiffSummary({
              baseSummary: diff.summary,
              moduleIds: continuousEasmModuleIds,
              missionQueued: Boolean(continuousEasmMissionId)
            })
          };
        }
      }

      if (isSnapshotSchedule && diff.reopenedPathIds.length > 0) {
        // Capture the prior path state/basis BEFORE flipping to Reopened so the
        // verification record can describe what regressed.
        const reopenedPaths = await prisma.attackPath.findMany({
          select: {
            evidenceBasis: true,
            pathId: true,
            validationState: true
          },
          where: {
            pathId: {
              in: diff.reopenedPathIds
            },
            tenantId: context.tenant.tenantId
          }
        });
        const pathInfo = new Map(
          reopenedPaths.map((path) => [path.pathId, path])
        );

        await prisma.attackPath.updateMany({
          data: {
            validationState: "Reopened"
          },
          where: {
            pathId: {
              in: diff.reopenedPathIds
            },
            tenantId: context.tenant.tenantId
          }
        });

        // Reopening a remediation is a verification outcome — write a
        // VerificationEvent so the regression is auditable (it was a status
        // change with no proof record before). A scheduled snapshot diff is not a
        // measured re-fetch, so measuredRevalidation=false / retestMethod=schedule-diff.
        const reopenedRemediations = await prisma.remediationTask.findMany({
          where: {
            relatedPathId: {
              in: diff.reopenedPathIds
            },
            tenantId: context.tenant.tenantId
          }
        });
        const reopenedAt = new Date();
        for (const remediation of reopenedRemediations) {
          await prisma.remediationTask.update({
            data: {
              nextVerificationAt: null,
              status: "Reopened"
            },
            where: {
              remediationId: remediation.remediationId
            }
          });
          const info = remediation.relatedPathId
            ? pathInfo.get(remediation.relatedPathId)
            : undefined;
          await prisma.verificationEvent.create({
            data: buildReopenVerificationEventData({
              pathEvidenceBasis: info?.evidenceBasis ?? null,
              remediation,
              tenantId: context.tenant.tenantId,
              verifiedAt: reopenedAt
            })
          });
        }
      }

      const lastDiffForUpdate = communityStartInfo
        ? ({
            ...diff,
            communityValidation: true,
            missionIds: communityStartInfo.missionIds,
            moduleIds: communityStartInfo.moduleIds,
            nucleiMissionIds: communityStartInfo.nucleiMissionIds
          } as unknown as Prisma.InputJsonValue)
        : !isSnapshotSchedule && nonSnapshotPackInfo
          ? (nonSnapshotPackInfo as unknown as Prisma.InputJsonValue)
          : (diff as unknown as Prisma.InputJsonValue);

      const missionId =
        communityStartInfo?.missionIds[0] ??
        continuousEasmMissionId ??
        snapshot?.missionId ??
        nonSnapshotPackInfo?.missionId ??
        null;
      const successConfig = appendScheduleRunHistory(
        {
          ...config,
          ...(communityStartInfo
            ? {
                communityMissionIds: communityStartInfo.missionIds,
                lastCommunityStart: {
                  failures: communityStartInfo.failures,
                  missionIds: communityStartInfo.missionIds,
                  moduleIds: communityStartInfo.moduleIds,
                  note: "Community pack start; snapshot report is separate.",
                  nucleiMissionIds: communityStartInfo.nucleiMissionIds,
                  startedAt: new Date().toISOString()
                }
              }
            : {}),
          ...(continuousEasmModuleIds.length
            ? {
                continuousEasm: {
                  moduleIds: continuousEasmModuleIds,
                  missionId: continuousEasmMissionId,
                  note: "Allowlisted safe continuous EASM only; not living map."
                }
              }
            : {})
        },
        {
          missionId,
          outcome: "Succeeded",
          scheduledAt: new Date().toISOString(),
          snapshotId: snapshot?.snapshotId ?? null
        }
      );

      const updated = await prisma.missionSchedule.update({
        data: {
          config: successConfig as Prisma.InputJsonValue,
          lastDiff: lastDiffForUpdate,
          lastMissionId: missionId ?? "",
          lastRunAt: new Date(),
          ...(isSnapshotSchedule && snapshot?.snapshotId
            ? { lastSnapshotId: snapshot.snapshotId }
            : {}),
          nextRunAt: calculateNextRunAt(
            schedule.frequency,
            new Date(),
            timingFromSchedule({ ...schedule, config: successConfig })
          )
        },
        where: {
          scheduleId
        }
      });

      return {
        diff,
        schedule: serializeMissionSchedule(updated),
        snapshot
      };
    },

    async runDueSchedules(this: AppServices, context) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "run due schedules"
      );

      const dueSchedules = await prisma.missionSchedule.findMany({
        orderBy: {
          nextRunAt: "asc"
        },
        where: {
          nextRunAt: {
            lte: new Date()
          },
          status: "Active",
          tenantId: context.tenant.tenantId
        }
      });
      const results: ScheduledRunResult[] = [];

      for (const schedule of dueSchedules) {
        try {
          results.push(await this.runSchedule(context, schedule.scheduleId));
        } catch (error) {
          // Lost the CAS claim to a concurrent sweep/instance — not a tenant failure.
          if (
            error instanceof AppServiceError &&
            error.code === "schedule_already_claimed"
          ) {
            continue;
          }
          throw error;
        }
      }

      return {
        results,
        runCount: results.length
      };
    }
  };
}
