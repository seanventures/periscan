import { z } from "zod";

export const ModelProviderPricingSchema = z
  .object({
    adapterAlias: z.string().min(1).max(160).nullish(),
    cachedInputMicrousdPerMillion: z
      .number()
      .int()
      .nonnegative()
      .max(1_000_000_000),
    inputMicrousdPerMillion: z.number().int().nonnegative().max(1_000_000_000),
    model: z.string().min(1).max(512).nullish(),
    modelProviderId: z.uuid(),
    outputMicrousdPerMillion: z.number().int().nonnegative().max(1_000_000_000),
    precisionMode: z.string().min(1).max(64).nullish()
  })
  .strict();

export const UpdateModelGatewayFinOpsInputSchema = z
  .object({
    concurrentTurnLimit: z.number().int().min(1).max(1_000).optional(),
    enforcementEnabled: z.boolean(),
    monthlyLimitMicrousd: z.number().int().min(100_000).max(1_000_000_000_000),
    perMinuteRequestLimit: z.number().int().min(1).max(10_000),
    priorityLaneEnabled: z.boolean().optional(),
    providerPricing: z.array(ModelProviderPricingSchema).max(100),
    routingProviderIds: z.array(z.uuid()).max(20)
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.routingProviderIds).size !== value.routingProviderIds.length
    ) {
      context.addIssue({
        code: "custom",
        message: "Routing provider IDs must be unique.",
        path: ["routingProviderIds"]
      });
    }
    const pricingIds = value.providerPricing.map(
      (price) =>
        `${price.modelProviderId}:${price.model ?? "*"}:${price.adapterAlias ?? "*"}:${price.precisionMode ?? "*"}`
    );
    if (new Set(pricingIds).size !== pricingIds.length) {
      context.addIssue({
        code: "custom",
        message: "Provider pricing rows must be unique.",
        path: ["providerPricing"]
      });
    }
  });

export const ModelGatewayFinOpsConfigSchema = z.object({
  concurrentTurnLimit: z.number().int().positive(),
  enforcementEnabled: z.boolean(),
  monthlyLimitMicrousd: z.string().regex(/^\d+$/u),
  perMinuteRequestLimit: z.number().int().positive(),
  priorityLaneEnabled: z.boolean(),
  providerPricing: z.array(ModelProviderPricingSchema),
  routingProviderIds: z.array(z.uuid()),
  tenantId: z.uuid(),
  updatedAt: z.iso.datetime().nullable(),
  updatedBy: z.uuid().nullable()
});

export const ModelUsageEventSchema = z.object({
  adapterAlias: z.string().nullable(),
  assistantTextRedacted: z.string().nullable(),
  cacheDisposition: z.enum(["Ineligible", "Miss", "Hit", "Stored"]),
  cachedInputTokens: z.number().int().nonnegative(),
  completedAt: z.iso.datetime().nullable(),
  contextDigest: z.string(),
  costMicrousd: z.string().regex(/^\d+$/u).nullable(),
  createdAt: z.iso.datetime(),
  failureCategory: z.string().nullable(),
  inputTokens: z.number().int().nonnegative(),
  iterations: z.number().int().nonnegative(),
  latencyMs: z.number().int().nonnegative().nullable(),
  queueLane: z.enum(["Standard", "Priority"]),
  queueWaitMs: z.number().int().nonnegative().nullable(),
  model: z.string().nullable(),
  modelProviderId: z.uuid(),
  modelSessionId: z.uuid(),
  modelUsageEventId: z.uuid(),
  outputTokens: z.number().int().nonnegative(),
  pricingStatus: z.enum(["LocalCacheHit", "Metered", "Unpriced"]),
  precisionMode: z.enum([
    "ProviderManaged",
    "FP32",
    "TF32",
    "BF16",
    "FP16",
    "INT8",
    "INT4"
  ]),
  promptHash: z.string(),
  promptRedacted: z.string().nullable(),
  responseStatus: z.enum(["Completed", "Blocked", "Aborted"]).nullable(),
  routingReason: z.string(),
  semanticFingerprint: z.string(),
  sourceTurnId: z.uuid().nullable(),
  startedAt: z.iso.datetime().nullable(),
  status: z.enum(["Enqueued", "Completed", "Failed", "Blocked"]),
  tenantId: z.uuid(),
  toolCallsHandled: z.number().int().nonnegative(),
  turnId: z.uuid()
});

export const ModelGatewayFinOpsSummarySchema = z.object({
  budgetRemainingMicrousd: z.string().regex(/^\d+$/u).nullable(),
  config: ModelGatewayFinOpsConfigSchema,
  currentMonthCostMicrousd: z.string().regex(/^\d+$/u),
  currentMonthRequestCount: z.number().int().nonnegative(),
  currentMinuteRequestCount: z.number().int().nonnegative(),
  currentInFlightRequestCount: z.number().int().nonnegative(),
  decisionBasis: z.array(z.string()),
  productionScaleClaimValidated: z.literal(false),
  recentUsage: z.array(ModelUsageEventSchema),
  selfHostedInferenceImplemented: z.literal(false),
  strategyDecision: z.literal("ManagedProviders"),
  unpricedRequestCount: z.number().int().nonnegative()
});

export type ModelProviderPricing = z.infer<typeof ModelProviderPricingSchema>;
export type UpdateModelGatewayFinOpsInput = z.infer<
  typeof UpdateModelGatewayFinOpsInputSchema
>;
export type ModelGatewayFinOpsConfig = z.infer<
  typeof ModelGatewayFinOpsConfigSchema
>;
export type ModelUsageEvent = z.infer<typeof ModelUsageEventSchema>;
export type ModelGatewayFinOpsSummary = z.infer<
  typeof ModelGatewayFinOpsSummarySchema
>;
