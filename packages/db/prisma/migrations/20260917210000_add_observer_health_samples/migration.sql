-- PERISCAN-590: persist observer health-sample series for Missed gating.
-- These rows are heartbeat coverage only — not detections or evidence.

CREATE TABLE "observer_health_samples" (
  "observer_health_sample_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "control_source_id" UUID NOT NULL,
  "observed_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "health_status" "IntegrationHealthStatus" NOT NULL,
  "telemetry_status" "IntegrationHealthStatus" NOT NULL,
  CONSTRAINT "observer_health_samples_pkey" PRIMARY KEY ("observer_health_sample_id"),
  CONSTRAINT "observer_health_samples_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "observer_health_samples_control_source_id_fkey"
    FOREIGN KEY ("control_source_id") REFERENCES "control_sources"("control_source_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "observer_health_samples_tenant_id_observed_at_idx"
  ON "observer_health_samples"("tenant_id", "observed_at");

CREATE INDEX "observer_health_samples_control_source_id_observed_at_idx"
  ON "observer_health_samples"("control_source_id", "observed_at");

CREATE OR REPLACE FUNCTION protect_observer_health_sample_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Observer health history is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER observer_health_samples_immutable
BEFORE UPDATE ON "observer_health_samples"
FOR EACH ROW EXECUTE FUNCTION protect_observer_health_sample_update();

ALTER TABLE "observer_health_samples" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "observer_health_samples" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "observer_health_samples"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());
