ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'asset_valuation_submitted';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'asset_valuation_reviewed';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'AssetValuationVersion';
