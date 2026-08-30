DROP POLICY IF EXISTS tenant_isolation_engagement_workspaces ON "engagement_workspaces";
CREATE POLICY tenant_isolation ON "engagement_workspaces"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_engagement_collaborators ON "engagement_collaborators";
CREATE POLICY tenant_isolation ON "engagement_collaborators"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);

DROP POLICY IF EXISTS tenant_isolation_engagement_collaboration_events ON "engagement_collaboration_events";
CREATE POLICY tenant_isolation ON "engagement_collaboration_events"
  USING ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid)
  WITH CHECK ("tenant_id" = current_setting('app.current_tenant_id', true)::uuid);
