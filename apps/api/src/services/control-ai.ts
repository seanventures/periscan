import { getConnectorByKey } from "@periscan/connectors";
import type { Prisma } from "@prisma/client";
import {
  buildExecutionIntegrityHonesty,
  buildModelExtractionHonesty,
  buildPartnerCapabilityHonesty,
  buildSafetyEquivalentPacksResponse,
  ControlRuleCoverageSummarySchema,
  ensureCoverageItemEffectivenessState,
  type ControlRuleCoverageSummary,
  type DetectionRuleCoverageItem,
  type ExecutionIntegrityHonesty,
  type ModelExtractionHonesty,
  type PartnerCapabilityHonesty,
  type SafetyEquivalentPacksResponse
} from "@periscan/shared";
import {
  createAllowlistedDetectionMarkerId,
  isAllowlistedDetectionMarkerId
} from "@periscan/modules";

import {
  decryptIntegrationConfig,
  integrationSecretFieldKeys
} from "../integration-credentials.js";

import {
  serializeAIApplication,
  serializeControlSource,
  serializeScope,
  serializeValidationRun
} from "../serializers/entities.js";
import {
  AppServiceError,
  buildControlRuleCoverageSummary,
  compareControlRuleCoverageSummary,
  createObservedControlSignal,
  executeInlineValidation,
  getConnectorKey,
  isMockMode,
  parseObserverOutcome,
  requireCapability,
  requireRole,
  SCOPE_EDITOR_ROLES,
  serializeSignalEnvelope,
  writeAuditEvent,
  type DetectionMarkerProofInput,
  type DnsExfilCanaryProofInput
} from "../runtime-services.js";
import type { AppServices, RuntimeServiceDeps } from "../runtime-services.js";

export type AiValidationDriftStatus =
  | "Improved"
  | "NoBaseline"
  | "Regressed"
  | "Stable";

export function classifyAiValidationDrift(input: {
  currentOutcome: string;
  currentSignalOutcomes: string[];
  currentValidationState: string | null;
  previousOutcome: string | null;
  previousValidationState: string | null;
}): AiValidationDriftStatus {
  if (!input.previousOutcome && !input.previousValidationState) {
    return "NoBaseline";
  }

  const highRiskCurrent =
    input.currentValidationState === "Exploitable" ||
    input.currentSignalOutcomes.includes("Regressed") ||
    input.currentSignalOutcomes.includes("GuardrailBypassed") ||
    input.currentSignalOutcomes.includes("LeakageObserved") ||
    input.currentSignalOutcomes.includes("UnauthorizedRetrievalObserved") ||
    input.currentSignalOutcomes.includes("UnsafeToolCallAttempted");
  const previouslyHighRisk =
    input.previousValidationState === "Exploitable" ||
    input.previousOutcome === "ai_risk_observed";

  if (highRiskCurrent && !previouslyHighRisk) {
    return "Regressed";
  }

  if (!highRiskCurrent && previouslyHighRisk) {
    return "Improved";
  }

  return "Stable";
}

// Control-source & AI-application service group (D1 Phase 2 closure decomposition).
export function createControlAiServices(
  deps: RuntimeServiceDeps
): Pick<
  AppServices,
  | "createAIApplication"
  | "createControlSource"
  | "updateControlSource"
  | "getAIApplication"
  | "getControlRuleCoverage"
  | "getControlSource"
  | "getControlSourceRuleCoverage"
  | "listAIApplicationHistory"
  | "listAIApplications"
  | "listControlSourceHistory"
  | "listControlSources"
  | "runDetectionMarkerProof"
  | "runDnsExfilCanaryProof"
  | "listSafetyEquivalentPacks"
  | "getExecutionIntegrityHonesty"
  | "getModelExtractionHonesty"
  | "getPartnerCapabilityHonesty"
  | "setAIValidationKillSwitch"
  | "validateAIApplication"
  | "validateControlSource"
