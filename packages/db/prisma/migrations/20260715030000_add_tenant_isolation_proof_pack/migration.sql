ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'TenantIsolationDataProtectionReport';

-- Reconcile the RLS backstop across every current tenant-scoped table. This
-- deliberately runs after newer product tables were added so proof generation
-- can report complete, live database coverage instead of relying on a static
-- list from the original RLS migration.
DO $$
DECLARE
  table_record record;
BEGIN
  FOR table_record IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'tenant_id'
    ORDER BY table_name
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_record.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_record.table_name);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', table_record.table_name);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant()) WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())',
      table_record.table_name
    );
  END LOOP;
END $$;
