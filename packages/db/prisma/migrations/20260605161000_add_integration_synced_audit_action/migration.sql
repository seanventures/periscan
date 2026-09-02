DO $$
BEGIN
  ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'integration_synced';
END $$;
