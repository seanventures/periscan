-- Backfill tenant RLS on tool_license_acceptances.
-- 20260729030000 created the table without ENABLE/FORCE RLS or tenant_isolation.

ALTER TABLE "tool_license_acceptances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tool_license_acceptances" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tool_license_acceptances";
CREATE POLICY tenant_isolation ON "tool_license_acceptances"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());
