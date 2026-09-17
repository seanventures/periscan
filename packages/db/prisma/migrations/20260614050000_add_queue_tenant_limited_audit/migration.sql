-- Per-tenant queue backpressure audit action: recorded when an enqueue is denied
-- because the tenant is over its queued-jobs cap. Additive; idempotent.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'queue_tenant_limited';
