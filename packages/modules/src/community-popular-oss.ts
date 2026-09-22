import { randomUUID } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { z } from "zod";

import { SignalEnvelopeSchema, type OpenSourceToolId } from "@periscan/shared";

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
  /**
   * Redacted finding summaries for evidence mapping. Must omit secrets,
   * hashes, and raw code snippets from tool JSON.
   */
  findings?: (result: {
    json?: unknown;
    text?: string;
  }) => Array<Record<string, unknown>>;
  license: string;
  moduleId: string;
  name: string;
  parser: string;
  requiredInputs: string[];
  requiredPermissions: string[];
  requiredScopes: string[];
  safetyLevel: "PassiveReadOnly" | "ActiveNonInvasive";
  signalCategory:
    | "Exposure"
    | "Detection"
    | "Repository"
    | "ControlObservation";
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

function repoLabel(target: {
  repositoryName?: string;
  repositoryPath: string;
}) {
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

function repoHasExtension(
  repositoryPath: string,
  extensions: string[]
): boolean {
  const visit = (dir: string, depth: number): boolean => {
    if (depth > 4) return false;
    let entries: string[];
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

const IAC_POSTURE_SUFFIX = ".iac_posture";
const IAC_FILE_EXTENSIONS = [".tf", ".tf.json", ".tfvars", ".yml", ".yaml"];
const IAC_ROOT_NAMES = [
  "terraform",
  "template.yaml",
  "template.yml",
  "template.json"
];

function repoHasIacFiles(repositoryPath: string): boolean {
  return (
    repoHasAny(repositoryPath, IAC_ROOT_NAMES) ||
    repoHasExtension(repositoryPath, IAC_FILE_EXTENSIONS)
  );
}

function iacSkipReason(tool: string): string {
  return `${tool} skipped: no Terraform, Kubernetes YAML, or CloudFormation files in the authorized repository.`;
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

function repositoryTargetUnusable(repositoryPath: string): boolean {
  if (!existsSync(repositoryPath)) {
    return true;
  }
  try {
    statSync(repositoryPath);
    return false;
  } catch {
    return true;
  }
}

function missingTarget(
  tool: string,
  subject: string,
  repositoryPath: string
): ModuleOutput {
  const message = `repository path is missing or unreadable: ${repositoryPath}`;
  return {
    outcome: "tool_target_missing",
    summary: `${tool} could not scan ${subject}: ${message}`,
    validationState: "Inconclusive",
    signals: [],
    evidence: [
      {
        artifactType: "NormalizedEvidence",
        attributes: {
          measured: false,
          reason: "tool_target_missing",
          repositoryPath
        },
        description: message,
        redactionStatus: "Redacted",
        sensitivityLevel: "Low"
      }
    ],
    errors: [message]
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
  attributes: Record<string, unknown>,
  result?: { json?: unknown; text?: string }
): ModuleOutput {
  const observed = count > 0;
  return {
    outcome: observed
      ? `${spec.signalSubcategory.toLowerCase()}_observed`
      : `no_${spec.signalSubcategory.toLowerCase()}_observed`,
    summary: observed
      ? `${spec.toolName} found ${count} finding(s) on ${subject}.`
      : `${spec.toolName} found no findings on ${subject}.`,
    // SETTLED: first clean observation is a measurement, never RemediationTask
    // Fixed. Skip / unavailable / missing-target stay Inconclusive via those
    // helpers. Remediation Fixed is verify-only (PERISCAN-545).
    validationState: "Validated",
    signals: createSignals(context, spec, subject, count),
    evidence: [
      {
        artifactType: "NormalizedEvidence",
        attributes: {
          ...attributes,
          findingCount: count,
          measured: true,
          toolId: spec.toolId,
          ...(spec.findings && result
            ? { findings: spec.findings(result) }
            : {})
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
  return mapDetectSecrets(json).length;
}

function mapDetectSecrets(json: unknown): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object") return [];
  const results = (json as { results?: Record<string, unknown[]> }).results;
  if (!results || typeof results !== "object") return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const [filename, rows] of Object.entries(results)) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      findings.push({
        filename:
          typeof rec.filename === "string" && rec.filename.length > 0
            ? rec.filename
            : filename,
        lineNumber:
          typeof rec.line_number === "number" ? rec.line_number : null,
        type: typeof rec.type === "string" ? rec.type : "secret"
      });
    }
  }
  return findings;
}

function mapBandit(json: unknown): Array<Record<string, unknown>> {
  const results = (json as { results?: unknown[] } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as Record<string, unknown>;
    return [
      {
        filename: typeof rec.filename === "string" ? rec.filename : null,
        issueText: typeof rec.issue_text === "string" ? rec.issue_text : null,
        severity:
          typeof rec.issue_severity === "string" ? rec.issue_severity : null,
        testId: typeof rec.test_id === "string" ? rec.test_id : null
      }
    ];
  });
}

function mapGosec(json: unknown): Array<Record<string, unknown>> {
  const issues = (json as { Issues?: unknown[] } | null)?.Issues;
  if (!Array.isArray(issues)) return [];
  return issues.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as Record<string, unknown>;
    return [
      {
        details: typeof rec.details === "string" ? rec.details : null,
        file: typeof rec.file === "string" ? rec.file : null,
        ruleId: typeof rec.rule_id === "string" ? rec.rule_id : null,
        severity: typeof rec.severity === "string" ? rec.severity : null
      }
    ];
  });
}

function mapKubeLinter(json: unknown): Array<Record<string, unknown>> {
  const reports = (json as { Reports?: unknown[] } | null)?.Reports;
  if (!Array.isArray(reports)) return [];
  return reports.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as {
      Diagnostic?: { Check?: unknown; Message?: unknown };
      Object?: {
        K8sObject?: {
          GroupVersionKind?: { Kind?: unknown };
          Name?: unknown;
        };
        Metadata?: { FilePath?: unknown };
      };
    };
    return [
      {
        check:
          typeof rec.Diagnostic?.Check === "string"
            ? rec.Diagnostic.Check
            : null,
        kind:
          typeof rec.Object?.K8sObject?.GroupVersionKind?.Kind === "string"
            ? rec.Object.K8sObject.GroupVersionKind.Kind
            : null,
        message:
          typeof rec.Diagnostic?.Message === "string"
            ? rec.Diagnostic.Message
            : null,
        name:
          typeof rec.Object?.K8sObject?.Name === "string"
            ? rec.Object.K8sObject.Name
            : null
      }
    ];
  });
}

function countKubeLinter(json: unknown): number {
  return mapKubeLinter(json).length || countNumericOrIssues(json);
}

export function mapCheckov(json: unknown): Array<Record<string, unknown>> {
  const reports = Array.isArray(json) ? json : json ? [json] : [];
  const findings: Array<Record<string, unknown>> = [];
  for (const report of reports) {
    if (!report || typeof report !== "object") continue;
    const failed = (report as { results?: { failed_checks?: unknown } }).results
      ?.failed_checks;
    if (!Array.isArray(failed)) continue;
    for (const row of failed) {
      if (!row || typeof row !== "object") continue;
      const rec = row as Record<string, unknown>;
      findings.push({
        checkId: typeof rec.check_id === "string" ? rec.check_id : null,
        checkName: typeof rec.check_name === "string" ? rec.check_name : null,
        filePath: typeof rec.file_path === "string" ? rec.file_path : null,
        resource: typeof rec.resource === "string" ? rec.resource : null,
        severity: typeof rec.severity === "string" ? rec.severity : null
      });
    }
  }
  return findings;
}

function countCheckov(json: unknown): number {
  return mapCheckov(json).length;
}

export function mapTerrascan(json: unknown): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object") return [];
  const record = json as {
    results?: { violations?: unknown };
    violations?: unknown;
  };
  const violations = Array.isArray(record.violations)
    ? record.violations
    : record.results && typeof record.results === "object"
      ? record.results.violations
      : undefined;
  if (!Array.isArray(violations)) return [];
  return violations.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as Record<string, unknown>;
    return [
      {
        file: typeof rec.file === "string" ? rec.file : null,
        resourceName:
          typeof rec.resource_name === "string" ? rec.resource_name : null,
        ruleId: typeof rec.rule_id === "string" ? rec.rule_id : null,
        ruleName: typeof rec.rule_name === "string" ? rec.rule_name : null,
        severity: typeof rec.severity === "string" ? rec.severity : null
      }
    ];
  });
}

export function mapKics(json: unknown): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object") return [];
  const queries = (json as { queries?: unknown }).queries;
  if (!Array.isArray(queries)) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const query of queries) {
    if (!query || typeof query !== "object") continue;
    const rec = query as Record<string, unknown>;
    const files = rec.files;
    if (!Array.isArray(files)) continue;
    const queryName =
      typeof rec.query_name === "string" ? rec.query_name : null;
    const severity = typeof rec.severity === "string" ? rec.severity : null;
    for (const file of files) {
      if (!file || typeof file !== "object") continue;
      const row = file as Record<string, unknown>;
      findings.push({
        fileName: typeof row.file_name === "string" ? row.file_name : null,
        line: typeof row.line === "number" ? row.line : null,
        queryName,
        severity
      });
    }
  }
  return findings;
}

export function mapKubeBench(json: unknown): Array<Record<string, unknown>> {
  const root = Array.isArray(json) ? { Controls: json } : json;
  if (!root || typeof root !== "object") return [];
  const controls =
    (root as { Controls?: unknown }).Controls ??
    (root as { controls?: unknown }).controls;
  if (!Array.isArray(controls)) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const control of controls) {
    if (!control || typeof control !== "object") continue;
    const tests = (control as { tests?: unknown }).tests;
    if (!Array.isArray(tests)) continue;
    for (const test of tests) {
      if (!test || typeof test !== "object") continue;
      const results = (test as { results?: unknown }).results;
      if (!Array.isArray(results)) continue;
      for (const row of results) {
        if (!row || typeof row !== "object") continue;
        const rec = row as Record<string, unknown>;
        const status = typeof rec.status === "string" ? rec.status : "";
        if (status.toUpperCase() !== "FAIL") continue;
        findings.push({
          status: "FAIL",
          testDesc: typeof rec.test_desc === "string" ? rec.test_desc : null,
          testNumber:
            typeof rec.test_number === "string" ? rec.test_number : null
        });
      }
    }
  }
  return findings;
}

