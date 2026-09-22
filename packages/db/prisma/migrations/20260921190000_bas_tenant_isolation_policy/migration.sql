-- Proof-pack inspector requires policyname = tenant_isolation on tenant-scoped
-- tables. BAS campaign/content/qualification tables already have FORCE RLS and
-- per-operation policies; add the named backstop used by other tenant tables.

ALTER TABLE "bas_campaign_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_campaign_plans" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "bas_campaign_plans";
CREATE POLICY tenant_isolation ON "bas_campaign_plans"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "bas_campaign_step_cleanups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_campaign_step_cleanups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "bas_campaign_step_cleanups";
CREATE POLICY tenant_isolation ON "bas_campaign_step_cleanups"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "bas_content_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_content_versions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "bas_content_versions";
CREATE POLICY tenant_isolation ON "bas_content_versions"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "bas_content_version_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_content_version_reviews" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "bas_content_version_reviews";
CREATE POLICY tenant_isolation ON "bas_content_version_reviews"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "bas_pack_qualifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_pack_qualifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "bas_pack_qualifications";
CREATE POLICY tenant_isolation ON "bas_pack_qualifications"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "tenant_bas_pack_authorizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_bas_pack_authorizations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_bas_pack_authorizations";
CREATE POLICY tenant_isolation ON "tenant_bas_pack_authorizations"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());
