-- AlterTable: continuous threat-feed ingestion. A tenant can opt into recurring
-- ingestion of the threat feed (e.g. CISA KEV); the system sweep ingests new
-- advisories when next_threat_feed_ingest_at is due, so the threat center stays
-- current automatically instead of relying on a manual import.
ALTER TABLE "tenants"
  ADD COLUMN "threat_feed_frequency" "ScheduleFrequency",
  ADD COLUMN "next_threat_feed_ingest_at" TIMESTAMP(3);

CREATE INDEX "tenants_next_threat_feed_ingest_at_idx"
  ON "tenants" ("next_threat_feed_ingest_at");
