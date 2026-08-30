import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { getModuleById } from "@periscan/modules";
import { evaluatePolicy } from "@periscan/policy";
import {
  AssemblePassiveMultiAgentPlanInputSchema,
  AssemblePassiveMultiAgentPlanResponseSchema,
  CompileHybridExecutionInputSchema,
  CompileHybridExecutionResponseSchema,
  ConvertMissionDraftToHybridCompileInputSchema,
  CreateConversationalMissionDraftInputSchema,
  ConversationalMissionDraftSchema,
  HYBRID_COMPILER_PRODUCT_STATUS,
  HybridCompileInputFromDraftSchema,
  agentRoleForModule,
  assemblePassiveMultiAgentPlan,
  buildConversationalMissionDraft,
  buildHybridMissionPlanSteps,
  highestSafetyAmong,
  isHybridCompilerPassiveModuleId,
  missionDraftToHybridCompileInput,
  selectPassiveModulesForIntent,
  type AssemblePassiveMultiAgentPlanInput,
  type AssemblePassiveMultiAgentPlanResponse,
  type CompileHybridExecutionInput,
  type CompileHybridExecutionResponse,
  type ConversationalMissionDraft,
  type ConvertMissionDraftToHybridCompileInput,
  type ConvertMissionDraftToHybridCompileInputRequest,
  type CreateConversationalMissionDraftInput,
  type HybridCompileInputFromDraft,
  type HybridCompileRejectedStep,
  type HybridCompiledStep,
  type HybridMissionPlan,
  type RunnerTaskEnvelope,
  type SafetyLevel
} from "@periscan/shared";

