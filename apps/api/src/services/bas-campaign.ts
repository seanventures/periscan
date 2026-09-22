import { runWithTenantRls } from "@periscan/db";
import { planAtomicQualifiedCampaignQueue } from "@periscan/modules";
import {
  BasCampaignListSchema,
  BasCampaignPlanSchema,
  BasCampaignPreviewSchema,
  BasCampaignScenarioPinSchema,
  CancelBasCampaignResultSchema,
  CompileBasCampaignInputSchema,
  CompileBasCampaignResultSchema,
  DEFAULT_BAS_CAMPAIGN_CLEANUP_POLICY,
  StartBasCampaignResultSchema,
  campaignApprovalDigest,
  campaignCompiledDigest,
  campaignPinStepKey,
  compileBasCampaignDag,
  deniedBasCampaignStart,
  evaluateBasCampaignStartability,
  livePackFromCampaignPins,
  resolveBasCampaignStepCleanup,
  resolveBasScenarioStart,
  sha256Hex,
  walkBasCampaignStartPins,
  canonicalizeJson,
  type BasCampaignCleanupPolicy,
  type BasCampaignDag,
  type BasCampaignList,
  type BasCampaignPlan,
  type BasCampaignPreview,
  type BasCampaignScenarioPin,
  type BasCampaignStepCleanup,
  type BasPackQualification,
  type CancelBasCampaignInput,
  type CompileBasCampaignResult,
  type StartBasCampaignInput,
  type TenantBasPackAuthorization
} from "@periscan/shared";
import type {
  Prisma,
  BasCampaignPlan as BasCampaignPlanRecord
} from "@prisma/client";
import { isPolicyDecisionExpired } from "@periscan/policy";

