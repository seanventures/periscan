CREATE TABLE "model_gateway_finops_configs" (
  "model_gateway_finops_config_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "monthly_limit_microusd" BIGINT NOT NULL,
  "per_minute_request_limit" INTEGER NOT NULL,
  "enforcement_enabled" BOOLEAN NOT NULL DEFAULT false,
  "routing_provider_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "provider_pricing" JSONB NOT NULL DEFAULT '[]',
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_gateway_finops_configs_pkey" PRIMARY KEY ("model_gateway_finops_config_id"),
  CONSTRAINT "model_gateway_finops_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "model_gateway_finops_configs_tenant_id_key" ON "model_gateway_finops_configs"("tenant_id");

CREATE TABLE "model_usage_events" (
  "model_usage_event_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "turn_id" UUID NOT NULL,
  "model_session_id" UUID NOT NULL,
  "model_provider_id" UUID NOT NULL,
  "model" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Enqueued',
  "input_tokens" INTEGER NOT NULL DEFAULT 0,
  "output_tokens" INTEGER NOT NULL DEFAULT 0,
  "cached_input_tokens" INTEGER NOT NULL DEFAULT 0,
  "cost_microusd" BIGINT,
  "pricing_status" TEXT NOT NULL DEFAULT 'Unpriced',
  "latency_ms" INTEGER,
  "routing_reason" TEXT NOT NULL,
  "failure_category" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "model_usage_events_pkey" PRIMARY KEY ("model_usage_event_id"),
  CONSTRAINT "model_usage_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "model_usage_events_model_session_id_fkey" FOREIGN KEY ("model_session_id") REFERENCES "model_sessions"("model_session_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "model_usage_events_model_provider_id_fkey" FOREIGN KEY ("model_provider_id") REFERENCES "model_providers"("model_provider_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "model_usage_events_turn_id_key" ON "model_usage_events"("turn_id");
CREATE INDEX "model_usage_events_tenant_id_created_at_idx" ON "model_usage_events"("tenant_id", "created_at");
CREATE INDEX "model_usage_events_tenant_id_status_created_at_idx" ON "model_usage_events"("tenant_id", "status", "created_at");
CREATE INDEX "model_usage_events_model_provider_id_created_at_idx" ON "model_usage_events"("model_provider_id", "created_at");

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'model_gateway_finops_configs',
    'model_usage_events'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;
