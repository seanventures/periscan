// @ts-nocheck
import { randomUUID } from "node:crypto";

import {
  evaluateModuleStartConstraints,
  getModuleById
} from "@periscan/modules";
import { evaluatePolicy } from "@periscan/policy";
import type { Prisma } from "@prisma/client";

import {
  buildCommunityValidationTarget,
  COMMUNITY_EDITION_ID,
  COMMUNITY_MISSION_POLICY_PROFILE,
  COMMUNITY_NUCLEI_DENIED_SKIP_REASON,
  COMMUNITY_NUCLEI_MISSION_POLICY_PROFILE,
  COMMUNITY_NUCLEI_MODULE_ID,
  COMMUNITY_NUCLEI_SIBLING_WINDOW_MS,
  communityPolicyCoversStartSet,
  communityStartSetExecutionEnvironment,
  communityValidationSafetyLevel,
  communityValidationStartLane,
  isCommunityValidationModuleId,
  isCopyleftOptInModuleId,
  COPYLEFT_OPT_IN_SUITE,
  COPYLEFT_OPT_IN_VALUE_LINE,
  UPSTREAM_LICENSE_ACCEPTED_TOOL_IDS_KEY,
  listCopyleftOptInSuiteForScopeType,
  COMMUNITY_EDITION_LICENSE_NOTE,
  COMMUNITY_EDITION_VALUE_LINE,
  listCommunityValidationDeferredModules,
  listCommunityValidationStartModules,
  listCommunityValidationSuiteForScopeType,
  selectCommunityNucleiCompanionMissionId,
  selectConnectedAwsIntegrationForProwler,
  isRunnerDispatchableModuleId,
  pickRunnerIdByAffinity,
  resolveRunnerRoutingHint,
  summarizeCommunityMissionRuns,
  targetIncludesFixtureHints,
  toRunnerAffinityCandidate,
  VALIDATION_QUEUE_NAME,
  type CommunityValidationCompanion,
  type CommunityValidationSuiteResponse,
  type CommunityValidationStartResult,
  type StartCommunityValidationRequest,
  type ValidationJobPayload
} from "@periscan/shared";

