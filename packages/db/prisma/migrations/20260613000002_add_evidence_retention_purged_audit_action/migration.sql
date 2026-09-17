-- Add the evidence_retention_purged audit action so evidence-retention purges
-- are recorded as first-class, queryable AuditEvents (per tenant) rather than
-- only a structured log line. IF NOT EXISTS keeps it idempotent.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'evidence_retention_purged';
