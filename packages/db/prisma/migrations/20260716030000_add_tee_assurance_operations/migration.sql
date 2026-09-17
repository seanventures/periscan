ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'tee_assurance_requirement_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'tee_assurance_evaluated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'tee_assurance_revoked';

CREATE TABLE "tee_assurance_requirements" (
  "tee_assurance_requirement_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "scope_id" UUID NOT NULL,
  "policy_decision_id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "workload_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "verifier_type" TEXT NOT NULL,
  "expected_measurement" TEXT,
  "expected_region" TEXT,
  "evidence_media_type" TEXT,
  "require_secure_boot" BOOLEAN NOT NULL DEFAULT false,
  "require_debug_disabled" BOOLEAN NOT NULL DEFAULT false,
  "max_attestation_age_minutes" INTEGER NOT NULL DEFAULT 10,
  "qualification_validity_minutes" INTEGER NOT NULL DEFAULT 60,
  "support_owner" TEXT NOT NULL,
  "escalation_reference" TEXT NOT NULL,
  "policy_reference" TEXT NOT NULL,
  "authorization_reason" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tee_assurance_requirements_pkey" PRIMARY KEY ("tee_assurance_requirement_id"),
  CONSTRAINT "tee_assurance_requirements_provider_check" CHECK ("provider" IN ('ArmPSA', 'ArmCCA', 'AMDSEVSNP', 'TPM')),
  CONSTRAINT "tee_assurance_requirements_verifier_check" CHECK ("verifier_type" = 'Veraison'),
  CONSTRAINT "tee_assurance_requirements_measurement_check" CHECK ("expected_measurement" IS NULL OR "expected_measurement" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "tee_assurance_requirements_age_check" CHECK ("max_attestation_age_minutes" BETWEEN 1 AND 1440),
  CONSTRAINT "tee_assurance_requirements_validity_check" CHECK ("qualification_validity_minutes" BETWEEN 5 AND 10080),
  CONSTRAINT "tee_assurance_requirements_workload_check" CHECK (char_length("workload_id") BETWEEN 3 AND 240),
  CONSTRAINT "tee_assurance_requirements_owner_check" CHECK (char_length("support_owner") BETWEEN 3 AND 160),
  CONSTRAINT "tee_assurance_requirements_escalation_check" CHECK (char_length("escalation_reference") BETWEEN 3 AND 240),
  CONSTRAINT "tee_assurance_requirements_policy_check" CHECK (char_length("policy_reference") BETWEEN 3 AND 240),
  CONSTRAINT "tee_assurance_requirements_reason_check" CHECK (char_length("authorization_reason") BETWEEN 10 AND 1000),
  CONSTRAINT "tee_assurance_requirements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tee_assurance_requirements_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tee_assurance_requirements_policy_decision_id_fkey" FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "tee_assurance_decisions" (
  "tee_assurance_decision_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tee_assurance_requirement_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "attestation_id" UUID NOT NULL,
  "decision_type" TEXT NOT NULL,
  "findings" JSONB NOT NULL,
  "decision_reason" TEXT NOT NULL,
  "decision_reference" TEXT NOT NULL,
  "attestation_raw_claims_hash" TEXT NOT NULL,
  "attestation_result_claims_hash" TEXT,
  "attestation_checked_at" TIMESTAMP(3) NOT NULL,
  "qualified_until" TIMESTAMP(3),
  "decided_by" UUID NOT NULL,
  "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tee_assurance_decisions_pkey" PRIMARY KEY ("tee_assurance_decision_id"),
  CONSTRAINT "tee_assurance_decisions_type_check" CHECK ("decision_type" IN ('Qualified', 'Rejected', 'Revoked')),
  CONSTRAINT "tee_assurance_decisions_findings_check" CHECK (jsonb_typeof("findings") = 'array'),
  CONSTRAINT "tee_assurance_decisions_qualified_check" CHECK (("decision_type" = 'Qualified' AND "qualified_until" IS NOT NULL) OR ("decision_type" <> 'Qualified' AND "qualified_until" IS NULL)),
  CONSTRAINT "tee_assurance_decisions_raw_hash_check" CHECK ("attestation_raw_claims_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "tee_assurance_decisions_result_hash_check" CHECK ("attestation_result_claims_hash" IS NULL OR "attestation_result_claims_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "tee_assurance_decisions_reason_check" CHECK (char_length("decision_reason") BETWEEN 10 AND 1000),
  CONSTRAINT "tee_assurance_decisions_reference_check" CHECK (char_length("decision_reference") BETWEEN 3 AND 240),
  CONSTRAINT "tee_assurance_decisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tee_assurance_decisions_requirement_id_fkey" FOREIGN KEY ("tee_assurance_requirement_id") REFERENCES "tee_assurance_requirements"("tee_assurance_requirement_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "tee_assurance_decisions_attestation_id_fkey" FOREIGN KEY ("attestation_id") REFERENCES "confidential_attestations"("confidential_attestation_id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "tee_assurance_requirements_tenant_id_created_at_idx" ON "tee_assurance_requirements"("tenant_id", "created_at");
CREATE INDEX "tee_assurance_requirements_tenant_id_workload_id_created_at_idx" ON "tee_assurance_requirements"("tenant_id", "workload_id", "created_at");
CREATE INDEX "tee_assurance_requirements_scope_id_created_at_idx" ON "tee_assurance_requirements"("scope_id", "created_at");
CREATE INDEX "tee_assurance_requirements_policy_decision_id_idx" ON "tee_assurance_requirements"("policy_decision_id");
CREATE INDEX "tee_assurance_decisions_tenant_id_decided_at_idx" ON "tee_assurance_decisions"("tenant_id", "decided_at");
CREATE INDEX "tee_assurance_decisions_tee_assurance_requirement_id_decided_at_idx" ON "tee_assurance_decisions"("tee_assurance_requirement_id", "decided_at");
CREATE INDEX "tee_assurance_decisions_attestation_id_idx" ON "tee_assurance_decisions"("attestation_id");

CREATE OR REPLACE FUNCTION protect_tee_assurance_immutable_rows()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'TEE assurance requirements and decisions are immutable; create a new receipt';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tee_assurance_requirements_immutable
BEFORE UPDATE ON "tee_assurance_requirements"
FOR EACH ROW EXECUTE FUNCTION protect_tee_assurance_immutable_rows();

CREATE TRIGGER tee_assurance_decisions_immutable
BEFORE UPDATE ON "tee_assurance_decisions"
FOR EACH ROW EXECUTE FUNCTION protect_tee_assurance_immutable_rows();

CREATE OR REPLACE FUNCTION validate_tee_assurance_decision_tenant()
RETURNS trigger AS $$
DECLARE
  requirement_tenant UUID;
  attestation_tenant UUID;
BEGIN
  SELECT tenant_id INTO requirement_tenant
  FROM "tee_assurance_requirements"
  WHERE tee_assurance_requirement_id = NEW.tee_assurance_requirement_id;

  SELECT tenant_id INTO attestation_tenant
  FROM "confidential_attestations"
  WHERE confidential_attestation_id = NEW.attestation_id;

  IF requirement_tenant IS NULL OR attestation_tenant IS NULL
     OR NEW.tenant_id IS DISTINCT FROM requirement_tenant
     OR NEW.tenant_id IS DISTINCT FROM attestation_tenant THEN
    RAISE EXCEPTION 'TEE assurance decision tenant must match requirement and attestation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tee_assurance_decision_tenant_guard
BEFORE INSERT ON "tee_assurance_decisions"
FOR EACH ROW EXECUTE FUNCTION validate_tee_assurance_decision_tenant();

ALTER TABLE "tee_assurance_requirements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tee_assurance_requirements" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tee_assurance_requirements"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "tee_assurance_decisions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tee_assurance_decisions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tee_assurance_decisions"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
