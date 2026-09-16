CREATE TABLE "agent_workflow_definitions" (
  "workflow_definition_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "definition_hash" TEXT NOT NULL,
  "steps" JSONB NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_workflow_definitions_pkey" PRIMARY KEY ("workflow_definition_id"),
  CONSTRAINT "agent_workflow_definitions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_workflow_definitions_tenant_id_name_version_key" ON "agent_workflow_definitions"("tenant_id", "name", "version");
CREATE INDEX "agent_workflow_definitions_tenant_id_created_at_idx" ON "agent_workflow_definitions"("tenant_id", "created_at");

CREATE TABLE "agent_workflow_runs" (
  "workflow_run_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workflow_definition_id" UUID NOT NULL,
  "definition_version" INTEGER NOT NULL,
  "model_session_id" UUID,
  "forked_from_run_id" UUID,
  "forked_from_checkpoint_id" UUID,
  "status" TEXT NOT NULL DEFAULT 'Created',
  "input_manifest" JSONB NOT NULL,
  "input_hash" TEXT NOT NULL,
  "policy_snapshot_hash" TEXT NOT NULL,
  "evidence_manifest_hash" TEXT NOT NULL,
  "policy_decision_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "evidence_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "reused_through_sequence" BIGINT,
  "created_by" UUID NOT NULL,
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_workflow_runs_pkey" PRIMARY KEY ("workflow_run_id"),
  CONSTRAINT "agent_workflow_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_workflow_runs_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "agent_workflow_definitions"("workflow_definition_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "agent_workflow_runs_model_session_id_fkey" FOREIGN KEY ("model_session_id") REFERENCES "model_sessions"("model_session_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_workflow_runs_model_session_id_key" ON "agent_workflow_runs"("model_session_id");
CREATE INDEX "agent_workflow_runs_tenant_id_created_at_idx" ON "agent_workflow_runs"("tenant_id", "created_at");
CREATE INDEX "agent_workflow_runs_tenant_id_status_idx" ON "agent_workflow_runs"("tenant_id", "status");
CREATE INDEX "agent_workflow_runs_workflow_definition_id_created_at_idx" ON "agent_workflow_runs"("workflow_definition_id", "created_at");

CREATE TABLE "agent_workflow_events" (
  "workflow_event_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workflow_run_id" UUID NOT NULL,
  "sequence" BIGINT NOT NULL,
  "event_type" TEXT NOT NULL,
  "step_key" TEXT,
  "payload_redacted" JSONB NOT NULL,
  "model_provider" TEXT,
  "model_version" TEXT,
  "tool_request_id" UUID,
  "policy_decision_id" UUID,
  "evidence_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "cost_microusd" BIGINT,
  "latency_ms" INTEGER,
  "previous_event_hash" TEXT,
  "event_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_workflow_events_pkey" PRIMARY KEY ("workflow_event_id"),
  CONSTRAINT "agent_workflow_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_workflow_events_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "agent_workflow_runs"("workflow_run_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_workflow_events_workflow_run_id_sequence_key" ON "agent_workflow_events"("workflow_run_id", "sequence");
CREATE INDEX "agent_workflow_events_tenant_id_created_at_idx" ON "agent_workflow_events"("tenant_id", "created_at");
CREATE INDEX "agent_workflow_events_workflow_run_id_created_at_idx" ON "agent_workflow_events"("workflow_run_id", "created_at");

CREATE TABLE "agent_workflow_checkpoints" (
  "workflow_checkpoint_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workflow_run_id" UUID NOT NULL,
  "sequence" BIGINT NOT NULL,
  "reusable_through_step_key" TEXT NOT NULL,
  "checkpoint_hash" TEXT NOT NULL,
  "input_hash" TEXT NOT NULL,
  "policy_snapshot_hash" TEXT NOT NULL,
  "evidence_manifest_hash" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "agent_workflow_checkpoints_pkey" PRIMARY KEY ("workflow_checkpoint_id"),
  CONSTRAINT "agent_workflow_checkpoints_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_workflow_checkpoints_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "agent_workflow_runs"("workflow_run_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_workflow_checkpoints_workflow_run_id_sequence_key" ON "agent_workflow_checkpoints"("workflow_run_id", "sequence");
CREATE INDEX "agent_workflow_checkpoints_tenant_id_created_at_idx" ON "agent_workflow_checkpoints"("tenant_id", "created_at");

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agent_workflow_definitions',
    'agent_workflow_runs',
    'agent_workflow_events',
    'agent_workflow_checkpoints'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;
