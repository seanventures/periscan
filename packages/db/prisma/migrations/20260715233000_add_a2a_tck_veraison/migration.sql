CREATE TABLE "a2a_tck_runs" (
  "a2a_tck_run_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "agent_protocol_endpoint_id" UUID NOT NULL,
  "scope_id" UUID NOT NULL,
  "policy_decision_id" UUID NOT NULL,
  "triggered_by" UUID NOT NULL,
  "authorization_reason" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "transports" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'Running',
  "tool_version" TEXT NOT NULL,
  "spec_version" TEXT,
  "overall_compatibility" DOUBLE PRECISION,
  "must_compatibility" DOUBLE PRECISION,
  "should_compatibility" DOUBLE PRECISION,
  "may_compatibility" DOUBLE PRECISION,
  "compatible" BOOLEAN NOT NULL DEFAULT false,
  "report_hash" TEXT,
  "requirement_results" JSONB NOT NULL DEFAULT '[]',
  "transport_results" JSONB NOT NULL DEFAULT '[]',
  "failure_reason" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "a2a_tck_runs_pkey" PRIMARY KEY ("a2a_tck_run_id"),
  CONSTRAINT "a2a_tck_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "a2a_tck_runs_agent_protocol_endpoint_id_fkey" FOREIGN KEY ("agent_protocol_endpoint_id") REFERENCES "agent_protocol_endpoints"("agent_protocol_endpoint_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "a2a_tck_runs_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "a2a_tck_runs_policy_decision_id_fkey" FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "a2a_tck_runs_level_check" CHECK ("level" IN ('all', 'must', 'should', 'may')),
  CONSTRAINT "a2a_tck_runs_status_check" CHECK ("status" IN ('Running', 'Completed', 'Failed', 'DeniedByPolicy')),
  CONSTRAINT "a2a_tck_runs_report_hash_check" CHECK ("report_hash" IS NULL OR "report_hash" ~ '^[a-f0-9]{64}$')
);

CREATE INDEX "a2a_tck_runs_tenant_id_started_at_idx" ON "a2a_tck_runs"("tenant_id", "started_at");
CREATE INDEX "a2a_tck_runs_agent_protocol_endpoint_id_started_at_idx" ON "a2a_tck_runs"("agent_protocol_endpoint_id", "started_at");
CREATE INDEX "a2a_tck_runs_scope_id_started_at_idx" ON "a2a_tck_runs"("scope_id", "started_at");

CREATE TABLE "veraison_attestation_sessions" (
  "veraison_session_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "scope_id" UUID NOT NULL,
  "policy_decision_id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "workload_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "verifier_origin" TEXT NOT NULL,
  "remote_session_url" TEXT NOT NULL,
  "nonce_hash" TEXT NOT NULL,
  "evidence_hash" TEXT,
  "accepted_media_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "state" TEXT NOT NULL DEFAULT 'Waiting',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "remote_result_hash" TEXT,
  "failure_reason" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "veraison_attestation_sessions_pkey" PRIMARY KEY ("veraison_session_id"),
  CONSTRAINT "veraison_attestation_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "veraison_attestation_sessions_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "veraison_attestation_sessions_policy_decision_id_fkey" FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "veraison_attestation_sessions_state_check" CHECK ("state" IN ('Waiting', 'Processing', 'Complete', 'Failed')),
  CONSTRAINT "veraison_attestation_sessions_nonce_hash_check" CHECK ("nonce_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "veraison_attestation_sessions_evidence_hash_check" CHECK ("evidence_hash" IS NULL OR "evidence_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "veraison_attestation_sessions_remote_result_hash_check" CHECK ("remote_result_hash" IS NULL OR "remote_result_hash" ~ '^[a-f0-9]{64}$')
);

CREATE INDEX "veraison_attestation_sessions_tenant_id_created_at_idx" ON "veraison_attestation_sessions"("tenant_id", "created_at");
CREATE INDEX "veraison_attestation_sessions_tenant_id_state_expires_at_idx" ON "veraison_attestation_sessions"("tenant_id", "state", "expires_at");
CREATE INDEX "veraison_attestation_sessions_scope_id_created_at_idx" ON "veraison_attestation_sessions"("scope_id", "created_at");

ALTER TABLE "confidential_attestations"
  ADD COLUMN "result_claims_hash" TEXT,
  ADD COLUMN "verifier_type" TEXT NOT NULL DEFAULT 'Native',
  ADD COLUMN "verifier_origin" TEXT,
  ADD COLUMN "evidence_media_type" TEXT,
  ADD COLUMN "veraison_session_id" UUID;

CREATE UNIQUE INDEX "confidential_attestations_veraison_session_id_key"
ON "confidential_attestations"("veraison_session_id");

ALTER TABLE "confidential_attestations"
  ADD CONSTRAINT "confidential_attestations_veraison_session_id_fkey"
  FOREIGN KEY ("veraison_session_id") REFERENCES "veraison_attestation_sessions"("veraison_session_id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "confidential_attestations_result_claims_hash_check"
  CHECK ("result_claims_hash" IS NULL OR "result_claims_hash" ~ '^[a-f0-9]{64}$'),
  ADD CONSTRAINT "confidential_attestations_verifier_type_check"
  CHECK ("verifier_type" IN ('Native', 'NvidiaNVAT', 'Veraison'));

ALTER TABLE "a2a_tck_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "a2a_tck_runs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "a2a_tck_runs"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "veraison_attestation_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "veraison_attestation_sessions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "veraison_attestation_sessions"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
