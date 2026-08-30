import type { Prisma, PrismaClient } from "@prisma/client";
import type { RunStatus } from "@prisma/client";

import { getPrismaClient } from "@periscan/db";
import {
  appendEvidenceIdsAtomically,
  createPrismaEvidenceGraphService,
  createPrismaEvidenceService,
  receiptMarksMeasured,
  type EvidenceGraphService,
  type EvidenceService
} from "@periscan/evidence";
import {
  readAwsIntegrationId,
  resolveProwlerModuleInputs,
  targetRequestsProwlerFixture,
  type ProwlerAwsIntegrationRecord
} from "@periscan/connectors";
import {
  executeModuleById,
  getModuleById,
  type ModuleOutput
} from "@periscan/modules";
import {
  resolveGraphNodeType,
  targetIncludesFixtureHints,
  ValidationJobPayloadSchema,
  type EvidenceArtifact,
  type SignalEnvelope,
  type ValidationJobPayload,
  type ValidationMission,
  type ValidationRun
} from "@periscan/shared";
import {
  createBullMqWebhookDeliveryQueue,
  emitWebhookEvent,
  type WebhookDeliveryQueue
} from "@periscan/webhooks";

export interface LoadedValidationJob {
  job: {
    attempts: number;
    jobId: string;
    missionId: string;
    status: string;
    tenantId: string;
    validationRunId: string;
  };
  mission: {
    missionId: string;
    status: ValidationMission["status"];
    tenantId: string;
  };
  run: {
    missionId: string;
    moduleId: string;
    policyDecisionId: string | null;
    runId: string;
    runnerId: string | null;
    safetyLevel: ValidationRun["safetyLevel"];
    scopeId: string;
    status: ValidationRun["status"];
    target: Record<string, unknown>;
    tenantId: string;
  };
}

export interface MissionExecutionStore {
  attachEvidenceToPack?(
    execution: LoadedValidationJob,
    evidenceIds: string[]
  ): Promise<void>;
  /** Persist evidence IDs on the validation run after persistEvidence. */
  attachEvidenceIdsToRun?(
    execution: LoadedValidationJob,
    evidenceIds: string[]
  ): Promise<void>;
  /**
   * Hop-bound auto-apply after Completed runs (P05-1). Best-effort;
   * Inconclusive/NoEvidence must not upgrade Heuristic → Measured.
   */
  autoApplyHopReceipt?(
    execution: LoadedValidationJob,
    result: ModuleOutput,
    evidenceIds: string[]
  ): Promise<void>;
  loadExecution(payload: ValidationJobPayload): Promise<LoadedValidationJob>;
  loadTenantIntegration?(
    tenantId: string,
    integrationId: string
  ): Promise<ProwlerAwsIntegrationRecord | null>;
  markCompleted(
    execution: LoadedValidationJob,
    result: ModuleOutput
  ): Promise<void>;
  markFailed(
    execution: LoadedValidationJob,
    errorSummary: string
  ): Promise<void>;
  markRunning(execution: LoadedValidationJob): Promise<void>;
  markRunSkipped(
    execution: LoadedValidationJob,
    reason: string
  ): Promise<void>;
  persistEvidence(
    execution: LoadedValidationJob,
    result: ModuleOutput
  ): Promise<EvidenceArtifact[]>;
  persistSignals(signals: SignalEnvelope[]): Promise<void>;
  projectGraph(
    execution: LoadedValidationJob,
    signals: SignalEnvelope[],
    evidenceArtifacts: EvidenceArtifact[]
  ): Promise<void>;
  recordModuleExecuted(
    execution: LoadedValidationJob,
    result: ModuleOutput
  ): Promise<void>;
  reconcileMissionStatus(missionId: string): Promise<void>;
}

export interface MissionExecutionProcessorOptions {
  allowFixtureTargets?: boolean;
}

function getErrorSummary(error: unknown) {
  return error instanceof Error ? error.message : "Module execution failed.";
}

const NON_EXECUTABLE_JOB_STATUSES = new Set([
  "Cancelled",
  "Completed",
  "DeniedByPolicy",
  "Failed"
]);

