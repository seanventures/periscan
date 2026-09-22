import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_FIRST_HOUR_MODULE_IDS,
  COMMUNITY_VALIDATION_SUITE,
  communityFirstHourStartModuleIds,
  isCommunityValidationModuleId,
  isCommunityValidationToolId,
  isEngineLabTheaterModuleId
} from "@periscan/shared";

import {
  COMMUNITY_POPULAR_OSS_SPECS,
  buildCommunityPopularOssModules,
  mapAmass,
  mapBrakeman,
  mapCargoAudit,
  mapCdxgen,
  mapCfnNag,
  mapCheckov,
  mapCloudlist,
  mapConftest,
  mapDependencyCheck,
  mapDockle,
  mapFalco,
  mapGitSecrets,
  mapGovulncheck,
  mapHorusec,
  mapKatana,
  mapKics,
  mapKubeaudit,
  mapKubeBench,
  mapKubeScore,
  mapKubescape,
  mapNaabu,
  mapNancy,
  mapPipAudit,
  mapPolaris,
  mapPopeye,
  mapRetireJs,
  mapSecretlint,
  mapSlsaVerifier,
  mapSobelow,
  mapTalisman,
  mapTerrascan,
  mapTfsec,
  mapTlsx,
  mapWhispers,
  mapYara
} from "./community-popular-oss.js";
import { COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS } from "./community-popular-oss-catalog.js";
import { executeModuleById, getModuleById } from "./index.js";
import { listOpenSourceToolDefinitions } from "./toolchain.js";

const TENANT_ID = "11111111-1111-4111-8111-111111111111";

function context(target: Record<string, unknown>) {
  return {
    inputs: {},
    integrationIds: [],
    missionId: "33333333-3333-4333-8333-333333333333",
    policyDecisionId: null,
    runId: "44444444-4444-4444-8444-444444444444",
    runnerId: null,
    safetyLevel: "PassiveReadOnly" as const,
    scopeId: "22222222-2222-4222-8222-222222222222",
    target,
    tenantId: TENANT_ID
  };
}

describe("Community popular OSS pack", () => {
  it("registers every spec as a live module and Community suite member", () => {
    expect(COMMUNITY_POPULAR_OSS_SPECS.length).toBeGreaterThan(20);
    for (const spec of COMMUNITY_POPULAR_OSS_SPECS) {
      const module = getModuleById(spec.moduleId);
      expect(module, spec.moduleId).not.toBeNull();
      expect(module?.manifest.liveSupported).toBe(true);
      expect(module?.manifest.fixtureSupported).toBe(true);
      expect(isCommunityValidationModuleId(spec.moduleId)).toBe(true);
      expect(isEngineLabTheaterModuleId(spec.moduleId)).toBe(false);
    }
  });

  it("lists catalog tools as Enabled permissive engines", () => {
    const defaults = listOpenSourceToolDefinitions();
    for (const tool of COMMUNITY_POPULAR_OSS_TOOL_DEFINITIONS) {
      const found = defaults.find((entry) => entry.toolId === tool.toolId);
      expect(found, tool.toolId).toBeTruthy();
      expect(found?.license).toMatch(/Apache-2.0|MIT|BSD-3-Clause/);
      expect(found?.policyStatus).toBe("Enabled");
    }
  });

  it("does not invent findings in fixtureMode", async () => {
    const output = await executeModuleById(
      "sslyze.tls_posture",
      context({
        fixtureMode: true,
        hostname: "lab.example.com"
      })
    );
    expect(output.outcome).toBe("no_tlsweakness_observed");
    expect(output.validationState).not.toBe("Fixed");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toEqual([]);
    expect(output.evidence[0]?.attributes.findingCount).toBe(0);
    expect(output.evidence[0]?.attributes.measured).toBe(true);
  });

  it.each([
    ["gitleaks.repo_secrets", "no_secret_exposure_observed"],
    ["trivy.repo_misconfig", "no_iacmisconfig_observed"]
  ] as const)(
    "first clean observation of %s is Validated, never Fixed (count=0)",
    async (moduleId, expectedOutcome) => {
      const scanRoot = await mkdtemp(join(tmpdir(), "periscan-571-clean-"));
      try {
        if (moduleId === "gitleaks.repo_secrets") {
          await writeFile(
            join(scanRoot, ".periscan-gitleaks-fixture.json"),
            "[]\n",
            "utf8"
          );
        }
        const output = await executeModuleById(
          moduleId,
          context({
            fixtureMode: true,
            repositoryName: "clean-repo",
            repositoryPath: scanRoot
          })
        );
        expect(output.outcome, moduleId).toBe(expectedOutcome);
        expect(output.validationState, moduleId).not.toBe("Fixed");
        expect(output.validationState, moduleId).toBe("Validated");
        expect(output.signals, moduleId).toEqual([]);
        if (moduleId === "gitleaks.repo_secrets") {
          expect(output.evidence, moduleId).toEqual([]);
        } else {
          expect(output.evidence[0]?.attributes.findingCount, moduleId).toBe(0);
          expect(output.evidence[0]?.attributes.measured, moduleId).toBe(true);
        }
      } finally {
        await rm(scanRoot, { force: true, recursive: true });
      }
    }
  );

  it("returns Inconclusive, not Fixed, when the repository path is missing", async () => {
    const output = await executeModuleById(
      "trivy.repo_misconfig",
      context({
        fixtureMode: false,
        repositoryName: "missing-repo",
        repositoryPath: "/tmp/definitely-missing-periscan-536"
      })
    );
    expect(output.validationState).not.toBe("Fixed");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.outcome).toBe("tool_target_missing");
    expect(output.evidence[0]?.attributes.measured).toBe(false);
  });

  it("returns Inconclusive tool_skipped, not Fixed, when Terrascan scans a JS-only tree", async () => {
    const scanRoot = await mkdtemp(join(tmpdir(), "periscan-iac-js-only-"));
    try {
      await writeFile(
        join(scanRoot, "leaked.js"),
        "console.log('xoxb-lab-token');\n",
        "utf8"
      );
      const output = await executeModuleById(
        "terrascan.iac_posture",
        context({
          fixtureMode: false,
          repositoryName: "js-only-repo",
          repositoryPath: scanRoot
        })
      );
      expect(output.validationState).not.toBe("Fixed");
      expect(output.validationState).toBe("Inconclusive");
      expect(output.outcome).toBe("tool_skipped");
      expect(output.outcome).not.toBe("no_iacmisconfig_observed");
    } finally {
      await rm(scanRoot, { force: true, recursive: true });
    }
  });

  it("does not mint Fixed on a first Trivy clean observation (SETTLED: Fixed only via verification)", async () => {
    const output = await executeModuleById(
      "trivy.repo_misconfig",
      context({
        fixtureMode: true,
        repositoryName: "lab-repo",
        repositoryPath: "/tmp/does-not-need-to-exist"
      })
    );
    expect(output.outcome).toBe("no_iacmisconfig_observed");
    expect(output.validationState).not.toBe("Fixed");
    expect(output.validationState).toBe("Validated");
    expect(output.signals).toEqual([]);
    expect(output.evidence[0]?.attributes.findingCount).toBe(0);
    expect(output.evidence[0]?.attributes.measured).toBe(true);
  });

  it("returns Inconclusive tool_skipped, not Fixed, when Trivy scans a JS-only tree", async () => {
    const scanRoot = await mkdtemp(join(tmpdir(), "periscan-trivy-js-only-"));
    try {
      await writeFile(
        join(scanRoot, "leaked.js"),
        "console.log('xoxb-lab-token');\n",
        "utf8"
      );
      const output = await executeModuleById(
        "trivy.repo_misconfig",
        context({
          fixtureMode: false,
          repositoryName: "js-only-repo",
          repositoryPath: scanRoot
        })
      );
      expect(output.validationState).not.toBe("Fixed");
      expect(output.validationState).toBe("Inconclusive");
      expect(output.outcome).toBe("tool_skipped");
      expect(output.outcome).not.toBe("no_iacmisconfig_observed");
    } finally {
      await rm(scanRoot, { force: true, recursive: true });
    }
  });

  it("skips language-specific engines honestly when the repo lacks inputs", async () => {
    const output = await executeModuleById(
      "gosec.go_sast",
      context({
        repositoryName: "empty-repo",
        repositoryPath: "/tmp/periscan-no-go-mod-fixture"
      })
    );
    expect(output.outcome).toBe("tool_skipped");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.summary).toMatch(/go\.mod/);
  });

  it("keeps GPL and live-offensive modules out of this builder", () => {
    const moduleIds = COMMUNITY_POPULAR_OSS_SPECS.map((spec) => spec.moduleId);
    expect(moduleIds).not.toContain("web.nikto_scan");
    expect(moduleIds).not.toContain("web.sqli_probe");
    expect(moduleIds).not.toContain("atomic.control_validation_safe");
    expect(
      COMMUNITY_VALIDATION_SUITE.some(
        (entry) =>
          (entry.toolLicense as string) === "GPL-2.0" ||
          (entry.toolLicense as string) === "LGPL-2.1"
      )
    ).toBe(false);
  });

  it("buildCommunityPopularOssModules is a stable factory for createModule", () => {
    const created = buildCommunityPopularOssModules(((manifest: unknown) => ({
      manifest,
      execute: async () => {
        throw new Error("unused");
      }
    })) as never);
    expect(created).toHaveLength(COMMUNITY_POPULAR_OSS_SPECS.length);
    expect(created[0]?.manifest.moduleId).toBe("trivy.repo_misconfig");
  });
});

