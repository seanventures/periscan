import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";

import {
  SignalEnvelopeSchema,
  type OpenSourceToolId
} from "@periscan/shared";

import { resolveOpenSourceToolRuntime } from "./toolchain.js";
import type {
  ModuleExecutionContext,
  ModuleOutput,
  ValidationModule
} from "./index.js";

const execFile = promisify(execFileCallback);
const TOOL_EXEC_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const FIXTURES_ROOT = fileURLToPath(new URL("../fixtures", import.meta.url));

type CreateModule = (
  manifest: Record<string, unknown>,
  targetSchema: z.ZodObject<Record<string, z.ZodTypeAny>>,
  execute: (
    context: ModuleExecutionContext & { target: Record<string, unknown> }
  ) => Promise<ModuleOutput>
) => ValidationModule;

const RepoTargetSchema = z.object({
  fixtureMode: z.boolean().optional(),
  hostname: z.string().min(1).optional(),
  repositoryName: z.string().min(1).optional(),
  repositoryPath: z.string().min(1)
});

const HostTargetSchema = z.object({
  cidr: z.string().min(1).optional(),
  fixtureMode: z.boolean().optional(),
  host: z.string().min(1).optional(),
  hostname: z.string().min(1).optional(),
  kubeconfigPath: z.string().min(1).optional(),
  targetHost: z.string().min(1).optional()
});

type PopularKind = "repo" | "host";

type PopularOssSpec = {
  args: (input: { host: string; scanRoot: string }) => string[];
  capabilityName: string;
  count: (result: { json?: unknown; text?: string }) => number;
  description: string;
  executionMode: "ControlPlane" | "InternalRunner";
  /** Path under packages/modules/fixtures/ loaded in fixtureMode. */
  fixtureFile?: string;
  license: string;
  moduleId: string;
  name: string;
  parser: string;
  requiredInputs: string[];
  requiredPermissions: string[];
  requiredScopes: string[];
  safetyLevel: "PassiveReadOnly" | "ActiveNonInvasive";
  signalCategory: "Exposure" | "Detection" | "Repository" | "ControlObservation";
  signalSubcategory: string;
  skip?: (input: {
    fixtureMode?: boolean;
    host: string;
    repositoryPath?: string;
  }) => string | null;
  timeoutSeconds: number;
  toolId: OpenSourceToolId;
  toolName: string;
  kind: PopularKind;
};

function repoLabel(target: { repositoryName?: string; repositoryPath: string }) {
  return (
    target.repositoryName ??
    target.repositoryPath.split("/").filter(Boolean).at(-1) ??
    target.repositoryPath
  );
}

function hostnameOf(target: z.infer<typeof HostTargetSchema>) {
  return (
    target.hostname ??
    target.host ??
    target.targetHost ??
    target.cidr ??
    "target"
  );
}

function repoHasAny(repositoryPath: string, names: string[]): boolean {
  return names.some((name) => existsSync(join(repositoryPath, name)));
}

function repoHasExtension(repositoryPath: string, extensions: string[]): boolean {
  const visit = (dir: string, depth: number): boolean => {
    if (depth > 4) return false;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      if (extensions.some((ext) => entry.toLowerCase().endsWith(ext))) {
        return true;
      }
      try {
        if (visit(full, depth + 1)) return true;
      } catch {
        continue;
      }
    }
    return false;
  };
  return visit(repositoryPath, 0);
}

function unavailable(
  tool: string,
  subject: string,
  message: string
): ModuleOutput {
  return {
    outcome: "tool_unavailable",
    summary: `${tool} could not scan ${subject}: ${message}`,
    validationState: "Inconclusive",
    signals: [],
    evidence: [],
    errors: [message]
  };
}

function skipped(tool: string, subject: string, reason: string): ModuleOutput {
  return {
    outcome: "tool_skipped",
    summary: `${tool} did not run against ${subject}: ${reason}`,
    validationState: "Inconclusive",
    signals: [],
    evidence: [
      {
        artifactType: "NormalizedEvidence",
        attributes: { measured: true, skipped: true, reason },
        description: reason,
        redactionStatus: "Redacted",
        sensitivityLevel: "Low"
      }
    ],
    errors: []
  };
}

function createSignals(
  context: ModuleExecutionContext,
  spec: PopularOssSpec,
  subject: string,
  count: number
) {
  if (count === 0) {
    return [];
  }
  const timestamp = new Date().toISOString();
  return [
    SignalEnvelopeSchema.parse({
      confidence: 0.9,
      createdAt: timestamp,
      evidenceIds: [],
      freshness: "Fresh",
      rawPayloadPointer: `${spec.toolId}://${subject}`,
      redactionStatus: "Redacted",
      relatedAssetIds: [],
      relatedControlIds: [],
      relatedEvidenceIds: [],
      relatedIdentityIds: [],
      relatedPathIds: [],
      sensitivityLevel: count > 0 ? "High" : "Moderate",
      signalCategory: spec.signalCategory,
      signalId: randomUUID(),
      signalSubcategory: spec.signalSubcategory,
      sourceIntegrationId: null,
      sourceType: `${spec.moduleId}.scan`,
      sourceVendor: spec.toolName,
      tenantId: context.tenantId,
      timestampIngested: timestamp,
      timestampObserved: timestamp,
      updatedAt: timestamp
    })
  ];
}

