import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const CORE_ENTITY_NAMES = [
  "Tenant",
  "User",
  "Membership",
  "Scope",
  "Integration",
  "SignalEnvelope",
  "Asset",
  "Identity",
  "ControlSource",
  "AIApplication",
  "Exposure",
  "ValidationMission",
  "ValidationRun",
  "EvidenceArtifact",
  "AttackPath",
  "RemediationTask",
  "VerificationEvent"
] as const;

const INHERITED_TIMESTAMP_FIELDS = new Set(["createdAt", "updatedAt"]);
const INHERITED_TENANT_FIELDS = new Set(["tenantId", "createdAt", "updatedAt"]);
const VALIDATION_CONTEXT_FIELDS = new Set([
  "policyDecisionId",
  "safetyLevel",
  "scopeId"
]);
const EVIDENCE_LINKED_FIELDS = new Set(["evidenceIds"]);
const PRD_FIELD_ALIASES: Record<string, Record<string, string>> = {
  AIApplication: {
    // PRD uses the generic noun "endpoint"; implementation/API contract uses
    // endpointUrl to make the URL shape explicit and maps it to endpoint_url in
    // Prisma.
    endpoint: "endpointUrl",
    data_sources: "dataSourcesDescription",
    guardrails: "guardrailsDescription"
  }
};

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function toCamelCase(value: string) {
  return value.replace(/_([a-z0-9])/gu, (_, char: string) =>
    char.toUpperCase()
  );
}

function getSection(source: string, startMarker: string, endMarker: string) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  expect(start, `${startMarker} should exist`).toBeGreaterThanOrEqual(0);
  expect(end, `${endMarker} should exist after ${startMarker}`).toBeGreaterThan(
    start
  );

  return source.slice(start, end);
}

function parsePrdEntityFields(dataModelSection: string) {
  const lines = dataModelSection.split(/\r?\n/u);
  const fieldsByEntity = new Map<string, string[]>();

  for (const entityName of CORE_ENTITY_NAMES) {
    const entityLineIndex = lines.findIndex(
      (line) => line.trim() === entityName
    );

    expect(
      entityLineIndex,
      `${entityName} should be listed in PRD section 6`
    ).toBeGreaterThanOrEqual(0);

    const fields: string[] = [];

    for (const line of lines.slice(entityLineIndex + 1)) {
      const trimmed = line.trim();

      if (!trimmed) {
        if (fields.length > 0) {
          break;
        }
        continue;
      }

      if (!/^[a-z][a-z0-9_]+$/u.test(trimmed)) {
        break;
      }

      fields.push(trimmed);
    }

    expect(
      fields.length,
      `${entityName} should have PRD fields`
    ).toBeGreaterThan(0);
    fieldsByEntity.set(entityName, fields);
  }

  return fieldsByEntity;
}

function parseScopeTypes(dataModelSection: string) {
  const scopeTypesSection = getSection(
    dataModelSection,
    "Scope types:",
    "Integration"
  );

  return [...scopeTypesSection.matchAll(/^- ([A-Za-z]+)$/gmu)].map(
    (match) => match[1]!
  );
}

function getSharedSchemaSource(domainSource: string, entityName: string) {
  const declaration = `export const ${entityName}Schema`;
  const start = domainSource.indexOf(declaration);
  const nextExport = domainSource.indexOf("\nexport const ", start + 1);

  expect(start, `${declaration} should exist`).toBeGreaterThanOrEqual(0);

  return domainSource.slice(
    start,
    nextExport === -1 ? domainSource.length : nextExport
  );
}

function getPrismaModelSource(prismaSource: string, entityName: string) {
  const match = new RegExp(`model ${entityName} \\{[\\s\\S]*?\\n\\}`, "u").exec(
    prismaSource
  );

  expect(match, `model ${entityName} should exist in Prisma`).not.toBeNull();

  return match![0];
}

function sharedSchemaContainsField(schemaSource: string, fieldName: string) {
  if (new RegExp(`\\b${fieldName}\\s*:`, "u").test(schemaSource)) {
    return true;
  }

  if (
    INHERITED_TIMESTAMP_FIELDS.has(fieldName) &&
    /TimestampedEntitySchema|TenantScopedEntitySchema/u.test(schemaSource)
  ) {
    return true;
  }

  if (
    INHERITED_TENANT_FIELDS.has(fieldName) &&
    /TenantScopedEntitySchema/u.test(schemaSource)
  ) {
    return true;
  }

  if (
    VALIDATION_CONTEXT_FIELDS.has(fieldName) &&
    /\.merge\(ValidationContextSchema\)/u.test(schemaSource)
  ) {
    return true;
  }

  if (
    EVIDENCE_LINKED_FIELDS.has(fieldName) &&
    /\.merge\(EvidenceLinkedSchema\)/u.test(schemaSource)
  ) {
    return true;
  }

  return false;
}

function prismaModelContainsField(
  modelSource: string,
  camelField: string,
  snakeField: string
) {
  return (
    new RegExp(`\\b${camelField}\\b`, "u").test(modelSource) ||
    modelSource.includes(`@map("${snakeField}")`)
  );
}

describe("PRD data model coverage", () => {
  it("maps every PRD section 6 core entity field to shared Zod and Prisma contracts", async () => {
    const [prd, domainSource, prismaSource] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/db/prisma/schema.prisma")
    ]);
    const dataModelSection = getSection(
      prd,
      "## 6. Data Model",
      "## 7. API Specification"
    );
    const fieldsByEntity = parsePrdEntityFields(dataModelSection);

    for (const entityName of CORE_ENTITY_NAMES) {
      const sharedSchemaSource = getSharedSchemaSource(
        domainSource,
        entityName
      );
      const prismaModelSource = getPrismaModelSource(prismaSource, entityName);

      for (const snakeField of fieldsByEntity.get(entityName) ?? []) {
        const camelField =
          PRD_FIELD_ALIASES[entityName]?.[snakeField] ??
          toCamelCase(snakeField);

        expect(
          sharedSchemaContainsField(sharedSchemaSource, camelField),
          `${entityName}.${snakeField} should be represented in shared schema`
        ).toBe(true);
        expect(
          prismaModelContainsField(prismaModelSource, camelField, snakeField),
          `${entityName}.${snakeField} should be represented in Prisma model`
        ).toBe(true);
      }
    }
  });

  it("keeps PRD section 6 scope types aligned with shared and Prisma enums", async () => {
    const [prd, domainSource, prismaSource] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/db/prisma/schema.prisma")
    ]);
    const dataModelSection = getSection(
      prd,
      "## 6. Data Model",
      "## 7. API Specification"
    );
    const scopeTypes = parseScopeTypes(dataModelSection);
    const sharedScopeEnum = getSection(
      domainSource,
      "export const ScopeTypeSchema",
      "export const IntegrationCategorySchema"
    );
    const prismaScopeEnum = getSection(
      prismaSource,
      "enum ScopeType",
      "enum IntegrationCategory"
    );

    expect(scopeTypes.length).toBeGreaterThan(0);

    for (const scopeType of scopeTypes) {
      expect(sharedScopeEnum).toContain(`"${scopeType}"`);
      expect(prismaScopeEnum).toMatch(new RegExp(`\\b${scopeType}\\b`, "u"));
    }
  });
});
