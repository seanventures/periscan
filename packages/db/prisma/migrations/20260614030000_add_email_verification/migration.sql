-- Email verification: track when a user verified their email + the audit action.
-- Additive; the new audit enum value is not used in this migration so it is safe
-- to add alongside the column change.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'email_verified';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
