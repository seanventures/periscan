-- Audit action for analyst finding-disposition changes (accept-risk, false
-- positive, suppress, etc.). Added as its own migration so the enum value is
-- committed before any table/code references it.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'finding_disposition_changed';
