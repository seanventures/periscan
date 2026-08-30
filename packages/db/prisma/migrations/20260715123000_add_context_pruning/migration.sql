ALTER TABLE "context_bundles"
ADD COLUMN "pruning_manifest" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "source_token_estimate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "token_budget" INTEGER NOT NULL DEFAULT 2000;