function measured(
  context: ModuleExecutionContext,
  spec: PopularOssSpec,
  subject: string,
  count: number,
  attributes: Record<string, unknown>
): ModuleOutput {
  const observed = count > 0;
  return {
    outcome: observed
      ? `${spec.signalSubcategory.toLowerCase()}_observed`
      : `no_${spec.signalSubcategory.toLowerCase()}_observed`,
    summary: observed
      ? `${spec.toolName} found ${count} finding(s) on ${subject}.`
      : `${spec.toolName} found no findings on ${subject}.`,
    validationState: observed ? "Validated" : "Fixed",
    signals: createSignals(context, spec, subject, count),
    evidence: [
      {
        artifactType: "NormalizedEvidence",
        attributes: {
          ...attributes,
          findingCount: count,
          measured: true,
          toolId: spec.toolId
        },
        description: observed
          ? `${spec.toolName} reported ${count} finding(s).`
          : `${spec.toolName} reported no findings.`,
        redactionStatus: "Redacted",
        sensitivityLevel: observed ? "High" : "Moderate"
      }
    ],
    errors: []
  };
}

function parseMaybeJson(raw: string): { json?: unknown; text?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { json: {} };
  }
  const start = trimmed.indexOf("{");
  const arrayStart = trimmed.indexOf("[");
  const idx =
    start >= 0 && (arrayStart < 0 || start < arrayStart) ? start : arrayStart;
  if (idx < 0) {
    return { text: trimmed };
  }
  try {
    return { json: JSON.parse(trimmed.slice(idx)) };
  } catch {
    return { text: trimmed };
  }
}

function loadPopularOssFixture(fixtureFile: string): {
  json?: unknown;
  text?: string;
} {
  const full = join(FIXTURES_ROOT, fixtureFile);
  const raw = readFileSync(full, "utf8");
  return parseMaybeJson(raw);
}

async function runToolJson(input: {
  args: string[];
  cwd?: string;
  fixtureFile?: string;
  fixtureMode?: boolean;
  toolId: OpenSourceToolId;
}): Promise<{ error?: string; json?: unknown; text?: string }> {
  if (input.fixtureMode) {
    if (input.fixtureFile) {
      return loadPopularOssFixture(input.fixtureFile);
    }
    return { json: {} };
  }
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
    const err = error as {
      message?: string;
      stdout?: string;
      stderr?: string;
    };
    if (err.stdout) {
      const parsed = parseMaybeJson(err.stdout);
      if (parsed.json !== undefined || parsed.text) {
        return parsed;
      }
    }
    return {
      error: err.message ?? `${input.toolId} execution failed.`
    };
  }
}

function countArray(json: unknown, keys: string[]): number {
  if (!json || typeof json !== "object") return 0;
  let cursor: unknown = json;
  for (const key of keys) {
    if (!cursor || typeof cursor !== "object") return 0;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return Array.isArray(cursor) ? cursor.length : 0;
}

function countDetectSecrets(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  const results = (json as { results?: Record<string, unknown[]> }).results;
  if (!results) return 0;
  return Object.values(results).reduce(
    (sum, rows) => sum + (Array.isArray(rows) ? rows.length : 0),
    0
  );
}

function countCheckov(json: unknown): number {
  const failed = (json as { summary?: { failed?: number } } | null)?.summary
    ?.failed;
  if (typeof failed === "number") return failed;
  return countArray(json, ["results", "failed_checks"]);
}

function countPipAudit(json: unknown): number {
  const deps = (json as { dependencies?: Array<{ vulns?: unknown[] }> } | null)
    ?.dependencies;
  if (!Array.isArray(deps)) {
    return Array.isArray(json) ? json.length : 0;
  }
  return deps.reduce(
    (sum, dep) => sum + (Array.isArray(dep.vulns) ? dep.vulns.length : 0),
    0
  );
}

function countDockle(json: unknown): number {
  const details = (json as { details?: Array<{ level?: string }> } | null)
    ?.details;
  if (!Array.isArray(details)) return 0;
  return details.filter((row) => row.level === "FATAL" || row.level === "WARN")
    .length;
}

function countSslyze(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  return (JSON.stringify(json).match(/"is_vulnerable"\s*:\s*true/g) ?? [])
    .length;
}

function countGosec(json: unknown): number {
  return countArray(json, ["Issues"]);
}

function countNumericOrIssues(json: unknown): number {
  if (Array.isArray(json)) return json.length;
  if (!json || typeof json !== "object") return 0;
  const record = json as Record<string, unknown>;
  for (const key of [
    "Issues",
    "issues",
    "results",
    "Results",
    "vulnerabilities",
    "Vulnerabilities",
    "failed_checks",
    "findings",
    "Reports"
  ]) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).length;
  }
  if (typeof record.number_of_failed === "number") {
    return record.number_of_failed;
  }
  if (typeof record.total_failed === "number") return record.total_failed;
  return 0;
}

function countTextLines(result: { json?: unknown; text?: string }): number {
  if (Array.isArray(result.json)) return result.json.length;
  if (result.json && typeof result.json === "object") {
    return countNumericOrIssues(result.json);
  }
  if (!result.text) return 0;
  return result.text.split("\n").filter((line) => line.trim().length > 0).length;
}

