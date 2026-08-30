ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_work_order_generated';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThirdPartyToolImplementationWorkOrder';

CREATE TYPE "ThirdPartyToolImplementationWorkOrderStatus" AS ENUM (
  'Draft',
  'Blocked',
  'ReadyForImplementation'
);

CREATE TABLE "third_party_tool_implementation_work_orders" (
  "third_party_tool_implementation_work_order_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "tool_id" TEXT NOT NULL,
  "status" "ThirdPartyToolImplementationWorkOrderStatus" NOT NULL,
  "review_status" TEXT NOT NULL,
  "readiness_status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "required_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "tasks" JSONB NOT NULL,
  "scaffold_files" JSONB NOT NULL,
  "generated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "third_party_tool_implementation_work_orders_pkey"
    PRIMARY KEY ("third_party_tool_implementation_work_order_id"),
  CONSTRAINT "third_party_tool_implementation_work_orders_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "third_party_tool_implementation_work_orders_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "third_party_tool_candidates"("third_party_tool_candidate_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "third_party_tool_implementation_work_orders_tenant_id_created_at_idx"
  ON "third_party_tool_implementation_work_orders"("tenant_id", "created_at");

CREATE INDEX "third_party_tool_implementation_work_orders_tenant_id_candidate_id_created_at_idx"
  ON "third_party_tool_implementation_work_orders"("tenant_id", "candidate_id", "created_at");

CREATE INDEX "third_party_tool_implementation_work_orders_tenant_id_status_idx"
  ON "third_party_tool_implementation_work_orders"("tenant_id", "status");

CREATE INDEX "third_party_tool_implementation_work_orders_tool_id_idx"
  ON "third_party_tool_implementation_work_orders"("tool_id");
