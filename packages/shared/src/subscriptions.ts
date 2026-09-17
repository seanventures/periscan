import { z } from "zod";

import { BillingPackageKeySchema } from "./domain";

const TimestampSchema = z.iso.datetime();
const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/u);
const ReasonSchema = z.string().trim().min(10).max(1_000);
const ReferenceSchema = z.string().trim().min(3).max(500);

export const SubscriptionLifecycleStatusSchema = z.enum([
  "Active",
  "GracePeriod",
  "NonRenewing",
  "Ended"
]);
export const SubscriptionRenewalDecisionSchema = z.enum([
  "Unreviewed",
  "Approved",
  "Declined"
]);
export const SubscriptionPeriodStatusSchema = z.enum([
  "Scheduled",
  "Open",
  "Closed"
]);
export const SubscriptionEventActionSchema = z.enum([
  "Started",
  "RenewalApproved",
  "RenewalDeclined",
  "RenewalApplied",
  "GraceStarted",
  "GraceResolved",
  "CancellationScheduled",
  "CancellationRevoked",
  "Ended"
]);

export const CreateSubscriptionLifecycleInputSchema = z
  .object({
    agreementReference: ReferenceSchema,
    endsAt: TimestampSchema,
    packageKey: BillingPackageKeySchema,
    renewalLeadDays: z.number().int().min(7).max(180).default(60),
    source: z.literal("DirectAgreement"),
    supportOwnerEmail: z.email().max(320)
  })
  .strict();

export const RecordSubscriptionRenewalInputSchema = z.discriminatedUnion(
  "decision",
  [
    z
      .object({
        agreementReference: ReferenceSchema,
        decision: z.literal("Approve"),
        packageKey: BillingPackageKeySchema,
        reason: ReasonSchema,
        termMonths: z.number().int().min(1).max(36)
      })
      .strict(),
    z
      .object({
        decision: z.literal("Decline"),
        reason: ReasonSchema
      })
      .strict()
  ]
);

export const StartSubscriptionGraceInputSchema = z
  .object({
    externalReference: ReferenceSchema,
    graceDays: z.number().int().min(1).max(90),
    reason: ReasonSchema
  })
  .strict();

export const ResolveSubscriptionGraceInputSchema = z
  .object({
    reason: ReasonSchema,
    resolutionReference: ReferenceSchema
  })
  .strict();

export const ScheduleSubscriptionCancellationInputSchema = z
  .object({
    cancellationReference: ReferenceSchema,
    reason: ReasonSchema
  })
  .strict();

export const SubscriptionReasonInputSchema = z
  .object({ reason: ReasonSchema })
  .strict();

export const SubscriptionLifecycleSchema = z.object({
  agreementReference: z.string(),
  cancellationReason: z.string().nullable(),
  cancellationReference: z.string().nullable(),
  cancellationScheduledAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  createdBy: z.uuid(),
  endedAt: TimestampSchema.nullable(),
  graceEndsAt: TimestampSchema.nullable(),
  graceReference: z.string().nullable(),
  packageKey: BillingPackageKeySchema,
  renewalAgreementReference: z.string().nullable(),
  renewalDecision: SubscriptionRenewalDecisionSchema,
  renewalDecisionReason: z.string().nullable(),
  renewalLeadDays: z.number().int(),
  renewalPackageKey: BillingPackageKeySchema.nullable(),
  source: z.literal("DirectAgreement"),
  status: SubscriptionLifecycleStatusSchema,
  subscriptionLifecycleId: z.uuid(),
  supportOwnerEmail: z.email(),
  tenantId: z.uuid(),
  updatedAt: TimestampSchema,
  version: z.number().int().positive()
});

export const SubscriptionPeriodSchema = z.object({
  closedAt: TimestampSchema.nullable(),
  createdAt: TimestampSchema,
  endsAt: TimestampSchema,
  packageKey: BillingPackageKeySchema,
  sequence: z.number().int().positive(),
  startsAt: TimestampSchema,
  status: SubscriptionPeriodStatusSchema,
  subscriptionLifecycleId: z.uuid(),
  subscriptionPeriodId: z.uuid(),
  tenantId: z.uuid(),
  usageSnapshot: z.record(z.string(), z.unknown()).nullable()
});

export const SubscriptionEventSchema = z.object({
  action: SubscriptionEventActionSchema,
  createdAt: TimestampSchema,
  createdBy: z.uuid(),
  eventHash: Sha256Schema,
  metadata: z.record(z.string(), z.unknown()),
  nextStatus: SubscriptionLifecycleStatusSchema,
  previousEventHash: Sha256Schema.nullable(),
  previousStatus: SubscriptionLifecycleStatusSchema.nullable(),
  reason: z.string(),
  reference: z.string().nullable(),
  sequence: z.number().int().positive(),
  subscriptionEventId: z.uuid(),
  subscriptionLifecycleId: z.uuid(),
  tenantId: z.uuid()
});

export const SubscriptionRenewalCheckpointSchema = z.object({
  daysBeforeEnd: z.number().int().nonnegative(),
  dueAt: TimestampSchema,
  label: z.string(),
  state: z.enum(["Complete", "Upcoming", "Due", "Overdue"])
});

export const SubscriptionOperationsWorkspaceSchema = z.object({
  chainValid: z.boolean(),
  commercialBoundary: z.string(),
  currentPeriod: SubscriptionPeriodSchema.nullable(),
  daysRemaining: z.number().int(),
  events: z.array(SubscriptionEventSchema),
  generatedAt: TimestampSchema,
  nextAction: z.string(),
  paymentProcessorStatus: z.literal("NotConfigured"),
  periods: z.array(SubscriptionPeriodSchema),
  renewalCheckpoints: z.array(SubscriptionRenewalCheckpointSchema),
  subscription: SubscriptionLifecycleSchema.nullable()
});

export type CreateSubscriptionLifecycleInput = z.infer<
  typeof CreateSubscriptionLifecycleInputSchema
>;
export type RecordSubscriptionRenewalInput = z.infer<
  typeof RecordSubscriptionRenewalInputSchema
>;
export type ResolveSubscriptionGraceInput = z.infer<
  typeof ResolveSubscriptionGraceInputSchema
>;
export type ScheduleSubscriptionCancellationInput = z.infer<
  typeof ScheduleSubscriptionCancellationInputSchema
>;
export type StartSubscriptionGraceInput = z.infer<
  typeof StartSubscriptionGraceInputSchema
>;
export type SubscriptionEvent = z.infer<typeof SubscriptionEventSchema>;
export type SubscriptionLifecycle = z.infer<typeof SubscriptionLifecycleSchema>;
export type SubscriptionLifecycleStatus = z.infer<
  typeof SubscriptionLifecycleStatusSchema
>;
export type SubscriptionOperationsWorkspace = z.infer<
  typeof SubscriptionOperationsWorkspaceSchema
>;
export type SubscriptionPeriod = z.infer<typeof SubscriptionPeriodSchema>;
export type SubscriptionReasonInput = z.infer<
  typeof SubscriptionReasonInputSchema
>;
