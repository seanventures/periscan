CREATE TABLE "runner_task_signing_keys" (
    "signing_key_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "key_id" TEXT NOT NULL,
    "private_key_pem" TEXT NOT NULL,
    "public_key_pem" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runner_task_signing_keys_pkey" PRIMARY KEY ("signing_key_id")
);

CREATE UNIQUE INDEX "runner_task_signing_keys_tenant_id_key" ON "runner_task_signing_keys"("tenant_id");

ALTER TABLE "runner_task_signing_keys" ADD CONSTRAINT "runner_task_signing_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
