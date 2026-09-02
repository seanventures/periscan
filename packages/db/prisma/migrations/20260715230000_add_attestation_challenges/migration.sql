CREATE TABLE "confidential_attestation_challenges" (
  "challenge_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "workload_id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "nonce_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "confidential_attestation_challenges_pkey" PRIMARY KEY ("challenge_id"),
  CONSTRAINT "confidential_attestation_challenges_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "confidential_attestation_challenges_tenant_id_expires_at_used_at_idx"
ON "confidential_attestation_challenges"("tenant_id", "expires_at", "used_at");

ALTER TABLE "confidential_attestation_challenges" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "confidential_attestation_challenges" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "confidential_attestation_challenges"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
