import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SBOM_PATH,
  renderCycloneDxSbom,
  type CycloneDxSbomInventory
} from "../../scripts/generate-cyclonedx-sbom.ts";

function createInventory(
  overrides: Partial<CycloneDxSbomInventory> = {}
): CycloneDxSbomInventory {
  return {
    generatedAt: "2026-08-30T00:00:00.000Z",
    nodeDependencies: [],
    ...overrides
  };
}

describe("product CycloneDX SBOM", () => {
  it("encodes pnpm Node dependencies as a CycloneDX 1.6 document", () => {
    const bom = renderCycloneDxSbom(
      createInventory({
        nodeDependencies: [
          {
            dependents: ["periscan", "@periscan/api"],
            license: "MIT",
            name: "zod",
            version: "4.1.12"
          },
          {
            dependents: ["@periscan/web"],
            license: "(BSD-3-Clause OR GPL-2.0)",
            name: "@scope/dual",
            version: "1.2.3"
          }
        ]
      }),
      {
        productVersion: "test",
        serialNumber: "urn:uuid:00000000-0000-4000-8000-000000000002"
      }
    );

    expect(bom.bomFormat).toBe("CycloneDX");
    expect(bom.specVersion).toBe("1.6");
    expect(bom.serialNumber).toBe(
      "urn:uuid:00000000-0000-4000-8000-000000000002"
    );
    expect(bom.metadata.component).toMatchObject({
      name: "periscan",
      type: "application",
      licenses: [{ license: { id: "Apache-2.0" } }]
    });
    expect(bom.metadata.properties).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "periscan:sbom-purpose",
          value: expect.stringMatching(/dependency inventory/i)
        })
      ])
    );
    expect(bom.components).toEqual([
      {
        "bom-ref": "pkg:npm/%40scope/dual@1.2.3",
        group: "@scope",
        licenses: [{ expression: "(BSD-3-Clause OR GPL-2.0)" }],
        name: "dual",
        purl: "pkg:npm/%40scope/dual@1.2.3",
        type: "library",
        version: "1.2.3"
      },
      {
        "bom-ref": "pkg:npm/zod@4.1.12",
        licenses: [{ license: { id: "MIT" } }],
        name: "zod",
        purl: "pkg:npm/zod@4.1.12",
        type: "library",
        version: "4.1.12"
      }
    ]);
  });

  it("does not catalog optional copyleft engines as product components", () => {
    const bom = renderCycloneDxSbom(
      createInventory({
        nodeDependencies: [
          {
            dependents: ["periscan"],
            license: "Apache-2.0",
            name: "fastify",
            version: "5.0.0"
          }
        ],
        tools: [
          {
            binaryName: "sharphound",
            category: "IdentityPathing",
            defaultVersion: "2.0.0",
            displayName: "SharpHound",
            dockerImage: null,
            docsUrl: "https://example.invalid/sharphound",
            gitRepo: "https://example.invalid/sharphound.git",
            license: "GPL-3.0",
            moduleIds: [],
            notes: "legal-review only",
            npmPackage: null,
            phase: "Current",
            pipPackage: null,
            policyStatus: "RequiresLegalReview",
            runtimePreference: ["git"],
            toolId: "sharphound"
          }
        ]
      })
    );

    expect(bom.components.map((component) => component.name)).toEqual([
      "fastify"
    ]);
    expect(JSON.stringify(bom.components)).not.toMatch(/sharphound|GPL-3\.0/i);
  });

  it("keeps unknown non-SPDX licenses as names instead of fake SPDX ids", () => {
    const bom = renderCycloneDxSbom(
      createInventory({
        nodeDependencies: [
          {
            dependents: ["periscan"],
            license: "UNKNOWN",
            name: "mystery",
            version: "0.0.1"
          }
        ]
      })
    );

    expect(bom.components[0]?.licenses).toEqual([
      { license: { name: "UNKNOWN" } }
    ]);
  });

  it("ships a dedicated workflow that uploads sbom.json on main", async () => {
    const workflow = await readFile(
      path.join(process.cwd(), ".github/workflows/sbom.yml"),
      "utf8"
    );

    expect(workflow).toContain("workflow_dispatch");
    expect(workflow).toMatch(/branches:\s*\n\s+-\s+main/u);
    expect(workflow).toContain("pnpm sbom:write");
    expect(workflow).toContain("upload-artifact");
    expect(workflow).toMatch(/name:\s*sbom\.json/);
    expect(workflow).toContain(DEFAULT_SBOM_PATH);
    expect(workflow).not.toMatch(/licenses:write/);
    expect(workflow).not.toContain("pull_request");
  });
});
