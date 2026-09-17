import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

import type { OpenSourceToolId } from "@periscan/shared";
import { targetHasUpstreamLicense } from "@periscan/shared";

import { resolveOpenSourceToolRuntime } from "./toolchain.js";
import type {
  ModuleExecutionContext,
  ModuleOutput,
  ValidationModule
} from "./index.js";

const execFile = promisify(execFileCallback);
const TOOL_EXEC_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

type CreateModule = (
  manifest: Record<string, unknown>,
  targetSchema: z.ZodObject<Record<string, z.ZodTypeAny>>,
  execute: (
    context: ModuleExecutionContext & { target: Record<string, unknown> }
  ) => Promise<ModuleOutput>
) => ValidationModule;

const RepoTargetSchema = z.object({
  fixtureMode: z.boolean().optional(),
  repositoryName: z.string().min(1).optional(),
  repositoryPath: z.string().min(1)
});

const HostTargetSchema = z.object({
  cidr: z.string().min(1).optional(),
  fixtureMode: z.boolean().optional(),
  host: z.string().min(1).optional(),
  hostname: z.string().min(1).optional(),
  targetHost: z.string().min(1).optional()
});

function hostnameOf(target: z.infer<typeof HostTargetSchema>): string | null {
  return target.hostname ?? target.host ?? target.targetHost ?? target.cidr ?? null;
}

function countLines(text: string | undefined): number {
  return text ? text.split("\n").filter((line) => line.trim().length > 0).length : 0;
}

export async function runCopyleftTool(input: {
  args: string[];
  cwd?: string;
  toolId: OpenSourceToolId;
}): Promise<{ error?: string; json?: unknown; text?: string }> {
  const runtime = await resolveOpenSourceToolRuntime(input.toolId);
  if (!runtime.available || !runtime.runtime || !runtime.command) {
    return {
      error: runtime.reason ?? `${input.toolId} runtime is not available.`
    };
  }
  try {
    if (runtime.runtime === "docker") {
      if (!runtime.imageRef) {
        return { error: `${input.toolId} docker image is missing.` };
      }
      const { buildHardenedDockerRunArgs } = await import("./index.js");
      const { stdout } = await execFile(
        runtime.command,
        buildHardenedDockerRunArgs({
          commandArgs: input.args,
          imageRef: runtime.imageRef,
          network: "bridge",
          volumes: input.cwd
            ? [{ readonly: true, source: input.cwd, target: "/src" }]
            : []
        }),
        { maxBuffer: TOOL_EXEC_MAX_BUFFER_BYTES }
      );
      return parseMaybeJson(stdout);
    }
    const { stdout, stderr } = await execFile(runtime.command, input.args, {
      cwd: input.cwd,
      maxBuffer: TOOL_EXEC_MAX_BUFFER_BYTES
    });
    return parseMaybeJson(stdout || stderr);
  } catch (error) {
    const err = error as { message?: string; stdout?: string };
    if (err.stdout) {
      return parseMaybeJson(err.stdout);
    }
    return { error: err.message ?? `${input.toolId} execution failed.` };
  }
}

function parseMaybeJson(raw: string): { json?: unknown; text?: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { json: {} };
  const start = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const idx =
    start >= 0 && (arrayStart < 0 || start < arrayStart) ? start : arrayStart;
  if (idx < 0) return { text: trimmed };
  try {
    return { json: JSON.parse(trimmed.slice(idx)) };
  } catch {
    return { text: trimmed };
  }
}

export function countSemgrep(json: unknown): number {
  const results = (json as { results?: unknown[] } | null)?.results;
  return Array.isArray(results) ? results.length : 0;
}

