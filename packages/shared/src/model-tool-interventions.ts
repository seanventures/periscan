import { z } from "zod";

const IdSchema = z.uuid();
const TimestampSchema = z.iso.datetime();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const ModelToolInterventionStatusSchema = z.enum([
  "Pending",
  "Resumed",
  "Cancelled",
  "Expired",
  "Superseded"
]);

export const ModelToolInterventionTransportSchema = z.enum([
  "CopyLink",
  "Slack",
  "Teams",
  "Other"
]);

export const ModelToolInterventionDecisionSchema = z.enum(["Resume", "Cancel"]);

export const IssueModelToolInterventionInputSchema = z
  .object({
    expiresInMinutes: z.number().int().min(5).max(60).default(15),
    transport: ModelToolInterventionTransportSchema.default("CopyLink")
  })
  .strict();

export const InspectModelToolInterventionInputSchema = z
  .object({
    token: z.string().min(80).max(4_096)
  })
  .strict();

export const DecideModelToolInterventionInputSchema =
  InspectModelToolInterventionInputSchema.extend({
    decision: ModelToolInterventionDecisionSchema,
    reason: z.string().trim().min(10).max(1_000),
    reviewReference: z.string().trim().min(3).max(500)
  }).strict();

export const ModelToolInterventionSchema = z.object({
  decision: ModelToolInterventionDecisionSchema.nullable(),
  decisionAt: TimestampSchema.nullable(),
  decisionBy: IdSchema.nullable(),
  decisionReason: z.string().nullable(),
  envelopeHash: Sha256Schema,
  expiresAt: TimestampSchema,
  inputPayloadHash: Sha256Schema,
  interventionId: IdSchema,
  issuedAt: TimestampSchema,
  issuedBy: IdSchema,
  modelSessionId: IdSchema,
  policyDecisionId: IdSchema.nullable(),
  policyProfileName: z.string().min(1),
  requestReason: z.string().min(1),
  reviewReference: z.string().nullable(),
  scopeIds: z.array(IdSchema),
  sessionMode: z.string().min(1),
  sessionPurpose: z.string().min(1),
  status: ModelToolInterventionStatusSchema,
  tenantId: IdSchema,
  tokenFingerprint: Sha256Schema,
  toolName: z.string().min(1),
  toolRequestId: IdSchema,
  transport: ModelToolInterventionTransportSchema
});

export const ModelToolInterventionQueueItemSchema = z.object({
  createdAt: TimestampSchema,
  inputPayloadHash: Sha256Schema,
  intervention: ModelToolInterventionSchema.nullable(),
  modelSessionId: IdSchema,
  policyDecisionId: IdSchema.nullable(),
  policyProfileName: z.string().min(1),
  requestReason: z.string().min(1),
  scopeIds: z.array(IdSchema),
  sessionMode: z.string().min(1),
  sessionPurpose: z.string().min(1),
  status: z.string().min(1),
  toolName: z.string().min(1),
  toolRequestId: IdSchema
});

export const ModelToolInterventionQueueSchema = z.object({
  generatedAt: TimestampSchema,
  items: z.array(ModelToolInterventionQueueItemSchema),
  limitations: z.array(z.string().min(1)).min(1),
  pendingCount: z.number().int().nonnegative(),
  reviewLinkCount: z.number().int().nonnegative()
});

export const IssueModelToolInterventionResultSchema = z.object({
  intervention: ModelToolInterventionSchema,
  rawTokenStored: z.literal(false),
  reviewUrl: z.url()
});

export const ModelToolInterventionDecisionResultSchema = z.object({
  intervention: ModelToolInterventionSchema,
  requestStatus: z.enum(["Approved", "Cancelled"])
});

export type ModelToolInterventionStatus = z.infer<
  typeof ModelToolInterventionStatusSchema
>;
export type ModelToolInterventionTransport = z.infer<
  typeof ModelToolInterventionTransportSchema
>;
export type ModelToolInterventionDecision = z.infer<
  typeof ModelToolInterventionDecisionSchema
>;
export type IssueModelToolInterventionInput = z.infer<
  typeof IssueModelToolInterventionInputSchema
>;
export type InspectModelToolInterventionInput = z.infer<
  typeof InspectModelToolInterventionInputSchema
>;
export type DecideModelToolInterventionInput = z.infer<
  typeof DecideModelToolInterventionInputSchema
>;
export type ModelToolIntervention = z.infer<typeof ModelToolInterventionSchema>;
export type ModelToolInterventionQueueItem = z.infer<
  typeof ModelToolInterventionQueueItemSchema
>;
export type ModelToolInterventionQueue = z.infer<
  typeof ModelToolInterventionQueueSchema
>;
export type IssueModelToolInterventionResult = z.infer<
  typeof IssueModelToolInterventionResultSchema
>;
export type ModelToolInterventionDecisionResult = z.infer<
  typeof ModelToolInterventionDecisionResultSchema
>;
