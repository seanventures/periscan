-- Backfill the missing migration for the remediation.ticket.created audit
-- action. The enum value was added to schema.prisma (and dev databases) without
-- a migration, leaving migration history out of sync. IF NOT EXISTS makes this
-- idempotent for databases that already have it.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'remediation_ticket_created';
