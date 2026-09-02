-- Tenant-level force-MFA policy. When true (or when PERISCAN_REQUIRE_MFA=true),
-- password sessions without enrolled MFA are limited to the MFA setup path.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "require_mfa" BOOLEAN NOT NULL DEFAULT false;
