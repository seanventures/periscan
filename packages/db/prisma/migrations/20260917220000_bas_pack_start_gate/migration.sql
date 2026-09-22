ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'bas_pack_qualified';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'bas_pack_authorized';

CREATE TABLE "bas_pack_qualifications" (
  "bas_pack_qualification_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "pack" VARCHAR(32) NOT NULL,
  "pin_ids" TEXT[] NOT NULL,
  "lab_receipt_hash" VARCHAR(64) NOT NULL,
  "qualified_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "qualified_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bas_pack_qualifications_pkey" PRIMARY KEY ("bas_pack_qualification_id"),
  CONSTRAINT "bas_pack_qualifications_pack_check" CHECK ("pack" IN ('atomic', 'caldera', 'metasploit')),
  CONSTRAINT "bas_pack_qualifications_receipt_check" CHECK ("lab_receipt_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "bas_pack_qualifications_pin_ids_check" CHECK (cardinality("pin_ids") >= 1 AND cardinality("pin_ids") <= 50),
  CONSTRAINT "bas_pack_qualifications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bas_pack_qualifications_qualified_by_user_id_fkey" FOREIGN KEY ("qualified_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bas_pack_qualifications_receipt_key" ON "bas_pack_qualifications"("tenant_id", "pack", "lab_receipt_hash");
CREATE INDEX "bas_pack_qualifications_tenant_id_pack_idx" ON "bas_pack_qualifications"("tenant_id", "pack");
CREATE INDEX "bas_pack_qualifications_qualified_by_user_id_idx" ON "bas_pack_qualifications"("qualified_by_user_id");

CREATE TABLE "tenant_bas_pack_authorizations" (
  "tenant_bas_pack_authorization_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "pack" VARCHAR(32) NOT NULL,
  "scope_id" UUID NOT NULL,
  "approver_user_id" UUID NOT NULL,
  "digest" VARCHAR(64) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_bas_pack_authorizations_pkey" PRIMARY KEY ("tenant_bas_pack_authorization_id"),
  CONSTRAINT "tenant_bas_pack_authorizations_pack_check" CHECK ("pack" IN ('atomic', 'caldera', 'metasploit')),
  CONSTRAINT "tenant_bas_pack_authorizations_digest_check" CHECK ("digest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "tenant_bas_pack_authorizations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tenant_bas_pack_authorizations_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tenant_bas_pack_authorizations_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "tenant_bas_pack_authorizations_digest_key" ON "tenant_bas_pack_authorizations"("tenant_id", "pack", "scope_id", "digest");
CREATE INDEX "tenant_bas_pack_authorizations_tenant_pack_scope_idx" ON "tenant_bas_pack_authorizations"("tenant_id", "pack", "scope_id");
CREATE INDEX "tenant_bas_pack_authorizations_approver_user_id_idx" ON "tenant_bas_pack_authorizations"("approver_user_id");
CREATE INDEX "tenant_bas_pack_authorizations_scope_id_idx" ON "tenant_bas_pack_authorizations"("scope_id");

ALTER TABLE "bas_pack_qualifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_pack_qualifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY bas_pack_qualifications_read ON "bas_pack_qualifications" FOR SELECT
  USING (tenant_id = app_current_tenant());
CREATE POLICY bas_pack_qualifications_insert ON "bas_pack_qualifications" FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT ON "bas_pack_qualifications" TO periscan_rls;
REVOKE UPDATE, DELETE ON "bas_pack_qualifications" FROM periscan_rls;

ALTER TABLE "tenant_bas_pack_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_bas_pack_authorizations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_bas_pack_authorizations_read ON "tenant_bas_pack_authorizations" FOR SELECT
  USING (tenant_id = app_current_tenant());
CREATE POLICY tenant_bas_pack_authorizations_insert ON "tenant_bas_pack_authorizations" FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT ON "tenant_bas_pack_authorizations" TO periscan_rls;
REVOKE UPDATE, DELETE ON "tenant_bas_pack_authorizations" FROM periscan_rls;
