-- Engine Lab Phase 1: tenant license acceptance for governed tools.
-- Acceptances are required before install when policy is RequiresLegalReview.

ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ToolLicenseAcceptance';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_license_accepted';

CREATE TABLE "tool_license_acceptances" (
  "tool_license_acceptance_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "tool_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "spdx" TEXT NOT NULL,
  "text_hash" TEXT NOT NULL,
  "accepted_by" UUID NOT NULL,
  "accepted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tool_license_acceptances_pkey" PRIMARY KEY ("tool_license_acceptance_id")
);

CREATE UNIQUE INDEX "tool_license_acceptances_tenant_id_tool_id_version_text_hash_key"
  ON "tool_license_acceptances"("tenant_id", "tool_id", "version", "text_hash");

CREATE INDEX "tool_license_acceptances_tenant_id_created_at_idx"
  ON "tool_license_acceptances"("tenant_id", "created_at");

CREATE INDEX "tool_license_acceptances_tenant_id_tool_id_accepted_at_idx"
  ON "tool_license_acceptances"("tenant_id", "tool_id", "accepted_at");

CREATE INDEX "tool_license_acceptances_tool_id_idx"
  ON "tool_license_acceptances"("tool_id");

ALTER TABLE "tool_license_acceptances"
  ADD CONSTRAINT "tool_license_acceptances_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tool_license_acceptances"
  ADD CONSTRAINT "tool_license_acceptances_accepted_by_fkey"
  FOREIGN KEY ("accepted_by") REFERENCES "users"("user_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
