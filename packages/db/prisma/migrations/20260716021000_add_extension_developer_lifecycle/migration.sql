CREATE TABLE "extension_projects" (
  "extension_project_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "package_name" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "repository_url" TEXT NOT NULL,
  "support_url" TEXT NOT NULL,
  "license_spdx" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "active_release_id" UUID,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "extension_projects_pkey" PRIMARY KEY ("extension_project_id"),
  CONSTRAINT "extension_projects_status_check" CHECK ("status" IN ('Active', 'Archived')),
  CONSTRAINT "extension_projects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "extension_projects_tenant_id_package_name_key" ON "extension_projects"("tenant_id", "package_name");
CREATE INDEX "extension_projects_tenant_id_status_updated_at_idx" ON "extension_projects"("tenant_id", "status", "updated_at");

CREATE TABLE "extension_releases" (
  "extension_release_id" UUID NOT NULL,
  "extension_project_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "contract" JSONB NOT NULL,
  "compatibility_report" JSONB NOT NULL,
  "contract_digest" TEXT NOT NULL,
  "image_reference" TEXT NOT NULL,
  "image_digest" TEXT NOT NULL,
  "signer_identity" TEXT NOT NULL,
  "signer_public_key_sha256" TEXT NOT NULL,
  "capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "network_allowlist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "compatible" BOOLEAN NOT NULL,
  "execution_authorized" BOOLEAN NOT NULL DEFAULT false,
  "certification_reason" TEXT,
  "certified_at" TIMESTAMP(3),
  "certified_by" UUID,
  "activation_reason" TEXT,
  "activated_at" TIMESTAMP(3),
  "activated_by" UUID,
  "revocation_reason" TEXT,
  "revoked_at" TIMESTAMP(3),
  "revoked_by" UUID,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "extension_releases_pkey" PRIMARY KEY ("extension_release_id"),
  CONSTRAINT "extension_releases_status_check" CHECK ("status" IN ('CompatibilityFailed', 'Compatible', 'Rejected', 'Certified', 'CatalogActive', 'Superseded', 'Revoked')),
  CONSTRAINT "extension_releases_contract_digest_check" CHECK ("contract_digest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "extension_releases_signer_key_hash_check" CHECK ("signer_public_key_sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "extension_releases_execution_disabled_check" CHECK ("execution_authorized" = false),
  CONSTRAINT "extension_releases_project_id_fkey" FOREIGN KEY ("extension_project_id") REFERENCES "extension_projects"("extension_project_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "extension_releases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "extension_releases_project_id_version_key" ON "extension_releases"("extension_project_id", "version");
CREATE UNIQUE INDEX "extension_releases_tenant_id_contract_digest_key" ON "extension_releases"("tenant_id", "contract_digest");
CREATE INDEX "extension_releases_tenant_id_status_updated_at_idx" ON "extension_releases"("tenant_id", "status", "updated_at");
CREATE INDEX "extension_releases_project_id_created_at_idx" ON "extension_releases"("extension_project_id", "created_at");

ALTER TABLE "extension_projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extension_projects" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "extension_projects"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "extension_releases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "extension_releases" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "extension_releases"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
