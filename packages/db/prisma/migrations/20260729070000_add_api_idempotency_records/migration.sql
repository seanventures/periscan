-- P20-7: durable Idempotency-Key store for core proof-loop POSTs.

CREATE TABLE "api_idempotency_records" (
  "api_idempotency_record_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "route" TEXT NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "body_hash" TEXT NOT NULL,
  "status_code" INTEGER NOT NULL,
  "response_body" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "api_idempotency_records_pkey" PRIMARY KEY ("api_idempotency_record_id"),
  CONSTRAINT "api_idempotency_records_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "api_idempotency_records_tenant_id_route_idempotency_key_key"
  ON "api_idempotency_records"("tenant_id", "route", "idempotency_key");

CREATE INDEX "api_idempotency_records_tenant_id_expires_at_idx"
  ON "api_idempotency_records"("tenant_id", "expires_at");

CREATE INDEX "api_idempotency_records_expires_at_idx"
  ON "api_idempotency_records"("expires_at");

ALTER TABLE "api_idempotency_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "api_idempotency_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "api_idempotency_records"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());
