CREATE TABLE "signal_trigger_routing_settings" (
  "tenant_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "default_owner_role" "MembershipRole" NOT NULL DEFAULT 'SecurityEngineer',
  "workflow_destination_integration_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "notification_integration_ids" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "signal_trigger_routing_settings_pkey" PRIMARY KEY ("tenant_id"),
  CONSTRAINT "signal_trigger_routing_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "signal_trigger_routing_settings_tenant_id_updated_at_idx"
  ON "signal_trigger_routing_settings"("tenant_id", "updated_at");
