import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  listModuleManifests,
  type ModuleManifest
} from "../packages/modules/src/index.ts";
import {
  listOpenSourceToolDefinitions,
  resolveOpenSourceToolRuntime
} from "../packages/modules/src/toolchain.ts";
import {
  evaluateModuleLicensePolicy,
  findModuleToolLicenseMismatches
} from "./license-inventory.ts";

/**
 * Module Certification Harness.
 *
 * Validates every registered Periscan Validation Module against the Tool
 * Adapter Framework contract (docs/OPEN_SOURCE_TOOL_ADAPTER_SPEC.md) and the
 * certification criteria (docs/VALIDATION_MODULE_CERTIFICATION.md).
 *
 * It checks manifest completeness, license disposition (reusing the same
 * policy engine as the third-party-notices gate), safety/approval invariants,
 * evidence wiring, and live tool runtime readiness. It never executes tools or
 * fabricates results — runtime readiness is a presence probe only.
 */

const REPORT_PATH = "docs/generated/module-certification-report.md";

// Safety levels that MUST require an explicit approval before live execution.
const APPROVAL_REQUIRED_SAFETY_LEVELS = new Set([
  "BASLite",
  "AdvancedAdversarial"
]);

export type CertificationSeverity = "pass" | "warn" | "fail";

export interface CertificationCheck {
  id: string;
  severity: CertificationSeverity;
  message: string;
}

export interface ModuleRuntimeReadiness {
  toolId: string;
  available: boolean;
  runtime: string | null;
  version: string;
  detail: string;
}

export interface ModuleCertification {
  moduleId: string;
  name: string;
  safetyLevel: ModuleManifest["safetyLevel"];
  executionMode: ModuleManifest["executionMode"];
  license: string;
  licenseDisposition: "Allowed" | "RequiresLegalReview" | "Blocked";
  safetyMetadata: {
    canExecuteCode: boolean;
    canExfiltrateData: boolean;
    canModifyTarget: boolean;
    destructivePotential: ModuleManifest["destructivePotential"];
    networkAccessRequired: boolean;
    writesToTarget: boolean;
  };
  status: "Certified" | "CertifiedWithWarnings" | "NotCertified";
  checks: CertificationCheck[];
  runtime: ModuleRuntimeReadiness[];
}

export interface CertificationReport {
  generatedAt: string;
  modules: ModuleCertification[];
  summary: {
    total: number;
    certified: number;
    certifiedWithWarnings: number;
    notCertified: number;
    failingModuleIds: string[];
  };
}

function pass(id: string, message: string): CertificationCheck {
  return { id, message, severity: "pass" };
}

function warn(id: string, message: string): CertificationCheck {
  return { id, message, severity: "warn" };
}

function fail(id: string, message: string): CertificationCheck {
  return { id, message, severity: "fail" };
}

async function resolveModuleRuntime(
  manifest: ModuleManifest
): Promise<ModuleRuntimeReadiness[]> {
  const readiness: ModuleRuntimeReadiness[] = [];

  for (const toolId of manifest.toolIds) {
    try {
      const resolution = await resolveOpenSourceToolRuntime(toolId);
      readiness.push({
        available: resolution.available,
        detail: resolution.reason ?? resolution.displayCommand,
        runtime: resolution.runtime ?? null,
        toolId,
        version: resolution.version
      });
    } catch (error) {
      readiness.push({
        available: false,
        detail: error instanceof Error ? error.message : String(error),
        runtime: null,
        toolId,
        version: "unknown"
      });
    }
  }

  return readiness;
}

