-- P08-8 / wave6: internal design-partner session learning notes.
-- Honest sessionCount starts at 0; notes never claim public references.

CREATE TABLE "design_partner_session_notes" (
  "session_note_id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "partner_code" TEXT NOT NULL,
  "role_band" TEXT,
  "note" TEXT NOT NULL,
  "outcome" TEXT,
  "session_date" TIMESTAMP(3),
  "created_by" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "design_partner_session_notes_pkey" PRIMARY KEY ("session_note_id"),
  CONSTRAINT "design_partner_session_notes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "design_partner_session_notes_created_by_fkey"
    FOREIGN KEY ("created_by") REFERENCES "users"("user_id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "design_partner_session_notes_tenant_id_created_at_idx"
  ON "design_partner_session_notes"("tenant_id", "created_at");

CREATE INDEX "design_partner_session_notes_tenant_id_session_date_idx"
  ON "design_partner_session_notes"("tenant_id", "session_date");

ALTER TABLE "design_partner_session_notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "design_partner_session_notes" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "design_partner_session_notes"
  USING (app_current_tenant() IS NULL OR tenant_id = app_current_tenant())
  WITH CHECK (app_current_tenant() IS NULL OR tenant_id = app_current_tenant());
