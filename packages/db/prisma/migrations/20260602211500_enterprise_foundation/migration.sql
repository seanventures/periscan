ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'tenant_updated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'scope_deleted';

CREATE TABLE "tenant_report_branding" (
    "tenant_id" UUID NOT NULL,
    "white_label_enabled" BOOLEAN NOT NULL DEFAULT false,
    "organization_name" TEXT,
    "logo_url" TEXT,
    "primary_color" TEXT,
    "report_footer" TEXT,
    "support_email" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_report_branding_pkey" PRIMARY KEY ("tenant_id")
);

CREATE INDEX "tenants_parent_tenant_id_idx" ON "tenants"("parent_tenant_id");

ALTER TABLE "tenant_report_branding" ADD CONSTRAINT "tenant_report_branding_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
