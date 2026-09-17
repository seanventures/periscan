-- Row-Level Security tenant-isolation BACKSTOP (defense-in-depth).
--
-- The app enforces tenancy today with hand-written WHERE tenant_id = ... filters.
-- This adds a database-level safety net so a query that FORGETS that filter still
-- cannot cross tenants -- provided it runs bound to a tenant via the
-- app.current_tenant GUC (see runWithTenantRls in @periscan/db).
--
-- NON-BREAKING BY DESIGN: the policy PERMITS every row when the GUC is unset, so
-- the existing app (which does not set the GUC and relies on its manual filters,
-- plus legitimate cross-tenant paths like login/SSO/MSSP rollups) is unaffected.
-- Enforcement only bites for connections that opt in by setting app.current_tenant.
-- The app connects as the table owner, so FORCE ROW LEVEL SECURITY is required
-- (owners bypass plain RLS).

CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS uuid AS $$
  SELECT nullif(current_setting('app.current_tenant', true), '')::uuid
$$ LANGUAGE sql STABLE;

ALTER TABLE "advisory_impact_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "advisory_impact_assessments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "advisory_impact_assessments";
CREATE POLICY tenant_isolation ON "advisory_impact_assessments"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "advisory_readiness_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "advisory_readiness_reports" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "advisory_readiness_reports";
CREATE POLICY tenant_isolation ON "advisory_readiness_reports"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "ai_applications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ai_applications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ai_applications";
CREATE POLICY tenant_isolation ON "ai_applications"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "assets";
CREATE POLICY tenant_isolation ON "assets"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "attack_paths" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attack_paths" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "attack_paths";
CREATE POLICY tenant_isolation ON "attack_paths"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "audit_events";
CREATE POLICY tenant_isolation ON "audit_events"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "context_bundles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "context_bundles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "context_bundles";
CREATE POLICY tenant_isolation ON "context_bundles"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "control_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "control_sources" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "control_sources";
CREATE POLICY tenant_isolation ON "control_sources"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "engagements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "engagements" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "engagements";
CREATE POLICY tenant_isolation ON "engagements"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "evidence_artifacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_artifacts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "evidence_artifacts";
CREATE POLICY tenant_isolation ON "evidence_artifacts"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "evidence_pack_analyst_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_pack_analyst_notes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "evidence_pack_analyst_notes";
CREATE POLICY tenant_isolation ON "evidence_pack_analyst_notes"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "evidence_packs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evidence_packs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "evidence_packs";
CREATE POLICY tenant_isolation ON "evidence_packs"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "executive_metric_snapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "executive_metric_snapshots" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "executive_metric_snapshots";
CREATE POLICY tenant_isolation ON "executive_metric_snapshots"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "exposures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exposures" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "exposures";
CREATE POLICY tenant_isolation ON "exposures"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "finding_dispositions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finding_dispositions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "finding_dispositions";
CREATE POLICY tenant_isolation ON "finding_dispositions"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "graph_edges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "graph_edges" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "graph_edges";
CREATE POLICY tenant_isolation ON "graph_edges"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "graph_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "graph_nodes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "graph_nodes";
CREATE POLICY tenant_isolation ON "graph_nodes"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "identities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "identities" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "identities";
CREATE POLICY tenant_isolation ON "identities"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "integrations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "integrations";
CREATE POLICY tenant_isolation ON "integrations"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "jobs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "jobs";
CREATE POLICY tenant_isolation ON "jobs"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "memberships" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "memberships";
CREATE POLICY tenant_isolation ON "memberships"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "missing_signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "missing_signals" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "missing_signals";
CREATE POLICY tenant_isolation ON "missing_signals"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "mission_schedules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mission_schedules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "mission_schedules";
CREATE POLICY tenant_isolation ON "mission_schedules"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "model_gateway_audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_gateway_audit_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "model_gateway_audit_events";
CREATE POLICY tenant_isolation ON "model_gateway_audit_events"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "model_policy_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_policy_profiles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "model_policy_profiles";
CREATE POLICY tenant_isolation ON "model_policy_profiles"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "model_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_providers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "model_providers";
CREATE POLICY tenant_isolation ON "model_providers"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "model_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "model_sessions";
CREATE POLICY tenant_isolation ON "model_sessions"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "model_tool_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_tool_requests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "model_tool_requests";
CREATE POLICY tenant_isolation ON "model_tool_requests"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "model_tool_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_tool_results" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "model_tool_results";
CREATE POLICY tenant_isolation ON "model_tool_results"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "model_tools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_tools" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "model_tools";
CREATE POLICY tenant_isolation ON "model_tools"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "path_breakers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "path_breakers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "path_breakers";
CREATE POLICY tenant_isolation ON "path_breakers"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "path_edges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "path_edges" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "path_edges";
CREATE POLICY tenant_isolation ON "path_edges"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "path_nodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "path_nodes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "path_nodes";
CREATE POLICY tenant_isolation ON "path_nodes"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "policy_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "policy_decisions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "policy_decisions";
CREATE POLICY tenant_isolation ON "policy_decisions"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "remediation_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "remediation_tasks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "remediation_tasks";
CREATE POLICY tenant_isolation ON "remediation_tasks"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "runner_certificate_authorities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "runner_certificate_authorities" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "runner_certificate_authorities";
CREATE POLICY tenant_isolation ON "runner_certificate_authorities"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "runner_registration_tokens" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "runner_registration_tokens" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "runner_registration_tokens";
CREATE POLICY tenant_isolation ON "runner_registration_tokens"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "runner_task_signing_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "runner_task_signing_keys" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "runner_task_signing_keys";
CREATE POLICY tenant_isolation ON "runner_task_signing_keys"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "runner_tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "runner_tasks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "runner_tasks";
CREATE POLICY tenant_isolation ON "runner_tasks"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "runners" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "runners" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "runners";
CREATE POLICY tenant_isolation ON "runners"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "scopes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scopes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "scopes";
CREATE POLICY tenant_isolation ON "scopes"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "signal_trigger_routing_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signal_trigger_routing_settings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "signal_trigger_routing_settings";
CREATE POLICY tenant_isolation ON "signal_trigger_routing_settings"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "signals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "signals" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "signals";
CREATE POLICY tenant_isolation ON "signals"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "tenant_api_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_api_keys" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_api_keys";
CREATE POLICY tenant_isolation ON "tenant_api_keys"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "tenant_design_partner_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_design_partner_settings" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_design_partner_settings";
CREATE POLICY tenant_isolation ON "tenant_design_partner_settings"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "tenant_report_branding" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_report_branding" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_report_branding";
CREATE POLICY tenant_isolation ON "tenant_report_branding"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "tenant_sso_auth_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_sso_auth_requests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_sso_auth_requests";
CREATE POLICY tenant_isolation ON "tenant_sso_auth_requests"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "tenant_sso_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_sso_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_sso_configs";
CREATE POLICY tenant_isolation ON "tenant_sso_configs"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "tenant_threat_alerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_threat_alerts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_threat_alerts";
CREATE POLICY tenant_isolation ON "tenant_threat_alerts"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "tenant_webhooks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_webhooks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "tenant_webhooks";
CREATE POLICY tenant_isolation ON "tenant_webhooks"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "third_party_tool_candidates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "third_party_tool_candidates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "third_party_tool_candidates";
CREATE POLICY tenant_isolation ON "third_party_tool_candidates"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "third_party_tool_implementation_work_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "third_party_tool_implementation_work_orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "third_party_tool_implementation_work_orders";
CREATE POLICY tenant_isolation ON "third_party_tool_implementation_work_orders"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "third_party_tool_install_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "third_party_tool_install_jobs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "third_party_tool_install_jobs";
CREATE POLICY tenant_isolation ON "third_party_tool_install_jobs"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "third_party_tool_policies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "third_party_tool_policies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "third_party_tool_policies";
CREATE POLICY tenant_isolation ON "third_party_tool_policies"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "third_party_tool_promotion_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "third_party_tool_promotion_certifications" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "third_party_tool_promotion_certifications";
CREATE POLICY tenant_isolation ON "third_party_tool_promotion_certifications"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "third_party_tool_promotion_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "third_party_tool_promotion_packages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "third_party_tool_promotion_packages";
CREATE POLICY tenant_isolation ON "third_party_tool_promotion_packages"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "third_party_tool_update_recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "third_party_tool_update_recommendations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "third_party_tool_update_recommendations";
CREATE POLICY tenant_isolation ON "third_party_tool_update_recommendations"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "third_party_tool_upstream_version_checks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "third_party_tool_upstream_version_checks" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "third_party_tool_upstream_version_checks";
CREATE POLICY tenant_isolation ON "third_party_tool_upstream_version_checks"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "threat_advisories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "threat_advisories" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "threat_advisories";
CREATE POLICY tenant_isolation ON "threat_advisories"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "threat_packages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "threat_packages" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "threat_packages";
CREATE POLICY tenant_isolation ON "threat_packages"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "threat_validation_plan_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "threat_validation_plan_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "threat_validation_plan_items";
CREATE POLICY tenant_isolation ON "threat_validation_plan_items"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "threat_validation_plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "threat_validation_plans" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "threat_validation_plans";
CREATE POLICY tenant_isolation ON "threat_validation_plans"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "validation_missions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "validation_missions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "validation_missions";
CREATE POLICY tenant_isolation ON "validation_missions"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "validation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "validation_runs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "validation_runs";
CREATE POLICY tenant_isolation ON "validation_runs"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "verification_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "verification_events";
CREATE POLICY tenant_isolation ON "verification_events"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

ALTER TABLE "webhook_deliveries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_deliveries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "webhook_deliveries";
CREATE POLICY tenant_isolation ON "webhook_deliveries"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());

