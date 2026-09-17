ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'ai_validation_kill_switch_changed';

ALTER TABLE "ai_applications"
  ADD COLUMN "validation_kill_switch_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "validation_kill_switch_activated_at" TIMESTAMP(3),
  ADD COLUMN "validation_kill_switch_activated_by" UUID,
  ADD COLUMN "validation_kill_switch_reason" TEXT;
