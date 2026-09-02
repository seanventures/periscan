ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'trial_started';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'trial_expired';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'trial_converted';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'trial_cancelled';

ALTER TABLE "tenants"
ADD COLUMN "trial_status" TEXT NOT NULL DEFAULT 'NotStarted',
ADD COLUMN "trial_started_at" TIMESTAMP(3),
ADD COLUMN "trial_ends_at" TIMESTAMP(3),
ADD COLUMN "trial_activated_by" UUID,
ADD COLUMN "trial_previous_billing_package_key" TEXT,
ADD COLUMN "trial_retention_days" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "trial_deletion_scheduled_at" TIMESTAMP(3),
ADD COLUMN "trial_converted_at" TIMESTAMP(3),
ADD COLUMN "trial_conversion_approval_ref" TEXT,
ADD COLUMN "trial_cancelled_at" TIMESTAMP(3),
ADD COLUMN "trial_cancellation_reason" TEXT;

ALTER TABLE "tenants"
ADD CONSTRAINT "tenants_trial_retention_days_check"
CHECK ("trial_retention_days" >= 0 AND "trial_retention_days" <= 90);
