ALTER TABLE "model_gateway_finops_configs"
ADD COLUMN "concurrent_turn_limit" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN "priority_lane_enabled" BOOLEAN NOT NULL DEFAULT false;
