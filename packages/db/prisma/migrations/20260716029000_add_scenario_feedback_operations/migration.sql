ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'scenario_feedback_cycle_started';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'scenario_feedback_cycle_completed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'scenario_feedback_cycle_failed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'scenario_feedback_stopped';

CREATE TYPE "ScenarioFeedbackStatus" AS ENUM (
  'Idle',
  'Running',
  'Completed',
  'Failed',
  'Stopped',
  'Exhausted'
);

ALTER TABLE "scenario_bundles"
  ADD COLUMN "feedback_cycle_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "feedback_failed_cycle_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "feedback_last_status" "ScenarioFeedbackStatus" NOT NULL DEFAULT 'Idle',
  ADD COLUMN "feedback_last_error" TEXT,
  ADD COLUMN "feedback_last_reason" TEXT,
  ADD COLUMN "feedback_last_review_reference" TEXT,
  ADD COLUMN "feedback_last_started_at" TIMESTAMP(3),
  ADD COLUMN "feedback_last_completed_at" TIMESTAMP(3),
  ADD COLUMN "feedback_stopped_at" TIMESTAMP(3),
  ADD COLUMN "feedback_stopped_by" UUID,
  ADD COLUMN "feedback_stop_reason" TEXT,
  ADD COLUMN "feedback_stop_review_reference" TEXT;

ALTER TABLE "engagements"
  ADD COLUMN "feedback_cycle_number" INTEGER;

ALTER TABLE "scenario_bundles"
  ADD CONSTRAINT "scenario_bundles_maximum_iterations_check"
    CHECK ("maximum_iterations" BETWEEN 1 AND 20),
  ADD CONSTRAINT "scenario_bundles_feedback_counts_check"
    CHECK (
      "feedback_cycle_count" BETWEEN 0 AND "maximum_iterations"
      AND "feedback_failed_cycle_count" BETWEEN 0 AND "feedback_cycle_count"
    ),
  ADD CONSTRAINT "scenario_bundles_feedback_stop_check"
    CHECK (
      (
        "feedback_last_status" = 'Stopped'
        AND "feedback_stopped_at" IS NOT NULL
        AND "feedback_stopped_by" IS NOT NULL
        AND "feedback_stop_reason" IS NOT NULL
        AND "feedback_stop_review_reference" IS NOT NULL
      )
      OR (
        "feedback_last_status" <> 'Stopped'
        AND "feedback_stopped_at" IS NULL
        AND "feedback_stopped_by" IS NULL
        AND "feedback_stop_reason" IS NULL
        AND "feedback_stop_review_reference" IS NULL
      )
    ),
  ADD CONSTRAINT "scenario_bundles_feedback_timing_check"
    CHECK (
      ("feedback_last_status" = 'Idle' AND "feedback_cycle_count" = 0)
      OR (
        "feedback_last_status" = 'Running'
        AND "feedback_cycle_count" > 0
        AND "feedback_last_started_at" IS NOT NULL
        AND "feedback_last_completed_at" IS NULL
      )
      OR (
        "feedback_last_status" IN ('Completed', 'Failed', 'Exhausted')
        AND "feedback_cycle_count" > 0
        AND "feedback_last_started_at" IS NOT NULL
        AND "feedback_last_completed_at" IS NOT NULL
      )
      OR "feedback_last_status" = 'Stopped'
    );

ALTER TABLE "engagements"
  ADD CONSTRAINT "engagements_feedback_cycle_check"
    CHECK (
      "feedback_cycle_number" IS NULL
      OR ("scenario_bundle_id" IS NOT NULL AND "feedback_cycle_number" > 0)
    );

CREATE UNIQUE INDEX "engagements_scenario_bundle_id_feedback_cycle_number_key"
  ON "engagements"("scenario_bundle_id", "feedback_cycle_number");

ALTER TABLE "scenario_bundles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "scenario_bundles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "scenario_bundles";
CREATE POLICY tenant_isolation ON "scenario_bundles"
USING (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), NULLIF(current_setting('app.current_tenant', true), ''))::uuid)
WITH CHECK (tenant_id = COALESCE(NULLIF(current_setting('app.current_tenant_id', true), ''), NULLIF(current_setting('app.current_tenant', true), ''))::uuid);