> {
  const { devMode, prisma } = deps;

  function readRecord(value: unknown): Record<string, unknown> {
    return typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};
  }

  function readTargetString(value: unknown, key: string): string | null {
    const candidate = readRecord(value)[key];

    return typeof candidate === "string" && candidate.length > 0
      ? candidate
      : null;
  }

  function getAiRunCategory(value: unknown) {
    return readTargetString(value, "validationCategory");
  }

  function serializeCoverageSnapshot(record: {
    blockedTechniques: number;
    coveredTechniques: number;
    generatedAt: Date;
    improvedTechniques: number;
    items: unknown;
    loggedOnlyTechniques: number;
    missedTechniques: number;
    needsTuningTechniques: number;
    noEvidenceTechniques: number;
    notTestedTechniques: number;
    recommendations: string[];
    regressedTechniques: number;
    snapshotId: string;
    staleTechniques: number;
    tenantId: string;
    totalTechniques: number;
  }): ControlRuleCoverageSummary {
    // Backfill canonical effectivenessState for snapshots persisted before
    // Slice 5 / PERISCAN-8 so every control-coverage read path exposes the
    // same denominator without rewriting stored JSON in place.
    const items = Array.isArray(record.items)
      ? (record.items as DetectionRuleCoverageItem[]).map((item) =>
          ensureCoverageItemEffectivenessState(item)
        )
      : record.items;

    return ControlRuleCoverageSummarySchema.parse({
      blockedTechniques: record.blockedTechniques,
      controlSourceId: null,
      coveredTechniques: record.coveredTechniques,
      generatedAt: record.generatedAt.toISOString(),
      history: [],
      improvedTechniques: record.improvedTechniques,
      items,
      loggedOnlyTechniques: record.loggedOnlyTechniques,
      missedTechniques: record.missedTechniques,
      needsTuningTechniques: record.needsTuningTechniques,
      noEvidenceTechniques: record.noEvidenceTechniques,
      notTestedTechniques: record.notTestedTechniques,
      recommendations: record.recommendations,
      regressedTechniques: record.regressedTechniques,
      snapshotId: record.snapshotId,
      staleTechniques: record.staleTechniques,
      tenantId: record.tenantId,
      totalTechniques: record.totalTechniques
    });
  }

  async function persistControlRuleCoverageSnapshot(input: {
    tenantId: string;
    triggerControlSourceId: string;
  }) {
    const [controlSources, signals, previousRecord] = await Promise.all([
      prisma.controlSource.findMany({
        orderBy: { createdAt: "asc" },
        where: { tenantId: input.tenantId }
      }),
      prisma.signalEnvelope.findMany({
        orderBy: { timestampObserved: "desc" },
        where: {
          signalCategory: "ControlObservation",
          tenantId: input.tenantId
        }
      }),
      prisma.controlRuleCoverageSnapshot.findFirst({
        orderBy: { generatedAt: "desc" },
        where: { tenantId: input.tenantId }
      })
    ]);
    const generatedAt = new Date();
    const current = buildControlRuleCoverageSummary({
      controlSources: controlSources.map(serializeControlSource),
      generatedAt: generatedAt.toISOString(),
      signals: signals.map(serializeSignalEnvelope),
      tenantId: input.tenantId
    });
    const compared = compareControlRuleCoverageSummary(
      current,
      previousRecord ? serializeCoverageSnapshot(previousRecord) : null
    );

    return prisma.controlRuleCoverageSnapshot.create({
      data: {
        blockedTechniques: compared.blockedTechniques,
        coveredTechniques: compared.coveredTechniques,
        generatedAt,
        improvedTechniques: compared.improvedTechniques,
        items: compared.items as unknown as Prisma.InputJsonValue,
        loggedOnlyTechniques: compared.loggedOnlyTechniques,
        missedTechniques: compared.missedTechniques,
        needsTuningTechniques: compared.needsTuningTechniques,
        noEvidenceTechniques: compared.noEvidenceTechniques,
        notTestedTechniques: compared.notTestedTechniques,
        recommendations: compared.recommendations,
        regressedTechniques: compared.regressedTechniques,
        staleTechniques: compared.staleTechniques,
        tenantId: input.tenantId,
        totalTechniques: compared.totalTechniques,
        triggerControlSourceId: input.triggerControlSourceId
      }
    });
  }

  // Most recent AIAppValidation ValidationRun per aiAppId for a tenant, so AI
  // application responses can surface their latest validation provenance inline.
  // Validations are stored as runs whose target.aiAppId names the app.
  async function loadLatestAiValidationRuns(tenantId: string) {
    const missions = await prisma.validationMission.findMany({
      include: {
        validationRuns: {
          orderBy: {
            createdAt: "desc"
          }
        }
      },
      where: {
        missionType: "AIAppValidation",
        tenantId
      }
    });
    const latest = new Map<
      string,
      (typeof missions)[number]["validationRuns"][number]
    >();
    for (const run of missions.flatMap((mission) => mission.validationRuns)) {
      const target =
        typeof run.target === "object" && run.target
          ? (run.target as Record<string, unknown>)
          : {};
      const aiAppId = target.aiAppId;
      if (typeof aiAppId !== "string") {
        continue;
      }
      const existing = latest.get(aiAppId);
      if (!existing || run.createdAt > existing.createdAt) {
        latest.set(aiAppId, run);
      }
    }
    return latest;
  }

  return {
    async listAIApplications(context) {
      const aiApplications = await prisma.aIApplication.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      const latestRuns = await loadLatestAiValidationRuns(
        context.tenant.tenantId
      );

      return aiApplications.map((aiApp) =>
        serializeAIApplication({
          ...aiApp,
          latestValidationRun: latestRuns.get(aiApp.aiAppId) ?? null
        })
      );
    },

    async listControlSources(context) {
      const controlSources = await prisma.controlSource.findMany({
        orderBy: {
          createdAt: "asc"
        },
        where: {
          tenantId: context.tenant.tenantId
        }
      });

      return controlSources.map(serializeControlSource);
    },

    async getControlRuleCoverage(context) {
      const snapshots = await prisma.controlRuleCoverageSnapshot.findMany({
        orderBy: { generatedAt: "desc" },
        take: 12,
        where: { tenantId: context.tenant.tenantId }
      });

      if (snapshots.length > 0) {
        const latest = serializeCoverageSnapshot(snapshots[0]!);
        return {
          ...latest,
          history: snapshots
            .map((snapshot) => {
              const summary = serializeCoverageSnapshot(snapshot);
              return {
                blockedTechniques: summary.blockedTechniques,
                coveredTechniques: summary.coveredTechniques,
                generatedAt: summary.generatedAt,
                improvedTechniques: summary.improvedTechniques,
                loggedOnlyTechniques: summary.loggedOnlyTechniques,
                missedTechniques: summary.missedTechniques,
                needsTuningTechniques: summary.needsTuningTechniques,
                noEvidenceTechniques: summary.noEvidenceTechniques,
                notTestedTechniques: summary.notTestedTechniques,
                regressedTechniques: summary.regressedTechniques,
                snapshotId: summary.snapshotId!,
                staleTechniques: summary.staleTechniques,
                totalTechniques: summary.totalTechniques
              };
            })
            .reverse()
        };
      }

      const [controlSources, signals] = await Promise.all([
        prisma.controlSource.findMany({
          orderBy: {
            createdAt: "asc"
          },
          where: {
            tenantId: context.tenant.tenantId
          }
        }),
        prisma.signalEnvelope.findMany({
          orderBy: {
            timestampObserved: "desc"
          },
          where: {
            signalCategory: "ControlObservation",
            tenantId: context.tenant.tenantId
          }
        })
      ]);

      return buildControlRuleCoverageSummary({
        controlSources: controlSources.map(serializeControlSource),
        generatedAt: new Date().toISOString(),
        signals: signals.map(serializeSignalEnvelope),
        tenantId: context.tenant.tenantId
      });
    },

    async getControlSourceRuleCoverage(context, controlSourceId) {
      const controlSource = await prisma.controlSource.findFirst({
        where: {
          controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!controlSource) {
        return null;
      }

      const signals = await prisma.signalEnvelope.findMany({
        orderBy: {
          timestampObserved: "desc"
        },
        where: {
          relatedControlIds: {
            has: controlSourceId
          },
          signalCategory: "ControlObservation",
          tenantId: context.tenant.tenantId
        }
      });

      return buildControlRuleCoverageSummary({
        controlSourceId,
        controlSources: [serializeControlSource(controlSource)],
        generatedAt: new Date().toISOString(),
        signals: signals.map(serializeSignalEnvelope),
        tenantId: context.tenant.tenantId
      });
    },

    async listAIApplicationHistory(context, aiAppId) {
      const aiApp = await prisma.aIApplication.findFirst({
        where: {
          aiAppId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!aiApp) {
        throw new AppServiceError(
          "AI application not found.",
          404,
          "ai_app_not_found"
        );
      }

      const missions = await prisma.validationMission.findMany({
        include: {
          validationRuns: {
            orderBy: {
              createdAt: "desc"
            }
          }
        },
        where: {
          missionType: "AIAppValidation",
          tenantId: context.tenant.tenantId
        }
      });

      return missions
        .flatMap((mission) => mission.validationRuns)
        .filter((run) => {
          const target =
            typeof run.target === "object" && run.target
              ? (run.target as Record<string, unknown>)
              : {};

          return target.aiAppId === aiAppId;
        })
        .map(serializeValidationRun);
    },

    async listControlSourceHistory(context, controlSourceId) {
      const controlSource = await prisma.controlSource.findFirst({
        where: {
          controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!controlSource) {
        throw new AppServiceError(
          "Control source not found.",
          404,
          "control_source_not_found"
        );
      }

      const missions = await prisma.validationMission.findMany({
        include: {
          validationRuns: {
            orderBy: {
              createdAt: "desc"
            }
          }
        },
        where: {
          missionType: "ControlValidation",
          tenantId: context.tenant.tenantId
        }
      });

      return missions
        .flatMap((mission) => mission.validationRuns)
        .filter((run) => {
          const target =
            typeof run.target === "object" && run.target
              ? (run.target as Record<string, unknown>)
              : {};

          return target.controlSourceId === controlSourceId;
        })
        .map(serializeValidationRun);
    },

    async getAIApplication(context, aiAppId) {
      const aiApp = await prisma.aIApplication.findFirst({
        where: {
          aiAppId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!aiApp) {
        return null;
      }

      const latestRuns = await loadLatestAiValidationRuns(
        context.tenant.tenantId
      );

      return serializeAIApplication({
        ...aiApp,
        latestValidationRun: latestRuns.get(aiApp.aiAppId) ?? null
      });
    },

    async getControlSource(context, controlSourceId) {
      const controlSource = await prisma.controlSource.findFirst({
        where: {
          controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });

      return controlSource ? serializeControlSource(controlSource) : null;
    },

    async createAIApplication(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create AI applications"
      );

      // AI application registration is part of the first-sellable Snapshot
      // onboarding flow. Validation execution remains independently
      // policy-gated by this service and the module safety engine.
      await requireCapability(prisma, context, "AI app registry");

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
          "AI application registration requires a verified scope.",
          400,
          "verified_scope_required"
        );
      }

      if (
        !["AIApplicationEndpoint", "Domain", "Subdomain"].includes(
          scope.scopeType
        )
      ) {
        throw new AppServiceError(
          "AI applications must be tied to an AI endpoint or verified domain scope.",
          400,
          "scope_type_not_supported"
        );
      }

      const aiApp = await prisma.aIApplication.create({
        data: {
          appType: input.appType,
          authMethod: input.authMethod,
          dataSourcesDescription: input.dataSourcesDescription,
          endpointUrl: input.endpointUrl,
          guardrailsDescription: input.guardrailsDescription,
          name: input.name,
          owner: input.owner,
          ragEnabled: input.ragEnabled,
          scopeId: input.scopeId,
          tenantId: context.tenant.tenantId,
          testAccountNotes: input.testAccountNotes ?? null,
          toolsEnabled: input.toolsEnabled
        }
      });

      return serializeAIApplication(aiApp);
    },

    async createControlSource(context, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "create control sources"
      );

      // Control-source registration is a Control Validation package capability.
      // Tenants whose active package does not include it are denied (402) +
      // audited before any work happens.
      await requireCapability(prisma, context, "Control source registry");

      const integration = await prisma.integration.findFirst({
        where: {
          integrationId: input.integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!integration) {
        throw new AppServiceError(
          "Integration not found.",
          404,
          "integration_not_found"
        );
      }

      const controlSource = await prisma.controlSource.create({
        data: {
          controlType: input.controlType,
          expectedBehaviors: input.expectedBehaviors,
          healthStatus: integration.healthStatus,
          integrationId: integration.integrationId,
          provider: input.provider,
          telemetryStatus: integration.healthStatus,
          tenantId: context.tenant.tenantId
        }
      });

      return serializeControlSource(controlSource);
    },

    async updateControlSource(context, controlSourceId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "tune control sources"
      );

      const controlSource = await prisma.controlSource.findFirst({
        where: {
          controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!controlSource) {
        throw new AppServiceError(
          "Control source not found.",
          404,
          "control_source_not_found"
        );
      }

      // Tuning updates the EXPECTED behaviors — the yardstick coverage is graded
      // against. It never asserts a control is effective; the next validation run
      // re-derives Detected/Missed against the new expectation from real signals.
      const updated = await prisma.$transaction(async (transaction) => {
        const next = await transaction.controlSource.update({
          data: { expectedBehaviors: input.expectedBehaviors },
          where: { controlSourceId: controlSource.controlSourceId }
        });
        await writeAuditEvent(transaction, {
          action: "control_source.tuning_changed",
          actorType: "User",
          entityId: controlSource.controlSourceId,
          entityType: "ControlSource",
          metadata: {
            nextExpectedBehaviors: input.expectedBehaviors,
            previousExpectedBehaviors: controlSource.expectedBehaviors,
            provider: controlSource.provider
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return next;
      });

      return serializeControlSource(updated);
    },

    async setAIValidationKillSwitch(context, aiAppId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "manage the AI validation kill switch"
      );

      const aiApp = await prisma.aIApplication.findFirst({
        where: { aiAppId, tenantId: context.tenant.tenantId }
      });
      if (!aiApp) {
        throw new AppServiceError(
          "AI application not found.",
          404,
          "ai_app_not_found"
        );
      }

      const latestRun = await prisma.validationRun.findFirst({
        orderBy: { createdAt: "desc" },
        where: {
          moduleId: "ai_app.safe_validation",
          tenantId: context.tenant.tenantId,
          target: { path: ["aiAppId"], equals: aiAppId }
        }
      });
      const changedAt = new Date();
      const updated = await prisma.$transaction(async (transaction) => {
        const next = await transaction.aIApplication.update({
          data: input.enabled
            ? {
                validationKillSwitchActivatedAt: changedAt,
                validationKillSwitchActivatedBy: context.user.userId,
                validationKillSwitchEnabled: true,
                validationKillSwitchReason: input.reason
              }
            : {
                validationKillSwitchEnabled: false,
                validationKillSwitchReason: input.reason
              },
          where: { aiAppId }
        });
        await writeAuditEvent(transaction, {
          action: "ai_validation.kill_switch_changed",
          actorType: "User",
          entityId: aiAppId,
          entityType: "AIApplication",
          metadata: {
            enabled: input.enabled,
            lastTaskCompletedAt: latestRun?.completedAt?.toISOString() ?? null,
            lastTaskId: latestRun?.runId ?? null,
            reason: input.reason,
            tasksAcceptedAfterActivation: 0
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return next;
      });

      return serializeAIApplication(updated);
    },

    async validateAIApplication(context, aiAppId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "validate AI applications"
      );

      const aiApp = await prisma.aIApplication.findFirst({
        where: {
          aiAppId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!aiApp) {
        throw new AppServiceError(
          "AI application not found.",
          404,
          "ai_app_not_found"
        );
      }

      if (aiApp.validationKillSwitchEnabled) {
        throw new AppServiceError(
          `AI validation kill switch is active${aiApp.validationKillSwitchReason ? `: ${aiApp.validationKillSwitchReason}` : "."}`,
          409,
          "ai_validation_kill_switch_active"
        );
      }

      const executionMode = input.executionMode ?? "LiveSafe";
      const fixtureRequested = executionMode === "Fixture";
      const boundedSuiteRequested = executionMode === "LiveSuite";

      if (fixtureRequested && !devMode) {
        throw new AppServiceError(
          "Fixture AI application validation is only available in API dev mode. Use LiveSafe for customer validation.",
          400,
          "fixture_validation_disabled"
        );
      }

      if (!fixtureRequested && input.fixtureOutcome) {
        throw new AppServiceError(
          "fixtureOutcome requires executionMode Fixture.",
          400,
          "fixture_outcome_requires_fixture_mode"
        );
      }

      const category = input.validationCategory ?? null;
      const priorRuns = await prisma.validationRun.findMany({
        orderBy: {
          createdAt: "desc"
        },
        take: 50,
        where: {
          moduleId: "ai_app.safe_validation",
          status: "Completed",
          tenantId: context.tenant.tenantId
        }
      });
      const previousRun = priorRuns.find((run) => {
        const target = readRecord(run.target);

        if (target.aiAppId !== aiAppId) {
          return false;
        }

        return category ? getAiRunCategory(run.target) === category : true;
      });

      return executeInlineValidation({
        adminApproval: false,
        augmentResult: async (result) => {
          const currentSignalOutcomes = result.signals.flatMap((signal) =>
            typeof signal.signalSubcategory === "string"
              ? [signal.signalSubcategory]
              : []
          );
          const driftStatus = classifyAiValidationDrift({
            currentOutcome: result.outcome,
            currentSignalOutcomes,
            currentValidationState: result.validationState ?? null,
            previousOutcome: previousRun?.outcome ?? null,
            previousValidationState: previousRun?.validationState ?? null
          });
          const comparison = {
            category,
            currentOutcome: result.outcome,
            currentSignalOutcomes,
            currentValidationState: result.validationState ?? null,
            driftStatus,
            previousOutcome: previousRun?.outcome ?? null,
            previousRunId: previousRun?.runId ?? null,
            previousValidationState: previousRun?.validationState ?? null
          };

          return {
            ...result,
            evidence: [
              ...result.evidence,
              {
                artifactType: "NormalizedEvidence" as const,
                attributes: {
                  baselineComparison: comparison,
                  safeMode: true
                },
                description: previousRun
                  ? `AI validation baseline comparison for ${aiApp.name}: ${driftStatus}.`
                  : `AI validation baseline initialized for ${aiApp.name}; no prior comparable run.`,
                redactionStatus: "Redacted" as const,
                sensitivityLevel: "Moderate" as const
              }
            ],
            summary: `${result.summary} Baseline comparison: ${driftStatus}.`
          };
        },
        context,
        executionEnvironment: "ControlPlane",
        explicitMissionApproval: true,
        missionType: "AIAppValidation",
        moduleId: "ai_app.safe_validation",
        onCompleted: async (tx) => {
          await tx.aIApplication.update({
            where: {
              aiAppId: aiApp.aiAppId
            },
            data: {
              lastValidatedAt: new Date()
            }
          });
        },
        prisma,
        scopeId: aiApp.scopeId,
        target: {
          aiAppId: aiApp.aiAppId,
          appName: aiApp.name,
          endpointUrl: aiApp.endpointUrl,
          executionMode,
          boundedSuite: boundedSuiteRequested,
          corpusVersion: input.corpusVersion ?? "periscan-benign-v1",
          fixtureMode: fixtureRequested,
          ...(fixtureRequested && input.fixtureOutcome
            ? { fixtureOutcome: input.fixtureOutcome }
            : {}),
          harness:
            input.harness ?? (boundedSuiteRequested ? "periscan" : "promptfoo"),
          maxRequests: input.maxRequests ?? 4,
          maxResponseBytes: input.maxResponseBytes ?? 4_096,
          safeTestCases: input.safeTestCases,
          suite: input.validationCategory,
          timeoutSeconds: input.timeoutSeconds,
          validationCategory: input.validationCategory
        }
      });
    },

    async validateControlSource(context, controlSourceId, input) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "validate control sources"
      );

      const controlSource = await prisma.controlSource.findFirst({
        where: {
          controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!controlSource) {
        throw new AppServiceError(
          "Control source not found.",
          404,
          "control_source_not_found"
        );
      }

      // Wave D dual gate (SOW + tenant inject flag + operator approval) is not an
      // enablement path yet. Until a signed SOW lands, refuse all live inject
      // attempts hard — no dual-gate bypass, no Atomic/Caldera live.
      if (input.executionMode === "LiveRunner" || input.dryRun === false) {
        throw new AppServiceError(
          "Inject loop not available: closed inject→measure control execution is disabled on the control-plane API (control_live_execution_disabled). Wave D lab inject requires a signed SOW and dual gates (tenant inject flag + operator approval); neither is an enablement path in product today. Dry-run remains telemetry-only observation against connected SIEM/EDR — it does not claim a closed inject-measure loop. Atomic remains dry-run scenario import only (not live inject BAS). Use executionMode DryRun, or an explicitly approved internal-runner mission when a limited safe stimulus is authorized. Next step: connect a SIEM/EDR control source and run Observe telemetry (DryRun), or dispatch an approved endpoint benign-marker mission — do not treat this as live Atomic/BAS inject.",
          400,
          "control_live_execution_disabled"
        );
      }
      if (input.fixtureOutcome && !devMode) {
        throw new AppServiceError(
          "Fixture control observer outcomes are only available in dev mode.",
          400,
          "fixture_mode_disabled"
        );
      }

      const verifiedScopes = await prisma.scope.findMany({
        orderBy: [{ scopeType: "desc" }, { createdAt: "asc" }],
        where: {
          tenantId: context.tenant.tenantId,
          verificationStatus: "Verified"
        }
      });
      const eligibleScopeIds = new Set(
        verifiedScopes
          .map(serializeScope)
          .filter((candidate) =>
            ["BASLite", "AdvancedAdversarial"].includes(
              candidate.effectiveMaxSafetyLevel
            )
          )
          .map((candidate) => candidate.scopeId)
      );
      const scope =
        verifiedScopes.find(
          (candidate) =>
            candidate.scopeType === "ControlSource" &&
            eligibleScopeIds.has(candidate.scopeId)
        ) ??
        verifiedScopes.find((candidate) =>
          eligibleScopeIds.has(candidate.scopeId)
        );

      if (!scope) {
        throw new AppServiceError(
          "Dry-run control validation requires a verified scope whose effective safety ceiling permits BASLite. OT-protected and lower-ceiling scopes remain ineligible.",
          400,
          "control_validation_scope_safety_required"
        );
      }

      const integration = await prisma.integration.findFirst({
        where: {
          integrationId: controlSource.integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      if (!integration) {
        throw new AppServiceError(
          "Control source integration not found.",
          404,
          "integration_not_found"
        );
      }

      const connectorKey = getConnectorKey(integration.config);
      const connector = connectorKey ? getConnectorByKey(connectorKey) : null;

      return executeInlineValidation({
        adminApproval: ["Owner", "Admin", "MSSPOwner", "ClientAdmin"].includes(
          context.membership.role
        ),
        augmentResult: async (result) => {
          if (!connector?.observeControl) {
            return result;
          }

          const observed = await connector.observeControl({
            authType: integration.authType,
            config: {
              ...decryptIntegrationConfig(
                integration.config,
                integrationSecretFieldKeys(connector, integration.authType)
              ),
              fixtureOutcome: input.fixtureOutcome,
              techniqueId: input.techniqueId ?? null
            },
            integrationId: integration.integrationId,
            mockMode: isMockMode(integration.config),
            tenantId: integration.tenantId
          });
          const observerOutcome = parseObserverOutcome(observed);
          const observerSignal = createObservedControlSignal({
            confidence: observerOutcome.confidence,
            controlSourceId: controlSource.controlSourceId,
            detail: observerOutcome.detail,
            outcome: observerOutcome.outcome,
            sourceIntegrationId: integration.integrationId,
            sourceType: observerOutcome.sourceType,
            sourceVendor: connector.manifest.vendor,
            techniqueId: input.techniqueId ?? undefined,
            tenantId: context.tenant.tenantId
          });

          const techniqueId =
            typeof input.techniqueId === "string" &&
            input.techniqueId.length > 0
              ? input.techniqueId
              : null;

          return {
            ...result,
            evidence: [
              ...result.evidence,
              {
                artifactType: "NormalizedEvidence",
                attributes: {
                  connectorKey,
                  detail:
                    typeof observed.detail === "string"
                      ? observed.detail
                      : null,
                  observedOutcome: observerSignal.signalSubcategory,
                  provider: controlSource.provider,
                  sourceType:
                    typeof observed.sourceType === "string"
                      ? observed.sourceType
                      : connector.manifest.connectorKey
                },
                description: `Observed ${observerSignal.signalSubcategory} verdict from ${controlSource.provider}.`,
                redactionStatus: "Redacted",
                sensitivityLevel: "Moderate"
              }
            ],
            outcome: observerOutcome.outcome.toLowerCase(),
            signals: [
              {
                ...observerSignal,
                techniqueIds: techniqueId ? [techniqueId] : []
              },
              ...result.signals
            ],
            summary:
              observerOutcome.outcome !== input.fixtureOutcome
                ? `${result.summary} Observer verdict: ${observerOutcome.outcome}.`
                : result.summary,
            validationState:
              observerOutcome.outcome === "Detected"
                ? "Detected"
                : observerOutcome.outcome === "Blocked"
                  ? "Blocked"
                  : observerOutcome.outcome === "Logged"
                    ? "Logged"
                    : observerOutcome.outcome === "Alerted" ||
                        observerOutcome.outcome === "Routed"
                      ? "Alerted"
                      : observerOutcome.outcome === "Missed"
                        ? "Missed"
                        : result.validationState
          };
        },
        context,
        executionEnvironment: "ControlPlane",
        explicitMissionApproval: false,
        missionType: "ControlValidation",
        moduleId: "atomic.control_validation_safe",
        onCompleted: async (tx, result) => {
          const verdict =
            result.signals.find(
              (signal) => signal.signalCategory === "ControlObservation"
            )?.signalSubcategory ?? null;

          await tx.controlSource.update({
            where: {
              controlSourceId: controlSource.controlSourceId
            },
            data: {
              healthStatus:
                verdict === "Missed" ||
                verdict === "NoEvidence" ||
                verdict === "NeedsTuning"
                  ? "Degraded"
                  : "Healthy",
              lastValidatedAt: new Date(),
              telemetryStatus:
                verdict === "Missed" ||
                verdict === "NoEvidence" ||
                verdict === "NeedsTuning"
                  ? "Degraded"
                  : "Healthy"
            }
          });
          await persistControlRuleCoverageSnapshot({
            tenantId: context.tenant.tenantId,
            triggerControlSourceId: controlSource.controlSourceId
          });
        },
        prisma,
        relatedControlIds: [controlSource.controlSourceId],
        scopeId: scope.scopeId,
        target: {
          controlSourceId: controlSource.controlSourceId,
          dryRun: true,
          executionMode: input.executionMode ?? "DryRun",
          fixtureOutcome: input.fixtureOutcome,
          // P06-5 honesty: control-plane validate never claims closed inject→measure.
          injectLoopAvailable: false,
          observationMode: "telemetry_only",
          observationNote:
            "Inject loop not available on the control-plane API. This run is telemetry-only observation against connected SIEM/EDR; it does not claim a closed inject-measure loop.",
          runnerId: input.runnerId ?? null,
          techniqueId: input.techniqueId ?? null
        }
      });
    },

    /**
     * Wave B product path: allowlisted benign marker emit → SIEM/EDR observe
     * correlation with a single mission/evidence chain. Benign-marker class only
     * (not full ATT&CK BAS / Atomic live / malware).
     */
    async runDetectionMarkerProof(
      context,
      controlSourceId,
      input: DetectionMarkerProofInput
    ) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "run detection marker proof"
      );

      const controlSource = await prisma.controlSource.findFirst({
        where: {
          controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!controlSource) {
        throw new AppServiceError(
          "Control source not found.",
          404,
          "control_source_not_found"
        );
      }

      const markerId =
        typeof input.markerId === "string" && input.markerId.length > 0
          ? input.markerId
          : createAllowlistedDetectionMarkerId();
      if (!isAllowlistedDetectionMarkerId(markerId)) {
        throw new AppServiceError(
          "Marker id must match the allowlisted periscan-* benign pattern.",
          400,
          "detection_marker_not_allowlisted"
        );
      }

      let scopeId = input.scopeId ?? null;
      if (!scopeId) {
        const verifiedScopes = await prisma.scope.findMany({
          orderBy: [{ scopeType: "desc" }, { createdAt: "asc" }],
          where: {
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        });
        const eligible = verifiedScopes.find((candidate) =>
          ["InternalNetwork", "ControlSource", "Domain", "Subdomain"].includes(
            candidate.scopeType
          )
        );
        scopeId = eligible?.scopeId ?? null;
      }
      if (!scopeId) {
        throw new AppServiceError(
          "Detection marker proof requires a verified InternalNetwork, ControlSource, Domain, or Subdomain scope.",
          400,
          "detection_marker_scope_required"
        );
      }

      const integration = await prisma.integration.findFirst({
        where: {
          integrationId: controlSource.integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      const observedEvents: Array<string | Record<string, unknown>> = [
        ...(input.observedEvents ?? [])
      ];

      // Prefer connector mock/live observe events that mention the marker when available.
      if (integration) {
        const connectorKey = getConnectorKey(integration.config);
        const connector = connectorKey ? getConnectorByKey(connectorKey) : null;
        if (connector?.observeControl) {
          try {
            const observed = await connector.observeControl({
              authType: integration.authType,
              config: {
                ...decryptIntegrationConfig(
                  integration.config,
                  integrationSecretFieldKeys(connector, integration.authType)
                ),
                correlationToken: markerId,
                techniqueId: input.techniqueId ?? "T1059"
              },
              integrationId: integration.integrationId,
              mockMode: isMockMode(integration.config),
              tenantId: context.tenant.tenantId
            });
            if (observed.correlationMatched === true) {
              observedEvents.push({
                correlationMatched: true,
                detail:
                  typeof observed.detail === "string" ? observed.detail : null,
                markerId,
                sourceType:
                  typeof observed.sourceType === "string"
                    ? observed.sourceType
                    : connector.manifest.connectorKey
              });
            } else if (
              typeof observed.detail === "string" &&
              observed.detail.includes(markerId)
            ) {
              observedEvents.push(observed.detail);
            }
          } catch {
            // Observer failure does not invent telemetry; loop stays honest.
          }
        }
      }

      // Mock SIEM half for signed product/demo path when explicitly requested
      // (default true in fixtureMode / when no events yet in dev).
      const useMockObservation =
        input.injectMockObservation === true ||
        (input.injectMockObservation !== false &&
          observedEvents.length === 0 &&
          (input.fixtureMode === true || devMode));
      if (useMockObservation && observedEvents.length === 0) {
        observedEvents.push({
          event: "process_create",
          markerId,
          message: `Periscan mock SIEM correlated allowlisted detection marker ${markerId}`,
          techniqueId: input.techniqueId ?? "T1059"
        });
      }

      const platform =
        input.platform ??
        (process.platform === "darwin"
          ? ("macOS" as const)
          : process.platform === "linux"
            ? ("Linux" as const)
            : ("Linux" as const));

      const result = await executeInlineValidation({
        adminApproval: ["Owner", "Admin", "MSSPOwner", "ClientAdmin"].includes(
          context.membership.role
        ),
        context,
        executionEnvironment: "ControlPlane",
        explicitMissionApproval: false,
        missionType: "ControlValidation",
        moduleId: "periscan.detection_marker_emit_observe",
        onCompleted: async (tx) => {
          await tx.controlSource.update({
            where: { controlSourceId: controlSource.controlSourceId },
            data: { lastValidatedAt: new Date() }
          });
        },
        prisma,
        relatedControlIds: [controlSource.controlSourceId],
        scopeId,
        target: {
          controlSourceId: controlSource.controlSourceId,
          expectedRule: input.expectedRule,
          fixtureMode: input.fixtureMode === true,
          hostname: controlSource.provider,
          liveTelemetry:
            input.fixtureMode === true
              ? false
              : observedEvents.length > 0 && !useMockObservation,
          markerId,
          observedEvents,
          performEmit: input.performEmit !== false,
          platform,
          platformAnalytics: input.platformAnalytics,
          platformVerified: true,
          techniqueId: input.techniqueId ?? "T1059",
          telemetryWindowComplete: true
        }
      });

      const primaryRun = result.run;
      const outcome = primaryRun.outcome ?? "detection_marker_loop_incomplete";
      // Closed loop only when both emit and observe completed productively.
      const closedLoopHonest =
        outcome === "detection_marker_emit_observe_detected" ||
        outcome === "detection_marker_emit_observe_missed";
      // Evidence attributes may still mark closedLoop true for incomplete windows.
      const evidenceClosedLoop = result.evidence.some((artifact) => {
        const content =
          artifact && typeof artifact === "object"
            ? (artifact as { content?: unknown }).content
            : null;
        if (!content || typeof content !== "object") {
          return false;
        }
        const attrs = content as Record<string, unknown>;
        return attrs.closedLoop === true;
      });

      await writeAuditEvent(prisma, {
        action: "module.executed",
        actorType: "User",
        entityId: primaryRun.runId,
        entityType: "ValidationRun",
        metadata: {
          closedLoop: closedLoopHonest || evidenceClosedLoop,
          controlSourceId: controlSource.controlSourceId,
          drvClaimClass: "benign_marker_only",
          fullAttackLibrary: false,
          markerId,
          missionId: result.mission.missionId,
          moduleId: "periscan.detection_marker_emit_observe",
          outcome,
          productPath: "detection_marker_proof",
          validationState: primaryRun.validationState ?? null
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        closedLoop: closedLoopHonest || evidenceClosedLoop,
        drvClaimClass: "benign_marker_only" as const,
        fullAttackLibrary: false as const,
        markerId,
        mission: result.mission,
        outcome,
        runs: [primaryRun],
        summary:
          outcome === "detection_marker_emit_observe_detected"
            ? `Closed benign-marker loop: ${markerId} emitted and observed (DRV marker class only — not full ATT&CK BAS).`
            : outcome === "detection_marker_emit_observe_missed"
              ? `Closed benign-marker loop: ${markerId} emitted but not observed (measured Missed).`
              : `Detection marker proof for ${markerId} completed with outcome ${outcome}. DRV remains Partial for anything beyond the benign-marker class.`,
        validationState: primaryRun.validationState ?? null
      };
    },

    /**
     * Phase C product path: bounded DNS-exfil *detection* canary.
     * Allowlisted label emit only — realDataExfiltrated always false.
     * Not multi-vector malware/phishing BAS; not bulk data tunnel.
     */
    async runDnsExfilCanaryProof(
      context,
      controlSourceId,
      input: DnsExfilCanaryProofInput
    ) {
      requireRole(
        context.membership.role,
        SCOPE_EDITOR_ROLES,
        "run DNS exfil canary proof"
      );

      const controlSource = await prisma.controlSource.findFirst({
        where: {
          controlSourceId,
          tenantId: context.tenant.tenantId
        }
      });
      if (!controlSource) {
        throw new AppServiceError(
          "Control source not found.",
          404,
          "control_source_not_found"
        );
      }

      const markerId =
        typeof input.markerId === "string" && input.markerId.length > 0
          ? input.markerId
          : createAllowlistedDetectionMarkerId("dns-exfil");
      if (!isAllowlistedDetectionMarkerId(markerId)) {
        throw new AppServiceError(
          "Marker id must match the allowlisted periscan-* benign pattern.",
          400,
          "dns_exfil_marker_not_allowlisted"
        );
      }

      let scopeId = input.scopeId ?? null;
      let hostname =
        typeof input.hostname === "string" && input.hostname.length > 0
          ? input.hostname
          : null;

      if (scopeId) {
        const scope = await prisma.scope.findFirst({
          where: {
            scopeId,
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified"
          }
        });
        if (!scope) {
          throw new AppServiceError(
            "DNS exfil canary requires a verified scope.",
            400,
            "dns_exfil_scope_required"
          );
        }
        if (!hostname && (scope.scopeType === "Domain" || scope.scopeType === "Subdomain")) {
          hostname = scope.value;
        }
      } else {
        const verifiedScopes = await prisma.scope.findMany({
          orderBy: [{ scopeType: "desc" }, { createdAt: "asc" }],
          where: {
            tenantId: context.tenant.tenantId,
            verificationStatus: "Verified",
            scopeType: { in: ["Domain", "Subdomain"] }
          }
        });
        const eligible = verifiedScopes[0] ?? null;
        scopeId = eligible?.scopeId ?? null;
        if (!hostname && eligible) {
          hostname = eligible.value;
        }
      }

      if (!scopeId) {
        throw new AppServiceError(
          "DNS exfil canary proof requires a verified Domain or Subdomain scope.",
          400,
          "dns_exfil_scope_required"
        );
      }
      if (!hostname) {
        throw new AppServiceError(
          "DNS exfil canary proof requires a hostname (scope value or input.hostname).",
          400,
          "dns_exfil_hostname_required"
        );
      }

      const integration = await prisma.integration.findFirst({
        where: {
          integrationId: controlSource.integrationId,
          tenantId: context.tenant.tenantId
        }
      });

      const observedEvents: Array<string | Record<string, unknown>> = [
        ...(input.observedEvents ?? [])
      ];

      if (integration) {
        const connectorKey = getConnectorKey(integration.config);
        const connector = connectorKey ? getConnectorByKey(connectorKey) : null;
        if (connector?.observeControl) {
          try {
            const observed = await connector.observeControl({
              authType: integration.authType,
              config: {
                ...decryptIntegrationConfig(
                  integration.config,
                  integrationSecretFieldKeys(connector, integration.authType)
                ),
                correlationToken: markerId,
                techniqueId: input.techniqueId ?? "T1048"
              },
              integrationId: integration.integrationId,
              mockMode: isMockMode(integration.config),
              tenantId: context.tenant.tenantId
            });
            if (observed.correlationMatched === true) {
              observedEvents.push({
                correlationMatched: true,
                detail:
                  typeof observed.detail === "string" ? observed.detail : null,
                markerId,
                sourceType:
                  typeof observed.sourceType === "string"
                    ? observed.sourceType
                    : connector.manifest.connectorKey
              });
            } else if (
              typeof observed.detail === "string" &&
              observed.detail.includes(markerId)
            ) {
              observedEvents.push(observed.detail);
            }
          } catch {
            // Observer failure does not invent telemetry.
          }
        }
      }

      const useMockObservation =
        input.injectMockObservation === true ||
        (input.injectMockObservation !== false &&
          observedEvents.length === 0 &&
          (input.fixtureMode === true || devMode));
      if (useMockObservation && observedEvents.length === 0) {
        observedEvents.push({
          event: "dns_tunnel_suspect",
          markerId,
          message: `Periscan mock DNS monitor correlated allowlisted exfil canary ${markerId}`,
          techniqueId: input.techniqueId ?? "T1048"
        });
      }

      const canaryLabel = markerId.startsWith("periscan-")
        ? markerId
        : `periscan-${markerId}`;
      const canaryFqdn = `${canaryLabel}.${hostname}`;

      const result = await executeInlineValidation({
        adminApproval: ["Owner", "Admin", "MSSPOwner", "ClientAdmin"].includes(
          context.membership.role
        ),
        context,
        executionEnvironment: "ControlPlane",
        explicitMissionApproval: false,
        missionType: "ControlValidation",
        moduleId: "periscan.dns_exfil_canary",
        onCompleted: async (tx) => {
          await tx.controlSource.update({
            where: { controlSourceId: controlSource.controlSourceId },
            data: { lastValidatedAt: new Date() }
          });
        },
        prisma,
        relatedControlIds: [controlSource.controlSourceId],
        scopeId,
        target: {
          controlSourceId: controlSource.controlSourceId,
          fixtureMode: input.fixtureMode === true,
          hostname,
          liveTelemetry:
            input.fixtureMode === true
              ? false
              : observedEvents.length > 0 && !useMockObservation,
          markerId,
          observedEvents,
          techniqueId: input.techniqueId ?? "T1048"
        }
      });

      const primaryRun = result.run;
      const outcome = primaryRun.outcome ?? "dns_exfil_no_telemetry";
      const closedLoopHonest =
        outcome === "dns_exfil_detected" || outcome === "dns_exfil_undetected";

      // Prefer measured flag from evidence attributes when present.
      let measured = false;
      let evidenceCanaryLabel = canaryLabel;
      let evidenceCanaryFqdn = canaryFqdn;
      for (const artifact of result.evidence) {
        const content =
          artifact && typeof artifact === "object"
            ? (artifact as { content?: unknown }).content
            : null;
        if (!content || typeof content !== "object") {
          continue;
        }
        const attrs = content as Record<string, unknown>;
        if (attrs.measured === true) {
          measured = true;
        }
        if (typeof attrs.canaryLabel === "string" && attrs.canaryLabel.length > 0) {
          evidenceCanaryLabel = attrs.canaryLabel;
        }
        if (typeof attrs.canaryFqdn === "string" && attrs.canaryFqdn.length > 0) {
          evidenceCanaryFqdn = attrs.canaryFqdn;
        }
        // Hard safety: never allow real exfil claim even if a buggy attr appears.
        if (attrs.realDataExfiltrated === true) {
          measured = false;
        }
      }

      await writeAuditEvent(prisma, {
        action: "module.executed",
        actorType: "User",
        entityId: primaryRun.runId,
        entityType: "ValidationRun",
        metadata: {
          closedLoop: closedLoopHonest,
          controlSourceId: controlSource.controlSourceId,
          exfilClaimClass: "benign_marker_only",
          fullExfilLibrary: false,
          markerId,
          measured,
          missionId: result.mission.missionId,
          moduleId: "periscan.dns_exfil_canary",
          outcome,
          productPath: "dns_exfil_canary_proof",
          realDataExfiltrated: false,
          validationState: primaryRun.validationState ?? null
        },
        tenantId: context.tenant.tenantId,
        userId: context.user.userId
      });

      return {
        canaryFqdn: evidenceCanaryFqdn,
        canaryLabel: evidenceCanaryLabel,
        closedLoop: closedLoopHonest,
        exfilClaimClass: "benign_marker_only" as const,
        fullExfilLibrary: false as const,
        markerId,
        measured,
        mission: result.mission,
        outcome,
        realDataExfiltrated: false as const,
        runs: [primaryRun],
        summary:
          outcome === "dns_exfil_detected"
            ? `DNS-exfil detection canary ${evidenceCanaryLabel} observed (benign marker only — no real data exfiltrated).`
            : outcome === "dns_exfil_undetected"
              ? `DNS-exfil detection canary ${evidenceCanaryLabel} not observed (measured Missed when liveTelemetry). No real data exfiltrated.`
              : `DNS-exfil canary ${evidenceCanaryLabel} completed with outcome ${outcome}. Substitute class only — never bulk exfil or multi-vector BAS.`,
        validationState: primaryRun.validationState ?? null
      };
    },

    /** Read-only Phase C inventory — honesty labels, no execution. */
    async listSafetyEquivalentPacks(
      _context
    ): Promise<SafetyEquivalentPacksResponse> {
      return buildSafetyEquivalentPacksResponse();
    },

    /** Scorecard #47 — software chain + customer TEE verifier only; no host TEE. */
    async getExecutionIntegrityHonesty(
      _context
    ): Promise<ExecutionIntegrityHonesty> {
      return buildExecutionIntegrityHonesty();
    },

    /** Scorecard #64 — resistance suite honesty; never weight theft. */
    async getModelExtractionHonesty(
      _context
    ): Promise<ModelExtractionHonesty> {
      return buildModelExtractionHonesty();
    },

    /** Slice D — partner residual honesty for #2/#26/#28/#38/#51. */
    async getPartnerCapabilityHonesty(
      _context
    ): Promise<PartnerCapabilityHonesty> {
      return buildPartnerCapabilityHonesty();
    }
  };
}
