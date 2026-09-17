-- AlterTable: continuous connector sync scheduling
ALTER TABLE "integrations"
  ADD COLUMN "sync_frequency" "ScheduleFrequency",
  ADD COLUMN "next_sync_at" TIMESTAMP(3);

CREATE INDEX "integrations_tenant_id_status_next_sync_at_idx"
  ON "integrations" ("tenant_id", "status", "next_sync_at");