const CFN_LINT_MODULE_ID = "cfn_lint.cloudformation";
const CFN_LINT_FIXTURE_FINDING_COUNT = 2;

let cfnLintScanRoot: string | undefined;

afterEach(async () => {
  if (cfnLintScanRoot) {
    await rm(cfnLintScanRoot, { force: true, recursive: true });
    cfnLintScanRoot = undefined;
  }
});

describe("cfn-lint Community adapter", () => {
  it("closes the catalog hole as MIT PassiveReadOnly Community IaC", () => {
    const tool = listOpenSourceToolDefinitions({
      includeDeferred: true,
      phase: "all"
    }).find((entry) => entry.toolId === "cfn-lint");
    expect(tool?.license).toBe("MIT");
    expect(tool?.moduleIds).toEqual([CFN_LINT_MODULE_ID]);
    expect(isCommunityValidationToolId("cfn-lint")).toBe(true);

    const module = getModuleById(CFN_LINT_MODULE_ID);
    expect(module).not.toBeNull();
    expect(module?.manifest.license).toBe("MIT");
    expect(module?.manifest.safetyLevel).toBe("PassiveReadOnly");
    expect(module?.manifest.writesToTarget).toBe(false);
    expect(module?.manifest.canModifyTarget).toBe(false);
    expect(module?.manifest.toolIds).toEqual(["cfn-lint"]);
    expect(module?.manifest.toolName).toBe("cfn-lint");
    expect(module?.manifest.fixtureSupported).toBe(true);
    expect(module?.manifest.liveSupported).toBe(true);
    expect(isCommunityValidationModuleId(CFN_LINT_MODULE_ID)).toBe(true);
    expect(
      COMMUNITY_VALIDATION_SUITE.some(
        (entry) =>
          entry.moduleId === CFN_LINT_MODULE_ID &&
          entry.toolLicense === "MIT" &&
          entry.targetKind === "repositoryPath"
      )
    ).toBe(true);
  });

  it("executes the cfn-lint fixture and does not invent findings", async () => {
    const output = await executeModuleById(
      CFN_LINT_MODULE_ID,
      context({
        fixtureMode: true,
        repositoryName: "cfn-lint-fixture",
        repositoryPath: "/tmp/does-not-need-to-exist"
      })
    );
    expect(output.outcome).toBe("iacmisconfig_observed");
    expect(output.validationState).toBe("Validated");
    expect(output.evidence[0]?.attributes.findingCount).toBe(
      CFN_LINT_FIXTURE_FINDING_COUNT
    );
    expect(output.evidence[0]?.attributes.measured).toBe(true);
    expect(output.evidence[0]?.attributes.toolId).toBe("cfn-lint");
    expect(output.signals).toHaveLength(1);
    expect(output.summary).toMatch(/cfn-lint/i);
    const blob = JSON.stringify(output);
    expect(blob).not.toMatch(/AKIA[0-9A-Z]{16}/);
    expect(blob).not.toMatch(/BEGIN (RSA |OPENSSH )?PRIVATE KEY/);
  });

  it("returns tool_unavailable when the cfn-lint binary is missing", async () => {
    cfnLintScanRoot = await mkdtemp(join(tmpdir(), "periscan-cfn-lint-"));
    await writeFile(
      join(cfnLintScanRoot, "template.yaml"),
      [
        'AWSTemplateFormatVersion: "2010-09-09"',
        "Resources:",
        "  Bucket:",
        "    Type: AWS::S3::Bucket",
        ""
      ].join("\n"),
      "utf8"
    );
    const previousRuntime = process.env.PERISCAN_CFN_LINT_RUNTIME;
    const previousBinary = process.env.PERISCAN_CFN_LINT_BINARY;
    const previousPath = process.env.PATH;
    process.env.PERISCAN_CFN_LINT_RUNTIME = "binary";
    delete process.env.PERISCAN_CFN_LINT_BINARY;
    process.env.PATH = "/nonexistent-cfn-lint-bin";
    try {
      const output = await executeModuleById(
        CFN_LINT_MODULE_ID,
        context({
          repositoryName: "cfn-lint-lab",
          repositoryPath: cfnLintScanRoot
        })
      );
      expect(output.outcome).toBe("tool_unavailable");
      expect(output.validationState).toBe("Inconclusive");
      expect(output.signals).toEqual([]);
      expect(output.evidence).toEqual([]);
    } finally {
      if (previousRuntime === undefined) {
        delete process.env.PERISCAN_CFN_LINT_RUNTIME;
      } else {
        process.env.PERISCAN_CFN_LINT_RUNTIME = previousRuntime;
      }
      if (previousBinary === undefined) {
        delete process.env.PERISCAN_CFN_LINT_BINARY;
      } else {
        process.env.PERISCAN_CFN_LINT_BINARY = previousBinary;
      }
      process.env.PATH = previousPath;
    }
  });

  it("skips honestly when the authorized repo has no CloudFormation templates", async () => {
    cfnLintScanRoot = await mkdtemp(join(tmpdir(), "periscan-cfn-lint-empty-"));
    await writeFile(
      join(cfnLintScanRoot, "README.md"),
      "no templates\n",
      "utf8"
    );
    const output = await executeModuleById(
      CFN_LINT_MODULE_ID,
      context({
        repositoryName: "empty-repo",
        repositoryPath: cfnLintScanRoot
      })
    );
    expect(output.outcome).toBe("tool_skipped");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.summary).toMatch(/template\.(yaml|yml|json)/);
  });
});

const PARLIAMENT_MODULE_ID = "parliament.iam_policy";
const PARLIAMENT_FIXTURE_PATH = fileURLToPath(
  new URL("../fixtures/parliament/parliament-fixture.json", import.meta.url)
);

function parliamentFixtureFindingCount(): number {
  const parsed: unknown = JSON.parse(
    readFileSync(PARLIAMENT_FIXTURE_PATH, "utf8")
  );
  if (!Array.isArray(parsed)) {
    throw new Error("parliament fixture must be a JSON array of findings");
  }
  return parsed.filter(
    (row) =>
      row !== null &&
      typeof row === "object" &&
      typeof (row as { issue?: unknown }).issue === "string"
  ).length;
}

let parliamentScanRoot: string | undefined;

afterEach(async () => {
  if (parliamentScanRoot) {
    await rm(parliamentScanRoot, { force: true, recursive: true });
    parliamentScanRoot = undefined;
  }
});

