ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'bas_campaign_compiled';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'bas_campaign_started';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'bas_campaign_cancelled';

CREATE TABLE "bas_campaign_plans" (
  "bas_campaign_plan_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "scope_id" UUID NOT NULL,
  "scope_version" VARCHAR(64) NOT NULL,
  "scope_verification_status" VARCHAR(32) NOT NULL,
  "runner_id" UUID,
  "content_version_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "scenario_pins" JSONB NOT NULL,
  "policy_decision_id" UUID NOT NULL,
  "approval_digest" VARCHAR(64) NOT NULL,
  "compiled_digest" VARCHAR(64) NOT NULL,
  "cleanup_policy" JSONB NOT NULL,
  "startable" BOOLEAN NOT NULL,
  "mission_id" UUID,
  "dispatch_prevented" BOOLEAN NOT NULL DEFAULT false,
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bas_campaign_plans_pkey" PRIMARY KEY ("bas_campaign_plan_id"),
  CONSTRAINT "bas_campaign_plans_digest_check" CHECK ("compiled_digest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "bas_campaign_plans_approval_check" CHECK ("approval_digest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "bas_campaign_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bas_campaign_plans_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bas_campaign_plans_runner_id_fkey" FOREIGN KEY ("runner_id") REFERENCES "runners"("runner_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "bas_campaign_plans_policy_decision_id_fkey" FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "bas_campaign_plans_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "validation_missions"("mission_id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bas_campaign_plans_digest_key" ON "bas_campaign_plans"("tenant_id", "compiled_digest");
CREATE UNIQUE INDEX "bas_campaign_plans_mission_key" ON "bas_campaign_plans"("mission_id");
CREATE INDEX "bas_campaign_plans_tenant_id_created_at_idx" ON "bas_campaign_plans"("tenant_id", "created_at");
CREATE INDEX "bas_campaign_plans_scope_id_idx" ON "bas_campaign_plans"("scope_id");
CREATE INDEX "bas_campaign_plans_policy_decision_id_idx" ON "bas_campaign_plans"("policy_decision_id");
CREATE INDEX "bas_campaign_plans_runner_id_idx" ON "bas_campaign_plans"("runner_id");

CREATE TABLE "bas_campaign_step_cleanups" (
  "bas_campaign_step_cleanup_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "bas_campaign_plan_id" UUID NOT NULL,
  "step_key" VARCHAR(256) NOT NULL,
  "status" VARCHAR(32) NOT NULL,
  "detail" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bas_campaign_step_cleanups_pkey" PRIMARY KEY ("bas_campaign_step_cleanup_id"),
  CONSTRAINT "bas_campaign_step_cleanups_status_check" CHECK ("status" IN ('pending', 'succeeded', 'failed', 'not_required')),
  CONSTRAINT "bas_campaign_step_cleanups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bas_campaign_step_cleanups_plan_id_fkey" FOREIGN KEY ("bas_campaign_plan_id") REFERENCES "bas_campaign_plans"("bas_campaign_plan_id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bas_campaign_step_cleanups_step_key" ON "bas_campaign_step_cleanups"("bas_campaign_plan_id", "step_key");
CREATE INDEX "bas_campaign_step_cleanups_tenant_id_created_at_idx" ON "bas_campaign_step_cleanups"("tenant_id", "created_at");

ALTER TABLE "bas_campaign_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_campaign_plans" FORCE ROW LEVEL SECURITY;
CREATE POLICY bas_campaign_plans_read ON "bas_campaign_plans" FOR SELECT
  USING (tenant_id = app_current_tenant());
CREATE POLICY bas_campaign_plans_insert ON "bas_campaign_plans" FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY bas_campaign_plans_update ON "bas_campaign_plans" FOR UPDATE
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT, UPDATE ON "bas_campaign_plans" TO periscan_rls;
REVOKE DELETE ON "bas_campaign_plans" FROM periscan_rls;

ALTER TABLE "bas_campaign_step_cleanups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_campaign_step_cleanups" FORCE ROW LEVEL SECURITY;
CREATE POLICY bas_campaign_step_cleanups_read ON "bas_campaign_step_cleanups" FOR SELECT
  USING (tenant_id = app_current_tenant());
CREATE POLICY bas_campaign_step_cleanups_insert ON "bas_campaign_step_cleanups" FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant());
CREATE POLICY bas_campaign_step_cleanups_update ON "bas_campaign_step_cleanups" FOR UPDATE
  USING (tenant_id = app_current_tenant())
  WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT, UPDATE ON "bas_campaign_step_cleanups" TO periscan_rls;
REVOKE DELETE ON "bas_campaign_step_cleanups" FROM periscan_rls;
