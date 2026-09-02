ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'sso_login_started';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'sso_login_completed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'sso_login_failed';

CREATE TABLE IF NOT EXISTS "tenant_sso_auth_requests" (
  "sso_auth_request_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "state_hash" TEXT NOT NULL,
  "nonce_hash" TEXT NOT NULL,
  "requested_email" TEXT,
  "redirect_uri" TEXT NOT NULL,
  "prompt" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_sso_auth_requests_pkey" PRIMARY KEY ("sso_auth_request_id")
);

CREATE UNIQUE INDEX "tenant_sso_auth_requests_state_hash_key"
  ON "tenant_sso_auth_requests"("state_hash");

CREATE INDEX "tenant_sso_auth_requests_tenant_id_created_at_idx"
  ON "tenant_sso_auth_requests"("tenant_id", "created_at");

CREATE INDEX "tenant_sso_auth_requests_expires_at_idx"
  ON "tenant_sso_auth_requests"("expires_at");

ALTER TABLE "tenant_sso_auth_requests"
  ADD CONSTRAINT "tenant_sso_auth_requests_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE ON UPDATE CASCADE;
