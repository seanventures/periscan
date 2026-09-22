import { describe, expect, it } from "vitest";

import {
  ATTACK_NAVIGATOR_DEFAULT_WINDOW_DAYS,
  ATTACK_NAVIGATOR_DISCLAIMER,
  ATTACK_NAVIGATOR_LAYER_STATES,
  ATTACK_NAVIGATOR_MAX_TECHNIQUES,
  deriveNavigatorFreshness,
  exportAttackNavigatorLayer,
  exportAttackNavigatorLayerFromCoverage,
  importAttackNavigatorLayer
} from "./attack-navigator.js";

const EVIDENCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("ATT&CK Navigator layer contracts (PERISCAN-591)", () => {
  it("imports tested/detected/blocked/stale distinctions and evidence links without executed coverage", () => {
    const result = importAttackNavigatorLayer({
      domain: "enterprise-attack",
      name: "Imported SOC layer",
      techniques: [
        {
          color: "#2A9D8F",
          comment: "blocked in prod SIEM",
          links: [
            {
              label: "Evidence",
              url: `/api/v1/evidence/${EVIDENCE_ID}`
            }
          ],
          techniqueID: "T1059"
        },
        {
          metadata: [{ name: "state", value: "detected" }],
          techniqueID: "T1071"
        },
        {
          metadata: [{ name: "state", value: "stale" }],
          techniqueID: "T1562"
        },
        {
          metadata: [{ name: "state", value: "tested" }],
          techniqueID: "T1595"
        }
      ],
      versions: { attack: "14", layer: "4.5", navigator: "4.9.1" }
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.executedCoverage).toBe(false);
    expect(result.layer.executedCoverage).toBe(false);
    expect(result.layer.executable).toBe(false);
    expect(result.layer.liveSupported).toBe(false);
    expect(result.layer.provenance).toBe("Imported");
    expect(ATTACK_NAVIGATOR_LAYER_STATES).toEqual([
      "tested",
      "detected",
      "blocked",
      "stale"
    ]);

    const byId = Object.fromEntries(
      result.layer.techniques.map((row) => [row.techniqueID, row])
    );
    expect(byId.T1059?.state).toBe("blocked");
    expect(byId.T1059?.evidenceLinks[0]?.url).toContain(EVIDENCE_ID);
    expect(byId.T1071?.state).toBe("detected");
    expect(byId.T1562?.state).toBe("stale");
    expect(byId.T1595?.state).toBe("tested");
  });

  it("does not treat imported scores or executed comments as executed coverage", () => {
    const result = importAttackNavigatorLayer({
      name: "Boastful import",
      techniques: [
        {
          command: "detonate --all",
          comment: "executed and blocked in production",
          payload: "Invoke-Mimikatz",
          score: 100,
          techniqueID: "T1059"
        }
      ]
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.executedCoverage).toBe(false);
    expect(result.layer.executedCoverage).toBe(false);
    expect(result.layer.liveSupported).toBe(false);
    expect(JSON.stringify(result.layer)).not.toMatch(
      /detonate|Invoke-Mimikatz/
    );
    expect(result.layer.techniques[0]?.state).toBe("tested");
  });

  it("exports control-validation coverage with four states, evidence links, and MITRE technique IDs", () => {
    const layer = exportAttackNavigatorLayerFromCoverage({
      items: [
        {
          evidenceIds: [EVIDENCE_ID],
          status: "Blocked",
          tacticName: "Execution",
          techniqueId: "T1059"
        },
        {
          evidenceIds: [EVIDENCE_ID],
          status: "Covered",
          tacticName: "Command and Control",
          techniqueId: "T1071"
        },
        {
          evidenceIds: [],
          status: "Stale",
          tacticName: "Defense Evasion",
          techniqueId: "T1562"
        },
        {
          evidenceIds: [EVIDENCE_ID],
          status: "LoggedOnly",
          tacticName: "Reconnaissance",
          techniqueId: "T1595"
        },
        {
          evidenceIds: [],
          status: "NotTested",
          tacticName: "Initial Access",
          techniqueId: "T1078"
        }
      ],
      name: "Tenant control-validation overlay"
    });

    expect(layer.provenance).toBe("DerivedFromControlValidation");
    expect(layer.executedCoverage).toBe(false);
    expect(layer.executable).toBe(false);
    expect(layer.liveSupported).toBe(false);
    expect(layer.techniques.map((row) => row.techniqueID).sort()).toEqual([
      "T1059",
      "T1071",
      "T1562",
      "T1595"
    ]);

    const byId = Object.fromEntries(
      layer.techniques.map((row) => [row.techniqueID, row])
    );
    expect(byId.T1059?.state).toBe("blocked");
    expect(byId.T1071?.state).toBe("detected");
    expect(byId.T1562?.state).toBe("stale");
    expect(byId.T1595?.state).toBe("tested");
    expect(byId.T1059?.evidenceLinks[0]?.url).toContain(EVIDENCE_ID);

    const exported = exportAttackNavigatorLayer(layer);
    expect(exported.techniques[0]?.techniqueID).toMatch(/^T\d{4}/);
    expect(exported.legendItems.map((item) => item.label).sort()).toEqual([
      "Blocked",
      "Detected",
      "Stale",
      "Tested"
    ]);
    expect(exported.metadata).toEqual(
      expect.arrayContaining([
        { name: "executedCoverage", value: "false" },
        { name: "liveSupported", value: "false" }
      ])
    );
    expect(exported.description.toLowerCase()).toMatch(/not executed coverage/);
  });

  it("round-trips an exported layer through import without flipping executedCoverage", () => {
    const exported = exportAttackNavigatorLayer(
      exportAttackNavigatorLayerFromCoverage({
        items: [
          {
            evidenceIds: [EVIDENCE_ID],
            status: "Blocked",
            tacticName: "Execution",
            techniqueId: "T1059"
          }
        ],
        name: "Round trip"
      })
    );
    const imported = importAttackNavigatorLayer(exported);
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      return;
    }
    expect(imported.executedCoverage).toBe(false);
    expect(imported.layer.executedCoverage).toBe(false);
    expect(imported.layer.techniques[0]?.state).toBe("blocked");
    expect(imported.layer.techniques[0]?.evidenceLinks.length).toBeGreaterThan(
      0
    );
  });

  it("rejects oversized or empty imports with a bounded error that does not echo source", () => {
    const tooMany = importAttackNavigatorLayer({
      name: "flood",
      techniques: Array.from(
        { length: ATTACK_NAVIGATOR_MAX_TECHNIQUES + 1 },
        (_, index) => ({
          secret: `payload-${index}-should-not-echo`,
          techniqueID: "T1059"
        })
      )
    });
    expect(tooMany.ok).toBe(false);
    if (tooMany.ok) {
      return;
    }
    expect(tooMany.executedCoverage).toBe(false);
    expect(tooMany.rationale.toLowerCase()).not.toContain("payload-");
    expect(tooMany.rationale.length).toBeLessThan(300);

    const empty = importAttackNavigatorLayer({ name: "empty", techniques: [] });
    expect(empty.ok).toBe(false);
    expect(empty.executedCoverage).toBe(false);
  });

  it("does not claim MQ, 95, Wave, or 100% ATT&CK in Navigator copy", () => {
    const blob = ATTACK_NAVIGATOR_DISCLAIMER.toLowerCase();
    expect(blob).not.toMatch(/magic quadrant/);
    expect(blob).not.toMatch(/forrester wave/);
    expect(blob).not.toMatch(/\b95\b/);
    expect(blob).not.toMatch(/100% att[&c]ck/);
    expect(blob).toMatch(/not executed coverage/);
    expect(blob).toMatch(/tested/);
    expect(blob).toMatch(/detected/);
    expect(blob).toMatch(/blocked/);
    expect(blob).toMatch(/stale/);
  });
});

describe("ATT&CK Navigator freshness denominator (PERISCAN-591)", () => {
  const recent = new Date().toISOString();
  const staleAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

  it("excludes imported techniques from the executed numerator", () => {
    const snap = deriveNavigatorFreshness({
      imported: [{ techniqueID: "T1059", state: "tested" }],
      supportedScenarioTechniqueIds: ["T1082", "T1124"],
      receipts: [{ techniqueID: "T1082", at: recent, kind: "lab_receipt" }],
      windowDays: 30
    });
    expect(snap.numerator).toBe(1);
    expect(snap.denominator).toBe(2);
    expect(snap.executedCoverage).toBe(false);
    expect(snap.importedCountedAsExecuted).toBe(false);
    expect(snap.windowDays).toBe(30);
    expect(snap.summary).toBe("1 of 2 supported scenarios, window 30d");
    expect(snap.freshTechniqueIds).toEqual(["T1082"]);
    expect(snap.freshTechniqueIds).not.toContain("T1059");
  });

  it("does not count imported-only techniques that sit on the supported list", () => {
    const snap = deriveNavigatorFreshness({
      imported: [
        { techniqueID: "T1082", state: "tested" },
        { techniqueID: "T1124", state: "blocked" }
      ],
      supportedScenarioTechniqueIds: ["T1082", "T1124"],
      receipts: [],
      windowDays: 30
    });
    expect(snap.numerator).toBe(0);
    expect(snap.denominator).toBe(2);
    expect(snap.executedCoverage).toBe(false);
    expect(snap.importedCountedAsExecuted).toBe(false);
    expect(snap.freshTechniqueIds).toEqual([]);
  });

  it("ages receipts older than the window into stale and out of the numerator", () => {
    const snap = deriveNavigatorFreshness({
      imported: [],
      supportedScenarioTechniqueIds: ["T1082", "T1124", "T1057"],
      receipts: [
        { techniqueID: "T1082", at: recent, kind: "qualified_scenario" },
        { techniqueID: "T1124", at: staleAt, kind: "control_validation" },
        { techniqueID: "T1057", at: staleAt, kind: "lab_receipt" }
      ],
      windowDays: 30
    });
    expect(snap.numerator).toBe(1);
    expect(snap.denominator).toBe(3);
    expect(snap.freshTechniqueIds).toEqual(["T1082"]);
    expect(snap.staleTechniqueIds).toEqual(["T1057", "T1124"]);
    expect(snap.executedCoverage).toBe(false);
    expect(snap.summary).toBe("1 of 3 supported scenarios, window 30d");
  });

  it("defaults the freshness window to 30 days and ignores unsupported receipts", () => {
    const snap = deriveNavigatorFreshness({
      imported: [{ techniqueID: "T1595", state: "detected" }],
      supportedScenarioTechniqueIds: ["T1082"],
      receipts: [
        { techniqueID: "T1082", at: recent, kind: "control_validation" },
        { techniqueID: "T9999", at: recent, kind: "lab_receipt" }
      ]
    });
    expect(ATTACK_NAVIGATOR_DEFAULT_WINDOW_DAYS).toBe(30);
    expect(snap.windowDays).toBe(30);
    expect(snap.numerator).toBe(1);
    expect(snap.denominator).toBe(1);
    expect(snap.freshTechniqueIds).toEqual(["T1082"]);
    expect(snap.freshTechniqueIds).not.toContain("T9999");
  });

  it("does not use the MITRE catalog as the denominator", () => {
    const imported = Array.from({ length: 200 }, (_, index) => ({
      state: "tested" as const,
      techniqueID: `T${String(1000 + index).padStart(4, "0")}`
    }));
    const snap = deriveNavigatorFreshness({
      imported,
      receipts: [],
      supportedScenarioTechniqueIds: ["T1082", "T1124"]
    });
    expect(snap.denominator).toBe(2);
    expect(snap.numerator).toBe(0);
    expect(snap.denominator).not.toBe(imported.length);
    expect(snap.executedCoverage).toBe(false);
  });

  it("dedupes supported ids and keeps the latest receipt per technique", () => {
    const snap = deriveNavigatorFreshness({
      imported: [],
      supportedScenarioTechniqueIds: ["T1082", "T1082", "T1124"],
      receipts: [
        { techniqueID: "T1082", at: staleAt, kind: "lab_receipt" },
        { techniqueID: "T1082", at: recent, kind: "control_validation" }
      ],
      windowDays: 30
    });
    expect(snap.denominator).toBe(2);
    expect(snap.numerator).toBe(1);
    expect(snap.freshTechniqueIds).toEqual(["T1082"]);
    expect(snap.staleTechniqueIds).toEqual([]);
  });

  it("stays empty and not executed coverage when there are no supported scenarios", () => {
    const snap = deriveNavigatorFreshness({
      imported: [{ techniqueID: "T1059", state: "tested" }],
      supportedScenarioTechniqueIds: [],
      receipts: [{ techniqueID: "T1059", at: recent, kind: "lab_receipt" }]
    });
    expect(snap.numerator).toBe(0);
    expect(snap.denominator).toBe(0);
    expect(snap.empty).toBe(true);
    expect(snap.executedCoverage).toBe(false);
    expect(snap.importedCountedAsExecuted).toBe(false);
    expect(snap.summary).toBe("0 of 0 supported scenarios, window 30d");
  });

  it("never emits a coverage percent or executed-coverage claim", () => {
    const snap = deriveNavigatorFreshness({
      imported: [{ techniqueID: "T1059", state: "tested" }],
      supportedScenarioTechniqueIds: ["T1082", "T1124"],
      receipts: [
        { techniqueID: "T1082", at: recent, kind: "lab_receipt" },
        { techniqueID: "T1124", at: recent, kind: "qualified_scenario" }
      ],
      windowDays: 30
    });
    expect(snap.numerator).toBe(2);
    expect(snap.denominator).toBe(2);
    expect(snap).not.toHaveProperty("coveragePercent");
    expect(JSON.stringify(snap)).not.toMatch(/%/);
    expect(JSON.stringify(snap)).not.toMatch(/100% att/i);
    expect(snap.executedCoverage).toBe(false);
    expect(snap.summary).toBe("2 of 2 supported scenarios, window 30d");
    expect(snap.summary).not.toMatch(/%/);
  });
});
