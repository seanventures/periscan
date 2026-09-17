CREATE TABLE "agent_protocol_endpoints" (
  "agent_protocol_endpoint_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "protocol" TEXT NOT NULL,
  "endpoint_url" TEXT NOT NULL,
  "public_key_pem" TEXT,
  "trust_policy" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PendingReview',
  "review_reason" TEXT,
  "discovered_capabilities" JSONB NOT NULL DEFAULT '[]',
  "allowed_capability_names" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "discovered_at" TIMESTAMP(3),
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_protocol_endpoints_pkey" PRIMARY KEY ("agent_protocol_endpoint_id"),
  CONSTRAINT "agent_protocol_endpoints_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_protocol_endpoints_tenant_id_name_key" ON "agent_protocol_endpoints"("tenant_id", "name");
CREATE INDEX "agent_protocol_endpoints_tenant_id_status_updated_at_idx" ON "agent_protocol_endpoints"("tenant_id", "status", "updated_at");

CREATE TABLE "agent_signed_receipts" (
  "agent_signed_receipt_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "agent_protocol_endpoint_id" UUID NOT NULL,
  "receipt_kind" TEXT NOT NULL,
  "sender_workload_id" TEXT NOT NULL,
  "audience" TEXT NOT NULL,
  "payload_digest" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "issued_at" TIMESTAMP(3) NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "signature" TEXT NOT NULL,
  "evidence_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "verification_status" TEXT NOT NULL,
  "verification_reason" TEXT NOT NULL,
  "verified_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_signed_receipts_pkey" PRIMARY KEY ("agent_signed_receipt_id"),
  CONSTRAINT "agent_signed_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_signed_receipts_agent_protocol_endpoint_id_fkey" FOREIGN KEY ("agent_protocol_endpoint_id") REFERENCES "agent_protocol_endpoints"("agent_protocol_endpoint_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_signed_receipts_tenant_id_nonce_key" ON "agent_signed_receipts"("tenant_id", "nonce");
CREATE INDEX "agent_signed_receipts_tenant_id_verified_at_idx" ON "agent_signed_receipts"("tenant_id", "verified_at");

CREATE TABLE "agent_exchange_objects" (
  "agent_exchange_object_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "agent_protocol_endpoint_id" UUID NOT NULL,
  "signed_receipt_id" UUID,
  "parent_object_id" UUID,
  "idempotency_key" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'Submitted',
  "state_reason" TEXT,
  "payload_redacted" JSONB NOT NULL,
  "evidence_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_exchange_objects_pkey" PRIMARY KEY ("agent_exchange_object_id"),
  CONSTRAINT "agent_exchange_objects_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_exchange_objects_agent_protocol_endpoint_id_fkey" FOREIGN KEY ("agent_protocol_endpoint_id") REFERENCES "agent_protocol_endpoints"("agent_protocol_endpoint_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_exchange_objects_signed_receipt_id_fkey" FOREIGN KEY ("signed_receipt_id") REFERENCES "agent_signed_receipts"("agent_signed_receipt_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_exchange_objects_tenant_id_idempotency_key_key" ON "agent_exchange_objects"("tenant_id", "idempotency_key");
CREATE INDEX "agent_exchange_objects_tenant_id_state_updated_at_idx" ON "agent_exchange_objects"("tenant_id", "state", "updated_at");
CREATE INDEX "agent_exchange_objects_agent_protocol_endpoint_id_created_at_idx" ON "agent_exchange_objects"("agent_protocol_endpoint_id", "created_at");

CREATE TABLE "confidential_attestations" (
  "confidential_attestation_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workload_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "trust_anchor_configured" BOOLEAN NOT NULL,
  "signature_verified" BOOLEAN NOT NULL,
  "measurement" TEXT,
  "region" TEXT,
  "expires_at" TIMESTAMP(3),
  "raw_claims_hash" TEXT NOT NULL,
  "findings" JSONB NOT NULL,
  "checked_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "confidential_attestations_pkey" PRIMARY KEY ("confidential_attestation_id"),
  CONSTRAINT "confidential_attestations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "confidential_attestations_tenant_id_checked_at_idx" ON "confidential_attestations"("tenant_id", "checked_at");
CREATE INDEX "confidential_attestations_tenant_id_workload_id_checked_at_idx" ON "confidential_attestations"("tenant_id", "workload_id", "checked_at");

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'agent_protocol_endpoints',
    'agent_signed_receipts',
    'agent_exchange_objects',
    'confidential_attestations'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid) WITH CHECK (tenant_id = NULLIF(current_setting(''app.current_tenant_id'', true), '''')::uuid)',
      table_name
    );
  END LOOP;
END $$;