describe("parliament Community adapter", () => {
  it("closes the catalog hole as BSD-3-Clause PassiveReadOnly IAM lint", () => {
    const tool = listOpenSourceToolDefinitions({
      includeDeferred: true,
      phase: "all"
    }).find((entry) => entry.toolId === "parliament");
    expect(tool?.license).toBe("BSD-3-Clause");
    expect(tool?.moduleIds).toEqual([PARLIAMENT_MODULE_ID]);
    expect(isCommunityValidationToolId("parliament")).toBe(true);

    const module = getModuleById(PARLIAMENT_MODULE_ID);
    expect(module).not.toBeNull();
    expect(module?.manifest.license).toBe("BSD-3-Clause");
    expect(module?.manifest.safetyLevel).toBe("PassiveReadOnly");
    expect(module?.manifest.writesToTarget).toBe(false);
    expect(module?.manifest.canModifyTarget).toBe(false);
    expect(module?.manifest.toolIds).toEqual(["parliament"]);
    expect(module?.manifest.toolName).toBe("Parliament");
    expect(module?.manifest.fixtureSupported).toBe(true);
    expect(module?.manifest.liveSupported).toBe(true);
    expect(isCommunityValidationModuleId(PARLIAMENT_MODULE_ID)).toBe(true);
    const parliamentSuite = COMMUNITY_VALIDATION_SUITE.find(
      (entry) => entry.moduleId === PARLIAMENT_MODULE_ID
    );
    expect(parliamentSuite?.toolLicense).toBe("BSD-3-Clause");
    expect(parliamentSuite?.targetKind).toBe("repositoryPath");
    expect(parliamentSuite?.requiredScopeTypes).toEqual(["Repository"]);
  });

  it("executes the parliament fixture and does not invent findings", async () => {
    const expectedCount = parliamentFixtureFindingCount();
    expect(expectedCount).toBeGreaterThan(0);
    const output = await executeModuleById(
      PARLIAMENT_MODULE_ID,
      context({
        fixtureMode: true,
        repositoryName: "parliament-fixture",
        repositoryPath: "/tmp/does-not-need-to-exist"
      })
    );
    expect(output.outcome).toBe("iammisconfig_observed");
    expect(output.validationState).toBe("Validated");
    expect(output.evidence[0]?.attributes.findingCount).toBe(expectedCount);
    expect(output.evidence[0]?.attributes.measured).toBe(true);
    expect(output.evidence[0]?.attributes.toolId).toBe("parliament");
    expect(output.signals).toHaveLength(1);
    expect(output.summary).toMatch(/Parliament/i);
    const blob = JSON.stringify(output);
    expect(blob).not.toMatch(/arn:aws:iam::123456789012/);
    expect(blob).not.toMatch(/AKIA[0-9A-Z]{16}/);
  });

  it("returns tool_unavailable when the parliament binary is missing", async () => {
    parliamentScanRoot = await mkdtemp(join(tmpdir(), "periscan-parliament-"));
    await writeFile(
      join(parliamentScanRoot, "overly-permissive-policy.json"),
      JSON.stringify({
        Version: "2012-10-17",
        Statement: [{ Effect: "Allow", Action: "*", Resource: "*" }]
      }),
      "utf8"
    );
    const previousRuntime = process.env.PERISCAN_PARLIAMENT_RUNTIME;
    const previousBinary = process.env.PERISCAN_PARLIAMENT_BINARY;
    const previousPath = process.env.PATH;
    process.env.PERISCAN_PARLIAMENT_RUNTIME = "binary";
    delete process.env.PERISCAN_PARLIAMENT_BINARY;
    process.env.PATH = "/nonexistent-parliament-bin";
    try {
      const output = await executeModuleById(
        PARLIAMENT_MODULE_ID,
        context({
          repositoryName: "parliament-lab",
          repositoryPath: parliamentScanRoot
        })
      );
      expect(output.outcome).toBe("tool_unavailable");
      expect(output.validationState).toBe("Inconclusive");
      expect(output.signals).toEqual([]);
      expect(output.evidence).toEqual([]);
    } finally {
      if (previousRuntime === undefined) {
        delete process.env.PERISCAN_PARLIAMENT_RUNTIME;
      } else {
        process.env.PERISCAN_PARLIAMENT_RUNTIME = previousRuntime;
      }
      if (previousBinary === undefined) {
        delete process.env.PERISCAN_PARLIAMENT_BINARY;
      } else {
        process.env.PERISCAN_PARLIAMENT_BINARY = previousBinary;
      }
      process.env.PATH = previousPath;
    }
  });

  it("skips honestly when the authorized repo has no IAM policy documents", async () => {
    parliamentScanRoot = await mkdtemp(
      join(tmpdir(), "periscan-parliament-empty-")
    );
    await writeFile(
      join(parliamentScanRoot, "README.md"),
      "no policies\n",
      "utf8"
    );
    await writeFile(
      join(parliamentScanRoot, "package.json"),
      JSON.stringify({ name: "not-iam" }),
      "utf8"
    );
    const output = await executeModuleById(
      PARLIAMENT_MODULE_ID,
      context({
        repositoryName: "empty-repo",
        repositoryPath: parliamentScanRoot
      })
    );
    expect(output.outcome).toBe("tool_skipped");
    expect(output.validationState).toBe("Inconclusive");
    expect(output.summary).toMatch(/IAM policy/i);
  });
});

const PERMISSIVE_CATALOG_HOLES = [
  {
    fixtureCount: 1,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "kingfisher-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "kingfisher.repo_secrets",
    outcome: "secretexposure_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "kingfisher",
    toolName: "Kingfisher",
    unavailableSeed: "README.md"
  },
  {
    fixtureCount: 1,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "kyverno-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "kyverno.repo_policy",
    outcome: "k8smisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /ya?ml/i,
    targetKind: "repositoryPath",
    toolId: "kyverno",
    toolName: "Kyverno",
    unavailableSeed: "policy.yaml"
  },
  {
    fixtureCount: 1,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "inspec-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "inspec.repo_profile",
    outcome: "inspecfail_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /inspec\.ya?ml/i,
    targetKind: "repositoryPath",
    toolId: "inspec",
    toolName: "InSpec",
    unavailableSeed: "inspec.yml"
  },
  {
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "example.com"
    },
    kind: "host" as const,
    license: "MIT",
    moduleId: "assetfinder.passive_enum",
    outcome: "subdomain_observed",
    scopes: ["Domain", "Subdomain"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "assetfinder",
    toolName: "assetfinder",
    unavailableSeed: null
  },
  {
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "example.com"
    },
    kind: "host" as const,
    license: "MIT",
    moduleId: "gau.known_urls",
    outcome: "knownurl_observed",
    scopes: ["Domain", "Subdomain"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "gau",
    toolName: "gau",
    unavailableSeed: null
  }
] as const;

