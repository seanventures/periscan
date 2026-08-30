import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  listModuleManifests,
  ModuleManifestSchema
} from "../../packages/modules/src/index.js";
import { SafetyLevelSchema } from "../../packages/shared/src/domain.js";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  const end = source.indexOf(nextHeader, start + startHeader.length);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function parseManifestFields(moduleRegistrySection: string) {
  const manifestSection = sectionBetween(
    moduleRegistrySection,
    "### 9.1 Module Manifest",
    "### 9.2 Safety Levels"
  );

  return manifestSection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[a-z][a-z_]+$/u.test(line));
}

function parseSafetyLevels(moduleRegistrySection: string) {
  return [...moduleRegistrySection.matchAll(/^Level\s+(\d):\s+(.+)$/gmu)].map(
    (match) => ({
      label: `Level ${match[1]}: ${match[2]}`,
      level: Number(match[1]),
      name: match[2]?.trim() ?? ""
    })
  );
}

const PRD_MANIFEST_FIELD_ALIASES: Record<string, string> = {
  approval_required: "approvalRequired",
  capability_name: "capabilityName",
  customer_visible_description: "customerVisibleDescription",
  evidence_types: "evidenceTypes",
  execution_mode: "executionMode",
  module_id: "moduleId",
  output_schema: "outputSchema",
  required_inputs: "requiredInputs",
  required_permissions: "requiredPermissions",
  resource_limits: "resourceLimits",
  safety_level: "safetyLevel",
  supported_mission_types: "supportedMissionTypes",
  timeout_seconds: "timeoutSeconds",
  tool_name: "toolName"
};

const SAFETY_LEVEL_ALIASES: Record<string, string> = {
  "Advanced Adversarial": "AdvancedAdversarial",
  "Active Non-Invasive": "ActiveNonInvasive",
  "BAS-Lite / AEV": "BASLite",
  "Controlled Validation": "ControlledValidation",
  Disallowed: "Disallowed",
  "Passive / Read-Only": "PassiveReadOnly"
};

function toCamelCase(value: string) {
  return value.replace(/_([a-z])/gu, (_, char: string) => char.toUpperCase());
}

describe("PRD section 9 Module Registry coverage", () => {
  it("keeps PRD module manifest fields represented in the shared module schema and registered manifests", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const moduleRegistrySection = sectionBetween(
      prd,
      "## 9. Module Registry",
      "## 10. Open Source Acceleration Plan"
    );
    const prdFields = parseManifestFields(moduleRegistrySection);
    const schemaFields = new Set(ModuleManifestSchema.keyof().options);
    const moduleManifests = listModuleManifests();

    expect(prdFields.length).toBeGreaterThan(0);
    expect(moduleManifests.length).toBeGreaterThan(0);

    for (const prdField of prdFields) {
      const implementationField =
        PRD_MANIFEST_FIELD_ALIASES[prdField] ?? toCamelCase(prdField);

      expect(
        schemaFields.has(implementationField),
        `${prdField} should map to ModuleManifestSchema.${implementationField}`
      ).toBe(true);

      for (const manifest of moduleManifests) {
        expect(
          Object.prototype.hasOwnProperty.call(manifest, implementationField),
          `${manifest.moduleId} should expose ${implementationField}`
        ).toBe(true);
      }
    }
  });

  it("keeps PRD safety levels aligned with the shared safety enum and registered modules", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const moduleRegistrySection = sectionBetween(
      prd,
      "## 9. Module Registry",
      "## 10. Open Source Acceleration Plan"
    );
    const prdSafetyLevels = parseSafetyLevels(moduleRegistrySection);
    const safetyEnum = new Set(SafetyLevelSchema.options);
    const moduleSafetyLevels = new Set(
      listModuleManifests().map((manifest) => manifest.safetyLevel)
    );

    expect(prdSafetyLevels.map((item) => item.level)).toEqual([
      0, 1, 2, 3, 4, 5
    ]);

    for (const { label, name } of prdSafetyLevels) {
      const implementationValue = SAFETY_LEVEL_ALIASES[name];

      expect(
        implementationValue,
        `${label} should have an explicit enum mapping`
      ).toBeDefined();
      expect(safetyEnum.has(implementationValue), label).toBe(true);
    }

    for (const safetyLevel of moduleSafetyLevels) {
      expect(safetyEnum.has(safetyLevel), safetyLevel).toBe(true);
    }

    expect([...moduleSafetyLevels]).toEqual(
      expect.arrayContaining([
        "PassiveReadOnly",
        "ActiveNonInvasive",
        "ControlledValidation",
        "BASLite",
        "AdvancedAdversarial"
      ])
    );
  });
});
