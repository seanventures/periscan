CREATE TYPE "RemediationActionType" AS ENUM ('ControlExpectationTuning');
CREATE TYPE "RemediationActionState" AS ENUM (
  'Draft',
  'Previewed',
  'AwaitingApproval',
  'Approved',
  'Executing',
  'Applied',
  'Revalidating',
  'ProvenFixed',
  'StillExposed',
  'RolledBack',
  'Failed'
);

ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'RemediationAction';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'remediation_action_previewed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'remediation_action_approved';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'remediation_action_applied';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'remediation_action_rolled_back';

CREATE TABLE "remediation_actions" (
  "remediation_action_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "remediation_id" UUID NOT NULL,
  "action_type" "RemediationActionType" NOT NULL,
  "state" "RemediationActionState" NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "target_entity_id" UUID NOT NULL,
  "manifest" JSONB NOT NULL,
  "preview_hash" TEXT NOT NULL,
  "approved_at" TIMESTAMP(3),
  "approved_by" UUID,
  "applied_at" TIMESTAMP(3),
  "application_receipt" JSONB,
  "rolled_back_at" TIMESTAMP(3),
  "rollback_receipt" JSONB,
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "remediation_actions_pkey" PRIMARY KEY ("remediation_action_id"),
  CONSTRAINT "remediation_actions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "remediation_actions_remediation_id_fkey" FOREIGN KEY ("remediation_id") REFERENCES "remediation_tasks"("remediation_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "remediation_actions_tenant_id_idempotency_key_key"
  ON "remediation_actions"("tenant_id", "idempotency_key");
CREATE INDEX "remediation_actions_tenant_id_created_at_idx"
  ON "remediation_actions"("tenant_id", "created_at");
CREATE INDEX "remediation_actions_remediation_id_created_at_idx"
  ON "remediation_actions"("remediation_id", "created_at");
CREATE INDEX "remediation_actions_tenant_id_state_idx"
  ON "remediation_actions"("tenant_id", "state");
