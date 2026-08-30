CREATE TABLE "asset_source_observations" (
  "source_observation_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "integration_id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "evidence_id" UUID NOT NULL,
  "source_asset_key" TEXT NOT NULL,
  "observed_type" "AssetType" NOT NULL,
  "observed_name" TEXT NOT NULL,
  "observed_identifiers" JSONB NOT NULL,
  "canonical_keys" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "resolution_status" TEXT NOT NULL,
  "resolution_confidence" DOUBLE PRECISION NOT NULL,
  "conflict_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "observed_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_source_observations_pkey" PRIMARY KEY ("source_observation_id")
);

CREATE INDEX "asset_source_observations_tenant_id_observed_at_idx" ON "asset_source_observations"("tenant_id", "observed_at");
CREATE INDEX "asset_source_observations_asset_id_observed_at_idx" ON "asset_source_observations"("asset_id", "observed_at");
CREATE INDEX "asset_source_observations_integration_id_observed_at_idx" ON "asset_source_observations"("integration_id", "observed_at");
CREATE INDEX "asset_source_observations_tenant_id_resolution_status_observed_at_idx" ON "asset_source_observations"("tenant_id", "resolution_status", "observed_at");

ALTER TABLE "asset_source_observations" ADD CONSTRAINT "asset_source_observations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_source_observations" ADD CONSTRAINT "asset_source_observations_integration_id_fkey" FOREIGN KEY ("integration_id") REFERENCES "integrations"("integration_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_source_observations" ADD CONSTRAINT "asset_source_observations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_source_observations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_source_observations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset_source_observations"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