import {
  enforceExecutionPolicy,
  enqueueWithExecutionPolicy
} from "../policy-enforcement-point.js";
import {
  serializePolicyDecision,
  serializeScope,
  serializeValidationMission,
  serializeValidationRun
} from "../serializers/entities.js";
import {
  AppServiceError,
  evaluateExternalValidationExecution,
  assertTenantQueueCapacity,
  isSafetyLevelAllowedForMission,
  loadDestructiveValidationAuthorized,
  loadOffensiveValidationAuthorized,
  requireRole,
  requireApiKeyCapability,
  SCOPE_EDITOR_ROLES,
  serializeJob,
  TENANT_ADMIN_ROLES,
  writeAuditEvent,
  requireCapability,
  writePolicyBindingMismatchAudit,
  signRunnerTaskEnvelope,
  getRunnerControlPlaneUrl,
  buildScopeConstraints,
  addSeconds
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import { resolveQueueMaxPerTenant } from "../mission-queue.js";
import {
  cloudAccountScopeMatchesIntegration,
  verifyDnsTxtScope,
  verifyRepositoryAuthorizationFile
} from "../scope-verification.js";
import { getDisabledThirdPartyToolIdsForTenant } from "./third-party-tools.js";

/** Run statuses that will not progress without external action. */
export const TERMINAL_VALIDATION_RUN_STATUSES = new Set([
  "Completed",
  "Failed",
  "DeniedByPolicy",
  "RequiresApproval",
  "Cancelled"
]);

/** Missions that may enter startMission's destructive queue path. */
export const STARTABLE_MISSION_STATUSES = new Set([
  "Draft",
  "RequiresApproval"
]);

/** Active run/job statuses safe to mark Failed on enqueue cleanup. */
const ENQUEUE_FAILABLE_STATUSES = [
  "Queued",
  "Running",
  "RequiresApproval"
] as const;

export const MISSION_RUN_WAIT_DEFAULT_TIMEOUT_MS = 30_000;
export const MISSION_RUN_WAIT_MAX_TIMEOUT_MS = 60_000;
const MISSION_RUN_WAIT_POLL_INTERVAL_MS = 250;

export function isMissionStartable(status: string): boolean {
  return STARTABLE_MISSION_STATUSES.has(status);
}

async function listLicensedCopyleftToolIds(
  prisma: { toolLicenseAcceptance: { findMany: Function } },
  tenantId: string
): Promise<string[]> {
  const rows = await prisma.toolLicenseAcceptance.findMany({
    select: { toolId: true },
    where: {
      tenantId,
      toolId: { in: [...COPYLEFT_OPT_IN_SUITE.map((entry) => entry.toolId)] }
    }
  });
  return [...new Set(rows.map((row) => row.toolId))];
}

function stampUpstreamLicenses(
  target: Record<string, unknown>,
  licensedToolIds: string[]
): Record<string, unknown> {
  if (licensedToolIds.length === 0) return target;
  return {
    ...target,
    [UPSTREAM_LICENSE_ACCEPTED_TOOL_IDS_KEY]: licensedToolIds
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function clampMissionRunWaitTimeoutMs(timeoutMs: number): number {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
    return MISSION_RUN_WAIT_DEFAULT_TIMEOUT_MS;
  }

  return Math.min(Math.floor(timeoutMs), MISSION_RUN_WAIT_MAX_TIMEOUT_MS);
}

export function isTerminalValidationRunStatus(status: string): boolean {
  return TERMINAL_VALIDATION_RUN_STATUSES.has(status);
}

/** Connected CloudAccount AWS only — not Bedrock/WAF/ECR siblings. */
export const CONNECTED_AWS_INTEGRATION_CANDIDATE_WHERE = {
  status: "Connected",
  OR: [
    { vendor: { contains: "AWS", mode: "insensitive" as const } },
    { product: { contains: "AWS", mode: "insensitive" as const } }
  ]
};

export async function findConnectedAwsIntegrationForProwler(
  prisma: RuntimeServiceDeps["prisma"],
  tenantId: string
): Promise<{ integrationId: string } | null> {
  const candidates = await prisma.integration.findMany({
    select: {
      integrationId: true,
      product: true,
      status: true,
      vendor: true
    },
    where: {
      ...CONNECTED_AWS_INTEGRATION_CANDIDATE_WHERE,
      tenantId
    }
  });
  const selected = selectConnectedAwsIntegrationForProwler(candidates);
  return selected ? { integrationId: selected.integrationId } : null;
}

// Validation mission, job, scope-verification, and policy-decision service group
// (D1 Phase 2 closure decomposition).
export function createValidationServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "approvePolicyDecision"
  | "cancelMission"
  | "createMission"
  | "denyPolicyDecision"
  | "createCommunityMissionRemediations"
  | "getCommunityValidationCompanion"
  | "getCommunityValidationSuite"
  | "getJob"
  | "getMission"
  | "getMissionRun"
  | "listJobs"
  | "listExternalValidationAttempts"
  | "listMissionRuns"
  | "listMissions"
  | "listPendingApprovals"
  | "listPolicyDecisions"
  | "previewPolicyDecision"
  | "startCommunityValidation"
  | "startMission"
  | "verifyScope"
  | "waitMissionRun"
> {
  const {
    devMode,
    emitTenantWebhook,
    externalValidationConfig,
    externalValidationRateState,
    missionQueue,
    prisma
  } = deps;

  return {
    async listExternalValidationAttempts(context) {
      const missions = await prisma.validationMission.findMany({
        include: {
          validationRuns: {
            orderBy: {
              createdAt: "asc"
            }
          }
        },
        orderBy: [
          {
            createdAt: "desc"
          },
          {
            missionId: "desc"
          }
        ],
        take: 50,
        where: {
          missionType: "ExposureValidation",
          tenantId: context.tenant.tenantId,
          OR: [
            {
              policyDecision: {
                executionEnvironment: "ExternalPoA"
              }
            },
            {
              validationRuns: {
                some: {
                  moduleId: "nuclei.external_exposure_safe"
                }
              }
            }
          ]
        }
      });

      return missions.map((mission) => ({
        mission: serializeValidationMission(mission),
        runs: mission.validationRuns.map(serializeValidationRun)
      }));
    },

    async listMissions(context, input = {}) {
      const limit =
        input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 50;
      const missions = await prisma.validationMission.findMany({
        ...(input.cursor
          ? {
              cursor: {
                missionId: input.cursor
              },
              skip: 1
            }
          : {}),
        orderBy: [
          {
            createdAt: "desc"
          },
          {
            missionId: "desc"
          }
        ],
        take: limit + 1,
        where: {
          tenantId: context.tenant.tenantId
        }
      });
      const hasMore = missions.length > limit;
      const page = hasMore ? missions.slice(0, limit) : missions;

      return {
        items: page.map(serializeValidationMission),
        nextCursor: hasMore ? (page[page.length - 1]?.missionId ?? null) : null
      };
    },

    async getMission(context, missionId) {
      const mission = await prisma.validationMission.findFirst({
        where: {
          missionId,
          tenantId: context.tenant.tenantId
        }
      });

      return mission ? serializeValidationMission(mission) : null;
    },

    async getMissionRun(context, missionId, runId) {
      const run = await prisma.validationRun.findFirst({
        where: {
          missionId,
          runId,
          tenantId: context.tenant.tenantId
        }
      });

      return run ? serializeValidationRun(run) : null;
    },

    async waitMissionRun(context, missionId, runId, input = {}) {
      const timeoutMs = clampMissionRunWaitTimeoutMs(
        input.timeoutMs ?? MISSION_RUN_WAIT_DEFAULT_TIMEOUT_MS
      );
      const deadline = Date.now() + timeoutMs;

      for (;;) {
        const run = await prisma.validationRun.findFirst({
          where: {
            missionId,
            runId,
            tenantId: context.tenant.tenantId
          }
        });

        if (!run) {
          return null;
        }

        const serialized = serializeValidationRun(run);
        if (isTerminalValidationRunStatus(serialized.status)) {
          return {
            run: serialized,
            timedOut: false
          };
        }

        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          return {
            run: serialized,
            timedOut: true
          };
        }

        await delay(Math.min(MISSION_RUN_WAIT_POLL_INTERVAL_MS, remainingMs));
      }
    },

    async listMissionRuns(context, missionId) {
      const mission = await prisma.validationMission.findFirst({
        where: {
          missionId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!mission) {
        throw new AppServiceError(
          "Mission not found.",
          404,
          "mission_not_found"
        );
      }

      const runs = await prisma.validationRun.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          missionId: mission.missionId,
          tenantId: context.tenant.tenantId
        }
      });

      return runs.map(serializeValidationRun);
    },

    async cancelMission(context, missionId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "cancel missions"
      );

      const mission = await prisma.validationMission.findFirst({
        where: {
          missionId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!mission) {
        throw new AppServiceError(
          "Mission not found.",
          404,
          "mission_not_found"
        );
      }

      if (mission.status === "Cancelled") {
        return serializeValidationMission(mission);
      }

      if (
        mission.status === "Completed" ||
        mission.status === "Failed" ||
        mission.status === "DeniedByPolicy"
      ) {
        throw new AppServiceError(
          `Mission cannot be cancelled from state ${mission.status}.`,
          409,
          "mission_not_cancellable"
        );
      }

      const cancelledAt = new Date();
      const updatedMission = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const updated = await tx.validationMission.update({
            where: {
              missionId: mission.missionId
            },
            data: {
              completedAt: cancelledAt,
              status: "Cancelled"
            }
          });

          await tx.validationRun.updateMany({
            where: {
              missionId: mission.missionId,
              status: {
                in: ["Queued", "Running", "RequiresApproval"]
              },
              tenantId: context.tenant.tenantId
            },
            data: {
              completedAt: cancelledAt,
              errorSummary: "Cancelled by requester.",
              status: "Cancelled"
            }
          });

          await tx.job.updateMany({
            where: {
              missionId: mission.missionId,
              status: {
                in: ["Queued", "Running", "RequiresApproval"]
              },
              tenantId: context.tenant.tenantId
            },
            data: {
              completedAt: cancelledAt,
              errorMessage: "Cancelled by requester.",
              status: "Cancelled"
            }
          });

          await writeAuditEvent(tx, {
            action: "mission.cancelled",
            actorType: "User",
            entityId: mission.missionId,
            entityType: "ValidationMission",
            metadata: {
              previousStatus: mission.status
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });

          return updated;
        }
      );

      return serializeValidationMission(updatedMission);
    },

    async getJob(context, jobId) {
      const job = await prisma.job.findFirst({
        where: {
          jobId,
          tenantId: context.tenant.tenantId
        }
      });

      return job ? serializeJob(job) : null;
    },

    async listJobs(context, input) {
      const limit =
        input.limit && input.limit > 0 ? Math.min(input.limit, 200) : 50;
      const jobs = await prisma.job.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: limit,
        where: {
          missionId: input.missionId ?? undefined,
          status: input.status ?? undefined,
          tenantId: context.tenant.tenantId
        }
      });

      return jobs.map(serializeJob);
    },

    async createMission(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create missions"
      );
      // ICP-P1-9: draft create is still mission automation — require mission:run
      // for API keys (admin/write expand to it). Session users rely on role only.
      requireApiKeyCapability(context, "mission:run", "create missions");

      // P2.a: an execution mission binds a single PolicyDecision to a single
      // scope, and startMission only creates runs for mission.scopeId. Accepting
      // extra scopeIds here would silently drop them (and skip "every run needs a
      // policy decision"). Multi-scope is supported only on the validation
      // snapshot path, so reject multi-scope execution missions explicitly rather
      // than fabricating partial coverage.
      const requestedScopeIds = input.scopeIds?.length
        ? [...new Set(input.scopeIds)]
        : [input.scopeId];

      if (
        requestedScopeIds.length > 1 ||
        requestedScopeIds.some((scopeId) => scopeId !== input.scopeId)
      ) {
        throw new AppServiceError(
          "Execution missions run a single scope; create one mission per scope. Multi-scope coverage is only available through validation snapshots.",
          400,
          "multi_scope_mission_unsupported"
        );
      }

      const scopeIds = [input.scopeId];
      const scopes = await prisma.scope.findMany({
        where: {
          scopeId: {
            in: scopeIds
          },
          tenantId: context.tenant.tenantId
        }
      });

      if (scopes.length !== scopeIds.length) {
        throw new AppServiceError(
          "One or more scopes were not found for this tenant.",
          404,
          "scope_not_found"
        );
      }

      if (input.policyDecisionId) {
        const decision = await prisma.policyDecision.findFirst({
          where: {
            policyDecisionId: input.policyDecisionId,
            tenantId: context.tenant.tenantId
          }
        });

        if (!decision) {
          throw new AppServiceError(
            "Policy decision not found.",
            404,
            "policy_decision_not_found"
          );
        }

        if (decision.scopeId !== input.scopeId) {
          await writePolicyBindingMismatchAudit(prisma, context, decision, {
            attemptedMissionType: input.missionType,
            attemptedSafetyLevel: input.safetyLevel,
            attemptedScopeId: input.scopeId,
            code: "policy_decision_scope_mismatch",
            stage: "create"
          });
          throw new AppServiceError(
            "Policy decision must match the mission scope.",
            400,
            "policy_decision_scope_mismatch"
          );
        }

        if (decision.missionType !== input.missionType) {
          await writePolicyBindingMismatchAudit(prisma, context, decision, {
            attemptedMissionType: input.missionType,
            attemptedSafetyLevel: input.safetyLevel,
            attemptedScopeId: input.scopeId,
            code: "policy_decision_mission_type_mismatch",
            stage: "create"
          });
          throw new AppServiceError(
            "Policy decision must match the mission type.",
            400,
            "policy_decision_mission_type_mismatch"
          );
        }

        if (decision.safetyLevel !== input.safetyLevel) {
          await writePolicyBindingMismatchAudit(prisma, context, decision, {
            attemptedMissionType: input.missionType,
            attemptedSafetyLevel: input.safetyLevel,
            attemptedScopeId: input.scopeId,
            code: "policy_decision_safety_level_mismatch",
            stage: "create"
          });
          throw new AppServiceError(
            "Policy decision must match the mission safety level.",
            400,
            "policy_decision_safety_level_mismatch"
          );
        }
      }

      await requireCapability(prisma, context, "ValidationRuns");

      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: input.missionType,
          policyDecisionId: input.policyDecisionId ?? null,
          policyProfile: input.policyProfile ?? null,
          requestedBy: context.user.userId,
          safetyLevel: input.safetyLevel,
          scopeId: input.scopeId,
          scopeIds,
          status: "Draft",
          tenantId: context.tenant.tenantId
        }
      });

      await writeAuditEvent(prisma, {
        action: "mission.created",
        actorType: "User",
        entityId: mission.missionId,
        entityType: "ValidationMission",
        metadata: {
          missionType: mission.missionType,
          scopeId: mission.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeValidationMission(mission);
    },

    async startMission(context, missionId, input, requestId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "start missions"
      );
      requireApiKeyCapability(context, "mission:run", "start missions");

      await requireCapability(prisma, context, "ValidationRuns");

      // Per-tenant queue backpressure: reject before creating runs/jobs so one
      // tenant can't starve the shared validation queue. No-op unless
      // PERISCAN_QUEUE_MAX_PER_TENANT is set.
      await assertTenantQueueCapacity({
        countPending: () =>
          missionQueue.countTenantPending?.(context.tenant.tenantId) ??
          Promise.resolve(0),
        limit: resolveQueueMaxPerTenant(),
        onDenied: async (pending) => {
          await writeAuditEvent(prisma, {
            action: "queue.tenant_limited",
            actorType: "User",
            entityId: context.tenant.tenantId,
            entityType: "Tenant",
            metadata: {
              limit: resolveQueueMaxPerTenant(),
              pending,
              surface: "startMission"
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });
        },
        tenantId: context.tenant.tenantId
      });

      const operationStartedAt = Date.now();

      const mission = await prisma.validationMission.findFirst({
        where: {
          missionId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!mission) {
        throw new AppServiceError(
          "Mission not found.",
          404,
          "mission_not_found"
        );
      }

      // Refuse terminal / in-flight restarts before deleteMany of runs/jobs.
      // Re-starting Completed/Failed/Queued would wipe evidence-bearing history.
      if (!isMissionStartable(mission.status)) {
        throw new AppServiceError(
          `Mission cannot be started from state ${mission.status}.`,
          409,
          "mission_not_startable"
        );
      }

      if (!mission.policyDecisionId) {
        throw new AppServiceError(
          "Mission requires a policy decision before it can start.",
          400,
          "policy_decision_required"
        );
      }

      const decision = await prisma.policyDecision.findFirst({
        where: {
          policyDecisionId: mission.policyDecisionId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!decision) {
        throw new AppServiceError(
          "Policy decision not found.",
          404,
          "policy_decision_not_found"
        );
      }

      // Enforce full policy binding: decision must still match the mission it was issued for.
      // Binding mismatches throw (historical API contract); policy denials park the mission.
      if (decision.scopeId !== mission.scopeId) {
        await writePolicyBindingMismatchAudit(prisma, context, decision, {
          attemptedMissionType: mission.missionType,
          attemptedSafetyLevel: mission.safetyLevel,
          attemptedScopeId: mission.scopeId,
          code: "policy_decision_scope_mismatch",
          missionId: mission.missionId,
          stage: "start"
        });
        throw new AppServiceError(
          "Policy decision scope no longer matches mission.",
          400,
          "policy_decision_scope_mismatch"
        );
      }
      if (decision.missionType !== mission.missionType) {
        await writePolicyBindingMismatchAudit(prisma, context, decision, {
          attemptedMissionType: mission.missionType,
          attemptedSafetyLevel: mission.safetyLevel,
          attemptedScopeId: mission.scopeId,
          code: "policy_decision_mission_type_mismatch",
          missionId: mission.missionId,
          stage: "start"
        });
        throw new AppServiceError(
          "Policy decision mission type no longer matches mission.",
          400,
          "policy_decision_mission_type_mismatch"
        );
      }
      if (decision.safetyLevel !== mission.safetyLevel) {
        await writePolicyBindingMismatchAudit(prisma, context, decision, {
          attemptedMissionType: mission.missionType,
          attemptedSafetyLevel: mission.safetyLevel,
          attemptedScopeId: mission.scopeId,
          code: "policy_decision_safety_level_mismatch",
          missionId: mission.missionId,
          stage: "start"
        });
        throw new AppServiceError(
          "Policy decision safety level no longer matches mission.",
          400,
          "policy_decision_safety_level_mismatch"
        );
      }

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId: mission.scopeId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!scope) {
        throw new AppServiceError(
          "Mission scope not found.",
          404,
          "mission_scope_not_found"
        );
      }

      // P03-20: single Policy Enforcement Point — dual gate (stored + live
      // re-eval). Denied / RequiresApproval never mint an allowance and never queue.
      const pep = await enforceExecutionPolicy({
        decision,
        entrypoint: "mission_start",
        expected: {
          missionType: mission.missionType,
          safetyLevel: mission.safetyLevel,
          scopeId: mission.scopeId
        },
        missionId: mission.missionId,
        prisma,
        scope,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId,
        userRole: context.membership.role
      });

      if (pep.verdict === "RequiresApproval") {
        const updatedMission = await prisma.validationMission.update({
          where: {
            missionId: mission.missionId
          },
          data: {
            status: "RequiresApproval"
          }
        });

        return {
          jobsQueued: 0,
          mission: serializeValidationMission(updatedMission),
          runs: []
        };
      }

      if (pep.verdict === "Denied" || !pep.allowance) {
        const updatedMission = await prisma.validationMission.update({
          where: {
            missionId: mission.missionId
          },
          data: {
            status: "DeniedByPolicy"
          }
        });

        await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
          code: pep.code,
          missionId: mission.missionId,
          outcome: pep.liveOutcome ?? decision.outcome,
          policyDecisionId: decision.policyDecisionId,
          rationale: pep.liveRationale ?? decision.rationale,
          scopeId: decision.scopeId,
          stage: "mission_start"
        });

        return {
          jobsQueued: 0,
          mission: serializeValidationMission(updatedMission),
          runs: []
        };
      }

      const executionAllowance = pep.allowance;

      const modules = input.moduleIds.map((moduleId) => {
        const module = getModuleById(moduleId);

        if (!module) {
          throw new AppServiceError(
            `Module ${moduleId} not found.`,
            404,
            "module_not_found"
          );
        }

        if (
          !module.manifest.supportedMissionTypes.includes(mission.missionType)
        ) {
          throw new AppServiceError(
            `Module ${moduleId} does not support mission type ${mission.missionType}.`,
            400,
            "module_mission_type_mismatch"
          );
        }

        if (
          !isSafetyLevelAllowedForMission(
            mission.safetyLevel,
            module.manifest.safetyLevel
          )
        ) {
          throw new AppServiceError(
            `Module ${moduleId} exceeds the mission safety level.`,
            400,
            "module_safety_level_mismatch"
          );
        }

        return module;
      });

      const disabledToolIds = await getDisabledThirdPartyToolIdsForTenant(
        prisma,
        context.tenant.tenantId,
        modules.map((module) => module.manifest.moduleId)
      );

      if (disabledToolIds.length) {
        const updatedMission = await prisma.validationMission.update({
          where: {
            missionId: mission.missionId
          },
          data: {
            status: "DeniedByPolicy"
          }
        });

        const toolGovernanceRationale =
          "Tenant third-party tool governance disabled one or more required tool runtimes.";

        await writeAuditEvent(prisma, {
          action: "policy.decision",
          actorType: "System",
          entityId: decision.policyDecisionId,
          entityType: "Scope",
          metadata: {
            code: "third_party_tool_disabled",
            disabledToolIds,
            missionId: mission.missionId,
            moduleIds: modules.map((module) => module.manifest.moduleId),
            outcome: "Denied",
            rationale: toolGovernanceRationale,
            scopeId: scope.scopeId,
            toolGovernanceGuard: true
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
          code: "third_party_tool_disabled",
          missionId: mission.missionId,
          outcome: "Denied",
          policyDecisionId: decision.policyDecisionId,
          rationale: toolGovernanceRationale,
          scopeId: scope.scopeId,
          stage: "mission_start"
        });

        return {
          jobsQueued: 0,
          mission: serializeValidationMission(updatedMission),
          runs: []
        };
      }
      const decisionTarget =
        typeof decision.target === "object" && decision.target
          ? (decision.target as Record<string, unknown>)
          : {};

      if (
        mission.missionType === "ExposureValidation" &&
        input.target !== undefined &&
        Object.keys(decisionTarget).some(
          (key) =>
            JSON.stringify(input.target?.[key]) !==
            JSON.stringify(decisionTarget[key])
        )
      ) {
        await writePolicyBindingMismatchAudit(prisma, context, decision, {
          attemptedMissionType: mission.missionType,
          attemptedSafetyLevel: mission.safetyLevel,
          attemptedScopeId: mission.scopeId,
          code: "policy_decision_target_mismatch",
          missionId: mission.missionId,
          stage: "start"
        });
        throw new AppServiceError(
          "Policy decision target no longer matches mission start request.",
          400,
          "policy_decision_target_mismatch"
        );
      }

      const resolvedTargetBase = input.target ?? decisionTarget;
      const licensedCopyleft = await listLicensedCopyleftToolIds(
        prisma,
        context.tenant.tenantId
      );
      const resolvedTarget = stampUpstreamLicenses(
        resolvedTargetBase,
        licensedCopyleft
      );
      if (!devMode && targetIncludesFixtureHints(resolvedTarget)) {
        throw new AppServiceError(
          "Fixture mission targets are only available in dev mode.",
          400,
          "fixture_mode_disabled"
        );
      }

      // P10-2 residual: when caller omits runnerId, auto-select by site/segment
      // affinity from target routing fields and/or scope.segmentName. Preferred
      // is ranking-only; unbound hybrid (no topology hint) leaves runner null.
      // An explicit runnerId must be an enrolled runner in this tenant — never
      // trust a foreign/revoked/unknown id (FK 500 or cross-tenant task mint).
      const enrolledRunnerWhere = {
        killSwitchActive: false,
        status: { notIn: ["Revoked", "KillSwitchActive"] as const },
        tenantId: context.tenant.tenantId
      };
      let resolvedRunnerId: string | null = null;
      if (input.runnerId) {
        const owned = await prisma.runner.findFirst({
          select: { runnerId: true },
          where: {
            ...enrolledRunnerWhere,
            runnerId: input.runnerId
          }
        });
        resolvedRunnerId = owned?.runnerId ?? null;
      } else {
        const hint = resolveRunnerRoutingHint({
          scopeSegmentName: scope.segmentName ?? null,
          target:
            resolvedTarget && typeof resolvedTarget === "object"
              ? (resolvedTarget as Record<string, unknown>)
              : null
        });
        if (hint.preferredRunnerId || hint.siteId || hint.networkSegment) {
          const runners = await prisma.runner.findMany({
            select: {
              networkSegment: true,
              runnerId: true,
              segmentProfileId: true,
              siteId: true,
              status: true
            },
            where: enrolledRunnerWhere
          });
          resolvedRunnerId = pickRunnerIdByAffinity(
            runners.map((runner) => toRunnerAffinityCandidate(runner)),
            hint
          );
        }
      }
      // InternalRunner OSS/recon modules must not go to the BullMQ worker
      // (worker fail-closes). When the caller omitted runnerId, pick any
      // enrolled runner if affinity did not. A caller-supplied unknown id
      // stays null so the run fails honestly instead of minting a task.
      const needsInternalRunner = modules.some(
        (module) => module.manifest.executionMode === "InternalRunner"
      );
      if (needsInternalRunner && !resolvedRunnerId && !input.runnerId) {
        const enrolled = await prisma.runner.findFirst({
          orderBy: { updatedAt: "desc" },
          select: { runnerId: true },
          where: enrolledRunnerWhere
        });
        resolvedRunnerId = enrolled?.runnerId ?? null;
      }

      const moduleStartConstraint = evaluateModuleStartConstraints({
        executionEnvironment: decision.executionEnvironment,
        moduleManifests: modules.map((module) => module.manifest),
        runnerId: resolvedRunnerId,
        target: resolvedTarget
      });

      if (!moduleStartConstraint.allowed) {
        const updatedMission = await prisma.validationMission.update({
          where: {
            missionId: mission.missionId
          },
          data: {
            status: "DeniedByPolicy"
          }
        });

        await writeAuditEvent(prisma, {
          action: "policy.decision",
          actorType: "System",
          entityId: decision.policyDecisionId,
          entityType: "Scope",
          metadata: {
            code: moduleStartConstraint.code,
            missionId: mission.missionId,
            moduleStartGuard: true,
            moduleIds: modules.map((module) => module.manifest.moduleId),
            outcome: "Denied",
            rationale: moduleStartConstraint.rationale,
            scopeId: scope.scopeId
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
          code: moduleStartConstraint.code,
          missionId: mission.missionId,
          outcome: "Denied",
          policyDecisionId: decision.policyDecisionId,
          rationale: moduleStartConstraint.rationale,
          scopeId: scope.scopeId,
          stage: "mission_start"
        });

        return {
          jobsQueued: 0,
          mission: serializeValidationMission(updatedMission),
          runs: []
        };
      }

      const externalValidationResult =
        await evaluateExternalValidationExecution({
          config: externalValidationConfig,
          decision: serializePolicyDecision(decision),
          modules: modules.map((module) => module.manifest),
          rateState: externalValidationRateState,
          scope: serializeScope(scope),
          target: resolvedTarget,
          tenantId: context.tenant.tenantId
        });

      if (!externalValidationResult.allowed) {
        const updatedMission = await prisma.validationMission.update({
          where: {
            missionId: mission.missionId
          },
          data: {
            status: "DeniedByPolicy"
          }
        });

        await writeAuditEvent(prisma, {
          action: "policy.decision",
          actorType: "System",
          entityId: decision.policyDecisionId,
          entityType: "Scope",
          metadata: {
            externalValidationGuard: true,
            missionId: mission.missionId,
            outcome: "Denied",
            rationale: externalValidationResult.rationale,
            scopeId: scope.scopeId
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
          code: "external_validation_guard",
          missionId: mission.missionId,
          outcome: "Denied",
          policyDecisionId: decision.policyDecisionId,
          rationale: externalValidationResult.rationale,
          scopeId: scope.scopeId,
          stage: "external_validation"
        });

        return {
          jobsQueued: 0,
          mission: serializeValidationMission(updatedMission),
          runs: []
        };
      }

      const {
        jobs,
        mission: queuedMission,
        runnerDispatches,
        runs
      } = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // CAS claim Draft|RequiresApproval → Queued so concurrent starts cannot
        // both delete/recreate runs for the same mission.
        const claimed = await tx.validationMission.updateMany({
          where: {
            missionId: mission.missionId,
            status: {
              in: [...STARTABLE_MISSION_STATUSES]
            },
            tenantId: context.tenant.tenantId
          },
          data: {
            completedAt: null,
            startedAt: null,
            status: "Queued"
          }
        });

        if (claimed.count !== 1) {
          throw new AppServiceError(
            "Mission cannot be started from its current state.",
            409,
            "mission_not_startable"
          );
        }

        // Only replace non-terminal leftovers; never delete Completed evidence rows.
        await tx.validationRun.deleteMany({
          where: {
            missionId: mission.missionId,
            status: {
              in: [...ENQUEUE_FAILABLE_STATUSES]
            }
          }
        });

        await tx.job.deleteMany({
          where: {
            missionId: mission.missionId,
            status: {
              in: [...ENQUEUE_FAILABLE_STATUSES]
            }
          }
        });

        const updatedMission = await tx.validationMission.findUniqueOrThrow({
          where: {
            missionId: mission.missionId
          }
        });

        const createdRuns = [];
        const createdJobs = [];
        const createdRunnerDispatches = [];

        for (const module of modules) {
          const needsRunner =
            module.manifest.executionMode === "InternalRunner";
          const dispatchable =
            needsRunner &&
            isRunnerDispatchableModuleId(module.manifest.moduleId);
          const failReason =
            needsRunner && !resolvedRunnerId
              ? `${module.manifest.moduleId} requires an enrolled internal runner (runner-agent). The control-plane worker will not fabricate in-network results.`
              : needsRunner && !dispatchable
                ? `${module.manifest.moduleId} is InternalRunner but is not on the safe runner-agent dispatch allowlist.`
                : null;
          const run = await tx.validationRun.create({
            data: {
              evidenceIds: [],
              missionId: mission.missionId,
              moduleId: module.manifest.moduleId,
              outcome: null,
              policyDecisionId: mission.policyDecisionId,
              runnerId: resolvedRunnerId,
              safetyLevel: module.manifest.safetyLevel,
              scopeId: mission.scopeId,
              status: failReason ? "Failed" : "Queued",
              errorSummary: failReason,
              completedAt: failReason ? new Date() : null,
              target: resolvedTarget as Prisma.InputJsonValue,
              tenantId: context.tenant.tenantId,
              validationState: null
            }
          });

          createdRuns.push(run);

          if (needsRunner) {
            if (!failReason && resolvedRunnerId) {
              createdRunnerDispatches.push({
                moduleId: module.manifest.moduleId,
                runId: run.runId,
                runnerId: resolvedRunnerId,
                safetyLevel: module.manifest.safetyLevel
              });
            }
            continue;
          }

          const job = await tx.job.create({
            data: {
              attempts: 0,
              dedupeKey: `${mission.missionId}:${run.runId}`,
              missionId: mission.missionId,
              payload: {
                runId: run.runId
              } as Prisma.InputJsonValue,
              queueName: VALIDATION_QUEUE_NAME,
              status: "Queued",
              tenantId: context.tenant.tenantId,
              validationRunId: run.runId
            }
          });

          const nextPayload: ValidationJobPayload = {
            jobId: job.jobId,
            missionId: mission.missionId,
            requestId: requestId ?? null,
            runId: run.runId,
            tenantId: context.tenant.tenantId
          };

          await tx.job.update({
            where: {
              jobId: job.jobId
            },
            data: {
              payload: nextPayload as Prisma.InputJsonValue
            }
          });

          createdJobs.push({
            ...job,
            payload: nextPayload
          });
        }

        await writeAuditEvent(tx, {
          action: "mission.started",
          actorType: "User",
          entityId: updatedMission.missionId,
          entityType: "ValidationMission",
          metadata: {
            durationMs: Date.now() - operationStartedAt,
            jobsQueued: createdJobs.length,
            moduleCount: modules.length,
            moduleIds: modules.map((module) => module.manifest.moduleId),
            runnerTasksQueued: createdRunnerDispatches.length
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        return {
          jobs: createdJobs,
          mission: updatedMission,
          runnerDispatches: createdRunnerDispatches,
          runs: createdRuns
        };
      });

      try {
        // P03-20: only PEP-issued allowance may enqueue (Denied never queues).
        await Promise.all(
          jobs.map((job) =>
            enqueueWithExecutionPolicy(
              missionQueue,
              executionAllowance,
              job.payload as unknown as ValidationJobPayload
            )
          )
        );
      } catch (error) {
        const failedAt = new Date();
        const errorText =
          error instanceof Error ? error.message : "Queue enqueue failed.";
        const createdJobIds = jobs.map((job) => job.jobId);
        const createdRunIds = runs.map((run) => run.runId);

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          // CAS: do not clobber a mission a worker already Completed.
          await tx.validationMission.updateMany({
            where: {
              missionId: mission.missionId,
              status: {
                in: ["Draft", "Queued", "Running", "RequiresApproval"]
              },
              tenantId: context.tenant.tenantId
            },
            data: {
              completedAt: failedAt,
              status: "Failed"
            }
          });

          // Only the jobs/runs created by this start, and only while non-terminal.
          // Promise.all may have enqueued some jobs that a fast worker Completed
          // before this catch runs — never wipe those Completed rows.
          if (createdJobIds.length > 0) {
            await tx.job.updateMany({
              where: {
                jobId: {
                  in: createdJobIds
                },
                status: {
                  in: [...ENQUEUE_FAILABLE_STATUSES]
                }
              },
              data: {
                completedAt: failedAt,
                errorMessage: errorText,
                status: "Failed"
              }
            });
          }

          if (createdRunIds.length > 0) {
            await tx.validationRun.updateMany({
              where: {
                runId: {
                  in: createdRunIds
                },
                status: {
                  in: [...ENQUEUE_FAILABLE_STATUSES]
                }
              },
              data: {
                completedAt: failedAt,
                errorSummary: errorText,
                status: "Failed"
              }
            });
          }
        });

        throw new AppServiceError(
          "Failed to enqueue mission jobs.",
          500,
          "mission_enqueue_failed"
        );
      }

      let runnerTasksQueued = 0;
      if (runnerDispatches.length > 0) {
        const now = new Date();
        const serializedScope = serializeScope(scope);
        const scopeConstraints = buildScopeConstraints(serializedScope, []);
        for (const dispatch of runnerDispatches) {
          const taskId = randomUUID();
          const expiresAt = addSeconds(now, 900);
          const unsignedEnvelope = {
            artifactUpload: {
              artifactUploadUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${dispatch.runnerId}/tasks/${taskId}/artifacts`,
              maxArtifactBytes: 1_000_000,
              resultCallbackUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${dispatch.runnerId}/tasks/${taskId}/result`
            },
            executionEnvironment: "InternalRunner",
            expiresAt: expiresAt.toISOString(),
            inputs: {},
            issuedAt: now.toISOString(),
            missionId: mission.missionId,
            moduleId: dispatch.moduleId,
            runId: dispatch.runId,
            runnerId: dispatch.runnerId,
            safetyLevel: dispatch.safetyLevel,
            scopeConstraints,
            scopeId: mission.scopeId,
            target: resolvedTarget,
            taskId,
            tenantId: context.tenant.tenantId
          };
          const envelope = await signRunnerTaskEnvelope(
            prisma,
            context.tenant.tenantId,
            devMode,
            unsignedEnvelope
          );
          await prisma.runnerTask.create({
            data: {
              envelope: envelope as unknown as Prisma.InputJsonValue,
              expiresAt,
              inputs: {} as Prisma.InputJsonValue,
              issuedAt: now,
              missionId: mission.missionId,
              moduleId: dispatch.moduleId,
              nonce: envelope.signature.nonce,
              runId: dispatch.runId,
              runnerId: dispatch.runnerId,
              safetyLevel: dispatch.safetyLevel,
              scopeConstraints: scopeConstraints as Prisma.InputJsonValue,
              scopeId: mission.scopeId,
              status: "Queued",
              target: resolvedTarget as Prisma.InputJsonValue,
              taskId,
              taskType: dispatch.moduleId,
              tenantId: context.tenant.tenantId
            }
          });
          runnerTasksQueued += 1;
        }
      }

      await emitTenantWebhook(context.tenant.tenantId, "mission.started", {
        jobsQueued: jobs.length + runnerTasksQueued,
        missionId: mission.missionId,
        moduleIds: modules.map((module) => module.manifest.moduleId),
        runIds: runs.map((run) => run.runId),
        scopeId: mission.scopeId,
        status: queuedMission.status
      });

      return {
        jobsQueued: jobs.length + runnerTasksQueued,
        mission: serializeValidationMission(queuedMission),
        runs: runs.map(serializeValidationRun)
      };
    },

    async verifyScope(context, scopeId, input) {
      requireRole(context.membership.role, SCOPE_EDITOR_ROLES, "verify scopes");

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }

      let verificationMethod = "dns_txt";

      if (input.devModeManual) {
        if (!devMode) {
          throw new AppServiceError(
            "Manual scope verification is only available in dev mode.",
            400,
            "verification_not_supported"
          );
        }

        verificationMethod = "dev_manual";
      } else if (
        scope.scopeType === "Domain" ||
        scope.scopeType === "Subdomain"
      ) {
        if (!scope.verificationToken) {
          throw new AppServiceError(
            "Scope is missing a DNS verification token.",
            400,
            "verification_token_missing"
          );
        }

        const dnsVerification = await verifyDnsTxtScope({
          scopeValue: scope.value,
          verificationToken: scope.verificationToken
        });

        if (!dnsVerification.verified) {
          throw new AppServiceError(
            `DNS TXT verification failed. Publish ${dnsVerification.verificationName} with value ${scope.verificationToken}.`,
            400,
            "dns_verification_failed"
          );
        }
      } else if (scope.scopeType === "Repository") {
        if (input.operatorAttestation) {
          requireRole(
            context.membership.role,
            TENANT_ADMIN_ROLES,
            "attest repository authorization"
          );
          verificationMethod = "operator_attestation";
        } else {
          if (!scope.verificationToken) {
            throw new AppServiceError(
              "Scope is missing a repository verification token.",
              400,
              "verification_token_missing"
            );
          }
          const fileVerification = await verifyRepositoryAuthorizationFile({
            repositoryPath: scope.value,
            verificationToken: scope.verificationToken
          });
          if (!fileVerification.verified) {
            throw new AppServiceError(
              fileVerification.message,
              400,
              "repository_verification_failed"
            );
          }
          verificationMethod = "repository_token_file";
        }
      } else if (scope.scopeType === "CloudAccount") {
        const awsCandidates = await prisma.integration.findMany({
          select: {
            config: true,
            integrationId: true,
            product: true,
            status: true,
            vendor: true
          },
          where: {
            ...CONNECTED_AWS_INTEGRATION_CANDIDATE_WHERE,
            tenantId: context.tenant.tenantId
          }
        });
        const awsIntegration =
          selectConnectedAwsIntegrationForProwler(awsCandidates);
        const matchesAccount =
          awsIntegration !== null &&
          cloudAccountScopeMatchesIntegration({
            config: awsIntegration.config,
            scopeValue: scope.value
          });
        if (matchesAccount) {
          verificationMethod = "aws_integration";
        } else if (input.operatorAttestation) {
          requireRole(
            context.membership.role,
            TENANT_ADMIN_ROLES,
            "attest cloud-account authorization"
          );
          verificationMethod = "operator_attestation";
        } else {
          throw new AppServiceError(
            "Cloud account verification needs a Connected AWS integration whose account id matches this scope, or an Owner/Admin attestation.",
            400,
            "cloud_account_verification_failed"
          );
        }
      } else if (
        scope.scopeType === "IPRange" ||
        scope.scopeType === "InternalNetwork"
      ) {
        if (!input.operatorAttestation) {
          throw new AppServiceError(
            "CIDR and internal-network scopes require an Owner/Admin attestation that the range is customer-authorized.",
            400,
            "operator_attestation_required"
          );
        }
        requireRole(
          context.membership.role,
          TENANT_ADMIN_ROLES,
          "attest network authorization"
        );
        verificationMethod = "operator_attestation";
      } else {
        throw new AppServiceError(
          "This scope type requires a connector-specific or dev-mode manual verification flow.",
          400,
          "verification_not_supported"
        );
      }

      const verified = await prisma.scope.update({
        where: {
          scopeId: scope.scopeId
        },
        data: {
          verificationMethod,
          verifiedAt: new Date(),
          verifiedBy: context.user.userId,
          verificationStatus: "Verified"
        }
      });

      await writeAuditEvent(prisma, {
        action: "scope.verified",
        actorType: "User",
        entityId: verified.scopeId,
        entityType: "Scope",
        metadata: {
          method: verificationMethod,
          operatorAttestation: Boolean(input.operatorAttestation),
          role: context.membership.role,
          scopeType: scope.scopeType,
          scopeValue: scope.value
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeScope(verified);
    },

    async previewPolicyDecision(context, scopeId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "request policy decisions"
      );

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }
      if (!devMode && targetIncludesFixtureHints(input.target)) {
        throw new AppServiceError(
          "Fixture policy targets are only available in dev mode.",
          400,
          "fixture_mode_disabled"
        );
      }

      const evaluated = evaluatePolicy({
        adminApproval: input.adminApproval ?? false,
        executionEnvironment: input.executionEnvironment,
        explicitMissionApproval: input.explicitMissionApproval ?? false,
        missionType: input.missionType,
        requestedAction: input.requestedAction,
        safetyLevel: input.safetyLevel,
        scopeContext: scope,
        scopeVerificationStatus: scope.verificationStatus,
        offensiveValidationAuthorized: await loadOffensiveValidationAuthorized(
          prisma,
          context.tenant.tenantId
        ),
        destructiveValidationAuthorized:
          await loadDestructiveValidationAuthorized(
            prisma,
            context.tenant.tenantId
          ),
        timeWindowApproved: input.timeWindowApproved ?? false,
        userRole: context.membership.role
      });

      // P03-3: bound decision lifetime so stale Allowed/Approved rows are not
      // indefinite capability tickets. Override with PERISCAN_POLICY_DECISION_TTL_HOURS.
      const ttlHoursRaw = Number.parseInt(
        process.env.PERISCAN_POLICY_DECISION_TTL_HOURS ?? "24",
        10
      );
      const ttlHours =
        Number.isFinite(ttlHoursRaw) && ttlHoursRaw > 0 ? ttlHoursRaw : 24;
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

      const decision = await prisma.policyDecision.create({
        data: {
          approvalState: evaluated.approvalState,
          approvedAt:
            evaluated.approvalState === "Approved" ? new Date() : null,
          approvedBy:
            evaluated.approvalState === "Approved" ? context.user.userId : null,
          executionEnvironment: input.executionEnvironment,
          expiresAt,
          missionType: input.missionType,
          outcome: evaluated.outcome,
          rationale: evaluated.rationale,
          requestedAction: input.requestedAction as Prisma.InputJsonValue,
          safetyLevel: input.safetyLevel,
          scopeId: scope.scopeId,
          target: input.target as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });

      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: decision.policyDecisionId,
        entityType: "Scope",
        metadata: {
          missionType: decision.missionType,
          outcome: decision.outcome,
          scopeId: decision.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializePolicyDecision(decision);
    },

    async approvePolicyDecision(context, policyDecisionId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "approve a policy decision"
      );

      const decision = await prisma.policyDecision.findFirst({
        where: {
          policyDecisionId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!decision) {
        throw new AppServiceError(
          "Policy decision not found.",
          404,
          "not_found"
        );
      }

      if (decision.outcome !== "RequiresApproval") {
        throw new AppServiceError(
          "Policy decision does not require approval.",
          409,
          "approval_not_required"
        );
      }

      const updated = await prisma.policyDecision.update({
        data: {
          approvalState: "Approved",
          approvedAt: new Date(),
          approvedBy: context.user.userId
        },
        where: {
          policyDecisionId
        }
      });

      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: policyDecisionId,
        entityType: "Scope",
        metadata: {
          approvalState: "Approved"
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializePolicyDecision(updated);
    },

    async denyPolicyDecision(context, policyDecisionId) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "deny a policy decision"
      );

      const decision = await prisma.policyDecision.findFirst({
        where: {
          policyDecisionId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!decision) {
        throw new AppServiceError(
          "Policy decision not found.",
          404,
          "not_found"
        );
      }

      const updated = await prisma.policyDecision.update({
        data: {
          approvalState: "Rejected",
          // approvedAt/approvedBy are proof OF APPROVAL — a rejection is not an
          // approval, so they must stay null. Stamping the denier here over-claimed
          // that someone approved the decision; the denier is captured in the audit
          // event below instead.
          approvedAt: null,
          approvedBy: null
        },
        where: {
          policyDecisionId
        }
      });

      await writeAuditEvent(prisma, {
        action: "policy.decision",
        actorType: "User",
        entityId: policyDecisionId,
        entityType: "Scope",
        metadata: {
          approvalState: "Rejected"
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
        outcome: updated.outcome,
        policyDecisionId,
        rationale: updated.rationale,
        scopeId: updated.scopeId,
        stage: "admin_deny"
      });

      return serializePolicyDecision(updated);
    },

    async listPendingApprovals(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "list pending approvals"
      );

      const decisions = await prisma.policyDecision.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 100,
        where: {
          approvalState: "Pending",
          outcome: "RequiresApproval",
          tenantId: context.tenant.tenantId
        }
      });

      return decisions.map(serializePolicyDecision);
    },

    async listPolicyDecisions(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "list policy decisions"
      );

      const decisions = await prisma.policyDecision.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: input.limit,
        where: {
          tenantId: context.tenant.tenantId,
          ...(input.outcome ? { outcome: input.outcome } : {}),
          ...(input.missionType ? { missionType: input.missionType } : {}),
          ...(input.scopeId ? { scopeId: input.scopeId } : {})
        }
      });

      return decisions.map(serializePolicyDecision);
    },

    async getCommunityValidationSuite(
      context,
      input
    ): Promise<CommunityValidationSuiteResponse> {
      requireRole(context.membership.role, SCOPE_EDITOR_ROLES, "list modules");
      const includeExternalPoa = input.includeExternalPoa === true;
      const enrolled = await prisma.runner.findFirst({
        select: { runnerId: true },
        where: {
          killSwitchActive: false,
          status: { notIn: ["Revoked", "KillSwitchActive"] },
          tenantId: context.tenant.tenantId
        }
      });
      const awsIntegration = await findConnectedAwsIntegrationForProwler(
        prisma,
        context.tenant.tenantId
      );
      const runnerAvailable = Boolean(enrolled);
      const cloudAwsAvailable = Boolean(awsIntegration);
      let scopeType: CommunityValidationSuiteResponse["scopeType"] = null;
      if (input.scopeId) {
        const scope = await prisma.scope.findFirst({
          where: {
            scopeId: input.scopeId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!scope) {
          throw new AppServiceError("Scope not found.", 404, "scope_not_found");
        }
        scopeType = scope.scopeType;
      }
      const modules = scopeType
        ? listCommunityValidationSuiteForScopeType(scopeType)
        : [
            ...listCommunityValidationSuiteForScopeType("Domain"),
            ...listCommunityValidationSuiteForScopeType("Repository"),
            ...listCommunityValidationSuiteForScopeType("CloudAccount"),
            ...listCommunityValidationSuiteForScopeType("IPRange")
          ];
      const startable = scopeType
        ? listCommunityValidationStartModules({
            cloudAwsAvailable,
            includeExternalPoa,
            runnerAvailable,
            scopeType
          }).map((entry) => entry.moduleId)
        : modules
            .filter((entry) => {
              if (entry.executionMode === "ExternalPoA") {
                return includeExternalPoa;
              }
              if (entry.executionMode === "InternalRunner") {
                return runnerAvailable;
              }
              if (communityValidationStartLane(entry) === "cloud") {
                return cloudAwsAvailable;
              }
              return true;
            })
            .map((entry) => entry.moduleId);
      const deferred = scopeType
        ? listCommunityValidationDeferredModules({
            cloudAwsAvailable,
            runnerAvailable,
            scopeType
          })
        : [];
      const licensedCopyleft = await listLicensedCopyleftToolIds(
        prisma,
        context.tenant.tenantId
      );
      const copyleftModules = (
        scopeType
          ? listCopyleftOptInSuiteForScopeType(scopeType)
          : [...COPYLEFT_OPT_IN_SUITE]
      ).map((entry) => ({ ...entry }));
      return {
        cloudAwsAvailable,
        copyleftOptIn: {
          hint: COPYLEFT_OPT_IN_VALUE_LINE,
          licensedToolIds: licensedCopyleft,
          modules: copyleftModules
        },
        deferredModules: deferred,
        editionId: COMMUNITY_EDITION_ID,
        includeExternalPoa,
        licenseNote: COMMUNITY_EDITION_LICENSE_NOTE,
        modules,
        runnerAvailable,
        scopeType,
        startableModuleIds: startable,
        valueLine: COMMUNITY_EDITION_VALUE_LINE
      };
    },

    async getCommunityValidationCompanion(
      context,
      missionId: string
    ): Promise<CommunityValidationCompanion> {
      const emptyCompanion = {
        nucleiMissionId: null,
        nucleiSkipReason: null
      };
      const mission = await prisma.validationMission.findFirst({
        where: {
          missionId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!mission) {
        throw new AppServiceError(
          "Mission not found.",
          404,
          "mission_not_found"
        );
      }
      if (!mission.policyDecisionId) {
        return emptyCompanion;
      }
      if (mission.policyProfile === COMMUNITY_NUCLEI_MISSION_POLICY_PROFILE) {
        return emptyCompanion;
      }

      const ownRuns = await prisma.validationRun.findMany({
        select: { moduleId: true },
        where: {
          missionId: mission.missionId,
          tenantId: context.tenant.tenantId
        }
      });
      if (ownRuns.some((run) => run.moduleId === COMMUNITY_NUCLEI_MODULE_ID)) {
        return emptyCompanion;
      }
      const pack = summarizeCommunityMissionRuns(ownRuns);
      if (pack.mixed) {
        return emptyCompanion;
      }
      const looksCommunityPrimary =
        mission.policyProfile === COMMUNITY_MISSION_POLICY_PROFILE ||
        pack.hasCommunityPack;
      if (!looksCommunityPrimary) {
        return emptyCompanion;
      }

      const windowStart = new Date(
        mission.createdAt.getTime() - COMMUNITY_NUCLEI_SIBLING_WINDOW_MS
      );
      const siblingRuns = await prisma.validationRun.findMany({
        select: {
          createdAt: true,
          errorSummary: true,
          missionId: true,
          status: true
        },
        where: {
          createdAt: { gte: windowStart },
          missionId: { not: mission.missionId },
          moduleId: COMMUNITY_NUCLEI_MODULE_ID,
          policyDecisionId: mission.policyDecisionId,
          scopeId: mission.scopeId,
          tenantId: context.tenant.tenantId
        },
        orderBy: { createdAt: "asc" }
      });
      const siblingMissions = await prisma.validationMission.findMany({
        select: { createdAt: true, missionId: true, status: true },
        where: {
          createdAt: { gte: windowStart },
          missionId: { not: mission.missionId },
          policyDecisionId: mission.policyDecisionId,
          policyProfile: COMMUNITY_NUCLEI_MISSION_POLICY_PROFILE,
          scopeId: mission.scopeId,
          tenantId: context.tenant.tenantId
        },
        orderBy: { createdAt: "asc" }
      });
      const candidates = [
        ...siblingRuns.map((row) => ({
          createdAt: row.createdAt,
          missionId: row.missionId
        })),
        ...siblingMissions.map((row) => ({
          createdAt: row.createdAt,
          missionId: row.missionId
        }))
      ];
      const nucleiMissionId = selectCommunityNucleiCompanionMissionId({
        candidates,
        primaryCreatedAt: mission.createdAt,
        primaryMissionId: mission.missionId
      });
      const skipFromRun = siblingRuns.find(
        (row) =>
          row.missionId === nucleiMissionId &&
          typeof row.errorSummary === "string" &&
          row.errorSummary.length > 0
      )?.errorSummary;
      const skipFromDenied =
        siblingMissions.find((row) => row.missionId === nucleiMissionId)
          ?.status === "DeniedByPolicy" ||
        siblingRuns.find((row) => row.missionId === nucleiMissionId)?.status ===
          "DeniedByPolicy"
          ? COMMUNITY_NUCLEI_DENIED_SKIP_REASON
          : null;

      return {
        nucleiMissionId,
        nucleiSkipReason: skipFromRun ?? skipFromDenied
      };
    },

    async createCommunityMissionRemediations(context, missionId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create remediations"
      );
      const mission = await prisma.validationMission.findFirst({
        where: {
          missionId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!mission) {
        throw new AppServiceError(
          "Mission not found.",
          404,
          "mission_not_found"
        );
      }
      const findings = await this.listValidatedFindings(context, {
        limit: 100,
        missionId
      });
      const remediationIds: string[] = [];
      for (const finding of findings) {
        if (!finding.fingerprint) {
          continue;
        }
        // Pass path + evidence so verify can retest original modules, not compare-only.
        const pathId = finding.relatedPathIds?.[0];
        const remediation = await this.createRemediation(context, {
          evidenceIds: finding.evidenceIds ?? [],
          findingFingerprint: finding.fingerprint,
          ...(pathId ? { pathId } : {})
        });
        remediationIds.push(remediation.remediationId);
      }
      return {
        createdCount: remediationIds.length,
        missionId,
        remediationIds
      };
    },

    async startCommunityValidation(
      context,
      input: StartCommunityValidationRequest
    ): Promise<CommunityValidationStartResult> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create missions"
      );
      requireApiKeyCapability(
        context,
        "mission:run",
        "start community validation"
      );

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId: input.scopeId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }
      if (scope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "Community validation requires a verified scope.",
          400,
          "scope_not_verified"
        );
      }

      const enrolled = await prisma.runner.findFirst({
        select: { runnerId: true },
        where: {
          killSwitchActive: false,
          status: { notIn: ["Revoked", "KillSwitchActive"] },
          tenantId: context.tenant.tenantId
        }
      });
      const awsIntegration = await findConnectedAwsIntegrationForProwler(
        prisma,
        context.tenant.tenantId
      );
      const runnerAvailable = Boolean(enrolled);
      const cloudAwsAvailable = Boolean(awsIntegration);
      const tryNuclei = input.includeExternalPoa !== false;
      const available = listCommunityValidationStartModules({
        cloudAwsAvailable,
        includeExternalPoa: false,
        runnerAvailable,
        scopeType: scope.scopeType
      });
      if (available.length === 0) {
        throw new AppServiceError(
          `No Community edition engines apply to ${scope.scopeType} scopes yet. Enroll a runner or connect AWS if this scope needs those lanes.`,
          400,
          "community_suite_empty"
        );
      }

      let selected = available;
      const licensedCopyleftTools = await listLicensedCopyleftToolIds(
        prisma,
        context.tenant.tenantId
      );
      const copyleftForScope = listCopyleftOptInSuiteForScopeType(
        scope.scopeType
      ).filter((entry) => licensedCopyleftTools.includes(entry.toolId));
      if (input.includeCopyleftOptIn) {
        selected = [...selected, ...copyleftForScope];
      }
      if (input.moduleIds?.length) {
        const unknown = input.moduleIds.filter(
          (moduleId) =>
            !isCommunityValidationModuleId(moduleId) &&
            !isCopyleftOptInModuleId(moduleId)
        );
        if (unknown.length) {
          throw new AppServiceError(
            `Module ${unknown[0]} is not in the Community validation suite.`,
            400,
            "community_module_not_allowed"
          );
        }
        selected = [...available, ...copyleftForScope].filter((entry) =>
          input.moduleIds!.includes(entry.moduleId)
        );
        if (selected.length === 0) {
          throw new AppServiceError(
            "None of the requested modules apply to this verified scope.",
            400,
            "community_suite_empty"
          );
        }
      }

      const includeProwler = selected.some(
        (entry) => entry.moduleId === "prowler.aws_posture"
      );
      const target = stampUpstreamLicenses(
        buildCommunityValidationTarget({
          awsIntegrationId:
            includeProwler && awsIntegration
              ? awsIntegration.integrationId
              : undefined,
          entries: selected,
          scopeType: scope.scopeType,
          scopeValue: scope.value
        }),
        licensedCopyleftTools
      );
      const decision = await prisma.policyDecision.findFirst({
        where: {
          policyDecisionId: input.policyDecisionId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!decision) {
        throw new AppServiceError(
          "Policy decision not found.",
          404,
          "policy_decision_not_found"
        );
      }
      const requiredSafety = communityValidationSafetyLevel(selected);
      if (
        !isSafetyLevelAllowedForMission(decision.safetyLevel, requiredSafety)
      ) {
        throw new AppServiceError(
          `Policy safety ${decision.safetyLevel} cannot run Community suite safety ${requiredSafety}.`,
          400,
          "community_safety_mismatch"
        );
      }
      if (
        !communityPolicyCoversStartSet(decision.executionEnvironment, selected)
      ) {
        const requiredEnvironment =
          communityStartSetExecutionEnvironment(selected);
        throw new AppServiceError(
          `Policy environment ${decision.executionEnvironment} cannot cover Community modules that require ${requiredEnvironment}.`,
          400,
          "community_environment_mismatch"
        );
      }
      const mission = await this.createMission(context, {
        missionType: "ValidationSnapshot",
        policyDecisionId: input.policyDecisionId,
        policyProfile: COMMUNITY_MISSION_POLICY_PROFILE,
        safetyLevel: decision.safetyLevel,
        scopeId: scope.scopeId
      });
      const started = await this.startMission(context, mission.missionId, {
        moduleIds: selected.map((entry) => entry.moduleId),
        runnerId: input.runnerId ?? enrolled?.runnerId ?? undefined,
        target
      });

      let nucleiMissionId: string | null = null;
      let nucleiSkipReason: string | null = null;
      const nucleiApplies = listCommunityValidationSuiteForScopeType(
        scope.scopeType
      ).some((entry) => entry.moduleId === "nuclei.external_exposure_safe");
      if (tryNuclei && nucleiApplies) {
        try {
          const nucleiMission = await this.createMission(context, {
            missionType: "ValidationSnapshot",
            policyDecisionId: input.policyDecisionId,
            policyProfile: COMMUNITY_NUCLEI_MISSION_POLICY_PROFILE,
            safetyLevel: decision.safetyLevel,
            scopeId: scope.scopeId
          });
          nucleiMissionId = nucleiMission.missionId;
          const nucleiStart = await this.startMission(
            context,
            nucleiMission.missionId,
            {
              moduleIds: ["nuclei.external_exposure_safe"],
              target
            }
          );
          if (nucleiStart.mission.status === "DeniedByPolicy") {
            nucleiSkipReason = COMMUNITY_NUCLEI_DENIED_SKIP_REASON;
            const existing = await prisma.validationRun.findFirst({
              where: {
                missionId: nucleiMission.missionId,
                moduleId: COMMUNITY_NUCLEI_MODULE_ID,
                tenantId: context.tenant.tenantId
              }
            });
            if (!existing) {
              await prisma.validationRun.create({
                data: {
                  completedAt: new Date(),
                  errorSummary: nucleiSkipReason,
                  evidenceIds: [],
                  missionId: nucleiMission.missionId,
                  moduleId: COMMUNITY_NUCLEI_MODULE_ID,
                  policyDecisionId: input.policyDecisionId,
                  safetyLevel: decision.safetyLevel,
                  scopeId: scope.scopeId,
                  status: "DeniedByPolicy",
                  target: target as Prisma.InputJsonValue,
                  tenantId: context.tenant.tenantId
                }
              });
            } else if (!existing.errorSummary) {
              await prisma.validationRun.update({
                data: { errorSummary: nucleiSkipReason },
                where: { runId: existing.runId }
              });
            }
          }
        } catch (error) {
          nucleiSkipReason =
            error instanceof AppServiceError
              ? error.message
              : "Nuclei External PoA did not start; the rest of the Community pack still queued.";
          if (nucleiMissionId) {
            const existing = await prisma.validationRun.findFirst({
              where: {
                missionId: nucleiMissionId,
                moduleId: COMMUNITY_NUCLEI_MODULE_ID,
                tenantId: context.tenant.tenantId
              }
            });
            if (!existing) {
              await prisma.validationRun.create({
                data: {
                  completedAt: new Date(),
                  errorSummary: nucleiSkipReason,
                  evidenceIds: [],
                  missionId: nucleiMissionId,
                  moduleId: COMMUNITY_NUCLEI_MODULE_ID,
                  policyDecisionId: input.policyDecisionId,
                  safetyLevel: decision.safetyLevel,
                  scopeId: scope.scopeId,
                  status: "DeniedByPolicy",
                  target: target as Prisma.InputJsonValue,
                  tenantId: context.tenant.tenantId
                }
              });
            }
          }
        }
      }

      return {
        ...started,
        editionId: COMMUNITY_EDITION_ID,
        moduleIds: selected.map((entry) => entry.moduleId),
        nucleiMissionId,
        nucleiSkipReason,
        scopeType: scope.scopeType,
        target
      };
    }
  };
}
