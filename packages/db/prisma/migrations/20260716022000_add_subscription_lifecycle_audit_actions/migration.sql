ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'subscription_started';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'subscription_renewal_decided';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'subscription_reconciled';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'subscription_grace_started';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'subscription_grace_resolved';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'subscription_cancellation_scheduled';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'subscription_cancellation_revoked';
