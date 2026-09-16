ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ScenarioBundle';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'scenario_compiled';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'scenario_approved';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'scenario_executed';

CREATE TABLE "scenario_bundles" (
  "scenario_bundle_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "scope_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "intent" TEXT NOT NULL,
  "bundle_version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL,
  "allowed_scope_types" TEXT[] NOT NULL,
  "technique_ids" TEXT[] NOT NULL,
  "prerequisites" JSONB NOT NULL,
  "steps" JSONB NOT NULL,
  "expected_observations" JSONB NOT NULL,
  "maximum_iterations" INTEGER NOT NULL DEFAULT 1,
  "safety_ceiling" "SafetyLevel" NOT NULL,
  "legal_classification" TEXT NOT NULL,
  "source" JSONB NOT NULL,
  "sbom" JSONB NOT NULL,
  "compiled_hash" TEXT NOT NULL,
  "signature" JSONB NOT NULL,
  "approved_by" UUID,
  "approved_at" TIMESTAMP(3),
  "compiled_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "scenario_bundles_pkey" PRIMARY KEY ("scenario_bundle_id")
);

ALTER TABLE "engagements"
ADD COLUMN "scenario_bundle_id" UUID,
ADD COLUMN "compiled_hash" TEXT;

CREATE UNIQUE INDEX "scenario_bundles_tenant_id_compiled_hash_key"
ON "scenario_bundles"("tenant_id", "compiled_hash");
CREATE INDEX "scenario_bundles_tenant_id_created_at_idx"
ON "scenario_bundles"("tenant_id", "created_at");
CREATE INDEX "scenario_bundles_scope_id_idx"
ON "scenario_bundles"("scope_id");
CREATE INDEX "scenario_bundles_tenant_id_status_idx"
ON "scenario_bundles"("tenant_id", "status");
CREATE INDEX "engagements_scenario_bundle_id_idx"
ON "engagements"("scenario_bundle_id");

ALTER TABLE "scenario_bundles"
ADD CONSTRAINT "scenario_bundles_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scenario_bundles"
ADD CONSTRAINT "scenario_bundles_scope_id_fkey"
FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "engagements"
ADD CONSTRAINT "engagements_scenario_bundle_id_fkey"
FOREIGN KEY ("scenario_bundle_id") REFERENCES "scenario_bundles"("scenario_bundle_id") ON DELETE SET NULL ON UPDATE CASCADE;