export function buildCopyleftOptInModules(
  createModule: CreateModule
): ValidationModule[] {
  return [
    createModule(
      {
        approvalRequired: false,
        capabilityName: "Semgrep Repository SAST",
        customerVisibleDescription:
          "Runs Semgrep on an authorized repository after the tenant accepts LGPL-2.1 and installs the official pin. Not a Community default engine.",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "ControlPlane",
        fixtureSupported: true,
        license: "LGPL-2.1",
        liveSupported: true,
        moduleId: "semgrep.repo_sast",
        name: "Semgrep Repository SAST",
        outputSchema: "periscan.module-output.v1",
        parser: "periscan.semgrep.repo.v1",
        requiredInputs: ["repositoryPath"],
        requiredPermissions: ["repositories:read"],
        requiredScopes: ["Repository"],
        resourceLimits: { diskMb: 512, memoryMb: 512 },
        safetyLevel: "PassiveReadOnly",
        supportedMissionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        timeoutSeconds: 180,
        toolIds: ["semgrep"],
        toolName: "semgrep",
        version: "0.1.0"
      },
      RepoTargetSchema,
      async (context) => {
        const target = RepoTargetSchema.parse(context.target);
        const label =
          target.repositoryName ??
          target.repositoryPath.split("/").filter(Boolean).at(-1) ??
          target.repositoryPath;
        if (target.fixtureMode) {
          return {
            outcome: "no_sast_finding_observed",
            summary: `Semgrep fixture scan of ${label} invented no findings.`,
            validationState: "Fixed",
            signals: [],
            evidence: [
              {
                artifactType: "NormalizedEvidence",
                attributes: {
                  findingCount: 0,
                  measured: true,
                  toolId: "semgrep"
                },
                description: "Semgrep fixture produced no findings.",
                redactionStatus: "Redacted",
                sensitivityLevel: "Moderate"
              }
            ],
            errors: []
          };
        }
        if (!targetHasUpstreamLicense(context.target, "semgrep")) {
          return {
            outcome: "semgrep_license_required",
            summary:
              "Semgrep is LGPL-2.1. Accept the license in Engine Lab, then install the official pin.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["upstream_license_required"]
          };
        }
        const result = await runCopyleftTool({
          args: ["scan", "--json", "--quiet", "."],
          cwd: target.repositoryPath,
          toolId: "semgrep"
        });
        if (result.error) {
          return {
            outcome: "tool_unavailable",
            summary: `Semgrep could not scan ${label}: ${result.error}`,
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: [result.error]
          };
        }
        const count = countSemgrep(result.json);
        return {
          outcome:
            count > 0 ? "sast_finding_observed" : "no_sast_finding_observed",
          summary:
            count > 0
              ? `Semgrep found ${count} issue(s) in ${label}.`
              : `Semgrep found no issues in ${label}.`,
          validationState: count > 0 ? "Validated" : "Fixed",
          signals: [],
          evidence: [
            {
              artifactType: "NormalizedEvidence",
              attributes: {
                findingCount: count,
                measured: true,
                toolId: "semgrep"
              },
              description:
                count > 0
                  ? `Semgrep reported ${count} finding(s).`
                  : "Semgrep reported no findings.",
              redactionStatus: "Redacted",
              sensitivityLevel: count > 0 ? "High" : "Moderate"
            }
          ],
          errors: []
        };
      }
    ),
    createModule(
      {
        approvalRequired: false,
        capabilityName: "TruffleHog secrets",
        customerVisibleDescription:
          "Runs TruffleHog after the tenant accepts AGPL-3.0 and installs the official pin.",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "ControlPlane",
        fixtureSupported: true,
        license: "AGPL-3.0",
        liveSupported: true,
        moduleId: "trufflehog.repo_secrets",
        name: "TruffleHog Repository Scan",
        outputSchema: "periscan.module-output.v1",
        parser: "periscan.trufflehog.v1",
        requiredInputs: ["repositoryPath"],
        requiredPermissions: ["repositories:read"],
        requiredScopes: ["Repository"],
        resourceLimits: { diskMb: 512, memoryMb: 512 },
        safetyLevel: "PassiveReadOnly",
        supportedMissionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        timeoutSeconds: 180,
        toolIds: ["trufflehog"],
        toolName: "trufflehog",
        version: "0.1.0"
      },
      RepoTargetSchema,
      async (context) => {
        const target = RepoTargetSchema.parse(context.target);
        if (target.fixtureMode) {
          return {
            outcome: "no_secret_exposure_observed",
            summary: "TruffleHog fixture invented no findings.",
            validationState: "Fixed",
            signals: [],
            evidence: [],
            errors: []
          };
        }
        if (!targetHasUpstreamLicense(context.target, "trufflehog")) {
          return {
            outcome: "trufflehog_license_required",
            summary:
              "TruffleHog is AGPL-3.0. Accept the license in Engine Lab, then install.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["upstream_license_required"]
          };
        }
        const result = await runCopyleftTool({
          args: ["filesystem", target.repositoryPath, "--json"],
          toolId: "trufflehog"
        });
        if (result.error) {
          return {
            outcome: "tool_unavailable",
            summary: `TruffleHog could not scan: ${result.error}`,
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: [result.error]
          };
        }
        const count = Array.isArray(result.json)
          ? result.json.length
          : result.text
            ? result.text.split("\n").filter(Boolean).length
            : 0;
        return {
          outcome:
            count > 0
              ? "secret_exposure_observed"
              : "no_secret_exposure_observed",
          summary:
            count > 0
              ? `TruffleHog found ${count} potential secret(s).`
              : "TruffleHog found no secrets.",
          validationState: count > 0 ? "Validated" : "Fixed",
          signals: [],
          evidence: [
            {
              artifactType: "NormalizedEvidence",
              attributes: { findingCount: count, measured: true, toolId: "trufflehog" },
              description: "Licensed TruffleHog scan.",
              redactionStatus: "Redacted",
              sensitivityLevel: count > 0 ? "High" : "Moderate"
            }
          ],
          errors: []
        };
      }
    ),
    createModule(
      {
        approvalRequired: false,
        capabilityName: "Hadolint Dockerfile",
        customerVisibleDescription:
          "Runs Hadolint after the tenant accepts GPL-3.0.",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "ControlPlane",
        fixtureSupported: true,
        license: "GPL-3.0",
        liveSupported: true,
        moduleId: "hadolint.dockerfile",
        name: "Hadolint Dockerfile",
        outputSchema: "periscan.module-output.v1",
        parser: "periscan.hadolint.v1",
        requiredInputs: ["repositoryPath"],
        requiredPermissions: ["repositories:read"],
        requiredScopes: ["Repository"],
        resourceLimits: { diskMb: 256, memoryMb: 256 },
        safetyLevel: "PassiveReadOnly",
        supportedMissionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        timeoutSeconds: 60,
        toolIds: ["hadolint"],
        toolName: "hadolint",
        version: "0.1.0"
      },
      RepoTargetSchema,
      async (context) => {
        const target = RepoTargetSchema.parse(context.target);
        if (target.fixtureMode) {
          return {
            outcome: "no_dockerfile_issue_observed",
            summary: "Hadolint fixture invented no findings.",
            validationState: "Fixed",
            signals: [],
            evidence: [],
            errors: []
          };
        }
        if (!targetHasUpstreamLicense(context.target, "hadolint")) {
          return {
            outcome: "hadolint_license_required",
            summary: "Hadolint is GPL-3.0. Accept the license in Engine Lab.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["upstream_license_required"]
          };
        }
        const result = await runCopyleftTool({
          args: ["Dockerfile"],
          cwd: target.repositoryPath,
          toolId: "hadolint"
        });
        if (result.error) {
          return {
            outcome: "tool_unavailable",
            summary: `Hadolint could not scan: ${result.error}`,
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: [result.error]
          };
        }
        const count = result.text
          ? result.text.split("\n").filter(Boolean).length
          : 0;
        return {
          outcome:
            count > 0 ? "dockerfile_issue_observed" : "no_dockerfile_issue_observed",
          summary:
            count > 0
              ? `Hadolint reported ${count} Dockerfile issue(s).`
              : "Hadolint found no Dockerfile issues.",
          validationState: count > 0 ? "Validated" : "Fixed",
          signals: [],
          evidence: [
            {
              artifactType: "NormalizedEvidence",
              attributes: { findingCount: count, measured: true, toolId: "hadolint" },
              description: "Licensed Hadolint scan.",
              redactionStatus: "Redacted",
              sensitivityLevel: count > 0 ? "High" : "Moderate"
            }
          ],
          errors: []
        };
      }
    ),
    createModule(
      {
        approvalRequired: false,
        capabilityName: "sslscan TLS probe",
        customerVisibleDescription:
          "Runs sslscan after the tenant accepts GPL-3.0. Cipher inventory only.",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "ControlPlane",
        fixtureSupported: true,
        license: "GPL-3.0",
        liveSupported: true,
        moduleId: "sslscan.tls_probe",
        name: "sslscan TLS Probe",
        outputSchema: "periscan.module-output.v1",
        parser: "periscan.sslscan.v1",
        requiredInputs: ["hostname"],
        requiredPermissions: ["network:read"],
        requiredScopes: ["Domain", "Subdomain"],
        resourceLimits: { diskMb: 128, memoryMb: 128 },
        safetyLevel: "ActiveNonInvasive",
        supportedMissionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        timeoutSeconds: 90,
        toolIds: ["sslscan"],
        toolName: "sslscan",
        version: "0.1.0"
      },
      HostTargetSchema,
      async (context) => {
        const target = HostTargetSchema.parse(context.target);
        const host = hostnameOf(target);
        if (target.fixtureMode) {
          return {
            outcome: "no_tls_weakness_observed",
            summary: "sslscan fixture invented no findings.",
            validationState: "Fixed",
            signals: [],
            evidence: [],
            errors: []
          };
        }
        if (!targetHasUpstreamLicense(context.target, "sslscan")) {
          return {
            outcome: "sslscan_license_required",
            summary: "sslscan is GPL-3.0. Accept the license in Engine Lab.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["upstream_license_required"]
          };
        }
        if (!host) {
          return {
            outcome: "target_missing",
            summary: "sslscan needs a hostname.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["hostname_required"]
          };
        }
        const result = await runCopyleftTool({
          args: ["--no-failed", host],
          toolId: "sslscan"
        });
        if (result.error) {
          return {
            outcome: "tool_unavailable",
            summary: `sslscan could not probe ${host}: ${result.error}`,
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: [result.error]
          };
        }
        const count = countLines(result.text);
        return {
          outcome: count > 0 ? "tls_inventory_observed" : "no_tls_inventory_observed",
          summary:
            count > 0
              ? `sslscan reported ${count} TLS line(s) for ${host}.`
              : `sslscan reported no TLS inventory for ${host}.`,
          validationState: count > 0 ? "Validated" : "Fixed",
          signals: [],
          evidence: [
            {
              artifactType: "NormalizedEvidence",
              attributes: { findingCount: count, measured: true, toolId: "sslscan" },
              description: "Licensed sslscan TLS inventory.",
              redactionStatus: "Redacted",
              sensitivityLevel: "Moderate"
            }
          ],
          errors: []
        };
      }
    ),
    createModule(
      {
        approvalRequired: false,
        capabilityName: "Lynis host audit",
        customerVisibleDescription:
          "Runs Lynis on the enrolled runner after the tenant accepts GPL-3.0.",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "InternalRunner",
        fixtureSupported: true,
        license: "GPL-3.0",
        liveSupported: true,
        moduleId: "lynis.host_audit",
        name: "Lynis Host Audit",
        outputSchema: "periscan.module-output.v1",
        parser: "periscan.lynis.v1",
        requiredInputs: ["hostname"],
        requiredPermissions: ["host:read"],
        requiredScopes: ["InternalNetwork"],
        resourceLimits: { diskMb: 256, memoryMb: 256 },
        safetyLevel: "PassiveReadOnly",
        supportedMissionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        timeoutSeconds: 180,
        toolIds: ["lynis"],
        toolName: "lynis",
        version: "0.1.0"
      },
      HostTargetSchema,
      async (context) => {
        const target = HostTargetSchema.parse(context.target);
        if (target.fixtureMode) {
          return {
            outcome: "no_host_audit_finding_observed",
            summary: "Lynis fixture invented no findings.",
            validationState: "Fixed",
            signals: [],
            evidence: [],
            errors: []
          };
        }
        if (!targetHasUpstreamLicense(context.target, "lynis")) {
          return {
            outcome: "lynis_license_required",
            summary: "Lynis is GPL-3.0. Accept the license in Engine Lab.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["upstream_license_required"]
          };
        }
        const result = await runCopyleftTool({
          args: ["audit", "system", "--quick", "--quiet", "--no-colors"],
          toolId: "lynis"
        });
        if (result.error) {
          return {
            outcome: "tool_unavailable",
            summary: `Lynis could not audit the host: ${result.error}`,
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: [result.error]
          };
        }
        const count = countLines(result.text);
        return {
          outcome:
            count > 0 ? "host_audit_finding_observed" : "no_host_audit_finding_observed",
          summary:
            count > 0
              ? `Lynis reported ${count} host-audit line(s).`
              : "Lynis reported no host-audit findings.",
          validationState: count > 0 ? "Validated" : "Fixed",
          signals: [],
          evidence: [
            {
              artifactType: "NormalizedEvidence",
              attributes: { findingCount: count, measured: true, toolId: "lynis" },
              description: "Licensed Lynis host audit.",
              redactionStatus: "Redacted",
              sensitivityLevel: count > 0 ? "High" : "Moderate"
            }
          ],
          errors: []
        };
      }
    ),
    createModule(
      {
        approvalRequired: false,
        capabilityName: "RustScan port inventory",
        customerVisibleDescription:
          "Runs RustScan after the tenant accepts GPL-3.0. Connect inventory only.",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "InternalRunner",
        fixtureSupported: true,
        license: "GPL-3.0",
        liveSupported: true,
        moduleId: "rustscan.port_inventory",
        name: "RustScan Port Inventory",
        outputSchema: "periscan.module-output.v1",
        parser: "periscan.rustscan.v1",
        requiredInputs: ["hostname"],
        requiredPermissions: ["network:discover"],
        requiredScopes: ["IPRange", "InternalNetwork"],
        resourceLimits: { diskMb: 128, memoryMb: 256 },
        safetyLevel: "ActiveNonInvasive",
        supportedMissionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        timeoutSeconds: 120,
        toolIds: ["rustscan"],
        toolName: "rustscan",
        version: "0.1.0"
      },
      HostTargetSchema,
      async (context) => {
        const target = HostTargetSchema.parse(context.target);
        const host = hostnameOf(target);
        if (target.fixtureMode) {
          return {
            outcome: "no_open_port_observed",
            summary: "RustScan fixture invented no findings.",
            validationState: "Fixed",
            signals: [],
            evidence: [],
            errors: []
          };
        }
        if (!targetHasUpstreamLicense(context.target, "rustscan")) {
          return {
            outcome: "rustscan_license_required",
            summary: "RustScan is GPL-3.0. Accept the license in Engine Lab.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["upstream_license_required"]
          };
        }
        if (!host) {
          return {
            outcome: "target_missing",
            summary: "RustScan needs a hostname or CIDR.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["hostname_required"]
          };
        }
        const result = await runCopyleftTool({
          args: ["-a", host, "--ulimit", "5000", "-g"],
          toolId: "rustscan"
        });
        if (result.error) {
          return {
            outcome: "tool_unavailable",
            summary: `RustScan could not inventory ${host}: ${result.error}`,
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: [result.error]
          };
        }
        const count = countLines(result.text);
        return {
          outcome: count > 0 ? "open_port_observed" : "no_open_port_observed",
          summary:
            count > 0
              ? `RustScan reported ${count} open-port line(s) on ${host}.`
              : `RustScan reported no open ports on ${host}.`,
          validationState: count > 0 ? "Validated" : "Fixed",
          signals: [],
          evidence: [
            {
              artifactType: "NormalizedEvidence",
              attributes: { findingCount: count, measured: true, toolId: "rustscan" },
              description: "Licensed RustScan port inventory.",
              redactionStatus: "Redacted",
              sensitivityLevel: "Moderate"
            }
          ],
          errors: []
        };
      }
    ),
    createModule(
      {
        approvalRequired: false,
        capabilityName: "CVE Binary Tool",
        customerVisibleDescription:
          "Runs Intel CVE Binary Tool after the tenant accepts GPL-3.0.",
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: "ControlPlane",
        fixtureSupported: true,
        license: "GPL-3.0",
        liveSupported: true,
        moduleId: "cve_bin_tool.binary_cves",
        name: "CVE Binary Tool",
        outputSchema: "periscan.module-output.v1",
        parser: "periscan.cve-bin-tool.v1",
        requiredInputs: ["repositoryPath"],
        requiredPermissions: ["repositories:read"],
        requiredScopes: ["Repository"],
        resourceLimits: { diskMb: 512, memoryMb: 512 },
        safetyLevel: "PassiveReadOnly",
        supportedMissionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        timeoutSeconds: 240,
        toolIds: ["cve-bin-tool"],
        toolName: "cve-bin-tool",
        version: "0.1.0"
      },
      RepoTargetSchema,
      async (context) => {
        const target = RepoTargetSchema.parse(context.target);
        const label =
          target.repositoryName ??
          target.repositoryPath.split("/").filter(Boolean).at(-1) ??
          target.repositoryPath;
        if (target.fixtureMode) {
          return {
            outcome: "no_binary_cve_observed",
            summary: "CVE Binary Tool fixture invented no findings.",
            validationState: "Fixed",
            signals: [],
            evidence: [],
            errors: []
          };
        }
        if (!targetHasUpstreamLicense(context.target, "cve-bin-tool")) {
          return {
            outcome: "cve_bin_tool_license_required",
            summary:
              "CVE Binary Tool is GPL-3.0. Accept the license in Engine Lab.",
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: ["upstream_license_required"]
          };
        }
        const result = await runCopyleftTool({
          args: ["--format", "json", "--quiet", target.repositoryPath],
          toolId: "cve-bin-tool"
        });
        if (result.error) {
          return {
            outcome: "tool_unavailable",
            summary: `CVE Binary Tool could not scan ${label}: ${result.error}`,
            validationState: "Inconclusive",
            signals: [],
            evidence: [],
            errors: [result.error]
          };
        }
        const count = Array.isArray(result.json)
          ? result.json.length
          : result.json && typeof result.json === "object"
            ? Object.keys(result.json).length
            : countLines(result.text);
        return {
          outcome: count > 0 ? "binary_cve_observed" : "no_binary_cve_observed",
          summary:
            count > 0
              ? `CVE Binary Tool reported ${count} item(s) in ${label}.`
              : `CVE Binary Tool reported no binary CVEs in ${label}.`,
          validationState: count > 0 ? "Validated" : "Fixed",
          signals: [],
          evidence: [
            {
              artifactType: "NormalizedEvidence",
              attributes: {
                findingCount: count,
                measured: true,
                toolId: "cve-bin-tool"
              },
              description: "Licensed CVE Binary Tool scan.",
              redactionStatus: "Redacted",
              sensitivityLevel: count > 0 ? "High" : "Moderate"
            }
          ],
          errors: []
        };
      }
    )
  ];
}
