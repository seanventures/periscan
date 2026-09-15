CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('Pending', 'Delivered', 'Failed');

CREATE TABLE "tenant_webhooks" (
  "webhook_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "url" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "events" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "tenant_webhooks_pkey" PRIMARY KEY ("webhook_id"),
  CONSTRAINT "tenant_webhooks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "tenant_webhooks_tenant_id_created_at_idx"
  ON "tenant_webhooks"("tenant_id", "created_at");

CREATE TABLE "webhook_deliveries" (
  "delivery_id" UUID NOT NULL,
  "webhook_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'Pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "last_error" TEXT,
  "response_status" INTEGER,
  "next_retry_at" TIMESTAMP(3),
  "delivered_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("delivery_id"),
  CONSTRAINT "webhook_deliveries_webhook_id_fkey"
    FOREIGN KEY ("webhook_id") REFERENCES "tenant_webhooks"("webhook_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "webhook_deliveries_tenant_id_created_at_idx"
  ON "webhook_deliveries"("tenant_id", "created_at");

CREATE INDEX "webhook_deliveries_webhook_id_created_at_idx"
  ON "webhook_deliveries"("webhook_id", "created_at");

CREATE INDEX "webhook_deliveries_status_next_retry_at_idx"
  ON "webhook_deliveries"("status", "next_retry_at");
