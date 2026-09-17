ALTER TABLE "validation_runs"
ADD COLUMN "technique_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "signals"
ADD COLUMN "technique_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
