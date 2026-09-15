-- CreateTable
CREATE TABLE "executive_metric_snapshots" (
    "snapshot_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "metric_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "executive_metric_snapshots_pkey" PRIMARY KEY ("snapshot_id")
);

-- CreateIndex
CREATE INDEX "executive_metric_snapshots_tenant_id_captured_at_idx" ON "executive_metric_snapshots"("tenant_id", "captured_at");

-- CreateIndex
CREATE INDEX "executive_metric_snapshots_tenant_id_metric_id_captured_at_idx" ON "executive_metric_snapshots"("tenant_id", "metric_id", "captured_at");

-- AddForeignKey
ALTER TABLE "executive_metric_snapshots" ADD CONSTRAINT "executive_metric_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
