-- AlterTable: add feed-ingestion provenance + dedup keys to threat advisories
ALTER TABLE "threat_advisories"
  ADD COLUMN "source_category" TEXT,
  ADD COLUMN "external_id" TEXT;

-- Dedup feed-sourced advisories per tenant + feed + external id. Manual imports
-- leave both columns NULL, which Postgres treats as distinct, so they never collide.
CREATE UNIQUE INDEX "threat_advisories_feed_dedup"
  ON "threat_advisories" ("tenant_id", "source_category", "external_id");
