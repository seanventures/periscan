ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'asset_ownership_reviewed';

CREATE TABLE "asset_ownership_reviews" (
  "asset_ownership_review_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "asset_id" UUID NOT NULL,
  "disposition" TEXT NOT NULL,
  "note" TEXT NOT NULL,
  "reviewed_by" UUID NOT NULL,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "asset_ownership_reviews_pkey" PRIMARY KEY ("asset_ownership_review_id")
);

CREATE UNIQUE INDEX "asset_ownership_reviews_asset_id_key"
ON "asset_ownership_reviews"("asset_id");
CREATE INDEX "asset_ownership_reviews_tenant_id_disposition_reviewed_at_idx"
ON "asset_ownership_reviews"("tenant_id", "disposition", "reviewed_at");

ALTER TABLE "asset_ownership_reviews"
ADD CONSTRAINT "asset_ownership_reviews_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_ownership_reviews"
ADD CONSTRAINT "asset_ownership_reviews_asset_id_fkey"
FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asset_ownership_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "asset_ownership_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "asset_ownership_reviews"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
