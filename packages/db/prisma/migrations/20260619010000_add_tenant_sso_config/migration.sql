ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'sso_config_updated';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'sso_config_disabled';

DO $$
BEGIN
  CREATE TYPE "TenantSsoProviderType" AS ENUM ('OIDC');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "TenantSsoStatus" AS ENUM ('Disabled', 'Enabled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_sso_configs" (
  "tenant_id" UUID NOT NULL,
  "provider_type" "TenantSsoProviderType" NOT NULL DEFAULT 'OIDC',
  "status" "TenantSsoStatus" NOT NULL DEFAULT 'Disabled',
  "issuer_url" TEXT NOT NULL,
  "authorization_endpoint" TEXT NOT NULL,
  "token_endpoint" TEXT,
  "jwks_uri" TEXT,
  "client_id" TEXT NOT NULL,
  "client_secret_encrypted" TEXT,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY['openid','email','profile']::TEXT[],
  "email_domain_allowlist" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enforced" BOOLEAN NOT NULL DEFAULT false,
  "redirect_uri" TEXT,
  "created_by" UUID,
  "updated_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_sso_configs_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "tenant_sso_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "tenant_sso_configs_tenant_id_updated_at_idx" ON "tenant_sso_configs"("tenant_id", "updated_at");
CREATE INDEX IF NOT EXISTS "tenant_sso_configs_status_idx" ON "tenant_sso_configs"("status");
