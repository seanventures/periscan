-- Tamper-evident per-tenant hash chain on evidence_artifacts.
-- chain_seq: per-tenant monotonic position; chain_hash binds this row's content
-- (sha256) + identity to the predecessor's chain_hash. Nullable so rows written
-- before this migration remain valid unchained legacy (their sha256 still
-- verifies independently); every new row is chained by the write path.
ALTER TABLE "evidence_artifacts"
  ADD COLUMN "chain_seq" BIGINT,
  ADD COLUMN "prev_chain_hash" TEXT,
  ADD COLUMN "chain_hash" TEXT;

-- Enforces no forks / duplicate positions within a tenant's chain.
CREATE UNIQUE INDEX "evidence_artifacts_tenant_id_chain_seq_key"
  ON "evidence_artifacts"("tenant_id", "chain_seq");
