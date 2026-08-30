-- P2.c: add tenant foreign keys to model-gateway and webhook-delivery tables so
-- tenant_id is a real isolation guardrail and rows cascade on tenant delete.
-- Additive only: the tenant_id columns and their indexes already exist.

ALTER TABLE "webhook_deliveries"
  ADD CONSTRAINT "webhook_deliveries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "context_bundles"
  ADD CONSTRAINT "context_bundles_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "model_tool_requests"
  ADD CONSTRAINT "model_tool_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "model_tool_results"
  ADD CONSTRAINT "model_tool_results_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "model_gateway_audit_events"
  ADD CONSTRAINT "model_gateway_audit_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
