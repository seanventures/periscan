-- Webhook dead-letter: terminal marker set after the final failed delivery
-- attempt so operators can find permanently-failed deliveries. Additive.
ALTER TABLE "webhook_deliveries" ADD COLUMN "dead_lettered_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "webhook_deliveries_tenant_id_dead_lettered_at_idx" ON "webhook_deliveries"("tenant_id", "dead_lettered_at");