export function mapBrakeman(json: unknown): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object") return [];
  const warnings = (json as { warnings?: unknown }).warnings;
  if (!Array.isArray(warnings)) return [];
  return warnings.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const rec = row as Record<string, unknown>;
    return [
      {
        checkName: typeof rec.check_name === "string" ? rec.check_name : null,
        confidence: typeof rec.confidence === "string" ? rec.confidence : null,
        file: typeof rec.file === "string" ? rec.file : null,
        line: typeof rec.line === "number" ? rec.line : null,
        message: typeof rec.message === "string" ? rec.message : null,
        warningType:
          typeof rec.warning_type === "string" ? rec.warning_type : null
      }
    ];
  });
}

export function mapTalisman(json: unknown): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object") return [];
  const record = json as { files?: unknown; results?: unknown };
  const rows: unknown[] = [];
  if (Array.isArray(record.results)) {
    rows.push(...record.results);
  } else if (record.results && typeof record.results === "object") {
    for (const [filename, value] of Object.entries(
      record.results as Record<string, unknown>
    )) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        rows.push({ filename, ...(value as Record<string, unknown>) });
      }
    }
  } else if (Array.isArray(record.files)) {
    rows.push(...record.files);
  }
  const findings: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    const filename = typeof rec.filename === "string" ? rec.filename : null;
    const failures = Array.isArray(rec.failure_list)
      ? rec.failure_list
      : Array.isArray(rec.errors)
        ? rec.errors
        : [];
    for (const failure of failures) {
      if (!failure || typeof failure !== "object") continue;
      const item = failure as Record<string, unknown>;
      findings.push({
        filename,
        type: typeof item.type === "string" ? item.type : null
      });
    }
  }
  return findings;
}

export function mapDependencyCheck(
  json: unknown
): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object") return [];
  const dependencies = (json as { dependencies?: unknown }).dependencies;
  if (!Array.isArray(dependencies)) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const dep of dependencies) {
    if (!dep || typeof dep !== "object") continue;
    const rec = dep as Record<string, unknown>;
    const fileName = typeof rec.fileName === "string" ? rec.fileName : null;
    const vulns = rec.vulnerabilities;
    if (!Array.isArray(vulns)) continue;
    for (const vuln of vulns) {
      if (!vuln || typeof vuln !== "object") continue;
      const row = vuln as Record<string, unknown>;
      findings.push({
        fileName,
        name: typeof row.name === "string" ? row.name : null,
        severity: typeof row.severity === "string" ? row.severity : null
      });
    }
  }
  return findings;
}

function asYaraFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const rule =
    typeof rec.rule === "string"
      ? rec.rule
      : typeof rec.rule_name === "string"
        ? rec.rule_name
        : null;
  const file =
    typeof rec.file === "string"
      ? rec.file
      : typeof rec.filename === "string"
        ? rec.filename
        : typeof rec.path === "string"
          ? rec.path
          : null;
  if (rule === null && file === null) return null;
  return { file, rule };
}

export function mapYara(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asYaraFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const matches = (json as { matches?: unknown }).matches;
  if (!Array.isArray(matches)) return [];
  return matches.flatMap((row) => {
    const finding = asYaraFinding(row);
    return finding ? [finding] : [];
  });
}

function mapYaraText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^(warning|error|yara):/i.test(trimmed)) continue;
    const match = /^(\S+)\s+(\S.*)$/.exec(trimmed);
    if (!match) continue;
    findings.push({ file: match[2], rule: match[1] });
  }
  return findings;
}

function yaraFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapYara(result.json);
  return mapped.length > 0 ? mapped : mapYaraText(result.text);
}

export function mapFalco(json: unknown): Array<Record<string, unknown>> {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  const results = (json as { falco_load_results?: unknown }).falco_load_results;
  if (!Array.isArray(results)) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const result of results) {
    if (!result || typeof result !== "object") continue;
    const rec = result as { errors?: unknown; name?: unknown };
    const file = typeof rec.name === "string" ? rec.name : null;
    if (!Array.isArray(rec.errors)) continue;
    for (const error of rec.errors) {
      if (!error || typeof error !== "object") continue;
      const item = error as Record<string, unknown>;
      findings.push({
        code: typeof item.code === "string" ? item.code : null,
        file,
        message: typeof item.message === "string" ? item.message : null
      });
    }
  }
  return findings;
}

function mapFalcoText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    const match = /^(LOAD_ERR_[A-Z0-9_]+)(?:\s*\(([^)]*)\))?\s*:?\s*(.*)$/.exec(
      trimmed
    );
    if (!match) continue;
    findings.push({
      code: match[1],
      file: null,
      message: match[3] || match[2] || null
    });
  }
  return findings;
}

function falcoFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapFalco(result.json);
  return mapped.length > 0 ? mapped : mapFalcoText(result.text);
}

function asAmassFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const name =
    typeof rec.name === "string"
      ? rec.name
      : typeof rec.fqdn === "string"
        ? rec.fqdn
        : null;
  const domain = typeof rec.domain === "string" ? rec.domain : null;
  if (name === null && domain === null) return null;
  return {
    domain,
    name,
    tag: typeof rec.tag === "string" ? rec.tag : null
  };
}

export function mapAmass(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asAmassFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.names)
      ? record.names
      : Array.isArray(record.assets)
        ? record.assets
        : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asAmassFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asAmassFinding(json);
  return single ? [single] : [];
}

function mapAmassText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const finding = asAmassFinding(JSON.parse(trimmed));
      if (finding) findings.push(finding);
    } catch {
      // skip summary / non-JSON lines
    }
  }
  return findings;
}

function amassFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapAmass(result.json);
  return mapped.length > 0 ? mapped : mapAmassText(result.text);
}

function asHorusecVuln(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const nested =
    rec.vulnerabilities &&
    typeof rec.vulnerabilities === "object" &&
    !Array.isArray(rec.vulnerabilities)
      ? (rec.vulnerabilities as Record<string, unknown>)
      : rec.vulnerability &&
          typeof rec.vulnerability === "object" &&
          !Array.isArray(rec.vulnerability)
        ? (rec.vulnerability as Record<string, unknown>)
        : rec;
  const file = typeof nested.file === "string" ? nested.file : null;
  const language = typeof nested.language === "string" ? nested.language : null;
  const severity = typeof nested.severity === "string" ? nested.severity : null;
  if (file === null && language === null && severity === null) return null;
  return { file, language, severity };
}

export function mapHorusec(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asHorusecVuln(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.analysisVulnerabilities)
    ? record.analysisVulnerabilities
    : Array.isArray(record.vulnerabilities)
      ? record.vulnerabilities
      : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const finding = asHorusecVuln(row);
    return finding ? [finding] : [];
  });
}

function asNaabuFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const host = typeof rec.host === "string" ? rec.host : null;
  const ip = typeof rec.ip === "string" ? rec.ip : null;
  const port =
    typeof rec.port === "number" && Number.isFinite(rec.port)
      ? rec.port
      : typeof rec.port === "string" && rec.port.trim().length > 0
        ? Number(rec.port)
        : null;
  const mappedPort =
    typeof port === "number" && Number.isFinite(port) ? port : null;
  if (host === null && ip === null && mappedPort === null) return null;
  return {
    host,
    ip,
    port: mappedPort,
    protocol: typeof rec.protocol === "string" ? rec.protocol : null
  };
}

export function mapNaabu(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asNaabuFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.ports)
      ? record.ports
      : Array.isArray(record.hosts)
        ? record.hosts
        : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asNaabuFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asNaabuFinding(json);
  return single ? [single] : [];
}

function mapNaabuText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const finding = asNaabuFinding(JSON.parse(trimmed));
      if (finding) findings.push(finding);
    } catch {
      // skip host:port text / log lines
    }
  }
  return findings;
}

function naabuFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapNaabu(result.json);
  return mapped.length > 0 ? mapped : mapNaabuText(result.text);
}

function tfsecStatusFailed(status: unknown): boolean {
  if (status === undefined || status === null) return true;
  if (status === 0 || status === "0") return true;
  if (typeof status === "string") {
    const normalized = status.toLowerCase();
    if (normalized === "failed" || normalized === "fail") return true;
    if (
      normalized === "passed" ||
      normalized === "pass" ||
      normalized === "ignored" ||
      normalized === "ignore"
    ) {
      return false;
    }
  }
  if (status === 1 || status === 2) return false;
  return true;
}

function asTfsecFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  if (!tfsecStatusFailed(rec.status)) return null;
  const location =
    rec.location && typeof rec.location === "object"
      ? (rec.location as Record<string, unknown>)
      : null;
  const filename =
    typeof location?.filename === "string"
      ? location.filename
      : typeof rec.filename === "string"
        ? rec.filename
        : null;
  const ruleId =
    typeof rec.rule_id === "string"
      ? rec.rule_id
      : typeof rec.long_id === "string"
        ? rec.long_id
        : null;
  const resource = typeof rec.resource === "string" ? rec.resource : null;
  const severity = typeof rec.severity === "string" ? rec.severity : null;
  if (ruleId === null && resource === null && filename === null) return null;
  return { filename, resource, ruleId, severity };
}

