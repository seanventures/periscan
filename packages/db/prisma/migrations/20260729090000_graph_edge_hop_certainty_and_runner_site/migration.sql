-- P11-14: promote hop certainty on graph_edges (mirrors path_edges).
ALTER TABLE "graph_edges"
  ADD COLUMN IF NOT EXISTS "evidence_basis" "EvidenceBasis" NOT NULL DEFAULT 'Heuristic',
  ADD COLUMN IF NOT EXISTS "measurement_method" TEXT;

-- Backfill from properties JSON when present.
UPDATE "graph_edges"
SET "evidence_basis" = 'Measured'
WHERE ("properties" ->> 'evidenceBasis') = 'Measured';

UPDATE "graph_edges"
SET "measurement_method" = ("properties" ->> 'measurementMethod')
WHERE ("properties" ->> 'measurementMethod') IS NOT NULL
  AND char_length("properties" ->> 'measurementMethod') > 0
  AND "measurement_method" IS NULL;

-- P10-15 / P10-17: multi-site segment affinity on runners.
ALTER TABLE "runners"
  ADD COLUMN IF NOT EXISTS "site_id" TEXT,
  ADD COLUMN IF NOT EXISTS "network_segment" TEXT,
  ADD COLUMN IF NOT EXISTS "segment_profile_id" TEXT;

CREATE INDEX IF NOT EXISTS "runners_tenant_id_site_id_idx" ON "runners"("tenant_id", "site_id");
CREATE INDEX IF NOT EXISTS "runners_tenant_id_network_segment_idx" ON "runners"("tenant_id", "network_segment");
