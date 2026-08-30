-- Destructive-validation authorization tier (top governance tier above the
-- offensive flip). OFF by default; enabling it lets the policy engine permit
-- governed destructive / real-payload validation under full attestation.
ALTER TABLE "tenants"
  ADD COLUMN "destructive_validation_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "destructive_validation_authorized_by" UUID,
  ADD COLUMN "destructive_validation_authorized_at" TIMESTAMP(3),
  ADD COLUMN "destructive_validation_authorization_ref" TEXT;
