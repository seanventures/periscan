CREATE TYPE "ProductPersona" AS ENUM (
  'SecurityLeader',
  'SecurityEngineer',
  'GrcAuditor',
  'MsspOperator'
);

CREATE TYPE "ProductOutcome" AS ENUM (
  'PrioritizeRisk',
  'RunProofLoop',
  'ProduceAssurance',
  'TriageClients'
);

CREATE TYPE "ProofLoopStage" AS ENUM (
  'Connect',
  'Authorize',
  'Validate',
  'Understand',
  'Act',
  'Verify',
  'Prove',
  'Repeat'
);

CREATE TYPE "TenantMaturity" AS ENUM (
  'New',
  'Activating',
  'Measured',
  'Operating'
);

ALTER TYPE "AuditEventAction" ADD VALUE 'experience_profile_updated';
ALTER TYPE "AuditEventAction" ADD VALUE 'experience_feedback_submitted';

ALTER TABLE "memberships"
ADD COLUMN "product_persona" "ProductPersona",
ADD COLUMN "primary_outcome" "ProductOutcome",
ADD COLUMN "experience_profile_completed_at" TIMESTAMP(3);

CREATE TABLE "product_feedback" (
  "feedback_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "persona" "ProductPersona",
  "maturity" "TenantMaturity" NOT NULL,
  "stage" "ProofLoopStage" NOT NULL,
  "route" TEXT NOT NULL,
  "rating" INTEGER,
  "comment" TEXT,
  "mission_id" UUID,
  "evidence_pack_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "product_feedback_pkey" PRIMARY KEY ("feedback_id"),
  CONSTRAINT "product_feedback_rating_check" CHECK ("rating" IS NULL OR ("rating" >= 1 AND "rating" <= 5))
);

CREATE INDEX "product_feedback_tenant_id_created_at_idx"
ON "product_feedback"("tenant_id", "created_at");

CREATE INDEX "product_feedback_tenant_id_stage_created_at_idx"
ON "product_feedback"("tenant_id", "stage", "created_at");

CREATE INDEX "product_feedback_user_id_created_at_idx"
ON "product_feedback"("user_id", "created_at");

ALTER TABLE "product_feedback"
ADD CONSTRAINT "product_feedback_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_feedback"
ADD CONSTRAINT "product_feedback_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;
