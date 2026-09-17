CREATE TABLE "runner_certificate_authorities" (
  "certificate_authority_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "key_id" TEXT NOT NULL,
  "private_key_pem" TEXT NOT NULL,
  "certificate_pem" TEXT NOT NULL,
  "certificate_sha256" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "runner_certificate_authorities_pkey"
    PRIMARY KEY ("certificate_authority_id")
);

CREATE UNIQUE INDEX "runner_certificate_authorities_tenant_id_key"
  ON "runner_certificate_authorities"("tenant_id");

ALTER TABLE "runner_certificate_authorities"
  ADD CONSTRAINT "runner_certificate_authorities_tenant_id_fkey"
  FOREIGN KEY ("tenant_id")
  REFERENCES "tenants"("tenant_id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
