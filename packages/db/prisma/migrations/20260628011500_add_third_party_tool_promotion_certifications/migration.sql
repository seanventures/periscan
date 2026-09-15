ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_promotion_certified';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThirdPartyToolPromotionCertification';

CREATE TABLE "third_party_tool_promotion_certifications" (
  "third_party_tool_promotion_certification_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "promotion_package_id" UUID NOT NULL,
  "tool_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "checks" JSONB NOT NULL,
  "required_actions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "safety_notes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "certified_for_governance" BOOLEAN NOT NULL DEFAULT false,
  "certified_for_runtime_management" BOOLEAN NOT NULL DEFAULT false,
  "certified_for_runner_dispatch" BOOLEAN NOT NULL DEFAULT false,
  "certified_for_mission_start" BOOLEAN NOT NULL DEFAULT false,
  "package_status" TEXT NOT NULL,
  "readiness_status" TEXT NOT NULL,
  "governance_status" TEXT NOT NULL,
  "runtime_status" TEXT NOT NULL,
  "runner_status" TEXT NOT NULL,
  "generated_at" TIMESTAMP(3) NOT NULL,
  "generated_by_user_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "third_party_tool_promotion_certifications_pkey"
    PRIMARY KEY ("third_party_tool_promotion_certification_id"),
  CONSTRAINT "third_party_tool_promotion_certifications_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "third_party_tool_promotion_certifications_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "third_party_tool_candidates"("third_party_tool_candidate_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "third_party_tool_promotion_certifications_promotion_package_id_fkey"
    FOREIGN KEY ("promotion_package_id") REFERENCES "third_party_tool_promotion_packages"("third_party_tool_promotion_package_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "third_party_tool_promotion_certifications_generated_by_user_id_fkey"
    FOREIGN KEY ("generated_by_user_id") REFERENCES "users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "third_party_tool_promotion_certifications_tenant_id_created_at_idx"
  ON "third_party_tool_promotion_certifications"("tenant_id", "created_at");

CREATE INDEX "third_party_tool_promotion_certifications_tenant_id_candidate_id_created_at_idx"
  ON "third_party_tool_promotion_certifications"("tenant_id", "candidate_id", "created_at");

CREATE INDEX "third_party_tool_promotion_certifications_tenant_id_promotion_package_id_created_at_idx"
  ON "third_party_tool_promotion_certifications"("tenant_id", "promotion_package_id", "created_at");

CREATE INDEX "third_party_tool_promotion_certifications_tenant_id_status_idx"
  ON "third_party_tool_promotion_certifications"("tenant_id", "status");

CREATE INDEX "third_party_tool_promotion_certifications_tool_id_idx"
  ON "third_party_tool_promotion_certifications"("tool_id");
