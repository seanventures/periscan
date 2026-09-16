-- AlterTable: continuous re-verification. A settled remediation (Fixed/Mitigated/
-- PartiallyFixed) gets a next_verification_at so an external scheduler can re-run
-- verification and catch a regressed fix instead of trusting a stale "Fixed".
ALTER TABLE "remediation_tasks"
  ADD COLUMN "last_verified_at" TIMESTAMP(3),
  ADD COLUMN "next_verification_at" TIMESTAMP(3);

CREATE INDEX "remediation_tasks_tenant_id_status_next_verification_at_idx"
  ON "remediation_tasks" ("tenant_id", "status", "next_verification_at");
