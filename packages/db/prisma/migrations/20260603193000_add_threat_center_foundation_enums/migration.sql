DO $$
BEGIN
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'Routed';
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'NoEvidence';
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'NeedsApproval';
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'NeedsInternalRunner';
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'PartiallyFixed';
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'StillExposed';
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'NotConfigured';
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'RequiresIntegration';
END $$;

DO $$
BEGIN
  ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThreatAdvisory';
  ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThreatPackage';
  ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'AdvisoryImpactAssessment';
  ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'MissingSignal';
  ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThreatValidationPlan';
  ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'ThreatValidationPlanItem';
  ALTER TYPE "RelatedEntityType" ADD VALUE IF NOT EXISTS 'AdvisoryReadinessReport';
END $$;

DO $$
BEGIN
  ALTER TYPE "EdgeRelationship" ADD VALUE IF NOT EXISTS 'AFFECTED_BY';
END $$;
