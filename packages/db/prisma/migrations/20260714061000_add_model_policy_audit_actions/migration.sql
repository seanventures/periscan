ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_policy_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_policy_updated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'model_policy_deleted';
