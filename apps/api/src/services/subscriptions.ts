import { createHash } from "node:crypto";

import {
  Prisma,
  type PrismaClient,
  type SubscriptionLifecycleStatus,
  type SubscriptionLifecycleEventAction
} from "@prisma/client";
import {
  SubscriptionEventSchema,
  SubscriptionLifecycleSchema,
  SubscriptionOperationsWorkspaceSchema,
  SubscriptionPeriodSchema,
  type BillingUsage,
  type MembershipRole,
  type SubscriptionEvent,
  type SubscriptionLifecycle,
  type SubscriptionOperationsWorkspace,
  type SubscriptionPeriod
} from "@periscan/shared";

import {
  AppServiceError,
  buildBillingUsage,
  requireRole,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

const DAY_MS = 24 * 60 * 60 * 1_000;
const MINIMUM_TERM_MS = 7 * DAY_MS;
const MAXIMUM_TERM_MS = 730 * DAY_MS;
const SUBSCRIPTION_ADMIN_ROLES = new Set<MembershipRole>([
  "Owner",
  "Admin",
  "MSSPOwner",
  "ClientAdmin"
]);

type SubscriptionServices = Pick<
  AppServices,
  | "createSubscriptionLifecycle"
  | "getSubscriptionOperationsWorkspace"
  | "reconcileSubscriptionLifecycle"
  | "recordSubscriptionRenewal"
  | "resolveSubscriptionGrace"
  | "revokeSubscriptionCancellation"
  | "scheduleSubscriptionCancellation"
  | "startSubscriptionGrace"
>;

type LifecycleRecord = Awaited<
  ReturnType<PrismaClient["subscriptionLifecycle"]["findFirst"]>
>;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)])
    );
  }
  return value;
}

function hashEvent(input: Record<string, unknown>) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(input)))
    .digest("hex");
}

function serializeLifecycle(
  record: NonNullable<LifecycleRecord>
): SubscriptionLifecycle {
  return SubscriptionLifecycleSchema.parse({
    ...record,
    cancellationScheduledAt:
      record.cancellationScheduledAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    endedAt: record.endedAt?.toISOString() ?? null,
    graceEndsAt: record.graceEndsAt?.toISOString() ?? null,
    updatedAt: record.updatedAt.toISOString()
  });
}

function serializePeriod(record: {
  closedAt: Date | null;
  createdAt: Date;
  endsAt: Date;
  packageKey: string;
  sequence: number;
  startsAt: Date;
  status: string;
  subscriptionLifecycleId: string;
  subscriptionPeriodId: string;
  tenantId: string;
  usageSnapshot: Prisma.JsonValue | null;
}): SubscriptionPeriod {
  return SubscriptionPeriodSchema.parse({
    ...record,
    closedAt: record.closedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    endsAt: record.endsAt.toISOString(),
    startsAt: record.startsAt.toISOString(),
    usageSnapshot: record.usageSnapshot
  });
}

function serializeEvent(record: {
  action: string;
  createdAt: Date;
  createdBy: string;
  eventHash: string;
  metadata: Prisma.JsonValue;
  nextStatus: string;
  previousEventHash: string | null;
  previousStatus: string | null;
  reason: string;
  reference: string | null;
  sequence: number;
  subscriptionEventId: string;
  subscriptionLifecycleId: string;
  tenantId: string;
}): SubscriptionEvent {
  return SubscriptionEventSchema.parse({
    ...record,
    createdAt: record.createdAt.toISOString(),
    metadata: record.metadata
  });
}

async function appendLifecycleEvent(
  tx: Prisma.TransactionClient,
  input: {
    action: SubscriptionLifecycleEventAction;
    createdBy: string;
    metadata?: Record<string, unknown>;
    nextStatus: SubscriptionLifecycleStatus;
    previousStatus: SubscriptionLifecycleStatus | null;
    reason: string;
    reference?: string | null;
    subscriptionLifecycleId: string;
    tenantId: string;
  }
) {
  const previous = await tx.subscriptionLifecycleEvent.findFirst({
    orderBy: { sequence: "desc" },
    where: { subscriptionLifecycleId: input.subscriptionLifecycleId }
  });
  const createdAt = new Date();
  const metadata = input.metadata ?? {};
  const sequence = (previous?.sequence ?? 0) + 1;
  const hashInput = {
    action: input.action,
    createdAt: createdAt.toISOString(),
    createdBy: input.createdBy,
    metadata,
    nextStatus: input.nextStatus,
    previousEventHash: previous?.eventHash ?? null,
    previousStatus: input.previousStatus,
    reason: input.reason,
    reference: input.reference ?? null,
    sequence,
    subscriptionLifecycleId: input.subscriptionLifecycleId,
    tenantId: input.tenantId
  };
  return tx.subscriptionLifecycleEvent.create({
    data: {
      ...hashInput,
      createdAt,
      eventHash: hashEvent(hashInput),
      metadata: metadata as Prisma.InputJsonValue
    }
  });
}