export function mapTfsec(json: unknown): Array<Record<string, unknown>> {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === "object"
      ? (json as { results?: unknown }).results
      : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const finding = asTfsecFinding(row);
    return finding ? [finding] : [];
  });
}

function asCfnNagViolation(
  row: unknown,
  filename: string | null
): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id : null;
  const type = typeof rec.type === "string" ? rec.type : null;
  const message = typeof rec.message === "string" ? rec.message : null;
  const ids = rec.logical_resource_ids;
  const resource =
    Array.isArray(ids) && typeof ids[0] === "string" ? ids[0] : null;
  const file = typeof rec.filename === "string" ? rec.filename : filename;
  if (id === null && message === null && resource === null) return null;
  return { filename: file, id, message, resource, type };
}

function mapCfnNagFileResults(
  fileResults: unknown,
  filename: string | null
): Array<Record<string, unknown>> {
  if (!fileResults || typeof fileResults !== "object") return [];
  const violations = (fileResults as { violations?: unknown }).violations;
  if (!Array.isArray(violations)) return [];
  return violations.flatMap((row) => {
    const finding = asCfnNagViolation(row, filename);
    return finding ? [finding] : [];
  });
}

export function mapCfnNag(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const rec = entry as {
        file_results?: unknown;
        filename?: unknown;
        violations?: unknown;
      };
      const filename = typeof rec.filename === "string" ? rec.filename : null;
      if (Array.isArray(rec.violations)) {
        return rec.violations.flatMap((row) => {
          const finding = asCfnNagViolation(row, filename);
          return finding ? [finding] : [];
        });
      }
      return mapCfnNagFileResults(rec.file_results, filename);
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as {
    file_results?: unknown;
    filename?: unknown;
    violations?: unknown;
  };
  const filename = typeof record.filename === "string" ? record.filename : null;
  if (Array.isArray(record.violations)) {
    return record.violations.flatMap((row) => {
      const finding = asCfnNagViolation(row, filename);
      return finding ? [finding] : [];
    });
  }
  return mapCfnNagFileResults(record.file_results, filename);
}

function asWhispersFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const file =
    typeof rec.file === "string"
      ? rec.file
      : typeof rec.filename === "string"
        ? rec.filename
        : null;
  const message = typeof rec.message === "string" ? rec.message : null;
  const severity = typeof rec.severity === "string" ? rec.severity : null;
  const line = typeof rec.line === "number" ? rec.line : null;
  if (file === null && message === null && severity === null) return null;
  return { file, line, message, severity };
}

export function mapWhispers(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asWhispersFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.secrets)
    ? record.secrets
    : Array.isArray(record.results)
      ? record.results
      : null;
  if (!Array.isArray(rows)) {
    const single = asWhispersFinding(json);
    return single ? [single] : [];
  }
  return rows.flatMap((row) => {
    const finding = asWhispersFinding(row);
    return finding ? [finding] : [];
  });
}

function mapWhispersText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const finding = asWhispersFinding(JSON.parse(trimmed));
      if (finding) findings.push(finding);
    } catch {
      // skip non-JSON lines
    }
  }
  return findings;
}

function whispersFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapWhispers(result.json);
  return mapped.length > 0 ? mapped : mapWhispersText(result.text);
}

function nancyCve(row: Record<string, unknown>): string | null {
  if (typeof row.Cve === "string" && row.Cve.length > 0) return row.Cve;
  if (typeof row.cve === "string" && row.cve.length > 0) return row.cve;
  return null;
}

function asNancyVuln(
  vuln: unknown,
  coordinates: string | null
): Record<string, unknown> | null {
  if (!vuln || typeof vuln !== "object") return null;
  const rec = vuln as Record<string, unknown>;
  const cve = nancyCve(rec);
  const title = typeof rec.Title === "string" ? rec.Title : null;
  const cvssScore =
    typeof rec.CvssScore === "string"
      ? rec.CvssScore
      : typeof rec.CvssScore === "number"
        ? String(rec.CvssScore)
        : null;
  if (coordinates === null && cve === null && title === null) return null;
  return { coordinates, cve, cvssScore, title };
}

function mapNancyPackages(rows: unknown[]): Array<Record<string, unknown>> {
  const findings: Array<Record<string, unknown>> = [];
  for (const pkg of rows) {
    if (!pkg || typeof pkg !== "object") continue;
    const rec = pkg as Record<string, unknown>;
    const coordinates =
      typeof rec.Coordinates === "string" ? rec.Coordinates : null;
    const vulns = rec.Vulnerabilities;
    if (!Array.isArray(vulns)) continue;
    for (const vuln of vulns) {
      const finding = asNancyVuln(vuln, coordinates);
      if (finding) findings.push(finding);
    }
  }
  return findings;
}

export function mapNancy(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return mapNancyPackages(json);
  }
  if (!json || typeof json !== "object") return [];
  const record = json as {
    audited?: unknown;
    vulnerable?: unknown;
  };
  if (Array.isArray(record.vulnerable)) {
    return mapNancyPackages(record.vulnerable);
  }
  if (Array.isArray(record.audited)) {
    return mapNancyPackages(record.audited);
  }
  return [];
}

function asSobelowFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const type = typeof rec.type === "string" ? rec.type : null;
  const file =
    typeof rec.file === "string"
      ? rec.file
      : typeof rec.filename === "string"
        ? rec.filename
        : null;
  const line = typeof rec.line === "number" ? rec.line : null;
  if (type === null && file === null) return null;
  return { file, line, type };
}

export function mapSobelow(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asSobelowFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const findings = (json as { findings?: unknown }).findings;
  if (Array.isArray(findings)) {
    return findings.flatMap((row) => {
      const finding = asSobelowFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!findings || typeof findings !== "object") return [];
  const groups = findings as Record<string, unknown>;
  const rows: unknown[] = [];
  for (const key of [
    "high_confidence",
    "medium_confidence",
    "low_confidence",
    "High",
    "Medium",
    "Low"
  ]) {
    if (Array.isArray(groups[key])) {
      rows.push(...(groups[key] as unknown[]));
    }
  }
  if (rows.length === 0) {
    for (const value of Object.values(groups)) {
      if (Array.isArray(value)) rows.push(...value);
    }
  }
  return rows.flatMap((row) => {
    const finding = asSobelowFinding(row);
    return finding ? [finding] : [];
  });
}

function polarisString(
  rec: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = rec[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function mapPolarisResultSet(
  resultSet: unknown,
  name: string | null,
  kind: string | null,
  namespace: string | null
): Array<Record<string, unknown>> {
  if (!resultSet || typeof resultSet !== "object" || Array.isArray(resultSet)) {
    return [];
  }
  const findings: Array<Record<string, unknown>> = [];
  for (const value of Object.values(resultSet as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const rec = value as Record<string, unknown>;
    if (rec.Success !== false && rec.success !== false) continue;
    const checkId = polarisString(rec, ["ID", "Id", "id"]);
    const severity = polarisString(rec, ["Severity", "severity"]);
    if (checkId === null && severity === null) continue;
    findings.push({ checkId, kind, name, namespace, severity });
  }
  return findings;
}

function mapPolarisWorkload(row: unknown): Array<Record<string, unknown>> {
  if (!row || typeof row !== "object") return [];
  const rec = row as Record<string, unknown>;
  const name = polarisString(rec, ["Name", "name"]);
  const kind = polarisString(rec, ["Kind", "kind"]);
  const namespace = polarisString(rec, ["Namespace", "namespace"]);
  const findings = [
    ...mapPolarisResultSet(rec.Results ?? rec.results, name, kind, namespace)
  ];
  const podResult =
    rec.PodResult && typeof rec.PodResult === "object"
      ? (rec.PodResult as Record<string, unknown>)
      : rec.podResult && typeof rec.podResult === "object"
        ? (rec.podResult as Record<string, unknown>)
        : null;
  if (!podResult) return findings;
  findings.push(
    ...mapPolarisResultSet(
      podResult.Results ?? podResult.results,
      name,
      kind,
      namespace
    )
  );
  const containers = podResult.ContainerResults ?? podResult.containerResults;
  if (!Array.isArray(containers)) return findings;
  for (const container of containers) {
    if (!container || typeof container !== "object") continue;
    const item = container as Record<string, unknown>;
    findings.push(
      ...mapPolarisResultSet(
        item.Results ?? item.results,
        name,
        kind,
        namespace
      )
    );
  }
  return findings;
}

export function mapPolaris(json: unknown): Array<Record<string, unknown>> {
  const rows = Array.isArray(json)
    ? json
    : json && typeof json === "object"
      ? ((json as { Results?: unknown; results?: unknown }).Results ??
        (json as { results?: unknown }).results)
      : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => mapPolarisWorkload(row));
}

function kubeauditIsFinding(severity: unknown): boolean {
  if (severity === undefined || severity === null) return true;
  if (typeof severity === "number") return severity >= 1;
  const normalized = String(severity).toLowerCase();
  return !(
    normalized === "info" ||
    normalized === "ok" ||
    normalized === "pass" ||
    normalized === "passed"
  );
}

function asKubeauditFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const severity = rec.level ?? rec.Severity ?? rec.severity;
  if (!kubeauditIsFinding(severity)) return null;
  const rule =
    typeof rec.AuditResultName === "string"
      ? rec.AuditResultName
      : typeof rec.Rule === "string"
        ? rec.Rule
        : typeof rec.rule === "string"
          ? rec.rule
          : null;
  const resource =
    typeof rec.ResourceName === "string"
      ? rec.ResourceName
      : typeof rec.name === "string"
        ? rec.name
        : null;
  const kind =
    typeof rec.ResourceKind === "string"
      ? rec.ResourceKind
      : typeof rec.kind === "string"
        ? rec.kind
        : null;
  const namespace =
    typeof rec.ResourceNamespace === "string"
      ? rec.ResourceNamespace
      : typeof rec.namespace === "string"
        ? rec.namespace
        : null;
  if (rule === null && resource === null) return null;
  return {
    kind,
    namespace,
    resource,
    rule,
    severity: typeof severity === "string" ? severity : null
  };
}

export function mapKubeaudit(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asKubeauditFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.AuditResults)
      ? record.AuditResults
      : Array.isArray(record.auditResults)
        ? record.auditResults
        : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asKubeauditFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asKubeauditFinding(json);
  return single ? [single] : [];
}

function mapKubeauditText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const finding = asKubeauditFinding(JSON.parse(trimmed));
      if (finding) findings.push(finding);
    } catch {
      // skip pretty/logrus text
    }
  }
  return findings;
}

function kubeauditFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapKubeaudit(result.json);
  return mapped.length > 0 ? mapped : mapKubeauditText(result.text);
}

function popeyeLevelIsFinding(level: unknown): boolean {
  if (typeof level === "number") return level >= 2;
  if (typeof level !== "string") return false;
  const normalized = level.toLowerCase();
  return (
    normalized === "warning" ||
    normalized === "warn" ||
    normalized === "error" ||
    normalized === "danger"
  );
}

function asPopeyeIssue(
  row: unknown,
  resource: string | null
): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  if (!popeyeLevelIsFinding(rec.level ?? rec.Level)) return null;
  const message =
    typeof rec.message === "string"
      ? rec.message
      : typeof rec.Message === "string"
        ? rec.Message
        : null;
  const gvr =
    typeof rec.gvr === "string"
      ? rec.gvr
      : typeof rec.GVR === "string"
        ? rec.GVR
        : null;
  if (message === null && resource === null) return null;
  return { gvr, message, resource };
}

function mapPopeyeIssueMap(issues: unknown): Array<Record<string, unknown>> {
  if (!issues || typeof issues !== "object") return [];
  if (Array.isArray(issues)) {
    return issues.flatMap((row) => {
      const finding = asPopeyeIssue(row, null);
      return finding ? [finding] : [];
    });
  }
  const findings: Array<Record<string, unknown>> = [];
  for (const [resource, rows] of Object.entries(
    issues as Record<string, unknown>
  )) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const finding = asPopeyeIssue(row, resource);
      if (finding) findings.push(finding);
    }
  }
  return findings;
}

function mapPopeyeSections(sections: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section) => {
    if (!section || typeof section !== "object") return [];
    const rec = section as Record<string, unknown>;
    return mapPopeyeIssueMap(
      rec.issues ?? rec.Issues ?? rec.outcome ?? rec.Outcome
    );
  });
}

export function mapPopeye(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return mapPopeyeSections(json);
  }
  if (!json || typeof json !== "object") return [];
  const root =
    (json as { popeye?: unknown }).popeye &&
    typeof (json as { popeye?: unknown }).popeye === "object"
      ? (json as { popeye: Record<string, unknown> }).popeye
      : (json as Record<string, unknown>);
  return mapPopeyeSections(
    root.sections ?? root.Sections ?? root.sanitizers ?? root.issues
  );
}

function asKatanaFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const request =
    rec.request && typeof rec.request === "object"
      ? (rec.request as Record<string, unknown>)
      : null;
  const response =
    rec.response && typeof rec.response === "object"
      ? (rec.response as Record<string, unknown>)
      : null;
  const endpoint =
    typeof request?.endpoint === "string"
      ? request.endpoint
      : typeof rec.endpoint === "string"
        ? rec.endpoint
        : typeof rec.url === "string"
          ? rec.url
          : null;
  const method =
    typeof request?.method === "string"
      ? request.method
      : typeof rec.method === "string"
        ? rec.method
        : null;
  const statusCode =
    typeof response?.status_code === "number"
      ? response.status_code
      : typeof rec.status_code === "number"
        ? rec.status_code
        : null;
  if (endpoint === null && method === null) return null;
  return { endpoint, method, statusCode };
}

export function mapKatana(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asKatanaFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.urls)
      ? record.urls
      : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asKatanaFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asKatanaFinding(json);
  return single ? [single] : [];
}

function mapKatanaText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const finding = asKatanaFinding(JSON.parse(trimmed));
      if (finding) findings.push(finding);
    } catch {
      // skip plain URL lines
    }
  }
  return findings;
}

function katanaFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapKatana(result.json);
  return mapped.length > 0 ? mapped : mapKatanaText(result.text);
}

function asCloudlistFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const provider = typeof rec.provider === "string" ? rec.provider : null;
  const id = typeof rec.id === "string" ? rec.id : null;
  const dnsName =
    typeof rec.dns_name === "string"
      ? rec.dns_name
      : typeof rec.dnsName === "string"
        ? rec.dnsName
        : null;
  const publicIpv4 =
    typeof rec.public_ipv4 === "string"
      ? rec.public_ipv4
      : typeof rec.publicIpv4 === "string"
        ? rec.publicIpv4
        : null;
  if (
    provider === null &&
    id === null &&
    dnsName === null &&
    publicIpv4 === null
  ) {
    return null;
  }
  return { dnsName, id, provider, publicIpv4 };
}

export function mapCloudlist(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asCloudlistFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.results)
      ? record.results
      : Array.isArray(record.assets)
        ? record.assets
        : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asCloudlistFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asCloudlistFinding(json);
  return single ? [single] : [];
}

function mapCloudlistText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const finding = asCloudlistFinding(JSON.parse(trimmed));
      if (finding) findings.push(finding);
    } catch {
      // skip host/IP text lines
    }
  }
  return findings;
}

function cloudlistFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapCloudlist(result.json);
  return mapped.length > 0 ? mapped : mapCloudlistText(result.text);
}

function asPipAuditVuln(
  vuln: unknown,
  name: string | null,
  version: string | null
): Record<string, unknown> | null {
  if (!vuln || typeof vuln !== "object") return null;
  const rec = vuln as Record<string, unknown>;
  const id = typeof rec.id === "string" ? rec.id : null;
  if (name === null && id === null) return null;
  return { id, name, version };
}

function mapPipAuditDeps(rows: unknown[]): Array<Record<string, unknown>> {
  const findings: Array<Record<string, unknown>> = [];
  for (const dep of rows) {
    if (!dep || typeof dep !== "object") continue;
    const rec = dep as Record<string, unknown>;
    const name = typeof rec.name === "string" ? rec.name : null;
    const version = typeof rec.version === "string" ? rec.version : null;
    if (!Array.isArray(rec.vulns)) continue;
    for (const vuln of rec.vulns) {
      const finding = asPipAuditVuln(vuln, name, version);
      if (finding) findings.push(finding);
    }
  }
  return findings;
}

export function mapPipAudit(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return mapPipAuditDeps(json);
  }
  if (!json || typeof json !== "object") return [];
  const dependencies = (json as { dependencies?: unknown }).dependencies;
  return Array.isArray(dependencies) ? mapPipAuditDeps(dependencies) : [];
}

function dockleLevelIsFinding(level: unknown): boolean {
  if (typeof level !== "string") return false;
  const normalized = level.toUpperCase();
  return normalized === "FATAL" || normalized === "WARN";
}

function asDockleFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  if (!dockleLevelIsFinding(rec.level)) return null;
  const code = typeof rec.code === "string" ? rec.code : null;
  const title = typeof rec.title === "string" ? rec.title : null;
  const level = typeof rec.level === "string" ? rec.level : null;
  if (code === null && title === null) return null;
  return { code, level, title };
}

export function mapDockle(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asDockleFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.details)
    ? record.details
    : Array.isArray(record.results)
      ? record.results
      : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const finding = asDockleFinding(row);
    return finding ? [finding] : [];
  });
}

function tlsxPort(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asTlsxFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  if (rec.probe_status === false) return null;
  const host = typeof rec.host === "string" ? rec.host : null;
  const ip = typeof rec.ip === "string" ? rec.ip : null;
  const port = tlsxPort(rec.port);
  const tlsVersion =
    typeof rec.tls_version === "string"
      ? rec.tls_version
      : typeof rec.tlsVersion === "string"
        ? rec.tlsVersion
        : null;
  if (host === null && ip === null && port === null) return null;
  return { host, ip, port, tlsVersion };
}

export function mapTlsx(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asTlsxFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.hosts)
      ? record.hosts
      : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asTlsxFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asTlsxFinding(json);
  return single ? [single] : [];
}

function mapTlsxText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const finding = asTlsxFinding(JSON.parse(trimmed));
      if (finding) findings.push(finding);
    } catch {
      // skip host:port text
    }
  }
  return findings;
}

function tlsxFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapTlsx(result.json);
  return mapped.length > 0 ? mapped : mapTlsxText(result.text);
}

function kubeScoreGradeIsFinding(grade: unknown, skipped: unknown): boolean {
  if (skipped === true) return false;
  if (typeof grade === "number") return grade === 1 || grade === 5;
  if (typeof grade !== "string") return false;
  const normalized = grade.toLowerCase();
  return (
    normalized === "critical" ||
    normalized === "warning" ||
    normalized === "warn"
  );
}

function kubeScoreMetaName(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const name = (meta as { name?: unknown }).name;
  return typeof name === "string" ? name : null;
}

function kubeScoreMetaKind(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const kind = (meta as { kind?: unknown }).kind;
  return typeof kind === "string" ? kind : null;
}

