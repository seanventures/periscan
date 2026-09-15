ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'third_party_tool_candidate_reviewed';

CREATE TYPE "ThirdPartyToolCandidateReviewStatus" AS ENUM (
  'NotReviewed',
  'NeedsChanges',
  'AcceptedForImplementation',
  'Rejected',
  'PromotedToCatalog'
);

ALTER TABLE "third_party_tool_candidates"
  ADD COLUMN "review_status" "ThirdPartyToolCandidateReviewStatus" NOT NULL DEFAULT 'NotReviewed',
  ADD COLUMN "review_notes" TEXT,
  ADD COLUMN "reviewed_by_user_id" UUID,
  ADD COLUMN "reviewed_at" TIMESTAMP(3),
  ADD COLUMN "implementation_owner" TEXT;

CREATE INDEX "third_party_tool_candidates_tenant_id_review_status_idx"
  ON "third_party_tool_candidates"("tenant_id", "review_status");
