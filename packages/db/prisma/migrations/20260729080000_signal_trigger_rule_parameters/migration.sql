-- P06-11: parameterized thresholds for fixed signal-trigger catalog (not a SIEM DSL).

ALTER TABLE "signal_trigger_routing_settings"
  ADD COLUMN IF NOT EXISTS "rule_parameters" JSONB NOT NULL DEFAULT '{}'::jsonb;