describe("permissive SPDX catalog holes (PERISCAN-490)", () => {
  it.each(PERMISSIVE_CATALOG_HOLES)(
    "wires $toolId as a startable Community $license engine",
    ({ license, moduleId, scopes, targetKind, toolId, toolName }) => {
      const tool = listOpenSourceToolDefinitions({
        includeDeferred: true,
        phase: "all"
      }).find((entry) => entry.toolId === toolId);
      expect(tool?.license).toBe(license);
      expect(tool?.moduleIds).toEqual([moduleId]);
      expect(isCommunityValidationToolId(toolId)).toBe(true);

      const module = getModuleById(moduleId);
      expect(module, moduleId).not.toBeNull();
      expect(module?.manifest.license).toBe(license);
      expect(module?.manifest.safetyLevel).toMatch(
        /^(PassiveReadOnly|ActiveNonInvasive)$/
      );
      expect(module?.manifest.writesToTarget).toBe(false);
      expect(module?.manifest.canModifyTarget).toBe(false);
      expect(module?.manifest.toolIds).toEqual([toolId]);
      expect(module?.manifest.toolName).toBe(toolName);
      expect(module?.manifest.fixtureSupported).toBe(true);
      expect(module?.manifest.liveSupported).toBe(true);
      expect(isCommunityValidationModuleId(moduleId)).toBe(true);
      const suite = COMMUNITY_VALIDATION_SUITE.find(
        (entry) => entry.moduleId === moduleId
      );
      expect(suite?.toolLicense).toBe(license);
      expect(suite?.targetKind).toBe(targetKind);
      expect(suite?.requiredScopeTypes).toEqual([...scopes]);
    }
  );

  it("keeps first-hour on Gitleaks, not the expanded pack", () => {
    const startable = [
      "gitleaks.repo_secrets",
      ...PERMISSIVE_CATALOG_HOLES.map((row) => row.moduleId)
    ];
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).toEqual([
      "gitleaks.repo_secrets"
    ]);
    expect(communityFirstHourStartModuleIds(startable)).toEqual([
      "gitleaks.repo_secrets"
    ]);
    for (const row of PERMISSIVE_CATALOG_HOLES) {
      expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).not.toContain(row.moduleId);
      expect(communityFirstHourStartModuleIds(startable)).not.toContain(
        row.moduleId
      );
    }
  });

  it.each(PERMISSIVE_CATALOG_HOLES)(
    "executes the $toolId fixture and does not invent findings",
    async ({ fixtureCount, fixtureModeTarget, moduleId, outcome, toolId }) => {
      const output = await executeModuleById(
        moduleId,
        context(fixtureModeTarget)
      );
      expect(output.outcome).toBe(outcome);
      expect(output.validationState).toBe("Validated");
      expect(output.validationState).not.toBe("Fixed");
      expect(output.evidence[0]?.attributes.findingCount).toBe(fixtureCount);
      expect(output.evidence[0]?.attributes.measured).toBe(true);
      expect(output.evidence[0]?.attributes.toolId).toBe(toolId);
      expect(output.signals).toHaveLength(1);
      const blob = JSON.stringify(output);
      expect(blob).not.toMatch(/AKIA[0-9A-Z]{16}/);
      expect(blob).not.toMatch(/BEGIN (RSA |OPENSSH )?PRIVATE KEY/);
    }
  );

  it.each(PERMISSIVE_CATALOG_HOLES)(
    "returns tool_unavailable when the $toolId binary is missing",
    async ({ kind, moduleId, toolId, unavailableSeed }) => {
      const envRuntime = `PERISCAN_${toolId.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_RUNTIME`;
      const envBinary = `PERISCAN_${toolId.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_BINARY`;
      const previousRuntime = process.env[envRuntime];
      const previousBinary = process.env[envBinary];
      const previousPath = process.env.PATH;
      process.env[envRuntime] = "binary";
      delete process.env[envBinary];
      process.env.PATH = `/nonexistent-${toolId}-bin`;
      let scanRoot: string | undefined;
      try {
        const target: Record<string, unknown> =
          kind === "host"
            ? { hostname: "example.com" }
            : {
                repositoryName: `${toolId}-lab`,
                repositoryPath: (scanRoot = await mkdtemp(
                  join(tmpdir(), `periscan-${toolId}-`)
                ))
              };
        if (scanRoot && unavailableSeed) {
          await writeFile(join(scanRoot, unavailableSeed), "seed\n", "utf8");
        }
        const output = await executeModuleById(moduleId, context(target));
        expect(output.outcome).toBe("tool_unavailable");
        expect(output.validationState).toBe("Inconclusive");
        expect(output.signals).toEqual([]);
        expect(output.evidence).toEqual([]);
      } finally {
        if (previousRuntime === undefined) {
          delete process.env[envRuntime];
        } else {
          process.env[envRuntime] = previousRuntime;
        }
        if (previousBinary === undefined) {
          delete process.env[envBinary];
        } else {
          process.env[envBinary] = previousBinary;
        }
        process.env.PATH = previousPath;
        if (scanRoot) {
          await rm(scanRoot, { force: true, recursive: true });
        }
      }
    }
  );

  it.each(PERMISSIVE_CATALOG_HOLES.filter((row) => row.skipRe))(
    "skips $toolId honestly when required inputs are missing",
    async ({ moduleId, skipFiles, skipRe }) => {
      const scanRoot = await mkdtemp(join(tmpdir(), `periscan-skip-`));
      try {
        for (const file of skipFiles ?? ["README.md"]) {
          await writeFile(join(scanRoot, file), "no inputs\n", "utf8");
        }
        const output = await executeModuleById(
          moduleId,
          context({
            repositoryName: "empty-repo",
            repositoryPath: scanRoot
          })
        );
        expect(output.outcome).toBe("tool_skipped");
        expect(output.validationState).toBe("Inconclusive");
        expect(output.summary).toMatch(skipRe!);
      } finally {
        await rm(scanRoot, { force: true, recursive: true });
      }
    }
  );
});

/**
 * SETTLED Community pack engines that already have live modules but lacked
 * certified fixture parsers. FixtureMode must replay the fixture only — never
 * invent findings or leak trap secrets from raw tool JSON.
 */
