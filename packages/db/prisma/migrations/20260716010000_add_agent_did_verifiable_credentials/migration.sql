CREATE TABLE "agent_did_trust_profiles" (
  "agent_did_trust_profile_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "agent_protocol_endpoint_id" UUID NOT NULL,
  "scope_id" UUID NOT NULL,
  "policy_decision_id" UUID NOT NULL,
  "subject_did" TEXT NOT NULL,
  "issuer_did" TEXT NOT NULL,
  "allowed_credential_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "expected_audience" TEXT NOT NULL,
  "expected_endpoint_origin" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Active',
  "subject_did_document_hash" TEXT NOT NULL,
  "issuer_did_document_hash" TEXT NOT NULL,
  "subject_resolution_url" TEXT NOT NULL,
  "issuer_resolution_url" TEXT NOT NULL,
  "subject_resolved_at" TIMESTAMP(3) NOT NULL,
  "issuer_resolved_at" TIMESTAMP(3) NOT NULL,
  "authorization_reason" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "revoked_by" UUID,
  "revocation_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_did_trust_profiles_pkey" PRIMARY KEY ("agent_did_trust_profile_id"),
  CONSTRAINT "agent_did_trust_profiles_status_check" CHECK ("status" IN ('Active', 'Revoked')),
  CONSTRAINT "agent_did_trust_profiles_subject_hash_check" CHECK ("subject_did_document_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "agent_did_trust_profiles_issuer_hash_check" CHECK ("issuer_did_document_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "agent_did_trust_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_did_trust_profiles_agent_protocol_endpoint_id_fkey" FOREIGN KEY ("agent_protocol_endpoint_id") REFERENCES "agent_protocol_endpoints"("agent_protocol_endpoint_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_did_trust_profiles_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_did_trust_profiles_policy_decision_id_fkey" FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "agent_did_trust_profiles_tenant_id_status_updated_at_idx" ON "agent_did_trust_profiles"("tenant_id", "status", "updated_at");
CREATE INDEX "agent_did_trust_profiles_agent_protocol_endpoint_id_status_idx" ON "agent_did_trust_profiles"("agent_protocol_endpoint_id", "status");
CREATE INDEX "agent_did_trust_profiles_scope_id_created_at_idx" ON "agent_did_trust_profiles"("scope_id", "created_at");

CREATE TABLE "agent_verifiable_credentials" (
  "agent_verifiable_credential_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "agent_did_trust_profile_id" UUID NOT NULL,
  "credential_id" TEXT,
  "issuer_did" TEXT NOT NULL,
  "subject_did" TEXT NOT NULL,
  "credential_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowed_capabilities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "workload_id" TEXT,
  "valid_from" TIMESTAMP(3),
  "valid_until" TIMESTAMP(3),
  "verification_method_id" TEXT,
  "algorithm" TEXT,
  "credential_hash" TEXT NOT NULL,
  "claims_hash" TEXT NOT NULL,
  "issuer_did_document_hash" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "findings" JSONB NOT NULL DEFAULT '[]',
  "verified_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "agent_verifiable_credentials_pkey" PRIMARY KEY ("agent_verifiable_credential_id"),
  CONSTRAINT "agent_verifiable_credentials_status_check" CHECK ("status" IN ('Verified', 'Rejected', 'Revoked', 'Expired')),
  CONSTRAINT "agent_verifiable_credentials_credential_hash_check" CHECK ("credential_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "agent_verifiable_credentials_claims_hash_check" CHECK ("claims_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "agent_verifiable_credentials_issuer_hash_check" CHECK ("issuer_did_document_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "agent_verifiable_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "agent_verifiable_credentials_profile_id_fkey" FOREIGN KEY ("agent_did_trust_profile_id") REFERENCES "agent_did_trust_profiles"("agent_did_trust_profile_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "agent_verifiable_credentials_profile_hash_key" ON "agent_verifiable_credentials"("agent_did_trust_profile_id", "credential_hash");
CREATE INDEX "agent_verifiable_credentials_tenant_id_status_verified_at_idx" ON "agent_verifiable_credentials"("tenant_id", "status", "verified_at");
CREATE INDEX "agent_verifiable_credentials_profile_id_status_valid_until_idx" ON "agent_verifiable_credentials"("agent_did_trust_profile_id", "status", "valid_until");

ALTER TABLE "agent_signed_receipts" ADD COLUMN "agent_verifiable_credential_id" UUID;
ALTER TABLE "agent_signed_receipts" ADD CONSTRAINT "agent_signed_receipts_agent_verifiable_credential_id_fkey"
  FOREIGN KEY ("agent_verifiable_credential_id") REFERENCES "agent_verifiable_credentials"("agent_verifiable_credential_id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "agent_signed_receipts_agent_verifiable_credential_id_idx" ON "agent_signed_receipts"("agent_verifiable_credential_id");

ALTER TABLE "agent_did_trust_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_did_trust_profiles" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agent_did_trust_profiles"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "agent_verifiable_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "agent_verifiable_credentials" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "agent_verifiable_credentials"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
