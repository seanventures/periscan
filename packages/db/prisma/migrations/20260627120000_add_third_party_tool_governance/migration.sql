ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThirdPartyTool';

ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_checked';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_install_requested';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_installed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_install_failed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_enabled';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_disabled';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_enable_denied';

CREATE TYPE "ThirdPartyToolGovernanceStatus" AS ENUM (
  'Enabled',
  'Disabled',
  'LegalReviewRequired',
  'Blocked'
);

CREATE TYPE "ThirdPartyToolInstallStatus" AS ENUM (
  'NotInstalled',
  'Checking',
  'Available',
  'Missing',
  'Installing',
  'Installed',
  'Failed',
  'Skipped'
);

CREATE TYPE "ThirdPartyToolInstallJobAction" AS ENUM ('Check', 'Install');

CREATE TYPE "ThirdPartyToolInstallJobStatus" AS ENUM (
  'Queued',
  'Running',
  'Completed',
  'Failed',
  'Denied'
);

CREATE TABLE "third_party_tool_policies" (
  "third_party_tool_policy_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "owner_key" TEXT NOT NULL,
  "tool_id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "status" "ThirdPartyToolGovernanceStatus" NOT NULL,
  "allowed_runtimes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "pinned_version" TEXT NOT NULL,
  "pinned_image_ref" TEXT,
  "pinned_git_ref" TEXT,
  "legal_review_status" TEXT NOT NULL,
  "disabled_reason" TEXT,
  "install_status" "ThirdPartyToolInstallStatus" NOT NULL DEFAULT 'NotInstalled',
  "runtime_kind" TEXT,
  "runtime_available" BOOLEAN NOT NULL DEFAULT false,
  "runtime_reason" TEXT NOT NULL,
  "installed_version" TEXT,
  "installed_at" TIMESTAMP(3),
  "last_checked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "third_party_tool_policies_pkey" PRIMARY KEY ("third_party_tool_policy_id")
);

CREATE TABLE "third_party_tool_install_jobs" (
  "third_party_tool_install_job_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID,
  "tool_id" TEXT NOT NULL,
  "action" "ThirdPartyToolInstallJobAction" NOT NULL,
  "status" "ThirdPartyToolInstallJobStatus" NOT NULL,
  "requested_by_user_id" UUID,
  "runtime_kind" TEXT,
  "reason" TEXT,
  "output_redacted" TEXT,
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "third_party_tool_install_jobs_pkey" PRIMARY KEY ("third_party_tool_install_job_id")
);

CREATE UNIQUE INDEX "third_party_tool_policies_owner_key_tool_id_key"
  ON "third_party_tool_policies"("owner_key", "tool_id");

CREATE INDEX "third_party_tool_policies_tenant_id_updated_at_idx"
  ON "third_party_tool_policies"("tenant_id", "updated_at");

CREATE INDEX "third_party_tool_policies_tool_id_idx"
  ON "third_party_tool_policies"("tool_id");

CREATE INDEX "third_party_tool_policies_status_idx"
  ON "third_party_tool_policies"("status");

CREATE INDEX "third_party_tool_install_jobs_tenant_id_created_at_idx"
  ON "third_party_tool_install_jobs"("tenant_id", "created_at");

CREATE INDEX "third_party_tool_install_jobs_tool_id_created_at_idx"
  ON "third_party_tool_install_jobs"("tool_id", "created_at");

CREATE INDEX "third_party_tool_install_jobs_status_idx"
  ON "third_party_tool_install_jobs"("status");

ALTER TABLE "third_party_tool_policies"
  ADD CONSTRAINT "third_party_tool_policies_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "third_party_tool_install_jobs"
  ADD CONSTRAINT "third_party_tool_install_jobs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
