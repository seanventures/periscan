ALTER TABLE "scopes"
  ALTER COLUMN "max_safety_level" SET DEFAULT 'BASLite';

UPDATE "scopes"
SET "max_safety_level" = 'BASLite'
WHERE "max_safety_level" = 'ActiveNonInvasive'
  AND "asset_class" = 'Other'
  AND "purdue_level" IS NULL
  AND cardinality("tags") = 0;
