import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../prisma/schema.prisma");
const migrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260917220000_add_inbound_scim/migration.sql"
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

describe("inbound SCIM Prisma contract", () => {
  it("stores a tenant-scoped hashed ScimToken, not the raw bearer secret", () => {
    const schema = readSchema();
    const block = modelBlock(schema, "ScimToken");

    expect(block).toContain("scimTokenId");
    expect(block).toContain("tenantId");
    expect(block).toContain("tokenHash");
    expect(block).toContain("tokenPrefix");
    expect(block).toContain("revokedAt");
    expect(block).not.toContain("rawToken");
    expect(block).not.toContain("plaintext");
    expect(block).toContain("@unique");
    expect(block).toContain("@relation(fields: [tenantId]");
    expect(block).toContain("onDelete: Cascade");
    expect(block).toContain("@@index([tenantId, createdAt])");
    expect(block).toContain('@@map("scim_tokens")');
    expect(modelBlock(schema, "Tenant")).toMatch(/\bscimTokens\s+ScimToken\[\]/u);
  });

  it("keeps SCIM group records tenant-scoped for IdP group lifecycle", () => {
    const schema = readSchema();
    const block = modelBlock(schema, "ScimGroup");

    expect(block).toContain("scimGroupId");
    expect(block).toContain("tenantId");
    expect(block).toContain("displayName");
    expect(block).toContain("externalId");
    expect(block).toContain("members");
    expect(block).toContain("@relation(fields: [tenantId]");
    expect(block).toContain("onDelete: Cascade");
    expect(block).toContain('@@map("scim_groups")');
    expect(modelBlock(schema, "Tenant")).toMatch(/\bscimGroups\s+ScimGroup\[\]/u);
  });

  it("adds MembershipStatus Active/Inactive so deprovision does not delete rows", () => {
    const schema = readSchema();
    const membership = modelBlock(schema, "Membership");

    expect(schema).toContain("enum MembershipStatus");
    expect(schema).toMatch(/enum MembershipStatus \{[\s\S]*Active[\s\S]*Inactive/u);
    expect(membership).toContain("status");
    expect(membership).toContain("MembershipStatus");
    expect(membership).toContain("@default(Active)");
  });

  it("adds inbound SCIM audit actions without rewriting users or evidence", () => {
    const schema = readSchema();
    expect(schema).toContain("user_scim_provisioned");
    expect(schema).toContain("user_scim_deprovisioned");

    const migration = readMigration();
    expect(migration).toContain('CREATE TABLE "scim_tokens"');
    expect(migration).toContain('"token_hash" TEXT NOT NULL');
    expect(migration).toContain('CREATE TABLE "scim_groups"');
    expect(migration).toContain('ALTER TABLE "scim_tokens" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('ALTER TABLE "scim_groups" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('CREATE POLICY tenant_isolation ON "scim_tokens"');
    expect(migration).toContain('CREATE POLICY tenant_isolation ON "scim_groups"');
    expect(migration).toContain("ADD VALUE IF NOT EXISTS 'user_scim_provisioned'");
    expect(migration).toContain("ADD VALUE IF NOT EXISTS 'user_scim_deprovisioned'");
    expect(migration).toContain('"MembershipStatus"');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS "status"');
    expect(migration).not.toMatch(/CREATE TABLE "users"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "evidence_artifacts"/iu);
    expect(migration).not.toMatch(/DROP TABLE "memberships"/iu);
  });
});