function certifyManifest(
  manifest: ModuleManifest,
  runtime: ModuleRuntimeReadiness[]
): ModuleCertification {
  const checks: CertificationCheck[] = [];

  // Real-First Rule (AGENTS.md): mock/demo modules must never ship in the
  // production registry/catalog. Hard-fail any module whose id or tool name
  // looks like a fixture so they can never re-enter production certification.
  const mockMarker = /(^|[._-])(mock|demo|fixture|fake|sample)([._-]|$)/i;
  if (
    mockMarker.test(manifest.moduleId) ||
    mockMarker.test(manifest.toolName)
  ) {
    checks.push(
      fail(
        "no_mock_modules",
        `Module ${manifest.moduleId} (tool ${manifest.toolName}) looks like a mock/demo fixture and must not appear in the production registry.`
      )
    );
  } else {
    checks.push(pass("no_mock_modules", "Module is not a mock/demo fixture."));
  }

  // License disposition (fail-closed, same engine as the notices gate).
  // Inherit tool policyStatus so GPL/LGPL wrappers quarantined as
  // RequiresLegalReview are not treated as Blocked.
  const catalogTools = listOpenSourceToolDefinitions({
    includeDeferred: true,
    includeLegalReview: true,
    phase: "all"
  });
  const licensePolicy = evaluateModuleLicensePolicy(manifest, catalogTools);
  if (licensePolicy.disposition === "Blocked") {
    checks.push(
      fail(
        "license",
        `License ${manifest.license} is blocked: ${licensePolicy.reason}`
      )
    );
  } else if (licensePolicy.disposition === "RequiresLegalReview") {
    checks.push(
      warn("license", `License ${manifest.license} requires legal review.`)
    );
  } else {
    checks.push(pass("license", `License ${manifest.license} permitted.`));
  }

  checks.push(
    manifest.licenseRisk === licensePolicy.disposition
      ? pass(
          "license_risk",
          `Manifest licenseRisk matches policy disposition: ${manifest.licenseRisk}.`
        )
      : fail(
          "license_risk",
          `Manifest licenseRisk=${manifest.licenseRisk} does not match license policy disposition=${licensePolicy.disposition}.`
        )
  );

  // Dual-truth: tool-backed modules must declare the primary tool SPDX.
  const dualTruth = findModuleToolLicenseMismatches({
    generatedAt: new Date(0).toISOString(),
    moduleManifests: [manifest],
    nodeDependencies: [],
    tools: catalogTools
  });
  if (dualTruth.length === 0) {
    checks.push(
      pass(
        "license_tool_alignment",
        manifest.toolIds.length === 0
          ? "Module is first-party (no toolIds); license alignment not applicable."
          : `Module license ${manifest.license} matches primary tool SPDX.`
      )
    );
  } else {
    for (const mismatch of dualTruth) {
      checks.push(
        fail(
          "license_tool_alignment",
          `Module license dual-truth: declares ${mismatch.moduleLicense} but primary tool ${mismatch.toolId} is ${mismatch.toolLicense}.`
        )
      );
    }
  }

  checks.push(
    manifest.toolIds.length === 0 || manifest.toolVersion !== null
      ? pass("tool_version", "Tool version metadata present or not applicable.")
      : fail(
          "tool_version",
          "Tool-backed module is missing toolVersion metadata."
        )
  );

  checks.push(
    manifest.executionCommandTemplate.length > 0
      ? pass(
          "execution_template",
          "Execution command template metadata present."
        )
      : fail(
          "execution_template",
          "Missing execution command template metadata."
        )
  );

  // Customer-visible product framing (raw tool branding must not be the headline).
  checks.push(
    manifest.customerVisibleDescription.trim().length > 0
      ? pass("customer_visible", "Customer-visible description present.")
      : fail("customer_visible", "Missing customer-visible description.")
  );

  // Parser + output schema metadata.
  checks.push(
    manifest.parser.trim().length > 0
      ? pass("parser", `Parser declared: ${manifest.parser}.`)
      : fail("parser", "No parser declared.")
  );
  checks.push(
    manifest.outputSchema.trim().length > 0
      ? pass(
          "output_schema",
          `Output schema declared: ${manifest.outputSchema}.`
        )
      : fail("output_schema", "No output schema declared.")
  );

  // Evidence types: every module must produce normalized evidence.
  checks.push(
    manifest.evidenceTypes.length > 0
      ? pass(
          "evidence_types",
          `Evidence types: ${manifest.evidenceTypes.join(", ")}.`
        )
      : fail("evidence_types", "No evidence types declared.")
  );

  // Mission types.
  checks.push(
    manifest.supportedMissionTypes.length > 0
      ? pass(
          "mission_types",
          `Supported missions: ${manifest.supportedMissionTypes.join(", ")}.`
        )
      : fail("mission_types", "No supported mission types declared.")
  );

  // Permissions.
  checks.push(
    manifest.requiredPermissions.length > 0
      ? pass("permissions", `Required permissions declared.`)
      : warn("permissions", "No required permissions declared.")
  );

  // Safety invariant: BASLite+ must require approval.
  if (APPROVAL_REQUIRED_SAFETY_LEVELS.has(manifest.safetyLevel)) {
    checks.push(
      manifest.approvalRequired
        ? pass(
            "approval_gate",
            `Safety level ${manifest.safetyLevel} correctly requires approval.`
          )
        : fail(
            "approval_gate",
            `Safety level ${manifest.safetyLevel} must set approvalRequired=true.`
          )
    );
  }

  // Disallowed modules must not be live-executable.
  if (manifest.safetyLevel === "Disallowed") {
    checks.push(
      manifest.liveSupported
        ? fail(
            "disallowed_not_live",
            "Disallowed module must not advertise live execution."
          )
        : pass(
            "disallowed_not_live",
            "Disallowed module is not live-executable."
          )
    );
  }

  if (manifest.safetyLevel === "PassiveReadOnly") {
    const unsafeReadOnlyClaims = [
      manifest.writesToTarget ? "writesToTarget" : null,
      manifest.canModifyTarget ? "canModifyTarget" : null,
      manifest.canExecuteCode ? "canExecuteCode" : null,
      manifest.canExfiltrateData ? "canExfiltrateData" : null,
      manifest.destructivePotential !== "None"
        ? `destructivePotential=${manifest.destructivePotential}`
        : null
    ].filter(Boolean);

    checks.push(
      unsafeReadOnlyClaims.length === 0
        ? pass(
            "passive_read_only_claims",
            "Passive module declares no target write/modify/code/exfil/destructive capability."
          )
        : fail(
            "passive_read_only_claims",
            `Passive module has unsafe claims: ${unsafeReadOnlyClaims.join(", ")}.`
          )
    );
  }

  checks.push(
    (manifest.resourceLimits.maxNetworkRequests ?? 0) > 0 &&
      !manifest.networkAccessRequired
      ? fail(
          "network_metadata",
          "Manifest declares network request limits but networkAccessRequired=false."
        )
      : pass(
          "network_metadata",
          "Network requirement metadata is consistent with resource limits."
        )
  );

  checks.push(
    manifest.canModifyTarget
      ? fail(
          "no_target_modification",
          "Validation modules must not modify customer targets."
        )
      : pass(
          "no_target_modification",
          "Module declares no customer-target modification."
        )
  );

  checks.push(
    manifest.canExfiltrateData
      ? fail(
          "no_exfiltration",
          "Validation modules must not exfiltrate customer data."
        )
      : pass(
          "no_exfiltration",
          "Module declares no real data exfiltration capability."
        )
  );

  checks.push(
    manifest.liveSupported && manifest.destructivePotential === "High"
      ? fail(
          "no_live_destructive",
          "High destructive potential cannot be advertised as live-supported."
        )
      : pass(
          "no_live_destructive",
          "Live support is not paired with high destructive potential."
        )
  );

  checks.push(
    (manifest.dataSensitivity === "High" ||
      manifest.dataSensitivity === "Restricted") &&
      manifest.redactionRules.length === 0
      ? fail(
          "redaction_rules",
          "High-sensitivity module output must declare redaction rules."
        )
      : pass(
          "redaction_rules",
          "Redaction rules declared for declared sensitivity."
        )
  );

  checks.push(
    manifest.status === "Blocked" && manifest.liveSupported
      ? fail("blocked_not_live", "Blocked modules must not be live-supported.")
      : pass(
          "blocked_not_live",
          "Implementation status is consistent with live support."
        )
  );

  // Timeout must be bounded.
  checks.push(
    manifest.timeoutSeconds > 0 && manifest.timeoutSeconds <= 3600
      ? pass("timeout", `Timeout ${manifest.timeoutSeconds}s within bounds.`)
      : fail(
          "timeout",
          `Timeout ${manifest.timeoutSeconds}s out of bounds (1..3600).`
        )
  );

  // Test coverage signal.
  checks.push(
    manifest.fixtureSupported
      ? pass("fixtures", "Fixture-based certification supported.")
      : warn(
          "fixtures",
          "No fixture support declared; certification relies on lab/live only."
        )
  );

  // Runtime readiness (informational/warn — modules may legitimately be NotConfigured).
  for (const tool of runtime) {
    checks.push(
      tool.available
        ? pass(
            "runtime",
            `Tool ${tool.toolId} runtime ready via ${tool.runtime}.`
          )
        : warn(
            "runtime",
            `Tool ${tool.toolId} runtime unavailable (${tool.detail}); module reports ToolUnavailable until configured.`
          )
    );
  }

  const hasFailure = checks.some((check) => check.severity === "fail");
  const hasWarning = checks.some((check) => check.severity === "warn");
  const status: ModuleCertification["status"] = hasFailure
    ? "NotCertified"
    : hasWarning
      ? "CertifiedWithWarnings"
      : "Certified";

  return {
    checks,
    executionMode: manifest.executionMode,
    license: manifest.license,
    licenseDisposition: licensePolicy.disposition,
    moduleId: manifest.moduleId,
    name: manifest.name,
    runtime,
    safetyLevel: manifest.safetyLevel,
    safetyMetadata: {
      canExecuteCode: manifest.canExecuteCode,
      canExfiltrateData: manifest.canExfiltrateData,
      canModifyTarget: manifest.canModifyTarget,
      destructivePotential: manifest.destructivePotential,
      networkAccessRequired: manifest.networkAccessRequired,
      writesToTarget: manifest.writesToTarget
    },
    status
  };
}

