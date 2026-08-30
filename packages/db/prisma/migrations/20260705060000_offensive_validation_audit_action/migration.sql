-- Audit action for the offensive-validation authorization flip. Own migration
-- so the enum value is committed before any code references it.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'offensive_validation_changed';
