ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_upstream_checked';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThirdPartyToolUpstreamVersionCheck';

CREATE TYPE "ThirdPartyToolUpstreamVersionCheckStatus" AS ENUM (
  'UpToDate',
  'CandidateAvailable',
  'Unavailable',
  'Blocked',
  'Deferred'
);

CREATE TYPE "ThirdPartyToolUpstreamSourceKind" AS ENUM (
  'ConfiguredOverride',
  'GitHubRelease',
  'GitHubTag',
  'NpmRegistry',
  'PypiRegistry',
  'CatalogOnly'
);

CREATE TABLE "third_party_tool_upstream_version_checks" (
  "third_party_tool_upstream_version_check_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "tool_id" TEXT NOT NULL,
  "status" "ThirdPartyToolUpstreamVersionCheckStatus" NOT NULL,
  "source_kind" "ThirdPartyToolUpstreamSourceKind" NOT NULL,
  "source_url" TEXT,
  "catalog_version" TEXT NOT NULL,
  "discovered_version" TEXT,
  "update_available" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT NOT NULL,
  "required_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "checked_by_user_id" UUID,
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "third_party_tool_upstream_version_checks_pkey"
    PRIMARY KEY ("third_party_tool_upstream_version_check_id"),
  CONSTRAINT "third_party_tool_upstream_version_checks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "third_party_tool_upstream_version_checks_tenant_id_created_at_idx"
  ON "third_party_tool_upstream_version_checks"("tenant_id", "created_at");

CREATE INDEX "third_party_tool_upstream_version_checks_tenant_id_tool_id_created_at_idx"
  ON "third_party_tool_upstream_version_checks"("tenant_id", "tool_id", "created_at");

CREATE INDEX "third_party_tool_upstream_version_checks_tenant_id_status_idx"
  ON "third_party_tool_upstream_version_checks"("tenant_id", "status");

CREATE INDEX "third_party_tool_upstream_version_checks_tool_id_idx"
  ON "third_party_tool_upstream_version_checks"("tool_id");
