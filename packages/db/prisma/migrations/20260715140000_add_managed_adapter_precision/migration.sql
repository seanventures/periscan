ALTER TABLE "model_providers"
ADD COLUMN "serving_capabilities" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "serving_capabilities_verified_at" TIMESTAMP(3);

ALTER TABLE "model_sessions"
ADD COLUMN "requested_model" TEXT,
ADD COLUMN "adapter_alias" TEXT,
ADD COLUMN "precision_mode" TEXT NOT NULL DEFAULT 'ProviderManaged';

ALTER TABLE "model_usage_events"
ADD COLUMN "adapter_alias" TEXT,
ADD COLUMN "precision_mode" TEXT NOT NULL DEFAULT 'ProviderManaged';

ALTER TABLE "model_semantic_cache_entries"
ADD COLUMN "adapter_alias" TEXT,
ADD COLUMN "precision_mode" TEXT NOT NULL DEFAULT 'ProviderManaged';
