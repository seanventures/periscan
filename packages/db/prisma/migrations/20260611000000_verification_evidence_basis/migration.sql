-- AlterTable: record HOW a fix was verified so a "Fixed" outcome is auditable.
-- measured_revalidation = the exposure was re-measured from authoritative config
-- (connector resync), not merely re-tested by a validation module. retest_method
-- and previous_evidence_basis make the verification record self-describing.
ALTER TABLE "verification_events"
  ADD COLUMN "measured_revalidation" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "previous_evidence_basis" "EvidenceBasis",
  ADD COLUMN "retest_method" TEXT;
