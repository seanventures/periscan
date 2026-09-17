-- CreateEnum
CREATE TYPE "EvidenceBasis" AS ENUM ('Measured', 'Heuristic');

-- AlterTable
ALTER TABLE "attack_paths"
  ADD COLUMN "evidence_basis" "EvidenceBasis" NOT NULL DEFAULT 'Heuristic',
  ADD COLUMN "methodology" TEXT;