function mapKubeScoreChecks(
  checks: unknown,
  objectName: string | null,
  kind: string | null
): Array<Record<string, unknown>> {
  if (!Array.isArray(checks)) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const row of checks) {
    if (!row || typeof row !== "object") continue;
    const rec = row as Record<string, unknown>;
    if (!kubeScoreGradeIsFinding(rec.grade, rec.skipped)) continue;
    const check =
      rec.check && typeof rec.check === "object"
        ? (rec.check as Record<string, unknown>)
        : rec;
    const checkId =
      typeof check.id === "string"
        ? check.id
        : typeof rec.id === "string"
          ? rec.id
          : null;
    const checkName =
      typeof check.name === "string"
        ? check.name
        : typeof rec.name === "string"
          ? rec.name
          : null;
    if (checkId === null && checkName === null && objectName === null) continue;
    findings.push({
      checkId,
      checkName,
      grade: typeof rec.grade === "number" ? rec.grade : (rec.grade ?? null),
      kind,
      objectName
    });
  }
  return findings;
}

function mapKubeScoreObject(row: unknown): Array<Record<string, unknown>> {
  if (!row || typeof row !== "object") return [];
  const rec = row as Record<string, unknown>;
  const objectName =
    kubeScoreMetaName(rec.object_meta ?? rec.objectMeta) ??
    (typeof rec.object_name === "string" ? rec.object_name : null) ??
    (typeof rec.name === "string" ? rec.name : null);
  const kind =
    kubeScoreMetaKind(rec.type_meta ?? rec.typeMeta) ??
    (typeof rec.kind === "string" ? rec.kind : null);
  return mapKubeScoreChecks(rec.checks, objectName, kind);
}

export function mapKubeScore(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => mapKubeScoreObject(row));
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.objects)
    ? record.objects
    : Array.isArray(record.results)
      ? record.results
      : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => mapKubeScoreObject(row));
  }
  return mapKubeScoreObject(json);
}

function mapConftestFile(row: unknown): Array<Record<string, unknown>> {
  if (!row || typeof row !== "object") return [];
  const rec = row as Record<string, unknown>;
  const filename =
    typeof rec.filename === "string"
      ? rec.filename
      : typeof rec.file === "string"
        ? rec.file
        : null;
  const namespace = typeof rec.namespace === "string" ? rec.namespace : null;
  if (!Array.isArray(rec.failures)) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const failure of rec.failures) {
    if (!failure || typeof failure !== "object") continue;
    findings.push({ filename, namespace });
  }
  return findings;
}

export function mapConftest(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => mapConftestFile(row));
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.files)
      ? record.files
      : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => mapConftestFile(row));
  }
  return mapConftestFile(json);
}

function asCdxgenComponent(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const name = typeof rec.name === "string" ? rec.name : null;
  const version = typeof rec.version === "string" ? rec.version : null;
  const type = typeof rec.type === "string" ? rec.type : null;
  const purl = typeof rec.purl === "string" ? rec.purl : null;
  if (name === null && purl === null) return null;
  return { name, purl, type, version };
}

export function mapCdxgen(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asCdxgenComponent(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const components = (json as { components?: unknown }).components;
  if (!Array.isArray(components)) return [];
  return components.flatMap((row) => {
    const finding = asCdxgenComponent(row);
    return finding ? [finding] : [];
  });
}

function gitSecretsLine(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseGitSecretsLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/^\[(ERROR|WARNING)\]/i.test(trimmed)) return null;
  if (/^Possible mitigations:/i.test(trimmed)) return null;
  if (/^- /.test(trimmed)) return null;
  const match = /^(.+):(\d+):(.*)$/.exec(trimmed);
  if (!match) return null;
  return { filename: match[1], line: Number(match[2]) };
}

function asGitSecretsFinding(row: unknown): Record<string, unknown> | null {
  if (typeof row === "string") {
    return parseGitSecretsLine(row);
  }
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const filename =
    typeof rec.filename === "string"
      ? rec.filename
      : typeof rec.file === "string"
        ? rec.file
        : null;
  const line = gitSecretsLine(rec.line ?? rec.lineNumber ?? rec.line_number);
  if (filename === null && line === null) return null;
  return { filename, line };
}

export function mapGitSecrets(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asGitSecretsFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.matches)
    ? record.matches
    : Array.isArray(record.results)
      ? record.results
      : Array.isArray(record.findings)
        ? record.findings
        : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asGitSecretsFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asGitSecretsFinding(json);
  return single ? [single] : [];
}

function mapGitSecretsText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const finding = parseGitSecretsLine(line);
    if (finding) findings.push(finding);
  }
  return findings;
}

function gitSecretsFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapGitSecrets(result.json);
  return mapped.length > 0 ? mapped : mapGitSecretsText(result.text);
}

function secretlintSeverityIsFinding(severity: unknown): boolean {
  if (severity === undefined || severity === null) return true;
  if (typeof severity === "number") return severity >= 1;
  if (typeof severity !== "string") return false;
  const normalized = severity.toLowerCase();
  return (
    normalized === "error" ||
    normalized === "warning" ||
    normalized === "warn" ||
    normalized === "2" ||
    normalized === "1"
  );
}

function asSecretlintMessage(
  message: unknown,
  filePath: string | null
): Record<string, unknown> | null {
  if (!message || typeof message !== "object") return null;
  const rec = message as Record<string, unknown>;
  if (!secretlintSeverityIsFinding(rec.severity)) return null;
  const ruleId =
    typeof rec.ruleId === "string"
      ? rec.ruleId
      : typeof rec.rule_id === "string"
        ? rec.rule_id
        : null;
  const loc =
    rec.loc && typeof rec.loc === "object"
      ? (rec.loc as { start?: { line?: unknown } }).start
      : undefined;
  const line =
    typeof rec.line === "number"
      ? rec.line
      : typeof loc?.line === "number"
        ? loc.line
        : null;
  if (filePath === null && ruleId === null) return null;
  return { filePath, line, ruleId };
}

function mapSecretlintFile(row: unknown): Array<Record<string, unknown>> {
  if (!row || typeof row !== "object") return [];
  const rec = row as Record<string, unknown>;
  const filePath =
    typeof rec.filePath === "string"
      ? rec.filePath
      : typeof rec.file === "string"
        ? rec.file
        : typeof rec.filename === "string"
          ? rec.filename
          : null;
  if (!Array.isArray(rec.messages)) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const message of rec.messages) {
    const finding = asSecretlintMessage(message, filePath);
    if (finding) findings.push(finding);
  }
  return findings;
}

export function mapSecretlint(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => mapSecretlintFile(row));
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.files)
      ? record.files
      : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => mapSecretlintFile(row));
  }
  return mapSecretlintFile(json);
}

function retireJsAdvisoryId(
  identifiers: unknown,
  fallback: unknown
): string | null {
  if (typeof fallback === "string" && fallback.length > 0) return fallback;
  if (!identifiers || typeof identifiers !== "object") return null;
  const rec = identifiers as Record<string, unknown>;
  const cve = rec.CVE ?? rec.cve;
  if (typeof cve === "string" && cve.length > 0) return cve;
  if (Array.isArray(cve) && typeof cve[0] === "string") return cve[0];
  return typeof rec.issue === "string" ? rec.issue : null;
}

function mapRetireJsResult(
  row: unknown,
  file: string | null
): Array<Record<string, unknown>> {
  if (!row || typeof row !== "object") return [];
  const rec = row as Record<string, unknown>;
  if (!Array.isArray(rec.vulnerabilities)) return [];
  const component =
    typeof rec.component === "string"
      ? rec.component
      : typeof rec.name === "string"
        ? rec.name
        : null;
  const version = typeof rec.version === "string" ? rec.version : null;
  const findings: Array<Record<string, unknown>> = [];
  for (const vuln of rec.vulnerabilities) {
    if (!vuln || typeof vuln !== "object") continue;
    const item = vuln as Record<string, unknown>;
    const id = retireJsAdvisoryId(item.identifiers, item.id);
    if (component === null && id === null) continue;
    findings.push({
      component,
      file,
      id,
      severity: typeof item.severity === "string" ? item.severity : null,
      version
    });
  }
  return findings;
}

function mapRetireJsFile(row: unknown): Array<Record<string, unknown>> {
  if (!row || typeof row !== "object") return [];
  const rec = row as Record<string, unknown>;
  const file =
    typeof rec.file === "string"
      ? rec.file
      : typeof rec.fileName === "string"
        ? rec.fileName
        : typeof rec.path === "string"
          ? rec.path
          : null;
  const results = rec.results ?? rec.components;
  if (Array.isArray(results)) {
    return results.flatMap((result) => mapRetireJsResult(result, file));
  }
  return mapRetireJsResult(row, file);
}

export function mapRetireJs(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => mapRetireJsFile(row));
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.data)
    ? record.data
    : Array.isArray(record.results)
      ? record.results
      : Array.isArray(record.files)
        ? record.files
        : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => mapRetireJsFile(row));
  }
  return mapRetireJsFile(json);
}

function parseJsonStream(text?: string): unknown[] {
  if (!text) return [];
  const items: unknown[] = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    const start = remaining.search(/[{[]/);
    if (start < 0) break;
    remaining = remaining.slice(start);
    try {
      items.push(JSON.parse(remaining));
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const match = /position\s+(\d+)/i.exec(message);
      if (!match) break;
      const end = Number(match[1]);
      if (!Number.isFinite(end) || end <= 0) break;
      try {
        items.push(JSON.parse(remaining.slice(0, end)));
        remaining = remaining.slice(end).trim();
      } catch {
        break;
      }
    }
  }
  return items;
}

function asGovulncheckFinding(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  if (rec.finding && typeof rec.finding === "object") {
    return asGovulncheckFinding(rec.finding);
  }
  if (rec.config || rec.progress || rec.SBOM) return null;
  if (rec.osv && typeof rec.osv === "object") return null;
  const osv = typeof rec.osv === "string" ? rec.osv : null;
  if (osv === null) return null;
  const frame =
    Array.isArray(rec.trace) && rec.trace[0] && typeof rec.trace[0] === "object"
      ? (rec.trace[0] as Record<string, unknown>)
      : {};
  return {
    module: typeof frame.module === "string" ? frame.module : null,
    osv,
    package: typeof frame.package === "string" ? frame.package : null,
    version: typeof frame.version === "string" ? frame.version : null
  };
}

export function mapGovulncheck(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asGovulncheckFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.findings)
    ? record.findings
    : Array.isArray(record.results)
      ? record.results
      : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asGovulncheckFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asGovulncheckFinding(json);
  return single ? [single] : [];
}