function isParliamentFinding(value: unknown): boolean {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as { issue?: unknown }).issue === "string"
  );
}

function countParliament(result: { json?: unknown; text?: string }): number {
  if (Array.isArray(result.json)) {
    return result.json.filter(isParliamentFinding).length;
  }
  if (isParliamentFinding(result.json)) {
    return 1;
  }
  if (!result.text) return 0;
  return result.text.split("\n").reduce((sum, line) => {
    const trimmed = line.trim();
    if (!trimmed) return sum;
    try {
      return sum + (isParliamentFinding(JSON.parse(trimmed)) ? 1 : 0);
    } catch {
      return sum;
    }
  }, 0);
}

function repoHasIamPolicyDocument(repositoryPath: string): boolean {
  const visit = (dir: string, depth: number): boolean => {
    if (depth > 4) return false;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;
      const full = join(dir, entry);
      const lower = entry.toLowerCase();
      const looksNamed =
        lower.includes("policy") ||
        lower.startsWith("iam") ||
        /(^|[._-])iam([._-]|$)/i.test(entry);
      if (
        looksNamed &&
        (lower.endsWith(".json") ||
          lower.endsWith(".yml") ||
          lower.endsWith(".yaml"))
      ) {
        return true;
      }
      if (lower.endsWith(".json")) {
        try {
          const raw = readFileSync(full, "utf8");
          if (raw.length <= 256 * 1024) {
            const parsed: unknown = JSON.parse(raw);
            if (
              parsed &&
              typeof parsed === "object" &&
              "Version" in parsed &&
              "Statement" in parsed
            ) {
              return true;
            }
          }
        } catch {
          // not IAM JSON
        }
      }
      if (visit(full, depth + 1)) return true;
    }
    return false;
  };
  return visit(repositoryPath, 0);
}

function requireFiles(
  files: string[],
  tool: string
): PopularOssSpec["skip"] {
  return ({ fixtureMode, repositoryPath }) => {
    if (fixtureMode || !repositoryPath) return null;
    if (repoHasAny(repositoryPath, files)) return null;
    return `${tool} skipped: none of ${files.join(", ")} present in the authorized repository.`;
  };
}

