CREATE TYPE "ScopeAssetClass" AS ENUM (
  'BusinessApplication',
  'Cloud',
  'Code',
  'Identity',
  'Network',
  'OT',
  'IoT',
  'Physical',
  'Other'
);

ALTER TABLE "scopes"
  ADD COLUMN "asset_class" "ScopeAssetClass" NOT NULL DEFAULT 'Other',
  ADD COLUMN "business_criticality" "BusinessCriticality" NOT NULL DEFAULT 'Moderate',
  ADD COLUMN "sensitivity" "SensitivityLevel" NOT NULL DEFAULT 'Moderate',
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "segment_name" TEXT,
  ADD COLUMN "purdue_level" TEXT,
  ADD COLUMN "max_safety_level" "SafetyLevel" NOT NULL DEFAULT 'ActiveNonInvasive',
  ADD COLUMN "external_validation_profile_id" TEXT;

CREATE INDEX "scopes_tenant_id_asset_class_idx"
  ON "scopes"("tenant_id", "asset_class");