function mapGovulncheckText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const finding = asGovulncheckFinding(JSON.parse(trimmed));
      if (finding) findings.push(finding);
    } catch {
      // pretty-printed stream is handled below
    }
  }
  if (findings.length > 0) return findings;
  return mapGovulncheck(parseJsonStream(text));
}

function govulncheckFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapGovulncheck(result.json);
  return mapped.length > 0 ? mapped : mapGovulncheckText(result.text);
}

function asCargoAuditVuln(row: unknown): Record<string, unknown> | null {
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  const advisory =
    rec.advisory && typeof rec.advisory === "object"
      ? (rec.advisory as Record<string, unknown>)
      : rec;
  const pkg =
    rec.package && typeof rec.package === "object"
      ? (rec.package as Record<string, unknown>)
      : rec;
  const id =
    typeof advisory.id === "string"
      ? advisory.id
      : typeof rec.id === "string"
        ? rec.id
        : null;
  const name =
    typeof pkg.name === "string"
      ? pkg.name
      : typeof rec.name === "string"
        ? rec.name
        : null;
  const version =
    typeof pkg.version === "string"
      ? pkg.version
      : typeof rec.version === "string"
        ? rec.version
        : null;
  if (id === null && name === null) return null;
  return { id, name, version };
}

function mapCargoAuditList(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.flatMap((row) => {
    const finding = asCargoAuditVuln(row);
    return finding ? [finding] : [];
  });
}

export function mapCargoAudit(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return mapCargoAuditList(json);
  }
  if (!json || typeof json !== "object") return [];
  const record = json as { vulnerabilities?: unknown };
  if (Array.isArray(record.vulnerabilities)) {
    return mapCargoAuditList(record.vulnerabilities);
  }
  if (record.vulnerabilities && typeof record.vulnerabilities === "object") {
    const list = (record.vulnerabilities as { list?: unknown }).list;
    return Array.isArray(list) ? mapCargoAuditList(list) : [];
  }
  return [];
}

function kubescapeStatusIsFinding(status: unknown): boolean {
  const value =
    typeof status === "string"
      ? status
      : status && typeof status === "object"
        ? ((
            status as {
              status?: unknown;
              Status?: unknown;
              innerStatus?: unknown;
            }
          ).status ??
          (status as { Status?: unknown }).Status ??
          (status as { innerStatus?: unknown }).innerStatus)
        : null;
  if (typeof value !== "string") return false;
  const normalized = value.toLowerCase();
  return (
    normalized === "failed" || normalized === "fail" || normalized === "error"
  );
}

function mapKubescapeControls(
  controls: unknown,
  resourceID: string | null,
  resourceName: string | null
): Array<Record<string, unknown>> {
  if (!Array.isArray(controls)) return [];
  const findings: Array<Record<string, unknown>> = [];
  for (const control of controls) {
    if (!control || typeof control !== "object") continue;
    const rec = control as Record<string, unknown>;
    if (!kubescapeStatusIsFinding(rec.status ?? rec.Status)) continue;
    const controlID =
      typeof rec.controlID === "string"
        ? rec.controlID
        : typeof rec.controlId === "string"
          ? rec.controlId
          : typeof rec.id === "string"
            ? rec.id
            : null;
    const name =
      typeof rec.name === "string"
        ? rec.name
        : typeof rec.controlName === "string"
          ? rec.controlName
          : null;
    if (controlID === null && name === null) continue;
    findings.push({ controlID, name, resourceID, resourceName });
  }
  return findings;
}

function mapKubescapeResource(row: unknown): Array<Record<string, unknown>> {
  if (!row || typeof row !== "object") return [];
  const rec = row as Record<string, unknown>;
  const resourceID =
    typeof rec.resourceID === "string"
      ? rec.resourceID
      : typeof rec.resourceId === "string"
        ? rec.resourceId
        : typeof rec.ResourceID === "string"
          ? rec.ResourceID
          : null;
  const resourceName =
    typeof rec.resourceName === "string"
      ? rec.resourceName
      : typeof rec.name === "string"
        ? rec.name
        : null;
  return mapKubescapeControls(
    rec.controls ?? rec.AssociatedControls ?? rec.resourceAssociatedControls,
    resourceID,
    resourceName
  );
}

export function mapKubescape(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => mapKubescapeResource(row));
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.resourcesResults)
      ? record.resourcesResults
      : Array.isArray(record.ResourcesResults)
        ? record.ResourcesResults
        : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => mapKubescapeResource(row));
  }
  return mapKubescapeResource(json);
}

function slsaStatusIsFinding(status: unknown): boolean {
  if (typeof status !== "string") return false;
  const normalized = status.trim().toUpperCase();
  return normalized === "FAILED" || normalized === "FAIL";
}

function parseSlsaLine(line: string): Record<string, unknown> | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  if (/\bPASSED\b/i.test(trimmed) && !/\bFAILED\b/i.test(trimmed)) return null;
  const artifactMatch =
    /^Verifying artifact\s+(.+?):\s+FAILED(?:\s*:.*)?$/i.exec(trimmed);
  if (artifactMatch) {
    return { artifact: artifactMatch[1], status: "FAILED" };
  }
  if (/^FAILED:/i.test(trimmed)) {
    return { artifact: null, status: "FAILED" };
  }
  return null;
}

function asSlsaFinding(row: unknown): Record<string, unknown> | null {
  if (typeof row === "string") {
    return parseSlsaLine(row);
  }
  if (!row || typeof row !== "object") return null;
  const rec = row as Record<string, unknown>;
  if (
    !slsaStatusIsFinding(
      rec.status ??
        rec.result ??
        rec.verificationResult ??
        rec.verification_result
    )
  ) {
    return null;
  }
  const artifact =
    typeof rec.artifact === "string"
      ? rec.artifact
      : typeof rec.name === "string"
        ? rec.name
        : typeof rec.path === "string"
          ? rec.path
          : null;
  return { artifact, status: "FAILED" };
}

export function mapSlsaVerifier(json: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(json)) {
    return json.flatMap((row) => {
      const finding = asSlsaFinding(row);
      return finding ? [finding] : [];
    });
  }
  if (!json || typeof json !== "object") return [];
  const record = json as Record<string, unknown>;
  const rows = Array.isArray(record.results)
    ? record.results
    : Array.isArray(record.findings)
      ? record.findings
      : Array.isArray(record.artifacts)
        ? record.artifacts
        : null;
  if (Array.isArray(rows)) {
    return rows.flatMap((row) => {
      const finding = asSlsaFinding(row);
      return finding ? [finding] : [];
    });
  }
  const single = asSlsaFinding(json);
  return single ? [single] : [];
}

function mapSlsaVerifierText(text?: string): Array<Record<string, unknown>> {
  if (!text) return [];
  const perArtifact: Array<Record<string, unknown>> = [];
  const summaries: Array<Record<string, unknown>> = [];
  for (const line of text.split("\n")) {
    const finding = parseSlsaLine(line);
    if (!finding) continue;
    if (finding.artifact) perArtifact.push(finding);
    else summaries.push(finding);
  }
  return perArtifact.length > 0 ? perArtifact : summaries;
}

