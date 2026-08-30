// @ts-nocheck
import { EvidencePackType, Prisma } from "@prisma/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { evaluatePolicy } from "@periscan/policy";
import {
  assessAttackPathRisk,
  createPrismaEvidenceService,
  generateRemediationTaskDraft,
  generatePrescriptivePlanFromVerdict,
  runRemediationSimulator,
  generateAutoPlaybooks,
  createTripwireForRemediation,
  getFixEffectivenessTrends
} from "@periscan/evidence";
import {
  assertRemediationFixedOnlyViaVerification,
  buildTargetedFixVerificationPlan,
  type CreateControlGapRemediationInput,
  type FixEffectivenessTrend,
  type PlaybookArtifacts,
  type RemediationSimulationResult,
  type TripwireConfig,
  VALIDATION_QUEUE_NAME,
  ValidationJobPayloadSchema,
  type ValidationJobPayload
} from "@periscan/shared";
import { createHash } from "node:crypto";
import {
  createMissionExecutionProcessor,
  PrismaMissionExecutionStore
} from "@periscan/worker";

import {
  enforceFreshPolicyEvaluation,
  enqueueWithExecutionPolicy,
  type ExecutionPolicyAllowance
} from "../policy-enforcement-point.js";
import {
  serializeValidationMission,
  serializeValidationRun
} from "../serializers/entities.js";
import {
  appendUniqueIds,
  AppServiceError,
  BILLING_PACKAGE_CATALOG,
  buildSafeRequestedAction,
  buildVerificationResult,
  calculateNextRunAt,
  computeAttackPathFindingFingerprint,
  correlateAllTenantAttackPathDrafts,
  correlateVerificationAttackPathDrafts,
  assertTenantQueueCapacity,
  createWorkflowTicket,
  readWorkflowTicketState,
  ensureCorrelatedAttackPathsForTenant,
  getWorkflowConnectorKey,
  getWorkflowSystemName,
  loadVerificationScopedSignals,
  reSyncConnectorsForVerification,
  requireRole,
  requireApiKeyCapability,
  resolveFixVerificationModules,
  resolveExternalTicketClosedRemediationStatus,
  resolveWorkflowIntegration,
  SCOPE_EDITOR_ROLES,
  serializeAttackPath,
  serializeRemediationTask,
  serializeVerificationEvent,
  TENANT_ADMIN_ROLES,
  writeAuditEvent
} from "../runtime-services.js";
import type {
  AppServices,
  RemediationPlaybookInput,
  RemediationTrendInput,
  RuntimeServiceDeps
} from "../runtime-services.js";
import { resolveQueueMaxPerTenant } from "../mission-queue.js";

// A settled fix can silently regress, so re-verify it on a recurring cadence.
const REVERIFICATION_FREQUENCY = "Weekly" as const;
// Outcomes that claim the exposure is resolved/mitigated — the ones worth
// re-checking. Known-exposed/inconclusive remediations are actively worked, so
// they are not auto-re-verified.
const SETTLED_VERIFICATION_OUTCOMES = new Set([
  "Fixed",
  "Mitigated",
  "PartiallyFixed"
]);

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_GITLEAKS_REPOSITORY_PATH = path.resolve(
  SERVICE_DIR,
  "../../../../",
  "packages/modules/fixtures/gitleaks"
);
const FIXTURE_GITLEAKS_REPORT_PATH = path.join(
  FIXTURE_GITLEAKS_REPOSITORY_PATH,
  "repo-secret-fixture.json"
);

interface FixPackBacklink {
  evidencePackId: string;
  packType: EvidencePackType;
  scheduleId?: string;
}

function asJsonRecord(value: Prisma.JsonValue | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : {};
}

function readEvidencePackIdFromDiff(value: Prisma.JsonValue | null) {
  const diff = asJsonRecord(value);
  const packInfo = asJsonRecord(diff.packInfo);
  const directPackId = diff.evidencePackId;
  const nestedPackId = packInfo.evidencePackId;

  return typeof directPackId === "string"
    ? directPackId
    : typeof nestedPackId === "string"
      ? nestedPackId
      : null;
}

async function loadFixPackBacklinks(
  prisma: RuntimeServiceDeps["prisma"],
  tenantId: string
) {
  const [packs, schedules] = await Promise.all([
    prisma.evidencePack.findMany({
      select: { evidenceIds: true, evidencePackId: true, packType: true },
      where: {
        packType: EvidencePackType.FixVerificationReport,
        tenantId
      }
    }),
    prisma.missionSchedule.findMany({
      select: { lastDiff: true, scheduleId: true },
      where: {
        lastDiff: { not: Prisma.DbNull },
        tenantId
      }
    })
  ]);

  const scheduleIdByPackId = new Map<string, string>();
  for (const schedule of schedules) {
    const evidencePackId = readEvidencePackIdFromDiff(schedule.lastDiff);
    if (evidencePackId) {
      scheduleIdByPackId.set(evidencePackId, schedule.scheduleId);
    }
  }

  const backlinkByEvidenceId = new Map<string, FixPackBacklink>();
  for (const pack of packs) {
    for (const evidenceId of pack.evidenceIds) {
      if (!backlinkByEvidenceId.has(evidenceId)) {
        backlinkByEvidenceId.set(evidenceId, {
          evidencePackId: pack.evidencePackId,
          packType: pack.packType,
          scheduleId: scheduleIdByPackId.get(pack.evidencePackId)
        });
      }
    }
  }

  return backlinkByEvidenceId;
}

type FixVerificationModule = ReturnType<
  typeof resolveFixVerificationModules
>[number];

const FIX_VERIFICATION_SAFETY_ORDER = {
  PassiveReadOnly: 0,
  ActiveNonInvasive: 1,
  ControlledValidation: 2,
  BASLite: 3,
  AdvancedAdversarial: 4,
  Disallowed: 5
} as const;

function resolveFixVerificationMissionSafetyLevel(
  modules: FixVerificationModule[]
): FixVerificationModule["manifest"]["safetyLevel"] {
  return modules.reduce(
    (current, module) =>
      FIX_VERIFICATION_SAFETY_ORDER[module.manifest.safetyLevel] >
      FIX_VERIFICATION_SAFETY_ORDER[current]
        ? module.manifest.safetyLevel
        : current,
    "PassiveReadOnly" as FixVerificationModule["manifest"]["safetyLevel"]
  );
}

