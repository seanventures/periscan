ALTER TABLE "assets"
ADD COLUMN "valuation" JSONB;

ALTER TYPE "AuditEventAction"
ADD VALUE IF NOT EXISTS 'asset_valuation_updated';
