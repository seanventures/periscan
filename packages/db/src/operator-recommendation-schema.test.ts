import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../prisma/schema.prisma");
const migrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260729050000_add_operator_recommendations/migration.sql"
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

describe("OperatorRecommendation Prisma contract (P11-4)", () => {
  it("persists tenant-scoped operator proposals with payload and status", () => {
    const schema = readSchema();
    const block = modelBlock(schema, "OperatorRecommendation");

    expect(schema).toContain("enum OperatorRecommendationStatus");
    expect(schema).toContain("OperatorRecommendation");
    expect(block).toContain("tenantId");
    expect(block).toContain("scopeId");
    expect(block).toContain("payload");
    expect(block).toContain("status");
    expect(block).toContain("createdAt");
    expect(block).toContain("OperatorRecommendationStatus");
    expect(block).toContain('@relation(fields: [tenantId]');
    expect(block).toContain('@relation(fields: [scopeId]');
    expect(block).toContain('@@map("operator_recommendations")');
    expect(block).toContain("@@index([tenantId, createdAt])");
    expect(block).toContain("@@index([tenantId, status])");
    expect(modelBlock(schema, "Tenant")).toMatch(
      /\boperatorRecommendations\s+OperatorRecommendation\[\]/u
    );
    expect(modelBlock(schema, "Scope")).toMatch(
      /\boperatorRecommendations\s+OperatorRecommendation\[\]/u
    );
    expect(schema).toMatch(
      /enum RelatedEntityType \{[\s\S]*?\bOperatorRecommendation\b/u
    );
  });

  it("adds table, status enum, related entity type, and tenant RLS", () => {
    const migration = readMigration();

    expect(migration).toContain('CREATE TABLE "operator_recommendations"');
    expect(migration).toContain('"tenant_id" UUID NOT NULL');
    expect(migration).toContain('"scope_id" UUID');
    expect(migration).toContain('"payload" JSONB NOT NULL');
    expect(migration).toContain('"status" "OperatorRecommendationStatus" NOT NULL');
    expect(migration).toContain('"created_at" TIMESTAMP(3) NOT NULL');
    expect(migration).toContain(
      'CREATE TYPE "OperatorRecommendationStatus" AS ENUM'
    );
    expect(migration).toContain("'Proposed'");
    expect(migration).toContain("'Approved'");
    expect(migration).toContain("'NotActionable'");
    expect(migration).toContain(
      "ALTER TYPE \"RelatedEntityType\" ADD VALUE IF NOT EXISTS 'OperatorRecommendation'"
    );
    expect(migration).toContain(
      'ALTER TABLE "operator_recommendations" ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).toContain(
      'CREATE POLICY tenant_isolation ON "operator_recommendations"'
    );
  });
});
