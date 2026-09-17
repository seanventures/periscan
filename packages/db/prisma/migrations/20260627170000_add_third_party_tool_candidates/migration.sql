ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThirdPartyToolCandidate';

ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_intake_submitted';

CREATE TYPE "ThirdPartyToolCandidateStatus" AS ENUM (
  'AcceptedForCatalogReview',
  'RequiresChanges',
  'Rejected'
);

CREATE TABLE "third_party_tool_candidates" (
  "third_party_tool_candidate_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "requested_by_user_id" UUID,
  "tool_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" "ThirdPartyToolCandidateStatus" NOT NULL,
  "manifest" JSONB NOT NULL,
  "validation_report" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "third_party_tool_candidates_pkey" PRIMARY KEY ("third_party_tool_candidate_id")
);

CREATE UNIQUE INDEX "third_party_tool_candidates_tenant_id_tool_id_key"
  ON "third_party_tool_candidates"("tenant_id", "tool_id");

CREATE INDEX "third_party_tool_candidates_tenant_id_created_at_idx"
  ON "third_party_tool_candidates"("tenant_id", "created_at");

CREATE INDEX "third_party_tool_candidates_tenant_id_status_idx"
  ON "third_party_tool_candidates"("tenant_id", "status");

CREATE INDEX "third_party_tool_candidates_tool_id_idx"
  ON "third_party_tool_candidates"("tool_id");

ALTER TABLE "third_party_tool_candidates"
  ADD CONSTRAINT "third_party_tool_candidates_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "third_party_tool_candidates"
  ADD CONSTRAINT "third_party_tool_candidates_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
