-- Offensive-validation authorization flip on the tenant. OFF by default; when an
-- admin authorizes it (recording an attestation reference), the policy engine's
-- ceiling rises from BASLite to AdvancedAdversarial. The hard safety floor is
-- never lifted.
ALTER TABLE "tenants" ADD COLUMN "offensive_validation_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "offensive_validation_authorized_by" UUID,
ADD COLUMN "offensive_validation_authorized_at" TIMESTAMP(3),
ADD COLUMN "offensive_validation_authorization_ref" TEXT;
