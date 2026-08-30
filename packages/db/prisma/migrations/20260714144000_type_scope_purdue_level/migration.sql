CREATE TYPE "PurdueLevel" AS ENUM (
  'Level5Enterprise',
  'Level4BusinessPlanning',
  'Level3OperationsManagement',
  'Level3_5IndustrialDMZ',
  'Level2SupervisoryControl',
  'Level1BasicControl',
  'Level0Process',
  'SafetySystem'
);

ALTER TABLE "scopes"
  ALTER COLUMN "purdue_level" TYPE "PurdueLevel"
  USING "purdue_level"::"PurdueLevel";