const SETTLED_FIXTURE_ENGINES = [
  {
    findingShape: {
      filename: "config/demo.env",
      type: "AWS Access Key"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "detect-secrets-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "detect_secrets.repo_secrets",
    outcome: "secretexposure_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "detect-secrets",
    toolName: "detect-secrets",
    unavailableSeed: "README.md"
  },
  {
    findingShape: {
      filename: "./app.py",
      testId: "B602"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "bandit-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "bandit.python_sast",
    outcome: "sastfinding_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /pyproject\.toml|setup\.py|requirements\.txt/,
    targetKind: "repositoryPath",
    toolId: "bandit",
    toolName: "Bandit",
    unavailableSeed: "requirements.txt"
  },
  {
    findingShape: {
      file: "/src/main.go",
      ruleId: "G204"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "gosec-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "gosec.go_sast",
    outcome: "sastfinding_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /go\.mod/,
    targetKind: "repositoryPath",
    toolId: "gosec",
    toolName: "gosec",
    unavailableSeed: "go.mod"
  },
  {
    findingShape: {
      check: "unset-cpu-requirements",
      name: "fixture-web"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "kube-linter-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "kube_linter.manifest_posture",
    outcome: "k8smisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /ya?ml/i,
    targetKind: "repositoryPath",
    toolId: "kube-linter",
    toolName: "KubeLinter",
    unavailableSeed: "deployment.yaml"
  },
  {
    findingShape: {
      checkId: "CKV_AWS_20",
      resource: "aws_s3_bucket.fixture"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "checkov-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "checkov.iac_posture",
    outcome: "iacmisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /Terraform, Kubernetes YAML, or CloudFormation/,
    targetKind: "repositoryPath",
    toolId: "checkov",
    toolName: "Checkov",
    unavailableSeed: "main.tf"
  },
  {
    findingShape: {
      file: "s3.tf",
      ruleId: "AC_AWS_0207"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "terrascan-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "terrascan.iac_posture",
    outcome: "iacmisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /Terraform, Kubernetes YAML, or CloudFormation/,
    targetKind: "repositoryPath",
    toolId: "terrascan",
    toolName: "Terrascan",
    unavailableSeed: "main.tf"
  },
  {
    findingShape: {
      fileName: "s3.tf",
      queryName: "S3 Bucket Without Server-side-encryption"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "kics-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "kics.iac_posture",
    outcome: "iacmisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /Terraform, Kubernetes YAML, or CloudFormation/,
    targetKind: "repositoryPath",
    toolId: "kics",
    toolName: "KICS",
    unavailableSeed: "main.tf"
  },
  {
    findingShape: {
      status: "FAIL",
      testNumber: "1.1.1"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "lab-cluster"
    },
    kind: "host" as const,
    license: "Apache-2.0",
    moduleId: "kube_bench.cis_cluster",
    outcome: "kubecis_observed",
    scopes: ["InternalNetwork"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "kube-bench",
    toolName: "kube-bench",
    unavailableSeed: null
  },
  {
    findingShape: {
      file: "app/models/user.rb",
      warningType: "SQL Injection"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "brakeman-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "MIT",
    moduleId: "brakeman.ruby_sast",
    outcome: "sastfinding_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /Gemfile|config\.ru/,
    targetKind: "repositoryPath",
    toolId: "brakeman",
    toolName: "Brakeman",
    unavailableSeed: "Gemfile"
  },
  {
    findingShape: {
      filename: "config/demo.env",
      type: "filecontent"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "talisman-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "talisman.repo_secrets",
    outcome: "secretexposure_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "talisman",
    toolName: "Talisman",
    unavailableSeed: "README.md"
  },
  {
    findingShape: {
      fileName: "log4j-core-2.14.1.jar",
      name: "CVE-2021-44228"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "dependency-check-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "dependency_check.sca",
    outcome: "dependencyadvisory_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "dependency-check",
    toolName: "Dependency-Check",
    unavailableSeed: "pom.xml"
  },
  {
    findingShape: {
      file: "config/demo.env",
      rule: "FakeAwsKey"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "yara-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "BSD-3-Clause",
    moduleId: "yara.repo_rules",
    outcome: "yaramatch_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /\.yar|\.yara/,
    targetKind: "repositoryPath",
    toolId: "yara",
    toolName: "YARA",
    unavailableSeed: "lab.yar"
  },
  {
    findingShape: {
      code: "LOAD_ERR_YAML_VALIDATE",
      file: "falco_rules.yaml"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "falco-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "falco.rules_validate",
    outcome: "falcorule_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /Falco skipped: no Falco rules/,
    targetKind: "repositoryPath",
    toolId: "falco",
    toolName: "Falco",
    unavailableSeed: "falco_rules.yaml"
  },
  {
    findingShape: {
      domain: "example.com",
      name: "www.example.com"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "example.com"
    },
    kind: "host" as const,
    license: "Apache-2.0",
    moduleId: "amass.passive_enum",
    outcome: "subdomain_observed",
    scopes: ["Domain", "Subdomain"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "amass",
    toolName: "Amass",
    unavailableSeed: null
  },
  {
    findingShape: {
      file: "app.py",
      severity: "CRITICAL"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "horusec-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "horusec.multi_sast",
    outcome: "sastfinding_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "horusec",
    toolName: "Horusec",
    unavailableSeed: "README.md"
  },
  {
    findingShape: {
      host: "lab.example.com",
      port: 443
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "lab.example.com"
    },
    kind: "host" as const,
    license: "MIT",
    moduleId: "naabu.port_inventory",
    outcome: "openport_observed",
    scopes: ["IPRange", "InternalNetwork", "Domain", "Subdomain"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "naabu",
    toolName: "naabu",
    unavailableSeed: null
  },
  {
    findingShape: {
      ruleId: "AVD-AWS-0089",
      resource: "aws_s3_bucket.fixture"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "tfsec-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "MIT",
    moduleId: "tfsec.iac_posture",
    outcome: "iacmisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /Terraform, Kubernetes YAML, or CloudFormation/,
    targetKind: "repositoryPath",
    toolId: "tfsec",
    toolName: "tfsec",
    unavailableSeed: "main.tf"
  },
  {
    findingShape: {
      id: "W35",
      filename: "template.yaml"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "cfn-nag-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "MIT",
    moduleId: "cfn_nag.cloudformation",
    outcome: "iacmisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /template\.(yaml|yml|json)/,
    targetKind: "repositoryPath",
    toolId: "cfn-nag",
    toolName: "cfn-nag",
    unavailableSeed: "template.yaml"
  },
  {
    findingShape: {
      file: "config/demo.env",
      message: "AWS Access Key ID"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "whispers-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "whispers.repo_secrets",
    outcome: "secretexposure_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "whispers",
    toolName: "Whispers",
    unavailableSeed: "README.md"
  },
  {
    findingShape: {
      coordinates: "pkg:golang/github.com/bitly/oauth2_proxy@0.1",
      cve: "CVE-2017-1000070"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "nancy-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "nancy.go_advisories",
    outcome: "dependencyadvisory_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /go\.sum|go\.mod/,
    targetKind: "repositoryPath",
    toolId: "nancy",
    toolName: "Nancy",
    unavailableSeed: "go.mod"
  },
  {
    findingShape: {
      file: "lib/web/endpoint.ex",
      type: "Config.HTTPS"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "sobelow-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "sobelow.elixir_sast",
    outcome: "sastfinding_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /mix\.exs/,
    targetKind: "repositoryPath",
    toolId: "sobelow",
    toolName: "Sobelow",
    unavailableSeed: "mix.exs"
  },
  {
    findingShape: {
      checkId: "cpuLimitsMissing",
      name: "fixture-web"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "polaris-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "polaris.k8s_posture",
    outcome: "k8smisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /ya?ml/i,
    targetKind: "repositoryPath",
    toolId: "polaris",
    toolName: "Polaris",
    unavailableSeed: "deployment.yaml"
  },
  {
    findingShape: {
      resource: "fixture-web",
      rule: "PrivilegedTrue"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "kubeaudit-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "MIT",
    moduleId: "kubeaudit.k8s_posture",
    outcome: "k8smisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /ya?ml/i,
    targetKind: "repositoryPath",
    toolId: "kubeaudit",
    toolName: "kubeaudit",
    unavailableSeed: "deployment.yaml"
  },
  {
    findingShape: {
      message: "No liveness probe",
      resource: "default/fixture-web"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "lab-cluster"
    },
    kind: "host" as const,
    license: "Apache-2.0",
    moduleId: "popeye.cluster_sanitizer",
    outcome: "kubecis_observed",
    scopes: ["InternalNetwork"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "popeye",
    toolName: "Popeye",
    unavailableSeed: null
  },
  {
    findingShape: {
      endpoint: "https://lab.example.com/",
      method: "GET"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "lab.example.com"
    },
    kind: "host" as const,
    license: "MIT",
    moduleId: "katana.web_crawl",
    outcome: "webcrawl_observed",
    scopes: ["Domain", "Subdomain"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "katana",
    toolName: "katana",
    unavailableSeed: null
  },
  {
    findingShape: {
      dnsName: "web.lab.example.com",
      provider: "aws"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "lab-account"
    },
    kind: "host" as const,
    license: "MIT",
    moduleId: "cloudlist.cloud_assets",
    outcome: "cloudasset_observed",
    scopes: ["CloudAccount"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "cloudlist",
    toolName: "cloudlist",
    unavailableSeed: null
  },
  {
    findingShape: {
      id: "PYSEC-2019-179",
      name: "flask"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "pip-audit-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "pip_audit.python_advisories",
    outcome: "dependencyadvisory_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /requirements\.txt|poetry\.lock|Pipfile\.lock|pyproject\.toml/,
    targetKind: "repositoryPath",
    toolId: "pip-audit",
    toolName: "pip-audit",
    unavailableSeed: "requirements.txt"
  },
  {
    findingShape: {
      code: "CIS-DI-0010",
      level: "FATAL"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "dockle-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "dockle.dockerfile_cis",
    outcome: "containercis_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /Dockerfile|dockerfile|Containerfile/,
    targetKind: "repositoryPath",
    toolId: "dockle",
    toolName: "Dockle",
    unavailableSeed: "Dockerfile"
  },
  {
    findingShape: {
      host: "lab.example.com",
      tlsVersion: "tls13"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      hostname: "lab.example.com"
    },
    kind: "host" as const,
    license: "MIT",
    moduleId: "tlsx.tls_probe",
    outcome: "tlsservice_observed",
    scopes: ["Domain", "Subdomain"],
    skipFiles: null,
    skipRe: null,
    targetKind: "hostname",
    toolId: "tlsx",
    toolName: "tlsx",
    unavailableSeed: null
  },
  {
    findingShape: {
      checkId: "container-resources",
      objectName: "fixture-web"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "kube-score-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "MIT",
    moduleId: "kube_score.manifest_score",
    outcome: "k8smisconfig_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /ya?ml/i,
    targetKind: "repositoryPath",
    toolId: "kube-score",
    toolName: "kube-score",
    unavailableSeed: "deployment.yaml"
  },
  {
    findingShape: {
      filename: "deployment.yaml",
      namespace: "main"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "conftest-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "conftest.policy_test",
    outcome: "policyfail_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /policy|policies/,
    targetKind: "repositoryPath",
    toolId: "conftest",
    toolName: "Conftest",
    unavailableSeed: "policy"
  },
  {
    findingShape: {
      name: "express",
      version: "4.17.1"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "cdxgen-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "cdxgen.sbom_generate",
    outcome: "sbomcomponent_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "cdxgen",
    toolName: "cdxgen",
    unavailableSeed: "package.json"
  },
  {
    findingShape: {
      filename: "config/demo.env",
      line: 3
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "git-secrets-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "git_secrets.repo_secrets",
    outcome: "secretexposure_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "git-secrets",
    toolName: "git-secrets",
    unavailableSeed: "README.md"
  },
  {
    findingShape: {
      filePath: "config/demo.env",
      ruleId: "@secretlint/secretlint-rule-aws"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "secretlint-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "MIT",
    moduleId: "secretlint.repo_secrets",
    outcome: "secretexposure_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "secretlint",
    toolName: "secretlint",
    unavailableSeed: "README.md"
  },
  {
    findingShape: {
      component: "jquery",
      version: "1.12.4"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "retirejs-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "retirejs.js_advisories",
    outcome: "dependencyadvisory_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /package\.json|package-lock\.json|yarn\.lock/,
    targetKind: "repositoryPath",
    toolId: "retirejs",
    toolName: "retire.js",
    unavailableSeed: "package.json"
  },
  {
    findingShape: {
      osv: "GO-2023-1840",
      module: "golang.org/x/net"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "govulncheck-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "BSD-3-Clause",
    moduleId: "govulncheck.go_advisories",
    outcome: "dependencyadvisory_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /go\.mod/,
    targetKind: "repositoryPath",
    toolId: "govulncheck",
    toolName: "govulncheck",
    unavailableSeed: "go.mod"
  },
  {
    findingShape: {
      id: "RUSTSEC-2020-0071",
      name: "time"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "cargo-audit-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "cargo_audit.rust_advisories",
    outcome: "dependencyadvisory_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /Cargo\.lock|Cargo\.toml/,
    targetKind: "repositoryPath",
    toolId: "cargo-audit",
    toolName: "cargo-audit",
    unavailableSeed: "Cargo.toml"
  },
  {
    findingShape: {
      controlID: "C-0016",
      name: "Allow privilege escalation"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "kubescape-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "kubescape.repo_posture",
    outcome: "k8smisconfig_observed",
    scopes: ["Repository"],
    skipFiles: null,
    skipRe: null,
    targetKind: "repositoryPath",
    toolId: "kubescape",
    toolName: "Kubescape",
    unavailableSeed: "deployment.yaml"
  },
  {
    findingShape: {
      artifact: "fixture-linux-amd64",
      status: "FAILED"
    },
    fixtureCount: 2,
    fixtureModeTarget: {
      fixtureMode: true,
      repositoryName: "slsa-verifier-fixture",
      repositoryPath: "/tmp/does-not-need-to-exist"
    },
    kind: "repo" as const,
    license: "Apache-2.0",
    moduleId: "slsa_verifier.provenance",
    outcome: "provenancefail_observed",
    scopes: ["Repository"],
    skipFiles: ["README.md"],
    skipRe: /provenance|attestation/,
    targetKind: "repositoryPath",
    toolId: "slsa-verifier",
    toolName: "slsa-verifier",
    unavailableSeed: "provenance.json"
  }
] as const;

describe("SETTLED permissive fixture parsers (PERISCAN-490)", () => {
  it.each(SETTLED_FIXTURE_ENGINES)(
    "wires $toolId as a live Community $license engine with a real parser",
    ({ license, moduleId, scopes, targetKind, toolId, toolName }) => {
      const spec = COMMUNITY_POPULAR_OSS_SPECS.find(
        (entry) => entry.moduleId === moduleId
      );
      expect(spec?.fixtureFile, `${moduleId} fixtureFile`).toBeTruthy();
      expect(spec?.parser, moduleId).toMatch(/^periscan\./);
      expect(spec?.license).toBe(license);

      const tool = listOpenSourceToolDefinitions({
        includeDeferred: true,
        phase: "all"
      }).find((entry) => entry.toolId === toolId);
      expect(tool?.license).toBe(license);
      expect(isCommunityValidationToolId(toolId)).toBe(true);

      const module = getModuleById(moduleId);
      expect(module, moduleId).not.toBeNull();
      expect(module?.manifest.license).toBe(license);
      expect(module?.manifest.safetyLevel).toBe(spec?.safetyLevel);
      expect(module?.manifest.writesToTarget).toBe(false);
      expect(module?.manifest.canModifyTarget).toBe(false);
      expect(module?.manifest.toolIds).toEqual([toolId]);
      expect(module?.manifest.toolName).toBe(toolName);
      expect(module?.manifest.fixtureSupported).toBe(true);
      expect(module?.manifest.liveSupported).toBe(true);
      expect(isCommunityValidationModuleId(moduleId)).toBe(true);
      const suite = COMMUNITY_VALIDATION_SUITE.find(
        (entry) => entry.moduleId === moduleId
      );
      expect(suite?.toolLicense).toBe(license);
      expect(suite?.targetKind).toBe(targetKind);
      expect(suite?.requiredScopeTypes).toEqual([...scopes]);
    }
  );

  it("does not grow first-hour beyond Gitleaks", () => {
    expect([...COMMUNITY_FIRST_HOUR_MODULE_IDS]).toEqual([
      "gitleaks.repo_secrets"
    ]);
    const startable = [
      "gitleaks.repo_secrets",
      ...SETTLED_FIXTURE_ENGINES.map((row) => row.moduleId)
    ];
    expect(communityFirstHourStartModuleIds(startable)).toEqual([
      "gitleaks.repo_secrets"
    ]);
    for (const row of SETTLED_FIXTURE_ENGINES) {
      expect(COMMUNITY_FIRST_HOUR_MODULE_IDS).not.toContain(row.moduleId);
    }
  });

  it.each(SETTLED_FIXTURE_ENGINES)(
    "executes the $toolId fixture, maps evidence, and does not invent or leak findings",
    async ({
      findingShape,
      fixtureCount,
      fixtureModeTarget,
      moduleId,
      outcome,
      toolId
    }) => {
      const output = await executeModuleById(
        moduleId,
        context(fixtureModeTarget)
      );
      expect(output.outcome).toBe(outcome);
      expect(output.validationState).toBe("Validated");
      expect(output.validationState).not.toBe("Fixed");
      expect(output.evidence[0]?.attributes.findingCount).toBe(fixtureCount);
      expect(output.evidence[0]?.attributes.measured).toBe(true);
      expect(output.evidence[0]?.attributes.toolId).toBe(toolId);
      expect(output.evidence[0]?.redactionStatus).toBe("Redacted");
      expect(output.evidence[0]?.attributes.findings).toHaveLength(
        fixtureCount
      );
      expect(output.evidence[0]?.attributes.findings).toEqual(
        expect.arrayContaining([expect.objectContaining(findingShape)])
      );
      expect(output.signals).toHaveLength(1);
      const blob = JSON.stringify(output);
      expect(blob).not.toMatch(/AKIA[0-9A-Z]{16}/);
      expect(blob).not.toMatch(/BEGIN (RSA |OPENSSH )?PRIVATE KEY/);
      expect(blob).not.toMatch(/hashed_secret/);
      expect(blob).not.toMatch(/ghp_[A-Za-z0-9]{20,}/);
    }
  );

  it.each(SETTLED_FIXTURE_ENGINES)(
    "returns tool_unavailable when the $toolId binary is missing",
    async ({ kind, moduleId, toolId, unavailableSeed }) => {
      const envRuntime = `PERISCAN_${toolId.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_RUNTIME`;
      const envBinary = `PERISCAN_${toolId.replace(/[^a-z0-9]/gi, "_").toUpperCase()}_BINARY`;
      const previousRuntime = process.env[envRuntime];
      const previousBinary = process.env[envBinary];
      const previousPath = process.env.PATH;
      const previousKubeconfig = process.env.KUBECONFIG;
      process.env[envRuntime] = "binary";
      delete process.env[envBinary];
      process.env.PATH = `/nonexistent-${toolId}-bin`;
      let scanRoot: string | undefined;
      try {
        scanRoot = await mkdtemp(join(tmpdir(), `periscan-${toolId}-`));
        const target: Record<string, unknown> =
          kind === "host"
            ? { hostname: "lab-cluster" }
            : {
                repositoryName: `${toolId}-lab`,
                repositoryPath: scanRoot
              };
        if (kind === "repo" && unavailableSeed) {
          await writeFile(join(scanRoot, unavailableSeed), "seed\n", "utf8");
        }
        if (toolId === "kube-bench" || toolId === "popeye") {
          const kubeconfigPath = join(scanRoot, "kubeconfig");
          await writeFile(
            kubeconfigPath,
            "apiVersion: v1\nkind: Config\nclusters: []\n",
            "utf8"
          );
          process.env.KUBECONFIG = kubeconfigPath;
        }
        const output = await executeModuleById(moduleId, context(target));
        expect(output.outcome).toBe("tool_unavailable");
        expect(output.validationState).toBe("Inconclusive");
        expect(output.signals).toEqual([]);
        expect(output.evidence).toEqual([]);
      } finally {
        if (previousRuntime === undefined) {
          delete process.env[envRuntime];
        } else {
          process.env[envRuntime] = previousRuntime;
        }
        if (previousBinary === undefined) {
          delete process.env[envBinary];
        } else {
          process.env[envBinary] = previousBinary;
        }
        if (previousKubeconfig === undefined) {
          delete process.env.KUBECONFIG;
        } else {
          process.env.KUBECONFIG = previousKubeconfig;
        }
        process.env.PATH = previousPath;
        if (scanRoot) {
          await rm(scanRoot, { force: true, recursive: true });
        }
      }
    }
  );

  it.each(SETTLED_FIXTURE_ENGINES.filter((row) => row.skipRe))(
    "skips $toolId honestly when required inputs are missing",
    async ({ moduleId, skipFiles, skipRe }) => {
      const scanRoot = await mkdtemp(join(tmpdir(), `periscan-settled-skip-`));
      try {
        for (const file of skipFiles ?? ["README.md"]) {
          await writeFile(join(scanRoot, file), "no inputs\n", "utf8");
        }
        const output = await executeModuleById(
          moduleId,
          context({
            repositoryName: "empty-repo",
            repositoryPath: scanRoot
          })
        );
        expect(output.outcome).toBe("tool_skipped");
        expect(output.validationState).toBe("Inconclusive");
        expect(output.summary).toMatch(skipRe!);
      } finally {
        await rm(scanRoot, { force: true, recursive: true });
      }
    }
  );

  it.each([
    ["checkov", mapCheckov],
    ["terrascan", mapTerrascan],
    ["kics", mapKics],
    ["kube-bench", mapKubeBench],
    ["brakeman", mapBrakeman],
    ["talisman", mapTalisman],
    ["dependency-check", mapDependencyCheck],
    ["yara", mapYara],
    ["falco", mapFalco],
    ["amass", mapAmass],
    ["horusec", mapHorusec],
    ["naabu", mapNaabu],
    ["tfsec", mapTfsec],
    ["cfn-nag", mapCfnNag],
    ["whispers", mapWhispers],
    ["nancy", mapNancy],
    ["sobelow", mapSobelow],
    ["polaris", mapPolaris],
    ["kubeaudit", mapKubeaudit],
    ["popeye", mapPopeye],
    ["katana", mapKatana],
    ["cloudlist", mapCloudlist],
    ["pip-audit", mapPipAudit],
    ["dockle", mapDockle],
    ["tlsx", mapTlsx],
    ["kube-score", mapKubeScore],
    ["conftest", mapConftest],
    ["cdxgen", mapCdxgen],
    ["git-secrets", mapGitSecrets],
    ["secretlint", mapSecretlint],
    ["retirejs", mapRetireJs],
    ["govulncheck", mapGovulncheck],
    ["cargo-audit", mapCargoAudit],
    ["kubescape", mapKubescape],
    ["slsa-verifier", mapSlsaVerifier]
  ] as const)(
    "empty or malformed %s JSON yields zero findings",
    (_toolId, mapFn) => {
      expect(mapFn(undefined)).toEqual([]);
      expect(mapFn(null)).toEqual([]);
      expect(mapFn({})).toEqual([]);
      expect(mapFn([])).toEqual([]);
      expect(mapFn("not-json")).toEqual([]);
      expect(
        mapFn({ summary: { failed: 99 }, results: { failed_checks: {} } })
      ).toEqual([]);
      expect(
        mapFn({
          results: {
            violations: { invent: true },
            scan_summary: { violated_policies: 9 }
          }
        })
      ).toEqual([]);
      expect(
        mapFn({ queries: "nope", total_counter: 12, queries_failed: 12 })
      ).toEqual([]);
      expect(
        mapFn({
          Controls: [{ tests: [{ fail: 7, results: { status: "FAIL" } }] }]
        })
      ).toEqual([]);
    }
  );

  it("does not invent Checkov findings from summary.failed alone", () => {
    expect(
      mapCheckov({
        summary: { failed: 99 },
        results: { failed_checks: [] }
      })
    ).toEqual([]);
  });

  it("does not invent Brakeman findings from scan_info.security_warnings", () => {
    expect(
      mapBrakeman({
        scan_info: { security_warnings: 99 },
        warnings: []
      })
    ).toEqual([]);
  });

  it("does not invent Talisman findings from summary.types", () => {
    expect(
      mapTalisman({
        summary: { types: { filecontent: 99 } },
        results: []
      })
    ).toEqual([]);
  });

  it("does not invent Dependency-Check findings from vulnerableSoftwareCount", () => {
    expect(
      mapDependencyCheck({
        dependencies: [{ fileName: "safe-lib-1.0.0.jar", vulnerabilities: [] }],
        vulnerableSoftwareCount: 99
      })
    ).toEqual([]);
  });

  it("does not invent YARA findings from match_count", () => {
    expect(mapYara({ match_count: 99, matches: [] })).toEqual([]);
  });

  it("does not invent Falco findings from error_count or warnings", () => {
    expect(
      mapFalco({
        error_count: 99,
        falco_load_results: [
          {
            name: "ok.yaml",
            successful: true,
            errors: [],
            warnings: [{ code: "LOAD_NO_EVTTYPE", message: "perf" }]
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent Amass findings from summary.names", () => {
    expect(mapAmass({ summary: { names: 99 }, results: [] })).toEqual([]);
  });

  it("does not invent Horusec findings from totalVulnerabilities", () => {
    expect(
      mapHorusec({ analysisVulnerabilities: [], totalVulnerabilities: 99 })
    ).toEqual([]);
  });

  it("does not invent naabu findings from total", () => {
    expect(mapNaabu({ total: 99, results: [] })).toEqual([]);
  });

  it("does not invent tfsec findings from failed_count or passed rows", () => {
    expect(
      mapTfsec({
        failed_count: 99,
        results: [
          {
            rule_id: "AVD-AWS-0088",
            status: 1,
            severity: "HIGH",
            resource: "aws_s3_bucket.ok"
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent cfn-nag findings from failure_count", () => {
    expect(
      mapCfnNag({
        failure_count: 99,
        violations: []
      })
    ).toEqual([]);
  });

  it("does not invent Whispers findings from summary.count", () => {
    expect(mapWhispers({ summary: { count: 99 }, secrets: [] })).toEqual([]);
  });

  it("does not invent Nancy findings from num_vulnerable", () => {
    expect(
      mapNancy({
        num_vulnerable: 99,
        vulnerable: [],
        audited: [
          {
            Coordinates: "pkg:golang/github.com/safe/lib@v1.0.0",
            Vulnerabilities: []
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent Sobelow findings from total_findings", () => {
    expect(
      mapSobelow({
        total_findings: 99,
        findings: {
          high_confidence: [],
          medium_confidence: [],
          low_confidence: []
        }
      })
    ).toEqual([]);
  });

  it("does not invent Polaris findings from Score or Success rows", () => {
    expect(
      mapPolaris({
        Score: 99,
        Results: [
          {
            Name: "ok",
            Kind: "Deployment",
            PodResult: {
              ContainerResults: [
                {
                  Results: {
                    livenessProbeMissing: {
                      ID: "livenessProbeMissing",
                      Success: true,
                      Severity: "warning"
                    }
                  }
                }
              ]
            }
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent kubeaudit findings from summary.errors or info rows", () => {
    expect(
      mapKubeaudit({
        summary: { errors: 99 },
        results: [
          {
            AuditResultName: "AutomountServiceAccountTokenTrueAndDefaultName",
            ResourceName: "ok",
            level: "info"
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent Popeye findings from score/grade/tally or info rows", () => {
    expect(
      mapPopeye({
        popeye: {
          score: 99,
          grade: "F",
          sections: [
            {
              linter: "deployments",
              tally: { error: 9, warning: 9, score: 0 },
              issues: {
                "default/ok": [
                  { level: 1, message: "FYI" },
                  { level: 0, message: "ok" }
                ]
              }
            }
          ]
        }
      })
    ).toEqual([]);
  });

  it("does not invent katana findings from total", () => {
    expect(mapKatana({ total: 99, results: [] })).toEqual([]);
  });

  it("does not invent cloudlist findings from total", () => {
    expect(mapCloudlist({ total: 99, items: [] })).toEqual([]);
  });

  it("does not invent pip-audit findings from vulnerability_count or empty vulns", () => {
    expect(
      mapPipAudit({
        vulnerability_count: 99,
        dependencies: [
          { name: "jinja2", version: "3.0.2", vulns: [] },
          { name: "markupsafe", version: "2.0.1" }
        ],
        fixes: [{ name: "flask", old_version: "0.5", new_version: "1.0" }]
      })
    ).toEqual([]);
  });

  it("does not invent Dockle findings from summary counters or INFO/PASS rows", () => {
    expect(
      mapDockle({
        summary: { fatal: 99, warn: 9, info: 2, pass: 7 },
        details: [
          {
            code: "CIS-DI-0005",
            title: "Enable Content trust for Docker",
            level: "INFO",
            alerts: ["AKIAIOSFODNN7EXAMPLE"]
          },
          {
            code: "CIS-DI-0002",
            title: "Use trusted base images",
            level: "PASS",
            alerts: []
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent tlsx findings from total or failed probes", () => {
    expect(
      mapTlsx({
        total: 99,
        results: [
          {
            host: "down.example.com",
            ip: "203.0.113.99",
            port: "443",
            probe_status: false,
            error: "connection refused"
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent kube-score findings from score or OK/skipped checks", () => {
    expect(
      mapKubeScore({
        score: 99,
        grade: "F",
        objects: [
          {
            object_name: "ok",
            type_meta: { kind: "Deployment" },
            object_meta: { name: "ok", namespace: "default" },
            checks: [
              {
                check: {
                  id: "container-resources",
                  name: "Container Resources"
                },
                grade: 10,
                skipped: false
              },
              {
                check: { id: "pod-probes", name: "Pod Probes" },
                grade: 1,
                skipped: true,
                comments: [
                  {
                    summary: "trap",
                    description: "AKIAIOSFODNN7EXAMPLE"
                  }
                ]
              }
            ]
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent Conftest findings from successes or warnings", () => {
    expect(
      mapConftest([
        {
          filename: "service.yaml",
          namespace: "main",
          successes: 99,
          failures: [],
          warnings: [
            {
              msg: "AKIAIOSFODNN7EXAMPLE",
              metadata: { query: "data.main.warn" }
            }
          ]
        }
      ])
    ).toEqual([]);
    expect(
      mapConftest({
        success_count: 99,
        failure_count: 7,
        results: [
          {
            filename: "ok.yaml",
            successes: 4,
            failures: []
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent cdxgen findings from metadata, dependencies, or vulnerabilities", () => {
    expect(
      mapCdxgen({
        bomFormat: "CycloneDX",
        specVersion: "1.6",
        metadata: {
          component: {
            name: "lab-app",
            version: "1.0.0",
            description: "AKIAIOSFODNN7EXAMPLE"
          },
          component_count: 99
        },
        components: [],
        dependencies: [{ ref: "pkg:npm/express@4.17.1", dependsOn: [] }],
        vulnerabilities: [
          {
            id: "CVE-2019-1010083",
            description:
              "-----BEGIN RSA PRIVATE KEY-----\nfixture\n-----END RSA PRIVATE KEY-----"
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent git-secrets findings from match_count or error banners", () => {
    expect(
      mapGitSecrets({
        match_count: 99,
        matches: [],
        results: []
      })
    ).toEqual([]);
    expect(
      mapGitSecrets([
        "[ERROR] Matched prohibited pattern",
        "Possible mitigations:",
        "- Mark false positives as allowed using: git config --add secrets.allowed ..."
      ])
    ).toEqual([]);
  });

  it("does not invent secretlint findings from errorCount or empty messages", () => {
    expect(
      mapSecretlint({
        errorCount: 99,
        warningCount: 2,
        filePath: "ok.env",
        messages: [],
        sourceContent: "AKIAIOSFODNN7EXAMPLE"
      })
    ).toEqual([]);
    expect(
      mapSecretlint([
        {
          filePath: "ok.env",
          errorCount: 99,
          messages: []
        }
      ])
    ).toEqual([]);
  });

  it("does not invent retire.js findings from vulnerability_count or empty vulns", () => {
    expect(
      mapRetireJs({
        vulnerability_count: 99,
        data: [
          {
            file: "vendor/safe.js",
            results: [
              {
                component: "lodash",
                version: "4.17.21",
                vulnerabilities: []
              }
            ]
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent govulncheck findings from OSV entries or progress", () => {
    expect(
      mapGovulncheck([
        { config: { protocol_version: "v1.0.0", scanner_name: "govulncheck" } },
        { progress: { message: "AKIAIOSFODNN7EXAMPLE" } },
        {
          osv: {
            id: "GO-2023-1840",
            details:
              "-----BEGIN RSA PRIVATE KEY-----\nfixture\n-----END RSA PRIVATE KEY-----"
          }
        },
        { SBOM: { go_version: "go1.22.0", modules: [] } }
      ])
    ).toEqual([]);
    expect(
      mapGovulncheck({
        finding_count: 99,
        findings: [],
        osv: { id: "GO-2023-1840" }
      })
    ).toEqual([]);
  });

  it("does not invent cargo-audit findings from count/found or warnings", () => {
    expect(
      mapCargoAudit({
        vulnerabilities: {
          found: true,
          count: 99,
          list: []
        },
        warnings: {
          unmaintained: [
            {
              kind: "unmaintained",
              package: { name: "oldcrate", version: "1.0.0" },
              advisory: {
                id: "RUSTSEC-2019-0036",
                description: "AKIAIOSFODNN7EXAMPLE"
              }
            }
          ]
        }
      })
    ).toEqual([]);
  });

  it("does not invent Kubescape findings from score counters or passed controls", () => {
    expect(
      mapKubescape({
        summaryDetails: {
          score: 99,
          ResourceCounters: { failedResources: 9, passedResources: 1 }
        },
        results: [
          {
            resourceID: "/v1/namespace/default/Deployment/ok",
            controls: [
              {
                controlID: "C-0001",
                name: "Prevent containers from running with root",
                status: { status: "passed" },
                rules: [
                  {
                    paths: [
                      {
                        failedPath:
                          "spec.template.spec.containers[0].env[0].value",
                        fixPath: { value: "AKIAIOSFODNN7EXAMPLE" }
                      }
                    ]
                  }
                ]
              },
              {
                controlID: "C-0012",
                name: "Applications CPU limits",
                status: { status: "skipped" }
              }
            ]
          }
        ]
      })
    ).toEqual([]);
  });

  it("does not invent slsa-verifier findings from PASSED rows or summary counters", () => {
    expect(
      mapSlsaVerifier({
        failed: 99,
        results: [
          {
            artifact: "ok-linux-amd64",
            status: "PASSED",
            error: "AKIAIOSFODNN7EXAMPLE"
          }
        ]
      })
    ).toEqual([]);
    expect(mapSlsaVerifier({})).toEqual([]);
  });

  it("does not invent kube-bench findings from PASS or WARN rows", () => {
    expect(
      mapKubeBench({
        Controls: [
          {
            tests: [
              {
                fail: 5,
                results: [
                  { test_number: "1.1.2", status: "PASS" },
                  { test_number: "1.1.3", status: "WARN" },
                  { test_number: "1.1.4", status: "INFO" }
                ]
              }
            ]
          }
        ]
      })
    ).toEqual([]);
  });

  it.each([
    ["kube-bench", "kube_bench.cis_cluster"],
    ["popeye", "popeye.cluster_sanitizer"]
  ] as const)(
    "skips %s honestly when no kubeconfig is available",
    async (_toolId, moduleId) => {
      const previousKubeconfig = process.env.KUBECONFIG;
      const previousHome = process.env.HOME;
      process.env.KUBECONFIG = "/nonexistent-periscan-kubeconfig";
      process.env.HOME = "/nonexistent-periscan-home";
      try {
        const output = await executeModuleById(
          moduleId,
          context({ hostname: "lab-cluster" })
        );
        expect(output.outcome).toBe("tool_skipped");
        expect(output.validationState).toBe("Inconclusive");
        expect(output.summary).toMatch(/kubeconfig/i);
      } finally {
        if (previousKubeconfig === undefined) {
          delete process.env.KUBECONFIG;
        } else {
          process.env.KUBECONFIG = previousKubeconfig;
        }
        if (previousHome === undefined) {
          delete process.env.HOME;
        } else {
          process.env.HOME = previousHome;
        }
      }
    }
  );
});
