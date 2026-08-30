// @ts-nocheck
import { createHash, randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import { getConnectorByKey } from "@periscan/connectors";
import { createPrismaEvidenceService } from "@periscan/evidence";
import { getModuleById } from "@periscan/modules";
import { evaluatePolicy } from "@periscan/policy";
import {
  PolicyRequestedActionSchema,
  ValidationStimulusSchema,
  type ControlValidationVerdict,
  type CreateValidationStimulusInput,
  type ValidationStimulus
} from "@periscan/shared";

import {
  decryptIntegrationConfig,
  integrationSecretFieldKeys
} from "../integration-credentials.js";
import { enforceExecutionPolicy } from "../policy-enforcement-point.js";
import {
  serializePolicyDecision,
  serializeScope
} from "../serializers/entities.js";
import {
  AppServiceError,
  createObservedControlSignal,
  evaluateExternalValidationExecution,
  getConnectorKey,
  isMockMode,
  loadDestructiveValidationAuthorized,
  loadOffensiveValidationAuthorized,
  parseObserverOutcome,
  requireRole,
  SCOPE_EDITOR_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

const MAX_REQUEST_BYTES = 1024;
const RATE_LIMIT_PER_MINUTE = 1;
const SAFE_CANARY_MODULE_ID = "periscan.http_health_check";
const CLEANUP_BEHAVIOR =
  "Periscan creates no server-side object. The one-request marker expires at the observation deadline and is retained only as hashed evidence.";

type StimulusWithVerdict = Prisma.ValidationStimulusGetPayload<{
  include: { verdict: true };
}>;

function serializeVerdict(record: NonNullable<StimulusWithVerdict["verdict"]>) {
  return {
    controlSourceId: record.controlSourceId,
    correlationMatched: record.correlationMatched,
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    observedAt: record.observedAt?.toISOString() ?? null,
    observedOutcome: record.observedOutcome,
    reason: record.reason,
    signalIds: record.signalIds,
    stimulusId: record.stimulusId,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString(),
    verdict: record.verdict,
    verdictId: record.verdictId
  };
}

function serializeStimulus(record: StimulusWithVerdict): ValidationStimulus {
  return ValidationStimulusSchema.parse({
    cleanupBehavior: record.cleanupBehavior,
    completedAt: record.completedAt?.toISOString() ?? null,
    controlSourceId: record.controlSourceId,
    createdAt: record.createdAt.toISOString(),
    createdBy: record.createdBy,
    dispatchReceipt: record.dispatchReceipt,
    dispatchedAt: record.dispatchedAt?.toISOString() ?? null,
    errorSummary: record.errorSummary,
    evidenceIds: record.evidenceIds,
    expectedControlBehaviors: record.expectedControlBehaviors,
    markerFingerprint: record.markerHash.slice(0, 12),
    maxRequestBytes: record.maxRequestBytes,
    missionId: record.missionId,
    observationDeadlineAt: record.observationDeadlineAt?.toISOString() ?? null,
    policyDecisionId: record.policyDecisionId,
    rateLimitPerMinute: record.rateLimitPerMinute,
    runId: record.runId,
    safetyLevel: record.safetyLevel,
    scopeId: record.scopeId,
    status: record.status,
    stimulusId: record.stimulusId,
    stimulusType: record.stimulusType,
    targetHost: record.targetHost,
    techniqueId: record.techniqueId,
    tenantId: record.tenantId,
    ttlSeconds: record.ttlSeconds,
    updatedAt: record.updatedAt.toISOString(),
    verdict: record.verdict ? serializeVerdict(record.verdict) : null
  });
}

function readTarget(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeScopeHost(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value.includes("://") ? value : `https://${value}`);
  } catch {
    throw new AppServiceError(
      "The verified domain scope does not contain a valid hostname.",
      400,
      "stimulus_target_invalid"
    );
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new AppServiceError(
      "The verified domain scope does not contain a safe hostname.",
      400,
      "stimulus_target_invalid"
    );
  }
  return parsed.hostname.toLowerCase();
}

function buildCanaryUrl(targetHost: string, correlationToken: string) {
  return new URL(
    `https://${targetHost}/.well-known/periscan-validation/${encodeURIComponent(correlationToken)}`
  );
}

function requestSize(url: URL, markerHash: string) {
  return Buffer.byteLength(
    `GET ${url.pathname} HTTP/1.1\r\nHost: ${url.hostname}\r\nX-Periscan-Validation-Marker: sha256:${markerHash}\r\n\r\n`,
    "utf8"
  );
}

function verdictFromOutcome(
  outcome: ReturnType<typeof parseObserverOutcome>["outcome"]
): ControlValidationVerdict {
  switch (outcome) {
    case "Blocked":
      return "Prevented";
    case "Detected":
    case "Alerted":
    case "Routed":
      return "Detected";
    case "Logged":
      return "TelemetryOnly";
    case "Missed":
      return "Missed";
    case "NoEvidence":
    case "NeedsTuning":
      return "Inconclusive";
  }
}

function validationStateForVerdict(verdict: ControlValidationVerdict) {
  switch (verdict) {
    case "Prevented":
      return "Blocked" as const;
    case "Detected":
      return "Detected" as const;
    case "TelemetryOnly":
      return "Logged" as const;
    case "Missed":
      return "Missed" as const;
    case "Inconclusive":
    case "NotObservedBeforeTimeout":
      return "Inconclusive" as const;
  }
}

export function createControlStimulusServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "cancelValidationStimulus"
  | "createValidationStimulus"
  | "dispatchValidationStimulus"
  | "listValidationStimuli"
  | "observeValidationStimulus"
> {
  const {
    emitTenantWebhook,
    externalValidationConfig,
    externalValidationRateState,
    fetchImpl,
    prisma
  } = deps;

  async function loadStimulus(tenantId: string, stimulusId: string) {
    return prisma.validationStimulus.findFirst({
      include: { verdict: true },
      where: { stimulusId, tenantId }
    });
  }

  async function finishVerdict(input: {
    context: Parameters<AppServices["listValidationStimuli"]>[0];
    correlationMatched: boolean;
    detail: string;
    evidenceId: string;
    observedAt: Date | null;
    observedOutcome: string | null;
    signalId: string | null;
    stimulus: StimulusWithVerdict;
    verdict: ControlValidationVerdict;
  }) {
    const completedAt = new Date();
    const evidenceIds = [
      ...new Set([...input.stimulus.evidenceIds, input.evidenceId])
    ];
    const updated = await prisma.$transaction(async (tx) => {
      await tx.controlValidationVerdictRecord.upsert({
        create: {
          controlSourceId: input.stimulus.controlSourceId,
          correlationMatched: input.correlationMatched,
          evidenceIds: [input.evidenceId],
          observedAt: input.observedAt,
          observedOutcome: input.observedOutcome,
          reason: input.detail,
          signalIds: input.signalId ? [input.signalId] : [],
          stimulusId: input.stimulus.stimulusId,
          tenantId: input.context.tenant.tenantId,
          verdict: input.verdict
        },
        update: {
          correlationMatched: input.correlationMatched,
          evidenceIds: [input.evidenceId],
          observedAt: input.observedAt,
          observedOutcome: input.observedOutcome,
          reason: input.detail,
          signalIds: input.signalId ? [input.signalId] : [],
          verdict: input.verdict
        },
        where: { stimulusId: input.stimulus.stimulusId }
      });
      await tx.validationRun.update({
        data: {
          completedAt,
          evidenceIds,
          outcome: input.verdict,
          status: "Completed",
          validationState: validationStateForVerdict(input.verdict)
        },
        where: { runId: input.stimulus.runId! }
      });
      await tx.validationMission.update({
        data: {
          completedAt,
          evidenceIds,
          status: "Completed"
        },
        where: { missionId: input.stimulus.missionId }
      });
      if (["Missed", "NotObservedBeforeTimeout"].includes(input.verdict)) {
        await tx.controlSource.update({
          data: { healthStatus: "Degraded", lastValidatedAt: completedAt },
          where: { controlSourceId: input.stimulus.controlSourceId }
        });
      } else if (input.correlationMatched) {
        await tx.controlSource.update({
          data: {
            healthStatus: "Healthy",
            lastValidatedAt: completedAt,
            telemetryStatus: "Healthy"
          },
          where: { controlSourceId: input.stimulus.controlSourceId }
        });
      }
      return tx.validationStimulus.update({
        data: {
          completedAt,
          evidenceIds,
          status: "Completed"
        },
        include: { verdict: true },
        where: { stimulusId: input.stimulus.stimulusId }
      });
    });

    await writeAuditEvent(prisma, {
      action: "validation_stimulus.observed",
      actorType: "User",
      entityId: input.stimulus.stimulusId,
      entityType: "ValidationStimulus",
      metadata: {
        correlationMatched: input.correlationMatched,
        observedOutcome: input.observedOutcome,
        verdict: input.verdict
      },
      tenantId: input.context.tenant.tenantId,
      userId: input.context.user.userId
    });

    return serializeStimulus(updated);
  }

  return {
    async listValidationStimuli(context) {
      const records = await prisma.validationStimulus.findMany({
        include: { verdict: true },
        orderBy: { createdAt: "desc" },
        take: 100,
        where: { tenantId: context.tenant.tenantId }
      });
      return records.map(serializeStimulus);
    },

    async createValidationStimulus(
      this: AppServices,
      context,
      input: CreateValidationStimulusInput
    ) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create validation stimuli"
      );
      const [scope, controlSource] = await Promise.all([
        prisma.scope.findFirst({
          where: {
            scopeId: input.scopeId,
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.controlSource.findFirst({
          where: {
            controlSourceId: input.controlSourceId,
            tenantId: context.tenant.tenantId
          }
        })
      ]);
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }
      if (!controlSource) {
        throw new AppServiceError(
          "Control source not found.",
          404,
          "control_source_not_found"
        );
      }
      if (
        scope.verificationStatus !== "Verified" ||
        !["Domain", "Subdomain"].includes(scope.scopeType)
      ) {
        throw new AppServiceError(
          "Owned-domain canaries require a verified Domain or Subdomain scope.",
          400,
          "stimulus_verified_domain_required"
        );
      }

      const targetHost = normalizeScopeHost(scope.value);
      const correlationToken = `periscan-scv-${randomUUID()}`;
      const markerHash = createHash("sha256")
        .update(correlationToken)
        .digest("hex");
      const policyDecision = await this.previewPolicyDecision(
        context,
        scope.scopeId,
        {
          executionEnvironment: "ExternalPoA",
          explicitMissionApproval: false,
          missionType: "ControlValidation",
          requestedAction: {
            credentialTheft: false,
            destructive: false,
            persistence: false,
            realDataExfiltration: false,
            requiresInternalRunner: false,
            requiresTimeWindow: false,
            uncontrolledExploitChaining: false
          },
          safetyLevel: "ControlledValidation",
          target: {
            controlSourceId: controlSource.controlSourceId,
            stimulusType: input.stimulusType,
            targetHost,
            techniqueId: input.techniqueId,
            templateProfile: "safe-baseline"
          }
        }
      );
      const mission = await this.createMission(context, {
        missionType: "ControlValidation",
        policyDecisionId: policyDecision.policyDecisionId,
        policyProfile: "owned-domain-control-canary",
        safetyLevel: "ControlledValidation",
        scopeId: scope.scopeId,
        scopeIds: [scope.scopeId]
      });
      const status =
        policyDecision.outcome === "Allowed"
          ? "Ready"
          : policyDecision.outcome === "RequiresApproval"
            ? "RequiresApproval"
            : "DeniedByPolicy";
      const record = await prisma.validationStimulus.create({
        data: {
          cleanupBehavior: CLEANUP_BEHAVIOR,
          controlSourceId: controlSource.controlSourceId,
          correlationToken,
          createdBy: context.user.userId,
          evidenceIds: [],
          expectedControlBehaviors: controlSource.expectedBehaviors,
          markerHash,
          maxRequestBytes: MAX_REQUEST_BYTES,
          missionId: mission.missionId,
          policyDecisionId: policyDecision.policyDecisionId,
          rateLimitPerMinute: RATE_LIMIT_PER_MINUTE,
          safetyLevel: "ControlledValidation",
          scopeId: scope.scopeId,
          status,
          stimulusType: input.stimulusType,
          targetHost,
          techniqueId: input.techniqueId,
          tenantId: context.tenant.tenantId,
          ttlSeconds: input.ttlSeconds
        },
        include: { verdict: true }
      });

      await writeAuditEvent(prisma, {
        action: "validation_stimulus.created",
        actorType: "User",
        entityId: record.stimulusId,
        entityType: "ValidationStimulus",
        metadata: {
          markerFingerprint: markerHash.slice(0, 12),
          policyDecisionId: policyDecision.policyDecisionId,
          status,
          targetHost,
          techniqueId: input.techniqueId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return { policyDecision, stimulus: serializeStimulus(record) };
    },

    async dispatchValidationStimulus(context, stimulusId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "dispatch validation stimuli"
      );
      const stimulus = await prisma.validationStimulus.findFirst({
        include: {
          policyDecision: true,
          scope: true,
          verdict: true
        },
        where: { stimulusId, tenantId: context.tenant.tenantId }
      });
      if (!stimulus) {
        throw new AppServiceError(
          "Validation stimulus not found.",
          404,
          "validation_stimulus_not_found"
        );
      }
      if (!["RequiresApproval", "Ready"].includes(stimulus.status)) {
        throw new AppServiceError(
          `Stimulus cannot dispatch from ${stimulus.status}.`,
          409,
          "validation_stimulus_not_dispatchable"
        );
      }
      // P03-20: full dual-gate PEP (stored + live re-eval), not only stored gate.
      const pep = await enforceExecutionPolicy({
        decision: stimulus.policyDecision,
        entrypoint: "stimulus_dispatch",
        expected: { scopeId: stimulus.scope.scopeId },
        prisma,
        scope: stimulus.scope,
        tenantId: context.tenant.tenantId,
        userId: context.user.userId,
        userRole: context.membership.role
      });
      if (pep.verdict === "RequiresApproval") {
        throw new AppServiceError(
          "The stimulus policy decision still requires admin approval.",
          409,
          "validation_stimulus_approval_required"
        );
      }
      if (pep.verdict === "Denied" || !pep.allowance) {
        await prisma.validationStimulus.update({
          data: { status: "DeniedByPolicy" },
          where: { stimulusId }
        });
        await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
          code: pep.code,
          outcome: pep.liveOutcome ?? stimulus.policyDecision.outcome,
          policyDecisionId: stimulus.policyDecision.policyDecisionId,
          rationale:
            pep.liveRationale ?? stimulus.policyDecision.rationale,
          scopeId: stimulus.policyDecision.scopeId,
          stage: "stimulus_dispatch",
          stimulusId
        });
        throw new AppServiceError(
          "The stimulus policy decision is denied or expired.",
          403,
          "validation_stimulus_policy_denied"
        );
      }

      // Dual policy gate (aligned with startMission): stored Allowed/Approved is
      // not authority alone. Scope may have been revoked and tenant flips may
      // have tightened after the decision was minted. Fail closed — do not
      // dispatch denied work.
      if (stimulus.scope.verificationStatus !== "Verified") {
        await prisma.validationStimulus.update({
          data: {
            errorSummary:
              "Stimulus dispatch requires the bound scope to remain verified.",
            status: "DeniedByPolicy"
          },
          where: { stimulusId }
        });
        await writeAuditEvent(prisma, {
          action: "policy.decision",
          actorType: "System",
          entityId: stimulus.policyDecision.policyDecisionId,
          entityType: "Scope",
          metadata: {
            code: "verified_scope_required",
            outcome: "RequiresVerifiedScope",
            rationale:
              "Stimulus dispatch requires the bound scope to remain verified; the stored policy decision is not sufficient once verification is revoked.",
            scopeId: stimulus.scope.scopeId,
            scopeVerificationStatus: stimulus.scope.verificationStatus,
            stage: "stimulus_dispatch",
            startGateRecheck: true,
            stimulusId
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
          code: "verified_scope_required",
          outcome: "RequiresVerifiedScope",
          policyDecisionId: stimulus.policyDecision.policyDecisionId,
          scopeId: stimulus.scope.scopeId,
          stage: "stimulus_dispatch",
          stimulusId
        });
        throw new AppServiceError(
          "Stimulus dispatch requires the bound scope to remain verified.",
          403,
          "validation_stimulus_scope_unverified"
        );
      }

      let requestedAction;
      try {
        requestedAction = PolicyRequestedActionSchema.parse(
          stimulus.policyDecision.requestedAction
        );
      } catch {
        await prisma.validationStimulus.update({
          data: {
            errorSummary:
              "Stored policy decision requestedAction is invalid; fail closed.",
            status: "DeniedByPolicy"
          },
          where: { stimulusId }
        });
        throw new AppServiceError(
          "Stored policy decision requestedAction is invalid; fail closed and do not dispatch.",
          403,
          "validation_stimulus_policy_action_invalid"
        );
      }

      const priorApprovalGranted =
        stimulus.policyDecision.approvalState === "Approved";
      const liveEvaluation = evaluatePolicy({
        adminApproval: priorApprovalGranted,
        destructiveValidationAuthorized:
          await loadDestructiveValidationAuthorized(
            prisma,
            context.tenant.tenantId
          ),
        executionEnvironment: stimulus.policyDecision.executionEnvironment,
        explicitMissionApproval: priorApprovalGranted,
        missionType: stimulus.policyDecision.missionType,
        offensiveValidationAuthorized: await loadOffensiveValidationAuthorized(
          prisma,
          context.tenant.tenantId
        ),
        requestedAction,
        safetyLevel: stimulus.policyDecision.safetyLevel,
        scopeContext: stimulus.scope,
        scopeVerificationStatus: stimulus.scope.verificationStatus,
        timeWindowApproved:
          priorApprovalGranted ||
          stimulus.policyDecision.outcome === "Allowed",
        userRole: context.membership.role
      });
      const liveGate = evaluatePolicyDecisionGate({
        approvalState:
          liveEvaluation.outcome === "RequiresApproval" && priorApprovalGranted
            ? "Approved"
            : liveEvaluation.approvalState,
        expiresAt: stimulus.policyDecision.expiresAt,
        outcome: liveEvaluation.outcome
      });
      if (liveGate !== "start") {
        await prisma.validationStimulus.update({
          data: {
            errorSummary: liveEvaluation.rationale,
            status:
              liveGate === "pending" ? "RequiresApproval" : "DeniedByPolicy"
          },
          where: { stimulusId }
        });
        await writeAuditEvent(prisma, {
          action: "policy.decision",
          actorType: "System",
          entityId: stimulus.policyDecision.policyDecisionId,
          entityType: "Scope",
          metadata: {
            code:
              liveGate === "pending"
                ? "policy_reevaluation_requires_approval"
                : "policy_reevaluation_denied",
            outcome: liveEvaluation.outcome,
            rationale: liveEvaluation.rationale,
            scopeId: stimulus.scope.scopeId,
            stage: "stimulus_dispatch",
            startGateRecheck: true,
            stimulusId
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        if (liveGate === "denied") {
          await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
            outcome: liveEvaluation.outcome,
            policyDecisionId: stimulus.policyDecision.policyDecisionId,
            rationale: liveEvaluation.rationale,
            scopeId: stimulus.scope.scopeId,
            stage: "stimulus_dispatch",
            stimulusId
          });
        }
        throw new AppServiceError(
          liveGate === "pending"
            ? "Live policy re-evaluation requires approval before stimulus dispatch."
            : liveEvaluation.rationale,
          liveGate === "pending" ? 409 : 403,
          liveGate === "pending"
            ? "validation_stimulus_live_approval_required"
            : "validation_stimulus_live_policy_denied"
        );
      }

      const policyTarget = readTarget(stimulus.policyDecision.target);
      if (
        policyTarget.targetHost !== stimulus.targetHost ||
        policyTarget.techniqueId !== stimulus.techniqueId ||
        policyTarget.controlSourceId !== stimulus.controlSourceId
      ) {
        throw new AppServiceError(
          "The stimulus no longer matches its approved policy target.",
          400,
          "validation_stimulus_policy_binding_mismatch"
        );
      }

      const module = getModuleById(SAFE_CANARY_MODULE_ID);
      if (!module) {
        throw new AppServiceError(
          "Safe external canary module is unavailable.",
          503,
          "validation_stimulus_module_unavailable"
        );
      }
      const guard = await evaluateExternalValidationExecution({
        config: externalValidationConfig,
        decision: serializePolicyDecision(stimulus.policyDecision),
        modules: [module.manifest],
        rateState: externalValidationRateState,
        scope: serializeScope(stimulus.scope),
        target: policyTarget,
        tenantId: context.tenant.tenantId
      });
      if (!guard.allowed) {
        await prisma.validationStimulus.update({
          data: { errorSummary: guard.rationale, status: "DeniedByPolicy" },
          where: { stimulusId }
        });
        await emitTenantWebhook(context.tenant.tenantId, "policy.denied", {
          code: "external_validation_guard",
          outcome: "Denied",
          policyDecisionId: stimulus.policyDecision.policyDecisionId,
          rationale: guard.rationale,
          scopeId: stimulus.scope.scopeId,
          stage: "external_validation",
          stimulusId
        });
        throw new AppServiceError(
          guard.rationale,
          403,
          "validation_stimulus_external_guard_denied"
        );
      }

      const minuteAgo = new Date(Date.now() - 60_000);
      const recentDispatch = await prisma.validationStimulus.findFirst({
        where: {
          dispatchedAt: { gte: minuteAgo },
          stimulusId: { not: stimulusId },
          tenantId: context.tenant.tenantId
        }
      });
      if (recentDispatch) {
        throw new AppServiceError(
          "Tenant canary rate limit is one dispatch per minute.",
          429,
          "validation_stimulus_rate_limited"
        );
      }

      const url = buildCanaryUrl(
        stimulus.targetHost,
        stimulus.correlationToken
      );
      const bytes = requestSize(url, stimulus.markerHash);
      if (bytes > stimulus.maxRequestBytes) {
        throw new AppServiceError(
          "Canary request exceeds its approved byte budget.",
          400,
          "validation_stimulus_request_too_large"
        );
      }
      const startedAt = Date.now();
      const run = await prisma.$transaction(async (tx) => {
        await tx.validationMission.update({
          data: { startedAt: new Date(), status: "Running" },
          where: { missionId: stimulus.missionId }
        });
        const createdRun = await tx.validationRun.create({
          data: {
            evidenceIds: [],
            missionId: stimulus.missionId,
            moduleId: "periscan.owned_domain_url_canary",
            policyDecisionId: stimulus.policyDecisionId,
            safetyLevel: stimulus.safetyLevel,
            scopeId: stimulus.scopeId,
            startedAt: new Date(),
            status: "Running",
            target: {
              markerFingerprint: stimulus.markerHash.slice(0, 12),
              stimulusId,
              targetHost: stimulus.targetHost,
              techniqueId: stimulus.techniqueId
            },
            techniqueIds: [stimulus.techniqueId],
            tenantId: context.tenant.tenantId,
            validationState: "Inconclusive"
          }
        });
        await tx.validationStimulus.update({
          data: { runId: createdRun.runId, status: "Dispatching" },
          where: { stimulusId }
        });
        return createdRun;
      });

      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: {
            accept: "text/plain, */*;q=0.1",
            "user-agent": "Periscan-Safe-Control-Validation/1.0",
            "x-periscan-validation-marker": `sha256:${stimulus.markerHash}`
          },
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(10_000)
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Canary dispatch failed.";
        await prisma.$transaction([
          prisma.validationStimulus.update({
            data: { errorSummary: message, status: "Failed" },
            where: { stimulusId }
          }),
          prisma.validationRun.update({
            data: {
              completedAt: new Date(),
              errorSummary: message,
              outcome: "stimulus_dispatch_failed",
              status: "Failed"
            },
            where: { runId: run.runId }
          }),
          prisma.validationMission.update({
            data: { completedAt: new Date(), status: "Failed" },
            where: { missionId: stimulus.missionId }
          })
        ]);
        throw new AppServiceError(
          "The safe canary could not be dispatched; no detection verdict was recorded.",
          502,
          "validation_stimulus_dispatch_failed"
        );
      }

      const dispatchedAt = new Date();
      const deadline = new Date(
        dispatchedAt.getTime() + stimulus.ttlSeconds * 1000
      );
      const receipt = {
        latencyMs: Date.now() - startedAt,
        method: "GET" as const,
        requestBytes: bytes,
        responseStatus: response.status,
        targetHost: stimulus.targetHost
      };
      const evidenceService = createPrismaEvidenceService({ prisma });
      const artifact = await evidenceService.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: {
          dispatchReceipt: receipt,
          markerHash: stimulus.markerHash,
          observationDeadlineAt: deadline.toISOString(),
          safetyBounds: {
            maxRequestBytes: stimulus.maxRequestBytes,
            rateLimitPerMinute: stimulus.rateLimitPerMinute,
            redirectsFollowed: false,
            requestCount: 1
          },
          stimulusType: stimulus.stimulusType,
          techniqueId: stimulus.techniqueId
        },
        filename: "owned-domain-control-canary-dispatch",
        relatedEntityId: stimulus.stimulusId,
        relatedEntityType: "ValidationStimulus",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });
      const updated = await prisma.validationStimulus.update({
        data: {
          dispatchReceipt: receipt,
          dispatchedAt,
          evidenceIds: [artifact.artifact.evidenceId],
          observationDeadlineAt: deadline,
          status: "Observing"
        },
        include: { verdict: true },
        where: { stimulusId }
      });
      await prisma.validationRun.update({
        data: {
          evidenceIds: [artifact.artifact.evidenceId],
          outcome: "stimulus_dispatched"
        },
        where: { runId: run.runId }
      });
      await writeAuditEvent(prisma, {
        action: "validation_stimulus.dispatched",
        actorType: "User",
        entityId: stimulus.stimulusId,
        entityType: "ValidationStimulus",
        metadata: {
          evidenceId: artifact.artifact.evidenceId,
          markerFingerprint: stimulus.markerHash.slice(0, 12),
          requestBytes: bytes,
          responseStatus: response.status
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeStimulus(updated);
    },

    async observeValidationStimulus(context, stimulusId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "observe validation stimuli"
      );
      const stimulus = await prisma.validationStimulus.findFirst({
        include: {
          controlSource: { include: { integration: true } },
          verdict: true
        },
        where: { stimulusId, tenantId: context.tenant.tenantId }
      });
      if (!stimulus) {
        throw new AppServiceError(
          "Validation stimulus not found.",
          404,
          "validation_stimulus_not_found"
        );
      }
      if (stimulus.status !== "Observing" || !stimulus.runId) {
        throw new AppServiceError(
          `Stimulus cannot be observed from ${stimulus.status}.`,
          409,
          "validation_stimulus_not_observing"
        );
      }

      const evidenceService = createPrismaEvidenceService({ prisma });
      const now = new Date();
      if (
        stimulus.observationDeadlineAt &&
        now > stimulus.observationDeadlineAt
      ) {
        const artifact = await evidenceService.putEvidenceArtifact({
          artifactType: "NormalizedEvidence",
          content: {
            correlationMatched: false,
            markerHash: stimulus.markerHash,
            observationDeadlineAt: stimulus.observationDeadlineAt.toISOString(),
            verdict: "NotObservedBeforeTimeout"
          },
          filename: "control-canary-observation-timeout",
          relatedEntityId: stimulus.stimulusId,
          relatedEntityType: "ValidationStimulus",
          sensitivityLevel: "Moderate",
          tenantId: context.tenant.tenantId
        });
        return finishVerdict({
          context,
          correlationMatched: false,
          detail:
            "No exact marker observation was recorded before the approved TTL expired.",
          evidenceId: artifact.artifact.evidenceId,
          observedAt: null,
          observedOutcome: null,
          signalId: null,
          stimulus,
          verdict: "NotObservedBeforeTimeout"
        });
      }

      const integration = stimulus.controlSource.integration;
      const connectorKey = getConnectorKey(integration.config);
      const connector = connectorKey ? getConnectorByKey(connectorKey) : null;
      if (!connector?.observeControl) {
        const artifact = await evidenceService.putEvidenceArtifact({
          artifactType: "NormalizedEvidence",
          content: {
            correlationMatched: false,
            markerHash: stimulus.markerHash,
            reason: "Configured connector has no read-only control observer."
          },
          filename: "control-canary-observer-unavailable",
          relatedEntityId: stimulus.stimulusId,
          relatedEntityType: "ValidationStimulus",
          sensitivityLevel: "Moderate",
          tenantId: context.tenant.tenantId
        });
        return finishVerdict({
          context,
          correlationMatched: false,
          detail:
            "The configured connector cannot correlate this marker with read-only telemetry.",
          evidenceId: artifact.artifact.evidenceId,
          observedAt: null,
          observedOutcome: null,
          signalId: null,
          stimulus,
          verdict: "Inconclusive"
        });
      }

      const observed = await connector.observeControl({
        authType: integration.authType,
        config: {
          ...decryptIntegrationConfig(
            integration.config,
            integrationSecretFieldKeys(connector, integration.authType)
          ),
          correlationToken: stimulus.correlationToken,
          techniqueId: stimulus.techniqueId
        },
        integrationId: integration.integrationId,
        mockMode: isMockMode(integration.config),
        tenantId: context.tenant.tenantId
      });
      const parsed = parseObserverOutcome(observed);
      const correlationMatched = observed.correlationMatched === true;
      const artifact = await evidenceService.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: {
          confidence: parsed.confidence,
          correlationMatched,
          markerHash: stimulus.markerHash,
          observedOutcome: parsed.outcome,
          observerDetail: parsed.detail,
          observerSourceType: parsed.sourceType
        },
        filename: "control-canary-exact-observation",
        relatedEntityId: stimulus.stimulusId,
        relatedEntityType: "ValidationStimulus",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });

      if (parsed.outcome === "NoEvidence" && !correlationMatched) {
        const updated = await prisma.validationStimulus.update({
          data: {
            evidenceIds: [
              ...new Set([
                ...stimulus.evidenceIds,
                artifact.artifact.evidenceId
              ])
            ]
          },
          include: { verdict: true },
          where: { stimulusId }
        });
        return serializeStimulus(updated);
      }

      const verdict = correlationMatched
        ? verdictFromOutcome(parsed.outcome)
        : "Inconclusive";
      let signalId: string | null = null;
      if (correlationMatched) {
        const signal = createObservedControlSignal({
          confidence: parsed.confidence,
          controlSourceId: stimulus.controlSourceId,
          detail: parsed.detail,
          outcome: parsed.outcome,
          sourceIntegrationId: integration.integrationId,
          sourceType: parsed.sourceType,
          sourceVendor: connector.manifest.vendor,
          techniqueId: stimulus.techniqueId,
          tenantId: context.tenant.tenantId
        });
        signalId = signal.signalId;
        await prisma.signalEnvelope.create({
          data: {
            confidence: signal.confidence,
            evidenceIds: [artifact.artifact.evidenceId],
            freshness: signal.freshness,
            rawPayloadPointer: signal.rawPayloadPointer,
            redactionStatus: signal.redactionStatus,
            relatedAssetIds: signal.relatedAssetIds,
            relatedControlIds: signal.relatedControlIds,
            relatedEvidenceIds: [artifact.artifact.evidenceId],
            relatedIdentityIds: signal.relatedIdentityIds,
            relatedPathIds: signal.relatedPathIds,
            sensitivityLevel: signal.sensitivityLevel,
            signalCategory: signal.signalCategory,
            signalId: signal.signalId,
            signalSubcategory: signal.signalSubcategory,
            sourceIntegrationId: signal.sourceIntegrationId,
            sourceType: signal.sourceType,
            sourceVendor: signal.sourceVendor,
            techniqueIds: signal.techniqueIds,
            tenantId: signal.tenantId,
            timestampIngested: new Date(signal.timestampIngested),
            timestampObserved: new Date(signal.timestampObserved)
          }
        });
      }

      return finishVerdict({
        context,
        correlationMatched,
        detail: correlationMatched
          ? parsed.detail
          : "The observer returned contextual telemetry, but it did not prove an exact marker match.",
        evidenceId: artifact.artifact.evidenceId,
        observedAt: correlationMatched ? now : null,
        observedOutcome: parsed.outcome,
        signalId,
        stimulus,
        verdict
      });
    },

    async cancelValidationStimulus(context, stimulusId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "cancel validation stimuli"
      );
      const stimulus = await loadStimulus(context.tenant.tenantId, stimulusId);
      if (!stimulus) {
        throw new AppServiceError(
          "Validation stimulus not found.",
          404,
          "validation_stimulus_not_found"
        );
      }
      if (
        ["Completed", "Failed", "DeniedByPolicy", "Cancelled"].includes(
          stimulus.status
        )
      ) {
        throw new AppServiceError(
          `Stimulus cannot be cancelled from ${stimulus.status}.`,
          409,
          "validation_stimulus_not_cancellable"
        );
      }
      const completedAt = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        if (stimulus.runId) {
          await tx.validationRun.update({
            data: {
              completedAt,
              outcome: "cancelled_by_operator",
              status: "Cancelled"
            },
            where: { runId: stimulus.runId }
          });
        }
        await tx.validationMission.update({
          data: { completedAt, status: "Cancelled" },
          where: { missionId: stimulus.missionId }
        });
        return tx.validationStimulus.update({
          data: { completedAt, status: "Cancelled" },
          include: { verdict: true },
          where: { stimulusId }
        });
      });
      await writeAuditEvent(prisma, {
        action: "validation_stimulus.cancelled",
        actorType: "User",
        entityId: stimulusId,
        entityType: "ValidationStimulus",
        metadata: { previousStatus: stimulus.status },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return serializeStimulus(updated);
    }
  };
}
