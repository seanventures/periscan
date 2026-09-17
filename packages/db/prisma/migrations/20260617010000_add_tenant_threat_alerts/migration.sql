-- Per-tenant realtime threat alerts: a fresh global catalog item that
-- correlates to a tenant's verified attack surface (scope/asset) or a CVE the
-- tenant already tracks. Additive; deduped one-per (tenant, item).

DO $$ BEGIN
  CREATE TYPE "TenantThreatAlertStatus" AS ENUM ('New', 'Acknowledged', 'Dismissed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "tenant_threat_alerts" (
  "tenant_threat_alert_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "threat_intel_item_id" UUID NOT NULL,
  "match_type" TEXT NOT NULL,
  "matched_value" TEXT NOT NULL,
  "matched_scope_id" UUID,
  "severity" TEXT,
  "status" "TenantThreatAlertStatus" NOT NULL DEFAULT 'New',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "tenant_threat_alerts_pkey" PRIMARY KEY ("tenant_threat_alert_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_threat_alerts_dedup" ON "tenant_threat_alerts" ("tenant_id", "threat_intel_item_id");
CREATE INDEX IF NOT EXISTS "tenant_threat_alerts_tenant_id_status_created_at_idx" ON "tenant_threat_alerts" ("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "tenant_threat_alerts_tenant_id_created_at_idx" ON "tenant_threat_alerts" ("tenant_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "tenant_threat_alerts"
    ADD CONSTRAINT "tenant_threat_alerts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants" ("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_threat_alerts"
    ADD CONSTRAINT "tenant_threat_alerts_threat_intel_item_id_fkey"
    FOREIGN KEY ("threat_intel_item_id") REFERENCES "threat_intel_items" ("threat_intel_item_id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
