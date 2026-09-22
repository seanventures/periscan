ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'bas_content_registered';

CREATE TABLE "bas_content_versions" (
  "bas_content_version_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "provider" VARCHAR(32) NOT NULL,
  "source_revision" VARCHAR(128) NOT NULL,
  "source_path" VARCHAR(512) NOT NULL,
  "content_sha256" VARCHAR(64) NOT NULL,
  "scenario_count" INTEGER NOT NULL,
  "preview" JSONB NOT NULL,
  "registered_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bas_content_versions_pkey" PRIMARY KEY ("bas_content_version_id"),
  CONSTRAINT "bas_content_versions_provider_check" CHECK ("provider" IN ('AtomicRedTeam', 'Caldera')),
  CONSTRAINT "bas_content_versions_hash_check" CHECK ("content_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "bas_content_versions_count_check" CHECK ("scenario_count" BETWEEN 1 AND 200),
  CONSTRAINT "bas_content_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bas_content_versions_registered_by_user_id_fkey" FOREIGN KEY ("registered_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bas_content_versions_identity_key" ON "bas_content_versions"("tenant_id", "provider", "source_revision", "source_path");
CREATE INDEX "bas_content_versions_tenant_page_idx" ON "bas_content_versions"("tenant_id", "created_at", "bas_content_version_id");
CREATE INDEX "bas_content_versions_provider_page_idx" ON "bas_content_versions"("tenant_id", "provider", "created_at", "bas_content_version_id");
CREATE INDEX "bas_content_versions_registered_by_user_id_idx" ON "bas_content_versions"("registered_by_user_id");

-- Both reads and inserts require an explicit tenant binding. No API update or
-- delete policy exists: new content needs a new identity, even for the same tenant.
ALTER TABLE "bas_content_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_content_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY bas_content_read ON "bas_content_versions" FOR SELECT
  USING (tenant_id = app_current_tenant());
CREATE POLICY bas_content_insert ON "bas_content_versions" FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT ON "bas_content_versions" TO periscan_rls;
REVOKE UPDATE, DELETE ON "bas_content_versions" FROM periscan_rls;
