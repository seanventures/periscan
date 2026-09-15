-- Global threat-intelligence catalog ("super feed"): canonical, cross-feed-
-- deduped world threat data (CVEs, IOCs, advisories), ingested once and
-- correlated to each tenant on read. Additive only; no tenant scoping.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ThreatIntelKind" AS ENUM ('Vulnerability', 'Indicator', 'Advisory');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: threat_intel_items (canonical deduped record)
CREATE TABLE IF NOT EXISTS "threat_intel_items" (
  "threat_intel_item_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "kind" "ThreatIntelKind" NOT NULL,
  "canonical_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL DEFAULT '',
  "cve_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "cvss_score" DOUBLE PRECISION,
  "epss_score" DOUBLE PRECISION,
  "severity" TEXT,
  "kev" BOOLEAN NOT NULL DEFAULT false,
  "kev_ransomware" BOOLEAN NOT NULL DEFAULT false,
  "ioc_type" TEXT,
  "ioc_value" TEXT,
  "technique_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "source_count" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMP(3),
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "threat_intel_items_pkey" PRIMARY KEY ("threat_intel_item_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "threat_intel_items_canonical_key_key" ON "threat_intel_items" ("canonical_key");
CREATE INDEX IF NOT EXISTS "threat_intel_items_kind_last_seen_at_idx" ON "threat_intel_items" ("kind", "last_seen_at");
CREATE INDEX IF NOT EXISTS "threat_intel_items_kind_severity_idx" ON "threat_intel_items" ("kind", "severity");
CREATE INDEX IF NOT EXISTS "threat_intel_items_kev_idx" ON "threat_intel_items" ("kev");
CREATE INDEX IF NOT EXISTS "threat_intel_items_first_seen_at_idx" ON "threat_intel_items" ("first_seen_at");
CREATE INDEX IF NOT EXISTS "threat_intel_items_ioc_type_ioc_value_idx" ON "threat_intel_items" ("ioc_type", "ioc_value");

-- CreateTable: threat_intel_provenance (which feed reported each item)
CREATE TABLE IF NOT EXISTS "threat_intel_provenance" (
  "threat_intel_provenance_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "threat_intel_item_id" UUID NOT NULL,
  "source_key" TEXT NOT NULL,
  "external_id" TEXT,
  "source_url" TEXT,
  "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "threat_intel_provenance_pkey" PRIMARY KEY ("threat_intel_provenance_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "threat_intel_provenance_item_source" ON "threat_intel_provenance" ("threat_intel_item_id", "source_key");
CREATE INDEX IF NOT EXISTS "threat_intel_provenance_source_key_reported_at_idx" ON "threat_intel_provenance" ("source_key", "reported_at");

DO $$ BEGIN
  ALTER TABLE "threat_intel_provenance"
    ADD CONSTRAINT "threat_intel_provenance_threat_intel_item_id_fkey"
    FOREIGN KEY ("threat_intel_item_id") REFERENCES "threat_intel_items" ("threat_intel_item_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable: threat_intel_source_states (per-feed poll cursor/state)
CREATE TABLE IF NOT EXISTS "threat_intel_source_states" (
  "threat_intel_source_state_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "source_key" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "last_polled_at" TIMESTAMP(3),
  "next_poll_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cursor" TEXT,
  "last_item_count" INTEGER NOT NULL DEFAULT 0,
  "last_new_count" INTEGER NOT NULL DEFAULT 0,
  "last_status" TEXT,
  "last_error" TEXT,
  "consecutive_errors" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "threat_intel_source_states_pkey" PRIMARY KEY ("threat_intel_source_state_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "threat_intel_source_states_source_key_key" ON "threat_intel_source_states" ("source_key");
CREATE INDEX IF NOT EXISTS "threat_intel_source_states_enabled_next_poll_at_idx" ON "threat_intel_source_states" ("enabled", "next_poll_at");
