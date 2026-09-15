ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'api_key_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'api_key_revoked';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'api_key_rotated';

CREATE TABLE "tenant_api_keys" (
  "api_key_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "key_prefix" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "created_by" UUID NOT NULL,
  "last_used_at" TIMESTAMP(3),
  "expires_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_api_keys_pkey" PRIMARY KEY ("api_key_id"),
  CONSTRAINT "tenant_api_keys_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tenant_api_keys_key_hash_key" ON "tenant_api_keys"("key_hash");

CREATE INDEX "tenant_api_keys_tenant_id_created_at_idx"
  ON "tenant_api_keys"("tenant_id", "created_at");
