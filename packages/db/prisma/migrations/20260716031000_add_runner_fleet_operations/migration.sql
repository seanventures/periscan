ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'runner_fleet_policy_updated';

CREATE TABLE "runner_fleet_policies" (
  "runner_fleet_policy_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "attention_after_seconds" INTEGER NOT NULL DEFAULT 90,
  "offline_after_seconds" INTEGER NOT NULL DEFAULT 300,
  "certificate_warning_days" INTEGER NOT NULL DEFAULT 14,
  "queue_warning_depth" INTEGER NOT NULL DEFAULT 10,
  "minimum_agent_version" TEXT,
  "support_owner" TEXT NOT NULL,
  "escalation_reference" TEXT NOT NULL,
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "runner_fleet_policies_pkey" PRIMARY KEY ("runner_fleet_policy_id"),
  CONSTRAINT "runner_fleet_policies_tenant_id_key" UNIQUE ("tenant_id"),
  CONSTRAINT "runner_fleet_policies_attention_check" CHECK ("attention_after_seconds" BETWEEN 30 AND 3600),
  CONSTRAINT "runner_fleet_policies_offline_check" CHECK ("offline_after_seconds" BETWEEN 60 AND 86400 AND "offline_after_seconds" > "attention_after_seconds"),
  CONSTRAINT "runner_fleet_policies_certificate_check" CHECK ("certificate_warning_days" BETWEEN 1 AND 90),
  CONSTRAINT "runner_fleet_policies_queue_check" CHECK ("queue_warning_depth" BETWEEN 1 AND 10000),
  CONSTRAINT "runner_fleet_policies_version_check" CHECK ("minimum_agent_version" IS NULL OR "minimum_agent_version" ~ '^\d+\.\d+\.\d+([-+][0-9A-Za-z.-]+)?$'),
  CONSTRAINT "runner_fleet_policies_owner_check" CHECK (char_length("support_owner") BETWEEN 3 AND 160),
  CONSTRAINT "runner_fleet_policies_escalation_check" CHECK (char_length("escalation_reference") BETWEEN 3 AND 240),
  CONSTRAINT "runner_fleet_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "runner_heartbeat_samples" (
  "heartbeat_sample_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "runner_id" UUID NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "RunnerStatus" NOT NULL,
  "version" TEXT NOT NULL,
  "queue_depth" INTEGER NOT NULL DEFAULT 0,
  "active_task_id" UUID,
  "last_task_completed_at" TIMESTAMP(3),
  "certificate_expires_at" TIMESTAMP(3),
  CONSTRAINT "runner_heartbeat_samples_pkey" PRIMARY KEY ("heartbeat_sample_id"),
  CONSTRAINT "runner_heartbeat_samples_queue_check" CHECK ("queue_depth" BETWEEN 0 AND 1000000),
  CONSTRAINT "runner_heartbeat_samples_version_check" CHECK (char_length("version") BETWEEN 1 AND 120),
  CONSTRAINT "runner_heartbeat_samples_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "runner_heartbeat_samples_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "runners"("runner_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "runner_heartbeat_samples_tenant_id_received_at_idx" ON "runner_heartbeat_samples"("tenant_id", "received_at");
CREATE INDEX "runner_heartbeat_samples_runner_id_received_at_idx" ON "runner_heartbeat_samples"("runner_id", "received_at");

CREATE OR REPLACE FUNCTION protect_runner_heartbeat_sample_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Runner heartbeat history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER runner_heartbeat_samples_immutable
BEFORE UPDATE ON "runner_heartbeat_samples"
FOR EACH ROW EXECUTE FUNCTION protect_runner_heartbeat_sample_update();

ALTER TABLE "runner_fleet_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "runner_fleet_policies" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "runner_fleet_policies"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "runner_heartbeat_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "runner_heartbeat_samples" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "runner_heartbeat_samples"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
