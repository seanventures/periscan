-- P11-4: durable operator recommendation proposals (tenant ontology object).
-- Generated recommendations were previously ephemeral; approvals only mutated
-- the response payload. This table stores proposal history with status.

ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'OperatorRecommendation';

CREATE TYPE "OperatorRecommendationStatus" AS ENUM (
  'Proposed',
  'Approved',
  'NotActionable'
);

CREATE TABLE "operator_recommendations" (
  "operator_recommendation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "scope_id" UUID,
  "payload" JSONB NOT NULL,
  "status" "OperatorRecommendationStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "operator_recommendations_pkey" PRIMARY KEY ("operator_recommendation_id"),
  CONSTRAINT "operator_recommendations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "operator_recommendations_scope_id_fkey"
    FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "operator_recommendations_tenant_id_created_at_idx"
  ON "operator_recommendations"("tenant_id", "created_at");

CREATE INDEX "operator_recommendations_tenant_id_status_idx"
  ON "operator_recommendations"("tenant_id", "status");

CREATE INDEX "operator_recommendations_tenant_id_scope_id_idx"
  ON "operator_recommendations"("tenant_id", "scope_id");

ALTER TABLE "operator_recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "operator_recommendations" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "operator_recommendations"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());
