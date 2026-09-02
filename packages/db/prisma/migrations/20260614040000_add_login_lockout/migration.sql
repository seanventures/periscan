-- Account lockout: per-user failed-login counter + lock expiry, plus the
-- login_failed audit action. Additive; the new audit enum value is not used in
-- this migration so it is safe to add alongside the column changes.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'login_failed';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "locked_until" TIMESTAMP(3);
