-- Reconcile enum types with the Prisma schema. Each value below exists in the
-- schema (and is referenced by application code) but was never added by a
-- migration, so any database migrated from scratch is missing it and any query
-- that references it fails with a Postgres 22P02 invalid-enum error. Uncovered
-- by the executive-trends read path (EvidencePackType 'FixVerificationReport'
-- via NON_SNAPSHOT_PACK_TYPES). IF NOT EXISTS keeps this safe on databases that
-- already carry these values.

-- EvidencePackType
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'FixVerificationReport';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'SSPMValidationReport';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'IdentityValidationReport';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'SSCSValidationReport';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'OTICSAttackPackReport';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'DORAAttestation';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'NIS2Attestation';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'SECAttestation';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'GDPRAttestation';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'PCIDSSAttestation';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'ISO27001Attestation';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'EUAiActAttestation';
ALTER TYPE "EvidencePackType" ADD VALUE IF NOT EXISTS 'ISO42001Attestation';

-- ScopeType
ALTER TYPE "ScopeType" ADD VALUE IF NOT EXISTS 'Physical';

-- SignalCategory
ALTER TYPE "SignalCategory" ADD VALUE IF NOT EXISTS 'Detection';

-- AuditEventAction
ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'remediation_auto_mitigated';
