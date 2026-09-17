-- Engagement persistence: store the result of each governed autonomous
-- engagement (POST /api/v1/engagements) so it can be read back via
-- GET /api/v1/engagements/:id. Additive only; no existing column changes.
--
-- New audit actions (engagement.run / engagement.read) make the run + read of
-- an engagement first-class, queryable AuditEvents, and a new RelatedEntityType
-- value lets those audit rows reference the engagement entity. IF NOT EXISTS
-- keeps the enum additions idempotent. None of the new enum values are USED in
-- this migration (the engagements table has no enum columns), so they are safe
-- to add in the same transaction as the table creation.
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'engagement_run';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'engagement_read';
ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'Engagement';

-- CreateTable
CREATE TABLE "engagements" (
    "engagement_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "scope_id" UUID NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "evidence_ids" UUID[],
    "generated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagements_pkey" PRIMARY KEY ("engagement_id")
);

-- CreateIndex
CREATE INDEX "engagements_tenant_id_created_at_idx" ON "engagements"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "engagements_scope_id_idx" ON "engagements"("scope_id");

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagements" ADD CONSTRAINT "engagements_scope_id_fkey" FOREIGN KEY ("scope_id") REFERENCES "scopes"("scope_id") ON DELETE CASCADE ON UPDATE CASCADE;
