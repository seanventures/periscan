ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'report_share_revoked';
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'report_accessed';

CREATE TABLE "report_shares" (
    "report_share_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "evidence_pack_id" UUID NOT NULL,
    "created_by" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "last_accessed_at" TIMESTAMP(3),
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_shares_pkey" PRIMARY KEY ("report_share_id")
);

CREATE UNIQUE INDEX "report_shares_token_hash_key" ON "report_shares"("token_hash");
CREATE INDEX "report_shares_tenant_id_evidence_pack_id_created_at_idx" ON "report_shares"("tenant_id", "evidence_pack_id", "created_at");
CREATE INDEX "report_shares_tenant_id_revoked_at_expires_at_idx" ON "report_shares"("tenant_id", "revoked_at", "expires_at");

ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_evidence_pack_id_fkey" FOREIGN KEY ("evidence_pack_id") REFERENCES "evidence_packs"("evidence_pack_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
