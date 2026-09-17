import type { Prisma, PrismaClient } from "@prisma/client";

import { getPrismaClient } from "@periscan/db";
import { assessAttackPathRisk } from "@periscan/evidence";
import {
  buildModelSemanticCacheKey,
  calculateModelCostMicrousd,
  digestModelContext,
  fingerprintModelIntent,
  isSemanticCacheEligible,
  redactModelTextForStorage,
  resolveDefaultModelForProvider,
  runModelGatewaySessionTurn,
  writeModelGatewayAuditEvent,
  type GatewayPolicyDeps,
  type GatewayToolExecutionDeps
} from "@periscan/model-gateway";
import type { OperatorContext } from "@periscan/operators";
import {
  ModelGatewayTurnJobPayloadSchema,
  ModelProviderPricingSchema,
  type AttackPath,
  type EvidenceArtifact,
  type ModelGatewayTurnJobPayload
} from "@periscan/shared";

const DEFAULT_SEMANTIC_CACHE_TTL_SECONDS = 300;

function semanticCacheTtlMs(): number {
  const value = Number.parseInt(
    process.env.PERISCAN_MODEL_SEMANTIC_CACHE_TTL_SECONDS ?? "",
    10
  );
  const seconds = Number.isFinite(value)
    ? Math.min(3_600, Math.max(30, value))
    : DEFAULT_SEMANTIC_CACHE_TTL_SECONDS;
  return seconds * 1_000;
}

/**
 * Tenant-level audit actions the gateway turn loop can emit, mapped to the
 * Prisma enum values. Kept minimal: the Policy Enforcement Point is the only
 * emitter during a turn.
 */
const GATEWAY_AUDIT_ACTION_TO_DB: Record<string, string> = {
  "model_tool.allowed": "model_tool_allowed",
  "model_tool.denied": "model_tool_denied",
  "model_tool.requested": "model_tool_requested"
};