function buildFixVerificationRunTarget(input: {
  devMode: boolean;
  module: FixVerificationModule;
  plan: ReturnType<typeof buildTargetedFixVerificationPlan>;
  previousPath: ReturnType<typeof serializeAttackPath> | null;
  remediation: { relatedPathId: string | null; remediationId: string };
  scopedSignalCount?: number;
  scope: { value: string };
}) {
  const target: Record<string, unknown> = {
    previousPathName: input.previousPath?.name ?? null,
    previousValidationState: input.previousPath?.validationState ?? null,
    relatedPathId: input.remediation.relatedPathId,
    remediationId: input.remediation.remediationId,
    selectedModuleIds: input.plan.selectedModuleIds,
    targetFamily: input.plan.family,
    targetingRationale: input.plan.rationale
  };

  if (input.scopedSignalCount !== undefined) {
    target.scopedSignalCount = input.scopedSignalCount;
  }

  if (input.module.manifest.requiredInputs.includes("hostname")) {
    target.hostname = input.scope.value;
    if (input.devMode) {
      target.fixtureMode = true;
    }
  }

  if (input.module.manifest.requiredInputs.includes("repositoryPath")) {
    target.repositoryPath = input.devMode
      ? FIXTURE_GITLEAKS_REPOSITORY_PATH
      : input.scope.value;
    if (input.devMode) {
      target.fixtureMode = true;
    }
  }

  if (
    input.module.manifest.moduleId === "gitleaks.repo_secrets" &&
    input.devMode
  ) {
    target.fixtureReportPath = FIXTURE_GITLEAKS_REPORT_PATH;
    target.repositoryName =
      input.previousPath?.pathNodes.find((node) =>
        node.label.toLowerCase().includes("repo")
      )?.label ?? "periscan-fixture-repository";
  }

  if (
    input.module.manifest.moduleId === "prowler.aws_posture" &&
    input.devMode
  ) {
    target.awsAccountId = "123456789012";
    target.fixtureMode = true;
  }

  if (input.module.manifest.moduleId === "nuclei.external_exposure_safe") {
    target.templateProfile = "safe-baseline";
  }

  return target;
}

