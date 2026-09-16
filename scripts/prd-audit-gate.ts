import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

type SourceCoverageStatus =
  | "AtomizedInRequirementLedger"
  | "Blocked"
  | "EvidenceMapped"
  | "NeedsImplementationAudit"
  | "SectionIndexed";

type RequirementStatus =
  | "Blocked"
  | "Implemented"
  | "NotStarted"
  | "Partial"
  | "Unknown";

interface ParsedSourceRow {
  id: string;
  section: string;
  status: SourceCoverageStatus;
  nextAuditAction: string;
}

interface ParsedRequirementRow {
  id: string;
  source: string;
  status: RequirementStatus;
  remainingWorkOrRisk: string;
}

export interface PrdAuditReport {
  canClaimFullProductComplete: boolean;
  completionReportMode:
    | "FirstCustomerReadiness"
    | "FullProductCompletion"
    | "Unknown";
  completionReportScoped: boolean;
  protocolPresent: boolean;
  requirementLedger: {
    byStatus: Record<RequirementStatus, number>;
    total: number;
    unresolved: ParsedRequirementRow[];
  };
  sourceCoverage: {
    byStatus: Record<SourceCoverageStatus, number>;
    total: number;
    unresolved: ParsedSourceRow[];
  };
}

const SOURCE_READY_STATUSES = new Set<SourceCoverageStatus>([
  "AtomizedInRequirementLedger",
  "Blocked",
  "EvidenceMapped"
]);

const REQUIREMENT_UNRESOLVED_STATUSES = new Set<RequirementStatus>([
  "NotStarted",
  "Partial",
  "Unknown"
]);

const SOURCE_STATUSES: SourceCoverageStatus[] = [
  "AtomizedInRequirementLedger",
  "Blocked",
  "EvidenceMapped",
  "NeedsImplementationAudit",
  "SectionIndexed"
];

const REQUIREMENT_STATUSES: RequirementStatus[] = [
  "Blocked",
  "Implemented",
  "NotStarted",
  "Partial",
  "Unknown"
];

function normalizeBacktickCell(value: string) {
  return value.trim().replace(/^`|`$/gu, "").trim();
}

function splitMarkdownRow(line: string) {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]) {
  return cells.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

function parseMarkdownTables(markdown: string) {
  const tables: string[][][] = [];
  let current: string[][] = [];

  for (const line of markdown.split("\n")) {
    if (!line.trim().startsWith("|")) {
      if (current.length > 0) {
        tables.push(current);
        current = [];
      }
      continue;
    }

    const cells = splitMarkdownRow(line);

    if (isSeparatorRow(cells)) {
      continue;
    }

    current.push(cells);
  }

  if (current.length > 0) {
    tables.push(current);
  }

  return tables;
}

function parseSourceRows(markdown: string): ParsedSourceRow[] {
  const rows: ParsedSourceRow[] = [];

  for (const table of parseMarkdownTables(markdown)) {
    const [header, ...body] = table;

    if (!header || header[0] !== "Source ID") {
      continue;
    }

    for (const cells of body) {
      const id = normalizeBacktickCell(cells[0] ?? "");
      const status = normalizeBacktickCell(
        cells[4] ?? ""
      ) as SourceCoverageStatus;

      if (!id || !SOURCE_STATUSES.includes(status)) {
        continue;
      }

      rows.push({
        id,
        nextAuditAction: cells[5] ?? "",
        section: normalizeBacktickCell(cells[1] ?? ""),
        status
      });
    }
  }

  return rows;
}

function parseRequirementRows(markdown: string): ParsedRequirementRow[] {
  const rows: ParsedRequirementRow[] = [];

  for (const table of parseMarkdownTables(markdown)) {
    const [header, ...body] = table;

    if (!header || header[0] !== "Requirement ID") {
      continue;
    }

    for (const cells of body) {
      const id = normalizeBacktickCell(cells[0] ?? "");
      const status = normalizeBacktickCell(cells[5] ?? "") as RequirementStatus;

      if (!id || !REQUIREMENT_STATUSES.includes(status)) {
        continue;
      }

      rows.push({
        id,
        remainingWorkOrRisk: cells[6] ?? "",
        source: cells[1] ?? "",
        status
      });
    }
  }

  return rows;
}

function countByStatus<T extends string>(statuses: readonly T[], values: T[]) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      values.filter((value) => value === status).length
    ])
  ) as Record<T, number>;
}

async function readRepoFile(rootDir: string, relativePath: string) {
  return readFile(path.join(rootDir, relativePath), "utf8");
}

