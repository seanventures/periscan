-- P17-2: configurable IdP group/claim → MembershipRole mapping on tenant SSO.

ALTER TABLE "tenant_sso_configs"
  ADD COLUMN IF NOT EXISTS "role_claim_name" TEXT,
  ADD COLUMN IF NOT EXISTS "role_mappings" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "default_mapped_role" "MembershipRole";