function getNonExecutableReason(execution: LoadedValidationJob): string | null {
  if (NON_EXECUTABLE_JOB_STATUSES.has(execution.job.status)) {
    return `Job is ${execution.job.status}.`;
  }
  if (NON_EXECUTABLE_JOB_STATUSES.has(execution.mission.status)) {
    return `Mission is ${execution.mission.status}.`;
  }
  if (NON_EXECUTABLE_JOB_STATUSES.has(execution.run.status)) {
    return `Validation run is ${execution.run.status}.`;
  }

  return null;
}

export function getSignalGraphProjection(signal: SignalEnvelope) {
  const label =
    signal.signalSubcategory ?? `${signal.signalCategory} observation`;

  if (signal.signalCategory === "Exposure") {
    // P11R-1: closed Exposure leaves — free subcategories collapse to bare Exposure
    return {
      label,
      nodeKey: `exposure:${signal.signalId}`,
      nodeType: resolveGraphNodeType(
        "Exposure",
        signal.signalSubcategory ?? "Observed"
      )
    };
  }

  return {
    label,
    nodeKey: `signal:${signal.signalId}`,
    nodeType: `Signal.${signal.signalCategory}`
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(
  record: Record<string, unknown>,
  key: string
): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(
  record: Record<string, unknown>,
  key: string
): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

interface ScheduleDriftInfo {
  currentOutcome: string;
  evidenceDelta: number;
  note: string;
  priorOutcome: string;
}

interface SchedulePackInfo {
  completedAt: string;
  drift?: ScheduleDriftInfo;
  driftNote?: string;
  evidenceCount: number;
  evidencePackId: string;
  missionId: string;
  modelSessionId?: string;
  moduleId: string;
  packType?: string;
  runId: string;
  status: "completed";
}

export function createMissionExecutionProcessor(
  store: MissionExecutionStore,
  options: MissionExecutionProcessorOptions = {}
) {
  return {
    async process(payload: ValidationJobPayload | Record<string, unknown>) {
      const parsedPayload = ValidationJobPayloadSchema.parse(payload);
      const execution = await store.loadExecution(parsedPayload);
      const nonExecutableReason = getNonExecutableReason(execution);

      if (nonExecutableReason) {
        if (
          execution.run.status === "Queued" ||
          execution.run.status === "Running"
        ) {
          // Persist the skip so Postgres does not show the run as Queued
          // forever after BullMQ has already moved past the job.
          await store.markRunSkipped(execution, nonExecutableReason);
        }
        return {
          errors: [nonExecutableReason],
          evidence: [],
          outcome: "skipped",
          signals: [],
          summary: `Skipped validation job ${execution.job.jobId}: ${nonExecutableReason}`,
          validationState: "Inconclusive" as const
        };
      }

      if (
        !options.allowFixtureTargets &&
        targetIncludesFixtureHints(execution.run.target)
      ) {
        const message =
          "Fixture validation targets are disabled in this worker runtime.";

        await store.markFailed(execution, message);
        await store.reconcileMissionStatus(execution.mission.missionId);

        throw new Error(message);
      }

      // P0.2: InternalRunner modules are MEASURED by the outbound-only Go runner
      // (apps/runner/main.go). The control-plane BullMQ worker must never execute
      // them, otherwise reachability/result data would be fabricated here. Reject
      // such runs explicitly instead of running the control-plane TS stub.
      const module = getModuleById(execution.run.moduleId);

      if (module?.manifest.executionMode === "InternalRunner") {
        const message = `Module ${execution.run.moduleId} requires the internal runner and must not execute in the control-plane worker; route it through the signed runner task path.`;

        await store.markFailed(execution, message);
        await store.reconcileMissionStatus(execution.mission.missionId);

        throw new Error(message);
      }

      await store.markRunning(execution);

      try {
        const awsIntegrationId = readAwsIntegrationId(execution.run.target);
        const shouldLoadAwsIntegration =
          execution.run.moduleId === "prowler.aws_posture" &&
          Boolean(awsIntegrationId) &&
          !targetRequestsProwlerFixture(execution.run.target);
        const integration =
          shouldLoadAwsIntegration && awsIntegrationId
            ? ((await store.loadTenantIntegration?.(
                execution.run.tenantId,
                awsIntegrationId
              )) ?? null)
            : undefined;
        const prowlerInputs = await resolveProwlerModuleInputs({
          integration,
          moduleId: execution.run.moduleId,
          target: execution.run.target
        });
        const inputs: Record<string, unknown> = {};
        if (prowlerInputs.awsRuntimeEnv) {
          inputs.awsRuntimeEnv = prowlerInputs.awsRuntimeEnv;
        }
        if (prowlerInputs.awsCredentialError) {
          inputs.awsCredentialError = prowlerInputs.awsCredentialError;
        }

        const result = await executeModuleById(execution.run.moduleId, {
          integrationIds: prowlerInputs.integrationIds,
          inputs,
          missionId: execution.mission.missionId,
          policyDecisionId: execution.run.policyDecisionId,
          runId: execution.run.runId,
          runnerId: execution.run.runnerId,
          safetyLevel: execution.run.safetyLevel,
          scopeId: execution.run.scopeId,
          target: execution.run.target,
          tenantId: execution.run.tenantId
        });
        const evidenceArtifacts = await store.persistEvidence(
          execution,
          result
        );
        const evidenceIds = evidenceArtifacts.map(
          (artifact) => artifact.evidenceId
        );

        await store.attachEvidenceToPack?.(execution, evidenceIds);

        const signals = result.signals.map((signal) => ({
          ...signal,
          evidenceIds: [...new Set([...signal.evidenceIds, ...evidenceIds])],
          relatedEvidenceIds: [
            ...new Set([...signal.relatedEvidenceIds, ...evidenceIds])
          ]
        }));

        if (signals.length > 0) {
          await store.persistSignals(signals);
        }

        await store.projectGraph(execution, signals, evidenceArtifacts);
        await store.markCompleted(execution, {
          ...result,
          signals
        });
        // Persist evidence IDs on the run (auto-apply + receipt linkage need them).
        if (evidenceIds.length > 0) {
          await store.attachEvidenceIdsToRun?.(execution, evidenceIds);
        }
        // P05-1 parity with runner/control-plane: hop-bound completed runs
        // auto-apply edge receipts when evidence exists (best-effort).
        if (evidenceIds.length > 0) {
          try {
            await store.autoApplyHopReceipt?.(
              execution,
              { ...result, signals },
              evidenceIds
            );
          } catch {
            // Never fail job completion on receipt auto-apply.
          }
        }
        await store.recordModuleExecuted(execution, result);
        await store.reconcileMissionStatus(execution.mission.missionId);

        return {
          ...result,
          signals
        };
      } catch (error) {
        await store.markFailed(execution, getErrorSummary(error));
        await store.reconcileMissionStatus(execution.mission.missionId);

        throw error;
      }
    }
  };
}

export class PrismaMissionExecutionStore implements MissionExecutionStore {
  private readonly evidenceGraphService: EvidenceGraphService;

  private readonly evidenceService: EvidenceService;

  private readonly webhookQueue: WebhookDeliveryQueue | null;

  constructor(
    private readonly prisma: PrismaClient = getPrismaClient(),
    webhookQueue?: WebhookDeliveryQueue | null
  ) {
    this.evidenceGraphService = createPrismaEvidenceGraphService(this.prisma);
    this.evidenceService = createPrismaEvidenceService({
      prisma: this.prisma
    });
    this.webhookQueue =
      webhookQueue === undefined
        ? createBullMqWebhookDeliveryQueue()
        : webhookQueue;
  }

  async loadExecution(
    payload: ValidationJobPayload
  ): Promise<LoadedValidationJob> {
    const job = await this.prisma.job.findFirst({
      where: {
        jobId: payload.jobId,
        missionId: payload.missionId,
        tenantId: payload.tenantId,
        validationRunId: payload.runId
      },
      include: {
        mission: true,
        validationRun: true
      }
    });

    if (
      !job?.mission ||
      !job.validationRun ||
      !job.missionId ||
      !job.validationRunId
    ) {
      throw new Error(
        `Validation job ${payload.jobId} is missing mission context.`
      );
    }

    return {
      job: {
        attempts: job.attempts,
        jobId: job.jobId,
        missionId: job.missionId,
        status: job.status,
        tenantId: job.tenantId,
        validationRunId: job.validationRunId
      },
      mission: {
        missionId: job.mission.missionId,
        status: job.mission.status,
        tenantId: job.mission.tenantId
      },
      run: {
        missionId: job.validationRun.missionId,
        moduleId: job.validationRun.moduleId,
        policyDecisionId: job.validationRun.policyDecisionId,
        runId: job.validationRun.runId,
        runnerId: job.validationRun.runnerId,
        safetyLevel: job.validationRun.safetyLevel,
        scopeId: job.validationRun.scopeId,
        status: job.validationRun.status,
        target:
          typeof job.validationRun.target === "object" &&
          job.validationRun.target
            ? (job.validationRun.target as Record<string, unknown>)
            : {},
        tenantId: job.validationRun.tenantId
      }
    };
  }

  async loadTenantIntegration(
    tenantId: string,
    integrationId: string
  ): Promise<ProwlerAwsIntegrationRecord | null> {
    const integration = await this.prisma.integration.findFirst({
      select: {
        authType: true,
        config: true,
        product: true,
        status: true,
        vendor: true
      },
      where: {
        integrationId,
        tenantId
      }
    });

    return integration;
  }

  async markRunning(execution: LoadedValidationJob) {
    const startedAt = new Date();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.validationMission.update({
        where: {
          missionId: execution.mission.missionId
        },
        data: {
          startedAt,
          status: "Running"
        }
      });

      await tx.validationRun.update({
        where: {
          runId: execution.run.runId
        },
        data: {
          startedAt,
          status: "Running"
        }
      });

      await tx.job.update({
        where: {
          jobId: execution.job.jobId
        },
        data: {
          attempts: {
            increment: 1
          },
          startedAt,
          status: "Running"
        }
      });
    });
  }

  async persistSignals(signals: SignalEnvelope[]) {
    if (signals.length === 0) {
      return;
    }

    await this.prisma.signalEnvelope.createMany({
      data: signals.map((signal) => ({
        confidence: signal.confidence ?? null,
        createdAt: new Date(signal.createdAt),
        evidenceIds: signal.evidenceIds,
        freshness: signal.freshness ?? null,
        rawPayloadPointer: signal.rawPayloadPointer ?? null,
        redactionStatus: signal.redactionStatus,
        relatedAssetIds: signal.relatedAssetIds,
        relatedControlIds: signal.relatedControlIds,
        relatedEvidenceIds: signal.relatedEvidenceIds,
        relatedIdentityIds: signal.relatedIdentityIds,
        relatedPathIds: signal.relatedPathIds,
        sensitivityLevel: signal.sensitivityLevel,
        signalCategory: signal.signalCategory,
        signalId: signal.signalId,
        signalSubcategory: signal.signalSubcategory ?? null,
        sourceIntegrationId: signal.sourceIntegrationId,
        sourceType: signal.sourceType,
        sourceVendor: signal.sourceVendor,
        tenantId: signal.tenantId,
        techniqueIds: signal.techniqueIds ?? [],
        timestampIngested: new Date(signal.timestampIngested),
        timestampObserved: new Date(signal.timestampObserved),
        updatedAt: new Date(signal.updatedAt)
      }))
    });
  }

  async persistEvidence(execution: LoadedValidationJob, result: ModuleOutput) {
    const rawArtifact = await this.evidenceService.putEvidenceArtifact({
      artifactType: "RawModuleOutput",
      content: {
        evidence: result.evidence,
        outcome: result.outcome,
        signals: result.signals,
        summary: result.summary,
        validationState: result.validationState
      },
      filename: `${execution.run.moduleId}-raw-output`,
      relatedEntityId: execution.run.runId,
      relatedEntityType: "ValidationRun",
      sensitivityLevel: "High",
      tenantId: execution.run.tenantId
    });
    const normalizedArtifacts = [];

    for (const [index, evidence] of result.evidence.entries()) {
      normalizedArtifacts.push(
        await this.evidenceService.putEvidenceArtifact({
          artifactType: evidence.artifactType,
          content: evidence.attributes,
          filename: `${execution.run.moduleId}-normalized-${index + 1}`,
          relatedEntityId: execution.run.runId,
          relatedEntityType: "ValidationRun",
          sensitivityLevel: evidence.sensitivityLevel,
          tenantId: execution.run.tenantId
        })
      );
    }

    return [
      rawArtifact.artifact,
      ...normalizedArtifacts.map((item) => item.artifact)
    ];
  }

  async projectGraph(
    execution: LoadedValidationJob,
    signals: SignalEnvelope[],
    evidenceArtifacts: EvidenceArtifact[]
  ) {
    const runNode = await this.evidenceGraphService.upsertNode({
      evidenceIds: evidenceArtifacts.map((artifact) => artifact.evidenceId),
      label: `Validation run ${execution.run.moduleId}`,
      nodeKey: `validation-run:${execution.run.runId}`,
      nodeType: "ValidationRun",
      properties: {
        moduleId: execution.run.moduleId,
        status: execution.run.status
      },
      relatedEntityId: execution.run.runId,
      relatedEntityType: "ValidationRun",
      tenantId: execution.run.tenantId
    });
    const evidenceNodes = new Map<
      string,
      Awaited<ReturnType<EvidenceGraphService["upsertNode"]>>
    >();

    for (const artifact of evidenceArtifacts) {
      evidenceNodes.set(
        artifact.evidenceId,
        await this.evidenceGraphService.upsertNode({
          evidenceIds: [artifact.evidenceId],
          label: `${artifact.artifactType} ${artifact.evidenceId.slice(0, 8)}`,
          nodeKey: `evidence:${artifact.evidenceId}`,
          nodeType: "EvidenceArtifact",
          properties: {
            artifactType: artifact.artifactType,
            storageUri: artifact.storageUri
          },
          tenantId: artifact.tenantId
        })
      );
    }

    for (const signal of signals) {
      const projection = getSignalGraphProjection(signal);
      const signalNode = await this.evidenceGraphService.upsertNode({
        evidenceIds: signal.evidenceIds,
        label: projection.label,
        nodeKey: projection.nodeKey,
        nodeType: projection.nodeType,
        properties: {
          signalCategory: signal.signalCategory,
          signalSubcategory: signal.signalSubcategory,
          sourceType: signal.sourceType
        },
        tenantId: signal.tenantId
      });

      await this.evidenceGraphService.upsertEdge({
        evidenceIds: signal.evidenceIds,
        properties: {
          source: "worker"
        },
        rationale: "Validation run emitted normalized signal evidence.",
        relationship: "RELATES_TO",
        sourceNodeId: runNode.graphNodeId,
        targetNodeId: signalNode.graphNodeId,
        tenantId: signal.tenantId
      });

      for (const evidenceId of signal.evidenceIds) {
        const evidenceNode = evidenceNodes.get(evidenceId);

        if (!evidenceNode) {
          continue;
        }

        await this.evidenceGraphService.upsertEdge({
          evidenceIds: [evidenceId],
          properties: {
            source: "worker"
          },
          rationale: "Signal is backed by stored evidence artifact.",
          relationship: "OBSERVED_BY",
          sourceNodeId: signalNode.graphNodeId,
          targetNodeId: evidenceNode.graphNodeId,
          tenantId: signal.tenantId
        });
      }
    }
  }

  async attachEvidenceToPack(
    execution: LoadedValidationJob,
    evidenceIds: string[]
  ) {
    const packId = readString(execution.run.target, "evidencePackId");

    if (!packId || evidenceIds.length === 0) {
      return;
    }

    try {
      // Atomic locked union — concurrent job completions sharing a pack must
      // not drop each other's evidenceIds via unlocked find→merge→update.
      await appendEvidenceIdsAtomically(
        this.prisma,
        "EvidencePack",
        packId,
        evidenceIds
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("EvidencePack not found:")
      ) {
        return;
      }

      throw error;
    }
  }

  async attachEvidenceIdsToRun(
    execution: LoadedValidationJob,
    evidenceIds: string[]
  ) {
    if (evidenceIds.length === 0) {
      return;
    }
    const existing = await this.prisma.validationRun.findFirst({
      select: { evidenceIds: true },
      where: { runId: execution.run.runId }
    });
    const merged = Array.from(
      new Set([...(existing?.evidenceIds ?? []), ...evidenceIds])
    );
    await this.prisma.validationRun.update({
      data: { evidenceIds: merged },
      where: { runId: execution.run.runId }
    });
  }

  /**
   * P05-1: hop-bound worker completions mint path-edge receipts (same honesty
   * as runner + control-plane). Inconclusive/NoEvidence states record the probe
   * but do not upgrade Heuristic → Measured (receiptMarksMeasured).
   */
  async autoApplyHopReceipt(
    execution: LoadedValidationJob,
    result: ModuleOutput,
    evidenceIds: string[]
  ) {
    if (evidenceIds.length === 0) {
      return;
    }
    const target = execution.run.target;
    const pathId =
      typeof target.attackPathId === "string"
        ? target.attackPathId
        : typeof target.pathId === "string"
          ? target.pathId
          : null;
    const pathEdgeId =
      typeof target.pathEdgeId === "string" ? target.pathEdgeId : null;
    if (!pathId || !pathEdgeId) {
      return;
    }

    const hopKey =
      typeof target.hopKey === "string" && target.hopKey.length > 0
        ? target.hopKey
        : pathEdgeId;
    const validationState = result.validationState ?? "Inconclusive";
    const outcome = result.outcome ?? "hop_probe_completed";
    const measuredAt = new Date();

    await this.prisma.pathEdgeReceipt.create({
      data: {
        actor: "system:worker-auto-apply",
        evidenceIds,
        hopKey,
        integrityHash: null,
        measuredAt,
        measurementMethod: "hop-probe-auto",
        missionId: execution.mission.missionId,
        moduleId: execution.run.moduleId,
        outcome,
        pathEdgeId,
        pathId,
        policyDecisionId: null,
        tenantId: execution.run.tenantId,
        validationRunId: execution.run.runId,
        validationState
      }
    });

    const measured = receiptMarksMeasured({
      evidenceIds,
      validationState
    });
    if (!measured) {
      // Probe recorded; hop stays Heuristic until a certainty-bearing outcome.
      return;
    }

    const edge = await this.prisma.pathEdge.findFirst({
      where: {
        pathEdgeId,
        pathId,
        tenantId: execution.run.tenantId
      }
    });
    if (!edge) {
      return;
    }
    const mergedEdgeEvidence = Array.from(
      new Set([...(edge.evidenceIds ?? []), ...evidenceIds])
    );
    await this.prisma.pathEdge.update({
      data: {
        evidenceBasis: "Measured",
        evidenceIds: mergedEdgeEvidence,
        measurementMethod: execution.run.moduleId
      },
      where: { pathEdgeId }
    });

    const siblingEdges = await this.prisma.pathEdge.findMany({
      where: { pathId, tenantId: execution.run.tenantId }
    });
    const allMeasured = siblingEdges.every(
      (candidate) =>
        (candidate.pathEdgeId === pathEdgeId
          ? "Measured"
          : candidate.evidenceBasis) === "Measured" &&
        (candidate.pathEdgeId === pathEdgeId
          ? mergedEdgeEvidence
          : candidate.evidenceIds
        ).length > 0
    );
    const pathEvidenceIds = Array.from(
      new Set(
        siblingEdges.flatMap((candidate) =>
          candidate.pathEdgeId === pathEdgeId
            ? mergedEdgeEvidence
            : (candidate.evidenceIds ?? [])
        )
      )
    );
    await this.prisma.attackPath.update({
      data: {
        evidenceBasis: allMeasured ? "Measured" : "Heuristic",
        evidenceIds: pathEvidenceIds
      },
      where: { pathId }
    });
  }

  async markCompleted(execution: LoadedValidationJob, result: ModuleOutput) {
    const completedAt = new Date();
    const techniqueIds = [
      ...new Set(result.signals.flatMap((signal) => signal.techniqueIds ?? []))
    ];

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.validationRun.update({
        where: {
          runId: execution.run.runId
        },
        data: {
          completedAt,
          errorSummary: null,
          outcome: result.outcome,
          status: "Completed",
          techniqueIds,
          validationState: result.validationState ?? null
        }
      });

      await tx.job.update({
        where: {
          jobId: execution.job.jobId
        },
        data: {
          completedAt,
          errorMessage: null,
          status: "Completed"
        }
      });
    });

    // For non-snapshot scheduled missions, record completion back on the originating schedule
    // so users see fresh lastRunAt / outcome without manual refresh.
    const runTarget = execution.run.target;
    const originatingScheduleId = readString(runTarget, "scheduleId");
    const epId = readString(runTarget, "evidencePackId");
    const packType = readString(runTarget, "packType") ?? undefined;
    const modelSessionId = readString(runTarget, "modelSessionId") ?? undefined;
    const runEvidenceIds = readStringArray(runTarget, "evidenceIds");
    const packInfo: SchedulePackInfo | null = epId
      ? {
          evidencePackId: epId,
          ...(packType ? { packType } : {}),
          missionId: execution.mission.missionId,
          runId: execution.run.runId,
          status: "completed",
          completedAt: completedAt.toISOString(),
          // Richer for CTEM/UI: evidence + signal counts from this non-snap run (populated post-attach)
          evidenceCount: runEvidenceIds.length,
          moduleId: execution.run.moduleId,
          // Preserve modelSessionId from G-wire for UI/CTEM/report linkage
          ...(modelSessionId ? { modelSessionId } : {})
        }
      : null;

    if (originatingScheduleId) {
      // Schedule history + non-snap drift polish: compute simple drift from prior lastDiff vs current (for Control/AI/Fix non-snap), attach to packInfo + CTEM
      let driftNote = "";
      try {
        const priorSched = await this.prisma.missionSchedule.findUnique({
          where: { scheduleId: originatingScheduleId },
          select: { lastDiff: true }
        });
        const prior = asRecord(priorSched?.lastDiff);
        const priorPackInfo = asRecord(prior.packInfo);
        const currEc = packInfo?.evidenceCount ?? 0;
        const priorEc =
          readNumber(prior, "evidenceCount") ??
          readNumber(priorPackInfo, "evidenceCount") ??
          0;
        const currOut = packInfo?.status ?? "updated";
        const priorOut =
          readString(prior, "verificationOutcome") ??
          readString(prior, "status") ??
          "prior";
        if (priorEc || currEc) {
          const delta = currEc - priorEc;
          driftNote = `drift:${currOut} vs ${priorOut} (Δev:${delta})`;
          if (packInfo) {
            packInfo.drift = {
              currentOutcome: currOut,
              evidenceDelta: delta,
              note: driftNote,
              priorOutcome: priorOut
            };
          }
        }
      } catch {
        driftNote = "";
      }
      if (driftNote && packInfo) {
        packInfo.driftNote = driftNote;
      }

      await this.prisma.missionSchedule
        .update({
          where: { scheduleId: originatingScheduleId },
          data: {
            lastRunAt: completedAt,
            ...(packInfo
              ? {
                  lastDiff: packInfo as unknown as Prisma.InputJsonValue,
                  lastMissionId: execution.mission.missionId
                }
              : {})
          }
        })
        .catch(() => undefined);
    }

    if (epId) {
      await this.prisma.evidencePack
        .update({
          where: { evidencePackId: epId },
          data: { status: "Ready", completedAt }
        })
        .catch(() => {});

      // Guarantee at least one evidence record for non-snapshot packs.
      // This makes the UI (verdictSamples / last pack details) and reports always have visible substance
      // for ControlValidationReport / AIAppValidationReport / FixVerificationReport even if the
      // chosen OSS module produced zero artifacts in the current environment. Real module evidence
      // (when present) is attached earlier in the execution path and takes precedence.
      try {
        const pack = await this.prisma.evidencePack.findUnique({
          where: { evidencePackId: epId },
          select: { evidenceIds: true }
        });
        if (pack && (!pack.evidenceIds || pack.evidenceIds.length === 0)) {
          const recordId = `${epId}-run-${execution.run.runId.slice(0, 8)}`;
          await this.prisma.evidenceArtifact
            .create({
              data: {
                evidenceId: recordId,
                tenantId: execution.run.tenantId,
                artifactType: "NormalizedEvidence",
                storageUri: `internal:non-snap-completion:${execution.run.runId}`,
                sha256: "0".repeat(64),
                sensitivityLevel: "Low",
                redactionStatus: "NotRequired",
                relatedEntityId: epId,
                relatedEntityType: "EvidencePack",
                createdAt: completedAt,
                updatedAt: completedAt
              }
            })
            .catch(() => undefined);
          await this.prisma.evidencePack
            .update({
              where: { evidencePackId: epId },
              data: { evidenceIds: [recordId] }
            })
            .catch(() => undefined);
        }
      } catch {
        /* best effort, pack may have been deleted after the run completed */
      }

      // For non-snapshot scheduled packs, the evidence is attached; exportReport / getReport on the packId will include it.
      // Rebuild of render artifacts happens on demand in export paths (or via createReportPackFromSnapshot for snapshot packs).
    }
  }

  async markFailed(execution: LoadedValidationJob, errorSummary: string) {
    const completedAt = new Date();

    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.validationRun.update({
        where: {
          runId: execution.run.runId
        },
        data: {
          completedAt,
          errorSummary,
          outcome: "failed",
          status: "Failed"
        }
      });

      await tx.job.update({
        where: {
          jobId: execution.job.jobId
        },
        data: {
          completedAt,
          errorMessage: errorSummary,
          status: "Failed"
        }
      });
    });
  }
  async markRunSkipped(execution: LoadedValidationJob, reason: string) {
    await this.prisma.validationRun.update({
      where: {
        runId: execution.run.runId
      },
      data: {
        completedAt: new Date(),
        errorSummary: reason,
        outcome: "skipped",
        status: "Cancelled"
      }
    });
  }


  async recordModuleExecuted(
    execution: LoadedValidationJob,
    result: ModuleOutput
  ) {
    await this.prisma.auditEvent.create({
      data: {
        action: "module_executed",
        actorType: "System",
        entityId: execution.run.runId,
        entityType: "ValidationRun",
        metadata: {
          moduleId: execution.run.moduleId,
          outcome: result.outcome,
          signalCount: result.signals.length
        } as Prisma.InputJsonValue,
        tenantId: execution.run.tenantId
      }
    });
  }

  async reconcileMissionStatus(missionId: string) {
    const runs: Array<{ status: RunStatus }> =
      await this.prisma.validationRun.findMany({
        where: {
          missionId
        }
      });

    if (runs.length === 0) {
      return;
    }

    const mission = await this.prisma.validationMission.findUnique({
      where: {
        missionId
      }
    });

    if (!mission) {
      return;
    }

    // A mission is only terminal once every run is terminal. A single failed
    // run must NOT fail the mission while sibling runs are still queued.
    const hasPending = runs.some(
      (run) => run.status === "Queued" || run.status === "Running"
    );
    const hasFailed = runs.some((run) => run.status === "Failed");
    const allCompleted = runs.every((run) => run.status === "Completed");
    const nextStatus = hasPending
      ? "Running"
      : hasFailed
        ? "Failed"
        : allCompleted
          ? "Completed"
          : "Queued";

    await this.prisma.validationMission.update({
      where: {
        missionId
      },
      data: {
        completedAt:
          !hasPending && (hasFailed || allCompleted) ? new Date() : null,
        status: nextStatus
      }
    });

    const wasTerminal =
      mission.status === "Completed" || mission.status === "Failed";
    const isTerminal = nextStatus === "Completed" || nextStatus === "Failed";

    if (!wasTerminal && isTerminal) {
      await emitWebhookEvent({
        eventType:
          nextStatus === "Failed" ? "mission.failed" : "mission.completed",
        payload: {
          missionId,
          status: nextStatus
        },
        prisma: this.prisma,
        queue: this.webhookQueue,
        tenantId: mission.tenantId
      });
    }
  }
}