export const COMMUNITY_POPULAR_OSS_SPECS: readonly PopularOssSpec[] = [
  {
    args: ({ scanRoot }) => [
      "config",
      "--format",
      "json",
      "--quiet",
      scanRoot
    ],
    capabilityName: "IaC Misconfiguration Validation",
    count: (result) =>
      countCheckov(result.json) || countArray(result.json, ["Results"]),
    description:
      "Runs Trivy config against an authorized repository for IaC/misconfig findings.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "trivy.repo_misconfig",
    name: "Trivy Repository Misconfig",
    parser: "periscan.trivy.config.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "IaCMisconfig",
    timeoutSeconds: 180,
    toolId: "trivy",
    toolName: "Trivy config"
  },
  {
    args: () => ["scan", "--all-files", "."],
    capabilityName: "Repository Secret Validation",
    count: (result) => countDetectSecrets(result.json),
    description: "Runs Yelp detect-secrets on an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "detect_secrets.repo_secrets",
    name: "detect-secrets Repository Scan",
    parser: "periscan.detect-secrets.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SecretExposure",
    timeoutSeconds: 120,
    toolId: "detect-secrets",
    toolName: "detect-secrets"
  },
  {
    args: () => ["-r", ".", "-f", "json", "-q"],
    capabilityName: "Python SAST Validation",
    count: (result) => countArray(result.json, ["results"]),
    description: "Runs Bandit AST checks on an authorized Python repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "bandit.python_sast",
    name: "Bandit Python SAST",
    parser: "periscan.bandit.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SastFinding",
    skip: requireFiles(["pyproject.toml", "setup.py", "requirements.txt"], "Bandit"),
    timeoutSeconds: 120,
    toolId: "bandit",
    toolName: "Bandit"
  },
  {
    args: () => ["-d", ".", "-o", "json", "--quiet"],
    capabilityName: "IaC Posture Validation",
    count: (result) => countCheckov(result.json),
    description:
      "Runs Checkov against Terraform/K8s/Dockerfile in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "checkov.iac_posture",
    name: "Checkov IaC Posture",
    parser: "periscan.checkov.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "IaCMisconfig",
    timeoutSeconds: 180,
    toolId: "checkov",
    toolName: "Checkov"
  },
  {
    args: () => ["-f", "json"],
    capabilityName: "Python Advisory Validation",
    count: (result) => countPipAudit(result.json),
    description:
      "Runs pip-audit against an authorized repository lockfile or environment.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "pip_audit.python_advisories",
    name: "pip-audit Python Advisories",
    parser: "periscan.pip-audit.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "DependencyAdvisory",
    skip: requireFiles(
      ["requirements.txt", "poetry.lock", "Pipfile.lock", "pyproject.toml"],
      "pip-audit"
    ),
    timeoutSeconds: 180,
    toolId: "pip-audit",
    toolName: "pip-audit"
  },
  {
    args: ({ scanRoot }) => ["-f", "json", scanRoot],
    capabilityName: "Dockerfile CIS Validation",
    count: (result) => countDockle(result.json),
    description: "Runs Dockle against a Dockerfile in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "dockle.dockerfile_cis",
    name: "Dockle Dockerfile CIS",
    parser: "periscan.dockle.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "ContainerCis",
    skip: requireFiles(["Dockerfile", "dockerfile", "Containerfile"], "Dockle"),
    timeoutSeconds: 90,
    toolId: "dockle",
    toolName: "Dockle"
  },
  {
    args: ({ host }) => ["--json_out=-", host],
    capabilityName: "TLS Posture Validation",
    count: (result) => countSslyze(result.json),
    description:
      "Runs SSLyze against a verified hostname. Non-invasive TLS posture only.",
    executionMode: "ControlPlane",
    kind: "host",
    license: "Apache-2.0",
    moduleId: "sslyze.tls_posture",
    name: "SSLyze TLS Posture",
    parser: "periscan.sslyze.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["network:read"],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevel: "ActiveNonInvasive",
    signalCategory: "Exposure",
    signalSubcategory: "TlsWeakness",
    timeoutSeconds: 90,
    toolId: "sslyze",
    toolName: "SSLyze"
  },
  {
    args: ({ host }) => ["-u", host, "-silent", "-json"],
    capabilityName: "TLS Handshake Probe",
    count: (result) => (result.json || result.text ? 1 : 0),
    description: "Runs tlsx against a verified hostname. Handshake inventory only.",
    executionMode: "InternalRunner",
    kind: "host",
    license: "MIT",
    moduleId: "tlsx.tls_probe",
    name: "tlsx TLS Probe",
    parser: "periscan.tlsx.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["network:discover"],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevel: "ActiveNonInvasive",
    signalCategory: "Exposure",
    signalSubcategory: "TlsService",
    timeoutSeconds: 60,
    toolId: "tlsx",
    toolName: "tlsx"
  },
  {
    args: ({ host }) => ["-host", host, "-silent", "-json", "-c", "25"],
    capabilityName: "Port Inventory",
    count: (result) => countTextLines(result),
    description:
      "Runs naabu connect-scan inventory on verified host or CIDR. Not an exploit scanner.",
    executionMode: "InternalRunner",
    kind: "host",
    license: "MIT",
    moduleId: "naabu.port_inventory",
    name: "naabu Port Inventory",
    parser: "periscan.naabu.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["network:discover"],
    requiredScopes: ["IPRange", "InternalNetwork", "Domain", "Subdomain"],
    safetyLevel: "ActiveNonInvasive",
    signalCategory: "Exposure",
    signalSubcategory: "OpenPort",
    timeoutSeconds: 120,
    toolId: "naabu",
    toolName: "naabu"
  },
  {
    args: ({ scanRoot }) => ["-fmt", "json", scanRoot],
    capabilityName: "Go SAST Validation",
    count: (result) => countGosec(result.json),
    description: "Runs gosec against an authorized Go repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "gosec.go_sast",
    name: "gosec Go SAST",
    parser: "periscan.gosec.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SastFinding",
    skip: requireFiles(["go.mod"], "gosec"),
    timeoutSeconds: 180,
    toolId: "gosec",
    toolName: "gosec"
  },
  {
    args: ({ scanRoot }) => ["lint", scanRoot],
    capabilityName: "Kubernetes Manifest Validation",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs KubeLinter on Kubernetes YAML/Helm in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "kube_linter.manifest_posture",
    name: "KubeLinter Manifest Posture",
    parser: "periscan.kube-linter.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "K8sMisconfig",
    timeoutSeconds: 90,
    toolId: "kube-linter",
    toolName: "KubeLinter"
  },
  {
    args: ({ scanRoot }) => ["scan", "-d", scanRoot, "-o", "json"],
    capabilityName: "IaC Posture Validation",
    count: (result) => countNumericOrIssues(result.json),
    description: "Runs Terrascan against IaC in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "terrascan.iac_posture",
    name: "Terrascan IaC Posture",
    parser: "periscan.terrascan.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "IaCMisconfig",
    timeoutSeconds: 180,
    toolId: "terrascan",
    toolName: "Terrascan"
  },
  {
    args: ({ scanRoot }) => ["scan", "-p", scanRoot, "--report-formats", "json"],
    capabilityName: "IaC Posture Validation",
    count: (result) => countNumericOrIssues(result.json),
    description: "Runs Checkmarx KICS against IaC in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "kics.iac_posture",
    name: "KICS IaC Posture",
    parser: "periscan.kics.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "IaCMisconfig",
    timeoutSeconds: 180,
    toolId: "kics",
    toolName: "KICS"
  },
  {
    args: ({ scanRoot }) => ["score", "--output-format", "json", scanRoot],
    capabilityName: "Kubernetes Manifest Score",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs kube-score against Kubernetes manifests in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "MIT",
    moduleId: "kube_score.manifest_score",
    name: "kube-score Manifest Score",
    parser: "periscan.kube-score.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "K8sMisconfig",
    timeoutSeconds: 90,
    toolId: "kube-score",
    toolName: "kube-score"
  },
  {
    args: () => ["--json"],
    capabilityName: "Kubernetes CIS Cluster Validation",
    count: (result) => countNumericOrIssues(result.json),
    description:
      "Runs kube-bench CIS checks when a cluster kubeconfig is available. Not a live exploit.",
    executionMode: "ControlPlane",
    kind: "host",
    license: "Apache-2.0",
    moduleId: "kube_bench.cis_cluster",
    name: "kube-bench CIS Cluster",
    parser: "periscan.kube-bench.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["cluster:read"],
    requiredScopes: ["InternalNetwork"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "ControlObservation",
    signalSubcategory: "KubeCis",
    skip: ({ fixtureMode }) =>
      fixtureMode
        ? null
        : existsSync(process.env.KUBECONFIG ?? `${process.env.HOME ?? ""}/.kube/config`)
          ? null
          : "kube-bench skipped: no kubeconfig available on this execution host.",
    timeoutSeconds: 180,
    toolId: "kube-bench",
    toolName: "kube-bench"
  },
  {
    args: ({ scanRoot }) => ["test", scanRoot, "-o", "json"],
    capabilityName: "OPA Policy Test",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description:
      "Runs Conftest against an authorized repository when a policy/ directory is present.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "conftest.policy_test",
    name: "Conftest OPA Policy Test",
    parser: "periscan.conftest.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "ControlObservation",
    signalSubcategory: "PolicyFail",
    skip: requireFiles(["policy", "policies"], "Conftest"),
    timeoutSeconds: 90,
    toolId: "conftest",
    toolName: "Conftest"
  },
  {
    args: ({ scanRoot }) => ["-o", "-", "--format", "json", scanRoot],
    capabilityName: "CycloneDX SBOM Generation",
    count: (result) =>
      countArray(result.json, ["components"]) || (result.json ? 1 : 0),
    description: "Generates a CycloneDX SBOM from an authorized repository with cdxgen.",
    executionMode: "InternalRunner",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "cdxgen.sbom_generate",
    name: "cdxgen CycloneDX SBOM",
    parser: "periscan.cdxgen.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Repository",
    signalSubcategory: "SbomComponent",
    timeoutSeconds: 180,
    toolId: "cdxgen",
    toolName: "cdxgen"
  },
  {
    args: () => ["--scan"],
    capabilityName: "Repository Secret Validation",
    count: (result) => countTextLines(result),
    description: "Runs AWS git-secrets against an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "git_secrets.repo_secrets",
    name: "git-secrets Repository Scan",
    parser: "periscan.git-secrets.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SecretExposure",
    timeoutSeconds: 90,
    toolId: "git-secrets",
    toolName: "git-secrets"
  },
  {
    args: () => ["**/*"],
    capabilityName: "Repository Secret Validation",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs secretlint against an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "MIT",
    moduleId: "secretlint.repo_secrets",
    name: "secretlint Repository Scan",
    parser: "periscan.secretlint.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SecretExposure",
    timeoutSeconds: 90,
    toolId: "secretlint",
    toolName: "secretlint"
  },
  {
    args: () => ["--outputformat", "json", "--path", "."],
    capabilityName: "JavaScript Advisory Validation",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs retire.js against JavaScript dependencies in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "retirejs.js_advisories",
    name: "retire.js JavaScript Advisories",
    parser: "periscan.retirejs.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "DependencyAdvisory",
    skip: requireFiles(["package.json", "package-lock.json", "yarn.lock"], "retire.js"),
    timeoutSeconds: 120,
    toolId: "retirejs",
    toolName: "retire.js"
  },
  {
    args: () => ["-json", "./..."],
    capabilityName: "Go Advisory Validation",
    count: (result) => countTextLines(result),
    description: "Runs govulncheck against an authorized Go module.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "BSD-3-Clause",
    moduleId: "govulncheck.go_advisories",
    name: "govulncheck Go Advisories",
    parser: "periscan.govulncheck.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "DependencyAdvisory",
    skip: requireFiles(["go.mod"], "govulncheck"),
    timeoutSeconds: 180,
    toolId: "govulncheck",
    toolName: "govulncheck"
  },
  {
    args: () => ["audit", "--json"],
    capabilityName: "Rust Advisory Validation",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs cargo-audit against an authorized Rust lockfile.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "cargo_audit.rust_advisories",
    name: "cargo-audit Rust Advisories",
    parser: "periscan.cargo-audit.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "DependencyAdvisory",
    skip: requireFiles(["Cargo.lock", "Cargo.toml"], "cargo-audit"),
    timeoutSeconds: 120,
    toolId: "cargo-audit",
    toolName: "cargo-audit"
  },
  {
    args: ({ scanRoot }) => ["-r", "-C", scanRoot],
    capabilityName: "YARA Rule Validation",
    count: (result) => countTextLines(result),
    description:
      "Runs YARA against an authorized repository when .yar/.yara rules are present.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "BSD-3-Clause",
    moduleId: "yara.repo_rules",
    name: "YARA Repository Rules",
    parser: "periscan.yara.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Detection",
    signalSubcategory: "YaraMatch",
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (repoHasExtension(repositoryPath, [".yar", ".yara"])) return null;
      return "YARA skipped: no .yar/.yara rules in the authorized repository.";
    },
    timeoutSeconds: 120,
    toolId: "yara",
    toolName: "YARA"
  },
  {
    args: ({ host }) => ["enum", "-passive", "-d", host, "-json", "-"],
    capabilityName: "Passive Subdomain Enumeration",
    count: (result) => countTextLines(result),
    description:
      "Runs OWASP Amass in passive mode against a verified domain. Not an exploit scanner.",
    executionMode: "InternalRunner",
    kind: "host",
    license: "Apache-2.0",
    moduleId: "amass.passive_enum",
    name: "Amass Passive Enum",
    parser: "periscan.amass.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["network:discover"],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevel: "ActiveNonInvasive",
    signalCategory: "Exposure",
    signalSubcategory: "Subdomain",
    timeoutSeconds: 180,
    toolId: "amass",
    toolName: "Amass"
  },
  {
    args: ({ scanRoot }) => ["--validate", scanRoot],
    capabilityName: "Falco Rules Validation",
    count: (result) => countTextLines(result),
    description:
      "Validates Falco rules in an authorized repository. Does not attach to a live kernel.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "falco.rules_validate",
    name: "Falco Rules Validate",
    parser: "periscan.falco.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Detection",
    signalSubcategory: "FalcoRule",
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (
        repoHasAny(repositoryPath, ["falco.yaml", "falco_rules.yaml"]) ||
        repoHasExtension(repositoryPath, [".yaml", ".yml"])
      ) {
        return null;
      }
      return "Falco skipped: no Falco rules files in the authorized repository.";
    },
    timeoutSeconds: 60,
    toolId: "falco",
    toolName: "Falco"
  },
  {
    args: ({ scanRoot }) => [
      "scan",
      scanRoot,
      "--format",
      "json",
      "--enable-host-scanner=false"
    ],
    capabilityName: "Kubernetes Repo Posture",
    count: (result) => countNumericOrIssues(result.json),
    description: "Runs Kubescape against Kubernetes manifests in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "kubescape.repo_posture",
    name: "Kubescape Repo Posture",
    parser: "periscan.kubescape.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "K8sMisconfig",
    timeoutSeconds: 180,
    toolId: "kubescape",
    toolName: "Kubescape"
  },
  {
    args: ({ scanRoot }) => ["verify-artifact", scanRoot],
    capabilityName: "SLSA Provenance Verification",
    count: (result) => (result.json || result.text ? 1 : 0),
    description:
      "Runs slsa-verifier when provenance is present in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "slsa_verifier.provenance",
    name: "SLSA Provenance Verify",
    parser: "periscan.slsa-verifier.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Repository",
    signalSubcategory: "ProvenanceFail",
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (
        repoHasExtension(repositoryPath, [".intoto.jsonl", ".intoto.json"]) ||
        repoHasAny(repositoryPath, ["provenance.json", "attestation.json"])
      ) {
        return null;
      }
      return "slsa-verifier skipped: no provenance/attestation files in the authorized repository.";
    },
    timeoutSeconds: 90,
    toolId: "slsa-verifier",
    toolName: "slsa-verifier"
  },
  {
    args: ({ scanRoot }) => ["-f", "json", scanRoot],
    capabilityName: "Ruby on Rails SAST",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs Brakeman against an authorized Rails repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "MIT",
    moduleId: "brakeman.ruby_sast",
    name: "Brakeman Ruby SAST",
    parser: "periscan.brakeman.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SastFinding",
    skip: requireFiles(["Gemfile", "config.ru"], "Brakeman"),
    timeoutSeconds: 180,
    toolId: "brakeman",
    toolName: "Brakeman"
  },
  {
    args: ({ scanRoot }) => [
      "start",
      "-p",
      scanRoot,
      "-o",
      "json",
      "--disable-docker"
    ],
    capabilityName: "Multi-language SAST",
    count: (result) => countNumericOrIssues(result.json),
    description: "Runs Horusec against an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "horusec.multi_sast",
    name: "Horusec Multi SAST",
    parser: "periscan.horusec.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SastFinding",
    timeoutSeconds: 180,
    toolId: "horusec",
    toolName: "Horusec"
  },
  {
    args: ({ scanRoot }) => ["--format", "JSON", "--scan", scanRoot],
    capabilityName: "OWASP Dependency-Check",
    count: (result) => countNumericOrIssues(result.json),
    description: "Runs OWASP Dependency-Check on an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "dependency_check.sca",
    name: "OWASP Dependency-Check",
    parser: "periscan.dependency-check.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "DependencyAdvisory",
    timeoutSeconds: 300,
    toolId: "dependency-check",
    toolName: "Dependency-Check"
  },
  {
    args: () => ["--scan=.", "--pattern=*"],
    capabilityName: "Talisman secret scan",
    count: (result) => countTextLines(result),
    description: "Runs Talisman against an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "talisman.repo_secrets",
    name: "Talisman Repository Scan",
    parser: "periscan.talisman.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SecretExposure",
    timeoutSeconds: 120,
    toolId: "talisman",
    toolName: "Talisman"
  },
  {
    args: ({ scanRoot }) => [scanRoot, "-f", "json"],
    capabilityName: "tfsec IaC",
    count: (result) => countNumericOrIssues(result.json),
    description: "Runs tfsec against Terraform in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "MIT",
    moduleId: "tfsec.iac_posture",
    name: "tfsec IaC Posture",
    parser: "periscan.tfsec.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "IaCMisconfig",
    skip: requireFiles(["*.tf", "terraform"], "tfsec"),
    timeoutSeconds: 180,
    toolId: "tfsec",
    toolName: "tfsec"
  },
  {
    args: ({ scanRoot }) => ["--input-path", scanRoot, "--output-format", "json"],
    capabilityName: "cfn-nag CloudFormation",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs cfn-nag against CloudFormation in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "MIT",
    moduleId: "cfn_nag.cloudformation",
    name: "cfn-nag CloudFormation",
    parser: "periscan.cfn-nag.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "IaCMisconfig",
    skip: requireFiles(["template.yaml", "template.yml", "template.json"], "cfn-nag"),
    timeoutSeconds: 120,
    toolId: "cfn-nag",
    toolName: "cfn-nag"
  },
  {
    args: ({ scanRoot }) => ["-f", "json", scanRoot],
    capabilityName: "CloudFormation Template Validation",
    count: (result) =>
      countNumericOrIssues(result.json) || countTextLines(result),
    description:
      "Runs cfn-lint against CloudFormation templates in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "cfn-lint/cfn-lint-fixture.json",
    kind: "repo",
    license: "MIT",
    moduleId: "cfn_lint.cloudformation",
    name: "cfn-lint CloudFormation",
    parser: "periscan.cfn-lint.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "IaCMisconfig",
    skip: requireFiles(
      ["template.yaml", "template.yml", "template.json"],
      "cfn-lint"
    ),
    timeoutSeconds: 120,
    toolId: "cfn-lint",
    toolName: "cfn-lint"
  },
  {
    args: () => ["."],
    capabilityName: "Whispers secrets",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs Whispers against an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "whispers.repo_secrets",
    name: "Whispers Repository Scan",
    parser: "periscan.whispers.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SecretExposure",
    timeoutSeconds: 120,
    toolId: "whispers",
    toolName: "Whispers"
  },
  {
    args: () => ["sleuth", "go.sum"],
    capabilityName: "Nancy Go advisories",
    count: (result) => countTextLines(result),
    description: "Runs Nancy against go.sum in an authorized repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "nancy.go_advisories",
    name: "Nancy Go Advisories",
    parser: "periscan.nancy.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "DependencyAdvisory",
    skip: requireFiles(["go.sum", "go.mod"], "Nancy"),
    timeoutSeconds: 120,
    toolId: "nancy",
    toolName: "Nancy"
  },
  {
    args: () => ["."],
    capabilityName: "Sobelow Elixir SAST",
    count: (result) => countTextLines(result),
    description: "Runs Sobelow against an authorized Elixir repository.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "sobelow.elixir_sast",
    name: "Sobelow Elixir SAST",
    parser: "periscan.sobelow.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SastFinding",
    skip: requireFiles(["mix.exs"], "Sobelow"),
    timeoutSeconds: 120,
    toolId: "sobelow",
    toolName: "Sobelow"
  },
  {
    args: ({ scanRoot }) => ["audit", "--format", "json", scanRoot],
    capabilityName: "Polaris Kubernetes posture",
    count: (result) => countNumericOrIssues(result.json),
    description: "Runs Polaris audit against Kubernetes manifests.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "polaris.k8s_posture",
    name: "Polaris Kubernetes Posture",
    parser: "periscan.polaris.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "K8sMisconfig",
    timeoutSeconds: 120,
    toolId: "polaris",
    toolName: "Polaris"
  },
  {
    args: ({ scanRoot }) => ["all", scanRoot, "-f", "json"],
    capabilityName: "kubeaudit posture",
    count: (result) => countNumericOrIssues(result.json) || countTextLines(result),
    description: "Runs kubeaudit against Kubernetes manifests.",
    executionMode: "ControlPlane",
    kind: "repo",
    license: "MIT",
    moduleId: "kubeaudit.k8s_posture",
    name: "kubeaudit Kubernetes Posture",
    parser: "periscan.kubeaudit.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "K8sMisconfig",
    timeoutSeconds: 90,
    toolId: "kubeaudit",
    toolName: "kubeaudit"
  },
  {
    args: () => ["-o", "json"],
    capabilityName: "Popeye cluster sanitizer",
    count: (result) => countNumericOrIssues(result.json),
    description: "Runs Popeye when kubeconfig is present.",
    executionMode: "ControlPlane",
    kind: "host",
    license: "Apache-2.0",
    moduleId: "popeye.cluster_sanitizer",
    name: "Popeye Cluster Sanitizer",
    parser: "periscan.popeye.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["cluster:read"],
    requiredScopes: ["InternalNetwork"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "ControlObservation",
    signalSubcategory: "KubeCis",
    skip: ({ fixtureMode }) =>
      fixtureMode
        ? null
        : existsSync(process.env.KUBECONFIG ?? `${process.env.HOME ?? ""}/.kube/config`)
          ? null
          : "Popeye skipped: no kubeconfig on this execution host.",
    timeoutSeconds: 180,
    toolId: "popeye",
    toolName: "Popeye"
  },
  {
    args: ({ host }) => ["-u", host, "-silent", "-json", "-d", "2"],
    capabilityName: "Katana crawl inventory",
    count: (result) => countTextLines(result),
    description: "Crawls a verified hostname with Katana. Not an exploit scanner.",
    executionMode: "InternalRunner",
    kind: "host",
    license: "MIT",
    moduleId: "katana.web_crawl",
    name: "Katana Web Crawl",
    parser: "periscan.katana.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["network:discover"],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevel: "ActiveNonInvasive",
    signalCategory: "Exposure",
    signalSubcategory: "WebCrawl",
    timeoutSeconds: 180,
    toolId: "katana",
    toolName: "katana"
  },
  {
    args: () => ["-json", "-silent"],
    capabilityName: "cloudlist asset inventory",
    count: (result) => countTextLines(result),
    description: "Lists cloud assets when provider credentials exist.",
    executionMode: "InternalRunner",
    kind: "host",
    license: "MIT",
    moduleId: "cloudlist.cloud_assets",
    name: "cloudlist Cloud Assets",
    parser: "periscan.cloudlist.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["cloud:read"],
    requiredScopes: ["CloudAccount"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "CloudAsset",
    timeoutSeconds: 180,
    toolId: "cloudlist",
    toolName: "cloudlist"
  },
  {
    args: ({ scanRoot }) => ["--json", "--directory", scanRoot],
    capabilityName: "Cloud IAM Policy Validation",
    count: (result) => countParliament(result),
    description:
      "Runs Parliament against IAM policy documents in an authorized repository. Static policy lint only; not a live AWS mutator.",
    executionMode: "ControlPlane",
    fixtureFile: "parliament/parliament-fixture.json",
    kind: "repo",
    license: "BSD-3-Clause",
    moduleId: "parliament.iam_policy",
    name: "Parliament IAM Policy",
    parser: "periscan.parliament.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "IamMisconfig",
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (repoHasIamPolicyDocument(repositoryPath)) return null;
      return "Parliament skipped: no IAM policy documents (*policy*.json or Version/Statement JSON) in the authorized repository.";
    },
    timeoutSeconds: 120,
    toolId: "parliament",
    toolName: "Parliament"
  }
];

