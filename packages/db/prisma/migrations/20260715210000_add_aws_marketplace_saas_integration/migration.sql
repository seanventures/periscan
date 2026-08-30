CREATE TABLE "aws_marketplace_registrations" (
  "aws_marketplace_registration_id" UUID NOT NULL,
  "claim_token_hash" TEXT NOT NULL,
  "customer_aws_account_id" TEXT NOT NULL,
  "customer_identifier" TEXT,
  "license_arn" TEXT NOT NULL,
  "product_code" TEXT NOT NULL,
  "entitlements" JSONB NOT NULL,
  "entitled" BOOLEAN NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "claimed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "aws_marketplace_registrations_pkey" PRIMARY KEY ("aws_marketplace_registration_id")
);

CREATE UNIQUE INDEX "aws_marketplace_registrations_claim_token_hash_key"
ON "aws_marketplace_registrations"("claim_token_hash");
CREATE INDEX "aws_marketplace_registrations_expires_at_claimed_at_idx"
ON "aws_marketplace_registrations"("expires_at", "claimed_at");

CREATE TABLE "aws_marketplace_subscriptions" (
  "aws_marketplace_subscription_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "customer_aws_account_id" TEXT NOT NULL,
  "customer_identifier" TEXT,
  "license_arn" TEXT NOT NULL,
  "product_code" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "entitlements" JSONB NOT NULL,
  "entitlement_checked_at" TIMESTAMP(3) NOT NULL,
  "last_metered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aws_marketplace_subscriptions_pkey" PRIMARY KEY ("aws_marketplace_subscription_id"),
  CONSTRAINT "aws_marketplace_subscriptions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "aws_marketplace_subscriptions_tenant_id_key"
ON "aws_marketplace_subscriptions"("tenant_id");
CREATE UNIQUE INDEX "aws_marketplace_subscriptions_license_arn_key"
ON "aws_marketplace_subscriptions"("license_arn");
CREATE INDEX "aws_marketplace_subscriptions_tenant_id_status_idx"
ON "aws_marketplace_subscriptions"("tenant_id", "status");

CREATE TABLE "aws_marketplace_metering_records" (
  "aws_marketplace_metering_record_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "aws_marketplace_subscription_id" UUID NOT NULL,
  "dimension" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "usage_hour" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "metering_record_id" TEXT,
  "response" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "aws_marketplace_metering_records_pkey" PRIMARY KEY ("aws_marketplace_metering_record_id"),
  CONSTRAINT "aws_marketplace_metering_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "aws_marketplace_metering_records_aws_marketplace_subscription_id_fkey" FOREIGN KEY ("aws_marketplace_subscription_id") REFERENCES "aws_marketplace_subscriptions"("aws_marketplace_subscription_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "aws_marketplace_metering_records_subscription_dimension_hour_key"
ON "aws_marketplace_metering_records"("aws_marketplace_subscription_id", "dimension", "usage_hour");
CREATE INDEX "aws_marketplace_metering_records_tenant_id_usage_hour_idx"
ON "aws_marketplace_metering_records"("tenant_id", "usage_hour");

ALTER TABLE "aws_marketplace_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aws_marketplace_subscriptions" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "aws_marketplace_subscriptions"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

ALTER TABLE "aws_marketplace_metering_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "aws_marketplace_metering_records" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "aws_marketplace_metering_records"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
