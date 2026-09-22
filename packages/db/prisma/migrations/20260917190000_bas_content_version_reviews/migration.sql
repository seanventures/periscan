ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'bas_content_promoted';

CREATE TABLE "bas_content_version_reviews" (
  "bas_content_version_review_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "bas_content_version_id" UUID NOT NULL,
  "review_status" VARCHAR(32) NOT NULL,
  "reviewed_by_user_id" UUID NOT NULL,
  "reviewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bas_content_version_reviews_pkey" PRIMARY KEY ("bas_content_version_review_id"),
  CONSTRAINT "bas_content_version_reviews_status_check" CHECK ("review_status" = 'Reviewed'),
  CONSTRAINT "bas_content_version_reviews_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bas_content_version_reviews_version_id_fkey" FOREIGN KEY ("bas_content_version_id") REFERENCES "bas_content_versions"("bas_content_version_id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "bas_content_version_reviews_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "bas_content_version_reviews_bas_content_version_id_key" ON "bas_content_version_reviews"("bas_content_version_id");
CREATE UNIQUE INDEX "bas_content_version_reviews_identity_key" ON "bas_content_version_reviews"("tenant_id", "bas_content_version_id");
CREATE INDEX "bas_content_version_reviews_tenant_id_reviewed_at_idx" ON "bas_content_version_reviews"("tenant_id", "reviewed_at");
CREATE INDEX "bas_content_version_reviews_reviewed_by_user_id_idx" ON "bas_content_version_reviews"("reviewed_by_user_id");

-- Review rows are insert-only. Content versions remain immutable.
ALTER TABLE "bas_content_version_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "bas_content_version_reviews" FORCE ROW LEVEL SECURITY;
CREATE POLICY bas_content_reviews_read ON "bas_content_version_reviews" FOR SELECT
  USING (tenant_id = app_current_tenant());
CREATE POLICY bas_content_reviews_insert ON "bas_content_version_reviews" FOR INSERT
  WITH CHECK (tenant_id = app_current_tenant());
GRANT SELECT, INSERT ON "bas_content_version_reviews" TO periscan_rls;
REVOKE UPDATE, DELETE ON "bas_content_version_reviews" FROM periscan_rls;
