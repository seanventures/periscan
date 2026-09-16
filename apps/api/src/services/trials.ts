import {
  TenantTrialSchema,
  type TenantTrial
} from "@periscan/shared";

import {
  AppServiceError,
  expireTenantTrialIfNeeded,
  requireRole,
  TENANT_ADMIN_ROLES,
  writeAuditEvent,
  type AppServices,
  type RuntimeServiceDeps
} from "../runtime-services.js";

type TrialServices = Pick<
  AppServices,
  | "cancelTenantTrial"
  | "convertTenantTrial"
  | "getTenantTrial"
  | "startTenantTrial"
>;

const DAY_MS = 24 * 60 * 60 * 1_000;

function serializeTrial(
  tenant: NonNullable<Awaited<ReturnType<typeof expireTenantTrialIfNeeded>>>,
  now = new Date()
): TenantTrial {
  const remainingDays = tenant.trialEndsAt
    ? Math.max(
        0,
        Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / DAY_MS)
      )
    : 0;
  return TenantTrialSchema.parse({
    activatedBy: tenant.trialActivatedBy,
    canStart: tenant.trialStatus === "NotStarted",
    cancellationReason: tenant.trialCancellationReason,
    cancelledAt: tenant.trialCancelledAt?.toISOString() ?? null,
    conversionApprovalReference: tenant.trialConversionApprovalRef,
    convertedAt: tenant.trialConvertedAt?.toISOString() ?? null,
    deletionScheduledAt:
      tenant.trialDeletionScheduledAt?.toISOString() ?? null,
    entitlementPackageKey:
      tenant.trialStatus === "Active" ? tenant.billingPackageKey : null,
    endsAt: tenant.trialEndsAt?.toISOString() ?? null,
    previousBillingPackageKey: tenant.trialPreviousBillingPackageKey,
    remainingDays,
    retentionDays: tenant.trialRetentionDays,
    startedAt: tenant.trialStartedAt?.toISOString() ?? null,
    status: tenant.trialStatus,
    tenantId: tenant.tenantId
  });
}

async function loadTrial(
  deps: RuntimeServiceDeps,
  tenantId: string,
  now = new Date()
) {
  const tenant = await expireTenantTrialIfNeeded(deps.prisma, tenantId, now);
  if (!tenant) {
    throw new AppServiceError("Tenant not found.", 404, "tenant_not_found");
  }
  return serializeTrial(tenant, now);
}

export function createTrialServices(deps: RuntimeServiceDeps): TrialServices {
  const { prisma } = deps;

  return {
    async getTenantTrial(context) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "view trial lifecycle"
      );
      return loadTrial(deps, context.tenant.tenantId);
    },

    async startTenantTrial(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "start a trial"
      );
      const now = new Date();
      const durationDays = input.durationDays ?? 14;
      const retentionDays = input.retentionDays ?? 30;
      const endsAt = new Date(now.getTime() + durationDays * DAY_MS);
      await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.findUnique({
          select: { billingPackageKey: true, trialStatus: true },
          where: { tenantId: context.tenant.tenantId }
        });
        if (!tenant) {
          throw new AppServiceError("Tenant not found.", 404, "tenant_not_found");
        }
        if (tenant.trialStatus !== "NotStarted") {
          throw new AppServiceError(
            "This tenant has already used or settled its one-time trial.",
            409,
            "trial_already_used"
          );
        }
        const updated = await tx.tenant.updateMany({
          data: {
            billingPackageKey: "Enterprise",
            trialActivatedBy: context.user.userId,
            trialDeletionScheduledAt: null,
            trialEndsAt: endsAt,
            trialPreviousBillingPackageKey: tenant.billingPackageKey,
            trialRetentionDays: retentionDays,
            trialStartedAt: now,
            trialStatus: "Active"
          },
          where: {
            tenantId: context.tenant.tenantId,
            trialStatus: "NotStarted"
          }
        });
        if (updated.count !== 1) {
          throw new AppServiceError(
            "The trial state changed before activation. Reload and try again.",
            409,
            "trial_activation_conflict"
          );
        }
        await writeAuditEvent(tx, {
          action: "trial.started",
          actorType: "User",
          entityId: context.tenant.tenantId,
          entityType: "Tenant",
          metadata: {
            durationDays,
            endsAt: endsAt.toISOString(),
            entitlementPackageKey: "Enterprise",
            previousPackageKey: tenant.billingPackageKey,
            retentionDays
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadTrial(deps, context.tenant.tenantId, now);
    },

    async convertTenantTrial(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "convert a trial"
      );
      const now = new Date();
      await expireTenantTrialIfNeeded(prisma, context.tenant.tenantId, now);
      const converted = await prisma.$transaction(async (tx) => {
        const updated = await tx.tenant.updateMany({
          data: {
            billingPackageKey: input.packageKey,
            trialConversionApprovalRef: input.approvalReference,
            trialConvertedAt: now,
            trialDeletionScheduledAt: null,
            trialStatus: "Converted"
          },
          where: {
            tenantId: context.tenant.tenantId,
            trialStatus: "Active"
          }
        });
        if (updated.count !== 1) {
          throw new AppServiceError(
            "Only an active, unexpired trial can be converted.",
            409,
            "trial_not_active"
          );
        }
        await writeAuditEvent(tx, {
          action: "trial.converted",
          actorType: "User",
          entityId: context.tenant.tenantId,
          entityType: "Tenant",
          metadata: {
            approvalReference: input.approvalReference,
            packageKey: input.packageKey,
            paymentProcessorUsed: false
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
        return true;
      });
      void converted;
      return loadTrial(deps, context.tenant.tenantId, now);
    },

    async cancelTenantTrial(context, input) {
      requireRole(
        context.membership.role,
        TENANT_ADMIN_ROLES,
        "cancel a trial"
      );
      const now = new Date();
      const tenant = await prisma.tenant.findUnique({
        select: {
          trialPreviousBillingPackageKey: true,
          trialRetentionDays: true,
          trialStatus: true
        },
        where: { tenantId: context.tenant.tenantId }
      });
      if (!tenant || tenant.trialStatus !== "Active") {
        throw new AppServiceError(
          "Only an active trial can be cancelled.",
          409,
          "trial_not_active"
        );
      }
      const deletionScheduledAt = new Date(
        now.getTime() + tenant.trialRetentionDays * DAY_MS
      );
      await prisma.$transaction(async (tx) => {
        const updated = await tx.tenant.updateMany({
          data: {
            billingPackageKey: tenant.trialPreviousBillingPackageKey,
            trialCancellationReason: input.reason,
            trialCancelledAt: now,
            trialDeletionScheduledAt: deletionScheduledAt,
            trialStatus: "Cancelled"
          },
          where: {
            tenantId: context.tenant.tenantId,
            trialStatus: "Active"
          }
        });
        if (updated.count !== 1) {
          throw new AppServiceError(
            "The trial state changed before cancellation.",
            409,
            "trial_cancellation_conflict"
          );
        }
        await writeAuditEvent(tx, {
          action: "trial.cancelled",
          actorType: "User",
          entityId: context.tenant.tenantId,
          entityType: "Tenant",
          metadata: {
            deletionScheduledAt: deletionScheduledAt.toISOString(),
            reason: input.reason,
            restoredPackageKey: tenant.trialPreviousBillingPackageKey,
            retentionDays: tenant.trialRetentionDays
          },
          tenantId: context.tenant.tenantId,
          userId: context.user.userId
        });
      });
      return loadTrial(deps, context.tenant.tenantId, now);
    }
  };
}
