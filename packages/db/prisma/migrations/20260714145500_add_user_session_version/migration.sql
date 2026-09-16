ALTER TABLE "users"
ADD COLUMN "session_version" INTEGER NOT NULL DEFAULT 0;

ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'password_changed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'sessions_revoked';
