ALTER TABLE "model_semantic_cache_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_semantic_cache_entries" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "model_semantic_cache_entries"
USING (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
)
WITH CHECK (
  tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid
);
