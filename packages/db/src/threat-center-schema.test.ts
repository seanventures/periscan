import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../prisma/schema.prisma");
const manualImportMigrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260604120000_add_threat_center_manual_import/migration.sql"
);

function readSchema() {
  return readFileSync(schemaPath, "utf8");
}

function readManualImportMigration() {
  return readFileSync(manualImportMigrationPath, "utf8");
}

function modelBlock(schema: string, modelName: string) {
  const match = new RegExp(`model ${modelName} \\{[\\s\\S]*?\\n\\}`, "u").exec(
    schema
  );

  if (!match) {
    throw new Error(`Missing Prisma model ${modelName}`);
  }

  return match[0];
}

describe("Threat Center Prisma contract", () => {
  it("keeps manual advisory entities tenant-scoped and evidence-linked", () => {
    const schema = readSchema();
    const tenantScopedModels = [
      "ThreatAdvisory",
      "ThreatPackage",
      "MissingSignal",
      "AdvisoryImpactAssessment",
      "ThreatValidationPlan",
      "ThreatValidationPlanItem",
      "AdvisoryReadinessReport"
    ];

    for (const modelName of tenantScopedModels) {
      const block = modelBlock(schema, modelName);

      expect(block).toContain("tenantId");
      expect(block).toMatch(/\btenant\s+Tenant\b/u);
      expect(block).toContain("@relation(fields: [tenantId]");
      expect(block).toContain("@@index([tenantId, createdAt])");
    }

    expect(modelBlock(schema, "ThreatAdvisory")).toContain("rawEvidenceId");
    expect(modelBlock(schema, "ThreatAdvisory")).toContain("evidenceIds");
    expect(modelBlock(schema, "ThreatPackage")).toContain("evidenceIds");
    expect(modelBlock(schema, "AdvisoryImpactAssessment")).toContain(
      "missingSignalIds"
    );
    expect(modelBlock(schema, "AdvisoryImpactAssessment")).toContain(
      "evidenceIds"
    );
    expect(modelBlock(schema, "ThreatValidationPlan")).toContain("evidenceIds");
    expect(modelBlock(schema, "ThreatValidationPlanItem")).toContain(
      "missingSignalIds"
    );
    expect(modelBlock(schema, "ThreatValidationPlanItem")).toContain(
      "evidenceIds"
    );
    expect(modelBlock(schema, "AdvisoryReadinessReport")).toContain(
      "missingSignalIds"
    );
    expect(modelBlock(schema, "AdvisoryReadinessReport")).toContain(
      "evidenceIds"
    );
  });

  it("keeps manual import persistence separate from external feed ingestion and jobs", () => {
    const migration = readManualImportMigration();

    expect(migration).toContain('CREATE TABLE "threat_advisories"');
    expect(migration).toContain('CREATE TABLE "threat_packages"');
    expect(migration).toContain('CREATE TABLE "missing_signals"');
    expect(migration).toContain('CREATE TABLE "advisory_impact_assessments"');
    expect(migration).toContain('CREATE TABLE "threat_validation_plans"');
    expect(migration).toContain('CREATE TABLE "threat_validation_plan_items"');
    expect(migration).toContain('CREATE TABLE "advisory_readiness_reports"');
    expect(migration).toContain(
      'CREATE INDEX "threat_advisories_tenant_id_created_at_idx"'
    );
    expect(migration).toContain(
      'CREATE INDEX "advisory_readiness_reports_tenant_id_advisory_idx"'
    );
    expect(migration).not.toMatch(/\bthreat_feeds\b/iu);
    expect(migration).not.toMatch(/\bfeed_ingestion\b/iu);
    expect(migration).not.toMatch(/CREATE TABLE "jobs"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "validation_missions"/iu);
  });
});
