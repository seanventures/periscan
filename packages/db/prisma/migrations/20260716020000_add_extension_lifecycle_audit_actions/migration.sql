ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'extension_project_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'extension_release_submitted';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'extension_release_reviewed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'extension_release_activated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'extension_release_revoked';
