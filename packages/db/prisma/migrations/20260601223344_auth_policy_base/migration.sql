-- CreateEnum
CREATE TYPE "PolicyDecisionOutcome" AS ENUM ('Allowed', 'Denied', 'RequiresApproval', 'RequiresVerifiedScope', 'RequiresInternalRunner', 'RequiresTimeWindow');

-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('NotRequired', 'Pending', 'Approved', 'Rejected');

-- CreateEnum
CREATE TYPE "ExecutionEnvironment" AS ENUM ('ControlPlane', 'ExternalPoA', 'InternalRunner');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventAction" ADD VALUE 'signup';
ALTER TYPE "AuditEventAction" ADD VALUE 'logout';

-- AlterEnum
ALTER TYPE "RelatedEntityType" ADD VALUE 'Scenario';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT;

-- CreateTable
CREATE TABLE "policy_decisions" (
    "policy_decision_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "scope_id" UUID NOT NULL,
    "mission_type" "MissionType" NOT NULL,
    "safety_level" "SafetyLevel" NOT NULL,
    "target" JSONB NOT NULL,
    "execution_environment" "ExecutionEnvironment" NOT NULL,
    "requested_action" JSONB NOT NULL,
    "outcome" "PolicyDecisionOutcome" NOT NULL,
    "approval_state" "ApprovalState" NOT NULL DEFAULT 'NotRequired',
    "rationale" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3),
    "approved_by" UUID,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_decisions_pkey" PRIMARY KEY ("policy_decision_id")
);

-- CreateIndex
CREATE INDEX "policy_decisions_tenant_id_created_at_idx" ON "policy_decisions"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "policy_decisions_tenant_id_outcome_idx" ON "policy_decisions"("tenant_id", "outcome");

-- CreateIndex
CREATE INDEX "policy_decisions_scope_id_idx" ON "policy_decisions"("scope_id");

-- CreateIndex
CREATE INDEX "policy_decisions_user_id_idx" ON "policy_decisions"("user_id");

-- AddForeignKey
ALTER TABLE "validation_missions" ADD CONSTRAINT "validation_missions_policy_decision_id_fkey" FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_runs" ADD CONSTRAINT "validation_runs_policy_decision_id_fkey" FOREIGN KEY ("policy_decision_id") REFERENCES "policy_decisions"("policy_decision_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_decisions" ADD CONSTRAINT "policy_decisions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
