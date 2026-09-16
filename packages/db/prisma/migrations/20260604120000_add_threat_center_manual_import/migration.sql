DO $$
BEGIN
  ALTER TYPE "AuditEventAction" ADD VALUE IF NOT EXISTS 'threat_advisory_imported';
END $$;

DO $$
BEGIN
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'RequiresVerifiedScope';
  ALTER TYPE "ValidationState" ADD VALUE IF NOT EXISTS 'RequiresInternalRunner';
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ThreatAdvisoryStatus') THEN
    CREATE TYPE "ThreatAdvisoryStatus" AS ENUM ('Imported', 'Assessed', 'PlanReady', 'Closed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ThreatReadinessStatus') THEN
    CREATE TYPE "ThreatReadinessStatus" AS ENUM ('Ready', 'MissingSignals', 'RequiresApproval', 'NotConfigured');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MissingSignalStatus') THEN
    CREATE TYPE "MissingSignalStatus" AS ENUM ('NotConfigured', 'RequiresIntegration', 'RequiresVerifiedScope', 'RequiresInternalRunner', 'RequiresApproval', 'NotImplemented');
  END IF;
END $$;

CREATE TABLE "threat_advisories" (
  "threat_advisory_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "source_name" TEXT NOT NULL,
  "source_url" TEXT,
  "summary" TEXT NOT NULL,
  "raw_evidence_id" UUID NOT NULL,
  "cve_ids" TEXT[] NOT NULL,
  "ioc_values" TEXT[] NOT NULL,
  "technique_ids" TEXT[] NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "published_at" TIMESTAMP(3),
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" "ThreatAdvisoryStatus" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "threat_advisories_pkey" PRIMARY KEY ("threat_advisory_id")
);

CREATE TABLE "threat_packages" (
  "threat_package_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "threat_advisory_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "cve_ids" TEXT[] NOT NULL,
  "ioc_values" TEXT[] NOT NULL,
  "technique_ids" TEXT[] NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "threat_packages_pkey" PRIMARY KEY ("threat_package_id")
);

CREATE TABLE "missing_signals" (
  "missing_signal_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "threat_advisory_id" UUID NOT NULL,
  "related_entity_type" "RelatedEntityType" NOT NULL,
  "related_entity_id" UUID NOT NULL,
  "signal_type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "MissingSignalStatus" NOT NULL,
  "required_integration_category" "IntegrationCategory",
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "missing_signals_pkey" PRIMARY KEY ("missing_signal_id")
);

CREATE TABLE "advisory_impact_assessments" (
  "advisory_impact_assessment_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "threat_advisory_id" UUID NOT NULL,
  "affected_asset_ids" UUID[] NOT NULL,
  "affected_finding_ids" UUID[] NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "missing_signal_ids" UUID[] NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "advisory_impact_assessments_pkey" PRIMARY KEY ("advisory_impact_assessment_id")
);

CREATE TABLE "threat_validation_plans" (
  "threat_validation_plan_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "threat_advisory_id" UUID NOT NULL,
  "status" "ValidationState" NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "threat_validation_plans_pkey" PRIMARY KEY ("threat_validation_plan_id")
);

CREATE TABLE "threat_validation_plan_items" (
  "threat_validation_plan_item_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "threat_validation_plan_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "mission_type" "MissionType" NOT NULL,
  "safety_level" "SafetyLevel" NOT NULL,
  "status" "ValidationState" NOT NULL,
  "required_scope_types" "ScopeType"[] NOT NULL,
  "required_integration_categories" "IntegrationCategory"[] NOT NULL,
  "missing_signal_ids" UUID[] NOT NULL,
  "rationale" TEXT NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "threat_validation_plan_items_pkey" PRIMARY KEY ("threat_validation_plan_item_id")
);

CREATE TABLE "advisory_readiness_reports" (
  "advisory_readiness_report_id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "threat_advisory_id" UUID NOT NULL,
  "readiness_status" "ThreatReadinessStatus" NOT NULL,
  "evidence_pack_id" UUID,
  "missing_signal_ids" UUID[] NOT NULL,
  "summary" TEXT NOT NULL,
  "evidence_ids" UUID[] NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "advisory_readiness_reports_pkey" PRIMARY KEY ("advisory_readiness_report_id")
);

CREATE UNIQUE INDEX "threat_packages_threat_advisory_id_key" ON "threat_packages"("threat_advisory_id");
CREATE UNIQUE INDEX "advisory_impact_assessments_threat_advisory_id_key" ON "advisory_impact_assessments"("threat_advisory_id");
CREATE UNIQUE INDEX "threat_validation_plans_threat_advisory_id_key" ON "threat_validation_plans"("threat_advisory_id");
CREATE UNIQUE INDEX "advisory_readiness_reports_threat_advisory_id_key" ON "advisory_readiness_reports"("threat_advisory_id");

