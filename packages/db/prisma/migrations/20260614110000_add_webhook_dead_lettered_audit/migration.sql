-- Track C: webhook dead-letter audit action.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'webhook_dead_lettered';
