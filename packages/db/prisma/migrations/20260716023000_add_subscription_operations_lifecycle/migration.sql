CREATE TYPE "SubscriptionLifecycleStatus" AS ENUM ('Active', 'GracePeriod', 'NonRenewing', 'Ended');
CREATE TYPE "SubscriptionRenewalDecision" AS ENUM ('Unreviewed', 'Approved', 'Declined');
CREATE TYPE "SubscriptionPeriodStatus" AS ENUM ('Scheduled', 'Open', 'Closed');
CREATE TYPE "SubscriptionLifecycleEventAction" AS ENUM ('Started', 'RenewalApproved', 'RenewalDeclined', 'RenewalApplied', 'GraceStarted', 'GraceResolved', 'CancellationScheduled', 'CancellationRevoked', 'Ended');

CREATE TABLE "subscription_lifecycles" (
  "subscription_lifecycle_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'DirectAgreement',
  "status" "SubscriptionLifecycleStatus" NOT NULL DEFAULT 'Active',
  "package_key" TEXT NOT NULL,
  "agreement_reference" TEXT NOT NULL,
  "support_owner_email" TEXT NOT NULL,
  "renewal_lead_days" INTEGER NOT NULL DEFAULT 60,
  "renewal_decision" "SubscriptionRenewalDecision" NOT NULL DEFAULT 'Unreviewed',
  "renewal_decision_reason" TEXT,
  "renewal_agreement_reference" TEXT,
  "renewal_package_key" TEXT,
  "grace_ends_at" TIMESTAMP(3),
  "grace_reference" TEXT,
  "cancellation_scheduled_at" TIMESTAMP(3),
  "cancellation_reference" TEXT,
  "cancellation_reason" TEXT,
  "ended_at" TIMESTAMP(3),
  "ended_by" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "subscription_lifecycles_pkey" PRIMARY KEY ("subscription_lifecycle_id"),
  CONSTRAINT "subscription_lifecycles_source_check" CHECK ("source" = 'DirectAgreement'),
  CONSTRAINT "subscription_lifecycles_renewal_lead_days_check" CHECK ("renewal_lead_days" BETWEEN 7 AND 180),
  CONSTRAINT "subscription_lifecycles_version_check" CHECK ("version" > 0),
  CONSTRAINT "subscription_lifecycles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "subscription_lifecycles_tenant_id_key" ON "subscription_lifecycles"("tenant_id");
CREATE INDEX "subscription_lifecycles_tenant_id_status_updated_at_idx" ON "subscription_lifecycles"("tenant_id", "status", "updated_at");

CREATE TABLE "subscription_periods" (
  "subscription_period_id" UUID NOT NULL,
  "subscription_lifecycle_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" "SubscriptionPeriodStatus" NOT NULL,
  "package_key" TEXT NOT NULL,
  "starts_at" TIMESTAMP(3) NOT NULL,
  "ends_at" TIMESTAMP(3) NOT NULL,
  "usage_snapshot" JSONB,
  "closed_at" TIMESTAMP(3),
  "closed_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_periods_pkey" PRIMARY KEY ("subscription_period_id"),
  CONSTRAINT "subscription_periods_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "subscription_periods_range_check" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "subscription_periods_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "subscription_periods_subscription_id_fkey" FOREIGN KEY ("subscription_lifecycle_id") REFERENCES "subscription_lifecycles"("subscription_lifecycle_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "subscription_periods_subscription_id_sequence_key" ON "subscription_periods"("subscription_lifecycle_id", "sequence");
CREATE INDEX "subscription_periods_tenant_id_status_ends_at_idx" ON "subscription_periods"("tenant_id", "status", "ends_at");

CREATE TABLE "subscription_lifecycle_events" (
  "subscription_event_id" UUID NOT NULL,
  "subscription_lifecycle_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "action" "SubscriptionLifecycleEventAction" NOT NULL,
  "previous_status" "SubscriptionLifecycleStatus",
  "next_status" "SubscriptionLifecycleStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "reference" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "previous_event_hash" TEXT,
  "event_hash" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subscription_lifecycle_events_pkey" PRIMARY KEY ("subscription_event_id"),
  CONSTRAINT "subscription_lifecycle_events_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "subscription_lifecycle_events_hash_check" CHECK ("event_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "subscription_lifecycle_events_previous_hash_check" CHECK ("previous_event_hash" IS NULL OR "previous_event_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "subscription_lifecycle_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "subscription_lifecycle_events_subscription_id_fkey" FOREIGN KEY ("subscription_lifecycle_id") REFERENCES "subscription_lifecycles"("subscription_lifecycle_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "subscription_lifecycle_events_subscription_id_sequence_key" ON "subscription_lifecycle_events"("subscription_lifecycle_id", "sequence");
CREATE INDEX "subscription_lifecycle_events_tenant_id_created_at_idx" ON "subscription_lifecycle_events"("tenant_id", "created_at");

ALTER TABLE "subscription_lifecycles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_lifecycles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription_lifecycles"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "subscription_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_periods" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription_periods"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "subscription_lifecycle_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "subscription_lifecycle_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "subscription_lifecycle_events"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
