-- P17-14: optional JIT create-on-first-SSO (domain allowlist + default Viewer).

ALTER TABLE "tenant_sso_configs"
  ADD COLUMN IF NOT EXISTS "jit_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "jit_email_domains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "jit_default_role" "MembershipRole" NOT NULL DEFAULT 'Viewer';

ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'user_jit_provisioned';
