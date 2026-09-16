import { randomUUID } from "node:crypto";

import { SignalEnvelopeSchema, type SignalEnvelope } from "@periscan/shared";

// Unified data-fabric ingestion for customer scan-file exports. Parses the common
// vulnerability/finding formats — Nessus (.nessus XML), CSV, and SARIF (JSON) —
// into normalized signals that flow into the same correlation engine as live
// connector telemetry. This closes the "drop in your existing scan" gap: a
// customer's Nessus/SARIF export becomes attack-path + exposure input, correlated
// against everything else.

export type ScanImportFormat = "nessus" | "csv" | "sarif";

export interface ImportedFinding {
  format: ScanImportFormat;
  host: string | null;
  severity: "Critical" | "High" | "Medium" | "Low" | "Info";
  title: string;
  cveIds: string[];
  vendor: string;
}

const SEVERITY_CONFIDENCE: Record<ImportedFinding["severity"], number> = {
  Critical: 0.95,
  High: 0.9,
  Info: 0.5,
  Low: 0.6,
  Medium: 0.75
};

function attr(fragment: string, name: string): string | null {
  const match = fragment.match(new RegExp(`${name}="([^"]*)"`, "u"));
  return match ? match[1]! : null;
}

const NESSUS_SEVERITY: Record<string, ImportedFinding["severity"]> = {
  "0": "Info",
  "1": "Low",
  "2": "Medium",
  "3": "High",
  "4": "Critical"
};

// Parse a Nessus (.nessus) XML export. Extracts each ReportItem under its
// ReportHost, mapping the numeric severity and pulling CVE references.
export function parseNessusScan(xml: string): ImportedFinding[] {
  const findings: ImportedFinding[] = [];
  const hostBlocks = xml.split(/<ReportHost\b/u).slice(1);

  for (const hostBlock of hostBlocks) {
    const host =
      attr(hostBlock, "name") ??
      hostBlock.match(/host-ip">([^<]+)</u)?.[1] ??
      null;
    const items = hostBlock.split(/<ReportItem\b/u).slice(1);

    for (const item of items) {
      const severityCode = attr(item, "severity") ?? "0";
      const title =
        attr(item, "pluginName") ?? attr(item, "plugin_name") ?? "Nessus finding";
      const cveIds = [...item.matchAll(/<cve>([^<]+)<\/cve>/gu)].map(
        (match) => match[1]!
      );
      findings.push({
        cveIds,
        format: "nessus",
        host,
        severity: NESSUS_SEVERITY[severityCode] ?? "Info",
        title,
        vendor: "Tenable Nessus"
      });
    }
  }

  return findings;
}

function normalizeSeverity(value: string): ImportedFinding["severity"] {
  const v = value.trim().toLowerCase();
  if (v.startsWith("crit")) return "Critical";
  if (v.startsWith("high") || v === "error") return "High";
  if (v.startsWith("med") || v === "warning" || v === "moderate") return "Medium";
  if (v.startsWith("low") || v === "note") return "Low";
  return "Info";
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map((c) => c.trim());
}

// Parse a CSV scan export. Expects a header row; looks for host/severity/title
// (a.k.a. name/plugin) and cve columns by common aliases.
export function parseCsvScan(csv: string): ImportedFinding[] {
  const lines = csv.split(/\r?\n/u).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }
  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const idx = (...names: string[]) =>
    names.map((n) => header.indexOf(n)).find((i) => i >= 0) ?? -1;
  const hostIdx = idx("host", "ip", "asset", "target");
  const sevIdx = idx("severity", "risk", "level");
  const titleIdx = idx("name", "title", "plugin", "finding", "vulnerability");
  const cveIdx = idx("cve", "cves", "cve id");

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const cveRaw = cveIdx >= 0 ? (cells[cveIdx] ?? "") : "";
    return {
      cveIds: cveRaw
        ? cveRaw
            .split(/[;, ]+/u)
            .filter((c) => /^CVE-/iu.test(c))
        : [],
      format: "csv" as const,
      host: hostIdx >= 0 ? (cells[hostIdx] ?? null) || null : null,
      severity: normalizeSeverity(sevIdx >= 0 ? (cells[sevIdx] ?? "") : ""),
      title: titleIdx >= 0 ? (cells[titleIdx] ?? "CSV finding") : "CSV finding",
      vendor: "CSV import"
    };
  });
}

