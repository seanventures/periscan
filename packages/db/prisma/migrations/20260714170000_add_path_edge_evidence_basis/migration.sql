ALTER TABLE "path_edges"
ADD COLUMN "evidence_basis" "EvidenceBasis" NOT NULL DEFAULT 'Heuristic',
ADD COLUMN "measurement_method" TEXT;

UPDATE "path_edges" AS edge
SET
  "evidence_basis" = path."evidence_basis",
  "measurement_method" = path."methodology"
FROM "attack_paths" AS path
WHERE path."path_id" = edge."path_id";
