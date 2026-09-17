ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ComplianceControlGovernance';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'compliance_governance_updated';

CREATE TABLE "compliance_control_governance" (
    "compliance_control_governance_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "framework" TEXT NOT NULL,
    "catalog_version" TEXT NOT NULL,
    "control_id" TEXT NOT NULL,
    "owner" TEXT,
    "evidence_request" TEXT,
    "exception_rationale" TEXT,
    "exception_expires_at" TIMESTAMP(3),
    "signoff_status" TEXT NOT NULL DEFAULT 'Draft',
    "signed_off_by" UUID,
    "signed_off_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_control_governance_pkey" PRIMARY KEY ("compliance_control_governance_id")
);

CREATE TABLE "compliance_governance_changes" (
    "compliance_governance_change_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "compliance_control_governance_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "before_state" JSONB,
    "after_state" JSONB NOT NULL,
    "changed_by" UUID NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_governance_changes_pkey" PRIMARY KEY ("compliance_governance_change_id")
);

CREATE UNIQUE INDEX "compliance_control_governance_tenant_id_framework_control_id_key"
ON "compliance_control_governance"("tenant_id", "framework", "control_id");
CREATE INDEX "compliance_control_governance_tenant_id_framework_signoff_status_idx"
ON "compliance_control_governance"("tenant_id", "framework", "signoff_status");
CREATE INDEX "compliance_governance_changes_tenant_id_compliance_control_governance_id_changed_at_idx"
ON "compliance_governance_changes"("tenant_id", "compliance_control_governance_id", "changed_at");

ALTER TABLE "compliance_control_governance"
ADD CONSTRAINT "compliance_control_governance_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_governance_changes"
ADD CONSTRAINT "compliance_governance_changes_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compliance_governance_changes"
ADD CONSTRAINT "compliance_governance_changes_compliance_control_governance_id_fkey"
FOREIGN KEY ("compliance_control_governance_id") REFERENCES "compliance_control_governance"("compliance_control_governance_id") ON DELETE CASCADE ON UPDATE CASCADE;
