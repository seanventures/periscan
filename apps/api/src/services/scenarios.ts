import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { getModuleById } from "@periscan/modules";
import {
  CompileScenarioResponseSchema,
  ScenarioBundleSchema,
  ScenarioExecutionResultSchema,
  type CompileScenarioInput,
  type CompileScenarioResponse,
  type ExecuteScenarioInput,
  type ScenarioBundle,
  type ScenarioBundleStep,
  type ScenarioExecutionResult,
  type ScopeType
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  SCOPE_EDITOR_ROLES,
  signTenantArtifact,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import { scenarioBundleSigningContent } from "../scenario-integrity.js";

const SCENARIO_LIST_LIMIT = 50;

const SAFE_CAPABILITIES_BY_SCOPE: Partial<Record<ScopeType, string[]>> = {
  AIApplicationEndpoint: ["ai_app.safe_validation"],
  CloudAccount: ["prowler.aws_posture"],
  Domain: [
    "periscan.dns_resolution_check",
    "periscan.dns_email_security_check",
    "periscan.http_health_check",
    "web.zap_baseline"
  ],
  InternalNetwork: [
    "recon.host_discovery",
    "recon.service_inventory"
    // ot_ics.safe_baseline is fixture-only scaffold (liveSupported:false).
  ],
  IPRange: ["recon.host_discovery", "recon.service_inventory"],
  Repository: [
    "gitleaks.repo_secrets",
    "trivy.repo_dependency_scan",
    "osv.repo_dependency_scan"
  ],
  Subdomain: [
    "periscan.dns_resolution_check",
    "periscan.http_health_check",
    "web.zap_baseline"
  ]
};

const SAFETY_RANK = {
  PassiveReadOnly: 0,
  ActiveNonInvasive: 1,
  ControlledValidation: 2,
  BASLite: 3,
  AdvancedAdversarial: 4,
  Disallowed: 5
} as const;

function asRecord(value: Prisma.JsonValue) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function serializeScenarioBundle(record: {
  allowedScopeTypes: string[];
  approvedAt: Date | null;
  approvedBy: string | null;
  bundleVersion: number;
  compiledAt: Date;
  compiledHash: string;
  createdAt: Date;
  description: string;
  expectedObservations: Prisma.JsonValue;
  feedbackCycleCount: number;
  feedbackFailedCycleCount: number;
  feedbackLastCompletedAt: Date | null;
  feedbackLastError: string | null;
  feedbackLastReason: string | null;
  feedbackLastReviewReference: string | null;
  feedbackLastStartedAt: Date | null;
  feedbackLastStatus: ScenarioBundle["feedbackLastStatus"];
  feedbackStopReason: string | null;
  feedbackStopReviewReference: string | null;
  feedbackStoppedAt: Date | null;
  feedbackStoppedBy: string | null;
  intent: string;
  legalClassification: string;
  maximumIterations: number;
  name: string;
  prerequisites: Prisma.JsonValue;
  safetyCeiling: ScenarioBundle["safetyCeiling"];
  sbom: Prisma.JsonValue;
  scenarioBundleId: string;
  scopeId: string;
  signature: Prisma.JsonValue;
  source: Prisma.JsonValue;
  status: string;
  steps: Prisma.JsonValue;
  techniqueIds: string[];
  tenantId: string;
  updatedAt: Date;
}): ScenarioBundle {
  return ScenarioBundleSchema.parse({
    allowedScopeTypes: record.allowedScopeTypes,
    approvedAt: record.approvedAt?.toISOString() ?? null,
    approvedBy: record.approvedBy,
    bundleVersion: record.bundleVersion,
    compiledAt: record.compiledAt.toISOString(),
    compiledHash: record.compiledHash,
    createdAt: record.createdAt.toISOString(),
    description: record.description,
    expectedObservations: record.expectedObservations,
    feedbackCycleCount: record.feedbackCycleCount,
    feedbackFailedCycleCount: record.feedbackFailedCycleCount,
    feedbackLastCompletedAt:
      record.feedbackLastCompletedAt?.toISOString() ?? null,
    feedbackLastError: record.feedbackLastError,
    feedbackLastReason: record.feedbackLastReason,
    feedbackLastReviewReference: record.feedbackLastReviewReference,
    feedbackLastStartedAt: record.feedbackLastStartedAt?.toISOString() ?? null,
    feedbackLastStatus: record.feedbackLastStatus,
    feedbackStopReason: record.feedbackStopReason,
    feedbackStopReviewReference: record.feedbackStopReviewReference,
    feedbackStoppedAt: record.feedbackStoppedAt?.toISOString() ?? null,
    feedbackStoppedBy: record.feedbackStoppedBy,
    intent: record.intent,
    legalClassification: record.legalClassification,
    maximumIterations: record.maximumIterations,
    name: record.name,
    prerequisites: record.prerequisites,
    safetyCeiling: record.safetyCeiling,
    sbom: record.sbom,
    scenarioBundleId: record.scenarioBundleId,
    scopeId: record.scopeId,
    signature: asRecord(record.signature),
    source: asRecord(record.source),
    status: record.status,
    steps: record.steps,
    techniqueIds: record.techniqueIds,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  });
}

function selectModules(
  scopeType: ScopeType,
  intent: string,
  maximumSteps: number
) {
  const compatible = (SAFE_CAPABILITIES_BY_SCOPE[scopeType] ?? [])
    .map((moduleId) => getModuleById(moduleId))
    .filter((module) => module?.manifest.status === "Implemented")
    .filter((module) =>
      module!.manifest.requiredScopes.length === 0
        ? true
        : module!.manifest.requiredScopes.includes(scopeType)
    );
  if (compatible.length === 0) {
    throw new AppServiceError(
      `No implemented safe scenario capability supports ${scopeType}.`,
      409,
      "scenario_capability_unavailable"
    );
  }

  const intentTokens = new Set(
    intent
      .toLowerCase()
      .split(/[^a-z0-9]+/u)
      .filter((token) => token.length >= 3)
  );
  const matched = compatible.filter((module) => {
    const searchable = [
      module!.manifest.moduleId,
      module!.manifest.name,
      module!.manifest.capabilityName,
      module!.manifest.customerVisibleDescription
    ]
      .join(" ")
      .toLowerCase();
    return [...intentTokens].some((token) => searchable.includes(token));
  });

  return (matched.length > 0 ? matched : compatible).slice(0, maximumSteps);
}

function highestSafetyLevel(
  modules: Array<NonNullable<ReturnType<typeof getModuleById>>>
): ScenarioBundle["safetyCeiling"] {
  return modules.reduce<ScenarioBundle["safetyCeiling"]>(
    (highest, module) =>
      SAFETY_RANK[module.manifest.safetyLevel] > SAFETY_RANK[highest]
        ? module.manifest.safetyLevel
        : highest,
    "PassiveReadOnly"
  );
}

export function createScenarioServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "approveScenarioBundle"
  | "compileScenario"
  | "executeScenarioBundle"
  | "getScenarioBundle"
  | "listScenarioBundles"
  | "stopScenarioFeedback"
> {
  const { devMode, prisma } = deps;

  async function assertScenarioIntegrity(
    record: Parameters<typeof serializeScenarioBundle>[0]
  ) {
    const bundle = serializeScenarioBundle(record);
    const expected = await signTenantArtifact(
      prisma,
      bundle.tenantId,
      devMode,
      scenarioBundleSigningContent(bundle)
    );
    if (
      expected.digestSha256 !== bundle.compiledHash ||
      expected.digestSha256 !== bundle.signature.digestSha256 ||
      expected.keyId !== bundle.signature.keyId ||
      expected.signature !== bundle.signature.signature
    ) {
      throw new AppServiceError(
        "Scenario bundle integrity verification failed.",
        409,
        "scenario_bundle_integrity_failed"
      );
    }
    return bundle;
  }

  return {
    async compileScenario(
      context,
      input: CompileScenarioInput
    ): Promise<CompileScenarioResponse> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "compile validation scenarios"
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
          "Scenario compilation requires a verified customer-authorized scope.",
          409,
          "verified_scope_required"
        );
      }

      const modules = selectModules(
        scope.scopeType,
        input.intent,
        input.maximumSteps
      ) as Array<NonNullable<ReturnType<typeof getModuleById>>>;
      const safetyCeiling = highestSafetyLevel(modules);
      const steps: ScenarioBundleStep[] = modules.map((module, index) => {
        const stepId = `step-${index + 1}`;
        const previousStepId = index > 0 ? `step-${index}` : null;
        return {
          dependsOn: previousStepId ? [previousStepId] : [],
          expectedObservations: module.manifest.evidenceTypes.map(
            (evidenceType) => `${evidenceType} from ${module.manifest.moduleId}`
          ),
          moduleId: module.manifest.moduleId,
          name: module.manifest.name,
          stepId,
          target: {
            ...(input.techniqueIds.length > 0
              ? { techniqueIds: input.techniqueIds }
              : {})
          },
          when: previousStepId
            ? {
                allowedStatuses: ["executed"],
                kind: "PriorStep",
                minimumEvidenceCount: 1,
                minimumSignalCount: 0,
                stepId: previousStepId,
                validationStates: []
              }
            : { kind: "Always" }
        };
      });
      const prerequisites = [
        "Customer-authorized scope is verified.",
        "Every step receives an independent policy decision and audit event.",
        "A failed evidence predicate stops its downstream branch.",
        ...(modules.some(
          (module) => module.manifest.executionMode === "InternalRunner"
        )
          ? ["A healthy in-scope internal runner is required for runner steps."]
          : [])
      ];
      const expectedObservations = steps.flatMap(
        (step) => step.expectedObservations
      );
      const content = scenarioBundleSigningContent({
        allowedScopeTypes: [scope.scopeType],
        bundleVersion: 1,
        description: `Deterministic ${steps.length}-step validation graph compiled from operator intent.`,
        expectedObservations,
        intent: input.intent,
        legalClassification:
          safetyCeiling === "PassiveReadOnly"
            ? ("PassiveAuthorized" as const)
            : ("ControlledAuthorized" as const),
        maximumIterations: input.maximumIterations,
        name: input.intent.slice(0, 96),
        prerequisites,
        safetyCeiling,
        sbom: modules.map((module) => ({
          executionMode: module.manifest.executionMode,
          moduleId: module.manifest.moduleId,
          safetyLevel: module.manifest.safetyLevel,
          version: module.manifest.version
        })),
        scopeId: scope.scopeId,
        source: {
          kind: "OperatorIntent" as const,
          reference: null
        },
        steps,
        techniqueIds: input.techniqueIds
      });
      const signature = await signTenantArtifact(
        prisma,
        context.tenant.tenantId,
        devMode,
        content
      );
      const existing = await prisma.scenarioBundle.findUnique({
        where: {
          tenantId_compiledHash: {
            compiledHash: signature.digestSha256,
            tenantId: context.tenant.tenantId
          }
        }
      });
      const compiledAt = new Date();
      const record =
        existing ??
        (await prisma.scenarioBundle.create({
          data: {
            allowedScopeTypes: content.allowedScopeTypes,
            bundleVersion: content.bundleVersion,
            compiledAt,
            compiledHash: signature.digestSha256,
            description: content.description,
            expectedObservations:
              content.expectedObservations as Prisma.InputJsonValue,
            intent: content.intent,
            legalClassification: content.legalClassification,
            maximumIterations: content.maximumIterations,
            name: content.name,
            prerequisites: content.prerequisites as Prisma.InputJsonValue,
            safetyCeiling: content.safetyCeiling,
            sbom: content.sbom as Prisma.InputJsonValue,
            scenarioBundleId: randomUUID(),
            scopeId: content.scopeId,
            signature: signature as Prisma.InputJsonValue,
            source: content.source as Prisma.InputJsonValue,
            status: "Draft",
            steps: content.steps as unknown as Prisma.InputJsonValue,
            techniqueIds: content.techniqueIds,
            tenantId: context.tenant.tenantId
          }
        }));
      const bundle = serializeScenarioBundle(record);

      await writeAuditEvent(prisma, {
        action: "scenario.compiled",
        actorType: "User",
        entityId: bundle.scenarioBundleId,
        entityType: "ScenarioBundle",
        metadata: {
          compiledHash: bundle.compiledHash,
          moduleCount: bundle.steps.length,
          scopeId: bundle.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return CompileScenarioResponseSchema.parse({
        bundle,
        preview: {
          branchCount: bundle.steps.filter(
            (step) => step.when.kind !== "Always"
          ).length,
          compiledHash: bundle.compiledHash,
          executable: false,
          moduleCount: bundle.steps.length,
          nextStep: "ApproveScenarioBundle"
        }
      });
    },

    async approveScenarioBundle(context, scenarioBundleId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "approve validation scenarios"
      );
      const existing = await prisma.scenarioBundle.findFirst({
        where: {
          scenarioBundleId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!existing) {
        throw new AppServiceError(
          "Scenario bundle not found.",
          404,
          "scenario_bundle_not_found"
        );
      }
      if (existing.status === "Revoked" || existing.status === "Deprecated") {
        throw new AppServiceError(
          "Revoked or deprecated scenario bundles cannot be approved.",
          409,
          "scenario_bundle_inactive"
        );
      }
      await assertScenarioIntegrity(existing);
      const approvedAt = new Date();
      const record = await prisma.scenarioBundle.update({
        data: {
          approvedAt,
          approvedBy: context.user.userId,
          status: "Approved"
        },
        where: { scenarioBundleId }
      });
      await writeAuditEvent(prisma, {
        action: "scenario.approved",
        actorType: "User",
        entityId: scenarioBundleId,
        entityType: "ScenarioBundle",
        metadata: {
          compiledHash: existing.compiledHash,
          scopeId: existing.scopeId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeScenarioBundle(record);
    },

    async executeScenarioBundle(
      this: AppServices,
      context,
      scenarioBundleId,
      input: ExecuteScenarioInput
    ): Promise<ScenarioExecutionResult> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "execute validation scenarios"
      );
      const record = await prisma.scenarioBundle.findFirst({
        where: {
          scenarioBundleId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!record) {
        throw new AppServiceError(
          "Scenario bundle not found.",
          404,
          "scenario_bundle_not_found"
        );
      }
      if (record.compiledHash !== input.compiledHash) {
        throw new AppServiceError(
          "Execution hash does not match the approved scenario preview.",
          409,
          "scenario_preview_hash_mismatch"
        );
      }
      if (record.status !== "Approved") {
        throw new AppServiceError(
          "Scenario bundle must be approved before execution.",
          409,
          "scenario_bundle_approval_required"
        );
      }
      await assertScenarioIntegrity(record);
      if (record.feedbackStoppedAt || record.feedbackLastStatus === "Stopped") {
        throw new AppServiceError(
          "This feedback loop was deliberately stopped. Compile and approve a new signed bundle to continue.",
          409,
          "scenario_feedback_stopped"
        );
      }
      if (
        record.feedbackCycleCount >= record.maximumIterations ||
        record.feedbackLastStatus === "Exhausted"
      ) {
        throw new AppServiceError(
          "The signed feedback-cycle limit is exhausted. Compile and approve a new bundle to continue.",
          409,
          "scenario_feedback_exhausted"
        );
      }
      if (record.feedbackLastStatus === "Running") {
        throw new AppServiceError(
          "A feedback cycle is already running for this signed bundle.",
          409,
          "scenario_feedback_cycle_running"
        );
      }
      if (
        input.expectedFeedbackCycleCount !== undefined &&
        input.expectedFeedbackCycleCount !== record.feedbackCycleCount
      ) {
        throw new AppServiceError(
          "Feedback state changed before execution. Refresh the loop before deciding again.",
          409,
          "scenario_feedback_state_changed"
        );
      }

      const startedAt = new Date();
      const reservation = await prisma.scenarioBundle.updateMany({
        data: {
          feedbackCycleCount: { increment: 1 },
          feedbackLastCompletedAt: null,
          feedbackLastError: null,
          feedbackLastReason: input.reason,
          feedbackLastReviewReference: input.reviewReference,
          feedbackLastStartedAt: startedAt,
          feedbackLastStatus: "Running"
        },
        where: {
          compiledHash: input.compiledHash,
          feedbackCycleCount: record.feedbackCycleCount,
          feedbackLastStatus: { not: "Running" },
          feedbackStoppedAt: null,
          scenarioBundleId,
          status: "Approved",
          tenantId: context.tenant.tenantId
        }
      });
      if (reservation.count !== 1) {
        throw new AppServiceError(
          "Feedback state changed before the cycle could be reserved. Refresh and retry deliberately.",
          409,
          "scenario_feedback_state_changed"
        );
      }

      const cycleNumber = record.feedbackCycleCount + 1;
      let engagement: Awaited<ReturnType<AppServices["runEngagement"]>>;
      try {
        await writeAuditEvent(prisma, {
          action: "scenario.feedback_cycle.started",
          actorType: "User",
          entityId: scenarioBundleId,
          entityType: "ScenarioBundle",
          metadata: {
            compiledHash: input.compiledHash,
            cycleNumber,
            maximumIterations: record.maximumIterations,
            reason: input.reason,
            reviewReference: input.reviewReference
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        engagement = await this.runEngagement(context, {
          authorizedOffensive: false,
          compiledHash: input.compiledHash,
          feedbackCycleNumber: cycleNumber,
          mode: "Execute",
          plan: [],
          scenarioBundleId,
          scopeId: record.scopeId
        });
      } catch (error) {
        const errorMessage = (
          error instanceof Error ? error.message : String(error)
        ).slice(0, 1000);
        const failedStatus =
          cycleNumber >= record.maximumIterations ? "Exhausted" : "Failed";
        await prisma.scenarioBundle.updateMany({
          data: {
            feedbackFailedCycleCount: { increment: 1 },
            feedbackLastCompletedAt: new Date(),
            feedbackLastError: errorMessage,
            feedbackLastStatus: failedStatus
          },
          where: {
            feedbackCycleCount: cycleNumber,
            feedbackLastStatus: "Running",
            scenarioBundleId,
            tenantId: context.tenant.tenantId
          }
        });
        await writeAuditEvent(prisma, {
          action: "scenario.feedback_cycle.failed",
          actorType: "User",
          entityId: scenarioBundleId,
          entityType: "ScenarioBundle",
          metadata: {
            compiledHash: input.compiledHash,
            cycleNumber,
            error: errorMessage,
            reviewReference: input.reviewReference
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        throw error;
      }

      const completedAt = new Date();
      const completedStatus =
        cycleNumber >= record.maximumIterations ? "Exhausted" : "Completed";
      const completedRecord = await prisma.scenarioBundle.update({
        data: {
          feedbackLastCompletedAt: completedAt,
          feedbackLastError: null,
          feedbackLastStatus: completedStatus
        },
        where: { scenarioBundleId }
      });
      await writeAuditEvent(prisma, {
        action: "scenario.feedback_cycle.completed",
        actorType: "User",
        entityId: scenarioBundleId,
        entityType: "ScenarioBundle",
        metadata: {
          branchMatchCount: engagement.steps.filter(
            (step) => step.branchDecision?.matched
          ).length,
          compiledHash: input.compiledHash,
          cycleNumber,
          engagementId: engagement.engagementId,
          evidenceCount: engagement.evidenceIds.length,
          status: engagement.status
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      await writeAuditEvent(prisma, {
        action: "scenario.executed",
        actorType: "User",
        entityId: scenarioBundleId,
        entityType: "ScenarioBundle",
        metadata: {
          compiledHash: input.compiledHash,
          engagementId: engagement.engagementId,
          evidenceCount: engagement.evidenceIds.length,
          status: engagement.status
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return ScenarioExecutionResultSchema.parse({
        bundle: serializeScenarioBundle(completedRecord),
        engagement,
        feedback: {
          cycleNumber,
          maximumIterations: record.maximumIterations,
          reason: input.reason,
          remainingIterations: Math.max(
            0,
            record.maximumIterations - cycleNumber
          ),
          reviewReference: input.reviewReference,
          status: completedStatus
        },
        integrity: {
          compiledHash: input.compiledHash,
          executionMatchedPreview: true
        }
      });
    },

    async stopScenarioFeedback(context, scenarioBundleId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "stop scenario feedback loops"
      );
      const record = await prisma.scenarioBundle.findFirst({
        where: {
          scenarioBundleId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!record) {
        throw new AppServiceError(
          "Scenario bundle not found.",
          404,
          "scenario_bundle_not_found"
        );
      }
      await assertScenarioIntegrity(record);
      if (record.feedbackLastStatus === "Running") {
        throw new AppServiceError(
          "A running feedback cycle must reach a recorded terminal state before the loop can be stopped.",
          409,
          "scenario_feedback_cycle_running"
        );
      }
      if (record.feedbackStoppedAt || record.feedbackLastStatus === "Stopped") {
        throw new AppServiceError(
          "This feedback loop is already stopped.",
          409,
          "scenario_feedback_stopped"
        );
      }
      if (
        record.feedbackCycleCount >= record.maximumIterations ||
        record.feedbackLastStatus === "Exhausted"
      ) {
        throw new AppServiceError(
          "The feedback loop already reached its signed iteration limit.",
          409,
          "scenario_feedback_exhausted"
        );
      }
      if (record.feedbackCycleCount !== input.expectedFeedbackCycleCount) {
        throw new AppServiceError(
          "Feedback state changed before the stop decision. Refresh the loop before deciding again.",
          409,
          "scenario_feedback_state_changed"
        );
      }
      const stoppedAt = new Date();
      const stopped = await prisma.scenarioBundle.updateMany({
        data: {
          feedbackLastStatus: "Stopped",
          feedbackStopReason: input.reason,
          feedbackStopReviewReference: input.reviewReference,
          feedbackStoppedAt: stoppedAt,
          feedbackStoppedBy: context.user.userId
        },
        where: {
          feedbackCycleCount: input.expectedFeedbackCycleCount,
          feedbackLastStatus: { not: "Running" },
          feedbackStoppedAt: null,
          scenarioBundleId,
          tenantId: context.tenant.tenantId
        }
      });
      if (stopped.count !== 1) {
        throw new AppServiceError(
          "Feedback state changed before the stop decision could be sealed.",
          409,
          "scenario_feedback_state_changed"
        );
      }
      await writeAuditEvent(prisma, {
        action: "scenario.feedback.stopped",
        actorType: "User",
        entityId: scenarioBundleId,
        entityType: "ScenarioBundle",
        metadata: {
          cycleCount: record.feedbackCycleCount,
          reason: input.reason,
          reviewReference: input.reviewReference
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      const updated = await prisma.scenarioBundle.findUniqueOrThrow({
        where: { scenarioBundleId }
      });
      return serializeScenarioBundle(updated);
    },

    async getScenarioBundle(context, scenarioBundleId) {
      const record = await prisma.scenarioBundle.findFirst({
        where: {
          scenarioBundleId,
          tenantId: context.tenant.tenantId
        }
      });
      return record ? serializeScenarioBundle(record) : null;
    },

    async listScenarioBundles(context) {
      const records = await prisma.scenarioBundle.findMany({
        orderBy: { createdAt: "desc" },
        take: SCENARIO_LIST_LIMIT,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map(serializeScenarioBundle);
    }
  };
}
