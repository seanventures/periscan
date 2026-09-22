import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../prisma/schema.prisma");
const migrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260917210000_add_observer_health_samples/migration.sql"
);

function readSchema() {
  return readFileSync(schemaPath, "utf8");
}

function readMigration() {
  return readFileSync(migrationPath, "utf8");
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

describe("ObserverHealthSample Prisma contract (PERISCAN-590)", () => {
  it("persists tenant-scoped control-source health samples, not detections", () => {
    const schema = readSchema();
    const block = modelBlock(schema, "ObserverHealthSample");

    expect(block).toContain("observerHealthSampleId");
    expect(block).toContain("tenantId");
    expect(block).toContain("controlSourceId");
    expect(block).toContain("observedAt");
    expect(block).toContain("receivedAt");
    expect(block).toContain("healthStatus");
    expect(block).toContain("telemetryStatus");
    expect(block).toContain("IntegrationHealthStatus");
    expect(block).not.toContain("marker");
    expect(block).not.toContain("eventId");
    expect(block).not.toContain("verdict");
    expect(block).not.toContain("outcome");
    expect(block).toContain("@relation(fields: [tenantId]");
    expect(block).toContain("@relation(fields: [controlSourceId]");
    expect(block).toContain("onDelete: Cascade");
    expect(block).toContain("@@index([tenantId, observedAt])");
    expect(block).toContain("@@index([controlSourceId, observedAt])");
    expect(block).toContain('@@map("observer_health_samples")');
    expect(modelBlock(schema, "Tenant")).toMatch(
      /\bobserverHealthSamples\s+ObserverHealthSample\[\]/u
    );
    expect(modelBlock(schema, "ControlSource")).toMatch(
      /\bhealthSamples\s+ObserverHealthSample\[\]/u
    );
  });

  it("adds an immutable tenant-scoped table with RLS", () => {
    const migration = readMigration();

    expect(migration).toContain('CREATE TABLE "observer_health_samples"');
    expect(migration).toContain('"tenant_id" UUID NOT NULL');
    expect(migration).toContain('"control_source_id" UUID NOT NULL');
    expect(migration).toContain('"observed_at" TIMESTAMP(3) NOT NULL');
    expect(migration).toContain('"health_status" "IntegrationHealthStatus"');
    expect(migration).toContain('"telemetry_status" "IntegrationHealthStatus"');
    expect(migration).toContain('REFERENCES "tenants"("tenant_id")');
    expect(migration).toContain(
      'REFERENCES "control_sources"("control_source_id")'
    );
    expect(migration).toContain(
      'ALTER TABLE "observer_health_samples" ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).toContain(
      'ALTER TABLE "observer_health_samples" FORCE ROW LEVEL SECURITY'
    );
    expect(migration).toContain(
      'CREATE POLICY tenant_isolation ON "observer_health_samples"'
    );
    expect(migration).toContain(
      "app_current_tenant() IS NULL OR tenant_id = app_current_tenant()"
    );
    expect(migration).toContain("Observer health history is immutable");
    expect(migration).not.toMatch(/CREATE TABLE "signals"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "evidence_artifacts"/iu);
  });
});