export function buildCommunityPopularOssModules(
  createModule: CreateModule
): ValidationModule[] {
  return COMMUNITY_POPULAR_OSS_SPECS.map((spec) =>
    createModule(
      {
        approvalRequired: false,
        capabilityName: spec.capabilityName,
        customerVisibleDescription: spec.description,
        evidenceTypes: ["NormalizedEvidence"],
        executionMode: spec.executionMode,
        fixtureSupported: true,
        license: spec.license,
        liveSupported: true,
        moduleId: spec.moduleId,
        name: spec.name,
        outputSchema: "periscan.module-output.v1",
        parser: spec.parser,
        requiredInputs: spec.requiredInputs,
        requiredPermissions: spec.requiredPermissions,
        requiredScopes: spec.requiredScopes,
        resourceLimits: { diskMb: 512, memoryMb: 512 },
        safetyLevel: spec.safetyLevel,
        supportedMissionTypes: [
          "ValidationSnapshot",
          "ExposureValidation",
          "ContinuousValidation"
        ],
        timeoutSeconds: spec.timeoutSeconds,
        toolIds: [spec.toolId],
        toolName: spec.toolName,
        version: "0.1.0"
      },
      spec.kind === "repo" ? RepoTargetSchema : HostTargetSchema,
      async (context) => {
        if (spec.kind === "repo") {
          const target = RepoTargetSchema.parse(context.target);
          const label = repoLabel(target);
          const skipReason = spec.skip?.({
            fixtureMode: target.fixtureMode,
            host: label,
            repositoryPath: target.repositoryPath
          });
          if (skipReason) {
            return skipped(spec.toolName, label, skipReason);
          }
          const runtime = target.fixtureMode
            ? { runtime: "binary" as const }
            : await resolveOpenSourceToolRuntime(spec.toolId);
          const scanRoot =
            runtime.runtime === "docker" ? "/src" : target.repositoryPath;
          const result = await runToolJson({
            args: spec.args({ host: label, scanRoot }),
            cwd: target.repositoryPath,
            fixtureFile: spec.fixtureFile,
            fixtureMode: target.fixtureMode,
            toolId: spec.toolId
          });
          if (result.error) {
            return unavailable(spec.toolName, label, result.error);
          }
          return measured(context, spec, label, spec.count(result), {
            repositoryPath: target.repositoryPath
          });
        }

        const target = HostTargetSchema.parse(context.target);
        const host = hostnameOf(target);
        const skipReason = spec.skip?.({
          fixtureMode: target.fixtureMode,
          host
        });
        if (skipReason) {
          return skipped(spec.toolName, host, skipReason);
        }
        const result = await runToolJson({
          args: spec.args({ host, scanRoot: "." }),
          fixtureFile: spec.fixtureFile,
          fixtureMode: target.fixtureMode,
          toolId: spec.toolId
        });
        if (result.error) {
          return unavailable(spec.toolName, host, result.error);
        }
        return measured(context, spec, host, spec.count(result), {
          hostname: host
        });
      }
    )
  );
}