function verifyEventChain(events: SubscriptionEvent[]) {
  let previousHash: string | null = null;
  for (const event of events) {
    if (event.previousEventHash !== previousHash) return false;
    const expected = hashEvent({
      action: event.action,
      createdAt: event.createdAt,
      createdBy: event.createdBy,
      metadata: event.metadata,
      nextStatus: event.nextStatus,
      previousEventHash: event.previousEventHash,
      previousStatus: event.previousStatus,
      reason: event.reason,
      reference: event.reference,
      sequence: event.sequence,
      subscriptionLifecycleId: event.subscriptionLifecycleId,
      tenantId: event.tenantId
    });
    if (expected !== event.eventHash) return false;
    previousHash = event.eventHash;
  }
  return true;
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function buildNextAction(
  lifecycle: SubscriptionLifecycle,
  currentPeriod: SubscriptionPeriod | null,
  now: Date
) {
  if (lifecycle.status === "Ended") {
    return "The subscription ended; create a new reviewed agreement before restoring entitlements.";
  }
  if (lifecycle.status === "GracePeriod") {
    return lifecycle.graceEndsAt && new Date(lifecycle.graceEndsAt) <= now
      ? "Grace expired. Resolve the commercial exception or reconcile the subscription to end access."
      : "Resolve the grace exception before its recorded deadline.";
  }
  if (lifecycle.renewalDecision === "Approved") {
    const due = currentPeriod && new Date(currentPeriod.endsAt) <= now;
    return due
      ? "Apply the approved renewal and close the completed usage period."
      : "Renewal is approved and scheduled for the current term boundary.";
  }
  if (lifecycle.status === "NonRenewing") {
    return "Access remains active through the current term; revoke cancellation or reconcile after the end date.";
  }
  if (
    currentPeriod &&
    new Date(currentPeriod.endsAt).getTime() - now.getTime() <=
      lifecycle.renewalLeadDays * DAY_MS
  ) {
    return "Record an approved renewal or a non-renewal decision.";
  }
  return "Monitor usage and prepare the renewal decision before the lead window.";
}

async function loadWorkspace(
  prisma: PrismaClient,
  tenantId: string,
  now = new Date()
): Promise<SubscriptionOperationsWorkspace> {
  const record = await prisma.subscriptionLifecycle.findFirst({
    include: {
      events: { orderBy: { sequence: "asc" } },
      periods: { orderBy: { sequence: "desc" } }
    },
    where: { tenantId }
  });
  if (!record) {
    return SubscriptionOperationsWorkspaceSchema.parse({
      chainValid: true,
      commercialBoundary:
        "Payment processing, tax, invoicing, and procurement remain outside Periscan until a reviewed provider is configured.",
      currentPeriod: null,
      daysRemaining: 0,
      events: [],
      generatedAt: now.toISOString(),
      nextAction: "Create a reviewed direct-agreement lifecycle.",
      paymentProcessorStatus: "NotConfigured",
      periods: [],
      renewalCheckpoints: [],
      subscription: null
    });
  }
  const lifecycle = serializeLifecycle(record);
  const periods = record.periods.map(serializePeriod);
  const events = record.events.map(serializeEvent);
  const currentPeriod =
    periods.find((period) => period.status === "Open") ?? null;
  const daysRemaining = currentPeriod
    ? Math.ceil(
        (new Date(currentPeriod.endsAt).getTime() - now.getTime()) / DAY_MS
      )
    : 0;
  const offsets = [...new Set([lifecycle.renewalLeadDays, 30, 7, 0])].sort(
    (left, right) => right - left
  );
  const renewalCheckpoints = currentPeriod
    ? offsets.map((daysBeforeEnd) => {
        const dueAt = new Date(
          new Date(currentPeriod.endsAt).getTime() - daysBeforeEnd * DAY_MS
        );
        const decided = lifecycle.renewalDecision !== "Unreviewed";
        return {
          daysBeforeEnd,
          dueAt: dueAt.toISOString(),
          label:
            daysBeforeEnd === 0
              ? "Term boundary"
              : `${daysBeforeEnd}-day review`,
          state: decided
            ? "Complete"
            : now > new Date(currentPeriod.endsAt)
              ? "Overdue"
              : now >= dueAt
                ? "Due"
                : "Upcoming"
        };
      })
    : [];
  return SubscriptionOperationsWorkspaceSchema.parse({
    chainValid: verifyEventChain(events),
    commercialBoundary:
      "Periscan records approved entitlement terms and usage evidence; it does not charge cards, calculate tax, issue invoices, or attest procurement settlement.",
    currentPeriod,
    daysRemaining,
    events,
    generatedAt: now.toISOString(),
    nextAction: buildNextAction(lifecycle, currentPeriod, now),
    paymentProcessorStatus: "NotConfigured",
    periods,
    renewalCheckpoints,
    subscription: lifecycle
  });
}

async function loadLifecycleForMutation(
  tx: Prisma.TransactionClient,
  tenantId: string
) {
  const lifecycle = await tx.subscriptionLifecycle.findFirst({
    include: { periods: { orderBy: { sequence: "asc" } } },
    where: { tenantId }
  });
  if (!lifecycle) {
    throw new AppServiceError(
      "Subscription lifecycle not found.",
      404,
      "subscription_lifecycle_not_found"
    );
  }
  if (lifecycle.status === "Ended") {
    throw new AppServiceError(
      "The subscription lifecycle has ended and is immutable.",
      409,
      "subscription_lifecycle_ended"
    );
  }
  const current = lifecycle.periods.find((period) => period.status === "Open");
  if (!current) {
    throw new AppServiceError(
      "The subscription has no open period.",
      409,
      "subscription_period_missing"
    );
  }
  return { current, lifecycle };
}

async function usageForPeriod(
  prisma: PrismaClient,
  tenantId: string,
  startsAt: Date,
  endsAt: Date
): Promise<BillingUsage> {
  const tenant = await prisma.tenant.findUnique({ where: { tenantId } });
  if (!tenant) {
    throw new AppServiceError("Tenant not found.", 404, "tenant_not_found");
  }
  return buildBillingUsage(prisma, tenant, {
    meteringPeriodEnd: endsAt,
    meteringPeriodStart: startsAt
  });
}

export function createSubscriptionServices(
  deps: RuntimeServiceDeps
): SubscriptionServices {
  const { prisma } = deps;

  return {
    async getSubscriptionOperationsWorkspace(context) {
      requireRole(
        context.membership.role,
        SUBSCRIPTION_ADMIN_ROLES,
        "view subscription operations"
      );
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async createSubscriptionLifecycle(context, input) {
      requireRole(
        context.membership.role,
        SUBSCRIPTION_ADMIN_ROLES,
        "create subscription lifecycles"
      );
      const now = new Date();
      const endsAt = new Date(input.endsAt);
      const duration = endsAt.getTime() - now.getTime();
      if (duration < MINIMUM_TERM_MS || duration > MAXIMUM_TERM_MS) {
        throw new AppServiceError(
          "The initial subscription term must end between 7 and 730 days from now.",
          400,
          "subscription_term_invalid"
        );
      }
      await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
          select: { trialStatus: true },
          where: { tenantId: context.tenant.tenantId }
        });
        if (!tenant) {
          throw new AppServiceError(
            "Tenant not found.",
            404,
            "tenant_not_found"
          );
        }
        if (tenant.trialStatus === "Active") {
          throw new AppServiceError(
            "Convert or cancel the active trial before creating a continuous subscription.",
            409,
            "subscription_trial_active"
          );
        }
        const existing = await tx.subscriptionLifecycle.findUnique({
          where: { tenantId: context.tenant.tenantId }
        });
        if (existing) {
          throw new AppServiceError(
            "This tenant already has a subscription lifecycle.",
            409,
            "subscription_lifecycle_exists"
          );
        }
        const lifecycle = await tx.subscriptionLifecycle.create({
          data: {
            agreementReference: input.agreementReference,
            createdBy: context.user.userId,
            packageKey: input.packageKey,
            renewalLeadDays: input.renewalLeadDays,
            source: input.source,
            supportOwnerEmail: input.supportOwnerEmail,
            tenantId: context.tenant.tenantId
          }
        });
        await tx.subscriptionPeriod.create({
          data: {
            endsAt,
            packageKey: input.packageKey,
            sequence: 1,
            startsAt: now,
            status: "Open",
            subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
            tenantId: context.tenant.tenantId
          }
        });
        await tx.tenant.update({
          data: { billingPackageKey: input.packageKey },
          where: { tenantId: context.tenant.tenantId }
        });
        await appendLifecycleEvent(tx, {
          action: "Started",
          createdBy: context.user.userId,
          metadata: {
            endsAt: endsAt.toISOString(),
            packageKey: input.packageKey,
            paymentProcessorStatus: "NotConfigured",
            renewalLeadDays: input.renewalLeadDays
          },
          nextStatus: "Active",
          previousStatus: null,
          reason:
            "Reviewed direct agreement recorded for continuous entitlement operations.",
          reference: input.agreementReference,
          subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
          tenantId: context.tenant.tenantId
        });
        await writeAuditEvent(tx, {
          action: "subscription.started",
          actorType: "User",
          entityId: lifecycle.subscriptionLifecycleId,
          entityType: "Tenant",
          metadata: {
            endsAt: endsAt.toISOString(),
            packageKey: input.packageKey,
            paymentProcessorStatus: "NotConfigured"
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadWorkspace(prisma, context.tenant.tenantId, now);
    },

    async recordSubscriptionRenewal(context, input) {
      requireRole(
        context.membership.role,
        SUBSCRIPTION_ADMIN_ROLES,
        "record subscription renewal decisions"
      );
      await prisma.$transaction(async (tx) => {
        const { current, lifecycle } = await loadLifecycleForMutation(
          tx,
          context.tenant.tenantId
        );
        if (lifecycle.status === "GracePeriod") {
          throw new AppServiceError(
            "Resolve the active grace exception before changing the renewal decision.",
            409,
            "subscription_grace_active"
          );
        }
        const nextSequence = current.sequence + 1;
        const nextStatus =
          input.decision === "Approve" ? "Active" : "NonRenewing";
        if (input.decision === "Approve") {
          const nextEnd = addMonths(current.endsAt, input.termMonths);
          await tx.subscriptionPeriod.upsert({
            create: {
              endsAt: nextEnd,
              packageKey: input.packageKey,
              sequence: nextSequence,
              startsAt: current.endsAt,
              status: "Scheduled",
              subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
              tenantId: context.tenant.tenantId
            },
            update: {
              closedAt: null,
              closedBy: null,
              endsAt: nextEnd,
              packageKey: input.packageKey,
              startsAt: current.endsAt,
              status: "Scheduled",
              usageSnapshot: Prisma.DbNull
            },
            where: {
              subscriptionLifecycleId_sequence: {
                sequence: nextSequence,
                subscriptionLifecycleId: lifecycle.subscriptionLifecycleId
              }
            }
          });
          await tx.subscriptionLifecycle.update({
            data: {
              cancellationReason: null,
              cancellationReference: null,
              cancellationScheduledAt: null,
              renewalAgreementReference: input.agreementReference,
              renewalDecision: "Approved",
              renewalDecisionReason: input.reason,
              renewalPackageKey: input.packageKey,
              status: "Active",
              version: { increment: 1 }
            },
            where: {
              subscriptionLifecycleId: lifecycle.subscriptionLifecycleId
            }
          });
        } else {
          await tx.subscriptionPeriod.deleteMany({
            where: {
              status: "Scheduled",
              subscriptionLifecycleId: lifecycle.subscriptionLifecycleId
            }
          });
          await tx.subscriptionLifecycle.update({
            data: {
              renewalAgreementReference: null,
              renewalDecision: "Declined",
              renewalDecisionReason: input.reason,
              renewalPackageKey: null,
              status: "NonRenewing",
              version: { increment: 1 }
            },
            where: {
              subscriptionLifecycleId: lifecycle.subscriptionLifecycleId
            }
          });
        }
        await appendLifecycleEvent(tx, {
          action:
            input.decision === "Approve"
              ? "RenewalApproved"
              : "RenewalDeclined",
          createdBy: context.user.userId,
          metadata:
            input.decision === "Approve"
              ? {
                  nextPackageKey: input.packageKey,
                  nextPeriodEndsAt: addMonths(
                    current.endsAt,
                    input.termMonths
                  ).toISOString(),
                  termMonths: input.termMonths
                }
              : { entitlementEndsAt: current.endsAt.toISOString() },
          nextStatus,
          previousStatus: lifecycle.status,
          reason: input.reason,
          reference:
            input.decision === "Approve" ? input.agreementReference : null,
          subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
          tenantId: context.tenant.tenantId
        });
        await writeAuditEvent(tx, {
          action: "subscription.renewal_decided",
          actorType: "User",
          entityId: lifecycle.subscriptionLifecycleId,
          entityType: "Tenant",
          metadata: {
            decision: input.decision,
            nextStatus,
            paymentProcessorStatus: "NotConfigured"
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async startSubscriptionGrace(context, input) {
      requireRole(
        context.membership.role,
        SUBSCRIPTION_ADMIN_ROLES,
        "start subscription grace periods"
      );
      const now = new Date();
      await prisma.$transaction(async (tx) => {
        const { lifecycle } = await loadLifecycleForMutation(
          tx,
          context.tenant.tenantId
        );
        if (lifecycle.status === "GracePeriod") {
          throw new AppServiceError(
            "A grace exception is already active.",
            409,
            "subscription_grace_exists"
          );
        }
        const graceEndsAt = new Date(now.getTime() + input.graceDays * DAY_MS);
        await tx.subscriptionLifecycle.update({
          data: {
            graceEndsAt,
            graceReference: input.externalReference,
            status: "GracePeriod",
            version: { increment: 1 }
          },
          where: { subscriptionLifecycleId: lifecycle.subscriptionLifecycleId }
        });
        await appendLifecycleEvent(tx, {
          action: "GraceStarted",
          createdBy: context.user.userId,
          metadata: {
            entitlementsPreserved: true,
            graceDays: input.graceDays,
            graceEndsAt: graceEndsAt.toISOString()
          },
          nextStatus: "GracePeriod",
          previousStatus: lifecycle.status,
          reason: input.reason,
          reference: input.externalReference,
          subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
          tenantId: context.tenant.tenantId
        });
        await writeAuditEvent(tx, {
          action: "subscription.grace_started",
          actorType: "User",
          entityId: lifecycle.subscriptionLifecycleId,
          entityType: "Tenant",
          metadata: { graceEndsAt: graceEndsAt.toISOString() },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadWorkspace(prisma, context.tenant.tenantId, now);
    },

    async resolveSubscriptionGrace(context, input) {
      requireRole(
        context.membership.role,
        SUBSCRIPTION_ADMIN_ROLES,
        "resolve subscription grace periods"
      );
      await prisma.$transaction(async (tx) => {
        const { lifecycle } = await loadLifecycleForMutation(
          tx,
          context.tenant.tenantId
        );
        if (lifecycle.status !== "GracePeriod") {
          throw new AppServiceError(
            "No subscription grace exception is active.",
            409,
            "subscription_grace_not_active"
          );
        }
        const nextStatus =
          lifecycle.cancellationScheduledAt ||
          lifecycle.renewalDecision === "Declined"
            ? "NonRenewing"
            : "Active";
        await tx.subscriptionLifecycle.update({
          data: {
            graceEndsAt: null,
            graceReference: null,
            status: nextStatus,
            version: { increment: 1 }
          },
          where: { subscriptionLifecycleId: lifecycle.subscriptionLifecycleId }
        });
        await appendLifecycleEvent(tx, {
          action: "GraceResolved",
          createdBy: context.user.userId,
          metadata: { entitlementsPreserved: true },
          nextStatus,
          previousStatus: lifecycle.status,
          reason: input.reason,
          reference: input.resolutionReference,
          subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
          tenantId: context.tenant.tenantId
        });
        await writeAuditEvent(tx, {
          action: "subscription.grace_resolved",
          actorType: "User",
          entityId: lifecycle.subscriptionLifecycleId,
          entityType: "Tenant",
          metadata: { nextStatus },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async scheduleSubscriptionCancellation(context, input) {
      requireRole(
        context.membership.role,
        SUBSCRIPTION_ADMIN_ROLES,
        "schedule subscription cancellation"
      );
      await prisma.$transaction(async (tx) => {
        const { current, lifecycle } = await loadLifecycleForMutation(
          tx,
          context.tenant.tenantId
        );
        if (lifecycle.status === "GracePeriod") {
          throw new AppServiceError(
            "Resolve the active grace exception before scheduling cancellation.",
            409,
            "subscription_grace_active"
          );
        }
        await tx.subscriptionPeriod.deleteMany({
          where: {
            status: "Scheduled",
            subscriptionLifecycleId: lifecycle.subscriptionLifecycleId
          }
        });
        await tx.subscriptionLifecycle.update({
          data: {
            cancellationReason: input.reason,
            cancellationReference: input.cancellationReference,
            cancellationScheduledAt: current.endsAt,
            renewalAgreementReference: null,
            renewalDecision: "Declined",
            renewalDecisionReason: input.reason,
            renewalPackageKey: null,
            status: "NonRenewing",
            version: { increment: 1 }
          },
          where: { subscriptionLifecycleId: lifecycle.subscriptionLifecycleId }
        });
        await appendLifecycleEvent(tx, {
          action: "CancellationScheduled",
          createdBy: context.user.userId,
          metadata: {
            effectiveAt: current.endsAt.toISOString(),
            immediateEntitlementChange: false
          },
          nextStatus: "NonRenewing",
          previousStatus: lifecycle.status,
          reason: input.reason,
          reference: input.cancellationReference,
          subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
          tenantId: context.tenant.tenantId
        });
        await writeAuditEvent(tx, {
          action: "subscription.cancellation_scheduled",
          actorType: "User",
          entityId: lifecycle.subscriptionLifecycleId,
          entityType: "Tenant",
          metadata: { effectiveAt: current.endsAt.toISOString() },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async revokeSubscriptionCancellation(context, input) {
      requireRole(
        context.membership.role,
        SUBSCRIPTION_ADMIN_ROLES,
        "revoke subscription cancellation"
      );
      await prisma.$transaction(async (tx) => {
        const { lifecycle } = await loadLifecycleForMutation(
          tx,
          context.tenant.tenantId
        );
        if (!lifecycle.cancellationScheduledAt) {
          throw new AppServiceError(
            "No scheduled cancellation can be revoked.",
            409,
            "subscription_cancellation_missing"
          );
        }
        await tx.subscriptionLifecycle.update({
          data: {
            cancellationReason: null,
            cancellationReference: null,
            cancellationScheduledAt: null,
            renewalDecision: "Unreviewed",
            renewalDecisionReason: null,
            status: "Active",
            version: { increment: 1 }
          },
          where: { subscriptionLifecycleId: lifecycle.subscriptionLifecycleId }
        });
        await appendLifecycleEvent(tx, {
          action: "CancellationRevoked",
          createdBy: context.user.userId,
          nextStatus: "Active",
          previousStatus: lifecycle.status,
          reason: input.reason,
          subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
          tenantId: context.tenant.tenantId
        });
        await writeAuditEvent(tx, {
          action: "subscription.cancellation_revoked",
          actorType: "User",
          entityId: lifecycle.subscriptionLifecycleId,
          entityType: "Tenant",
          metadata: { restoredStatus: "Active" },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadWorkspace(prisma, context.tenant.tenantId);
    },

    async reconcileSubscriptionLifecycle(context, input) {
      requireRole(
        context.membership.role,
        SUBSCRIPTION_ADMIN_ROLES,
        "reconcile subscription terms"
      );
      const now = new Date();
      const initial = await prisma.subscriptionLifecycle.findFirst({
        include: { periods: true },
        where: { tenantId: context.tenant.tenantId }
      });
      if (!initial || initial.status === "Ended") {
        throw new AppServiceError(
          "An active subscription lifecycle is required.",
          409,
          "subscription_lifecycle_inactive"
        );
      }
      const initialCurrent = initial.periods.find(
        (period) => period.status === "Open"
      );
      if (!initialCurrent) {
        throw new AppServiceError(
          "The subscription has no open period.",
          409,
          "subscription_period_missing"
        );
      }
      const usage = await usageForPeriod(
        prisma,
        context.tenant.tenantId,
        initialCurrent.startsAt,
        initialCurrent.endsAt
      );
      await prisma.$transaction(async (tx) => {
        const { current, lifecycle } = await loadLifecycleForMutation(
          tx,
          context.tenant.tenantId
        );
        const scheduled = lifecycle.periods.find(
          (period) => period.status === "Scheduled"
        );
        if (
          scheduled &&
          lifecycle.renewalDecision === "Approved" &&
          scheduled.startsAt <= now
        ) {
          await tx.subscriptionPeriod.update({
            data: {
              closedAt: now,
              closedBy: context.user.userId,
              status: "Closed",
              usageSnapshot: usage as unknown as Prisma.InputJsonValue
            },
            where: { subscriptionPeriodId: current.subscriptionPeriodId }
          });
          await tx.subscriptionPeriod.update({
            data: { status: "Open" },
            where: { subscriptionPeriodId: scheduled.subscriptionPeriodId }
          });
          await tx.subscriptionLifecycle.update({
            data: {
              agreementReference:
                lifecycle.renewalAgreementReference ??
                lifecycle.agreementReference,
              cancellationReason: null,
              cancellationReference: null,
              cancellationScheduledAt: null,
              packageKey: scheduled.packageKey,
              renewalAgreementReference: null,
              renewalDecision: "Unreviewed",
              renewalDecisionReason: null,
              renewalPackageKey: null,
              status: "Active",
              version: { increment: 1 }
            },
            where: {
              subscriptionLifecycleId: lifecycle.subscriptionLifecycleId
            }
          });
          await tx.tenant.update({
            data: { billingPackageKey: scheduled.packageKey },
            where: { tenantId: context.tenant.tenantId }
          });
          await appendLifecycleEvent(tx, {
            action: "RenewalApplied",
            createdBy: context.user.userId,
            metadata: {
              closedPeriodSequence: current.sequence,
              openedPeriodSequence: scheduled.sequence,
              usageMeterCount: usage.meters.length
            },
            nextStatus: "Active",
            previousStatus: lifecycle.status,
            reason: input.reason,
            reference: lifecycle.renewalAgreementReference,
            subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
            tenantId: context.tenant.tenantId
          });
        } else {
          const graceExpired =
            lifecycle.status === "GracePeriod" &&
            lifecycle.graceEndsAt &&
            lifecycle.graceEndsAt <= now;
          const termEnded = current.endsAt <= now;
          if (
            !termEnded ||
            (lifecycle.status !== "NonRenewing" && !graceExpired)
          ) {
            throw new AppServiceError(
              "Nothing is due. Apply an approved renewal at its start time, or reconcile a non-renewing or expired-grace term after its deadline.",
              409,
              "subscription_reconciliation_not_due"
            );
          }
          await tx.subscriptionPeriod.update({
            data: {
              closedAt: now,
              closedBy: context.user.userId,
              status: "Closed",
              usageSnapshot: usage as unknown as Prisma.InputJsonValue
            },
            where: { subscriptionPeriodId: current.subscriptionPeriodId }
          });
          await tx.subscriptionLifecycle.update({
            data: {
              endedAt: now,
              endedBy: context.user.userId,
              status: "Ended",
              version: { increment: 1 }
            },
            where: {
              subscriptionLifecycleId: lifecycle.subscriptionLifecycleId
            }
          });
          await tx.tenant.update({
            data: { billingPackageKey: null },
            where: { tenantId: context.tenant.tenantId }
          });
          await appendLifecycleEvent(tx, {
            action: "Ended",
            createdBy: context.user.userId,
            metadata: {
              closedPeriodSequence: current.sequence,
              entitlementsRemoved: true,
              usageMeterCount: usage.meters.length
            },
            nextStatus: "Ended",
            previousStatus: lifecycle.status,
            reason: input.reason,
            subscriptionLifecycleId: lifecycle.subscriptionLifecycleId,
            tenantId: context.tenant.tenantId
          });
        }
        await writeAuditEvent(tx, {
          action: "subscription.reconciled",
          actorType: "User",
          entityId: lifecycle.subscriptionLifecycleId,
          entityType: "Tenant",
          metadata: {
            previousStatus: lifecycle.status,
            usageMeterCount: usage.meters.length
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadWorkspace(prisma, context.tenant.tenantId, now);
    }
  };
}
