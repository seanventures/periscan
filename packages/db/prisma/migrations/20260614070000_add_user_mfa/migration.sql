-- MFA/TOTP: per-user encrypted shared secret + when MFA was activated, plus the
-- enrollment audit action. Additive; the new audit enum value is not used in
-- this migration so it is safe to add alongside the column changes.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'mfa_enrolled';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "mfa_secret" TEXT;
ALTER TABLE "users" ADD COLUMN "mfa_enabled_at" TIMESTAMP(3);
