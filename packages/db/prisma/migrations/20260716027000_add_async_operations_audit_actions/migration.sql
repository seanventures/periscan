ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'async_operations_policy_configured';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'async_operations_reconciled';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'async_operations_recovery_prepared';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'async_operations_terminal_accepted';
