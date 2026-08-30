import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../prisma/schema.prisma");
const migrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260729030000_add_tool_license_acceptances/migration.sql"
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

describe("ToolLicenseAcceptance Prisma contract", () => {
  it("persists tenant-scoped license acceptance with pin identity", () => {
    const schema = readSchema();
    const block = modelBlock(schema, "ToolLicenseAcceptance");

    expect(schema).toContain("ToolLicenseAcceptance");
    expect(schema).toContain("third_party_tool_license_accepted");
    expect(block).toContain("tenantId");
    expect(block).toContain("toolId");
    expect(block).toContain("version");
    expect(block).toContain("spdx");
    expect(block).toContain("textHash");
    expect(block).toContain("acceptedBy");
    expect(block).toContain("acceptedAt");
    expect(block).toContain("@@unique([tenantId, toolId, version, textHash])");
    expect(block).toContain('@relation(fields: [tenantId]');
    expect(block).toContain('@relation(fields: [acceptedBy]');
    expect(block).toContain('@@map("tool_license_acceptances")');
    expect(modelBlock(schema, "Tenant")).toMatch(
      /\btoolLicenseAcceptances\s+ToolLicenseAcceptance\[\]/u
    );
    expect(modelBlock(schema, "User")).toMatch(
      /\btoolLicenseAcceptances\s+ToolLicenseAcceptance\[\]/u
    );
  });

  it("adds acceptance table, audit action, and related entity type", () => {
    const migration = readMigration();

    expect(migration).toContain('CREATE TABLE "tool_license_acceptances"');
    expect(migration).toContain('"tool_id" TEXT NOT NULL');
    expect(migration).toContain('"version" TEXT NOT NULL');
    expect(migration).toContain('"spdx" TEXT NOT NULL');
    expect(migration).toContain('"text_hash" TEXT NOT NULL');
    expect(migration).toContain('"accepted_by" UUID NOT NULL');
    expect(migration).toContain('"accepted_at" TIMESTAMP(3) NOT NULL');
    expect(migration).toContain(
      "ALTER TYPE \"AuditEventAction\" ADD VALUE IF NOT EXISTS 'third_party_tool_license_accepted'"
    );
    expect(migration).toContain(
      "ALTER TYPE \"RelatedEntityType\" ADD VALUE IF NOT EXISTS 'ToolLicenseAcceptance'"
    );
    expect(migration).toContain(
      "tool_license_acceptances_tenant_id_tool_id_version_text_hash_key"
    );
  });
});
