ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_promotion_package_generated';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThirdPartyToolPromotionPackage';

CREATE TABLE "third_party_tool_promotion_packages" (
  "third_party_tool_promotion_package_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "candidate_id" UUID NOT NULL,
  "tool_id" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "review_status" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "catalog_snapshot" JSONB NOT NULL,
  "readiness_report" JSONB NOT NULL,
  "governance_snapshot" JSONB NOT NULL,
  "runtime_installation" JSONB NOT NULL,
  "module_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "capability_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "required_evidence" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "safety_notes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "implementation_owner" TEXT,
  "promoted_by_user_id" UUID,
  "promoted_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "third_party_tool_promotion_packages_pkey"
    PRIMARY KEY ("third_party_tool_promotion_package_id"),
  CONSTRAINT "third_party_tool_promotion_packages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "third_party_tool_promotion_packages_candidate_id_fkey"
    FOREIGN KEY ("candidate_id") REFERENCES "third_party_tool_candidates"("third_party_tool_candidate_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "third_party_tool_promotion_packages_promoted_by_user_id_fkey"
    FOREIGN KEY ("promoted_by_user_id") REFERENCES "users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "third_party_tool_promotion_packages_tenant_id_created_at_idx"
  ON "third_party_tool_promotion_packages"("tenant_id", "created_at");

CREATE INDEX "third_party_tool_promotion_packages_tenant_id_candidate_id_created_at_idx"
  ON "third_party_tool_promotion_packages"("tenant_id", "candidate_id", "created_at");

CREATE INDEX "third_party_tool_promotion_packages_tenant_id_status_idx"
  ON "third_party_tool_promotion_packages"("tenant_id", "status");

CREATE INDEX "third_party_tool_promotion_packages_tool_id_idx"
  ON "third_party_tool_promotion_packages"("tool_id");