// Parse a SARIF (Static Analysis Results Interchange Format) log. Each result
// becomes a finding; the SARIF level maps to severity.
export function parseSarifScan(json: string): ImportedFinding[] {
  let doc: unknown;
  try {
    doc = JSON.parse(json);
  } catch {
    return [];
  }
  const runs = (doc as { runs?: unknown[] }).runs ?? [];
  const findings: ImportedFinding[] = [];

  for (const run of runs) {
    const tool =
      (run as { tool?: { driver?: { name?: string } } }).tool?.driver?.name ??
      "SARIF";
    const results =
      (run as { results?: unknown[] }).results ?? ([] as unknown[]);
    for (const result of results) {
      const r = result as {
        level?: string;
        ruleId?: string;
        message?: { text?: string };
        locations?: Array<{
          physicalLocation?: { artifactLocation?: { uri?: string } };
        }>;
      };
      const host =
        r.locations?.[0]?.physicalLocation?.artifactLocation?.uri ?? null;
      findings.push({
        cveIds: [],
        format: "sarif",
        host,
        severity: normalizeSeverity(r.level ?? "warning"),
        title: r.message?.text ?? r.ruleId ?? "SARIF result",
        vendor: tool
      });
    }
  }

  return findings;
}

export function parseScanFile(
  format: ScanImportFormat,
  content: string
): ImportedFinding[] {
  switch (format) {
    case "nessus":
      return parseNessusScan(content);
    case "csv":
      return parseCsvScan(content);
    case "sarif":
      return parseSarifScan(content);
  }
}

// Normalize imported findings into the shared signal fabric. Each finding becomes
// an Exposure signal carrying a host pointer (so it correlates with live signals
// for the same host) and its source provenance. Uses a caller-supplied timestamp
// so the function stays deterministic/testable.
//
// Honesty contract (P13-7): these signals are evidenceBasis=Imported. They must
// never be promoted to Measured or claim Periscan-validated exploitability.
// Downstream finding projection uses NeedsReview / Discovered for import rows.
export function importedFindingsToSignals(
  findings: ImportedFinding[],
  input: { tenantId: string; nowIso: string }
): SignalEnvelope[] {
  return findings.map((finding) => {
    const host = finding.host ?? "unknown-host";
    const query = new URLSearchParams({
      evidenceBasis: "Imported",
      severity: finding.severity,
      title: finding.title.slice(0, 200),
      vendor: finding.vendor,
      ...(finding.cveIds[0] ? { cve: finding.cveIds[0] } : {})
    }).toString();
    return SignalEnvelopeSchema.parse({
      confidence: SEVERITY_CONFIDENCE[finding.severity],
      createdAt: input.nowIso,
      evidenceIds: [],
      freshness: "Fresh",
      rawPayloadPointer: `periscan-import://${finding.format}/${encodeURIComponent(host)}?${query}`,
      redactionStatus: "Redacted",
      relatedAssetIds: [],
      relatedControlIds: [],
      relatedEvidenceIds: [],
      relatedIdentityIds: [],
      relatedPathIds: [],
      sensitivityLevel: "Moderate",
      signalCategory: "Exposure",
      signalId: randomUUID(),
      signalSubcategory: "ImportedScanFinding",
      sourceIntegrationId: null,
      sourceType: `import.${finding.format}`,
      sourceVendor: finding.vendor,
      tenantId: input.tenantId,
      // CVE refs are not ATT&CK techniques; they are carried on the finding, not
      // mislabeled here.
      techniqueIds: [],
      timestampIngested: input.nowIso,
      timestampObserved: input.nowIso,
      updatedAt: input.nowIso
    });
  });
}

/** Parse severity/title from an import rawPayloadPointer (best-effort). */
export function parseImportPayloadMeta(rawPayloadPointer: string | null | undefined): {
  evidenceBasis: "Imported" | null;
  severity: ImportedFinding["severity"] | null;
  title: string | null;
  cve: string | null;
} {
  if (!rawPayloadPointer?.startsWith("periscan-import://")) {
    return { cve: null, evidenceBasis: null, severity: null, title: null };
  }
  try {
    const url = new URL(rawPayloadPointer);
    const severityRaw = url.searchParams.get("severity");
    const severity =
      severityRaw === "Critical" ||
      severityRaw === "High" ||
      severityRaw === "Medium" ||
      severityRaw === "Low" ||
      severityRaw === "Info"
        ? severityRaw
        : null;
    return {
      cve: url.searchParams.get("cve"),
      evidenceBasis:
        url.searchParams.get("evidenceBasis") === "Imported" ? "Imported" : null,
      severity,
      title: url.searchParams.get("title")
    };
  } catch {
    return { cve: null, evidenceBasis: null, severity: null, title: null };
  }
}
