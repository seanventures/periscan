ALTER TYPE "TenantSsoProviderType" ADD VALUE IF NOT EXISTS 'SAML';

ALTER TABLE "tenant_sso_configs"
  ADD COLUMN IF NOT EXISTS "saml_idp_certificate" TEXT,
  ADD COLUMN IF NOT EXISTS "saml_name_id_format" TEXT;

ALTER TABLE "tenant_sso_auth_requests"
  ADD COLUMN IF NOT EXISTS "protocol_request_id_hash" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_sso_auth_requests_protocol_request_id_hash_key"
  ON "tenant_sso_auth_requests"("protocol_request_id_hash");
