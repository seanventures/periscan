import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { renderValidationSnapshotReportHtml } from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import {
  listModuleManifests,
  type ModuleManifest
} from "../../packages/modules/src/index.js";
import {
  getOpenSourceToolDefinition,
  listOpenSourceCapabilities,
  listOpenSourceToolDefinitions
} from "../../packages/modules/src/toolchain.js";
import { buildCertificationReport } from "../../scripts/module-certification.js";
import {
  evaluateLicensePolicy,
  evaluateModuleLicensePolicy,
  findModuleToolLicenseMismatches
} from "../../scripts/license-inventory.js";

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

function parseInitialEngineNames(ossPlanSection: string) {
  const engineSection = sectionBetween(
    ossPlanSection,
    "### 10.1 Initial Engines",
    "### 10.2 OSS Policy"
  );
  const lines = engineSection
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.filter((line, index) => {
    const nextLine = lines[index + 1] ?? "";
    return /^[A-Z][A-Za-z0-9 /.-]+$/u.test(line) && nextLine.startsWith("Use ");
  });
}

function parseOssPolicyBullets(ossPlanSection: string) {
  const policySection = sectionBetween(
    ossPlanSection,
    "### 10.2 OSS Policy",
    "## 11. Policy and Safety Engine"
  );

  return policySection
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2));
}

const PRD_ENGINE_COVERAGE: Record<
  string,
  {
    catalogOnlyCapabilityIds?: string[];
    executableModuleIds?: string[];
    expectedSafetyLevels: ModuleManifest["safetyLevel"][];
    toolIds: string[];
  }
> = {
  "Atomic Red Team": {
    expectedSafetyLevels: ["BASLite"],
    executableModuleIds: ["atomic.control_validation_safe"],
    toolIds: ["atomic-red-team", "invoke-atomicredteam"]
  },
  "BloodHound CE": {
    expectedSafetyLevels: ["PassiveReadOnly"],
    executableModuleIds: ["bloodhound.identity_pathing"],
    toolIds: ["bloodhound-ce"]
  },
  Caldera: {
    expectedSafetyLevels: ["AdvancedAdversarial"],
    executableModuleIds: ["caldera.advanced_adversarial"],
    toolIds: ["caldera"]
  },
  Gitleaks: {
    expectedSafetyLevels: ["PassiveReadOnly"],
    executableModuleIds: ["gitleaks.repo_secrets"],
    toolIds: ["gitleaks"]
  },
  Nuclei: {
    expectedSafetyLevels: ["ActiveNonInvasive"],
    executableModuleIds: ["nuclei.external_exposure_safe"],
    toolIds: ["nuclei", "nuclei-templates"]
  },
  "Promptfoo / PyRIT": {
    expectedSafetyLevels: ["ControlledValidation"],
    executableModuleIds: ["ai_app.safe_validation"],
    toolIds: ["promptfoo", "pyrit"]
  },
  Prowler: {
    expectedSafetyLevels: ["PassiveReadOnly"],
    executableModuleIds: ["prowler.aws_posture"],
    toolIds: ["prowler"]
  },
  Trivy: {
    expectedSafetyLevels: ["PassiveReadOnly"],
    executableModuleIds: ["trivy.repo_dependency_scan", "trivy.container_scan"],
    toolIds: ["trivy"]
  },
  Grype: {
    catalogOnlyCapabilityIds: ["grype.cve-scan", "grype.exploit-template"],
    expectedSafetyLevels: ["PassiveReadOnly"],
    toolIds: ["grype"]
  },
  Semgrep: {
    catalogOnlyCapabilityIds: [
      "semgrep.code-exploit-scan",
      "semgrep.web-api-exploit"
    ],
    expectedSafetyLevels: ["PassiveReadOnly"],
    toolIds: ["semgrep"]
  },
  Ollama: {
    catalogOnlyCapabilityIds: [
      "ollama.local-inference",
      "ollama.whatif-verify"
    ],
    expectedSafetyLevels: ["ControlledValidation"],
    toolIds: ["ollama"]
  },
  Proxmark3: {
    catalogOnlyCapabilityIds: [
      "proxmark3.physical-sim",
      "proxmark3.access-proxy-sim"
    ],
    expectedSafetyLevels: ["AdvancedAdversarial"],
    toolIds: ["proxmark3"]
  },
  HackRF: {
    catalogOnlyCapabilityIds: ["hackrf.rf-sim"],
    expectedSafetyLevels: ["AdvancedAdversarial"],
    toolIds: ["hackrf"]
  },
  Ansible: {
    catalogOnlyCapabilityIds: [
      "ansible.iac-playbook-sim",
      "ansible.onprem-deploy-sim"
    ],
    expectedSafetyLevels: ["ControlledValidation"],
    toolIds: ["ansible"]
  },
  Terraform: {
    catalogOnlyCapabilityIds: [
      "terraform.iac-plan-sim",
      "terraform.onprem-mcp-sim"
    ],
    expectedSafetyLevels: ["ControlledValidation"],
    toolIds: ["terraform"]
  },
  FFmpeg: {
    catalogOnlyCapabilityIds: ["ffmpeg.video-replay-export"],
    expectedSafetyLevels: ["ControlledValidation"],
    toolIds: ["ffmpeg"]
  },
  "CTF / Gamified Pack": {
    catalogOnlyCapabilityIds: ["ctf.gamified-pack"],
    expectedSafetyLevels: ["ControlledValidation"],
    toolIds: ["ctf-pack"]
  },
  "OpenAPI Generator": {
    catalogOnlyCapabilityIds: [
      "openapi-generator.sdk-gen",
      "terraform.periscan-provider"
    ],
    expectedSafetyLevels: ["ControlledValidation"],
    toolIds: ["openapi-generator"]
  }
};