// Remediation and fix-verification service group (D1 Phase 2 closure decomposition).
export function createRemediationServices(
  deps: RuntimeServiceDeps
): Partial<AppServices> {
  const { devMode, emitTenantWebhook, missionQueue, prisma } = deps;

  return {
    async listRemediations(context) {
      const remediations = await prisma.remediationTask.findMany({
        include: {
          attackPath: {
            select: {
              evidenceBasis: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      // Batch-load the latest verification event per remediation (one query) so
      // each task can surface its verification provenance inline without N+1.
      const remediationIds = remediations.map(
        (remediation) => remediation.remediationId
      );
      const latestByRemediation = new Map<
        string,
        Awaited<ReturnType<typeof prisma.verificationEvent.findFirst>>
      >();
      if (remediationIds.length > 0) {
        const events = await prisma.verificationEvent.findMany({
          orderBy: {
            verifiedAt: "desc"
          },
          where: {
            remediationId: { in: remediationIds },
            tenantId: context.tenant.tenantId
          }
        });
        for (const event of events) {
          if (!latestByRemediation.has(event.remediationId)) {
            latestByRemediation.set(event.remediationId, event);
          }
        }
      }

      // Non-snap enrichment for remediation list (FixVerification driven): attach packType badge data + links for continuous non-snap verdicts (parallel to findings/attack-paths)
      // Uses non-snap Fix packs + schedule lastDiff lookup for backlinks. Enables UI packType + View pack / schedule in remediation surfaces.
      const evToNonSnapFix = await loadFixPackBacklinks(
        prisma,
        context.tenant.tenantId
      );

      return remediations.map((remediation) => {
        const matchingEvidenceId = remediation.evidenceIds.find((evidenceId) =>
          evToNonSnapFix.has(evidenceId)
        );

        return serializeRemediationTask({
          ...remediation,
          latestVerificationEvent:
            latestByRemediation.get(remediation.remediationId) ?? null,
          // propagate nonSnapPack for UI enrichment (packType badge + links) if any evidence matches
          ...(matchingEvidenceId
            ? { nonSnapPack: evToNonSnapFix.get(matchingEvidenceId) }
            : {})
        });
      });
    },

    async listVerificationEvents(context, remediationId) {
      const remediation = await prisma.remediationTask.findFirst({
        where: {
          remediationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }

      const events = await prisma.verificationEvent.findMany({
        orderBy: {
          createdAt: "desc"
        },
        where: {
          remediationId,
          tenantId: context.tenant.tenantId
        }
      });

      return events.map(serializeVerificationEvent);
    },

    async getRemediation(context, remediationId) {
      const remediation = await prisma.remediationTask.findFirst({
        include: {
          attackPath: {
            select: {
              evidenceBasis: true
            }
          }
        },
        where: {
          remediationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!remediation) {
        return null;
      }

      const latestVerificationEvent = await prisma.verificationEvent.findFirst({
        orderBy: {
          verifiedAt: "desc"
        },
        where: {
          remediationId,
          tenantId: context.tenant.tenantId
        }
      });

      return serializeRemediationTask({
        ...remediation,
        latestVerificationEvent
      });
    },

    async getPrescriptivePlan(context, remediationId) {
      // Planner draft sourced from verdict (remediation context) + operators (here deterministic extend).
      // Model can refine later via model-gateway create_remediation_plan.
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "read prescriptive plans"
      );
      const remediation = await prisma.remediationTask.findFirst({
        where: { remediationId, tenantId: context.tenant.tenantId }
      });
      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }
      return generatePrescriptivePlanFromVerdict({
        remediationId: remediation.remediationId,
        recommendedAction: remediation.recommendedAction,
        technicalSteps: remediation.technicalSteps as string[]
      });
    },

    async autoRevalidate(context, remediationId) {
      // Preferred product path: plans and revalidates only.
      // Never applies customer configuration (WAF/SG/firewall/control push).
      // actionApplied is always false; Fixed still requires verification evidence.
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "auto revalidate"
      );
      const plan = await this.getPrescriptivePlan(context, remediationId);
      // Safe path: ready then verify (re-triggers pillar/fix reval post human fix)
      try {
        await this.markRemediationReadyForVerification(context, remediationId);
      } catch {
        // Verification below will still surface an actionable failure if the
        // remediation cannot be marked ready in this state.
      }
      const verificationResult = await this.verifyRemediation(
        context,
        remediationId
      );
      // Audit action keeps historical enum value; metadata documents honesty.
      await writeAuditEvent(prisma, {
        action: "remediation.auto_mitigated",
        actorType: "User",
        entityId: remediationId,
        entityType: "RemediationTask",
        metadata: {
          actionApplied: false,
          autoRevalidate: true,
          planSteps: plan.steps.length,
          outcome: verificationResult.verificationEvent.outcome
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      return {
        actionApplied: false as const,
        plan,
        verification: verificationResult,
        autoExecuted: false,
        closedLoop: "verdict->planner->mark-ready->revalidate->evidence"
      };
    },

    /** @deprecated Prefer autoRevalidate — legacy name implied config push. */
    async autoMitigate(context, remediationId) {
      return this.autoRevalidate(context, remediationId);
    },

    async markRemediationReadyForVerification(context, remediationId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "mark remediations ready for verification"
      );

      const remediation = await prisma.remediationTask.findFirst({
        where: {
          remediationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }

      const updated = await prisma.remediationTask.update({
        where: {
          remediationId: remediation.remediationId
        },
        data: {
          status: "VerificationPending"
        }
      });

      await writeAuditEvent(prisma, {
        action: "remediation.ready_for_verification",
        actorType: "User",
        entityId: updated.remediationId,
        entityType: "RemediationTask",
        metadata: {
          previousStatus: remediation.status,
          relatedPathId: updated.relatedPathId,
          status: updated.status,
          ticketId: updated.ticketId,
          ticketSystem: updated.ticketSystem
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return serializeRemediationTask(updated);
    },

    async createRemediation(this: AppServices, context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create remediations"
      );
      requireApiKeyCapability(context, "remediation:write", "create remediations");

      const requestedPathId = input.pathId ?? null;
      let attackPath = null;
      if (requestedPathId) {
        const attackPaths = await ensureCorrelatedAttackPathsForTenant(
          prisma,
          context.tenant.tenantId
        );
        attackPath =
          attackPaths.find((path) => path.pathId === requestedPathId) ?? null;
      }

      // P14-4: path-less remediations from finding fingerprint (signal-only).
      // Also used when pathId is supplied but the correlated path is gone —
      // store relatedPathId + evidenceIds so verify can still retest originals.
      if (!attackPath) {
        const fingerprint = input.findingFingerprint?.trim();
        if (!fingerprint) {
          throw new AppServiceError(
            requestedPathId
              ? "Attack path not found."
              : "pathId or findingFingerprint is required.",
            requestedPathId ? 404 : 400,
            requestedPathId
              ? "attack_path_not_found"
              : "remediation_target_required"
          );
        }

        const existingByFingerprint = await prisma.remediationTask.findFirst({
          orderBy: { updatedAt: "desc" },
          where: {
            relatedFindingFingerprint: fingerprint,
            status: {
              in: [
                "Open",
                "InProgress",
                "VerificationPending",
                "StillExposed",
                "PartiallyFixed",
                "Inconclusive",
                "Reopened"
              ]
            },
            tenantId: context.tenant.tenantId
          }
        });
        if (existingByFingerprint) {
          return serializeRemediationTask(existingByFingerprint);
        }

        const dueAt = input.dueAt ? new Date(input.dueAt) : null;
        if (dueAt && dueAt.getTime() <= Date.now()) {
          throw new AppServiceError(
            "Remediation due date must be in the future.",
            400,
            "remediation_due_date_invalid"
          );
        }

        const evidenceIds = Array.isArray(input.evidenceIds)
          ? [...new Set(input.evidenceIds)]
          : [];

        const remediation = await prisma.remediationTask.create({
          data: {
            dueAt,
            evidenceIds,
            owner: input.owner ?? null,
            recommendedAction:
              "Own and remediate this validated finding; re-run the originating module or snapshot to verify.",
            relatedExposureId: null,
            relatedFindingFingerprint: fingerprint,
            relatedPathId: requestedPathId,
            status: "Open",
            technicalSteps: [
              "Confirm ownership and target SLA for this finding fingerprint.",
              "Apply the smallest fix that addresses the measured or correlated cause.",
              "Re-run the originating validation module or Validation Snapshot; do not mark Fixed without a re-test."
            ],
            tenantId: context.tenant.tenantId,
            verificationMethod:
              "Re-run the originating module or snapshot for this finding fingerprint and compare evidence before treating the risk as fixed.",
            verificationRequired: true
          }
        });

        await writeAuditEvent(prisma, {
          action: "remediation.created",
          actorType: "User",
          entityId: remediation.remediationId,
          entityType: "RemediationTask",
          metadata: {
            relatedFindingFingerprint: fingerprint,
            relatedPathId: requestedPathId,
            signalOnly: requestedPathId == null
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        return serializeRemediationTask(remediation);
      }

      // PERISCAN-7: one open remediation per grouped finding cause.
      // Path fingerprint is authoritative for storage; optional input fingerprint
      // is used for lookup only when it matches the path-derived value (ignore
      // mismatched client values so callers cannot invent a different cause).
      const pathFingerprint = computeAttackPathFindingFingerprint(attackPath);
      const lookupFingerprint =
        input.findingFingerprint &&
        input.findingFingerprint === pathFingerprint
          ? input.findingFingerprint
          : pathFingerprint;

      // Path-idempotent: any existing task for this path is returned (preserves
      // VerificationEvent history; never delete or replace).
      const existingByPath = await prisma.remediationTask.findFirst({
        where: {
          relatedPathId: attackPath.pathId,
          tenantId: context.tenant.tenantId
        }
      });

      if (existingByPath) {
        // Backfill fingerprint on legacy path-linked rows (non-destructive).
        if (
          !existingByPath.relatedFindingFingerprint &&
          pathFingerprint
        ) {
          const backfilled = await prisma.remediationTask.update({
            where: { remediationId: existingByPath.remediationId },
            data: { relatedFindingFingerprint: pathFingerprint }
          });
          return serializeRemediationTask(backfilled);
        }
        return serializeRemediationTask(existingByPath);
      }

      // Fingerprint-idempotent: reuse an open remediation for the same cause
      // even when relatedPathId differs (grouped multi-path findings).
      const existingByFingerprint = await prisma.remediationTask.findFirst({
        orderBy: { updatedAt: "desc" },
        where: {
          relatedFindingFingerprint: lookupFingerprint,
          status: {
            in: [
              "Open",
              "InProgress",
              "VerificationPending",
              "StillExposed",
              "PartiallyFixed",
              "Inconclusive",
              "Reopened"
            ]
          },
          tenantId: context.tenant.tenantId
        }
      });

      if (existingByFingerprint) {
        // Do not reassign relatedPathId or touch verification history.
        return serializeRemediationTask(existingByFingerprint);
      }

      const dueAt = input.dueAt ? new Date(input.dueAt) : null;
      if (dueAt && dueAt.getTime() <= Date.now()) {
        throw new AppServiceError(
          "Remediation due date must be in the future.",
          400,
          "remediation_due_date_invalid"
        );
      }

      const draft = generateRemediationTaskDraft(
        attackPath,
        assessAttackPathRisk(attackPath).risk
      );

      // Slice G (Frontier / model-gateway) wire point:
      // When tenant has active model gateway + "Model-assisted remediation" capability,
      // we can call this.modelGateway.createModelSession(...) with redacted attackPath/evidence
      // context to refine technicalSteps, owner suggestion, or verificationMethod.
      // Policy gates and approval flows in model-gateway.ts already handle this.
      // (Currently deterministic draft; model refinement can be enabled per-package.)
      const remediation = await prisma.remediationTask.create({
        data: {
          dueAt,
          evidenceIds: attackPath.evidenceIds,
          owner: input.owner ?? draft.owner,
          recommendedAction: draft.recommendedAction,
          relatedExposureId: draft.relatedExposureId,
          relatedFindingFingerprint: pathFingerprint,
          relatedPathId: attackPath.pathId,
          status: "Open",
          technicalSteps: draft.technicalSteps,
          tenantId: context.tenant.tenantId,
          verificationMethod: draft.verificationMethod,
          verificationRequired: draft.verificationRequired
        }
      });

      // Slice G deep wire: Frontier/model-assisted for remediation/fix flows (used by non-snap FixVerification and general paths).
      // Mirrors the non-snap schedule wire: if capability + provider/profile, create session + enqueue analysis turn.
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
            const scopeIds = [
              attackPath.entryNodeId || attackPath.impactNodeId || ""
            ].filter((scopeId): scopeId is string => Boolean(scopeId));
            const sess = await this.createModelSession(context, {
              modelProviderId: provider.modelProviderId,
              modelPolicyProfileId: profile.modelPolicyProfileId,
              purpose: `Automated Frontier analysis for remediation of path ${attackPath.pathId}`,
              scopeIds,
              mode: "SafeValidation"
            }).catch(() => null);
            if (sess?.modelSessionId) {
              await this.enqueueModelSessionTurn(context, sess.modelSessionId, {
                prompt:
                  "Suggest improved technical steps, owner, or verification method for this remediation, grounded in the attack path evidence and risk.",
                queueLane: "Standard"
              }).catch(() => {
                // Model assistance is best-effort; remediation creation remains authoritative.
              });
            }
          }
        }
      } catch {
        // best effort
      }

      await writeAuditEvent(prisma, {
        action: "remediation.created",
        actorType: "User",
        entityId: remediation.remediationId,
        entityType: "RemediationTask",
        metadata: {
          relatedFindingFingerprint: remediation.relatedFindingFingerprint,
          relatedPathId: remediation.relatedPathId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      await emitTenantWebhook(context.tenant.tenantId, "remediation.created", {
        relatedFindingFingerprint: remediation.relatedFindingFingerprint,
        relatedPathId: remediation.relatedPathId,
        remediationId: remediation.remediationId
      });

      return serializeRemediationTask(remediation);
    },

    /**
     * P06-20: Mobilize Logged-only / Needs tuning / Missed control coverage into
     * a durable detection-eng work item (remediation task without attack path).
     * Does not claim Fixed — verification still required when re-observed.
     */
    async createControlGapRemediation(
      context,
      input: CreateControlGapRemediationInput
    ) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create detection-eng remediations"
      );

      const techniqueLabel =
        input.techniqueName?.trim() || input.techniqueId;
      const fingerprintMaterial = [
        "control-gap",
        input.coverageStatus,
        input.techniqueId,
        input.controlSourceId ?? "any-source"
      ].join(":");
      const fingerprint = createHash("sha256")
        .update(fingerprintMaterial)
        .digest("hex");

      const existing = await prisma.remediationTask.findFirst({
        orderBy: { updatedAt: "desc" },
        where: {
          relatedFindingFingerprint: fingerprint,
          status: {
            in: [
              "Open",
              "InProgress",
              "VerificationPending",
              "StillExposed",
              "PartiallyFixed",
              "Inconclusive",
              "Reopened"
            ]
          },
          tenantId: context.tenant.tenantId
        }
      });
      if (existing) {
        return serializeRemediationTask(existing);
      }

      const dueAt = input.dueAt ? new Date(input.dueAt) : null;
      if (dueAt && dueAt.getTime() <= Date.now()) {
        throw new AppServiceError(
          "Remediation due date must be in the future.",
          400,
          "remediation_due_date_invalid"
        );
      }

      const statusLabel =
        input.coverageStatus === "LoggedOnly"
          ? "Logged only"
          : input.coverageStatus === "NeedsTuning"
            ? "Needs tuning"
            : "Missed";
      const recommendedAction =
        input.coverageStatus === "Missed"
          ? `Add or tune detection for ${techniqueLabel} (${input.techniqueId}) so the control fires on authorized validation.`
          : input.coverageStatus === "LoggedOnly"
            ? `Promote ${techniqueLabel} (${input.techniqueId}) from logged-only to actionable alert/routing.`
            : `Tune thresholds/mapping for ${techniqueLabel} (${input.techniqueId}) so expected control behavior matches observations.`;

      const remediation = await prisma.remediationTask.create({
        data: {
          dueAt,
          evidenceIds: [],
          owner: input.owner ?? null,
          recommendedAction:
            input.note?.trim()
              ? `${recommendedAction} Note: ${input.note.trim()}`
              : recommendedAction,
          relatedExposureId: null,
          relatedFindingFingerprint: fingerprint,
          relatedPathId: null,
          status: "Open",
          technicalSteps: [
            `Coverage status: ${statusLabel}`,
            `Technique: ${input.techniqueId}${input.techniqueName ? ` (${input.techniqueName})` : ""}`,
            input.controlSourceId
              ? `Control source: ${input.controlSourceId}`
              : "Control source: any / not specified",
            "Update SIEM/EDR rule or routing so validation observations become actionable.",
            "Re-run control validation (telemetry observe) — do not mark Fixed without re-observation."
          ],
          tenantId: context.tenant.tenantId,
          verificationMethod:
            "Re-observe control telemetry for this technique after rule/routing change; Fixed only on measured revalidation.",
          verificationRequired: true
        }
      });

      await writeAuditEvent(prisma, {
        action: "remediation.created",
        actorType: "User",
        entityId: remediation.remediationId,
        entityType: "RemediationTask",
        metadata: {
          controlGap: true,
          controlSourceId: input.controlSourceId ?? null,
          coverageStatus: input.coverageStatus,
          relatedFindingFingerprint: fingerprint,
          techniqueId: input.techniqueId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      await emitTenantWebhook(context.tenant.tenantId, "remediation.created", {
        controlGap: true,
        relatedFindingFingerprint: fingerprint,
        remediationId: remediation.remediationId,
        techniqueId: input.techniqueId
      });

      return serializeRemediationTask(remediation);
    },

    async createRemediationTicket(context, remediationId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create remediation tickets"
      );

      const remediation = await prisma.remediationTask.findFirst({
        where: {
          remediationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }

      const workflowIntegration = await resolveWorkflowIntegration({
        integrationId: input.integrationId,
        prisma,
        tenantId: context.tenant.tenantId
      });

      if (!workflowIntegration) {
        throw new AppServiceError(
          input.integrationId
            ? "Integration not found for this tenant."
            : "Jira integration not found for this tenant.",
          404,
          input.integrationId
            ? "integration_not_found"
            : "jira_integration_not_found"
        );
      }

      const workflowConnectorKey =
        getWorkflowConnectorKey(workflowIntegration) ??
        workflowIntegration.product;
      const ticketSystem = getWorkflowSystemName({
        connectorKey: workflowConnectorKey,
        product: workflowIntegration.product
      });

      const ticketId =
        remediation.ticketId ??
        (await createWorkflowTicket({
          context,
          integration: workflowIntegration,
          remediation
        }));
      const updated = await prisma.remediationTask.update({
        where: {
          remediationId: remediation.remediationId
        },
        data: {
          status:
            remediation.status === "VerificationPending"
              ? remediation.status
              : "InProgress",
          ticketId,
          ticketIntegrationId: workflowIntegration.integrationId,
          ticketState: "Open",
          ticketStateLabel: "Created",
          ticketSyncedAt: new Date(),
          ticketSystem
        }
      });

      await writeAuditEvent(prisma, {
        action: "remediation.ticket.created",
        actorType: "User",
        entityId: updated.remediationId,
        entityType: "RemediationTask",
        metadata: {
          integrationId: workflowIntegration.integrationId,
          ticketSystem,
          ticketId: updated.ticketId,
          relatedPathId: updated.relatedPathId
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        remediation: serializeRemediationTask(updated),
        ticket: {
          evidenceSummary: `Evidence IDs: ${updated.evidenceIds.join(", ")}`,
          integrationId: workflowIntegration.integrationId,
          status: updated.status,
          system: ticketSystem,
          ticketId: updated.ticketId!
        }
      };
    },

    async syncRemediationTicket(context, remediationId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "synchronize remediation ticket state"
      );
      const remediation = await prisma.remediationTask.findFirst({
        where: { remediationId, tenantId: context.tenant.tenantId }
      });
      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }
      if (!remediation.ticketId) {
        throw new AppServiceError(
          "Create an external ticket before synchronizing its state.",
          409,
          "remediation_ticket_missing"
        );
      }
      const integrationId =
        input.integrationId ?? remediation.ticketIntegrationId;
      if (!integrationId) {
        throw new AppServiceError(
          "Choose the integration that owns this existing ticket.",
          409,
          "ticket_integration_required"
        );
      }
      const workflowIntegration = await resolveWorkflowIntegration({
        integrationId,
        prisma,
        tenantId: context.tenant.tenantId
      });
      if (!workflowIntegration) {
        throw new AppServiceError(
          "Ticket integration not found for this tenant.",
          404,
          "integration_not_found"
        );
      }
      const observation = await readWorkflowTicketState({
        context,
        integration: workflowIntegration,
        ticketId: remediation.ticketId
      });
      const observedAt = new Date(observation.observedAt);
      if (Number.isNaN(observedAt.getTime())) {
        throw new AppServiceError(
          "Ticket integration returned an invalid observation time.",
          502,
          "workflow_state_invalid"
        );
      }
      const status =
        observation.state === "Closed"
          ? resolveExternalTicketClosedRemediationStatus({
              currentStatus: remediation.status,
              verificationRequired: remediation.verificationRequired
            })
          : observation.state === "Open" || observation.state === "InProgress"
            ? remediation.status === "Open"
              ? "InProgress"
              : remediation.status
            : remediation.status;
      const updated = await prisma.remediationTask.update({
        data: {
          status,
          ticketIntegrationId: workflowIntegration.integrationId,
          ticketState: observation.state,
          ticketStateLabel: observation.stateLabel,
          ticketSyncedAt: observedAt
        },
        where: { remediationId: remediation.remediationId }
      });
      await writeAuditEvent(prisma, {
        action: "remediation.ticket.synced",
        actorType: "User",
        entityId: updated.remediationId,
        entityType: "RemediationTask",
        metadata: {
          integrationId: workflowIntegration.integrationId,
          previousStatus: remediation.status,
          remediationStatus: updated.status,
          ticketId: updated.ticketId,
          ticketState: observation.state,
          ticketStateLabel: observation.stateLabel
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });
      if (
        updated.status === "ClosedWithoutEvidence" &&
        remediation.status !== "ClosedWithoutEvidence"
      ) {
        await writeAuditEvent(prisma, {
          action: "remediation.closed_without_evidence",
          actorType: "User",
          entityId: updated.remediationId,
          entityType: "RemediationTask",
          metadata: {
            previousStatus: remediation.status,
            relatedPathId: remediation.relatedPathId,
            status: updated.status,
            ticketId: updated.ticketId,
            ticketSystem: updated.ticketSystem
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      }
      return {
        remediation: serializeRemediationTask(updated),
        ticket: {
          integrationId: workflowIntegration.integrationId,
          observedAt: observedAt.toISOString(),
          state: observation.state,
          stateLabel: observation.stateLabel,
          system: updated.ticketSystem ?? workflowIntegration.product,
          ticketId: updated.ticketId!
        }
      };
    },

    async verifyRemediation(context, remediationId, requestId) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "verify remediations"
      );
      // ICP-P1-9: verification mutates remediation state — require remediation:write
      // for API keys (admin/write expand to it). Session users rely on role only.
      requireApiKeyCapability(
        context,
        "remediation:write",
        "verify remediations"
      );

      // Per-tenant queue backpressure (same guard as startMission): reject
      // before creating verification runs/jobs. No-op unless
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
              surface: "verifyRemediation"
            },
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          });
        },
        tenantId: context.tenant.tenantId
      });

      const remediation = await prisma.remediationTask.findFirst({
        where: {
          remediationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!remediation) {
        throw new AppServiceError(
          "Remediation not found.",
          404,
          "remediation_not_found"
        );
      }

      const relatedPath = remediation.relatedPathId
        ? await prisma.attackPath.findFirst({
            include: {
              pathBreakers: {
                orderBy: {
                  priority: "asc"
                }
              },
              pathEdges: {
                orderBy: {
                  createdAt: "asc"
                }
              },
              pathNodes: {
                orderBy: {
                  sequence: "asc"
                }
              }
            },
            where: {
              pathId: remediation.relatedPathId,
              tenantId: context.tenant.tenantId
            }
          })
        : null;
      const previousPath = relatedPath
        ? serializeAttackPath(relatedPath)
        : null;

      // P06-13: prefer original measured modules from path-edge receipts or
      // prior validation runs linked to this path/remediation evidence.
      const originalModuleIds = new Set<string>();
      if (relatedPath) {
        const edgeReceipts = await prisma.pathEdgeReceipt.findMany({
          select: { moduleId: true },
          where: {
            pathId: relatedPath.pathId,
            tenantId: context.tenant.tenantId
          },
          take: 50
        });
        for (const receipt of edgeReceipts) {
          if (receipt.moduleId) originalModuleIds.add(receipt.moduleId);
        }
        if (relatedPath.evidenceIds?.length) {
          const linkedRuns = await prisma.validationRun.findMany({
            select: { moduleId: true },
            where: {
              tenantId: context.tenant.tenantId,
              evidenceIds: { hasSome: relatedPath.evidenceIds }
            },
            take: 50
          });
          for (const run of linkedRuns) {
            if (run.moduleId) originalModuleIds.add(run.moduleId);
          }
        }
      }
      if (remediation.evidenceIds?.length) {
        const remRuns = await prisma.validationRun.findMany({
          select: { moduleId: true },
          where: {
            tenantId: context.tenant.tenantId,
            evidenceIds: { hasSome: remediation.evidenceIds }
          },
          take: 50
        });
        for (const run of remRuns) {
          if (run.moduleId) originalModuleIds.add(run.moduleId);
        }
      }

      const verificationPlan = buildTargetedFixVerificationPlan({
        hasPreviousPath: Boolean(previousPath),
        originalModuleIds: [...originalModuleIds],
        pathName: previousPath?.name ?? null,
        pathNodeLabels: previousPath?.pathNodes.map((node) => node.label) ?? [],
        remediation: {
          recommendedAction: remediation.recommendedAction,
          relatedExposureId: remediation.relatedExposureId,
          relatedPathId: remediation.relatedPathId,
          verificationMethod: remediation.verificationMethod
        }
      });
      const verificationModules = resolveFixVerificationModules(
        verificationPlan.selectedModuleIds
      );

      if (verificationModules.length === 0) {
        throw new AppServiceError(
          "Fix verification has no executable modules for this remediation.",
          400,
          "verification_modules_missing"
        );
      }

      const scope =
        (await prisma.scope.findFirst({
          orderBy: {
            createdAt: "asc"
          },
          where: {
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        })) ??
        (await prisma.scope.findFirst({
          orderBy: {
            createdAt: "asc"
          },
          where: {
            tenantId: context.tenant.tenantId
          }
        }));

      if (!scope) {
        throw new AppServiceError(
          "Verification requires at least one tenant scope.",
          400,
          "verification_scope_missing"
        );
      }

      const retestModules = verificationModules.filter(
        (module) =>
          module.manifest.moduleId !== "periscan.fix_verification.compare"
      );
      const compareModule = verificationModules.find(
        (module) =>
          module.manifest.moduleId === "periscan.fix_verification.compare"
      );
      const executionModules = [
        ...retestModules,
        ...(compareModule ? [compareModule] : [])
      ];
      const policyEvaluations = executionModules.map((module) => {
        const requestedAction = buildSafeRequestedAction(
          module.manifest.executionMode
        );
        const evaluatedPolicy = evaluatePolicy({
          adminApproval: TENANT_ADMIN_ROLES.has(context.membership.role),
          executionEnvironment: module.manifest.executionMode,
          explicitMissionApproval: true,
          missionType: "FixVerification",
          requestedAction,
          safetyLevel: module.manifest.safetyLevel,
          scopeContext: scope,
          scopeVerificationStatus: scope.verificationStatus,
          timeWindowApproved: false,
          userRole: context.membership.role
        });

        return {
          evaluatedPolicy,
          module,
          requestedAction
        };
      });
      const deniedPolicyEvaluation = policyEvaluations.find(
        ({ evaluatedPolicy }) => evaluatedPolicy.outcome !== "Allowed"
      );

      if (deniedPolicyEvaluation) {
        const { evaluatedPolicy, module, requestedAction } =
          deniedPolicyEvaluation;
        const deniedDecision = await prisma.policyDecision.create({
          data: {
            approvalState: evaluatedPolicy.approvalState,
            approvedAt: null,
            approvedBy: null,
            executionEnvironment: module.manifest.executionMode,
            missionType: "FixVerification",
            outcome: evaluatedPolicy.outcome,
            rationale: evaluatedPolicy.rationale,
            requestedAction: requestedAction as Prisma.InputJsonValue,
            safetyLevel: module.manifest.safetyLevel,
            scopeId: scope.scopeId,
            target: buildFixVerificationRunTarget({
              devMode,
              module,
              plan: verificationPlan,
              previousPath,
              remediation,
              scope
            }) as Prisma.InputJsonValue,
            tenantId: context.tenant.tenantId,
            userId: context.user.userId
          }
        });

        await writeAuditEvent(prisma, {
          action: "policy.decision",
          actorType: "User",
          entityId: deniedDecision.policyDecisionId,
          entityType: "Scope",
          metadata: {
            missionType: "FixVerification",
            moduleId: module.manifest.moduleId,
            outcome: deniedDecision.outcome,
            remediationId: remediation.remediationId,
            scopeId: scope.scopeId
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });

        throw new AppServiceError(
          deniedPolicyEvaluation.evaluatedPolicy.rationale,
          400,
          "fix_verification_policy_denied"
        );
      }

      const policyEvaluationByModuleId = new Map(
        policyEvaluations.map((policyEvaluation) => [
          policyEvaluation.module.manifest.moduleId,
          policyEvaluation
        ])
      );
      const startedAt = new Date();
      const missionSafetyLevel =
        resolveFixVerificationMissionSafetyLevel(verificationModules);
      const mission = await prisma.validationMission.create({
        data: {
          evidenceIds: [],
          missionType: "FixVerification",
          policyDecisionId: null,
          policyProfile: `targeted-fix-verification:${verificationPlan.family}`,
          requestedBy: context.user.userId,
          safetyLevel: missionSafetyLevel,
          scopeId: scope.scopeId,
          scopeIds: [scope.scopeId],
          status: "Queued",
          tenantId: context.tenant.tenantId
        }
      });
      const { jobs, runs, allowances } = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const createdRuns = [];
          const createdJobs = [];
          const createdAllowances: ExecutionPolicyAllowance[] = [];

          for (const module of executionModules) {
            const { evaluatedPolicy, requestedAction } =
              policyEvaluationByModuleId.get(module.manifest.moduleId)!;
            const policyDecision = await tx.policyDecision.create({
              data: {
                approvalState: evaluatedPolicy.approvalState,
                approvedAt:
                  evaluatedPolicy.approvalState === "Approved"
                    ? new Date()
                    : null,
                approvedBy:
                  evaluatedPolicy.approvalState === "Approved"
                    ? context.user.userId
                    : null,
                executionEnvironment: module.manifest.executionMode,
                missionType: "FixVerification",
                outcome: evaluatedPolicy.outcome,
                rationale: evaluatedPolicy.rationale,
                requestedAction: requestedAction as Prisma.InputJsonValue,
                safetyLevel: module.manifest.safetyLevel,
                scopeId: scope.scopeId,
                target: buildFixVerificationRunTarget({
                  devMode,
                  module,
                  plan: verificationPlan,
                  previousPath,
                  remediation,
                  scopedSignalCount: 0,
                  scope
                }) as Prisma.InputJsonValue,
                tenantId: context.tenant.tenantId,
                userId: context.user.userId
              }
            });

            // P03-20: mint PEP allowance only for Allowed outcomes.
            const pep = enforceFreshPolicyEvaluation({
              entrypoint: "fix_verification",
              outcome: policyDecision.outcome,
              policyDecisionId: policyDecision.policyDecisionId,
              rationale: policyDecision.rationale,
              tenantId: context.tenant.tenantId
            });
            if (pep.verdict !== "Allowed" || !pep.allowance) {
              throw new AppServiceError(
                pep.liveRationale ??
                  "Fix verification policy denied; no task was queued.",
                400,
                "fix_verification_policy_denied"
              );
            }
            createdAllowances.push(pep.allowance);

            await writeAuditEvent(tx, {
              action: "policy.decision",
              actorType: "User",
              entityId: policyDecision.policyDecisionId,
              entityType: "Scope",
              metadata: {
                missionType: "FixVerification",
                moduleId: module.manifest.moduleId,
                outcome: policyDecision.outcome,
                pepCode: pep.code,
                remediationId: remediation.remediationId,
                scopeId: scope.scopeId
              },
              tenantId: context.tenant.tenantId,
              userId: context.user.userId
            });

            const run = await tx.validationRun.create({
              data: {
                evidenceIds: [],
                missionId: mission.missionId,
                moduleId: module.manifest.moduleId,
                outcome: null,
                policyDecisionId: policyDecision.policyDecisionId,
                runnerId: null,
                safetyLevel: module.manifest.safetyLevel,
                scopeId: scope.scopeId,
                status: "Queued",
                target: buildFixVerificationRunTarget({
                  devMode,
                  module,
                  plan: verificationPlan,
                  previousPath,
                  remediation,
                  scopedSignalCount: 0,
                  scope
                }) as Prisma.InputJsonValue,
                tenantId: context.tenant.tenantId,
                validationState: null
              }
            });
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

            createdRuns.push(run);
            createdJobs.push({
              ...job,
              payload: nextPayload
            });
          }

          return {
            allowances: createdAllowances,
            jobs: createdJobs,
            runs: createdRuns
          };
        }
      );

      await Promise.all(
        jobs.map((job, index) =>
          enqueueWithExecutionPolicy(
            missionQueue,
            allowances[index]!,
            ValidationJobPayloadSchema.parse(job.payload)
          )
        )
      );

      const missionProcessor = createMissionExecutionProcessor(
        new PrismaMissionExecutionStore(prisma, null),
        { allowFixtureTargets: devMode }
      );
      const completedRunIds: string[] = [];

      for (const [index, module] of executionModules.entries()) {
        const run = runs[index]!;
        const job = jobs[index]!;

        if (module.manifest.moduleId === "periscan.fix_verification.compare") {
          const scopedSignals = await loadVerificationScopedSignals(
            prisma,
            context.tenant.tenantId,
            completedRunIds
          );

          await prisma.validationRun.update({
            where: {
              runId: run.runId
            },
            data: {
              target: buildFixVerificationRunTarget({
                devMode,
                module,
                plan: verificationPlan,
                previousPath,
                remediation,
                scopedSignalCount: scopedSignals.length,
                scope
              }) as Prisma.InputJsonValue
            }
          });
        }

        await missionProcessor.process(
          ValidationJobPayloadSchema.parse(job.payload)
        );
        completedRunIds.push(run.runId);
      }

      const verificationRunIds = runs.map((item) => item.runId);
      const verificationDrafts = await correlateVerificationAttackPathDrafts(
        prisma,
        context.tenant.tenantId,
        verificationRunIds
      );
      let currentDraft = previousPath
        ? (verificationDrafts.find(
            (draft) => draft.name === previousPath.name
          ) ?? null)
        : null;
      // A "real retest" is a non-compare validation module that actually executed
      // and produced a meaningful outcome. The no-op
      // `periscan.fix_verification.compare` module is excluded by construction
      // (it is filtered out of `retestModules`). If every retest run failed, was
      // skipped, or only the compare module ran, we have no evidence to declare
      // the exposure fixed and must report Inconclusive.
      const retestRunIds = executionModules
        .map((module, index) => ({ module, runId: runs[index]!.runId }))
        .filter(
          ({ module }) =>
            module.manifest.moduleId !== "periscan.fix_verification.compare"
        )
        .map(({ runId }) => runId);
      const retestRunRecords =
        retestRunIds.length > 0
          ? await prisma.validationRun.findMany({
              where: {
                runId: {
                  in: retestRunIds
                },
                tenantId: context.tenant.tenantId
              }
            })
          : [];
      let executedRealRetest = retestRunRecords.some(
        (retestRun) =>
          retestRun.status === "Completed" &&
          retestRun.validationState !== null &&
          retestRun.validationState !== "Inconclusive"
      );

      // Option (b): a path MEASURED from a connector's authoritative configuration
      // is re-validated by re-fetching that configuration. Re-run the contributing
      // connector sync(s), then re-correlate from current signals. If the fix
      // closed the exposure (e.g. the DigitalOcean firewall rule no longer allows
      // 0.0.0.0/0 to a sensitive port), the measured path no longer correlates and
      // the outcome becomes an honest "Fixed"; otherwise it stays exposed.
      const connectorResync =
        previousPath && previousPath.evidenceBasis === "Measured"
          ? await reSyncConnectorsForVerification(
              prisma,
              context.tenant.tenantId,
              previousPath
            )
          : { connectorKeys: [], integrationIds: [] };

      if (connectorResync.integrationIds.length > 0 && previousPath) {
        executedRealRetest = true;
        const refreshedDrafts = await correlateAllTenantAttackPathDrafts(
          prisma,
          context.tenant.tenantId
        );
        currentDraft =
          refreshedDrafts.find((draft) => draft.name === previousPath.name) ??
          null;
      }

      const verificationResult = buildVerificationResult({
        currentDraft,
        executedRealRetest,
        previousPath
      });
      // How we verified: connector re-syncs and validation-module retests both
      // produce measured revalidation evidence. The compare-only module is
      // excluded by the executedRealRetest gate above.
      const connectorMeasuredRevalidation =
        connectorResync.integrationIds.length > 0;
      const measuredRevalidation =
        connectorMeasuredRevalidation || executedRealRetest;
      const retestMethod = connectorMeasuredRevalidation
        ? "connector-resync"
        : "validation-module";
      // Schedule an automatic re-check for outcomes that claim resolution, so a
      // regressed fix is caught instead of trusting a stale "Fixed".
      const settledOutcome = SETTLED_VERIFICATION_OUTCOMES.has(
        verificationResult.outcome
      );
      const nextVerificationAt = settledOutcome
        ? calculateNextRunAt(REVERIFICATION_FREQUENCY, startedAt)
        : null;
      const primaryRun = await prisma.validationRun.findUniqueOrThrow({
        where: {
          runId: runs[runs.length - 1]!.runId
        }
      });
      const run = primaryRun;

      const evidenceService = createPrismaEvidenceService({
        prisma
      });
      const verificationArtifact = await evidenceService.putEvidenceArtifact({
        artifactType: "NormalizedEvidence",
        content: {
          currentPathDraft: currentDraft,
          currentPathFound: Boolean(currentDraft),
          reSyncedConnectorKeys: connectorResync.connectorKeys,
          retestMethod,
          targetedRetestPlan: verificationPlan,
          previousPathName: previousPath?.name ?? null,
          previousState: previousPath?.validationState ?? null,
          priorEvidenceIds: [
            ...new Set([
              ...remediation.evidenceIds,
              ...(previousPath?.evidenceIds ?? [])
            ])
          ],
          verificationOutcome: verificationResult.outcome
        },
        filename: "fix-verification-comparison",
        relatedEntityId: run.runId,
        relatedEntityType: "ValidationRun",
        sensitivityLevel: "Moderate",
        tenantId: context.tenant.tenantId
      });

      const evidenceIds = appendUniqueIds(remediation.evidenceIds, [
        ...(previousPath?.evidenceIds ?? []),
        ...(currentDraft?.evidenceIds ?? []),
        verificationArtifact.artifact.evidenceId
      ]);

      // P09-12 Fixed multiverse: status Fixed only via measured verification.
      assertRemediationFixedOnlyViaVerification({
        measuredRevalidation,
        nextStatus: verificationResult.outcome,
        verificationOutcome: verificationResult.outcome
      });

      const updatedRemediation = await prisma.remediationTask.update({
        where: {
          remediationId: remediation.remediationId
        },
        data: {
          evidenceIds,
          lastVerifiedAt: startedAt,
          nextVerificationAt,
          status: verificationResult.outcome
        }
      });

      if (relatedPath) {
        await prisma.attackPath.update({
          where: {
            pathId: relatedPath.pathId
          },
          data: {
            confidence: currentDraft?.confidence ?? relatedPath.confidence,
            evidenceIds,
            impactScore: currentDraft?.impactScore ?? relatedPath.impactScore,
            validationState: verificationResult.newState
          }
        });
      }

      await prisma.validationMission.update({
        where: {
          missionId: mission.missionId
        },
        data: {
          evidenceIds: [verificationArtifact.artifact.evidenceId]
        }
      });
      const finalizedRun = await prisma.validationRun.update({
        where: {
          runId: run.runId
        },
        data: {
          evidenceIds: [verificationArtifact.artifact.evidenceId]
        }
      });

      const verificationEvent = await prisma.verificationEvent.create({
        data: {
          evidenceIds,
          exposureReCorrelated: Boolean(currentDraft),
          measuredRevalidation,
          newState: verificationResult.newState,
          outcome: verificationResult.outcome,
          previousEvidenceBasis: previousPath?.evidenceBasis ?? null,
          previousState: previousPath?.validationState ?? null,
          reSyncedConnectorKeys: connectorResync.connectorKeys,
          remediationId: remediation.remediationId,
          retestMethod,
          selectedModuleIds: verificationPlan.selectedModuleIds,
          tenantId: context.tenant.tenantId,
          validationRunId: finalizedRun.runId,
          verifiedAt: startedAt
        }
      });

      await writeAuditEvent(prisma, {
        action: "verification.run",
        actorType: "User",
        entityId: verificationEvent.verificationId,
        entityType: "VerificationEvent",
        metadata: {
          outcome: verificationEvent.outcome,
          remediationId: remediation.remediationId,
          selectedModuleIds: verificationPlan.selectedModuleIds,
          targetFamily: verificationPlan.family
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      // SOC / SIEM automation contract: catalog subscribers of remediation.verified
      // must receive a delivery when a retest finishes (Fixed only after measurement).
      await emitTenantWebhook(context.tenant.tenantId, "remediation.verified", {
        evidenceIds: verificationEvent.evidenceIds,
        measuredRevalidation: verificationEvent.measuredRevalidation,
        newState: verificationEvent.newState,
        outcome: verificationEvent.outcome,
        previousState: verificationEvent.previousState,
        relatedPathId: remediation.relatedPathId,
        remediationId: remediation.remediationId,
        retestMethod: verificationEvent.retestMethod,
        verificationId: verificationEvent.verificationId,
        verifiedAt: verificationEvent.verifiedAt.toISOString()
      });

      const refreshedPath = remediation.relatedPathId
        ? await prisma.attackPath.findFirst({
            include: {
              pathBreakers: {
                orderBy: {
                  priority: "asc"
                }
              },
              pathEdges: {
                orderBy: {
                  createdAt: "asc"
                }
              },
              pathNodes: {
                orderBy: {
                  sequence: "asc"
                }
              }
            },
            where: {
              pathId: remediation.relatedPathId,
              tenantId: context.tenant.tenantId
            }
          })
        : null;

      return {
        attackPath: refreshedPath
          ? assessAttackPathRisk(serializeAttackPath(refreshedPath))
          : null,
        mission: serializeValidationMission(
          await prisma.validationMission.findUniqueOrThrow({
            where: {
              missionId: mission.missionId
            }
          })
        ),
        remediation: serializeRemediationTask(updatedRemediation),
        run: serializeValidationRun(finalizedRun),
        verificationEvent: serializeVerificationEvent(verificationEvent)
      };
    },

    // Continuous validation: re-run verification for settled remediations whose
    // recurring re-check is due. Intended to be invoked by an external scheduler/
    // cron (same pattern as runDueIntegrationSyncs). Each re-verification writes a
    // fresh VerificationEvent and may honestly flip a stale "Fixed" back to
    // StillExposed/Reopened if the exposure regressed.
    async runDueReverifications(context) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "run due re-verifications"
      );

      const ranAt = new Date();
      const due = await prisma.remediationTask.findMany({
        orderBy: {
          nextVerificationAt: "asc"
        },
        take: 25,
        where: {
          nextVerificationAt: {
            lte: ranAt
          },
          status: {
            in: ["Fixed", "Mitigated", "PartiallyFixed"]
          },
          tenantId: context.tenant.tenantId,
          verificationRequired: true
        }
      });

      const results: Array<{ outcome: string; remediationId: string }> = [];
      for (const remediation of due) {
        try {
          const verified = await this.verifyRemediation(
            context,
            remediation.remediationId
          );
          results.push({
            outcome: verified.verificationEvent.outcome,
            remediationId: remediation.remediationId
          });
        } catch {
          // A remediation that can't be re-verified right now (e.g. no executable
          // modules) is rescheduled so it doesn't get stuck re-running every tick.
          await prisma.remediationTask.update({
            data: {
              nextVerificationAt: calculateNextRunAt(
                REVERIFICATION_FREQUENCY,
                ranAt
              )
            },
            where: {
              remediationId: remediation.remediationId
            }
          });
        }
      }

      return {
        ranAt: ranAt.toISOString(),
        results,
        reverifiedCount: results.length
      };
    }
  };
}

// Review-only remediation templates, simulator, tripwires, and trending.
// Integrate with FixVerification, RemOps, reports. Real persisted remediation data used when available.
export function simulateFixWhatIf(
  remediationId: string,
  proposedFix: string,
  currentRiskScore = 65
): RemediationSimulationResult {
  return runRemediationSimulator({
    remediationId,
    proposedFix,
    currentRiskBand: "High",
    currentRiskScore,
    pathSummary: proposedFix,
    riskScore: currentRiskScore
  });
}

export function getOneClickPlaybooks(
  remediation: RemediationPlaybookInput
): PlaybookArtifacts {
  return generateAutoPlaybooks(remediation);
}

export function createRemediationTripwire(
  remediationId: string
): TripwireConfig {
  return createTripwireForRemediation(remediationId);
}

export function computeRemediationTrends(
  pastVerifs: RemediationTrendInput[]
): FixEffectivenessTrend[] {
  return getFixEffectivenessTrends(pastVerifs);
}
