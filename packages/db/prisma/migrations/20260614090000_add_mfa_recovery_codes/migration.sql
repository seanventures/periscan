-- MFA increment 3: single-use recovery codes (hashed at rest) + audit actions.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'mfa_recovery_used';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'mfa_recovery_regenerated';

CREATE TABLE "mfa_recovery_codes" (
  "recovery_code_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "code_hash" TEXT NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("recovery_code_id")
);

CREATE UNIQUE INDEX "mfa_recovery_codes_code_hash_key" ON "mfa_recovery_codes" ("code_hash");
CREATE INDEX "mfa_recovery_codes_user_id_consumed_at_idx" ON "mfa_recovery_codes" ("user_id", "consumed_at");

ALTER TABLE "mfa_recovery_codes"
  ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