const POLICY_BULLET_TO_EVIDENCE = {
  "Prefer permissive licenses.": "license-policy-allowed",
  "Track license per module.": "module-license-metadata",
  "AGPL tools require legal review.": "license-policy-review",
  "Every module must be sandboxed.": "module-certification-safety",
  "Every module must have parser tests.": "module-certification-parser-fixture",
  "Every module must produce normalized evidence.": "normalized-evidence",
  "Never expose raw tool output as primary UX.": "report-primary-ux"
} as const;

describe("PRD section 10 Open Source Acceleration Plan coverage", () => {
  it("keeps every PRD initial engine represented by reviewed tools, capabilities, and module manifests", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const ossPlanSection = sectionBetween(
      prd,
      "## 10. Open Source Acceleration Plan",
      "## 11. Policy and Safety Engine"
    );
    const prdEngines = parseInitialEngineNames(ossPlanSection);
    const allTools = listOpenSourceToolDefinitions({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    });
    const allCapabilities = listOpenSourceCapabilities({
      includeDeferred: true,
      includeLegalReview: true,
      phase: "all"
    });
    const moduleManifests = listModuleManifests();

    expect([...prdEngines].sort()).toEqual(
      Object.keys(PRD_ENGINE_COVERAGE).sort()
    );

    for (const engineName of prdEngines) {
      const coverage = PRD_ENGINE_COVERAGE[engineName];
      expect(
        coverage,
        `${engineName} should have explicit coverage metadata`
      ).toBeDefined();

      for (const toolId of coverage.toolIds) {
        const tool = allTools.find((item) => item.toolId === toolId);
        expect(
          tool,
          `${engineName} tool ${toolId} should be cataloged`
        ).toBeDefined(); // tolerant if optional in R3 grind
        expect(tool?.license, `${toolId} should track a license`).toBeTruthy();
        expect(
          allCapabilities.some((capability) => capability.toolId === toolId),
          `${toolId} should expose a product capability`
        ).toBe(true);
      }

      for (const capabilityId of coverage.catalogOnlyCapabilityIds ?? []) {
        const capability = allCapabilities.find(
          (item) => item.capabilityId === capabilityId
        );

        expect(
          capability,
          `${engineName} catalog capability ${capabilityId} should exist`
        ).toBeDefined();
        expect(capability?.status, capabilityId).toBe("FixtureOnly");
        expect(capability?.moduleId, capabilityId).toBeNull();
        expect(capability?.apiRoutes, capabilityId).not.toContain(
          "/api/v1/modules"
        );
        expect(capability?.apiRoutes, capabilityId).not.toContain(
          "/api/v1/missions"
        );
        expect(
          capability?.safetyLevels.some((safetyLevel) =>
            coverage.expectedSafetyLevels.includes(safetyLevel)
          ),
          `${capabilityId} should preserve a PRD-aligned safety level`
        ).toBe(true);
      }

      for (const moduleId of coverage.executableModuleIds ?? []) {
        const manifest = moduleManifests.find(
          (item) => item.moduleId === moduleId
        );
        expect(
          manifest,
          `${engineName} module ${moduleId} should exist`
        ).toBeDefined();
        expect(
          coverage.expectedSafetyLevels,
          `${moduleId} should use a PRD-aligned safety level`
        ).toContain(manifest?.safetyLevel);
        expect(
          manifest?.evidenceTypes,
          `${moduleId} should produce normalized evidence`
        ).toContain("NormalizedEvidence");
        expect(manifest?.canModifyTarget, moduleId).toBe(false);
        expect(manifest?.canExfiltrateData, moduleId).toBe(false);
      }
    }

    expect(getOpenSourceToolDefinition("sharphound")?.policyStatus).toBe(
      "RequiresLegalReview"
    );
    expect(getOpenSourceToolDefinition("caldera")?.policyStatus).toBe(
      "Deferred"
    );
  });

  it("keeps PRD OSS policy bullets mapped to automated certification, license, and report evidence", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const reportsSource = await readRepoFile("packages/reports/src/index.ts");
    const policyBullets = parseOssPolicyBullets(prd);
    const moduleManifests = listModuleManifests();
    const certificationReport = await buildCertificationReport();
    const demoReportHtml = renderValidationSnapshotReportHtml(
      createPublicDemoValidationSnapshot()
    );
    const prdEngineModuleIds = new Set(
      Object.values(PRD_ENGINE_COVERAGE).flatMap(
        (coverage) => coverage.executableModuleIds ?? []
      )
    );

    expect(policyBullets).toEqual(Object.keys(POLICY_BULLET_TO_EVIDENCE));

    for (const manifest of moduleManifests) {
      const licensePolicy = evaluateModuleLicensePolicy(
        manifest,
        listOpenSourceToolDefinitions({
          includeDeferred: true,
          includeLegalReview: true,
          phase: "all"
        })
      );
      const certification = certificationReport.modules.find(
        (item) => item.moduleId === manifest.moduleId
      );

      expect(
        manifest.license,
        `${manifest.moduleId} should track a license`
      ).toBeTruthy();
      expect(licensePolicy.disposition, manifest.moduleId).not.toBe("Blocked");
      expect(certification?.status, manifest.moduleId).not.toBe("NotCertified");

      for (const checkId of [
        "execution_template",
        "network_metadata",
        "no_target_modification",
        "no_exfiltration",
        "no_live_destructive",
        "timeout",
        "parser",
        "output_schema"
      ]) {
        const check = certification?.checks.find((item) => item.id === checkId);
        expect(check?.severity, `${manifest.moduleId}:${checkId}`).toBe("pass");
      }

      if (prdEngineModuleIds.has(manifest.moduleId)) {
        const fixtureCheck = certification?.checks.find(
          (item) => item.id === "fixtures"
        );
        expect(fixtureCheck?.severity, `${manifest.moduleId}:fixtures`).toBe(
          "pass"
        );
      }

      expect(
        manifest.evidenceTypes,
        `${manifest.moduleId} should include normalized evidence`
      ).toContain("NormalizedEvidence");
    }

    expect(
      evaluateLicensePolicy({
        license: "AGPL-3.0",
        name: "agpl-fixture",
        source: "tool"
      }).disposition
    ).not.toBe("Allowed");
    expect(
      findModuleToolLicenseMismatches({
        generatedAt: new Date(0).toISOString(),
        moduleManifests,
        nodeDependencies: [],
        tools: listOpenSourceToolDefinitions({
          includeDeferred: true,
          includeLegalReview: true,
          phase: "all"
        })
      })
    ).toEqual([]);
    expect(reportsSource).toContain(
      "Raw tool output is intentionally excluded from the primary report body."
    );
    expect(demoReportHtml).toContain(
      "Raw tool output is intentionally excluded from the primary report body."
    );
  });
});
