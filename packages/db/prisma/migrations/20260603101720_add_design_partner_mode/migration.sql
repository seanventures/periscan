-- AlterEnum
ALTER TYPE "AuditEventAction" ADD VALUE 'report_updated';

-- CreateTable
CREATE TABLE "tenant_design_partner_settings" (
    "tenant_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_design_partner_settings_pkey" PRIMARY KEY ("tenant_id")
);

-- CreateTable
CREATE TABLE "evidence_pack_analyst_notes" (
    "evidence_pack_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "author_label" TEXT NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidence_pack_analyst_notes_pkey" PRIMARY KEY ("evidence_pack_id")
);

-- CreateIndex
CREATE INDEX "evidence_pack_analyst_notes_tenant_id_updated_at_idx" ON "evidence_pack_analyst_notes"("tenant_id", "updated_at");

-- AddForeignKey
ALTER TABLE "tenant_design_partner_settings" ADD CONSTRAINT "tenant_design_partner_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_pack_analyst_notes" ADD CONSTRAINT "evidence_pack_analyst_notes_evidence_pack_id_fkey" FOREIGN KEY ("evidence_pack_id") REFERENCES "evidence_packs"("evidence_pack_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_pack_analyst_notes" ADD CONSTRAINT "evidence_pack_analyst_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_pack_analyst_notes" ADD CONSTRAINT "evidence_pack_analyst_notes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "graph_edges_tenant_source_target_rel_key" RENAME TO "graph_edges_tenant_id_source_node_id_target_node_id_relatio_key";
