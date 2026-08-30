-- Audit action for destructive-validation tier changes.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'destructive_validation_changed';