import {
  addSeconds,
  AppServiceError,
  buildScopeConstraints,
  getRunnerControlPlaneUrl,
  isHostnameTargetAllowedByScope,
  requireRole,
  RUNNER_ADMIN_ROLES,
  SCOPE_EDITOR_ROLES,
  signRunnerTaskEnvelope,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";
import { serializeScope } from "../serializers/entities.js";
import {
  assertRunnerAffinityAllowsTask,
  assertRunnerSegmentProfileAllowsTask
} from "./runner.js";

function moduleMetaList(moduleIds: string[]) {
  return moduleIds.map((moduleId) => {
    const manifest = getModuleById(moduleId)?.manifest;
    return {
      moduleId,
      name: manifest?.name ?? moduleId,
      safetyLevel: (manifest?.safetyLevel ??
        "PassiveReadOnly") as SafetyLevel
    };
  });
}

function needsPort(moduleId: string) {
  return (
    moduleId !== "periscan.dns_resolution_check" &&
    moduleId !== "periscan.endpoint_benign_marker_emit"
  );
}

function withSegmentForbidInternetEgress<
  T extends { forbidInternetEgress?: boolean }
>(constraints: T, forbidInternetEgress: boolean): T {
  if (!forbidInternetEgress) {
    return constraints;
  }
  return { ...constraints, forbidInternetEgress: true };
}

export function createHybridExecutionCompilerServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "assemblePassiveMultiAgentPlan"
  | "compileHybridExecution"
  | "convertConversationalMissionDraftToHybridCompileInput"
  | "createConversationalMissionDraft"
> {
  const { devMode, prisma } = deps;

  return {
    async assemblePassiveMultiAgentPlan(
      context,
      rawInput: AssemblePassiveMultiAgentPlanInput
    ): Promise<AssemblePassiveMultiAgentPlanResponse> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "assemble passive multi-agent plans"
      );
      const input = AssemblePassiveMultiAgentPlanInputSchema.parse(rawInput);
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
          "Passive multi-agent assembly requires a verified customer-authorized scope.",
          409,
          "verified_scope_required"
        );
      }

      const moduleIds = selectPassiveModulesForIntent(
        input.intent,
        input.maximumSteps
      );
      const moduleMeta = moduleMetaList(moduleIds);
      const planned = assemblePassiveMultiAgentPlan({
        intent: input.intent,
        maximumSteps: input.maximumSteps,
        moduleMeta,
        scopeId: input.scopeId,
        targetHost: input.targetHost
      });

      const requestedAction = {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: true,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      } as const;

      const planDecision = await prisma.policyDecision.create({
        data: {
          approvalState: planned.policyPreview.approvalRequired
            ? "Pending"
            : "NotRequired",
          executionEnvironment: "InternalRunner",
          missionType: "ExposureValidation",
          outcome: "Allowed",
          rationale:
            "Passive multi-agent assembly creates a Draft mission plan only; no runner tasks are queued.",
          requestedAction: requestedAction as Prisma.InputJsonValue,
          safetyLevel: planned.missionPlan.safetyCeiling,
          scopeId: input.scopeId,
          target: {
            compiler: "passive-multi-agent-assembly",
            moduleIds: planned.missionPlan.moduleIds,
            targetHost: input.targetHost
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });

      // Draft only — never auto-queue multi-agent steps as live BAS.
      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ExposureValidation",
          policyDecisionId: planDecision.policyDecisionId,
          policyProfile: "passive-multi-agent-assembly",
          requestedBy: context.user.userId,
          safetyLevel: planned.missionPlan.safetyCeiling,
          scopeId: input.scopeId,
          scopeIds: [input.scopeId],
          startedAt: null,
          status: "Draft",
          tenantId: context.tenant.tenantId
        }
      });

      const response = assemblePassiveMultiAgentPlan({
        intent: input.intent,
        maximumSteps: input.maximumSteps,
        missionId: mission.missionId,
        moduleMeta,
        scopeId: input.scopeId,
        targetHost: input.targetHost
      });

      await writeAuditEvent(prisma, {
        action: "mission.created",
        actorType: "User",
        entityId: mission.missionId,
        entityType: "ValidationMission",
        metadata: {
          claimLanguage: response.honesty.claimLanguage,
          draftMissionsOnly: true,
          kind: "passive_multi_agent_assembly",
          moduleCount: response.missionPlan.moduleIds.length,
          multiAgentOffensiveSwarmSupported: false,
          safetyCeiling: response.missionPlan.safetyCeiling,
          status: "Draft"
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return AssemblePassiveMultiAgentPlanResponseSchema.parse(response);
    },

    async createConversationalMissionDraft(
      context,
      rawInput: CreateConversationalMissionDraftInput
    ): Promise<ConversationalMissionDraft> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create conversational mission drafts"
      );
      const input = CreateConversationalMissionDraftInputSchema.parse(rawInput);

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
      }

      const moduleIds = selectPassiveModulesForIntent(
        input.intent,
        input.maximumSteps
      );
      const draft = buildConversationalMissionDraft({
        createdAt: new Date().toISOString(),
        draftId: randomUUID(),
        intent: input.intent,
        moduleIds,
        moduleMeta: moduleMetaList(moduleIds),
        scopeId: input.scopeId ?? null,
        source: input.source,
        targetHost: input.targetHost ?? null,
        title: input.title
      });

      await writeAuditEvent(prisma, {
        action: "mission.created",
        actorType: "User",
        entityId: draft.draftId,
        entityType: "ValidationMission",
        metadata: {
          claimLanguage: draft.honesty.claimLanguage,
          executable: false,
          kind: "conversational_mission_draft",
          moduleCount: draft.moduleIds.length,
          source: draft.source
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return ConversationalMissionDraftSchema.parse(draft);
    },

    async convertConversationalMissionDraftToHybridCompileInput(
      context,
      rawInput: ConvertMissionDraftToHybridCompileInputRequest
    ): Promise<HybridCompileInputFromDraft> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "convert conversational mission drafts to hybrid compile input"
      );
      const input: ConvertMissionDraftToHybridCompileInput =
        ConvertMissionDraftToHybridCompileInputSchema.parse(rawInput);

      const scopeId =
        input.options.scopeId ?? input.draft.scopeId ?? undefined;
      if (scopeId) {
        const scope = await prisma.scope.findFirst({
          where: {
            scopeId,
            tenantId: context.tenant.tenantId
          }
        });
        if (!scope) {
          throw new AppServiceError("Scope not found.", 404, "scope_not_found");
        }
      }

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId: input.options.runnerId,
          status: { not: "Revoked" },
          tenantId: context.tenant.tenantId
        }
      });
      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }

      let converted: HybridCompileInputFromDraft;
      try {
        converted = missionDraftToHybridCompileInput(
          input.draft,
          input.options
        );
      } catch (error) {
        throw new AppServiceError(
          error instanceof Error
            ? error.message
            : "Unable to convert mission draft to hybrid compile input.",
          400,
          "mission_draft_convert_failed"
        );
      }

      await writeAuditEvent(prisma, {
        action: "scenario.compiled",
        actorType: "User",
        entityId: input.draft.draftId,
        entityType: "ValidationMission",
        metadata: {
          acceptedCount: converted.compileInput.moduleIds?.length ?? 0,
          draftExecutable: false,
          kind: "conversational_draft_to_hybrid_compile_input",
          queueTasks: converted.compileInput.queueTasks,
          rejectedCount: converted.rejectedModuleIds.length,
          runnerId: input.options.runnerId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return HybridCompileInputFromDraftSchema.parse(converted);
    },

    async compileHybridExecution(
      this: AppServices,
      context,
      rawInput: CompileHybridExecutionInput
    ): Promise<CompileHybridExecutionResponse> {
      requireRole(
        context.membership.role,
        RUNNER_ADMIN_ROLES,
        "compile hybrid execution plans"
      );
      const input = CompileHybridExecutionInputSchema.parse(rawInput);

      const runner = await prisma.runner.findFirst({
        where: {
          runnerId: input.runnerId,
          status: { not: "Revoked" },
          tenantId: context.tenant.tenantId
        }
      });
      if (!runner) {
        throw new AppServiceError("Runner not found.", 404, "runner_not_found");
      }
      if (runner.killSwitchActive) {
        throw new AppServiceError(
          "Runner kill switch is active; tasks cannot be compiled for dispatch.",
          409,
          "runner_kill_switch_active"
        );
      }

      const scope = await prisma.scope.findFirst({
        where: {
          scopeId: input.scopeId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }
      const serializedScope = serializeScope(scope);
      if (serializedScope.verificationStatus !== "Verified") {
        throw new AppServiceError(
          "Hybrid compile requires verified scope.",
          400,
          "verified_scope_required"
        );
      }
      if (!isHostnameTargetAllowedByScope(serializedScope, input.targetHost)) {
        throw new AppServiceError(
          "Compile target is outside the verified scope constraints.",
          400,
          "runner_scope_violation"
        );
      }

      const requestedModuleIds =
        input.moduleIds && input.moduleIds.length > 0
          ? input.moduleIds
          : selectPassiveModulesForIntent(
              input.intent ?? "passive exposure proof",
              input.maximumSteps
            );

      const acceptedModuleIds: string[] = [];
      const rejected: HybridCompileRejectedStep[] = [];

      for (const moduleId of requestedModuleIds) {
        if (!isHybridCompilerPassiveModuleId(moduleId)) {
          rejected.push({
            moduleId,
            reason:
              "Module is not an allowlisted runner-safe measured module. Hybrid compiler refuses offensive/unlisted capabilities.",
            reasonCode: "not_runner_measured"
          });
          continue;
        }
        const manifest = getModuleById(moduleId)?.manifest;
        if (!manifest) {
          rejected.push({
            moduleId,
            reason: "Module is not registered.",
            reasonCode: "module_not_found"
          });
          continue;
        }
        if (
          manifest.safetyLevel === "BASLite" ||
          manifest.safetyLevel === "AdvancedAdversarial" ||
          manifest.safetyLevel === "Disallowed"
        ) {
          rejected.push({
            moduleId,
            reason: `Safety level ${manifest.safetyLevel} is not hybrid-compiler-compatible.`,
            reasonCode: "safety_not_passive_compatible"
          });
          continue;
        }
        if (needsPort(moduleId) && input.port === undefined) {
          rejected.push({
            moduleId,
            reason: "port is required for TLS/HTTP measured checks.",
            reasonCode: "missing_port"
          });
          continue;
        }
        if (moduleId === "periscan.endpoint_benign_marker_emit") {
          rejected.push({
            moduleId,
            reason:
              "Endpoint canary requires markerId/platform via createRunnerMeasuredTask; hybrid multi-step compile omits it without canary fields.",
            reasonCode: "missing_canary_fields"
          });
          continue;
        }
        acceptedModuleIds.push(moduleId);
      }

      if (acceptedModuleIds.length === 0) {
        throw new AppServiceError(
          "No allowlisted passive modules remained after hybrid compile filtering.",
          400,
          "hybrid_compile_empty"
        );
      }

      const stepsPlan = buildHybridMissionPlanSteps(
        acceptedModuleIds,
        moduleMetaList(acceptedModuleIds)
      );
      // Preflight every step's runner gates before creating a mission or
      // queuing tasks. Otherwise a mid-loop segment/affinity deny (403) can
      // leave earlier ValidationRun/RunnerTask rows Queued after the compile
      // fails — denied work must never remain queued.
      for (const planStep of stepsPlan) {
        assertRunnerSegmentProfileAllowsTask(
          runner,
          planStep.moduleId,
          planStep.safetyLevel
        );
        assertRunnerAffinityAllowsTask(runner, {
          preferredRunnerId: input.runnerId
        });
      }
      const safetyCeiling = highestSafetyAmong(
        stepsPlan.map((step) => step.safetyLevel)
      );
      const missionPlan: HybridMissionPlan = {
        intent:
          input.intent ??
          `Hybrid compile of ${acceptedModuleIds.length} passive measured modules`,
        missionType: "ExposureValidation",
        moduleIds: acceptedModuleIds,
        safetyCeiling,
        scopeId: input.scopeId,
        steps: stepsPlan,
        targetHost: input.targetHost
      };

      const requestedAction = {
        credentialTheft: false,
        destructive: false,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: true,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      } as const;

      const evaluated = evaluatePolicy({
        adminApproval: false,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: false,
        missionType: "ExposureValidation",
        requestedAction,
        safetyLevel: safetyCeiling,
        scopeContext: serializedScope,
        scopeVerificationStatus: serializedScope.verificationStatus,
        timeWindowApproved: false,
        userRole: context.membership.role
      });

      const planDecision = await prisma.policyDecision.create({
        data: {
          approvalState: evaluated.approvalState,
          executionEnvironment: "InternalRunner",
          missionType: "ExposureValidation",
          outcome: evaluated.outcome,
          rationale: evaluated.rationale,
          requestedAction: requestedAction as Prisma.InputJsonValue,
          safetyLevel: safetyCeiling,
          scopeId: input.scopeId,
          target: {
            compiler: "hybrid-execution",
            moduleIds: acceptedModuleIds,
            targetHost: input.targetHost
          } as Prisma.InputJsonValue,
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        }
      });

      if (evaluated.outcome === "Denied") {
        throw new AppServiceError(
          evaluated.rationale,
          400,
          "policy_denied"
        );
      }

      const now = new Date();
      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "ExposureValidation",
          policyDecisionId: planDecision.policyDecisionId,
          policyProfile: "hybrid-execution-compiler",
          requestedBy: context.user.userId,
          safetyLevel: safetyCeiling,
          scopeId: input.scopeId,
          scopeIds: [input.scopeId],
          startedAt: input.queueTasks ? now : null,
          status: input.queueTasks ? "Queued" : "Draft",
          tenantId: context.tenant.tenantId
        }
      });

      const compiledSteps: HybridCompiledStep[] = [];
      let queuedTaskCount = 0;

      for (const planStep of stepsPlan) {
        const manifest = getModuleById(planStep.moduleId)!.manifest;
        const safetyLevel = manifest.safetyLevel as SafetyLevel;

        const segmentGate = assertRunnerSegmentProfileAllowsTask(
          runner,
          planStep.moduleId,
          safetyLevel
        );
        assertRunnerAffinityAllowsTask(runner, {
          preferredRunnerId: input.runnerId
        });

        const scopePorts = input.port === undefined ? [] : [input.port];
        const taskInputs: Record<string, unknown> = {
          rateLimitPerMinute: input.rateLimitPerMinute,
          timeoutSeconds: input.timeoutSeconds
        };
        if (input.port !== undefined) taskInputs.port = input.port;
        if (input.path !== undefined) taskInputs.path = input.path;
        if (input.scheme !== undefined) taskInputs.scheme = input.scheme;

        const taskTarget: Record<string, unknown> = {
          hostname: input.targetHost,
          targetHost: input.targetHost
        };
        if (input.port !== undefined) {
          taskTarget.port = input.port;
          taskTarget.ports = [input.port];
        }

        let runId: string | null = null;
        let policyDecisionId: string | null = planDecision.policyDecisionId;
        let queued = false;

        if (input.queueTasks) {
          const stepDecision = await prisma.policyDecision.create({
            data: {
              approvalState: evaluated.approvalState,
              executionEnvironment: "InternalRunner",
              missionType: "ExposureValidation",
              outcome: evaluated.outcome,
              rationale: evaluated.rationale,
              requestedAction: requestedAction as Prisma.InputJsonValue,
              safetyLevel,
              scopeId: input.scopeId,
              target: {
                module: planStep.moduleId,
                targetHost: input.targetHost
              } as Prisma.InputJsonValue,
              tenantId: context.tenant.tenantId,
              userId: context.user.userId
            }
          });
          policyDecisionId = stepDecision.policyDecisionId;
          const run = await prisma.validationRun.create({
            data: {
              evidenceIds: [],
              missionId: mission.missionId,
              moduleId: planStep.moduleId,
              outcome: null,
              policyDecisionId: stepDecision.policyDecisionId,
              runnerId: input.runnerId,
              safetyLevel,
              scopeId: input.scopeId,
              startedAt: null,
              status: "Queued",
              target: {
                ...taskTarget,
                timeoutSeconds: input.timeoutSeconds
              } as Prisma.InputJsonValue,
              tenantId: context.tenant.tenantId,
              validationState: null
            }
          });
          runId = run.runId;
          queued = true;
        }

        const taskId = randomUUID();
        const expiresAt = addSeconds(now, input.timeoutSeconds + 300);
        const scopeConstraints = withSegmentForbidInternetEgress(
          buildScopeConstraints(serializedScope, scopePorts),
          segmentGate.forbidInternetEgress
        );
        const unsignedEnvelope: Omit<RunnerTaskEnvelope, "signature"> = {
          artifactUpload: {
            artifactUploadUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${input.runnerId}/tasks/${taskId}/artifacts`,
            maxArtifactBytes: 1_000_000,
            resultCallbackUrl: `${getRunnerControlPlaneUrl()}/api/v1/runners/${input.runnerId}/tasks/${taskId}/result`
          },
          executionEnvironment: "InternalRunner",
          expiresAt: expiresAt.toISOString(),
          inputs: taskInputs,
          issuedAt: now.toISOString(),
          missionId: mission.missionId,
          moduleId: planStep.moduleId,
          runId: runId ?? randomUUID(),
          runnerId: input.runnerId,
          safetyLevel,
          scopeConstraints,
          scopeId: input.scopeId,
          target: taskTarget,
          taskId,
          tenantId: context.tenant.tenantId
        };
        const envelope = await signRunnerTaskEnvelope(
          prisma,
          context.tenant.tenantId,
          devMode,
          unsignedEnvelope
        );

        if (queued && runId) {
          await prisma.runnerTask.create({
            data: {
              envelope: envelope as unknown as Prisma.InputJsonValue,
              expiresAt,
              inputs: taskInputs as Prisma.InputJsonValue,
              issuedAt: now,
              missionId: mission.missionId,
              moduleId: planStep.moduleId,
              nonce: envelope.signature.nonce,
              runId,
              runnerId: input.runnerId,
              safetyLevel,
              scopeConstraints: scopeConstraints as Prisma.InputJsonValue,
              scopeId: input.scopeId,
              status: "Queued",
              target: taskTarget as Prisma.InputJsonValue,
              taskId,
              taskType: planStep.moduleId,
              tenantId: context.tenant.tenantId
            }
          });
          queuedTaskCount += 1;
        }

        compiledSteps.push({
          agentRole: agentRoleForModule(planStep.moduleId),
          envelope,
          moduleId: planStep.moduleId,
          policyDecisionId,
          queued,
          runId,
          safetyLevel,
          stepKey: planStep.stepKey,
          taskId
        });
      }

      const compiledHash = createHash("sha256")
        .update(
          JSON.stringify({
            missionId: mission.missionId,
            moduleIds: acceptedModuleIds,
            signatures: compiledSteps.map(
              (step) => step.envelope.signature.digestSha256
            ),
            targetHost: input.targetHost
          })
        )
        .digest("hex");

      await writeAuditEvent(prisma, {
        action: "scenario.compiled",
        actorType: "User",
        entityId: mission.missionId,
        entityType: "ValidationMission",
        metadata: {
          acceptedCount: compiledSteps.length,
          compiledHash,
          compiler: "hybrid-execution",
          fullyE2EMeasuredSurface: false,
          queueTasks: input.queueTasks,
          queuedTaskCount,
          rejectedCount: rejected.length,
          runnerId: input.runnerId,
          scopeId: input.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return CompileHybridExecutionResponseSchema.parse({
        acceptedCount: compiledSteps.length,
        compiledAt: now.toISOString(),
        compiledHash,
        honesty: {
          claimLanguage: HYBRID_COMPILER_PRODUCT_STATUS.claimLanguage,
          fullyE2EMeasuredSurface: false,
          liveAptAtomicSupported: false,
          multiAgentOffensiveSwarmSupported: false,
          status: "Partial",
          summary: HYBRID_COMPILER_PRODUCT_STATUS.summary
        },
        missionId: mission.missionId,
        missionPlan,
        queuedTaskCount,
        rejected,
        steps: compiledSteps
      });
    }
  };
}
