ALTER TABLE "confidential_attestations"
ADD COLUMN "claims_version" TEXT,
ADD COLUMN "device_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "hardware_models" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "secure_boot" BOOLEAN,
ADD COLUMN "debug_disabled" BOOLEAN;
