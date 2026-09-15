import { randomUUID } from "node:crypto";

import {
  evaluateModuleStartConstraints,
  getModuleById,
  getModuleRunMode
} from "@periscan/modules";
import {
  EngagementResultSchema,
  ScenarioBundleSchema,
  ScenarioBundleStepSchema,
  targetIncludesFixtureHints,
  type EngagementResult,
  type EngagementStepResult,
  type ScopeType
} from "@periscan/shared";

import {
  AppServiceError,
  executeInlineValidation,
  loadDestructiveValidationAuthorized,
  requireRole,
  SCOPE_EDITOR_ROLES,
  signTenantArtifact,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";
import { scenarioBundleSigningContent } from "../scenario-integrity.js";

// Default safe (passive/active) starting plan per scope type. Operators can pass
// an explicit plan; offensive modules are never added to a default plan — they
// must be explicitly requested AND authorized.
const DEFAULT_PLAN_BY_SCOPE: Partial<Record<ScopeType, string[]>> = {
  AIApplicationEndpoint: ["ai_app.safe_validation"],
  CloudAccount: ["prowler.aws_posture"],
  Domain: [
    "periscan.dns_resolution_check",
    "periscan.dns_email_security_check",
    "periscan.http_health_check"
  ],
  IPRange: ["recon.host_discovery", "recon.service_inventory"],
  InternalNetwork: ["recon.host_discovery", "recon.service_inventory"],
  Repository: [
    "gitleaks.repo_secrets",
    "trivy.repo_dependency_scan",
    "osv.repo_dependency_scan"
  ],
  Subdomain: ["periscan.dns_resolution_check", "periscan.http_health_check"]
};

function defaultPlan(scopeType: ScopeType): string[] {
  return DEFAULT_PLAN_BY_SCOPE[scopeType] ?? ["periscan.http_health_check"];
}

// Auto-supply scope context as module inputs so a plan step doesn't have to
// restate the target. Per-step target overrides these; governance fields are
// applied after both and are authoritative.
function buildScopeContext(
  scopeType: ScopeType,
  value: string
): Record<string, unknown> {
  switch (scopeType) {
    case "Domain":
    case "Subdomain":
      return {
        domain: value,
        host: value,
        hostname: value,
        targetHost: value,
        targets: value,
        url: `https://${value}`
      };
    case "IPRange":
    case "InternalNetwork":
      return { host: value, targetHost: value, targets: value };
    case "Repository":
      return { repositoryPath: value };
    case "CloudAccount":
      return { provider: "aws" };
    case "AIApplicationEndpoint":
      return { endpointUrl: value, url: value };
    default:
      return { host: value, targetHost: value, url: value };
  }
}

// Governed autonomous engagement orchestrator. Sequences each planned step
// through the standard governed dispatch (executeInlineValidation), with the
// offensive-authorization gate (evaluateModuleStartConstraints) applied first.
// It NEVER executes a tool directly. PlanOnly returns the plan without executing.
const ENGAGEMENT_LIST_LIMIT = 50;

export function createEngagementServices(
  deps: RuntimeServiceDeps
): Pick<AppServices, "runEngagement" | "getEngagement" | "listEngagements"> {
  const { devMode, prisma } = deps;

  // Re-validate a persisted row against the public schema so neither a read nor
  // a list can return a record that drifted from the contract.
  function toEngagementResult(record: {
    approvalId: string | null;
    compiledHash: string | null;
    engagementId: string;
    evidenceIds: string[];
    feedbackCycleNumber: number | null;
    generatedAt: Date;
    mode: string;
    scenarioBundleId: string | null;
    scopeId: string;
    status: string;
    steps: unknown;
    tenantId: string;
  }): EngagementResult {
    return EngagementResultSchema.parse({
      approvalId: record.approvalId,
      compiledHash: record.compiledHash,
      engagementId: record.engagementId,
      evidenceIds: record.evidenceIds,
      feedbackCycleNumber: record.feedbackCycleNumber,
      generatedAt: record.generatedAt.toISOString(),
      mode: record.mode,
      scenarioBundleId: record.scenarioBundleId,
      scopeId: record.scopeId,
      status: record.status,
      steps: record.steps,
      tenantId: record.tenantId
    });
  }

  return {
    async runEngagement(context, rawInput): Promise<EngagementResult> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "run autonomous engagements"
      );

      const input = rawInput;
      const scope = await prisma.scope.findFirst({
        where: { scopeId: input.scopeId, tenantId: context.tenant.tenantId }
      });
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }

      const authorization = input.authorizedOffensive
        ? await prisma.tenant.findUnique({
            select: {
              offensiveValidationAuthorizedAt: true,
              offensiveValidationAuthorizedBy: true,
              offensiveValidationAuthorizationRef: true,
              offensiveValidationEnabled: true
            },
            where: { tenantId: context.tenant.tenantId }
          })
        : null;
      if (
        input.authorizedOffensive &&
        (!authorization?.offensiveValidationEnabled ||
          !authorization.offensiveValidationAuthorizationRef ||
          input.approvalId !==
            authorization.offensiveValidationAuthorizationRef)
      ) {
        throw new AppServiceError(
          "Offensive execution requires the active tenant authorization reference. Enable offensive validation in Trust & Safety or use its exact authorization record.",
          400,
          "offensive_authorization_record_mismatch"
        );
      }

      const scopeVerified = scope.verificationStatus === "Verified";
      const scenarioBundle = input.scenarioBundleId
        ? await prisma.scenarioBundle.findFirst({
            where: {
              scenarioBundleId: input.scenarioBundleId,
              tenantId: context.tenant.tenantId
            }
          })
        : null;
      if (input.scenarioBundleId && !scenarioBundle) {
        throw new AppServiceError(
          "Scenario bundle not found.",
          404,
          "scenario_bundle_not_found"
        );
      }
      if (scenarioBundle) {
        const integrityBundle = ScenarioBundleSchema.parse({
          ...scenarioBundle,
          approvedAt: scenarioBundle.approvedAt?.toISOString() ?? null,
          compiledAt: scenarioBundle.compiledAt.toISOString(),
          createdAt: scenarioBundle.createdAt.toISOString(),
          feedbackLastCompletedAt:
            scenarioBundle.feedbackLastCompletedAt?.toISOString() ?? null,
          feedbackLastStartedAt:
            scenarioBundle.feedbackLastStartedAt?.toISOString() ?? null,
          feedbackStoppedAt:
            scenarioBundle.feedbackStoppedAt?.toISOString() ?? null,
          updatedAt: scenarioBundle.updatedAt.toISOString()
        });
        const expectedSignature = await signTenantArtifact(
          prisma,
          context.tenant.tenantId,
          devMode,
          scenarioBundleSigningContent(integrityBundle)
        );
        if (
          expectedSignature.digestSha256 !== scenarioBundle.compiledHash ||
          expectedSignature.digestSha256 !==
            integrityBundle.signature.digestSha256 ||
          expectedSignature.keyId !== integrityBundle.signature.keyId ||
          expectedSignature.signature !== integrityBundle.signature.signature
        ) {
          throw new AppServiceError(
            "Scenario bundle integrity verification failed.",
            409,
            "scenario_bundle_integrity_failed"
          );
        }
        if (scenarioBundle.status !== "Approved") {
          throw new AppServiceError(
            "Scenario bundle must be approved before execution.",
            409,
            "scenario_bundle_approval_required"
          );
        }
        if (
          scenarioBundle.scopeId !== input.scopeId ||
          scenarioBundle.compiledHash !== input.compiledHash
        ) {
          throw new AppServiceError(
            "Scenario execution must use the exact approved preview hash and scope.",
            409,
            "scenario_preview_hash_mismatch"
          );
        }
      }

      const planSteps = scenarioBundle
        ? ScenarioBundleStepSchema.array()
            .parse(scenarioBundle.steps)
            .map((step) => ({
              dependsOn: step.dependsOn,
              moduleId: step.moduleId,
              stepId: step.stepId,
              target: step.target,
              when: step.when
            }))
        : input.plan.length > 0
          ? input.plan
          : defaultPlan(scope.scopeType).map((moduleId, index) => ({
              dependsOn: [],
              moduleId,
              stepId: `step-${index + 1}`,
              target: {} as Record<string, unknown>,
              when: { kind: "Always" as const }
            }));

      if (
        !devMode &&
        planSteps.some((planStep) =>
          targetIncludesFixtureHints(planStep.target)
        )
      ) {
        throw new AppServiceError(
          "Fixture engagement targets are only available in dev mode.",
          400,
          "fixture_mode_disabled"
        );
      }

      const steps: EngagementStepResult[] = [];
      const stepById = new Map<string, EngagementStepResult>();
      const evidenceIds = new Set<string>();

      // The tenant's destructive-validation tier is the final switch that lifts
      // the module live-execution block (still gated on offensive approval +
      // verified scope + per-mission approval below). Loaded once per engagement.
      const authorizedDestructive = await loadDestructiveValidationAuthorized(
        prisma,
        context.tenant.tenantId
      );

      for (const [stepIndex, planStep] of planSteps.entries()) {
        const stepId = planStep.stepId ?? `step-${stepIndex + 1}`;
        const module = getModuleById(planStep.moduleId);
        if (!module) {
          steps.push({
            evidenceIds: [],
            moduleId: planStep.moduleId,
            reason: "module not found",
            runMode: "ServiceDirect",
            signalCount: 0,
            status: "failed",
            stepId,
            validationState: null
          });
          continue;
        }

        const runMode = getModuleRunMode(module.manifest);
        const dependencyResults = planStep.dependsOn.map((dependencyId) =>
          stepById.get(dependencyId)
        );
        const dependenciesMatched = dependencyResults.every(
          (dependency) => dependency?.status === "executed"
        );
        const predicate = planStep.when;
        const priorStep =
          predicate.kind === "PriorStep"
            ? stepById.get(predicate.stepId)
            : null;
        const predicateMatched =
          predicate.kind === "Always" ||
          Boolean(
            priorStep &&
            predicate.allowedStatuses.some(
              (status) => status === priorStep.status
            ) &&
            priorStep.evidenceIds.length >= predicate.minimumEvidenceCount &&
            priorStep.signalCount >= predicate.minimumSignalCount &&
            (predicate.validationStates.length === 0 ||
              (priorStep.validationState &&
                predicate.validationStates.includes(priorStep.validationState)))
          );
        const branchEvidence =
          predicate.kind === "Always"
            ? ["Unconditional approved branch."]
            : priorStep
              ? [
                  `${predicate.stepId} status=${priorStep.status}`,
                  `${predicate.stepId} evidence=${priorStep.evidenceIds.length}`,
                  `${predicate.stepId} signals=${priorStep.signalCount}`,
                  `${predicate.stepId} validationState=${priorStep.validationState ?? "none"}`
                ]
              : [`${predicate.stepId} has no prior result.`];

        if (
          input.mode === "Execute" &&
          (!dependenciesMatched || !predicateMatched)
        ) {
          const skipped: EngagementStepResult = {
            branchDecision: {
              evidence: branchEvidence,
              matched: false,
              predicate
            },
            evidenceIds: [],
            moduleId: planStep.moduleId,
            reason: !dependenciesMatched
              ? "Required predecessor did not execute."
              : "Measured branch predicate did not match.",
            runMode,
            signalCount: 0,
            status: "skipped",
            stepId,
            validationState: null
          };
          steps.push(skipped);
          stepById.set(stepId, skipped);
          continue;
        }
        const target: Record<string, unknown> = {
          ...buildScopeContext(scope.scopeType, scope.value),
          ...planStep.target,
          ...(devMode ? { fixtureMode: true } : {}),
          authorizedOffensive: input.authorizedOffensive === true,
          authorizedDestructive,
          scopeVerified,
          ...(input.approvalId ? { approvalId: input.approvalId } : {})
        };

        // Offensive-authorization gate (verified scope + approval + dry-run).
        const gate = evaluateModuleStartConstraints({
          executionEnvironment: module.manifest.executionMode,
          moduleManifests: [module.manifest],
          runnerId: null,
          target
        });
        if (!gate.allowed) {
          const denied: EngagementStepResult = {
            branchDecision: {
              evidence: branchEvidence,
              matched: true,
              predicate
            },
            evidenceIds: [],
            moduleId: planStep.moduleId,
            reason: gate.rationale,
            runMode,
            signalCount: 0,
            status: "denied",
            stepId,
            validationState: null
          };
          steps.push(denied);
          stepById.set(stepId, denied);
          continue;
        }

        if (input.mode === "PlanOnly") {
          const planned: EngagementStepResult = {
            branchDecision: null,
            evidenceIds: [],
            moduleId: planStep.moduleId,
            runMode,
            signalCount: 0,
            status: "planned",
            stepId,
            validationState: null
          };
          steps.push(planned);
          stepById.set(stepId, planned);
          continue;
        }

        try {
          const result = await executeInlineValidation({
            adminApproval: input.authorizedOffensive === true,
            context,
            executionEnvironment: module.manifest.executionMode,
            explicitMissionApproval: input.authorizedOffensive === true,
            missionType: module.manifest.supportedMissionTypes[0]!,
            moduleId: planStep.moduleId,
            prisma,
            scopeId: input.scopeId,
            target
          });
          const stepEvidence = result.evidence.map((item) => item.evidenceId);
          for (const id of stepEvidence) {
            evidenceIds.add(id);
          }
          const executed: EngagementStepResult = {
            branchDecision: {
              evidence: branchEvidence,
              matched: true,
              predicate
            },
            evidenceIds: stepEvidence,
            moduleId: planStep.moduleId,
            runId: result.run.runId,
            runMode,
            signalCount: result.signals.length,
            status: "executed",
            stepId,
            validationState: result.run.validationState ?? null
          };
          steps.push(executed);
          stepById.set(stepId, executed);
        } catch (error) {
          const failed: EngagementStepResult = {
            branchDecision: {
              evidence: branchEvidence,
              matched: true,
              predicate
            },
            evidenceIds: [],
            moduleId: planStep.moduleId,
            reason: error instanceof Error ? error.message : String(error),
            runMode,
            signalCount: 0,
            status: "failed",
            stepId,
            validationState: null
          };
          steps.push(failed);
          stepById.set(stepId, failed);
        }
      }

      const executedAny = steps.some((step) => step.status === "executed");
      const status: EngagementResult["status"] =
        input.mode === "PlanOnly"
          ? "Planned"
          : steps.length === 0
            ? "Empty"
            : executedAny
              ? "Completed"
              : "Denied";

      const engagementId = randomUUID();
      const generatedAt = new Date().toISOString();
      const result: EngagementResult = {
        approvalId: input.authorizedOffensive
          ? (input.approvalId ?? null)
          : null,
        compiledHash: scenarioBundle?.compiledHash ?? null,
        engagementId,
        evidenceIds: [...evidenceIds],
        feedbackCycleNumber: input.feedbackCycleNumber ?? null,
        generatedAt,
        mode: input.mode,
        scenarioBundleId: scenarioBundle?.scenarioBundleId ?? null,
        scopeId: input.scopeId,
        status,
        steps,
        tenantId: context.tenant.tenantId
      };

      // Persist the engagement so it can be read back via GET, then audit the
      // run as a first-class event (same governed pattern as the rest).
      await prisma.engagement.create({
        data: {
          approvalId: result.approvalId,
          compiledHash: result.compiledHash,
          engagementId,
          evidenceIds: result.evidenceIds,
          feedbackCycleNumber: result.feedbackCycleNumber,
          generatedAt: new Date(generatedAt),
          mode: result.mode,
          scenarioBundleId: result.scenarioBundleId,
          scopeId: result.scopeId,
          status: result.status,
          steps: result.steps,
          tenantId: context.tenant.tenantId
        }
      });
      await writeAuditEvent(prisma, {
        action: "engagement.run",
        actorType: "user",
        entityId: engagementId,
        entityType: "Engagement",
        metadata: {
          approvalId: result.approvalId,
          authorizationApprovedAt:
            authorization?.offensiveValidationAuthorizedAt?.toISOString() ??
            null,
          authorizationApprovedBy:
            authorization?.offensiveValidationAuthorizedBy ?? null,
          executedSteps: steps.filter((step) => step.status === "executed")
            .length,
          mode: result.mode,
          scopeId: result.scopeId,
          status: result.status,
          totalSteps: steps.length
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return result;
    },

    async getEngagement(
      context,
      engagementId
    ): Promise<EngagementResult | null> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "read autonomous engagements"
      );

      const record = await prisma.engagement.findFirst({
        where: { engagementId, tenantId: context.tenant.tenantId }
      });
      if (!record) {
        return null;
      }

      await writeAuditEvent(prisma, {
        action: "engagement.read",
        actorType: "user",
        entityId: record.engagementId,
        entityType: "Engagement",
        metadata: { scopeId: record.scopeId, status: record.status },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return toEngagementResult(record);
    },

    async listEngagements(context): Promise<EngagementResult[]> {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "list autonomous engagements"
      );

      const records = await prisma.engagement.findMany({
        orderBy: { createdAt: "desc" },
        take: ENGAGEMENT_LIST_LIMIT,
        where: { tenantId: context.tenant.tenantId }
      });

      return records.map((record) => toEngagementResult(record));
    }
  };
}
