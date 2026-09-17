ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'finding_risk_approved';

ALTER TABLE "finding_dispositions"
  ADD COLUMN "owner_id" UUID,
  ADD COLUMN "expires_at" TIMESTAMP(3),
  ADD COLUMN "approved_by" UUID,
  ADD COLUMN "approved_at" TIMESTAMP(3);

CREATE INDEX "finding_dispositions_tenant_id_expires_at_idx"
  ON "finding_dispositions"("tenant_id", "expires_at");
