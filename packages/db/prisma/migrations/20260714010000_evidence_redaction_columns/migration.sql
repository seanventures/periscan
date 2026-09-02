-- Authorized post-ingest redaction state for evidence artifacts. The tamper-
-- evident chain (sha256/chain_hash) always attests to what was INGESTED; a later
-- operator redaction overwrites the stored blob for data-minimization WITHOUT
-- rewriting history. redacted_sha256 is the hash of the redacted copy (so its own
-- integrity stays verifiable on download); redacted_at records when it happened.
ALTER TABLE "evidence_artifacts"
  ADD COLUMN "redacted_at" TIMESTAMP(3),
  ADD COLUMN "redacted_sha256" TEXT;
