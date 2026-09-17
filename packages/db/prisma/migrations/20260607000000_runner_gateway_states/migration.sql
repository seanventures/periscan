-- Runner / Secure Validation Gateway: additive runner + task states and fields.
-- All changes are additive (new enum values + nullable/default columns); no rewrite.

ALTER TYPE "RunnerStatus" ADD VALUE IF NOT EXISTS 'KillSwitchActive';

ALTER TYPE "RunnerTaskStatus" ADD VALUE IF NOT EXISTS 'Accepted';
ALTER TYPE "RunnerTaskStatus" ADD VALUE IF NOT EXISTS 'DeniedByLocalPolicy';
ALTER TYPE "RunnerTaskStatus" ADD VALUE IF NOT EXISTS 'DeniedByServerPolicy';

ALTER TABLE "runners"
  ADD COLUMN IF NOT EXISTS "kill_switch_active" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "kill_switch_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "kill_switch_activated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "kill_switch_activated_by" UUID;

ALTER TABLE "runner_tasks"
  ADD COLUMN IF NOT EXISTS "task_type" TEXT,
  ADD COLUMN IF NOT EXISTS "module_version" TEXT,
  ADD COLUMN IF NOT EXISTS "input_payload_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "normalized_output" JSONB,
  ADD COLUMN IF NOT EXISTS "resource_usage" JSONB,
  ADD COLUMN IF NOT EXISTS "redacted_evidence_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "local_audit_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "rejected_reason" TEXT;