function slsaVerifierFindings(result: {
  json?: unknown;
  text?: string;
}): Array<Record<string, unknown>> {
  const mapped = mapSlsaVerifier(result.json);
  return mapped.length > 0 ? mapped : mapSlsaVerifierText(result.text);
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
  return result.text.split("\n").filter((line) => line.trim().length > 0)
    .length;
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

function countKingfisher(json: unknown): number {
  if (Array.isArray(json)) return json.length;
  if (!json || typeof json !== "object") return 0;
  const record = json as Record<string, unknown>;
  for (const key of ["findings", "Findings", "matches", "results"]) {
    if (Array.isArray(record[key])) return (record[key] as unknown[]).length;
  }
  return countNumericOrIssues(json);
}

function countKyverno(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  const record = json as {
    results?: Array<{ result?: string }>;
    summary?: { fail?: number };
  };
  if (typeof record.summary?.fail === "number") return record.summary.fail;
  if (Array.isArray(record.results)) {
    return record.results.filter(
      (row) => row.result === "fail" || row.result === "error"
    ).length;
  }
  return countNumericOrIssues(json);
}

function countInspec(json: unknown): number {
  if (!json || typeof json !== "object") return 0;
  const profiles = (
    json as {
      profiles?: Array<{
        controls?: Array<{ results?: Array<{ status?: string }> }>;
      }>;
    }
  ).profiles;
  if (!Array.isArray(profiles)) return countNumericOrIssues(json);
  let failed = 0;
  for (const profile of profiles) {
    for (const control of profile.controls ?? []) {
      for (const result of control.results ?? []) {
        if (result.status === "failed") failed += 1;
      }
    }
  }
  return failed;
}

function repoHasIamPolicyDocument(repositoryPath: string): boolean {
  const visit = (dir: string, depth: number): boolean => {
    if (depth > 4) return false;
    let entries: string[];
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

function requireFiles(files: string[], tool: string): PopularOssSpec["skip"] {
  return ({ fixtureMode, repositoryPath }) => {
    if (fixtureMode || !repositoryPath) return null;
    if (repoHasAny(repositoryPath, files)) return null;
    return `${tool} skipped: none of ${files.join(", ")} present in the authorized repository.`;
  };
}

export const COMMUNITY_POPULAR_OSS_SPECS: readonly PopularOssSpec[] = [
  {
    args: ({ scanRoot }) => ["config", "--format", "json", "--quiet", scanRoot],
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
    fixtureFile: "detect-secrets/detect-secrets-fixture.json",
    findings: (result) => mapDetectSecrets(result.json),
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
    count: (result) =>
      mapBandit(result.json).length || countArray(result.json, ["results"]),
    description: "Runs Bandit AST checks on an authorized Python repository.",
    executionMode: "ControlPlane",
    fixtureFile: "bandit/bandit-fixture.json",
    findings: (result) => mapBandit(result.json),
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
    skip: requireFiles(
      ["pyproject.toml", "setup.py", "requirements.txt"],
      "Bandit"
    ),
    timeoutSeconds: 120,
    toolId: "bandit",
    toolName: "Bandit"
  },
  {
    args: () => ["-d", ".", "-o", "json", "--quiet"],
    capabilityName: "IaC Posture Validation",
    count: (result) => mapCheckov(result.json).length,
    description:
      "Runs Checkov against Terraform/K8s/Dockerfile in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "checkov/checkov-fixture.json",
    findings: (result) => mapCheckov(result.json),
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
    count: (result) => mapPipAudit(result.json).length,
    description:
      "Runs pip-audit against an authorized repository lockfile or environment.",
    executionMode: "ControlPlane",
    fixtureFile: "pip-audit/pip-audit-fixture.json",
    findings: (result) => mapPipAudit(result.json),
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
    count: (result) => mapDockle(result.json).length,
    description:
      "Runs Dockle against a Dockerfile in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "dockle/dockle-fixture.json",
    findings: (result) => mapDockle(result.json),
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
    count: (result) => tlsxFindings(result).length,
    description:
      "Runs tlsx against a verified hostname. Handshake inventory only.",
    executionMode: "InternalRunner",
    fixtureFile: "tlsx/tlsx-fixture.json",
    findings: (result) => tlsxFindings(result),
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
    count: (result) => naabuFindings(result).length,
    description:
      "Runs naabu connect-scan inventory on verified host or CIDR. Not an exploit scanner.",
    executionMode: "InternalRunner",
    fixtureFile: "naabu/naabu-fixture.json",
    findings: (result) => naabuFindings(result),
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
    count: (result) => mapGosec(result.json).length || countGosec(result.json),
    description: "Runs gosec against an authorized Go repository.",
    executionMode: "ControlPlane",
    fixtureFile: "gosec/gosec-fixture.json",
    findings: (result) => mapGosec(result.json),
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
    args: ({ scanRoot }) => ["lint", "--format", "json", scanRoot],
    capabilityName: "Kubernetes Manifest Validation",
    count: (result) => countKubeLinter(result.json) || countTextLines(result),
    description:
      "Runs KubeLinter on Kubernetes YAML/Helm in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "kube-linter/kube-linter-fixture.json",
    findings: (result) => mapKubeLinter(result.json),
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
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (repoHasExtension(repositoryPath, [".yaml", ".yml"])) return null;
      return "KubeLinter skipped: no Kubernetes YAML or Helm charts in the authorized repository.";
    },
    timeoutSeconds: 90,
    toolId: "kube-linter",
    toolName: "KubeLinter"
  },
  {
    args: ({ scanRoot }) => ["scan", "-d", scanRoot, "-o", "json"],
    capabilityName: "IaC Posture Validation",
    count: (result) => mapTerrascan(result.json).length,
    description: "Runs Terrascan against IaC in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "terrascan/terrascan-fixture.json",
    findings: (result) => mapTerrascan(result.json),
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
    args: ({ scanRoot }) => [
      "scan",
      "-p",
      scanRoot,
      "--report-formats",
      "json"
    ],
    capabilityName: "IaC Posture Validation",
    count: (result) => mapKics(result.json).length,
    description: "Runs Checkmarx KICS against IaC in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "kics/kics-fixture.json",
    findings: (result) => mapKics(result.json),
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
    count: (result) => mapKubeScore(result.json).length,
    description:
      "Runs kube-score against Kubernetes manifests in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "kube-score/kube-score-fixture.json",
    findings: (result) => mapKubeScore(result.json),
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
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (repoHasExtension(repositoryPath, [".yaml", ".yml"])) return null;
      return "kube-score skipped: no Kubernetes YAML in the authorized repository.";
    },
    timeoutSeconds: 90,
    toolId: "kube-score",
    toolName: "kube-score"
  },
  {
    args: () => ["--json"],
    capabilityName: "Kubernetes CIS Cluster Validation",
    count: (result) => mapKubeBench(result.json).length,
    description:
      "Runs kube-bench CIS checks when a cluster kubeconfig is available. Not a live exploit.",
    executionMode: "ControlPlane",
    fixtureFile: "kube-bench/kube-bench-fixture.json",
    findings: (result) => mapKubeBench(result.json),
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
        : existsSync(
              process.env.KUBECONFIG ?? `${process.env.HOME ?? ""}/.kube/config`
            )
          ? null
          : "kube-bench skipped: no kubeconfig available on this execution host.",
    timeoutSeconds: 180,
    toolId: "kube-bench",
    toolName: "kube-bench"
  },
  {
    args: ({ scanRoot }) => ["test", scanRoot, "-o", "json"],
    capabilityName: "OPA Policy Test",
    count: (result) => mapConftest(result.json).length,
    description:
      "Runs Conftest against an authorized repository when a policy/ directory is present.",
    executionMode: "ControlPlane",
    fixtureFile: "conftest/conftest-fixture.json",
    findings: (result) => mapConftest(result.json),
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
    count: (result) => mapCdxgen(result.json).length,
    description:
      "Generates a CycloneDX SBOM from an authorized repository with cdxgen.",
    executionMode: "InternalRunner",
    fixtureFile: "cdxgen/cdxgen-fixture.json",
    findings: (result) => mapCdxgen(result.json),
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
    count: (result) => gitSecretsFindings(result).length,
    description: "Runs AWS git-secrets against an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "git-secrets/git-secrets-fixture.json",
    findings: (result) => gitSecretsFindings(result),
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
    args: () => ["--format", "json", "**/*"],
    capabilityName: "Repository Secret Validation",
    count: (result) => mapSecretlint(result.json).length,
    description: "Runs secretlint against an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "secretlint/secretlint-fixture.json",
    findings: (result) => mapSecretlint(result.json),
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
    count: (result) => mapRetireJs(result.json).length,
    description:
      "Runs retire.js against JavaScript dependencies in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "retirejs/retirejs-fixture.json",
    findings: (result) => mapRetireJs(result.json),
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
    skip: requireFiles(
      ["package.json", "package-lock.json", "yarn.lock"],
      "retire.js"
    ),
    timeoutSeconds: 120,
    toolId: "retirejs",
    toolName: "retire.js"
  },
  {
    args: () => ["-json", "./..."],
    capabilityName: "Go Advisory Validation",
    count: (result) => govulncheckFindings(result).length,
    description: "Runs govulncheck against an authorized Go module.",
    executionMode: "ControlPlane",
    fixtureFile: "govulncheck/govulncheck-fixture.json",
    findings: (result) => govulncheckFindings(result),
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
    count: (result) => mapCargoAudit(result.json).length,
    description: "Runs cargo-audit against an authorized Rust lockfile.",
    executionMode: "ControlPlane",
    fixtureFile: "cargo-audit/cargo-audit-fixture.json",
    findings: (result) => mapCargoAudit(result.json),
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
    count: (result) => yaraFindings(result).length,
    description:
      "Runs YARA against an authorized repository when .yar/.yara rules are present.",
    executionMode: "ControlPlane",
    fixtureFile: "yara/yara-fixture.json",
    findings: (result) => yaraFindings(result),
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
    count: (result) => amassFindings(result).length,
    description:
      "Runs OWASP Amass in passive mode against a verified domain. Not an exploit scanner.",
    executionMode: "InternalRunner",
    fixtureFile: "amass/amass-fixture.json",
    findings: (result) => amassFindings(result),
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
    args: ({ scanRoot }) => ["--validate", scanRoot, "-o", "json_output=true"],
    capabilityName: "Falco Rules Validation",
    count: (result) => falcoFindings(result).length,
    description:
      "Validates Falco rules in an authorized repository. Does not attach to a live kernel.",
    executionMode: "ControlPlane",
    fixtureFile: "falco/falco-fixture.json",
    findings: (result) => falcoFindings(result),
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
    count: (result) => mapKubescape(result.json).length,
    description:
      "Runs Kubescape against Kubernetes manifests in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "kubescape/kubescape-fixture.json",
    findings: (result) => mapKubescape(result.json),
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
    count: (result) => slsaVerifierFindings(result).length,
    description:
      "Runs slsa-verifier when provenance is present in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "slsa-verifier/slsa-verifier-fixture.json",
    findings: (result) => slsaVerifierFindings(result),
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
    count: (result) => mapBrakeman(result.json).length,
    description: "Runs Brakeman against an authorized Rails repository.",
    executionMode: "ControlPlane",
    fixtureFile: "brakeman/brakeman-fixture.json",
    findings: (result) => mapBrakeman(result.json),
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
    count: (result) => mapHorusec(result.json).length,
    description: "Runs Horusec against an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "horusec/horusec-fixture.json",
    findings: (result) => mapHorusec(result.json),
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
    count: (result) => mapDependencyCheck(result.json).length,
    description: "Runs OWASP Dependency-Check on an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "dependency-check/dependency-check-fixture.json",
    findings: (result) => mapDependencyCheck(result.json),
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
    count: (result) => mapTalisman(result.json).length,
    description: "Runs Talisman against an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "talisman/talisman-fixture.json",
    findings: (result) => mapTalisman(result.json),
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
    count: (result) => mapTfsec(result.json).length,
    description: "Runs tfsec against Terraform in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "tfsec/tfsec-fixture.json",
    findings: (result) => mapTfsec(result.json),
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
    timeoutSeconds: 180,
    toolId: "tfsec",
    toolName: "tfsec"
  },
  {
    args: ({ scanRoot }) => [
      "--input-path",
      scanRoot,
      "--output-format",
      "json"
    ],
    capabilityName: "cfn-nag CloudFormation",
    count: (result) => mapCfnNag(result.json).length,
    description:
      "Runs cfn-nag against CloudFormation in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "cfn-nag/cfn-nag-fixture.json",
    findings: (result) => mapCfnNag(result.json),
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
    skip: requireFiles(
      ["template.yaml", "template.yml", "template.json"],
      "cfn-nag"
    ),
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
    count: (result) => whispersFindings(result).length,
    description: "Runs Whispers against an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "whispers/whispers-fixture.json",
    findings: (result) => whispersFindings(result),
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
    args: () => ["sleuth", "-o", "json", "go.sum"],
    capabilityName: "Nancy Go advisories",
    count: (result) => mapNancy(result.json).length,
    description: "Runs Nancy against go.sum in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "nancy/nancy-fixture.json",
    findings: (result) => mapNancy(result.json),
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
    args: () => ["sobelow", "--format", "json"],
    capabilityName: "Sobelow Elixir SAST",
    count: (result) => mapSobelow(result.json).length,
    description: "Runs Sobelow against an authorized Elixir repository.",
    executionMode: "ControlPlane",
    fixtureFile: "sobelow/sobelow-fixture.json",
    findings: (result) => mapSobelow(result.json),
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
    args: ({ scanRoot }) => [
      "audit",
      "--audit-path",
      scanRoot,
      "--format",
      "json"
    ],
    capabilityName: "Polaris Kubernetes posture",
    count: (result) => mapPolaris(result.json).length,
    description: "Runs Polaris audit against Kubernetes manifests.",
    executionMode: "ControlPlane",
    fixtureFile: "polaris/polaris-fixture.json",
    findings: (result) => mapPolaris(result.json),
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
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (repoHasExtension(repositoryPath, [".yaml", ".yml"])) return null;
      return "Polaris skipped: no Kubernetes YAML in the authorized repository.";
    },
    timeoutSeconds: 120,
    toolId: "polaris",
    toolName: "Polaris"
  },
  {
    args: ({ scanRoot }) => ["all", "-f", scanRoot, "--format", "json"],
    capabilityName: "kubeaudit posture",
    count: (result) => kubeauditFindings(result).length,
    description: "Runs kubeaudit against Kubernetes manifests.",
    executionMode: "ControlPlane",
    fixtureFile: "kubeaudit/kubeaudit-fixture.json",
    findings: (result) => kubeauditFindings(result),
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
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (repoHasExtension(repositoryPath, [".yaml", ".yml"])) return null;
      return "kubeaudit skipped: no Kubernetes YAML in the authorized repository.";
    },
    timeoutSeconds: 90,
    toolId: "kubeaudit",
    toolName: "kubeaudit"
  },
  {
    args: () => ["-o", "json"],
    capabilityName: "Popeye cluster sanitizer",
    count: (result) => mapPopeye(result.json).length,
    description: "Runs Popeye when kubeconfig is present.",
    executionMode: "ControlPlane",
    fixtureFile: "popeye/popeye-fixture.json",
    findings: (result) => mapPopeye(result.json),
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
        : existsSync(
              process.env.KUBECONFIG ?? `${process.env.HOME ?? ""}/.kube/config`
            )
          ? null
          : "Popeye skipped: no kubeconfig on this execution host.",
    timeoutSeconds: 180,
    toolId: "popeye",
    toolName: "Popeye"
  },
  {
    args: ({ host }) => ["-u", host, "-silent", "-json", "-d", "2"],
    capabilityName: "Katana crawl inventory",
    count: (result) => katanaFindings(result).length,
    description:
      "Crawls a verified hostname with Katana. Not an exploit scanner.",
    executionMode: "InternalRunner",
    fixtureFile: "katana/katana-fixture.json",
    findings: (result) => katanaFindings(result),
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
    count: (result) => cloudlistFindings(result).length,
    description: "Lists cloud assets when provider credentials exist.",
    executionMode: "InternalRunner",
    fixtureFile: "cloudlist/cloudlist-fixture.json",
    findings: (result) => cloudlistFindings(result),
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
  },
  {
    args: ({ scanRoot }) => [
      "scan",
      scanRoot,
      "--format",
      "json",
      "--no-validate",
      "--git-history=none",
      "--redact"
    ],
    capabilityName: "Repository Secret Validation",
    count: (result) => countKingfisher(result.json),
    description:
      "Runs Kingfisher against an authorized repository. Local filesystem scan only; --no-validate so secrets are not live-checked.",
    executionMode: "ControlPlane",
    fixtureFile: "kingfisher/kingfisher-fixture.json",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "kingfisher.repo_secrets",
    name: "Kingfisher Repository Scan",
    parser: "periscan.kingfisher.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "SecretExposure",
    timeoutSeconds: 180,
    toolId: "kingfisher",
    toolName: "Kingfisher"
  },
  {
    args: ({ scanRoot }) => [
      "apply",
      scanRoot,
      "--resource",
      scanRoot,
      "--policy-report",
      "--output-format",
      "json"
    ],
    capabilityName: "Kubernetes Policy Validation",
    count: (result) => countKyverno(result.json),
    description:
      "Runs Kyverno apply --policy-report against Kubernetes YAML in an authorized repository.",
    executionMode: "ControlPlane",
    fixtureFile: "kyverno/kyverno-fixture.json",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "kyverno.repo_policy",
    name: "Kyverno Policy Apply",
    parser: "periscan.kyverno.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "Exposure",
    signalSubcategory: "K8sMisconfig",
    skip: ({ fixtureMode, repositoryPath }) => {
      if (fixtureMode || !repositoryPath) return null;
      if (repoHasExtension(repositoryPath, [".yaml", ".yml"])) return null;
      return "Kyverno skipped: no Kubernetes YAML policies or resources in the authorized repository.";
    },
    timeoutSeconds: 180,
    toolId: "kyverno",
    toolName: "Kyverno"
  },
  {
    args: ({ scanRoot }) => ["exec", scanRoot, "--reporter", "json"],
    capabilityName: "InSpec Profile Validation",
    count: (result) => countInspec(result.json),
    description:
      "Runs InSpec exec against an authorized repository profile. Skips honestly without inspec.yml.",
    executionMode: "ControlPlane",
    fixtureFile: "inspec/inspec-fixture.json",
    kind: "repo",
    license: "Apache-2.0",
    moduleId: "inspec.repo_profile",
    name: "InSpec Profile Exec",
    parser: "periscan.inspec.v1",
    requiredInputs: ["repositoryPath"],
    requiredPermissions: ["repositories:read"],
    requiredScopes: ["Repository"],
    safetyLevel: "PassiveReadOnly",
    signalCategory: "ControlObservation",
    signalSubcategory: "InspecFail",
    skip: requireFiles(["inspec.yml", "inspec.yaml"], "InSpec"),
    timeoutSeconds: 180,
    toolId: "inspec",
    toolName: "InSpec"
  },
  {
    args: ({ host }) => ["--subs-only", host],
    capabilityName: "Passive Related-Domain Enumeration",
    count: (result) => countTextLines(result),
    description:
      "Runs assetfinder in passive mode against a verified domain. Not an exploit scanner.",
    executionMode: "InternalRunner",
    fixtureFile: "assetfinder/assetfinder-fixture.txt",
    kind: "host",
    license: "MIT",
    moduleId: "assetfinder.passive_enum",
    name: "assetfinder Passive Enum",
    parser: "periscan.assetfinder.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["network:discover"],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevel: "ActiveNonInvasive",
    signalCategory: "Exposure",
    signalSubcategory: "Subdomain",
    timeoutSeconds: 120,
    toolId: "assetfinder",
    toolName: "assetfinder"
  },
  {
    args: ({ host }) => [host],
    capabilityName: "Known URL Harvest",
    count: (result) => countTextLines(result),
    description:
      "Runs gau against a verified hostname to harvest known URLs. Authorized domains only.",
    executionMode: "InternalRunner",
    fixtureFile: "gau/gau-fixture.json",
    kind: "host",
    license: "MIT",
    moduleId: "gau.known_urls",
    name: "gau Known URLs",
    parser: "periscan.gau.v1",
    requiredInputs: ["hostname"],
    requiredPermissions: ["network:discover"],
    requiredScopes: ["Domain", "Subdomain"],
    safetyLevel: "ActiveNonInvasive",
    signalCategory: "Exposure",
    signalSubcategory: "KnownUrl",
    timeoutSeconds: 180,
    toolId: "gau",
    toolName: "gau"
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
          if (
            !target.fixtureMode &&
            repositoryTargetUnusable(target.repositoryPath)
          ) {
            return missingTarget(spec.toolName, label, target.repositoryPath);
          }
          if (
            !target.fixtureMode &&
            (spec.moduleId.endsWith(IAC_POSTURE_SUFFIX) ||
              spec.moduleId === "trivy.repo_misconfig") &&
            !repoHasIacFiles(target.repositoryPath)
          ) {
            return skipped(spec.toolName, label, iacSkipReason(spec.toolName));
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
          return measured(
            context,
            spec,
            label,
            spec.count(result),
            {
              repositoryPath: target.repositoryPath
            },
            result
          );
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
        return measured(
          context,
          spec,
          host,
          spec.count(result),
          {
            hostname: host
          },
          result
        );
      }
    )
  );
}
