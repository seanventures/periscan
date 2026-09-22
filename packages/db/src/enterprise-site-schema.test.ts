import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../prisma/schema.prisma");
const migrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260918010000_add_enterprise_sites/migration.sql"
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

describe("EnterpriseSite Prisma contract", () => {
  it("persists tenant-scoped Fortune 1000 sites with cidrs, adDomains, and runnerIds", () => {
    const schema = readSchema();
    const block = modelBlock(schema, "EnterpriseSite");

    expect(block).toContain("siteId");
    expect(block).toContain("tenantId");
    expect(block).toContain("name");
    expect(block).toContain("cidrs");
    expect(block).toContain("adDomains");
    expect(block).toContain("runnerIds");
    expect(block).not.toMatch(/Headquarters|US-East|Default site/i);
    expect(block).toContain("@relation(fields: [tenantId]");
    expect(block).toContain("onDelete: Cascade");
    expect(block).toContain("@@index([tenantId, createdAt])");
    expect(block).toContain('@@map("enterprise_sites")');
    expect(modelBlock(schema, "Tenant")).toMatch(
      /\benterpriseSites\s+EnterpriseSite\[\]/u
    );
  });

  it("adds an additive tenant-scoped table with RLS and no invented HQ seed", () => {
    const migration = readMigration();

    expect(migration).toContain('CREATE TABLE "enterprise_sites"');
    expect(migration).toContain('"tenant_id" UUID NOT NULL');
    expect(migration).toContain('"name" TEXT NOT NULL');
    expect(migration).toContain('"cidrs" TEXT[]');
    expect(migration).toContain('"ad_domains" TEXT[]');
    expect(migration).toContain('"runner_ids" TEXT[]');
    expect(migration).toContain('REFERENCES "tenants"("tenant_id")');
    expect(migration).toContain(
      'ALTER TABLE "enterprise_sites" ENABLE ROW LEVEL SECURITY'
    );
    expect(migration).toContain(
      'ALTER TABLE "enterprise_sites" FORCE ROW LEVEL SECURITY'
    );
    expect(migration).toContain(
      'CREATE POLICY tenant_isolation ON "enterprise_sites"'
    );
    expect(migration).toContain(
      "app_current_tenant() IS NULL OR tenant_id = app_current_tenant()"
    );
    expect(migration).not.toMatch(/Headquarters|US-East|Default site/i);
    expect(migration).not.toMatch(/INSERT INTO "enterprise_sites"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "scim_tokens"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "users"/iu);
    expect(migration).not.toMatch(/DROP TABLE "runners"/iu);
  });
});
