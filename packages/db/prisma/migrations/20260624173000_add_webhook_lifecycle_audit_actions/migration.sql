ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'TenantWebhook';

ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'webhook_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'webhook_updated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'webhook_deleted';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'webhook_tested';
