-- Fortune 1000 named sites: CIDR blocks, AD domains, bound inside runners.
-- Additive catalog only. Empty is honest empty — do not seed HQ/DC/branch maps.

CREATE TABLE "enterprise_sites" (
  "site_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "cidrs" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "ad_domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "runner_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "enterprise_sites_pkey" PRIMARY KEY ("site_id"),
  CONSTRAINT "enterprise_sites_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "enterprise_sites_tenant_id_created_at_idx"
  ON "enterprise_sites"("tenant_id", "created_at");

ALTER TABLE "enterprise_sites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enterprise_sites" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "enterprise_sites"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());