export async function buildCertificationReport(): Promise<CertificationReport> {
  const manifests = [...listModuleManifests()].sort((left, right) =>
    left.moduleId.localeCompare(right.moduleId)
  );

  const modules: ModuleCertification[] = [];
  for (const manifest of manifests) {
    const runtime = await resolveModuleRuntime(manifest);
    modules.push(certifyManifest(manifest, runtime));
  }

  const failingModuleIds = modules
    .filter((module) => module.status === "NotCertified")
    .map((module) => module.moduleId);

  return {
    generatedAt: new Date().toISOString(),
    modules,
    summary: {
      certified: modules.filter((module) => module.status === "Certified")
        .length,
      certifiedWithWarnings: modules.filter(
        (module) => module.status === "CertifiedWithWarnings"
      ).length,
      failingModuleIds,
      notCertified: failingModuleIds.length,
      total: modules.length
    }
  };
}

function escapeMarkdown(value: string) {
  return value.replace(/\|/g, "\\|");
}

export function renderCertificationReport(report: CertificationReport): string {
  const statusRows = report.modules.map((module) => {
    const warnings = module.checks.filter((c) => c.severity === "warn").length;
    const failures = module.checks.filter((c) => c.severity === "fail").length;
    return [
      module.moduleId,
      module.safetyLevel,
      module.executionMode,
      module.license,
      module.licenseDisposition,
      module.status,
      String(warnings),
      String(failures)
    ].map(escapeMarkdown);
  });

  const detailSections = report.modules
    .map((module) => {
      const checkLines = module.checks
        .map((check) => {
          const icon =
            check.severity === "fail"
              ? "FAIL"
              : check.severity === "warn"
                ? "WARN"
                : "ok";
          return `- [${icon}] (${check.id}) ${escapeMarkdown(check.message)}`;
        })
        .join("\n");
      return `### ${module.moduleId} — ${module.status}\n\n${checkLines}`;
    })
    .join("\n\n");

  return `# Module Certification Report

Generated by \`pnpm modules:certify\` (do not edit by hand).

Generated at: ${report.generatedAt}

## Summary

- Modules certified: ${report.summary.total}
- Certified: ${report.summary.certified}
- Certified with warnings: ${report.summary.certifiedWithWarnings}
- Not certified (hard failures): ${report.summary.notCertified}
${
  report.summary.failingModuleIds.length > 0
    ? `- Failing modules: ${report.summary.failingModuleIds.join(", ")}`
    : "- Failing modules: none"
}

Runtime readiness reflects this environment only. A module that reports a tool
as unavailable surfaces an honest \`ToolUnavailable\` / \`RequiresConfiguration\`
state at runtime; it is not a fabricated result.

## Module Status

| Module ID | Safety | Execution | License | License Policy | Status | Warnings | Failures |
| --- | --- | --- | --- | --- | --- | --- | --- |
${statusRows.map((row) => `| ${row.join(" | ")} |`).join("\n")}

## Module Detail

${detailSections}
`;
}

