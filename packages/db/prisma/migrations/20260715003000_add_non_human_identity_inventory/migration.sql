ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'NonHumanIdentity';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'non_human_identity_registered';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'non_human_identity_updated';

CREATE TABLE "non_human_identities" (
    "non_human_identity_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "source_integration_id" UUID,
    "identity_type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "external_id_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "owner" TEXT,
    "environment" TEXT,
    "repository" TEXT,
    "privileges" JSONB NOT NULL,
    "resource_access" JSONB NOT NULL,
    "public_exposure" BOOLEAN NOT NULL DEFAULT false,
    "last_used_at" TIMESTAMP(3),
    "rotated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "credential_fingerprint" TEXT,
    "risk_score" INTEGER NOT NULL,
    "risk_level" TEXT NOT NULL,
    "risk_flags" JSONB NOT NULL,
    "risk_rationales" JSONB NOT NULL,
    "evidence_ids" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "non_human_identities_pkey" PRIMARY KEY ("non_human_identity_id")
);

CREATE UNIQUE INDEX "non_human_identities_tenant_id_provider_external_id_hash_key"
ON "non_human_identities"("tenant_id", "provider", "external_id_hash");
CREATE INDEX "non_human_identities_tenant_id_risk_score_idx"
ON "non_human_identities"("tenant_id", "risk_score");
CREATE INDEX "non_human_identities_tenant_id_identity_type_idx"
ON "non_human_identities"("tenant_id", "identity_type");
CREATE INDEX "non_human_identities_source_integration_id_idx"
ON "non_human_identities"("source_integration_id");

ALTER TABLE "non_human_identities"
ADD CONSTRAINT "non_human_identities_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "non_human_identities"
ADD CONSTRAINT "non_human_identities_source_integration_id_fkey"
FOREIGN KEY ("source_integration_id") REFERENCES "integrations"("integration_id") ON DELETE SET NULL ON UPDATE CASCADE;
