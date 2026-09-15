/**
 * Community-legal SARIF 2.1.0 export of evidence-backed findings.
 *
 * Honesty:
 * - Evidence IDs required; empty-receipt rows are omitted.
 * - Imported scan rows stay Imported (never promoted to Measured).
 * - SARIF level is product severity, never exploitability / CVSS.
 * - validationState Fixed is kind=pass only after measured re-validation.
 * - Not a certification, not a pentest report, not false-positive-free.
 */

export const SARIF_VERSION = "2.1.0" as const;

export const SARIF_SCHEMA_URI =
  "https://json.schemastore.org/sarif-2.1.0.json";

export const SARIF_CONTENT_TYPE = "application/sarif+json";

/** GitHub Code Scanning category (`upload-sarif` category). */
export const SARIF_AUTOMATION_ID = "periscan-community";

export const SARIF_EXPORT_DISCLAIMER =
  "Community-legal SARIF of evidence-backed Periscan findings. Not a certification. Not a pentest report. Not false-positive-free. Level is product severity, never exploitability. Imported rows stay Imported. validationState Fixed is SARIF pass only after measured re-validation.";

export const SARIF_EVIDENCE_BASES = [
  "Measured",
  "Imported",
  "Heuristic"
] as const;

export type SarifEvidenceBasis = (typeof SARIF_EVIDENCE_BASES)[number];

export type SarifSeverity =
  | "Critical"
  | "High"
  | "Medium"
  | "Low"
  | "Informational";

export type SarifLevel = "error" | "warning" | "note" | "none";

export type SarifResultKind =
  | "fail"
  | "pass"
  | "review"
  | "open"
  | "informational"
  | "notApplicable";

export type SarifFindingVerification = {
  outcome?: string | null;
  measuredRevalidation?: boolean | null;
};

export type SarifFindingInput = {
  findingId: string;
  title: string;
  severity: SarifSeverity;
  evidenceIds: readonly string[];
  evidenceBasis: SarifEvidenceBasis;
  validationState?: string | null;
  status?: string | null;
  source?: string | null;
  ruleId?: string | null;
  uri?: string | null;
  exploitability?: string | null;
  verification?: SarifFindingVerification | null;
};

/**
 * ValidatedFinding-shaped input for `toSarifFindingInput`. Evidence basis is
 * derived — callers must not invent Measured without receipts, and import.*
 * sources cannot promote to Measured.
 */
export type FindingSarifSource = {
  findingId: string;
  title: string;
  severity: SarifSeverity;
  evidenceIds: readonly string[];
  evidenceBasis?: SarifEvidenceBasis | null;
  validationState?: string | null;
  status?: string | null;
  source?: string | null;
  ruleId?: string | null;
  uri?: string | null;
  exploitability?: string | null;
  pathProof?: { fullyMeasured?: boolean | null } | null;
  verification?: SarifFindingVerification | null;
};

export type SarifResultProperties = {
  evidenceBasis: SarifEvidenceBasis;
  evidenceIds: string[];
  findingId: string;
  severity: SarifSeverity;
  validationState: string;
  verifiedFixed: boolean;
};

export type SarifResult = {
  ruleId: string;
  guid?: string;
  kind: SarifResultKind;
  level: SarifLevel;
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
    };
  }>;
  properties: SarifResultProperties;
};

export type SarifReportingDescriptor = {
  id: string;
  name: string;
  shortDescription: { text: string };
  help: { text: string };
};

export type SarifLog = {
  $schema: string;
  version: typeof SARIF_VERSION;
  runs: Array<{
    automationDetails: { id: string };
    tool: {
      driver: {
        name: string;
        informationUri?: string;
        rules: SarifReportingDescriptor[];
        properties: {
          disclaimer: string;
        };
      };
    };
    results: SarifResult[];
    properties: {
      disclaimer: string;
    };
  }>;
};

export type FindingsToSarifOptions = {
  informationUri?: string;
  toolName?: string;
};

const DEFAULT_RULE_ID = "periscan.finding";

export function isImportedFindingSource(
  source: string | null | undefined
): boolean {
  return typeof source === "string" && source.startsWith("import.");
}

/**
 * Honest evidenceBasis for SARIF. Imported scan rows stay Imported. Path
 * findings are Measured only when hop receipts are fully measured. Community
 * engine findings (e.g. Gitleaks) are Measured only when evidence IDs exist.
 */
export function deriveSarifEvidenceBasis(
  finding: FindingSarifSource
): SarifEvidenceBasis {
  if (
    finding.evidenceBasis === "Imported" ||
    isImportedFindingSource(finding.source)
  ) {
    return "Imported";
  }
  if (finding.evidenceBasis === "Heuristic") {
    return "Heuristic";
  }
  if (finding.pathProof) {
    return finding.pathProof.fullyMeasured === true ? "Measured" : "Heuristic";
  }
  if (finding.evidenceIds.some((id) => id.length > 0)) {
    return finding.evidenceBasis ?? "Measured";
  }
  return "Heuristic";
}

