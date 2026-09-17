ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_update_checked';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_update_applied';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_update_dismissed';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThirdPartyToolUpdateRecommendation';

CREATE TYPE "ThirdPartyToolUpdateRecommendationStatus" AS ENUM (
  'UpToDate',
  'UpdateAvailable',
  'Blocked',
  'Applied',
  'Dismissed'
);

CREATE TABLE "third_party_tool_update_recommendations" (
  "third_party_tool_update_recommendation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "tool_id" TEXT NOT NULL,
  "status" "ThirdPartyToolUpdateRecommendationStatus" NOT NULL,
  "source" TEXT NOT NULL,
  "current_pinned_version" TEXT NOT NULL,
  "reviewed_version" TEXT NOT NULL,
  "current_installed_version" TEXT,
  "runtime_kind" TEXT,
  "reason" TEXT NOT NULL,
  "required_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "policy_blocked" BOOLEAN NOT NULL DEFAULT false,
  "generated_by_user_id" UUID,
  "applied_by_user_id" UUID,
  "dismissed_by_user_id" UUID,
  "install_job_id" UUID,
  "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "applied_at" TIMESTAMP(3),
  "dismissed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "third_party_tool_update_recommendations_pkey"
    PRIMARY KEY ("third_party_tool_update_recommendation_id"),
  CONSTRAINT "third_party_tool_update_recommendations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "third_party_tool_update_recommendations_tenant_id_created_at_idx"
  ON "third_party_tool_update_recommendations"("tenant_id", "created_at");

CREATE INDEX "third_party_tool_update_recommendations_tenant_id_tool_id_created_at_idx"
  ON "third_party_tool_update_recommendations"("tenant_id", "tool_id", "created_at");

CREATE INDEX "third_party_tool_update_recommendations_tenant_id_status_idx"
  ON "third_party_tool_update_recommendations"("tenant_id", "status");

CREATE INDEX "third_party_tool_update_recommendations_tool_id_idx"
  ON "third_party_tool_update_recommendations"("tool_id");