async function pathExists(pathname: string) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

export async function writeCertificationReport(rootDir = process.cwd()) {
  const report = await buildCertificationReport();
  const content = renderCertificationReport(report);
  const target = path.join(rootDir, REPORT_PATH);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
  return { content, report };
}

export async function checkCertification(rootDir = process.cwd()) {
  const report = await buildCertificationReport();
  const expected = renderCertificationReport(report);
  const target = path.join(rootDir, REPORT_PATH);
  const actual = (await pathExists(target))
    ? await readFile(target, "utf8")
    : null;
  // Compare everything except the generated-at timestamp line.
  const normalize = (value: string) =>
    value.replace(/Generated at: .*/m, "Generated at: <timestamp>");
  const stale = actual === null || normalize(actual) !== normalize(expected);
  return { report, stale };
}

async function main() {
  const command = process.argv[2] ?? "check";
  const rootDir = process.cwd();

  if (command === "write") {
    const { report } = await writeCertificationReport(rootDir);
    console.log(
      `Wrote ${REPORT_PATH}: ${report.summary.total} modules, ${report.summary.notCertified} not certified.`
    );
    return;
  }

  if (command !== "check") {
    throw new Error(`Unsupported module certification command: ${command}`);
  }

  const { report, stale } = await checkCertification(rootDir);

  for (const module of report.modules) {
    if (module.status === "NotCertified") {
      const failures = module.checks
        .filter((check) => check.severity === "fail")
        .map((check) => `${check.id}: ${check.message}`)
        .join("; ");
      console.error(`NOT CERTIFIED ${module.moduleId} -> ${failures}`);
    }
  }

  if (stale) {
    console.error(
      `Module certification report is stale. Run: pnpm modules:certify`
    );
  }

  if (report.summary.notCertified > 0 || stale) {
    process.exitCode = 1;
    return;
  }

  console.log(
    `Module certification passed: ${report.summary.total} modules (${report.summary.certifiedWithWarnings} with warnings).`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
