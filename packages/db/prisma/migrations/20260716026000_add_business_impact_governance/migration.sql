CREATE TABLE "asset_valuation_versions" (
  "asset_valuation_version_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "scenario_id" TEXT NOT NULL,
  "valuation" JSONB NOT NULL,
  "source_provenance" JSONB NOT NULL,
  "change_reason" TEXT NOT NULL,
  "input_digest" TEXT NOT NULL,
  "annualized_loss_exposure_usd" DOUBLE PRECISION NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMP(3),
  "review_reference" TEXT,
  "review_note" TEXT,
  "superseded_at" TIMESTAMP(3),
  CONSTRAINT "asset_valuation_versions_pkey" PRIMARY KEY ("asset_valuation_version_id"),
  CONSTRAINT "asset_valuation_versions_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "asset_valuation_versions_status_check" CHECK ("status" IN ('PendingReview', 'Approved', 'Rejected', 'Superseded')),
  CONSTRAINT "asset_valuation_versions_digest_check" CHECK ("input_digest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "asset_valuation_versions_exposure_check" CHECK ("annualized_loss_exposure_usd" >= 0),
  CONSTRAINT "asset_valuation_versions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "asset_valuation_versions_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "asset_valuation_versions_asset_id_sequence_key" ON "asset_valuation_versions"("asset_id", "sequence");
CREATE INDEX "asset_valuation_versions_tenant_id_status_created_at_idx" ON "asset_valuation_versions"("tenant_id", "status", "created_at");
CREATE INDEX "asset_valuation_versions_tenant_id_asset_id_created_at_idx" ON "asset_valuation_versions"("tenant_id", "asset_id", "created_at");

CREATE OR REPLACE FUNCTION protect_asset_valuation_version_content()
RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.asset_id IS DISTINCT FROM OLD.asset_id
     OR NEW.sequence IS DISTINCT FROM OLD.sequence
     OR NEW.scenario_id IS DISTINCT FROM OLD.scenario_id
     OR NEW.valuation IS DISTINCT FROM OLD.valuation
     OR NEW.source_provenance IS DISTINCT FROM OLD.source_provenance
     OR NEW.change_reason IS DISTINCT FROM OLD.change_reason
     OR NEW.input_digest IS DISTINCT FROM OLD.input_digest
     OR NEW.annualized_loss_exposure_usd IS DISTINCT FROM OLD.annualized_loss_exposure_usd
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'asset valuation version content is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER asset_valuation_version_content_immutable
BEFORE UPDATE ON "asset_valuation_versions"
FOR EACH ROW EXECUTE FUNCTION protect_asset_valuation_version_content();

ALTER TABLE "asset_valuation_versions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_valuation_versions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset_valuation_versions"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