export async function buildPrdAuditReport(
  rootDir = process.cwd()
): Promise<PrdAuditReport> {
  const [protocol, sourceCoverageLedger, requirementLedger, completionReport] =
    await Promise.all([
      readRepoFile(rootDir, "docs/PRD_AUDIT_PROTOCOL.md"),
      readRepoFile(rootDir, "docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile(rootDir, "docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile(rootDir, "docs/COMPLETION_REPORT.md")
    ]);

  const sourceRows = parseSourceRows(sourceCoverageLedger);
  const requirementRows = parseRequirementRows(requirementLedger);
  const sourceUnresolved = sourceRows.filter(
    (row) => !SOURCE_READY_STATUSES.has(row.status)
  );
  const requirementUnresolved = requirementRows.filter((row) =>
    REQUIREMENT_UNRESOLVED_STATUSES.has(row.status)
  );
  const protocolPresent =
    protocol.includes("Source-First Audit Rule") &&
    protocol.includes("Completion Claim Policy") &&
    protocol.includes("PRD_SOURCE_COVERAGE_LEDGER.md") &&
    sourceCoverageLedger.includes("Completion Gate");
  const completionReportScoped =
    completionReport.includes("first-customer readiness") &&
    completionReport.includes("not a full-PRD completion claim");
  const completionReportFullProduct =
    completionReport.includes("full-PRD implementation completion claim") &&
    completionReport.includes("PRD-COMPLETE-001");
  const completionReportMode = completionReportFullProduct
    ? "FullProductCompletion"
    : completionReportScoped
      ? "FirstCustomerReadiness"
      : "Unknown";

  return {
    canClaimFullProductComplete:
      protocolPresent &&
      completionReportMode === "FullProductCompletion" &&
      sourceUnresolved.length === 0 &&
      requirementUnresolved.length === 0,
    completionReportMode,
    completionReportScoped,
    protocolPresent,
    requirementLedger: {
      byStatus: countByStatus(
        REQUIREMENT_STATUSES,
        requirementRows.map((row) => row.status)
      ),
      total: requirementRows.length,
      unresolved: requirementUnresolved
    },
    sourceCoverage: {
      byStatus: countByStatus(
        SOURCE_STATUSES,
        sourceRows.map((row) => row.status)
      ),
      total: sourceRows.length,
      unresolved: sourceUnresolved
    }
  };
}

function formatRows(rows: { id: string; status: string }[], limit = 12) {
  if (rows.length === 0) {
    return "- none";
  }

  return rows
    .slice(0, limit)
    .map((row) => `- ${row.id}: ${row.status}`)
    .join("\n");
}

export function formatPrdAuditReport(report: PrdAuditReport) {
  return [
    "# PRD Audit Gate",
    "",
    `Can claim full product complete: ${report.canClaimFullProductComplete ? "yes" : "no"}`,
    `Completion report mode: ${report.completionReportMode}`,
    `Protocol present: ${report.protocolPresent ? "yes" : "no"}`,
    `Completion report scoped: ${report.completionReportScoped ? "yes" : "no"}`,
    "",
    "## Source Coverage",
    "",
    `Total source rows: ${report.sourceCoverage.total}`,
    `By status: ${JSON.stringify(report.sourceCoverage.byStatus)}`,
    "",
    "Source sections pending atomization/audit:",
    formatRows(report.sourceCoverage.unresolved),
    "",
    "## Requirement Ledger",
    "",
    `Total requirement rows: ${report.requirementLedger.total}`,
    `By status: ${JSON.stringify(report.requirementLedger.byStatus)}`,
    "",
    "Requirement atoms blocking full completion claims:",
    formatRows(report.requirementLedger.unresolved)
  ].join("\n");
}

export async function runPrdAuditGate(
  command: "check" | "json" | "status" | "strict" = "check",
  rootDir = process.cwd()
) {
  const report = await buildPrdAuditReport(rootDir);

  if (command === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(formatPrdAuditReport(report));

  const baseFailures = [
    !report.protocolPresent
      ? "PRD audit protocol or source coverage completion gate is missing."
      : null,
    report.completionReportMode === "Unknown"
      ? "docs/COMPLETION_REPORT.md must explicitly be either a first-customer readiness report or a full-PRD implementation completion report."
      : null
  ].filter((failure): failure is string => Boolean(failure));

  if (baseFailures.length > 0) {
    throw new Error(baseFailures.join("\n"));
  }

  if (command === "strict" && !report.canClaimFullProductComplete) {
    throw new Error(
      [
        "Full PRD completion claim is blocked.",
        `${report.sourceCoverage.unresolved.length} source sections still need atomization/audit.`,
        `${report.requirementLedger.unresolved.length} requirement atoms are Partial, NotStarted, or Unknown.`
      ].join("\n")
    );
  }
}

async function main() {
  const command = (process.argv[2] ?? "check") as
    | "check"
    | "json"
    | "status"
    | "strict";

  if (!["check", "json", "status", "strict"].includes(command)) {
    throw new Error(`Unsupported PRD audit command: ${process.argv[2] ?? ""}`);
  }

  await runPrdAuditGate(command);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
