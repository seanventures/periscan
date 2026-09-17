-- Durable per-tenant model-gateway kill switch. When active, no new model
-- sessions or LLM tool calls are accepted until an admin clears it. Global
-- env PERISCAN_MODEL_GATEWAY_KILL_SWITCH=true forces active for all tenants.
ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "model_gateway_kill_switch_active" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "model_gateway_kill_switch_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "model_gateway_kill_switch_activated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "model_gateway_kill_switch_activated_by" UUID;
