-- Invite acceptance audit action (invited user sets their password + activates).
-- Additive; idempotent.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'invite_accepted';
