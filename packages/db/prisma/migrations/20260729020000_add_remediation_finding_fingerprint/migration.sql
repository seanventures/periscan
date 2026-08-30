-- PERISCAN-7: one open remediation per grouped finding cause.
-- Additive column + index; never deletes remediation or verification history.
ALTER TABLE "remediation_tasks"
  ADD COLUMN IF NOT EXISTS "related_finding_fingerprint" TEXT;

CREATE INDEX IF NOT EXISTS "remediation_tasks_tenant_id_related_finding_fingerprint_idx"
  ON "remediation_tasks"("tenant_id", "related_finding_fingerprint");
