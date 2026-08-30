-- Slice 3: path edge measurement receipts (additive; tenant RLS).
CREATE TABLE "path_edge_receipts" (
  "receipt_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "path_id" UUID NOT NULL,
  "path_edge_id" UUID NOT NULL,
  "hop_key" TEXT NOT NULL,
  "validation_run_id" UUID,
  "mission_id" UUID,
  "policy_decision_id" UUID,
  "module_id" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "validation_state" "ValidationState" NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "measured_at" TIMESTAMP(3) NOT NULL,
  "measurement_method" TEXT NOT NULL,
  "integrity_hash" TEXT,
  "actor" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "path_edge_receipts_pkey" PRIMARY KEY ("receipt_id"),
  CONSTRAINT "path_edge_receipts_evidence_ids_check" CHECK (cardinality("evidence_ids") >= 1),
  CONSTRAINT "path_edge_receipts_module_id_check" CHECK (char_length("module_id") >= 1),
  CONSTRAINT "path_edge_receipts_outcome_check" CHECK (char_length("outcome") >= 1),
  CONSTRAINT "path_edge_receipts_hop_key_check" CHECK (char_length("hop_key") >= 1),
  CONSTRAINT "path_edge_receipts_measurement_method_check" CHECK (char_length("measurement_method") >= 1),
  CONSTRAINT "path_edge_receipts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "path_edge_receipts_path_id_fkey" FOREIGN KEY ("path_id") REFERENCES "attack_paths"("path_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "path_edge_receipts_path_edge_id_fkey" FOREIGN KEY ("path_edge_id") REFERENCES "path_edges"("path_edge_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "path_edge_receipts_validation_run_id_fkey" FOREIGN KEY ("validation_run_id") REFERENCES "validation_runs"("run_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "path_edge_receipts_mission_id_fkey" FOREIGN KEY ("mission_id") REFERENCES "validation_missions"("mission_id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "path_edge_receipts_policy_decision_id_fkey" FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "path_edge_receipts_tenant_id_created_at_idx" ON "path_edge_receipts"("tenant_id", "created_at");
CREATE INDEX "path_edge_receipts_tenant_id_path_id_idx" ON "path_edge_receipts"("tenant_id", "path_id");
CREATE INDEX "path_edge_receipts_path_edge_id_measured_at_idx" ON "path_edge_receipts"("path_edge_id", "measured_at");
CREATE INDEX "path_edge_receipts_hop_key_idx" ON "path_edge_receipts"("hop_key");

ALTER TABLE "path_edge_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "path_edge_receipts" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "path_edge_receipts"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