CREATE INDEX "threat_advisories_tenant_id_created_at_idx" ON "threat_advisories"("tenant_id", "created_at");
CREATE INDEX "threat_advisories_tenant_id_status_idx" ON "threat_advisories"("tenant_id", "status");
CREATE INDEX "threat_advisories_tenant_id_source_name_idx" ON "threat_advisories"("tenant_id", "source_name");
CREATE INDEX "threat_packages_tenant_id_created_at_idx" ON "threat_packages"("tenant_id", "created_at");
CREATE INDEX "threat_packages_tenant_id_advisory_idx" ON "threat_packages"("tenant_id", "threat_advisory_id");
CREATE INDEX "missing_signals_tenant_id_created_at_idx" ON "missing_signals"("tenant_id", "created_at");
CREATE INDEX "missing_signals_tenant_id_status_idx" ON "missing_signals"("tenant_id", "status");
CREATE INDEX "missing_signals_tenant_id_advisory_idx" ON "missing_signals"("tenant_id", "threat_advisory_id");
CREATE INDEX "missing_signals_tenant_id_related_idx" ON "missing_signals"("tenant_id", "related_entity_type", "related_entity_id");
CREATE INDEX "advisory_impact_assessments_tenant_id_created_at_idx" ON "advisory_impact_assessments"("tenant_id", "created_at");
CREATE INDEX "advisory_impact_assessments_tenant_id_advisory_idx" ON "advisory_impact_assessments"("tenant_id", "threat_advisory_id");
CREATE INDEX "threat_validation_plans_tenant_id_created_at_idx" ON "threat_validation_plans"("tenant_id", "created_at");
CREATE INDEX "threat_validation_plans_tenant_id_status_idx" ON "threat_validation_plans"("tenant_id", "status");
CREATE INDEX "threat_validation_plans_tenant_id_advisory_idx" ON "threat_validation_plans"("tenant_id", "threat_advisory_id");
CREATE INDEX "threat_validation_plan_items_tenant_id_created_at_idx" ON "threat_validation_plan_items"("tenant_id", "created_at");
CREATE INDEX "threat_validation_plan_items_tenant_id_status_idx" ON "threat_validation_plan_items"("tenant_id", "status");
CREATE INDEX "threat_validation_plan_items_tenant_id_plan_idx" ON "threat_validation_plan_items"("tenant_id", "threat_validation_plan_id");
CREATE INDEX "advisory_readiness_reports_tenant_id_created_at_idx" ON "advisory_readiness_reports"("tenant_id", "created_at");
CREATE INDEX "advisory_readiness_reports_tenant_id_status_idx" ON "advisory_readiness_reports"("tenant_id", "readiness_status");
CREATE INDEX "advisory_readiness_reports_tenant_id_advisory_idx" ON "advisory_readiness_reports"("tenant_id", "threat_advisory_id");

ALTER TABLE "threat_advisories" ADD CONSTRAINT "threat_advisories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "threat_packages" ADD CONSTRAINT "threat_packages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "threat_packages" ADD CONSTRAINT "threat_packages_advisory_fkey" FOREIGN KEY ("threat_advisory_id") REFERENCES "threat_advisories"("threat_advisory_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "missing_signals" ADD CONSTRAINT "missing_signals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "missing_signals" ADD CONSTRAINT "missing_signals_advisory_fkey" FOREIGN KEY ("threat_advisory_id") REFERENCES "threat_advisories"("threat_advisory_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advisory_impact_assessments" ADD CONSTRAINT "advisory_impact_assessments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advisory_impact_assessments" ADD CONSTRAINT "advisory_impact_assessments_advisory_fkey" FOREIGN KEY ("threat_advisory_id") REFERENCES "threat_advisories"("threat_advisory_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "threat_validation_plans" ADD CONSTRAINT "threat_validation_plans_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "threat_validation_plans" ADD CONSTRAINT "threat_validation_plans_advisory_fkey" FOREIGN KEY ("threat_advisory_id") REFERENCES "threat_advisories"("threat_advisory_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "threat_validation_plan_items" ADD CONSTRAINT "threat_validation_plan_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "threat_validation_plan_items" ADD CONSTRAINT "threat_validation_plan_items_plan_fkey" FOREIGN KEY ("threat_validation_plan_id") REFERENCES "threat_validation_plans"("threat_validation_plan_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advisory_readiness_reports" ADD CONSTRAINT "advisory_readiness_reports_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("tenant_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "advisory_readiness_reports" ADD CONSTRAINT "advisory_readiness_reports_advisory_fkey" FOREIGN KEY ("threat_advisory_id") REFERENCES "threat_advisories"("threat_advisory_id") ON DELETE CASCADE ON UPDATE CASCADE;
