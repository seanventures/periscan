-- Inbound SCIM 2.0 for Periscan tenant memberships.
-- Additive: hashed tenant SCIM tokens, SCIM groups, membership Inactive
-- deprovision. Does not rewrite users or evidence.

ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'user_scim_provisioned';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'user_scim_deprovisioned';

DO $$ BEGIN
  CREATE TYPE "MembershipStatus" AS ENUM ('Active', 'Inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "memberships"
  ADD COLUMN IF NOT EXISTS "status" "MembershipStatus" NOT NULL DEFAULT 'Active';

CREATE INDEX IF NOT EXISTS "memberships_tenant_id_status_idx"
  ON "memberships"("tenant_id", "status");

CREATE TABLE "scim_tokens" (
  "scim_token_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "token_prefix" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "created_by" UUID,
  "last_used_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scim_tokens_pkey" PRIMARY KEY ("scim_token_id"),
  CONSTRAINT "scim_tokens_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "scim_tokens_token_hash_key" ON "scim_tokens"("token_hash");
CREATE INDEX "scim_tokens_tenant_id_created_at_idx"
  ON "scim_tokens"("tenant_id", "created_at");

CREATE TABLE "scim_groups" (
  "scim_group_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "display_name" TEXT NOT NULL,
  "external_id" TEXT,
  "members" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scim_groups_pkey" PRIMARY KEY ("scim_group_id"),
  CONSTRAINT "scim_groups_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "scim_groups_tenant_id_display_name_key"
  ON "scim_groups"("tenant_id", "display_name");
CREATE INDEX "scim_groups_tenant_id_created_at_idx"
  ON "scim_groups"("tenant_id", "created_at");

ALTER TABLE "scim_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scim_tokens" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scim_tokens"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "scim_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scim_groups" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "scim_groups"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());
