import { describe, expect, it } from "vitest";

import {
  evaluateInventory,
  evaluateLicensePolicy,
  evaluateModuleLicensePolicy,
  findModuleToolLicenseMismatches,
  renderThirdPartyNotices,
  resolveModuleLicensePolicyStatus,
  type LicenseInventory
} from "../../scripts/license-inventory.ts";
import type { ModuleManifest } from "../../packages/modules/src/index.ts";
import type { OpenSourceToolDefinition } from "../../packages/shared/src/open-source.ts";

function createInventory(
  overrides: Partial<LicenseInventory> = {}
): LicenseInventory {
  return {
    generatedAt: "2026-06-03T00:00:00.000Z",
    moduleManifests: [],
    nodeDependencies: [],
    tools: [],
    ...overrides
  };
}

describe("license inventory policy", () => {
  it("fails closed for AGPL and unknown licenses", () => {
    expect(
      evaluateLicensePolicy({
        license: "AGPL-3.0",
        name: "unsafe-tool",
        policyStatus: "Enabled",
        source: "tool"
      })
    ).toMatchObject({
      disposition: "Blocked"
    });
    // AGPL is never a legal-review path — even RequiresLegalReview stays Blocked.
    expect(
      evaluateLicensePolicy({
        license: "AGPL-3.0",
        name: "misp",
        policyStatus: "RequiresLegalReview",
        source: "tool"
      })
    ).toMatchObject({
      disposition: "Blocked",
      reason: expect.stringMatching(/never installable|Blocked/i)
    });
    expect(
      evaluateLicensePolicy({
        license: null,
        name: "unknown-package",
        source: "node"
      })
    ).toMatchObject({
      disposition: "Blocked"
    });
  });

  it("treats NPSL as Allowed with explicit redistribution notice obligations", () => {
    expect(
      evaluateLicensePolicy({
        license: "NPSL",
        name: "nmap",
        policyStatus: "Enabled",
        source: "tool"
      })
    ).toMatchObject({
      disposition: "Allowed",
      reason: expect.stringMatching(/redistribution notice obligations/i)
    });
  });

  it("allows legal-review-blocked GPL tools only when they are not enabled", () => {
    expect(
      evaluateLicensePolicy({
        license: "GPL-3.0",
        name: "sharphound",
        policyStatus: "RequiresLegalReview",
        source: "tool"
      })
    ).toMatchObject({
      disposition: "RequiresLegalReview"
    });
    expect(
      evaluateLicensePolicy({
        license: "GPL-3.0",
        name: "enabled-collector",
        policyStatus: "Enabled",
        source: "tool"
      })
    ).toMatchObject({
      disposition: "Blocked"
    });
  });

  it("allows simple dual-license expressions with a permissive selectable alternative", () => {
    expect(
      evaluateLicensePolicy({
        license: "(BSD-3-Clause OR GPL-2.0)",
        name: "node-forge",
        source: "node"
      })
    ).toMatchObject({
      disposition: "Allowed",
      reason: expect.stringContaining("BSD-3-Clause")
    });
  });

  it("keeps combined permissive and GPL expressions blocked without legal review", () => {
    expect(
      evaluateLicensePolicy({
        license: "MIT AND GPL-2.0",
        name: "combined-obligation-package",
        source: "node"
      })
    ).toMatchObject({
      disposition: "Blocked"
    });
  });

  it("renders notices and exposes blocking entries for CI", () => {
    const inventory = createInventory({
      nodeDependencies: [
        {
          dependents: ["periscan"],
          license: "MIT",
          name: "safe-dependency",
          version: "1.0.0"
        },
        {
          dependents: ["periscan"],
          license: "UNKNOWN",
          name: "missing-license",
          version: "2.0.0"
        }
      ]
    });
    const results = evaluateInventory(inventory);

    expect(
      results.filter((result) => result.disposition === "Blocked")
    ).toEqual([
      expect.objectContaining({
        name: "missing-license"
      })
    ]);
    expect(renderThirdPartyNotices(inventory)).toContain("safe-dependency");
  });

  it("inherits RequiresLegalReview for GPL modules linked to review-gated tools", () => {
    const tools = [
      {
        binaryName: "nikto",
        category: "WebAppScan",
        defaultVersion: "2.5.0",
        displayName: "Nikto",
        dockerImage: null,
        docsUrl: "https://example.invalid/nikto",
        gitRepo: "https://example.invalid/nikto.git",
        license: "GPL-2.0",
        moduleIds: ["web.nikto_scan"],
        notes: "test",
        npmPackage: null,
        phase: "Current",
        pipPackage: null,
        policyStatus: "RequiresLegalReview",
        runtimePreference: ["git"],
        toolId: "nikto"
      }
    ] as OpenSourceToolDefinition[];

    expect(
      resolveModuleLicensePolicyStatus(
        { license: "GPL-2.0", toolIds: ["nikto"] },
        tools
      )
    ).toBe("RequiresLegalReview");
    expect(
      evaluateModuleLicensePolicy(
        {
          license: "GPL-2.0",
          moduleId: "web.nikto_scan",
          toolIds: ["nikto"]
        },
        tools
      )
    ).toMatchObject({
      disposition: "RequiresLegalReview"
    });
  });

  it("detects module↔tool license dual-truth mismatches", () => {
    const tools = [
      {
        binaryName: "semgrep",
        category: "WebAppScan",
        defaultVersion: "1.45.0",
        displayName: "Semgrep",
        dockerImage: "semgrep/semgrep",
        docsUrl: "https://semgrep.dev/docs/",
        gitRepo: "https://github.com/semgrep/semgrep.git",
        license: "LGPL-2.1",
        moduleIds: ["semgrep.code_exploit_scan"],
        notes: "test",
        npmPackage: null,
        phase: "Current",
        pipPackage: null,
        policyStatus: "RequiresLegalReview",
        runtimePreference: ["docker"],
        toolId: "semgrep"
      }
    ] as OpenSourceToolDefinition[];

    const mismatched = createInventory({
      tools,
      moduleManifests: [
        {
          moduleId: "semgrep.code_exploit_scan",
          license: "MIT",
          toolIds: ["semgrep"],
          toolName: "semgrep",
          version: "0.1.0",
          safetyLevel: "PassiveReadOnly"
        } as ModuleManifest
      ]
    });
    const aligned = createInventory({
      tools,
      moduleManifests: [
        {
          moduleId: "semgrep.code_exploit_scan",
          license: "LGPL-2.1",
          toolIds: ["semgrep"],
          toolName: "semgrep",
          version: "0.1.0",
          safetyLevel: "PassiveReadOnly"
        } as ModuleManifest
      ]
    });

    expect(findModuleToolLicenseMismatches(mismatched)).toEqual([
      {
        moduleId: "semgrep.code_exploit_scan",
        moduleLicense: "MIT",
        toolId: "semgrep",
        toolLicense: "LGPL-2.1"
      }
    ]);
    expect(findModuleToolLicenseMismatches(aligned)).toEqual([]);
  });
});
