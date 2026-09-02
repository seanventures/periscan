-- New audit action for the authorized-redaction governance event. Added on its
-- own (not used in this migration) so the ALTER TYPE is transaction-safe.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'evidence_redacted';
