CREATE TABLE "control_rule_coverage_snapshots" (
  "snapshot_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "trigger_control_source_id" UUID,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blocked_techniques" INTEGER NOT NULL,
  "covered_techniques" INTEGER NOT NULL,
  "improved_techniques" INTEGER NOT NULL DEFAULT 0,
  "logged_only_techniques" INTEGER NOT NULL,
  "missed_techniques" INTEGER NOT NULL,
  "needs_tuning_techniques" INTEGER NOT NULL,
  "no_evidence_techniques" INTEGER NOT NULL,
  "not_tested_techniques" INTEGER NOT NULL,
  "regressed_techniques" INTEGER NOT NULL DEFAULT 0,
  "stale_techniques" INTEGER NOT NULL,
  "total_techniques" INTEGER NOT NULL,
  "items" JSONB NOT NULL,
  "recommendations" TEXT[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "control_rule_coverage_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

ALTER TABLE "control_rule_coverage_snapshots"
  ADD CONSTRAINT "control_rule_coverage_snapshots_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "control_rule_coverage_snapshots_tenant_id_generated_at_idx"
  ON "control_rule_coverage_snapshots"("tenant_id", "generated_at");

CREATE INDEX "control_rule_coverage_snapshots_trigger_control_source_id_generated_at_idx"
  ON "control_rule_coverage_snapshots"("trigger_control_source_id", "generated_at");