function createTurnError(message: string, statusCode: number, code: string) {
  const error = new Error(message) as Error & {
    statusCode: number;
    code: string;
  };
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function serializeEvidenceArtifactRow(record: unknown): EvidenceArtifact {
  const row = record as {
    evidenceId: string;
    tenantId: string;
    artifactType: EvidenceArtifact["artifactType"];
    storageUri: string;
    sha256: string;
    sensitivityLevel: EvidenceArtifact["sensitivityLevel"];
    redactionStatus: EvidenceArtifact["redactionStatus"];
    relatedEntityType: EvidenceArtifact["relatedEntityType"];
    relatedEntityId: string;
    createdAt: Date;
    updatedAt: Date;
  };
  return {
    artifactType: row.artifactType,
    createdAt: row.createdAt.toISOString(),
    evidenceId: row.evidenceId,
    redactionStatus: row.redactionStatus,
    relatedEntityId: row.relatedEntityId,
    relatedEntityType: row.relatedEntityType,
    sensitivityLevel: row.sensitivityLevel,
    sha256: row.sha256,
    storageUri: row.storageUri,
    tenantId: row.tenantId,
    updatedAt: row.updatedAt.toISOString()
  };
}

function createGatewayPolicyDeps(): GatewayPolicyDeps {
  return {
    createError: createTurnError,
    writeTenantAuditEvent: async (client, input) => {
      const mapped = GATEWAY_AUDIT_ACTION_TO_DB[input.action] ?? input.action;
      await (client as PrismaClient).auditEvent.create({
        data: {
          action: mapped as never,
          actorType: input.actorType,
          entityId: input.entityId ?? null,
          entityType: input.entityType as never,
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
          tenantId: input.tenantId ?? null,
          userId: input.userId ?? null
        }
      });
    }
  };
}

/**
 * Read-only attack paths for the tenant. The async worker path does not
 * recorrelate (that is a control-plane operation); it serves the persisted,
 * already-correlated graph and lets the executor surface redacted summaries.
 */
async function loadTenantAttackPaths(
  prisma: PrismaClient,
  tenantId: string
): Promise<AttackPath[]> {
  const rows = await prisma.attackPath.findMany({
    orderBy: { createdAt: "asc" },
    where: { tenantId }
  });
  return rows.map((row) => ({
    confidence: row.confidence,
    createdAt: row.createdAt.toISOString(),
    entryNodeId: row.entryNodeId,
    evidenceBasis: row.evidenceBasis,
    evidenceIds: row.evidenceIds,
    impactNodeId: row.impactNodeId,
    impactScore: row.impactScore,
    methodology: row.methodology,
    name: row.name,
    pathBreakers: [],
    pathEdges: [],
    pathNodes: [],
    pathId: row.pathId,
    tenantId: row.tenantId,
    updatedAt: row.updatedAt.toISOString(),
    validationState: row.validationState
  }));
}

function createGatewayToolExecutionDeps(
  prisma: PrismaClient,
  tenantId: string
): GatewayToolExecutionDeps {
  return {
    buildOperatorContext: async (): Promise<OperatorContext> => {
      const [
        attackPaths,
        evidenceArtifacts,
        verifiedScopes,
        controlSourceCount,
        integrationCount,
        aiAppCount
      ] = await Promise.all([
        loadTenantAttackPaths(prisma, tenantId),
        prisma.evidenceArtifact.findMany({
          orderBy: { createdAt: "desc" },
          take: 25,
          where: { tenantId }
        }),
        prisma.scope.findMany({
          where: { tenantId, verificationStatus: "Verified" }
        }),
        prisma.controlSource.count({ where: { tenantId } }),
        prisma.integration.count({ where: { tenantId } }),
        prisma.aIApplication.count({ where: { tenantId } })
      ]);

      return {
        aiAppCount,
        aiAppRisks: [],
        attackPaths: attackPaths.map((path) => assessAttackPathRisk(path)),
        controlObservations: [],
        controlSourceCount,
        defaultTargetHostname: null,
        evidenceArtifacts: evidenceArtifacts.map(serializeEvidenceArtifactRow),
        generatedAt: new Date().toISOString(),
        integrationCount,
        latestSnapshot: null,
        remediations: [],
        tenantId,
        verifiedScopeIds: verifiedScopes.map((scope) => scope.scopeId)
      };
    },
    createError: createTurnError,
    ensureCorrelatedAttackPaths: (scopedTenantId) =>
      loadTenantAttackPaths(prisma, scopedTenantId),
    serializeEvidenceArtifact: serializeEvidenceArtifactRow
  };
}

export function createModelGatewayTurnProcessor(
  prisma: PrismaClient = getPrismaClient()
) {
  return {
    async process(
      payload: ModelGatewayTurnJobPayload | Record<string, unknown>
    ) {
      const turn = ModelGatewayTurnJobPayloadSchema.parse(payload);

      const session = await prisma.modelSession.findFirst({
        include: { policyProfile: true, provider: true },
        where: { modelSessionId: turn.modelSessionId, tenantId: turn.tenantId }
      });
      if (!session) {
        throw new Error(
          `Model session ${turn.modelSessionId} not found for turn ${turn.turnId}.`
        );
      }
      if (session.status !== "Active") {
        // Session was terminated/expired/blocked between enqueue and pickup.
        await prisma.modelUsageEvent.updateMany({
          data: {
            completedAt: new Date(),
            failureCategory: `Session${session.status}`,
            status: "Blocked"
          },
          where: { turnId: turn.turnId }
        });
        return { skipped: true, status: session.status };
      }

      const usageEvent = await prisma.modelUsageEvent.findUnique({
        where: { turnId: turn.turnId }
      });
      const routedProvider = usageEvent
        ? await prisma.modelProvider.findFirst({
            where: {
              modelProviderId: usageEvent.modelProviderId,
              status: "Active",
              tenantId: turn.tenantId
            }
          })
        : session.provider;
      if (!routedProvider) {
        await prisma.modelUsageEvent.updateMany({
          data: {
            completedAt: new Date(),
            failureCategory: "RoutedProviderUnavailable",
            status: "Blocked"
          },
          where: { turnId: turn.turnId }
        });
        throw new Error("The pre-selected model provider is no longer active.");
      }

      const meteringEvent =
        usageEvent ??
        (await prisma.modelUsageEvent.create({
          data: {
            modelProviderId: routedProvider.modelProviderId,
            modelSessionId: session.modelSessionId,
            adapterAlias: session.adapterAlias,
            precisionMode: session.precisionMode,
            routingReason:
              "Legacy queued turn was attached to its session provider at worker pickup.",
            tenantId: turn.tenantId,
            turnId: turn.turnId
          }
        }));

      const model =
        session.requestedModel ??
        process.env.PERISCAN_MODEL_GATEWAY_DEFAULT_MODEL ??
        resolveDefaultModelForProvider(routedProvider.providerType);

      const startedAt = Date.now();
      const startedDate = new Date(startedAt);
      const latestBundle = await prisma.contextBundle.findFirst({
        include: { items: true },
        orderBy: { createdAt: "desc" },
        where: {
          modelSessionId: session.modelSessionId,
          tenantId: turn.tenantId
        }
      });
      const contextDigest = digestModelContext(
        latestBundle
          ? {
              items: latestBundle.items,
              redactionPolicy: latestBundle.redactionPolicy,
              sensitivityLevel: latestBundle.sensitivityLevel
            }
          : null
      );
      const semanticFingerprint =
        meteringEvent.semanticFingerprint ||
        fingerprintModelIntent(turn.prompt);
      const cacheEligible = isSemanticCacheEligible({
        bundleExpiresAt: latestBundle?.expiresAt ?? null,
        mode: session.mode,
        now: startedDate,
        sensitivityLevel: latestBundle?.sensitivityLevel ?? null
      });
      const cacheKey = buildModelSemanticCacheKey({
        adapterAlias: session.adapterAlias,
        contextDigest,
        model,
        modelPolicyProfileId: session.modelPolicyProfileId,
        modelProviderId: routedProvider.modelProviderId,
        precisionMode: session.precisionMode,
        semanticFingerprint,
        sessionMode: session.mode
      });

      if (cacheEligible) {
        const cacheEntry = await prisma.modelSemanticCacheEntry.findUnique({
          where: {
            tenantId_cacheKey: { cacheKey, tenantId: turn.tenantId }
          }
        });
        if (cacheEntry && cacheEntry.expiresAt > startedDate) {
          const completedAt = new Date();
          await prisma.$transaction([
            prisma.modelSemanticCacheEntry.update({
              data: { hitCount: { increment: 1 }, lastHitAt: completedAt },
              where: {
                modelSemanticCacheEntryId: cacheEntry.modelSemanticCacheEntryId
              }
            }),
            prisma.modelUsageEvent.update({
              data: {
                assistantTextRedacted: cacheEntry.assistantTextRedacted,
                cacheDisposition: "Hit",
                completedAt,
                contextDigest,
                costMicrousd: 0n,
                latencyMs: completedAt.getTime() - startedAt,
                model,
                adapterAlias: session.adapterAlias,
                pricingStatus: "LocalCacheHit",
                queueWaitMs: Math.max(
                  0,
                  startedAt - meteringEvent.createdAt.getTime()
                ),
                responseStatus: "Completed",
                semanticFingerprint,
                sourceTurnId: cacheEntry.sourceTurnId,
                startedAt: startedDate,
                status: "Completed"
              },
              where: { modelUsageEventId: meteringEvent.modelUsageEventId }
            })
          ]);
          await writeModelGatewayAuditEvent(prisma, {
            eventType: "SemanticCacheHit",
            metadata: {
              cacheKeyPrefix: cacheKey.slice(0, 12),
              sourceTurnId: cacheEntry.sourceTurnId,
              turnId: turn.turnId
            },
            modelProviderId: routedProvider.modelProviderId,
            modelSessionId: session.modelSessionId,
            tenantId: turn.tenantId,
            userId: turn.userId
          });
          return {
            assistantText: cacheEntry.assistantTextRedacted,
            cacheDisposition: "Hit",
            iterations: 0,
            status: "Completed",
            toolCallsHandled: 0,
            usage: { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0 }
          };
        }
      }

      await prisma.modelUsageEvent.update({
        data: {
          cacheDisposition: cacheEligible ? "Miss" : "Ineligible",
          contextDigest,
          queueWaitMs: Math.max(
            0,
            startedAt - meteringEvent.createdAt.getTime()
          ),
          semanticFingerprint,
          startedAt: startedDate
        },
        where: { modelUsageEventId: meteringEvent.modelUsageEventId }
      });

      try {
        const result = await runModelGatewaySessionTurn({
          model,
          policyDeps: createGatewayPolicyDeps(),
          prisma,
          prompt: turn.prompt,
          provider: {
            authMethod: routedProvider.authMethod,
            credentialRef: routedProvider.credentialRef,
            endpointUrl: routedProvider.endpointUrl,
            providerType: routedProvider.providerType
          },
          session,
          toolDeps: createGatewayToolExecutionDeps(prisma, turn.tenantId),
          userId: turn.userId
        });

        const config = await prisma.modelGatewayFinOpsConfig.findUnique({
          where: { tenantId: turn.tenantId }
        });
        const pricing = (
          Array.isArray(config?.providerPricing) ? config.providerPricing : []
        )
          .map((row) => ModelProviderPricingSchema.safeParse(row))
          .filter(
            (row) =>
              row.success &&
              row.data.modelProviderId === routedProvider.modelProviderId &&
              (!row.data.model || row.data.model === model) &&
              (!row.data.adapterAlias ||
                row.data.adapterAlias === session.adapterAlias) &&
              (!row.data.precisionMode ||
                row.data.precisionMode === session.precisionMode)
          )
          .sort((left, right) => {
            if (!left.success || !right.success) return 0;
            const specificity = (row: typeof left.data) =>
              Number(Boolean(row.model)) +
              Number(Boolean(row.adapterAlias)) +
              Number(Boolean(row.precisionMode));
            return specificity(right.data) - specificity(left.data);
          })[0];
        const costMicrousd = pricing?.success
          ? calculateModelCostMicrousd(result.usage, pricing.data)
          : null;
        const assistantTextRedacted = redactModelTextForStorage(
          result.assistantText
        );
        const shouldStoreCache =
          cacheEligible &&
          result.status === "Completed" &&
          result.toolCallsHandled === 0 &&
          assistantTextRedacted.length > 0;
        const completedAt = new Date();
        const evidenceIds = [
          ...new Set(
            latestBundle?.items.flatMap((item) => item.evidenceIds) ?? []
          )
        ];
        await prisma.$transaction(async (tx) => {
          await tx.modelUsageEvent.update({
            data: {
              assistantTextRedacted,
              cacheDisposition: shouldStoreCache
                ? "Stored"
                : cacheEligible
                  ? "Miss"
                  : "Ineligible",
              cachedInputTokens: result.usage.cachedInputTokens,
              completedAt,
              costMicrousd,
              inputTokens: result.usage.inputTokens,
              iterations: result.iterations,
              latencyMs: completedAt.getTime() - startedAt,
              model,
              outputTokens: result.usage.outputTokens,
              pricingStatus: costMicrousd === null ? "Unpriced" : "Metered",
              responseStatus: result.status,
              status: result.status === "Completed" ? "Completed" : "Blocked",
              toolCallsHandled: result.toolCallsHandled
            },
            where: { modelUsageEventId: meteringEvent.modelUsageEventId }
          });
          if (shouldStoreCache) {
            await tx.modelSemanticCacheEntry.upsert({
              create: {
                adapterAlias: session.adapterAlias,
                assistantTextRedacted,
                cacheKey,
                contextDigest,
                evidenceIds,
                expiresAt: new Date(
                  completedAt.getTime() + semanticCacheTtlMs()
                ),
                model,
                modelPolicyProfileId: session.modelPolicyProfileId,
                modelProviderId: routedProvider.modelProviderId,
                precisionMode: session.precisionMode,
                semanticFingerprint,
                sessionMode: session.mode,
                sourceTurnId: turn.turnId,
                tenantId: turn.tenantId
              },
              update: {
                assistantTextRedacted,
                evidenceIds,
                expiresAt: new Date(
                  completedAt.getTime() + semanticCacheTtlMs()
                ),
                sourceTurnId: turn.turnId
              },
              where: {
                tenantId_cacheKey: { cacheKey, tenantId: turn.tenantId }
              }
            });
          }
        });

        if (shouldStoreCache) {
          await writeModelGatewayAuditEvent(prisma, {
            eventType: "SemanticCacheStored",
            evidenceIds,
            metadata: {
              cacheKeyPrefix: cacheKey.slice(0, 12),
              expiresAt: new Date(
                completedAt.getTime() + semanticCacheTtlMs()
              ).toISOString(),
              turnId: turn.turnId
            },
            modelProviderId: routedProvider.modelProviderId,
            modelSessionId: session.modelSessionId,
            tenantId: turn.tenantId,
            userId: turn.userId
          });
        }

        return {
          assistantText: assistantTextRedacted,
          cacheDisposition: shouldStoreCache
            ? "Stored"
            : cacheEligible
              ? "Miss"
              : "Ineligible",
          iterations: result.iterations,
          status: result.status,
          toolCallsHandled: result.toolCallsHandled,
          usage: result.usage
        };
      } catch (error) {
        await prisma.modelUsageEvent.update({
          data: {
            completedAt: new Date(),
            failureCategory: "ProviderTurnFailed",
            latencyMs: Date.now() - startedAt,
            model,
            status: "Failed"
          },
          where: { modelUsageEventId: meteringEvent.modelUsageEventId }
        });
        throw error;
      }
    }
  };
}
