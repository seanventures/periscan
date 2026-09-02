import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(currentDir, "../prisma/schema.prisma");
const migrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260619010000_add_tenant_sso_config/migration.sql"
);
const authRequestMigrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260619020000_add_tenant_sso_auth_requests/migration.sql"
);
const samlMigrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260620090000_add_saml_sso_support/migration.sql"
);
const roleMappingMigrationPath = resolve(
  currentDir,
  "../prisma/migrations/20260729060000_add_sso_role_claim_mapping/migration.sql"
);

function readSchema() {
  return readFileSync(schemaPath, "utf8");
}

function readMigration() {
  return readFileSync(migrationPath, "utf8");
}

function readAuthRequestMigration() {
  return readFileSync(authRequestMigrationPath, "utf8");
}

function readSamlMigration() {
  return readFileSync(samlMigrationPath, "utf8");
}

function readRoleMappingMigration() {
  return readFileSync(roleMappingMigrationPath, "utf8");
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

describe("tenant SSO Prisma contract", () => {
  it("keeps OIDC SSO configuration tenant-scoped and secret-bearing", () => {
    const schema = readSchema();
    const block = modelBlock(schema, "TenantSsoConfig");

    expect(schema).toContain("enum TenantSsoProviderType");
    expect(schema).toContain("SAML");
    expect(schema).toContain("enum TenantSsoStatus");
    expect(block).toContain("tenantId");
    expect(block).toContain("clientSecretEncrypted");
    expect(block).toContain("samlIdpCertificate");
    expect(block).toContain("samlNameIdFormat");
    expect(block).toContain("@relation(fields: [tenantId]");
    expect(block).toContain("onDelete: Cascade");
    expect(block).toContain("@@index([tenantId, updatedAt])");
    expect(block).toContain('@@map("tenant_sso_configs")');
    expect(modelBlock(schema, "Tenant")).toMatch(
      /\bssoConfig\s+TenantSsoConfig\?/u
    );
  });

  it("adds only SSO persistence and audit enum values", () => {
    const migration = readMigration();

    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS "tenant_sso_configs"'
    );
    expect(migration).toContain('"client_secret_encrypted" TEXT');
    expect(migration).toContain(
      "ALTER TYPE \"AuditEventAction\" ADD VALUE IF NOT EXISTS 'sso_config_updated'"
    );
    expect(migration).toContain(
      "ALTER TYPE \"AuditEventAction\" ADD VALUE IF NOT EXISTS 'sso_config_disabled'"
    );
    expect(migration).not.toMatch(/CREATE TABLE "users"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "memberships"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "validation_missions"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "jobs"/iu);
  });

  it("keeps OIDC login state tenant-scoped, hashed, and transient", () => {
    const schema = readSchema();
    const migration = readAuthRequestMigration();
    const block = modelBlock(schema, "TenantSsoAuthRequest");

    expect(block).toContain("tenantId");
    expect(block).toContain("stateHash");
    expect(block).toContain("@unique");
    expect(block).toContain("nonceHash");
    expect(block).toContain("protocolRequestIdHash");
    expect(block).toContain("expiresAt");
    expect(block).toContain("consumedAt");
    expect(block).toContain("@relation(fields: [tenantId]");
    expect(block).toContain("onDelete: Cascade");
    expect(block).toContain('@@map("tenant_sso_auth_requests")');
    expect(modelBlock(schema, "Tenant")).toMatch(
      /\bssoAuthRequests\s+TenantSsoAuthRequest\[\]/u
    );
    expect(migration).toContain(
      'CREATE TABLE IF NOT EXISTS "tenant_sso_auth_requests"'
    );
    expect(migration).toContain('"state_hash" TEXT NOT NULL');
    expect(migration).toContain('"nonce_hash" TEXT NOT NULL');
    expect(migration).toContain(
      "ALTER TYPE \"AuditEventAction\" ADD VALUE IF NOT EXISTS 'sso_login_started'"
    );
    expect(migration).toContain(
      "ALTER TYPE \"AuditEventAction\" ADD VALUE IF NOT EXISTS 'sso_login_completed'"
    );
    expect(migration).toContain(
      "ALTER TYPE \"AuditEventAction\" ADD VALUE IF NOT EXISTS 'sso_login_failed'"
    );
  });

  it("adds SAML configuration and request-correlation fields incrementally", () => {
    const migration = readSamlMigration();

    expect(migration).toContain(
      `ALTER TYPE "TenantSsoProviderType" ADD VALUE IF NOT EXISTS 'SAML'`
    );
    expect(migration).toContain('"saml_idp_certificate" TEXT');
    expect(migration).toContain('"saml_name_id_format" TEXT');
    expect(migration).toContain('"protocol_request_id_hash" TEXT');
    expect(migration).toContain(
      '"tenant_sso_auth_requests_protocol_request_id_hash_key"'
    );
    expect(migration).not.toMatch(/CREATE TABLE "users"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "memberships"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "validation_missions"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "jobs"/iu);
  });

  it("stores configurable group/claim → MembershipRole mapping fields", () => {
    const schema = readSchema();
    const migration = readRoleMappingMigration();
    const block = modelBlock(schema, "TenantSsoConfig");

    expect(block).toContain("roleClaimName");
    expect(block).toContain("roleMappings");
    expect(block).toContain("defaultMappedRole");
    expect(block).toContain('@map("role_claim_name")');
    expect(block).toContain('@map("role_mappings")');
    expect(block).toContain('@map("default_mapped_role")');
    expect(migration).toContain('"role_claim_name" TEXT');
    expect(migration).toContain('"role_mappings" JSONB');
    expect(migration).toContain('"default_mapped_role" "MembershipRole"');
    expect(migration).not.toMatch(/CREATE TABLE "users"/iu);
    expect(migration).not.toMatch(/CREATE TABLE "memberships"/iu);
  });
});
