ALTER TABLE "tenants"
ADD COLUMN "preferred_locale" TEXT NOT NULL DEFAULT 'en-US';

ALTER TABLE "tenants"
ADD CONSTRAINT "tenants_preferred_locale_check"
CHECK ("preferred_locale" IN ('en-US', 'es-ES', 'fr-FR', 'de-DE', 'ja-JP'));
