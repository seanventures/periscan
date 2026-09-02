-- CreateTable
CREATE TABLE "finding_dispositions" (
    "finding_disposition_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "finding_id" TEXT NOT NULL,
    "disposition" TEXT NOT NULL,
    "note" TEXT,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finding_dispositions_pkey" PRIMARY KEY ("finding_disposition_id")
);

-- CreateIndex
CREATE INDEX "finding_dispositions_tenant_id_idx" ON "finding_dispositions"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "finding_dispositions_tenant_id_finding_id_key" ON "finding_dispositions"("tenant_id", "finding_id");

-- AddForeignKey
ALTER TABLE "finding_dispositions" ADD CONSTRAINT "finding_dispositions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
