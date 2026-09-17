CREATE TABLE "infrastructure_change_requests" (
  "iac_change_request_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "remediation_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'AwaitingApproval',
  "idempotency_key" TEXT NOT NULL,
  "preview_hash" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "applied_at" TIMESTAMP(3),
  "application_receipt" JSONB,
  "rolled_back_at" TIMESTAMP(3),
  "rollback_receipt" JSONB,
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "infrastructure_change_requests_pkey" PRIMARY KEY ("iac_change_request_id")
);

CREATE UNIQUE INDEX "infrastructure_change_requests_tenant_id_idempotency_key_key" ON "infrastructure_change_requests"("tenant_id", "idempotency_key");
CREATE INDEX "infrastructure_change_requests_tenant_id_created_at_idx" ON "infrastructure_change_requests"("tenant_id", "created_at");
CREATE INDEX "infrastructure_change_requests_remediation_id_created_at_idx" ON "infrastructure_change_requests"("remediation_id", "created_at");
CREATE INDEX "infrastructure_change_requests_integration_id_created_at_idx" ON "infrastructure_change_requests"("integration_id", "created_at");
CREATE INDEX "infrastructure_change_requests_tenant_id_state_idx" ON "infrastructure_change_requests"("tenant_id", "state");

ALTER TABLE "infrastructure_change_requests" ADD CONSTRAINT "infrastructure_change_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "infrastructure_change_requests" ADD CONSTRAINT "infrastructure_change_requests_remediation_id_fkey" FOREIGN KEY ("remediation_id") REFERENCES "remediation_tasks"("remediation_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "infrastructure_change_requests" ADD CONSTRAINT "infrastructure_change_requests_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("integration_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "infrastructure_change_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "infrastructure_change_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "infrastructure_change_requests"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
