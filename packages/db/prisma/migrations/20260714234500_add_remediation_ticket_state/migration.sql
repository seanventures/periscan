ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'remediation_ticket_synced';

ALTER TABLE "remediation_tasks"
ADD COLUMN "ticket_integration_id" UUID,
ADD COLUMN "ticket_state" TEXT,
ADD COLUMN "ticket_state_label" TEXT,
ADD COLUMN "ticket_synced_at" TIMESTAMP(3);

CREATE INDEX "remediation_tasks_ticket_integration_id_idx"
ON "remediation_tasks"("ticket_integration_id");

ALTER TABLE "remediation_tasks"
ADD CONSTRAINT "remediation_tasks_ticket_integration_id_fkey"
FOREIGN KEY ("ticket_integration_id") REFERENCES "integrations"("integration_id")
ON DELETE SET NULL ON UPDATE CASCADE;
