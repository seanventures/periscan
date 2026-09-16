CREATE TABLE "async_operations_policies" (
  "tenant_id" UUID NOT NULL,
  "queue_age_target_seconds" INTEGER NOT NULL,
  "running_timeout_seconds" INTEGER NOT NULL,
  "runner_lease_warning_seconds" INTEGER NOT NULL,
  "support_owner" TEXT NOT NULL,
  "escalation_channel" TEXT NOT NULL,
  "review_reference" TEXT NOT NULL,
  "reviewed_by" UUID NOT NULL,
  "reviewed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "async_operations_policies_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "async_operations_policies_queue_age_check" CHECK ("queue_age_target_seconds" BETWEEN 30 AND 86400),
  CONSTRAINT "async_operations_policies_running_timeout_check" CHECK ("running_timeout_seconds" BETWEEN 60 AND 86400),
  CONSTRAINT "async_operations_policies_lease_warning_check" CHECK ("runner_lease_warning_seconds" BETWEEN 30 AND 86400),
  CONSTRAINT "async_operations_policies_support_owner_check" CHECK (length(btrim("support_owner")) BETWEEN 2 AND 200),
  CONSTRAINT "async_operations_policies_escalation_channel_check" CHECK (length(btrim("escalation_channel")) BETWEEN 3 AND 500),
  CONSTRAINT "async_operations_policies_review_reference_check" CHECK (length(btrim("review_reference")) BETWEEN 3 AND 500),
  CONSTRAINT "async_operations_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "async_operations_events" (
  "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "event_type" TEXT NOT NULL,
  "workload_kind" TEXT,
  "workload_id" UUID,
  "recovery_mission_id" UUID,
  "reference" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "previous_event_hash" TEXT,
  "event_hash" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "async_operations_events_pkey" PRIMARY KEY ("event_id"),
  CONSTRAINT "async_operations_events_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "async_operations_events_type_check" CHECK ("event_type" IN ('PolicyConfigured', 'Reconciled', 'RecoveryPrepared', 'TerminalAccepted')),
  CONSTRAINT "async_operations_events_workload_kind_check" CHECK ("workload_kind" IS NULL OR "workload_kind" IN ('ValidationJob', 'RunnerTask')),
  CONSTRAINT "async_operations_events_workload_pair_check" CHECK (("workload_kind" IS NULL) = ("workload_id" IS NULL)),
  CONSTRAINT "async_operations_events_reference_check" CHECK (length(btrim("reference")) BETWEEN 3 AND 500),
  CONSTRAINT "async_operations_events_reason_check" CHECK (length(btrim("reason")) BETWEEN 1 AND 1000),
  CONSTRAINT "async_operations_events_previous_hash_check" CHECK ("previous_event_hash" IS NULL OR "previous_event_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "async_operations_events_hash_check" CHECK ("event_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "async_operations_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "async_operations_events_tenant_id_sequence_key" ON "async_operations_events"("tenant_id", "sequence");
CREATE INDEX "async_operations_events_tenant_id_created_at_idx" ON "async_operations_events"("tenant_id", "created_at");
CREATE INDEX "async_operations_events_tenant_id_workload_kind_workload_id_idx" ON "async_operations_events"("tenant_id", "workload_kind", "workload_id");

CREATE OR REPLACE FUNCTION protect_async_operations_event()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'async operations events are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER async_operations_event_immutable_update
BEFORE UPDATE ON "async_operations_events"
FOR EACH ROW EXECUTE FUNCTION protect_async_operations_event();

ALTER TABLE "async_operations_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "async_operations_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "async_operations_policies"
USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), NULLIF(current_setting('app.current_tenant', true), ''))::uuid)
WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), NULLIF(current_setting('app.current_tenant', true), ''))::uuid);

ALTER TABLE "async_operations_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "async_operations_events" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "async_operations_events"
USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), NULLIF(current_setting('app.current_tenant', true), ''))::uuid)
WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), NULLIF(current_setting('app.current_tenant', true), ''))::uuid);
