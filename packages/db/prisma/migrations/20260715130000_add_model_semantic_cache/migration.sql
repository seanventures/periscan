ALTER TABLE "model_usage_events"
ADD COLUMN "queue_wait_ms" INTEGER,
ADD COLUMN "queue_lane" TEXT NOT NULL DEFAULT 'Standard',
ADD COLUMN "prompt_hash" TEXT NOT NULL DEFAULT '',
ADD COLUMN "prompt_redacted" TEXT,
ADD COLUMN "semantic_fingerprint" TEXT NOT NULL DEFAULT '',
ADD COLUMN "context_digest" TEXT NOT NULL DEFAULT '',
ADD COLUMN "cache_disposition" TEXT NOT NULL DEFAULT 'Ineligible',
ADD COLUMN "source_turn_id" UUID,
ADD COLUMN "assistant_text_redacted" TEXT,
ADD COLUMN "response_status" TEXT,
ADD COLUMN "iterations" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tool_calls_handled" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "started_at" TIMESTAMP(3);

ALTER TYPE "ModelGatewayEventType" ADD VALUE 'SemanticCacheHit';
ALTER TYPE "ModelGatewayEventType" ADD VALUE 'SemanticCacheStored';

CREATE TABLE "model_semantic_cache_entries" (
  "model_semantic_cache_entry_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "cache_key" TEXT NOT NULL,
  "semantic_fingerprint" TEXT NOT NULL,
  "context_digest" TEXT NOT NULL,
  "model_provider_id" UUID NOT NULL,
  "model_policy_profile_id" UUID NOT NULL,
  "session_mode" "ModelSessionMode" NOT NULL,
  "model" TEXT NOT NULL,
  "assistant_text_redacted" TEXT NOT NULL,
  "evidence_ids" UUID[] DEFAULT ARRAY[]::UUID[],
  "source_turn_id" UUID NOT NULL,
  "hit_count" INTEGER NOT NULL DEFAULT 0,
  "last_hit_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "model_semantic_cache_entries_pkey" PRIMARY KEY ("model_semantic_cache_entry_id")
);

CREATE UNIQUE INDEX "model_semantic_cache_entries_tenant_id_cache_key_key"
ON "model_semantic_cache_entries"("tenant_id", "cache_key");
CREATE INDEX "model_semantic_cache_entries_tenant_id_expires_at_idx"
ON "model_semantic_cache_entries"("tenant_id", "expires_at");
CREATE INDEX "model_semantic_cache_entries_model_provider_id_created_at_idx"
ON "model_semantic_cache_entries"("model_provider_id", "created_at");

ALTER TABLE "model_semantic_cache_entries"
ADD CONSTRAINT "model_semantic_cache_entries_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "model_semantic_cache_entries"
ADD CONSTRAINT "model_semantic_cache_entries_model_provider_id_fkey"
FOREIGN KEY ("model_provider_id") REFERENCES "model_providers"("model_provider_id") ON DELETE CASCADE ON UPDATE CASCADE;
