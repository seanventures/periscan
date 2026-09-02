ALTER TABLE "tenants"
ADD COLUMN "preferred_time_zone" TEXT NOT NULL DEFAULT 'UTC';

CREATE TABLE "tenant_localization_releases" (
  "localization_release_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "locale" TEXT NOT NULL,
  "time_zone" TEXT NOT NULL,
  "previous_locale" TEXT NOT NULL,
  "previous_time_zone" TEXT NOT NULL,
  "catalog_version" TEXT NOT NULL,
  "catalog_digest" TEXT NOT NULL,
  "coverage" JSONB NOT NULL,
  "support_owner_email" TEXT NOT NULL,
  "review_reference" TEXT NOT NULL,
  "review_reason" TEXT NOT NULL,
  "activated_by" UUID NOT NULL,
  "activated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_localization_releases_pkey" PRIMARY KEY ("localization_release_id"),
  CONSTRAINT "tenant_localization_releases_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "tenant_localization_releases_locale_check" CHECK ("locale" IN ('en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP')),
  CONSTRAINT "tenant_localization_releases_previous_locale_check" CHECK ("previous_locale" IN ('en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP')),
  CONSTRAINT "tenant_localization_releases_time_zone_check" CHECK (length("time_zone") BETWEEN 1 AND 80),
  CONSTRAINT "tenant_localization_releases_previous_time_zone_check" CHECK (length("previous_time_zone") BETWEEN 1 AND 80),
  CONSTRAINT "tenant_localization_releases_catalog_digest_check" CHECK ("catalog_digest" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "tenant_localization_releases_review_reference_check" CHECK (length("review_reference") BETWEEN 3 AND 120),
  CONSTRAINT "tenant_localization_releases_review_reason_check" CHECK (length("review_reason") BETWEEN 10 AND 1000),
  CONSTRAINT "tenant_localization_releases_support_owner_check" CHECK (position('@' in "support_owner_email") > 1),
  CONSTRAINT "tenant_localization_releases_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tenant_localization_releases_tenant_id_sequence_key"
ON "tenant_localization_releases"("tenant_id", "sequence");

CREATE INDEX "tenant_localization_releases_tenant_id_activated_at_idx"
ON "tenant_localization_releases"("tenant_id", "activated_at");

ALTER TABLE "tenant_localization_releases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_localization_releases" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "tenant_localization_releases"
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
