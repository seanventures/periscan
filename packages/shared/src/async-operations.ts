import { z } from "zod";

const IdSchema = z.uuid();
const TimestampSchema = z.iso.datetime();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);

export const AsyncWorkloadKindSchema = z.enum(["ValidationJob", "RunnerTask"]);

export const AsyncOperationalStateSchema = z.enum([
  "OnTime",
  "WaitingTooLong",
  "Running",
  "Stalled",
  "TerminalSuccess",
  "TerminalFailure",
  "Cancelled"
]);

export const AsyncNextActionSchema = z.enum([
  "Monitor",
  "Reconcile",
  "PrepareRecovery",
  "RecordTerminalDecision",
  "None"
]);

export const AsyncOperationsHealthSchema = z.enum([
  "NotConfigured",
  "Healthy",
  "Attention",
  "Critical"
]);

export const AsyncOperationsPolicyInputSchema = z
  .object({
    escalationChannel: z.string().trim().min(3).max(500),
    queueAgeTargetSeconds: z.number().int().min(30).max(86_400),
    reviewReference: z.string().trim().min(3).max(500),
    runnerLeaseWarningSeconds: z.number().int().min(30).max(86_400),
    runningTimeoutSeconds: z.number().int().min(60).max(86_400),
    supportOwner: z.string().trim().min(2).max(200)
  })
  .strict();

export const AsyncOperationsPolicySchema =
  AsyncOperationsPolicyInputSchema.extend({
    createdAt: TimestampSchema,
    reviewedAt: TimestampSchema,
    reviewedBy: IdSchema,
    tenantId: IdSchema,
    updatedAt: TimestampSchema
  });

export const AsyncOperationsWorkItemSchema = z.object({
  ageSeconds: z.number().int().nonnegative(),
  attempts: z.number().int().nonnegative().nullable(),
  availableAt: TimestampSchema.nullable(),
  completedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  detail: z.string().min(1),
  errorSummary: z.string().nullable(),
  expiresAt: TimestampSchema.nullable(),
  missionId: IdSchema.nullable(),
  moduleId: z.string().nullable(),
  nextAction: AsyncNextActionSchema,
  operationalState: AsyncOperationalStateSchema,
  queueName: z.string().min(1),
  runId: IdSchema.nullable(),
  runnerId: IdSchema.nullable(),
  startedAt: TimestampSchema.nullable(),
  status: z.string().min(1),
  workloadId: IdSchema,
  workloadKind: AsyncWorkloadKindSchema
});

export const AsyncOperationsEventTypeSchema = z.enum([
  "PolicyConfigured",
  "Reconciled",
  "RecoveryPrepared",
  "TerminalAccepted"
]);

export const AsyncOperationsEventSchema = z.object({
  createdAt: TimestampSchema,
  createdBy: IdSchema,
  eventHash: Sha256Schema,
  eventId: IdSchema,
  eventType: AsyncOperationsEventTypeSchema,
  integrityVerified: z.boolean(),
  previousEventHash: Sha256Schema.nullable(),
  reason: z.string().min(1),
  recoveryMissionId: IdSchema.nullable(),
  reference: z.string().min(1),
  result: z.record(z.string(), z.unknown()),
  sequence: z.number().int().positive(),
  tenantId: IdSchema,
  workloadId: IdSchema.nullable(),
  workloadKind: AsyncWorkloadKindSchema.nullable()
});

export const AsyncOperationsSummarySchema = z.object({
  activeCount: z.number().int().nonnegative(),
  configured: z.boolean(),
  health: AsyncOperationsHealthSchema,
  oldestActiveAgeSeconds: z.number().int().nonnegative(),
  queuedCount: z.number().int().nonnegative(),
  recentSuccessCount: z.number().int().nonnegative(),
  runningCount: z.number().int().nonnegative(),
  stalledCount: z.number().int().nonnegative(),
  terminalFailureCount: z.number().int().nonnegative(),
  waitingTooLongCount: z.number().int().nonnegative()
});

export const AsyncOperationsWorkspaceSchema = z.object({
  events: z.array(AsyncOperationsEventSchema),
  generatedAt: TimestampSchema,
  limitations: z.array(z.string().min(1)).min(1),
  policy: AsyncOperationsPolicySchema.nullable(),
  summary: AsyncOperationsSummarySchema,
  workItems: z.array(AsyncOperationsWorkItemSchema)
});

export const AsyncOperationsReasonInputSchema = z
  .object({
    reason: z.string().trim().min(10).max(1_000),
    reference: z.string().trim().min(3).max(500)
  })
  .strict();

export const AsyncRecoveryDecisionInputSchema =
  AsyncOperationsReasonInputSchema.extend({
    decision: z.enum(["PrepareRecovery", "AcceptTerminal"]),
    workloadId: IdSchema,
    workloadKind: AsyncWorkloadKindSchema
  }).strict();

export const AsyncOperationsReconcileResultSchema = z.object({
  event: AsyncOperationsEventSchema,
  expiredRunnerTaskCount: z.number().int().nonnegative(),
  failedJobCount: z.number().int().nonnegative(),
  failedRunCount: z.number().int().nonnegative(),
  workspace: AsyncOperationsWorkspaceSchema
});

export const AsyncRecoveryDecisionResultSchema = z.object({
  event: AsyncOperationsEventSchema,
  recoveryMissionId: IdSchema.nullable(),
  workspace: AsyncOperationsWorkspaceSchema
});

export type AsyncWorkloadKind = z.infer<typeof AsyncWorkloadKindSchema>;
export type AsyncOperationsPolicyInput = z.infer<
  typeof AsyncOperationsPolicyInputSchema
>;
export type AsyncOperationsPolicy = z.infer<typeof AsyncOperationsPolicySchema>;
export type AsyncOperationsWorkItem = z.infer<
  typeof AsyncOperationsWorkItemSchema
>;
export type AsyncOperationsEvent = z.infer<typeof AsyncOperationsEventSchema>;
export type AsyncOperationsWorkspace = z.infer<
  typeof AsyncOperationsWorkspaceSchema
>;
export type AsyncOperationsReasonInput = z.infer<
  typeof AsyncOperationsReasonInputSchema
>;
export type AsyncRecoveryDecisionInput = z.infer<
  typeof AsyncRecoveryDecisionInputSchema
>;
export type AsyncOperationsReconcileResult = z.infer<
  typeof AsyncOperationsReconcileResultSchema
>;
export type AsyncRecoveryDecisionResult = z.infer<
  typeof AsyncRecoveryDecisionResultSchema
>;
