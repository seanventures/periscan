ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ValidationStimulus';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'validation_stimulus_created';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'validation_stimulus_dispatched';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'validation_stimulus_observed';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'validation_stimulus_cancelled';

CREATE TYPE "ValidationStimulusType" AS ENUM ('OwnedDomainUrlCanary');
CREATE TYPE "ValidationStimulusStatus" AS ENUM (
  'RequiresApproval',
  'Ready',
  'Dispatching',
  'Observing',
  'Completed',
  'Failed',
  'DeniedByPolicy',
  'Cancelled'
);
CREATE TYPE "ControlValidationVerdict" AS ENUM (
  'Prevented',
  'Detected',
  'TelemetryOnly',
  'Missed',
  'Inconclusive',
  'NotObservedBeforeTimeout'
);

CREATE TABLE "validation_stimuli" (
  "stimulus_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "created_by" UUID NOT NULL,
  "scope_id" UUID NOT NULL,
  "control_source_id" UUID NOT NULL,
  "policy_decision_id" UUID NOT NULL,
  "mission_id" UUID NOT NULL,
  "run_id" UUID,
  "stimulus_type" "ValidationStimulusType" NOT NULL,
  "status" "ValidationStimulusStatus" NOT NULL,
  "safety_level" "SafetyLevel" NOT NULL,
  "technique_id" TEXT NOT NULL,
  "target_host" TEXT NOT NULL,
  "correlation_token" TEXT NOT NULL,
  "marker_hash" TEXT NOT NULL,
  "expected_control_behaviors" TEXT[] NOT NULL,
  "rate_limit_per_minute" INTEGER NOT NULL DEFAULT 1,
  "max_request_bytes" INTEGER NOT NULL DEFAULT 1024,
  "ttl_seconds" INTEGER NOT NULL DEFAULT 600,
  "cleanup_behavior" TEXT NOT NULL,
  "dispatch_receipt" JSONB,
  "evidence_ids" UUID[] NOT NULL,
  "error_summary" TEXT,
  "dispatched_at" TIMESTAMP(3),
  "observation_deadline_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "validation_stimuli_pkey" PRIMARY KEY ("stimulus_id")
);

CREATE TABLE "control_validation_verdicts" (
  "verdict_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "stimulus_id" UUID NOT NULL,
  "control_source_id" UUID NOT NULL,
  "verdict" "ControlValidationVerdict" NOT NULL,
  "observed_outcome" TEXT,
  "correlation_matched" BOOLEAN NOT NULL DEFAULT false,
  "reason" TEXT NOT NULL,
  "signal_ids" UUID[] NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "observed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "control_validation_verdicts_pkey" PRIMARY KEY ("verdict_id")
);

CREATE UNIQUE INDEX "validation_stimuli_run_id_key" ON "validation_stimuli"("run_id");
CREATE UNIQUE INDEX "validation_stimuli_correlation_token_key" ON "validation_stimuli"("correlation_token");
CREATE INDEX "validation_stimuli_tenant_id_created_at_idx" ON "validation_stimuli"("tenant_id", "created_at");
CREATE INDEX "validation_stimuli_tenant_id_status_idx" ON "validation_stimuli"("tenant_id", "status");
CREATE INDEX "validation_stimuli_control_source_id_created_at_idx" ON "validation_stimuli"("control_source_id", "created_at");
CREATE INDEX "validation_stimuli_scope_id_created_at_idx" ON "validation_stimuli"("scope_id", "created_at");
CREATE UNIQUE INDEX "control_validation_verdicts_stimulus_id_key" ON "control_validation_verdicts"("stimulus_id");
CREATE INDEX "control_validation_verdicts_tenant_id_created_at_idx" ON "control_validation_verdicts"("tenant_id", "created_at");
CREATE INDEX "control_validation_verdicts_control_source_id_created_at_idx" ON "control_validation_verdicts"("control_source_id", "created_at");

ALTER TABLE "validation_stimuli" ADD CONSTRAINT "validation_stimuli_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_stimuli" ADD CONSTRAINT "validation_stimuli_scope_id_fkey"
  FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_stimuli" ADD CONSTRAINT "validation_stimuli_control_source_id_fkey"
  FOREIGN KEY ("control_source_id") REFERENCES "control_sources"("control_source_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_stimuli" ADD CONSTRAINT "validation_stimuli_policy_decision_id_fkey"
  FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "validation_stimuli" ADD CONSTRAINT "validation_stimuli_mission_id_fkey"
  FOREIGN KEY ("mission_id") REFERENCES "validation_missions"("mission_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "validation_stimuli" ADD CONSTRAINT "validation_stimuli_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "validation_runs"("run_id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "control_validation_verdicts" ADD CONSTRAINT "control_validation_verdicts_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_validation_verdicts" ADD CONSTRAINT "control_validation_verdicts_stimulus_id_fkey"
  FOREIGN KEY ("stimulus_id") REFERENCES "validation_stimuli"("stimulus_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "control_validation_verdicts" ADD CONSTRAINT "control_validation_verdicts_control_source_id_fkey"
  FOREIGN KEY ("control_source_id") REFERENCES "control_sources"("control_source_id") ON DELETE CASCADE ON UPDATE CASCADE;
