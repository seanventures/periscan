-- Provenance for in-network (runner-measured) signals. Additive + nullable, so
-- existing control-plane signals stay NULL and image rollback is forward-safe.
ALTER TABLE "signals" ADD COLUMN IF NOT EXISTS "source_runner_id" uuid;
