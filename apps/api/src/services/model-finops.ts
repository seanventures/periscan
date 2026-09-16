import type {
  ModelUsageEvent as PrismaModelUsageEvent,
  Prisma,
  PrismaClient
} from "@prisma/client";
import {
  evaluateModelBudget,
  fingerprintModelIntent,
  hashModelPrompt,
  redactModelTextForStorage,
  selectSafeModelProviderRoute
} from "@periscan/model-gateway";
import {
  ModelGatewayFinOpsConfigSchema,
  ModelGatewayFinOpsSummarySchema,
  ModelUsageEventSchema,
  type ModelGatewayFinOpsConfig,
  type ModelGatewayFinOpsSummary,
  type ModelUsageEvent,
  type UpdateModelGatewayFinOpsInput
} from "@periscan/shared";

import {
  AppServiceError,
  requireRole,
  TENANT_ADMIN_ROLES,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const DEFAULT_MONTHLY_LIMIT_MICROUSD = 100_000_000n;
const DEFAULT_PER_MINUTE_LIMIT = 60;
const DEFAULT_CONCURRENT_TURN_LIMIT = 4;

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function minuteStart(now = new Date()) {
  return new Date(now.getTime() - 60_000);
}

function serializeConfig(
  tenantId: string,
  record: {
    concurrentTurnLimit: number;
    enforcementEnabled: boolean;
    monthlyLimitMicrousd: bigint;
    perMinuteRequestLimit: number;
    priorityLaneEnabled: boolean;
    providerPricing: Prisma.JsonValue;
    routingProviderIds: string[];
    updatedAt: Date;
    updatedBy: string;
  } | null
): ModelGatewayFinOpsConfig {
  return ModelGatewayFinOpsConfigSchema.parse({
    concurrentTurnLimit:
      record?.concurrentTurnLimit ?? DEFAULT_CONCURRENT_TURN_LIMIT,
    enforcementEnabled: record?.enforcementEnabled ?? false,
    monthlyLimitMicrousd: (
      record?.monthlyLimitMicrousd ?? DEFAULT_MONTHLY_LIMIT_MICROUSD
    ).toString(),
    perMinuteRequestLimit:
      record?.perMinuteRequestLimit ?? DEFAULT_PER_MINUTE_LIMIT,
    priorityLaneEnabled: record?.priorityLaneEnabled ?? false,
    providerPricing: record?.providerPricing ?? [],
    routingProviderIds: record?.routingProviderIds ?? [],
    tenantId,
    updatedAt: record?.updatedAt.toISOString() ?? null,
    updatedBy: record?.updatedBy ?? null
  });
}

export function serializeModelUsageEvent(
  record: PrismaModelUsageEvent
): ModelUsageEvent {
  return ModelUsageEventSchema.parse({
    ...record,
    completedAt: record.completedAt?.toISOString() ?? null,
    costMicrousd: record.costMicrousd?.toString() ?? null,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null
  });
}

async function usageStats(
  prisma: PrismaClient | Prisma.TransactionClient,
  tenantId: string,
  now = new Date()
) {
  const [month, minute, unpriced, inFlight] = await Promise.all([
    prisma.modelUsageEvent.aggregate({
      _count: true,
      _sum: { costMicrousd: true },
      where: { createdAt: { gte: monthStart(now) }, tenantId }
    }),
    prisma.modelUsageEvent.count({
      where: { createdAt: { gte: minuteStart(now) }, tenantId }
    }),
    prisma.modelUsageEvent.count({
      where: {
        createdAt: { gte: monthStart(now) },
        pricingStatus: "Unpriced",
        status: { in: ["Completed", "Failed"] },
        tenantId
      }
    }),
    prisma.modelUsageEvent.count({
      where: { status: "Enqueued", tenantId }
    })
  ]);
  return {
    currentMinuteRequestCount: minute,
    currentInFlightRequestCount: inFlight,
    currentMonthCostMicrousd: month._sum.costMicrousd ?? 0n,
    currentMonthRequestCount: month._count,
    unpricedRequestCount: unpriced
  };
}

export async function reserveModelUsageTurn(input: {
  modelSessionId: string;
  prompt: string;
  queueLane: "Standard" | "Priority";
  prisma: PrismaClient;
  tenantId: string;
  turnId: string;
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await input.prisma.$transaction(
        async (tx) => {
          const [config, session, providers, stats] = await Promise.all([
            tx.modelGatewayFinOpsConfig.findUnique({
              where: { tenantId: input.tenantId }
            }),
            tx.modelSession.findFirst({
              select: {
                adapterAlias: true,
                modelProviderId: true,
                precisionMode: true
              },
              where: {
                modelSessionId: input.modelSessionId,
                tenantId: input.tenantId
              }
            }),
            tx.modelProvider.findMany({
              select: { modelProviderId: true, status: true },
              where: { tenantId: input.tenantId }
            }),
            usageStats(tx, input.tenantId)
          ]);
          if (!session) {
            throw new AppServiceError(
              "Model session not found for usage reservation.",
              404,
              "model_session_not_found"
            );
          }
          const budget = evaluateModelBudget({
            enforcementEnabled: config?.enforcementEnabled ?? false,
            minuteRequestCount: stats.currentMinuteRequestCount,
            monthlyCostMicrousd: stats.currentMonthCostMicrousd,
            monthlyLimitMicrousd:
              config?.monthlyLimitMicrousd ?? DEFAULT_MONTHLY_LIMIT_MICROUSD,
            perMinuteRequestLimit:
              config?.perMinuteRequestLimit ?? DEFAULT_PER_MINUTE_LIMIT
          });
          if (!budget.allowed) {
            throw new AppServiceError(
              budget.reason,
              429,
              "model_gateway_budget_exhausted"
            );
          }
          const concurrentTurnLimit =
            config?.concurrentTurnLimit ?? DEFAULT_CONCURRENT_TURN_LIMIT;
          if (stats.currentInFlightRequestCount >= concurrentTurnLimit) {
            throw new AppServiceError(
              `This tenant already has ${stats.currentInFlightRequestCount} model turn(s) in flight; the fair-share limit is ${concurrentTurnLimit}.`,
              429,
              "model_gateway_tenant_concurrency_exhausted"
            );
          }
          if (input.queueLane === "Priority" && !config?.priorityLaneEnabled) {
            throw new AppServiceError(
              "The priority model lane is not enabled for this tenant.",
              403,
              "model_gateway_priority_lane_disabled"
            );
          }
          const route = selectSafeModelProviderRoute({
            primaryProviderId: session.modelProviderId,
            providers,
            routingProviderIds: config?.routingProviderIds ?? []
          });
          if (!route) {
            throw new AppServiceError(
              "No active provider is available at the safe pre-turn routing checkpoint.",
              503,
              "model_gateway_no_provider_route"
            );
          }
          const event = await tx.modelUsageEvent.create({
            data: {
              adapterAlias: session.adapterAlias,
              modelProviderId: route.modelProviderId,
              modelSessionId: input.modelSessionId,
              promptHash: hashModelPrompt(input.prompt),
              promptRedacted: redactModelTextForStorage(input.prompt),
              precisionMode: session.precisionMode,
              queueLane: input.queueLane,
              routingReason: route.reason,
              semanticFingerprint: fingerprintModelIntent(input.prompt),
              tenantId: input.tenantId,
              turnId: input.turnId
            }
          });
          return {
            event: serializeModelUsageEvent(event),
            modelProviderId: route.modelProviderId,
            routingReason: route.reason
          };
        },
        { isolationLevel: "Serializable" }
      );
    } catch (error) {
      if (
        attempt < 2 &&
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2034"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unable to reserve model usage.");
}

export function createModelFinOpsServices(
  deps: RuntimeServiceDeps
): Pick<AppServices, "getModelGatewayFinOps" | "updateModelGatewayFinOps"> {
  const { prisma } = deps;
  return {
    async getModelGatewayFinOps(context) {
      const [config, stats, recentUsage] = await Promise.all([
        prisma.modelGatewayFinOpsConfig.findUnique({
          where: { tenantId: context.tenant.tenantId }
        }),
        usageStats(prisma, context.tenant.tenantId),
        prisma.modelUsageEvent.findMany({
          orderBy: { createdAt: "desc" },
          take: 100,
          where: { tenantId: context.tenant.tenantId }
        })
      ]);
      const limit =
        config?.monthlyLimitMicrousd ?? DEFAULT_MONTHLY_LIMIT_MICROUSD;
      const remaining =
        limit > stats.currentMonthCostMicrousd
          ? limit - stats.currentMonthCostMicrousd
          : 0n;
      return ModelGatewayFinOpsSummarySchema.parse({
        budgetRemainingMicrousd: remaining.toString(),
        config: serializeConfig(context.tenant.tenantId, config),
        currentMonthCostMicrousd: stats.currentMonthCostMicrousd.toString(),
        currentMonthRequestCount: stats.currentMonthRequestCount,
        currentMinuteRequestCount: stats.currentMinuteRequestCount,
        currentInFlightRequestCount: stats.currentInFlightRequestCount,
        decisionBasis: [
          "Periscan has no production-like utilization and billing evidence that justifies owning GPU infrastructure.",
          "The gateway already supports customer-managed and managed-provider endpoints with tenant policy controls.",
          "Budgets, routing, usage reconciliation, and trust evidence are prerequisites before any self-hosting decision is reopened."
        ],
        productionScaleClaimValidated: false,
        recentUsage: recentUsage.map(serializeModelUsageEvent),
        selfHostedInferenceImplemented: false,
        strategyDecision: "ManagedProviders",
        unpricedRequestCount: stats.unpricedRequestCount
      }) as ModelGatewayFinOpsSummary;
    },

    async updateModelGatewayFinOps(
      context,
      input: UpdateModelGatewayFinOpsInput
    ) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "configure model gateway budgets"
      );
      const referencedIds = [
        ...new Set([
          ...input.routingProviderIds,
          ...input.providerPricing.map((price) => price.modelProviderId)
        ])
      ];
      const providerCount = await prisma.modelProvider.count({
        where: {
          modelProviderId: { in: referencedIds },
          tenantId: context.tenant.tenantId
        }
      });
      if (providerCount !== referencedIds.length) {
        throw new AppServiceError(
          "Every routed or priced provider must belong to this tenant.",
          400,
          "model_finops_provider_not_found"
        );
      }
      await prisma.modelGatewayFinOpsConfig.upsert({
        create: {
          concurrentTurnLimit:
            input.concurrentTurnLimit ?? DEFAULT_CONCURRENT_TURN_LIMIT,
          enforcementEnabled: input.enforcementEnabled,
          monthlyLimitMicrousd: BigInt(input.monthlyLimitMicrousd),
          perMinuteRequestLimit: input.perMinuteRequestLimit,
          priorityLaneEnabled: input.priorityLaneEnabled ?? false,
          providerPricing: input.providerPricing,
          routingProviderIds: input.routingProviderIds,
          tenantId: context.tenant.tenantId,
          updatedBy: context.user.userId
        },
        update: {
          ...(input.concurrentTurnLimit !== undefined
            ? { concurrentTurnLimit: input.concurrentTurnLimit }
            : {}),
          enforcementEnabled: input.enforcementEnabled,
          monthlyLimitMicrousd: BigInt(input.monthlyLimitMicrousd),
          perMinuteRequestLimit: input.perMinuteRequestLimit,
          ...(input.priorityLaneEnabled !== undefined
            ? { priorityLaneEnabled: input.priorityLaneEnabled }
            : {}),
          providerPricing: input.providerPricing,
          routingProviderIds: input.routingProviderIds,
          updatedBy: context.user.userId
        },
        where: { tenantId: context.tenant.tenantId }
      });
      return this.getModelGatewayFinOps(context);
    }
  };
}
