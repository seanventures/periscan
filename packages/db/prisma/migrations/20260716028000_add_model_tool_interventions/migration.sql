CREATE TYPE "ModelToolInterventionStatus" AS ENUM (
  'Pending',
  'Resumed',
  'Cancelled',
  'Expired',
  'Superseded'
);

ALTER TYPE "ModelGatewayEventType" ADD VALUE IF NOT EXISTS 'InterventionLinkIssued';
ALTER TYPE "ModelGatewayEventType" ADD VALUE IF NOT EXISTS 'InterventionResumed';
ALTER TYPE "ModelGatewayEventType" ADD VALUE IF NOT EXISTS 'InterventionCancelled';
ALTER TYPE "ModelGatewayEventType" ADD VALUE IF NOT EXISTS 'InterventionExpired';
ALTER TYPE "ModelGatewayEventType" ADD VALUE IF NOT EXISTS 'InterventionRejected';

CREATE TABLE "model_tool_interventions" (
  "intervention_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "tool_request_id" UUID NOT NULL,
  "model_session_id" UUID NOT NULL,
  "tool_name" TEXT NOT NULL,
  "request_reason" TEXT NOT NULL,
  "input_payload_hash" TEXT NOT NULL,
  "scope_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "policy_decision_id" UUID,
  "policy_profile_name" TEXT NOT NULL,
  "session_mode" TEXT NOT NULL,
  "session_purpose" TEXT NOT NULL,
  "envelope_hash" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "transport" TEXT NOT NULL,
  "status" "ModelToolInterventionStatus" NOT NULL DEFAULT 'Pending',
  "issued_by" UUID NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "decision" TEXT,
  "decision_reason" TEXT,
  "review_reference" TEXT,
  "decision_by" UUID,
  "decision_at" TIMESTAMP(3),
  CONSTRAINT "model_tool_interventions_pkey" PRIMARY KEY ("intervention_id"),
  CONSTRAINT "model_tool_interventions_input_hash_check" CHECK ("input_payload_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "model_tool_interventions_envelope_hash_check" CHECK ("envelope_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "model_tool_interventions_token_hash_check" CHECK ("token_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "model_tool_interventions_transport_check" CHECK ("transport" IN ('CopyLink', 'Slack', 'Teams', 'Other')),
  CONSTRAINT "model_tool_interventions_decision_check" CHECK ("decision" IS NULL OR "decision" IN ('Resume', 'Cancel')),
  CONSTRAINT "model_tool_interventions_decision_pair_check" CHECK (
    ("status" = 'Pending' AND "decision" IS NULL AND "decision_by" IS NULL AND "decision_at" IS NULL)
    OR ("status" IN ('Expired', 'Superseded') AND "decision" IS NULL)
    OR ("status" = 'Resumed' AND "decision" = 'Resume' AND "decision_by" IS NOT NULL AND "decision_at" IS NOT NULL)
    OR ("status" = 'Cancelled' AND "decision" = 'Cancel' AND "decision_by" IS NOT NULL AND "decision_at" IS NOT NULL)
  ),
  CONSTRAINT "model_tool_interventions_expiry_check" CHECK ("expires_at" > "issued_at"),
  CONSTRAINT "model_tool_interventions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "model_tool_interventions_tool_request_id_fkey" FOREIGN KEY ("tool_request_id") REFERENCES "model_tool_requests"("tool_request_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "model_tool_interventions_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "model_tool_interventions_decision_by_fkey" FOREIGN KEY ("decision_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "model_tool_interventions_token_hash_key" ON "model_tool_interventions"("token_hash");
CREATE INDEX "model_tool_interventions_tenant_id_status_issued_at_idx" ON "model_tool_interventions"("tenant_id", "status", "issued_at");
CREATE INDEX "model_tool_interventions_tool_request_id_issued_at_idx" ON "model_tool_interventions"("tool_request_id", "issued_at");

CREATE OR REPLACE FUNCTION protect_model_tool_intervention_envelope()
RETURNS trigger AS $$
BEGIN
  IF NEW.intervention_id IS DISTINCT FROM OLD.intervention_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.tool_request_id IS DISTINCT FROM OLD.tool_request_id
     OR NEW.model_session_id IS DISTINCT FROM OLD.model_session_id
     OR NEW.tool_name IS DISTINCT FROM OLD.tool_name
     OR NEW.request_reason IS DISTINCT FROM OLD.request_reason
     OR NEW.input_payload_hash IS DISTINCT FROM OLD.input_payload_hash
     OR NEW.scope_ids IS DISTINCT FROM OLD.scope_ids
     OR NEW.policy_decision_id IS DISTINCT FROM OLD.policy_decision_id
     OR NEW.policy_profile_name IS DISTINCT FROM OLD.policy_profile_name
     OR NEW.session_mode IS DISTINCT FROM OLD.session_mode
     OR NEW.session_purpose IS DISTINCT FROM OLD.session_purpose
     OR NEW.envelope_hash IS DISTINCT FROM OLD.envelope_hash
     OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
     OR NEW.transport IS DISTINCT FROM OLD.transport
     OR NEW.issued_by IS DISTINCT FROM OLD.issued_by
     OR NEW.issued_at IS DISTINCT FROM OLD.issued_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'model tool intervention envelope is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER model_tool_intervention_envelope_immutable
BEFORE UPDATE ON "model_tool_interventions"
FOR EACH ROW EXECUTE FUNCTION protect_model_tool_intervention_envelope();

ALTER TABLE "model_tool_interventions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "model_tool_interventions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "model_tool_interventions"
USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), NULLIF(current_setting('app.current_tenant', true), ''))::uuid)
WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), NULLIF(current_setting('app.current_tenant', true), ''))::uuid);