export function toSarifFindingInput(
  finding: FindingSarifSource
): SarifFindingInput {
  return {
    evidenceBasis: deriveSarifEvidenceBasis(finding),
    evidenceIds: finding.evidenceIds,
    exploitability: finding.exploitability,
    findingId: finding.findingId,
    ruleId: finding.ruleId ?? finding.source,
    severity: finding.severity,
    source: finding.source,
    status: finding.status,
    title: finding.title,
    uri: finding.uri,
    validationState: finding.validationState,
    verification: finding.verification
  };
}

export function findingsToSarif(
  findings: readonly SarifFindingInput[],
  options: FindingsToSarifOptions = {}
): SarifLog {
  const results: SarifResult[] = [];
  const rules = new Map<string, SarifReportingDescriptor>();

  for (const finding of findings) {
    if (!isEvidenceBacked(finding)) {
      continue;
    }

    const evidenceBasis = resolveEvidenceBasis(finding);
    const verifiedFixed = isVerifiedFixed(finding);
    const recordedState = finding.validationState ?? finding.status ?? "Open";
    const validationState = claimSafeValidationState(
      recordedState,
      verifiedFixed
    );
    const kind = resultKind(recordedState, verifiedFixed);
    const level = sarifLevel(finding.severity, kind);
    const ruleId = resolveRuleId(finding);

    if (!rules.has(ruleId)) {
      rules.set(ruleId, {
        id: ruleId,
        name: ruleId,
        shortDescription: { text: finding.title },
        help: { text: SARIF_EXPORT_DISCLAIMER }
      });
    }

    results.push({
      guid: finding.findingId,
      kind,
      level,
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: finding.uri ?? `periscan://finding/${finding.findingId}`
            }
          }
        }
      ],
      message: { text: finding.title },
      properties: {
        evidenceBasis,
        evidenceIds: [...finding.evidenceIds],
        findingId: finding.findingId,
        severity: finding.severity,
        validationState,
        verifiedFixed
      },
      ruleId
    });
  }

  return {
    $schema: SARIF_SCHEMA_URI,
    version: SARIF_VERSION,
    runs: [
      {
        automationDetails: { id: SARIF_AUTOMATION_ID },
        properties: { disclaimer: SARIF_EXPORT_DISCLAIMER },
        results,
        tool: {
          driver: {
            informationUri: options.informationUri,
            name: options.toolName ?? "Periscan",
            properties: { disclaimer: SARIF_EXPORT_DISCLAIMER },
            rules: [...rules.values()]
          }
        }
      }
    ]
  };
}

function isEvidenceBacked(finding: SarifFindingInput): boolean {
  return finding.evidenceIds.some((id) => id.length > 0);
}

/**
 * Imported scan rows cannot round-trip as Measured even if a caller labels them
 * that way. Measured still requires evidence IDs (enforced by the omit filter).
 */
function resolveEvidenceBasis(finding: SarifFindingInput): SarifEvidenceBasis {
  if (
    finding.evidenceBasis === "Imported" ||
    isImportedFindingSource(finding.source)
  ) {
    return "Imported";
  }
  return finding.evidenceBasis;
}

function isVerifiedFixed(finding: SarifFindingInput): boolean {
  return (
    finding.verification?.outcome === "Fixed" &&
    finding.verification.measuredRevalidation === true
  );
}

function claimsFixed(state: string): boolean {
  return /\bFixed\b/.test(state);
}

function claimSafeValidationState(
  recordedState: string,
  verifiedFixed: boolean
): string {
  if (claimsFixed(recordedState) && !verifiedFixed) {
    return "ClosedWithoutEvidence";
  }
  return recordedState;
}

function resultKind(
  recordedState: string,
  verifiedFixed: boolean
): SarifResultKind {
  if (verifiedFixed) {
    return "pass";
  }
  if (claimsFixed(recordedState)) {
    return "review";
  }
  return "fail";
}

/**
 * SARIF 2.1.0: if kind is pass / notApplicable / informational, level SHALL be
 * none when present. Otherwise map product severity — never exploitability.
 */
function sarifLevel(severity: SarifSeverity, kind: SarifResultKind): SarifLevel {
  if (kind === "pass" || kind === "notApplicable" || kind === "informational") {
    return "none";
  }
  switch (severity) {
    case "Critical":
    case "High":
      return "error";
    case "Medium":
      return "warning";
    case "Low":
    case "Informational":
      return "note";
  }
}

function resolveRuleId(finding: SarifFindingInput): string {
  const explicit = finding.ruleId?.trim();
  if (explicit) {
    return explicit;
  }
  const source = finding.source?.trim();
  if (source) {
    return source;
  }
  return DEFAULT_RULE_ID;
}
