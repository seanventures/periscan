-- Billing entitlement enforcement: denial audit action recorded when a tenant's
-- active subscription package does not include a capability a gated action requires.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'billing_entitlement_denied';
