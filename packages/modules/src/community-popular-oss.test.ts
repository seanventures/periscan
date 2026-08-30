import { readFileSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  COMMUNITY_VALIDATION_SUITE,
  isCommunityValidationModuleId,
  isCommunityValidationToolId,
  isEngineLabTheaterModuleId
} from "@periscan/shared";

import {
  COMMUNITY_POPULAR_OSS_SPECS,
  buildCommunityPopularOssModules
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
      "checkov.iac_posture",
      context({
        fixtureMode: true,
        repositoryName: "lab-repo",
        repositoryPath: "/tmp/does-not-need-to-exist"
      })
    );
    expect(output.outcome).toBe("no_iacmisconfig_observed");
    expect(output.validationState).toBe("Fixed");
    expect(output.signals).toEqual([]);
    expect(output.evidence[0]?.attributes.findingCount).toBe(0);
    expect(output.evidence[0]?.attributes.measured).toBe(true);
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
    await writeFile(join(cfnLintScanRoot, "README.md"), "no templates\n", "utf8");
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
  const parsed: unknown = JSON.parse(readFileSync(PARLIAMENT_FIXTURE_PATH, "utf8"));
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
    expect(
      COMMUNITY_VALIDATION_SUITE.some(
        (entry) =>
          entry.moduleId === PARLIAMENT_MODULE_ID &&
          entry.toolLicense === "BSD-3-Clause" &&
          entry.targetKind === "repositoryPath" &&
          entry.requiredScopeTypes.includes("Repository") &&
          !entry.requiredScopeTypes.includes("CloudAccount")
      )
    ).toBe(true);
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
    await writeFile(join(parliamentScanRoot, "README.md"), "no policies\n", "utf8");
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
