-- AlterTable: continuous scope posture-check scheduling
ALTER TABLE "scopes"
  ADD COLUMN "last_posture_check_at" TIMESTAMP(3),
  ADD COLUMN "next_posture_check_at" TIMESTAMP(3);

-- Precise due-query for the continuous-validation sweep (verified external
-- scopes whose posture check is due) so the sweep stays due-work-only.
CREATE INDEX "scopes_verification_status_scope_type_next_posture_check_at_idx"
  ON "scopes" ("verification_status", "scope_type", "next_posture_check_at");
