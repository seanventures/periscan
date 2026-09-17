import { describe, expect, it } from "vitest";

import {
  SARIF_AUTOMATION_ID,
  SARIF_CONTENT_TYPE,
  SARIF_EXPORT_DISCLAIMER,
  SARIF_SCHEMA_URI,
  SARIF_VERSION,
  deriveSarifEvidenceBasis,
  findingsToSarif,
  toSarifFindingInput,
  type SarifFindingInput
} from "./sarif.js";

const EVIDENCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function finding(
  overrides: Partial<SarifFindingInput> &
    Pick<SarifFindingInput, "findingId" | "title" | "evidenceBasis">
): SarifFindingInput {
  return {
    evidenceIds: [EVIDENCE_ID],
    severity: "High",
    ...overrides
  };
}

function firstResult(input: readonly SarifFindingInput[]) {
  const log = findingsToSarif(input);
  const result = log.runs[0]?.results[0];
  expect(result).toBeDefined();
  return { log, result: result! };
}

describe("findingsToSarif", () => {
  it("emits SARIF 2.1.0 with a Community Code Scanning automation id", () => {
    const { log } = firstResult([
      finding({
        evidenceBasis: "Measured",
        findingId: "gitleaks-1",
        title: "Repository secret"
      })
    ]);

    expect(log.version).toBe("2.1.0");
    expect(log.version).toBe(SARIF_VERSION);
    expect(log.$schema).toBe(SARIF_SCHEMA_URI);
    expect(SARIF_CONTENT_TYPE).toBe("application/sarif+json");
    expect(log.runs).toHaveLength(1);
    expect(log.runs[0]?.tool.driver.name).toBe("Periscan");
    expect(log.runs[0]?.automationDetails?.id).toBe(SARIF_AUTOMATION_ID);
    expect(SARIF_AUTOMATION_ID).toBe("periscan-community");
  });

  it("maps only evidence-backed findings and drops rows with no evidence IDs", () => {
    const log = findingsToSarif([
      finding({
        evidenceBasis: "Measured",
        findingId: "with-receipt",
        title: "Gitleaks secret"
      }),
      {
        evidenceBasis: "Measured",
        evidenceIds: [],
        findingId: "claimed-measured-no-evidence",
        severity: "Critical",
        title: "Theater finding"
      },
      {
        evidenceBasis: "Heuristic",
        evidenceIds: [],
        findingId: "heuristic-no-evidence",
        severity: "High",
        title: "Hypothesis only"
      }
    ]);

    const ids = log.runs[0]?.results.map((result) => result.properties.findingId);
    expect(ids).toEqual(["with-receipt"]);
    expect(log.runs[0]?.results).toHaveLength(1);
  });

  it("re-exports ingested SARIF as Imported and never promotes it to Measured", () => {
    const { result } = firstResult([
      finding({
        evidenceBasis: "Imported",
        findingId: "imported-1",
        source: "import.sarif",
        title: "Third-party scanner hit"
      })
    ]);

    expect(result.properties.evidenceBasis).toBe("Imported");
    expect(result.properties.evidenceIds).toEqual([EVIDENCE_ID]);

    const clamped = findingsToSarif([
      finding({
        evidenceBasis: "Measured",
        findingId: "imported-claimed-measured",
        source: "import.sarif",
        title: "Must stay Imported"
      })
    ]);
    expect(clamped.runs[0]?.results[0]?.properties.evidenceBasis).toBe(
      "Imported"
    );
  });

  it("labels a Community Gitleaks finding Measured only when evidence exists", () => {
    const measured = findingsToSarif([
      finding({
        evidenceBasis: "Measured",
        findingId: "gitleaks-measured",
        source: "gitleaks.repository_secrets",
        title: "AWS access key in repository"
      })
    ]);
    expect(measured.runs[0]?.results[0]?.properties.evidenceBasis).toBe(
      "Measured"
    );
    expect(measured.runs[0]?.results[0]?.properties.evidenceIds).toEqual([
      EVIDENCE_ID
    ]);

    const withoutEvidence = findingsToSarif([
      {
        evidenceBasis: "Measured",
        evidenceIds: [],
        findingId: "gitleaks-no-evidence",
        source: "gitleaks.repository_secrets",
        severity: "High",
        title: "AWS access key in repository"
      }
    ]);
    expect(withoutEvidence.runs[0]?.results).toEqual([]);
  });

  it("sets SARIF level from product severity, never from exploitability", () => {
    const cases: Array<[SarifFindingInput["severity"], "error" | "warning" | "note"]> =
      [
        ["Critical", "error"],
        ["High", "error"],
        ["Medium", "warning"],
        ["Low", "note"],
        ["Informational", "note"]
      ];

    for (const [severity, level] of cases) {
      const { result } = firstResult([
        finding({
          evidenceBasis: "Measured",
          exploitability: "Exploitable",
          findingId: `sev-${severity}`,
          severity,
          title: `${severity} finding`
        })
      ]);
      expect(result.level, severity).toBe(level);
      expect(result.level).not.toBe("exploitable");
    }

    const { result } = firstResult([
      finding({
        evidenceBasis: "Heuristic",
        exploitability: "Exploitable",
        findingId: "low-exploitable",
        severity: "Low",
        title: "Low-severity heuristic"
      })
    ]);
    expect(result.level).toBe("note");
    expect(JSON.stringify(result)).not.toMatch(/"level"\s*:\s*"exploitable"/i);
  });

  it("does not emit kind pass for validationState Fixed without measured verification", () => {
    const { result } = firstResult([
      finding({
        evidenceBasis: "Measured",
        findingId: "unverified-fixed",
        status: "Fixed",
        title: "Ticket-closed exposure",
        validationState: "Fixed"
      })
    ]);

    expect(result.kind).not.toBe("pass");
    expect(result.kind).toBe("review");
    expect(result.properties.verifiedFixed).toBe(false);
    expect(result.properties.validationState).not.toBe("Fixed");
    expect(result.properties.validationState).toBe("ClosedWithoutEvidence");
  });

  it("emits kind pass for Fixed only after measured re-validation", () => {
    const { result } = firstResult([
      finding({
        evidenceBasis: "Measured",
        findingId: "verified-fixed",
        status: "Fixed",
        title: "Rotated secret",
        validationState: "Fixed",
        verification: {
          measuredRevalidation: true,
          outcome: "Fixed"
        }
      })
    ]);

    expect(result.kind).toBe("pass");
    expect(result.level).toBe("none");
    expect(result.properties.verifiedFixed).toBe(true);
    expect(result.properties.validationState).toBe("Fixed");
  });

  it("refuses certified, pentest, and false-positive-free claims in the export", () => {
    const { log, result } = firstResult([
      finding({
        evidenceBasis: "Measured",
        findingId: "claim-gate",
        title: "Evidence-backed finding"
      })
    ]);

    expect(SARIF_EXPORT_DISCLAIMER).toMatch(/not a certification/i);
    expect(SARIF_EXPORT_DISCLAIMER).toMatch(/not a pentest/i);
    expect(SARIF_EXPORT_DISCLAIMER).toMatch(/not false-positive-free/i);

    const driverText = JSON.stringify(log.runs[0]?.tool.driver).toLowerCase();
    expect(driverText).toContain("not a certification");
    expect(driverText).toContain("not a pentest");
    expect(driverText).toContain("not false-positive-free");

    const resultText = JSON.stringify(result).toLowerCase();
    expect(resultText).not.toContain("certified");
    expect(resultText).not.toContain("pentest");
    expect(resultText).not.toContain("false-positive-free");
    expect(resultText).not.toContain("false positive free");
  });

  it("derives Community Gitleaks as Measured only with evidence, and import rows stay Imported", () => {
    expect(
      deriveSarifEvidenceBasis({
        evidenceIds: [EVIDENCE_ID],
        findingId: "gitleaks-1",
        severity: "High",
        source: "gitleaks.repository_secrets",
        title: "AWS access key in repository"
      })
    ).toBe("Measured");

    expect(
      deriveSarifEvidenceBasis({
        evidenceIds: [],
        findingId: "gitleaks-empty",
        severity: "High",
        source: "gitleaks.repository_secrets",
        title: "AWS access key in repository"
      })
    ).toBe("Heuristic");

    expect(
      toSarifFindingInput({
        evidenceIds: [EVIDENCE_ID],
        findingId: "imported-1",
        source: "import.sarif",
        severity: "Medium",
        title: "Third-party scanner hit"
      }).evidenceBasis
    ).toBe("Imported");

    expect(
      deriveSarifEvidenceBasis({
        evidenceIds: [EVIDENCE_ID],
        findingId: "path-heuristic",
        pathProof: { fullyMeasured: false },
        source: "AttackPath",
        severity: "Critical",
        title: "Heuristic path hypothesis"
      })
    ).toBe("Heuristic");

    expect(
      deriveSarifEvidenceBasis({
        evidenceIds: [EVIDENCE_ID],
        findingId: "path-measured",
        pathProof: { fullyMeasured: true },
        source: "AttackPath",
        severity: "Critical",
        title: "Fully measured path"
      })
    ).toBe("Measured");
  });

  it("returns a valid empty SARIF log rather than a clean-bill claim", () => {
    const log = findingsToSarif([]);

    expect(log.version).toBe("2.1.0");
    expect(log.runs[0]?.results).toEqual([]);
    const text = JSON.stringify(log).toLowerCase();
    expect(text).not.toContain("no issues found");
    expect(text).not.toContain("all clear");
    expect(text).toContain("not a certification");
    expect(text).toContain("not false-positive-free");
  });
});
