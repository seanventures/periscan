-- Onboarding/recovery: hashed, single-use, expiring user tokens (password reset
-- now; email verification + invite acceptance in later increments) plus the
-- audit actions for password reset. Additive only.
--
-- The new enum values are NOT used elsewhere in this migration (the user_tokens
-- table's purpose column is its own enum type created below), so they are safe to
-- add in the same transaction as the table creation.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'password_reset_requested';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'password_reset_completed';

-- CreateEnum
CREATE TYPE "UserTokenPurpose" AS ENUM ('PasswordReset', 'EmailVerification', 'Invite');

-- CreateTable
CREATE TABLE "user_tokens" (
    "token_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" "UserTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_tokens_pkey" PRIMARY KEY ("token_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_tokens_token_hash_key" ON "user_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "user_tokens_user_id_purpose_idx" ON "user_tokens"("user_id", "purpose");

-- CreateIndex
CREATE INDEX "user_tokens_expires_at_idx" ON "user_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "user_tokens" ADD CONSTRAINT "user_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
