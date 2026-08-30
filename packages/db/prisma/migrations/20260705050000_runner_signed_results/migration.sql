-- Runner-signed results: the runner registers an Ed25519 result-signing public
-- key and signs every result; the control plane verifies against the stored key
-- before trusting the measurement (non-repudiable runner provenance, not just
-- transport auth). The verified signature is persisted for chain of custody.

-- AlterTable
ALTER TABLE "runners" ADD COLUMN "result_signing_public_key_pem" TEXT;

-- AlterTable
ALTER TABLE "runner_tasks" ADD COLUMN "result_signature" TEXT,
ADD COLUMN "result_signature_verified_at" TIMESTAMP(3);
