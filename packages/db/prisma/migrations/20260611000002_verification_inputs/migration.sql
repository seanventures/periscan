-- AlterTable: make the verification record self-describing about WHAT was examined
-- (which validation modules ran, which connector configs were re-fetched) and the
-- key comparison RESULT (did the previously-correlated exposure re-correlate),
-- instead of leaving that scattered across evidence artifacts.
ALTER TABLE "verification_events"
  ADD COLUMN "selected_module_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "resynced_connector_keys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "exposure_re_correlated" BOOLEAN;