import {
  AppServiceError,
  buildScopeConstraints,
  getRunnerControlPlaneUrl,
  requireRole,
  SCOPE_EDITOR_ROLES,
  signRunnerTaskEnvelope,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";
import {
  serializeScope,
  serializeValidationRun
} from "../serializers/entities.js";
import {
  ATOMIC_QUALIFIED_START_RUNNER_REQUIRED,
  ATOMIC_QUALIFIED_START_TASK_TYPE,
  hasAtomicQualificationTables,
  queueAtomicQualifiedStart,
  selectAtomicQualifiedCampaignStart
} from "./bas-atomic-start.js";
import {
  CALDERA_ENDPOINT_REQUIRED,
  isCalderaQualifiedDiscoveryPin,
  resolveCalderaEndpoint,
  selectCalderaQualifiedCampaignStart,
  startBasCalderaDiscovery
} from "./bas-caldera-start.js";
import {
  serializeBasPackQualification,
  serializeTenantBasPackAuthorization
} from "./bas-pack-start-gate.js";

const SAFE_REQUESTED_ACTION = {
  credentialTheft: false,
  destructive: false,
  persistence: false,
  realDataExfiltration: false,
  requiresInternalRunner: false,
  requiresTimeWindow: false,
  uncontrolledExploitChaining: false
} as const;

const BAS_CAMPAIGN_POLICY_PROFILE = "bas-campaign";
const ACTIVE_RUNNER_STATUSES = new Set(["Active", "Degraded"]);

async function countQueuedCampaignWork(
  tx: {
    job: {
      count: (args: {
        where: { missionId: string; tenantId: string };
      }) => Promise<number>;
    };
    runnerTask: {
      count: (args: {
        where: { missionId: string; tenantId: string };
      }) => Promise<number>;
    };
  },
  missionId: string,
  tenantId: string
): Promise<number> {
  const [jobs, tasks] = await Promise.all([
    tx.job.count({ where: { missionId, tenantId } }),
    tx.runnerTask.count({ where: { missionId, tenantId } })
  ]);
  return jobs + tasks;
}

function hasUnreviewedContent(
  contentVersionIds: readonly string[],
  reviewedIds: ReadonlySet<string>
): boolean {
  return contentVersionIds.some((id) => !reviewedIds.has(id));
}

function normalizePins(value: unknown): BasCampaignScenarioPin[] {
  return BasCampaignScenarioPinSchema.array()
    .parse(value)
    .map((pin) =>
      BasCampaignScenarioPinSchema.parse({
        ...pin,
        dependsOn: pin.dependsOn ?? [],
        stepKey: campaignPinStepKey(pin)
      })
    );
}

function graphForPins(pins: readonly BasCampaignScenarioPin[]): BasCampaignDag {
  const dag = compileBasCampaignDag(pins);
  if (dag.graph) {
    return dag.graph;
  }
  const nodes = pins.map((pin) => campaignPinStepKey(pin));
  return { edges: [], executionOrder: nodes, nodes };
}

function serializePlan(record: BasCampaignPlanRecord): BasCampaignPlan {
  const scenarioPins = normalizePins(record.scenarioPins);
  return BasCampaignPlanSchema.parse({
    approvalDigest: record.approvalDigest,
    basCampaignPlanId: record.basCampaignPlanId,
    cleanupPolicy: record.cleanupPolicy,
    compiledDigest: record.compiledDigest,
    contentVersionIds: record.contentVersionIds,
    createdAt: record.createdAt.toISOString(),
    dependencyGraph: graphForPins(scenarioPins),
    policyDecisionId: record.policyDecisionId,
    runnerId: record.runnerId,
    scenarioPins,
    scopeId: record.scopeId,
    scopeVerificationStatus: record.scopeVerificationStatus,
    scopeVersion: record.scopeVersion,
    startable: record.startable,
    tenantId: record.tenantId
  });
}

function livePackPolicyFlags(input: {
  livePack: ReturnType<typeof livePackFromCampaignPins>;
  startable: boolean;
}) {
  const qualified = input.startable && input.livePack !== "none";
  return {
    forbidden: false,
    livePack: input.livePack,
    livePackQualified: qualified,
    tenantAuthorized: qualified
  };
}

function serializePreview(
  record: BasCampaignPlanRecord & {
    policyDecision: { outcome: string; rationale: string };
    stepCleanups: Array<{
      detail: string | null;
      outputHash: string | null;
      receiptSha256: string | null;
      status: string;
      stepKey: string;
      verifiedAt: Date | string | null;
    }>;
  },
  jobsQueued: number,
  gate: {
    authorizations: readonly TenantBasPackAuthorization[];
    qualifications: readonly BasPackQualification[];
  }
): BasCampaignPreview {
  const plan = serializePlan(record);
  const startability = evaluateBasCampaignStartability({
    authorizations: gate.authorizations,
    hasUnreviewedContent: plan.contentVersionIds.length > 0,
    pins: plan.scenarioPins,
    policyOutcome:
      record.policyDecision.outcome === "Allowed" ? "Allowed" : undefined,
    qualifications: gate.qualifications,
    runnerStatus: null,
    scopeId: plan.scopeId,
    scopeVerified: plan.scopeVerificationStatus === "Verified",
    tenantId: plan.tenantId
  });
  return BasCampaignPreviewSchema.parse({
    cancelledAt: isoOrNull(record.cancelledAt),
    cleanup: record.stepCleanups.map((row) => ({
      detail: row.detail,
      outputHash: row.outputHash,
      receiptSha256: row.receiptSha256,
      status: row.status,
      stepKey: row.stepKey,
      verifiedAt: isoOrNull(row.verifiedAt)
    })),
    denyReason: record.dispatchPrevented
      ? "Campaign dispatch has been cancelled."
      : startability.startable
        ? null
        : startability.denyReason,
    dispatchPrevented: record.dispatchPrevented,
    jobsQueued,
    missionId: record.missionId,
    plan,
    policyOutcome: record.policyDecision.outcome,
    policyRationale: record.policyDecision.rationale
  });
}

function compileResult(
  plan: BasCampaignPlan,
  denyReason: string | null
): CompileBasCampaignResult {
  return CompileBasCampaignResultSchema.parse({
    denyReason,
    jobsQueued: 0,
    plan,
    queued: false,
    startable: plan.startable
  });
}

function controlPlanePinHash(upstreamId: string): string {
  return sha256Hex(canonicalizeJson({ provider: "ControlPlane", upstreamId }));
}

function isoOrNull(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

export function createBasCampaignServices({
  prisma,
  devMode = false
}: Pick<RuntimeServiceDeps, "prisma"> &
  Partial<Pick<RuntimeServiceDeps, "devMode">>): Pick<
  AppServices,
  | "compileBasCampaign"
  | "startBasCampaign"
  | "cancelBasCampaign"
  | "getBasCampaign"
  | "listBasCampaigns"
> {
  async function loadPlan(tenantId: string, compiledDigest: string) {
    const record = await runWithTenantRls(prisma, tenantId, (tx) =>
      tx.basCampaignPlan.findFirst({
        where: { compiledDigest, tenantId }
      })
    );
    if (!record) {
      throw new AppServiceError(
        "BAS campaign plan not found.",
        404,
        "bas_campaign_plan_not_found"
      );
    }
    return record;
  }

  async function reviewedContentIds(
    tenantId: string,
    contentVersionIds: readonly string[]
  ): Promise<Set<string>> {
    if (contentVersionIds.length === 0) {
      return new Set();
    }
    const reviews = await runWithTenantRls(prisma, tenantId, (tx) =>
      tx.basContentVersionReview.findMany({
        where: {
          basContentVersionId: { in: [...contentVersionIds] },
          reviewStatus: "Reviewed",
          tenantId
        },
        select: { basContentVersionId: true }
      })
    );
    return new Set(reviews.map((review) => review.basContentVersionId));
  }

  async function loadStartGate(
    tenantId: string,
    scopeId: string
  ): Promise<{
    authorizations: TenantBasPackAuthorization[];
    qualifications: BasPackQualification[];
  }> {
    return runWithTenantRls(prisma, tenantId, async (tx) => {
      const [qualifications, authorizations] = await Promise.all([
        tx.basPackQualification.findMany({ where: { tenantId } }),
        tx.tenantBasPackAuthorization.findMany({
          where: { scopeId, tenantId }
        })
      ]);
      return {
        authorizations: authorizations.map(serializeTenantBasPackAuthorization),
        qualifications: qualifications.map(serializeBasPackQualification)
      };
    });
  }

  return {
    async compileBasCampaign(this: AppServices, context, rawInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "compile BAS campaigns"
      );
      const input = CompileBasCampaignInputSchema.parse(rawInput);
      const tenantId = context.tenant.tenantId;
      const scope = await prisma.scope.findFirst({
        where: { scopeId: input.scopeId, tenantId }
      });
      if (!scope) {
        throw new AppServiceError("Scope not found.", 404, "scope_not_found");
      }

      let runnerStatus: string | null = null;
      if (input.runnerId) {
        const runner = await prisma.runner.findFirst({
          where: { runnerId: input.runnerId, tenantId }
        });
        if (!runner) {
          throw new AppServiceError(
            "Runner not found.",
            404,
            "runner_not_found"
          );
        }
        runnerStatus = runner.status;
      }

      const contentVersionIds = [...new Set(input.contentVersionIds)];
      const versions =
        contentVersionIds.length === 0
          ? []
          : await runWithTenantRls(prisma, tenantId, (tx) =>
              tx.basContentVersion.findMany({
                where: {
                  basContentVersionId: { in: contentVersionIds },
                  tenantId
                }
              })
            );
      if (versions.length !== contentVersionIds.length) {
        throw new AppServiceError(
          "BAS content version not found.",
          404,
          "bas_content_version_not_found"
        );
      }

      const scenarioPins: BasCampaignScenarioPin[] = input.scenarioPins.map(
        (pin) => {
          if (pin.provider === "ControlPlane") {
            try {
              resolveBasScenarioStart({
                scenarioId: pin.upstreamId,
                scopeId: scope.scopeId
              });
            } catch {
              throw new AppServiceError(
                `Unknown BAS campaign pin ${pin.upstreamId}.`,
                400,
                "bas_campaign_pin_invalid"
              );
            }
            return BasCampaignScenarioPinSchema.parse({
              contentSha256:
                pin.contentSha256 ?? controlPlanePinHash(pin.upstreamId),
              dependsOn: pin.dependsOn ?? [],
              provider: pin.provider,
              stepKey: campaignPinStepKey(pin),
              typedInputs: pin.typedInputs,
              upstreamId: pin.upstreamId
            });
          }

          const version =
            versions.find(
              (item) =>
                item.basContentVersionId === pin.contentVersionId ||
                item.contentSha256 === pin.contentSha256
            ) ??
            versions.find((item) => {
              const preview = item.preview as {
                scenarios?: Array<{ upstreamId?: string }>;
              };
              return preview.scenarios?.some(
                (scenario) => scenario.upstreamId === pin.upstreamId
              );
            });
          if (!version || version.provider !== pin.provider) {
            throw new AppServiceError(
              "BAS campaign pin does not match registered content.",
              400,
              "bas_campaign_pin_invalid"
            );
          }
          const preview = version.preview as {
            scenarios?: Array<{ upstreamId?: string }>;
          };
          if (
            !preview.scenarios?.some(
              (scenario) => scenario.upstreamId === pin.upstreamId
            )
          ) {
            throw new AppServiceError(
              "BAS campaign pin upstream id is not in the bound content version.",
              400,
              "bas_campaign_pin_invalid"
            );
          }
          if (
            pin.contentSha256 &&
            pin.contentSha256 !== version.contentSha256
          ) {
            throw new AppServiceError(
              "BAS campaign pin content hash does not match the registered version.",
              400,
              "bas_campaign_pin_invalid"
            );
          }
          return BasCampaignScenarioPinSchema.parse({
            contentSha256: version.contentSha256,
            dependsOn: pin.dependsOn ?? [],
            provider: pin.provider,
            stepKey: campaignPinStepKey(pin),
            typedInputs: pin.typedInputs,
            upstreamId: pin.upstreamId
          });
        }
      );

      const dag = compileBasCampaignDag(scenarioPins);
      if (dag.error) {
        throw new AppServiceError(dag.error, 400, "bas_campaign_dag_invalid");
      }

      const cleanupPolicy: BasCampaignCleanupPolicy =
        input.cleanupPolicy ?? DEFAULT_BAS_CAMPAIGN_CLEANUP_POLICY;
      const scopeVerified = scope.verificationStatus === "Verified";
      const scopeVersion = scope.verifiedAt?.toISOString() ?? "unverified";
      const compiledDigest = campaignCompiledDigest({
        cleanupPolicy,
        contentVersionIds,
        runnerId: input.runnerId ?? null,
        scenarioPins,
        scopeId: scope.scopeId,
        scopeVerificationStatus: scope.verificationStatus,
        scopeVersion,
        tenantId
      });

      const reviewedIds = await reviewedContentIds(tenantId, contentVersionIds);
      const unreviewedBound = hasUnreviewedContent(
        contentVersionIds,
        reviewedIds
      );
      const gate = await loadStartGate(tenantId, scope.scopeId);
      const startabilityInput = {
        authorizations: gate.authorizations,
        hasUnreviewedContent: unreviewedBound,
        now: new Date(),
        pins: scenarioPins,
        qualifications: gate.qualifications,
        runnerStatus,
        scopeId: scope.scopeId,
        scopeVerified,
        tenantId
      };

      const existing = await runWithTenantRls(prisma, tenantId, (tx) =>
        tx.basCampaignPlan.findFirst({
          where: { compiledDigest, tenantId }
        })
      );
      if (existing) {
        const existingStartability = evaluateBasCampaignStartability(
          startabilityInput
        );
        if (existing.missionId || existingStartability.startable === existing.startable) {
          return compileResult(
            serializePlan(existing),
            existing.startable || existingStartability.startable
              ? null
              : existingStartability.denyReason
          );
        }
        const livePack = livePackFromCampaignPins(scenarioPins);
        const safetyLevel = existingStartability.startable
          ? livePack === "none"
            ? "ActiveNonInvasive"
            : "BASLite"
          : "BASLite";
        const refreshed = await this.previewPolicyDecision(
          context,
          scope.scopeId,
          {
            adminApproval: existingStartability.startable && livePack !== "none",
            executionEnvironment: "ControlPlane",
            explicitMissionApproval: false,
            missionType: "ControlValidation",
            requestedAction: { ...SAFE_REQUESTED_ACTION },
            safetyLevel,
            target: {
              compiledDigest,
              contentVersionIds,
              kind: "bas-campaign",
              ...livePackPolicyFlags({
                livePack,
                startable: existingStartability.startable
              }),
              scenarioPins,
              startable: existingStartability.startable
            }
          }
        );
        const approvalDigest = campaignApprovalDigest({
          compiledDigest,
          expiresAt: isoOrNull(refreshed.expiresAt),
          outcome: refreshed.outcome,
          policyDecisionId: refreshed.policyDecisionId
        });
        const startable =
          existingStartability.startable && refreshed.outcome === "Allowed";
        const updated = await runWithTenantRls(prisma, tenantId, async (tx) => {
          await tx.basCampaignPlan.updateMany({
            data: {
              approvalDigest,
              policyDecisionId: refreshed.policyDecisionId,
              startable
            },
            where: {
              basCampaignPlanId: existing.basCampaignPlanId,
              missionId: null,
              tenantId
            }
          });
          return tx.basCampaignPlan.findFirst({
            where: { basCampaignPlanId: existing.basCampaignPlanId, tenantId }
          });
        });
        return compileResult(
          serializePlan(updated ?? existing),
          startable
            ? null
            : existingStartability.denyReason ?? refreshed.rationale
        );
      }

      const startability = evaluateBasCampaignStartability(startabilityInput);
      const livePack = livePackFromCampaignPins(scenarioPins);
      const safetyLevel = startability.startable
        ? livePack === "none"
          ? "ActiveNonInvasive"
          : "BASLite"
        : "BASLite";
      const decision = await this.previewPolicyDecision(
        context,
        scope.scopeId,
        {
          adminApproval: startability.startable && livePack !== "none",
          executionEnvironment: "ControlPlane",
          explicitMissionApproval: false,
          missionType: "ControlValidation",
          requestedAction: { ...SAFE_REQUESTED_ACTION },
          safetyLevel,
          target: {
            compiledDigest,
            contentVersionIds,
            kind: "bas-campaign",
            ...livePackPolicyFlags({
              livePack,
              startable: startability.startable
            }),
            scenarioPins,
            startable: startability.startable
          }
        }
      );
      const approvalDigest = campaignApprovalDigest({
        compiledDigest,
        expiresAt: isoOrNull(decision.expiresAt),
        outcome: decision.outcome,
        policyDecisionId: decision.policyDecisionId
      });

      const record = await runWithTenantRls(prisma, tenantId, async (tx) => {
        const created = await tx.basCampaignPlan.create({
          data: {
            approvalDigest,
            cleanupPolicy: cleanupPolicy as Prisma.InputJsonValue,
            compiledDigest,
            contentVersionIds,
            policyDecisionId: decision.policyDecisionId,
            runnerId: input.runnerId ?? null,
            scenarioPins: scenarioPins as Prisma.InputJsonValue,
            scopeId: scope.scopeId,
            scopeVerificationStatus: scope.verificationStatus,
            scopeVersion,
            startable:
              startability.startable && decision.outcome === "Allowed",
            tenantId
          }
        });
        await writeAuditEvent(tx, {
          action: "bas.campaign_compiled",
          actorType: "User",
          entityId: created.basCampaignPlanId,
          entityType: "Scenario",
          metadata: {
            compiledDigest,
            jobsQueued: 0,
            queued: false,
            startable: created.startable
          },
          tenantId,
          userId: context.user.userId
        });
        return created;
      });

      return compileResult(
        serializePlan(record),
        record.startable
          ? null
          : startability.denyReason ?? decision.rationale
      );
    },

    async getBasCampaign(context, compiledDigest) {
      return serializePlan(
        await loadPlan(context.tenant.tenantId, compiledDigest)
      );
    },

    async listBasCampaigns(context): Promise<BasCampaignList> {
      const tenantId = context.tenant.tenantId;
      const items = await runWithTenantRls(prisma, tenantId, async (tx) => {
        const records = await tx.basCampaignPlan.findMany({
          include: { policyDecision: true, stepCleanups: true },
          orderBy: { createdAt: "desc" },
          take: 50,
          where: { tenantId }
        });
        const [qualifications, authorizations] = await Promise.all([
          tx.basPackQualification.findMany({ where: { tenantId } }),
          tx.tenantBasPackAuthorization.findMany({ where: { tenantId } })
        ]);
        const gate = {
          authorizations: authorizations.map(serializeTenantBasPackAuthorization),
          qualifications: qualifications.map(serializeBasPackQualification)
        };
        const previews: BasCampaignPreview[] = [];
        for (const record of records) {
          const jobsQueued = record.missionId
            ? await countQueuedCampaignWork(
                tx,
                record.missionId,
                tenantId
              )
            : 0;
          previews.push(serializePreview(record, jobsQueued, gate));
        }
        return previews;
      });
      return BasCampaignListSchema.parse({ items });
    },

    async startBasCampaign(this: AppServices, context, rawInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "start BAS campaigns"
      );
      const input: StartBasCampaignInput = rawInput;
      const tenantId = context.tenant.tenantId;
      const record = await loadPlan(tenantId, input.compiledDigest);
      let plan = serializePlan(record);
      const deny = (rationale: string, startable = false) =>
        deniedBasCampaignStart({
          campaignPlanId: plan.basCampaignPlanId,
          compiledDigest: plan.compiledDigest,
          policyDecisionId: plan.policyDecisionId,
          rationale,
          startable
        });

      if (record.dispatchPrevented) {
        return deny("Campaign dispatch has been cancelled.");
      }

      const recomputed = campaignCompiledDigest({
        cleanupPolicy: plan.cleanupPolicy,
        contentVersionIds: plan.contentVersionIds,
        runnerId: plan.runnerId,
        scenarioPins: plan.scenarioPins,
        scopeId: plan.scopeId,
        scopeVerificationStatus: plan.scopeVerificationStatus,
        scopeVersion: plan.scopeVersion,
        tenantId: plan.tenantId
      });
      if (recomputed !== plan.compiledDigest) {
        return deny("Campaign inputs changed after compile.");
      }

      const scope = await prisma.scope.findFirst({
        where: { scopeId: plan.scopeId, tenantId }
      });
      if (!scope || scope.verificationStatus !== "Verified") {
        return deny(
          "Verified scope is required before a BAS campaign can start."
        );
      }

      let runnerStatus: string | null = null;
      if (plan.runnerId) {
        const runner = await prisma.runner.findFirst({
          where: { runnerId: plan.runnerId, tenantId }
        });
        runnerStatus = runner?.status ?? "Revoked";
        if (!runner || !ACTIVE_RUNNER_STATUSES.has(runner.status)) {
          return deny(
            `Bound runner is ${runnerStatus}; campaign start is denied.`
          );
        }
      }

      let policy = await prisma.policyDecision.findFirst({
        where: { policyDecisionId: plan.policyDecisionId, tenantId }
      });
      if (!policy) {
        return deny("Campaign policy decision is no longer available.");
      }
      const liveApproval = campaignApprovalDigest({
        compiledDigest: plan.compiledDigest,
        expiresAt: isoOrNull(policy.expiresAt),
        outcome: policy.outcome,
        policyDecisionId: policy.policyDecisionId
      });
      if (
        liveApproval !== plan.approvalDigest ||
        isPolicyDecisionExpired(policy.expiresAt)
      ) {
        return deny("Campaign approval is stale and must be recompiled.");
      }

      const unreviewedBound = hasUnreviewedContent(
        plan.contentVersionIds,
        await reviewedContentIds(tenantId, plan.contentVersionIds)
      );
      const gate = await loadStartGate(tenantId, plan.scopeId);
      const startability = evaluateBasCampaignStartability({
        authorizations: gate.authorizations,
        dangerAckDigest: input.dangerAckDigest,
        dangerAcknowledged: input.dangerAcknowledged,
        hasUnreviewedContent: unreviewedBound,
        now: new Date(),
        pins: plan.scenarioPins,
        policyOutcome:
          policy.outcome === "Allowed" ? "Allowed" : undefined,
        qualifications: gate.qualifications,
        runnerStatus,
        scopeId: plan.scopeId,
        scopeVerified: true,
        tenantId
      });
      const walk = walkBasCampaignStartPins({
        authorizations: gate.authorizations,
        dangerAckDigest: input.dangerAckDigest,
        dangerAcknowledged: input.dangerAcknowledged,
        executionOrder: plan.dependencyGraph.executionOrder,
        hasUnreviewedContent: unreviewedBound,
        now: new Date(),
        pins: plan.scenarioPins,
        policyOutcome:
          policy.outcome === "Allowed" ? "Allowed" : undefined,
        qualifications: gate.qualifications,
        scopeId: plan.scopeId,
        tenantId
      });
      const qualificationTablesPresent = hasAtomicQualificationTables(prisma);
      const atomicSelection = selectAtomicQualifiedCampaignStart({
        pins: plan.scenarioPins,
        qualificationTablesPresent,
        startable: startability.startable
      });
      if (atomicSelection === "deny") {
        const planned = planAtomicQualifiedCampaignQueue({
          pins: plan.scenarioPins,
          qualificationTablesPresent,
          startable: startability.startable
        });
        return deny(
          planned.denyReason ??
            "Atomic argv start is refused. Denied tasks are never queued."
        );
      }
      const calderaEndpoint = resolveCalderaEndpoint();
      const calderaSelection = selectCalderaQualifiedCampaignStart({
        endpointConfigured: calderaEndpoint != null,
        pins: plan.scenarioPins,
        startable: startability.startable
      });
      if (calderaSelection === "deny") {
        return deny(
          calderaEndpoint
            ? "Caldera discovery start is refused. Denied tasks are never queued."
            : CALDERA_ENDPOINT_REQUIRED
        );
      }
      if (!startability.startable || walk.failClosed) {
        return deny(
          (!startability.startable
            ? startability.denyReason
            : walk.denyReason) ??
            "BAS campaign is not startable. Denied tasks are never queued."
        );
      }
      if (policy.outcome !== "Allowed") {
        const livePack = livePackFromCampaignPins(plan.scenarioPins);
        const remint = await this.previewPolicyDecision(
          context,
          plan.scopeId,
          {
            adminApproval: livePack !== "none",
            executionEnvironment: "ControlPlane",
            explicitMissionApproval: false,
            missionType: "ControlValidation",
            requestedAction: { ...SAFE_REQUESTED_ACTION },
            safetyLevel: livePack === "none" ? "ActiveNonInvasive" : "BASLite",
            target: {
              compiledDigest: plan.compiledDigest,
              contentVersionIds: plan.contentVersionIds,
              kind: "bas-campaign",
              ...livePackPolicyFlags({ livePack, startable: true }),
              scenarioPins: plan.scenarioPins,
              startable: true
            }
          }
        );
        if (remint.outcome !== "Allowed") {
          return deny(remint.rationale, false);
        }
        const approvalDigest = campaignApprovalDigest({
          compiledDigest: plan.compiledDigest,
          expiresAt: isoOrNull(remint.expiresAt),
          outcome: remint.outcome,
          policyDecisionId: remint.policyDecisionId
        });
        await runWithTenantRls(prisma, tenantId, (tx) =>
          tx.basCampaignPlan.updateMany({
            data: {
              approvalDigest,
              policyDecisionId: remint.policyDecisionId,
              startable: true
            },
            where: {
              basCampaignPlanId: plan.basCampaignPlanId,
              missionId: null,
              tenantId
            }
          })
        );
        policy = await prisma.policyDecision.findFirst({
          where: { policyDecisionId: remint.policyDecisionId, tenantId }
        });
        if (!policy || policy.outcome !== "Allowed") {
          return deny(
            remint.rationale,
            false
          );
        }
        plan = serializePlan(await loadPlan(tenantId, plan.compiledDigest));
      }

      if (record.missionId) {
        const mission = await this.getMission(context, record.missionId);
        const jobsQueued = await countQueuedCampaignWork(
          prisma,
          record.missionId,
          tenantId
        );
        const runs = await this.listMissionRuns(context, record.missionId);
        return StartBasCampaignResultSchema.parse({
          campaignPlanId: plan.basCampaignPlanId,
          compiledDigest: plan.compiledDigest,
          denyReason: null,
          jobsQueued,
          mission,
          outcome: "Allowed",
          policyDecisionId: plan.policyDecisionId,
          queued: jobsQueued > 0,
          rationale: policy.rationale,
          runs,
          startable: true
        });
      }

      if (atomicSelection === "queue") {
        const atomicRunnerId = plan.runnerId;
        if (!atomicRunnerId) {
          return deny(ATOMIC_QUALIFIED_START_RUNNER_REQUIRED);
        }
        const mission = await this.createMission(context, {
          missionType: "ControlValidation",
          policyDecisionId: plan.policyDecisionId,
          policyProfile: BAS_CAMPAIGN_POLICY_PROFILE,
          safetyLevel: policy.safetyLevel,
          scopeId: plan.scopeId
        });
        const runs: ReturnType<typeof serializeValidationRun>[] = [];
        const queued = await queueAtomicQualifiedStart({
          context: {
            controlPlaneUrl: getRunnerControlPlaneUrl(),
            missionId: mission.missionId,
            runnerId: atomicRunnerId,
            scopeConstraints: buildScopeConstraints(serializeScope(scope), []),
            scopeId: plan.scopeId,
            tenantId
          },
          persistTask: async ({ envelope }) => {
            const run = await prisma.validationRun.create({
              data: {
                evidenceIds: [],
                missionId: mission.missionId,
                moduleId: envelope.moduleId,
                outcome: null,
                policyDecisionId: plan.policyDecisionId,
                runId: envelope.runId,
                runnerId: atomicRunnerId,
                safetyLevel: envelope.safetyLevel,
                scopeId: plan.scopeId,
                status: "Queued",
                target: envelope.target as Prisma.InputJsonValue,
                tenantId,
                validationState: null
              }
            });
            runs.push(serializeValidationRun(run));
            await prisma.runnerTask.create({
              data: {
                envelope: envelope as unknown as Prisma.InputJsonValue,
                expiresAt: new Date(envelope.expiresAt),
                inputs: envelope.inputs as Prisma.InputJsonValue,
                issuedAt: new Date(envelope.issuedAt),
                missionId: mission.missionId,
                moduleId: envelope.moduleId,
                nonce: envelope.signature.nonce,
                runId: envelope.runId,
                runnerId: atomicRunnerId,
                safetyLevel: envelope.safetyLevel,
                scopeConstraints:
                  envelope.scopeConstraints as Prisma.InputJsonValue,
                scopeId: plan.scopeId,
                status: "Queued",
                target: envelope.target as Prisma.InputJsonValue,
                taskId: envelope.taskId,
                taskType: ATOMIC_QUALIFIED_START_TASK_TYPE,
                tenantId
              }
            });
          },
          pins: plan.scenarioPins,
          qualificationTablesPresent: true,
          signEnvelope: (unsigned) =>
            signRunnerTaskEnvelope(prisma, tenantId, devMode, unsigned),
          startable: true
        });
        if (!queued.queued || queued.jobsQueued < 1) {
          try {
            await this.cancelMission(context, mission.missionId);
          } catch {
            // Draft mission must not remain startable after a refused queue.
          }
          return deny(
            queued.denyReason ?? ATOMIC_QUALIFIED_START_RUNNER_REQUIRED
          );
        }
        await prisma.validationMission.update({
          data: { status: "Queued" },
          where: { missionId: mission.missionId }
        });
        const bound = await runWithTenantRls(prisma, tenantId, (tx) =>
          tx.basCampaignPlan.updateMany({
            data: { missionId: mission.missionId },
            where: {
              basCampaignPlanId: plan.basCampaignPlanId,
              missionId: null,
              tenantId
            }
          })
        );
        if (bound.count === 0) {
          try {
            await this.cancelMission(context, mission.missionId);
          } catch {
            // The winning start already owns the plan; extra work is cancelled.
          }
          const winner = await loadPlan(tenantId, plan.compiledDigest);
          if (!winner.missionId) {
            return deny("Campaign start lost the idempotent bind.");
          }
          return this.startBasCampaign(context, input);
        }
        const queuedMission = await this.getMission(context, mission.missionId);
        await runWithTenantRls(prisma, tenantId, (tx) =>
          writeAuditEvent(tx, {
            action: "bas.campaign_started",
            actorType: "User",
            entityId: plan.basCampaignPlanId,
            entityType: "ValidationMission",
            metadata: {
              compiledDigest: plan.compiledDigest,
              jobsQueued: queued.jobsQueued,
              missionId: mission.missionId,
              queued: true,
              taskType: ATOMIC_QUALIFIED_START_TASK_TYPE
            },
            tenantId,
            userId: context.user.userId
          })
        );
        return StartBasCampaignResultSchema.parse({
          campaignPlanId: plan.basCampaignPlanId,
          compiledDigest: plan.compiledDigest,
          denyReason: null,
          jobsQueued: queued.jobsQueued,
          mission: queuedMission,
          outcome: "Allowed",
          policyDecisionId: plan.policyDecisionId,
          queued: true,
          rationale: policy.rationale,
          runs,
          startable: true
        });
      }

      if (calderaSelection === "queue") {
        if (!calderaEndpoint) {
          return deny(CALDERA_ENDPOINT_REQUIRED);
        }
        const abilityIds = plan.scenarioPins
          .filter(isCalderaQualifiedDiscoveryPin)
          .map((pin) => pin.upstreamId);
        const started = await startBasCalderaDiscovery({
          abilityIds,
          apiKey: calderaEndpoint.apiKey,
          baseUrl: calderaEndpoint.baseUrl,
          policyOutcome: "Allowed",
          qualified: true,
          startGate: { startable: true },
          tenantAuthorized: true
        });
        if (!started.queued || started.jobsQueued < 1) {
          return deny(
            started.denyReason ?? CALDERA_ENDPOINT_REQUIRED
          );
        }
        const mission = await this.createMission(context, {
          missionType: "ControlValidation",
          policyDecisionId: plan.policyDecisionId,
          policyProfile: BAS_CAMPAIGN_POLICY_PROFILE,
          safetyLevel: policy.safetyLevel,
          scopeId: plan.scopeId
        });
        const run = await prisma.validationRun.create({
          data: {
            evidenceIds: [],
            missionId: mission.missionId,
            moduleId: "caldera.advanced_adversarial",
            outcome: null,
            policyDecisionId: plan.policyDecisionId,
            safetyLevel: policy.safetyLevel,
            scopeId: plan.scopeId,
            status: "Queued",
            target: {
              abilityIds: started.abilityIds,
              isolatedCaldera: true,
              kind: "bas-campaign",
              liveSupported: false,
              operationId: started.operationId
            } as Prisma.InputJsonValue,
            tenantId,
            validationState: null
          }
        });
        await prisma.validationMission.update({
          data: { status: "Queued" },
          where: { missionId: mission.missionId }
        });
        const bound = await runWithTenantRls(prisma, tenantId, (tx) =>
          tx.basCampaignPlan.updateMany({
            data: { missionId: mission.missionId },
            where: {
              basCampaignPlanId: plan.basCampaignPlanId,
              missionId: null,
              tenantId
            }
          })
        );
        if (bound.count === 0) {
          try {
            await this.cancelMission(context, mission.missionId);
          } catch {
            // The winning start already owns the plan; extra work is cancelled.
          }
          const winner = await loadPlan(tenantId, plan.compiledDigest);
          if (!winner.missionId) {
            return deny("Campaign start lost the idempotent bind.");
          }
          return this.startBasCampaign(context, input);
        }
        const queuedMission = await this.getMission(context, mission.missionId);
        await runWithTenantRls(prisma, tenantId, (tx) =>
          writeAuditEvent(tx, {
            action: "bas.campaign_started",
            actorType: "User",
            entityId: plan.basCampaignPlanId,
            entityType: "ValidationMission",
            metadata: {
              abilityIds: started.abilityIds,
              compiledDigest: plan.compiledDigest,
              jobsQueued: started.jobsQueued,
              liveSupported: false,
              missionId: mission.missionId,
              operationId: started.operationId,
              queued: true
            },
            tenantId,
            userId: context.user.userId
          })
        );
        return StartBasCampaignResultSchema.parse({
          campaignPlanId: plan.basCampaignPlanId,
          compiledDigest: plan.compiledDigest,
          denyReason: null,
          jobsQueued: started.jobsQueued,
          mission: queuedMission,
          outcome: "Allowed",
          policyDecisionId: plan.policyDecisionId,
          queued: true,
          rationale: policy.rationale,
          runs: [serializeValidationRun(run)],
          startable: true
        });
      }

      const queuedPins = walk.queuedPins;
      const firstPin = queuedPins[0]!;
      const livePack = livePackFromCampaignPins(plan.scenarioPins);
      const mission = await this.createMission(context, {
        missionType: "ControlValidation",
        policyDecisionId: plan.policyDecisionId,
        policyProfile: BAS_CAMPAIGN_POLICY_PROFILE,
        safetyLevel: policy.safetyLevel,
        scopeId: plan.scopeId
      });
      const started = await this.startMission(context, mission.missionId, {
        moduleIds: queuedPins.map((pin) => pin.moduleId),
        runnerId: plan.runnerId ?? undefined,
        target: {
          compiledDigest: plan.compiledDigest,
          executionOrder: queuedPins.map((pin) => pin.stepKey),
          kind: "bas-campaign",
          ...livePackPolicyFlags({ livePack, startable: true }),
          moduleId: firstPin.moduleId,
          pins: queuedPins,
          queuedStepKeys: queuedPins.map((pin) => pin.stepKey),
          scenarioId: firstPin.upstreamId
        }
      });
      const bound = await runWithTenantRls(prisma, tenantId, (tx) =>
        tx.basCampaignPlan.updateMany({
          data: { missionId: started.mission.missionId },
          where: {
            basCampaignPlanId: plan.basCampaignPlanId,
            missionId: null,
            tenantId
          }
        })
      );
      if (bound.count === 0) {
        try {
          await this.cancelMission(context, started.mission.missionId);
        } catch {
          // The winning start already owns the plan; extra work is cancelled.
        }
        const winner = await loadPlan(tenantId, plan.compiledDigest);
        if (!winner.missionId) {
          return deny("Campaign start lost the idempotent bind.");
        }
        return this.startBasCampaign(context, input);
      }

      await runWithTenantRls(prisma, tenantId, (tx) =>
        writeAuditEvent(tx, {
          action: "bas.campaign_started",
          actorType: "User",
          entityId: plan.basCampaignPlanId,
          entityType: "ValidationMission",
          metadata: {
            compiledDigest: plan.compiledDigest,
            executionOrder: queuedPins.map((pin) => pin.stepKey),
            jobsQueued: started.jobsQueued,
            missionId: started.mission.missionId,
            queued: started.jobsQueued > 0
          },
          tenantId,
          userId: context.user.userId
        })
      );

      return StartBasCampaignResultSchema.parse({
        campaignPlanId: plan.basCampaignPlanId,
        compiledDigest: plan.compiledDigest,
        denyReason: null,
        jobsQueued: started.jobsQueued,
        mission: started.mission,
        outcome: "Allowed",
        policyDecisionId: plan.policyDecisionId,
        queued: started.jobsQueued > 0,
        rationale: policy.rationale,
        runs: started.runs,
        startable: true
      });
    },

    async cancelBasCampaign(this: AppServices, context, rawInput) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "cancel BAS campaigns"
      );
      const input: CancelBasCampaignInput = rawInput;
      const tenantId = context.tenant.tenantId;
      const record = await loadPlan(tenantId, input.compiledDigest);
      const plan = serializePlan(record);
      const now = new Date();

      const tasks = record.missionId
        ? await prisma.runnerTask.findMany({
            where: { missionId: record.missionId, tenantId }
          })
        : [];
      const active = tasks.filter((task) =>
        ["Queued", "Leased", "Running", "Accepted"].includes(task.status)
      );
      const delayed = active.some((task) =>
        ["Leased", "Running", "Accepted"].includes(task.status)
      );

      await runWithTenantRls(prisma, tenantId, async (tx) => {
        await tx.basCampaignPlan.update({
          data: {
            cancelledAt: now,
            dispatchPrevented: true
          },
          where: { basCampaignPlanId: record.basCampaignPlanId }
        });
        if (active.length) {
          await tx.runnerTask.updateMany({
            data: { status: "Cancelled" },
            where: {
              missionId: record.missionId ?? undefined,
              status: "Queued",
              tenantId
            }
          });
        }
        const receiptsByStep = new Map(
          (input.cleanupReceipts ?? []).map((receipt) => [
            receipt.stepKey,
            receipt
          ])
        );
        const cleanupRows: BasCampaignStepCleanup[] = plan.scenarioPins.map(
          (pin) => {
            const stepKey = campaignPinStepKey(pin);
            const matching = active.filter((task) => {
              const target = JSON.stringify(task.target);
              return (
                target.includes(pin.upstreamId) || target.includes(stepKey)
              );
            });
            const hasDelayed = matching.some((task) =>
              ["Leased", "Running", "Accepted"].includes(task.status)
            );
            const dispatched =
              Boolean(record.missionId) || matching.length > 0 || delayed;
            return resolveBasCampaignStepCleanup({
              delayed: hasDelayed || (matching.length === 0 && delayed),
              dispatched,
              receipt: dispatched
                ? (receiptsByStep.get(stepKey) ?? null)
                : null,
              stepKey
            });
          }
        );
        for (const row of cleanupRows) {
          await tx.basCampaignStepCleanup.upsert({
            create: {
              basCampaignPlanId: record.basCampaignPlanId,
              detail: row.detail,
              outputHash: row.outputHash,
              receiptSha256: row.receiptSha256,
              status: row.status,
              stepKey: row.stepKey,
              tenantId,
              verifiedAt: row.verifiedAt ? new Date(row.verifiedAt) : null
            },
            update: {
              detail: row.detail,
              outputHash: row.outputHash,
              receiptSha256: row.receiptSha256,
              status: row.status,
              verifiedAt: row.verifiedAt ? new Date(row.verifiedAt) : null
            },
            where: {
              basCampaignPlanId_stepKey: {
                basCampaignPlanId: record.basCampaignPlanId,
                stepKey: row.stepKey
              }
            }
          });
        }
        await writeAuditEvent(tx, {
          action: "bas.campaign_cancelled",
          actorType: "User",
          entityId: record.basCampaignPlanId,
          entityType: "ValidationMission",
          metadata: {
            compiledDigest: plan.compiledDigest,
            delayedCancel: delayed,
            dispatchPrevented: true,
            missionId: record.missionId
          },
          tenantId,
          userId: context.user.userId
        });
      });

      let mission = record.missionId
        ? await this.getMission(context, record.missionId)
        : null;
      if (record.missionId && !delayed) {
        try {
          mission = await this.cancelMission(context, record.missionId);
        } catch {
          mission = await this.getMission(context, record.missionId);
        }
      }

      const cleanup = await runWithTenantRls(prisma, tenantId, (tx) =>
        tx.basCampaignStepCleanup.findMany({
          where: { basCampaignPlanId: record.basCampaignPlanId, tenantId }
        })
      );

      return CancelBasCampaignResultSchema.parse({
        cancelCompleted: !delayed,
        cancelRequested: true,
        cleanup: cleanup.map((row) => ({
          detail: row.detail,
          outputHash: row.outputHash,
          receiptSha256: row.receiptSha256,
          status: row.status,
          stepKey: row.stepKey,
          verifiedAt: isoOrNull(row.verifiedAt)
        })),
        compiledDigest: plan.compiledDigest,
        delayedCancel: delayed,
        dispatchPrevented: true,
        mission
      });
    }
  };
}
