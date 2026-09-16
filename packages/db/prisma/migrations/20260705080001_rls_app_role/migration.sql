-- Dedicated NON-superuser, NON-bypassrls role that runWithTenantRls switches into
-- (SET LOCAL ROLE) for a tenant-bound transaction. The application connects as the
-- owner/superuser role, which BYPASSES row-level security entirely; dropping
-- privileges to this role for the duration of a bound transaction is what makes
-- the RLS tenant-isolation backstop actually enforce.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'periscan_rls') THEN
    CREATE ROLE periscan_rls NOSUPERUSER NOBYPASSRLS NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO periscan_rls;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO periscan_rls;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO periscan_rls;

-- Cover tables/sequences created by future migrations (which run as the owner).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO periscan_rls;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO periscan_rls;
