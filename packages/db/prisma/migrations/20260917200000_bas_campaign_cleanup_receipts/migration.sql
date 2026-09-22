ALTER TABLE "bas_campaign_step_cleanups"
  ADD COLUMN "receipt_sha256" VARCHAR(64),
  ADD COLUMN "output_hash" VARCHAR(64),
  ADD COLUMN "verified_at" TIMESTAMP(3);

ALTER TABLE "bas_campaign_step_cleanups"
  ADD CONSTRAINT "bas_campaign_step_cleanups_receipt_hash_check"
  CHECK ("receipt_sha256" IS NULL OR "receipt_sha256" ~ '^[a-f0-9]{64}$');

ALTER TABLE "bas_campaign_step_cleanups"
  ADD CONSTRAINT "bas_campaign_step_cleanups_output_hash_check"
  CHECK ("output_hash" IS NULL OR "output_hash" ~ '^[a-f0-9]{64}$');

ALTER TABLE "bas_campaign_step_cleanups"
  ADD CONSTRAINT "bas_campaign_step_cleanups_succeeded_receipt_check"
  CHECK ("status" <> 'succeeded' OR "receipt_sha256" IS NOT NULL);
