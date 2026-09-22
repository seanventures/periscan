import { describe, expect, it } from "vitest";

import { ATTACK_NAVIGATOR_DEFAULT_WINDOW_DAYS } from "@periscan/shared";

import { exportAttackNavigatorFreshness } from "./attack-navigator-freshness.js";

describe("ATT&CK Navigator freshness export (PERISCAN-591)", () => {
  const recent = new Date().toISOString();
  const staleAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();

  it("excludes imported techniques from the executed numerator", () => {
    const exported = exportAttackNavigatorFreshness({
      imported: [{ techniqueID: "T1059", state: "tested" }],
      name: "Tenant freshness export",
      receipts: [{ techniqueID: "T1082", at: recent, kind: "lab_receipt" }],
      supportedScenarioTechniqueIds: ["T1082", "T1124"],
      windowDays: 30
    });

    expect(exported.freshness.numerator).toBe(1);
    expect(exported.freshness.denominator).toBe(2);
    expect(exported.freshness.summary).toBe(
      "1 of 2 supported scenarios, window 30d"
    );
    expect(exported.executedCoverage).toBe(false);
    expect(exported.executable).toBe(false);
    expect(exported.importedCountedAsExecuted).toBe(false);
    expect(exported.liveSupported).toBe(false);
    expect(exported.freshness.executedCoverage).toBe(false);
    expect(exported.freshness.importedCountedAsExecuted).toBe(false);
  });

  it("declares stale vs fresh against the supported-scenario denominator", () => {
    const exported = exportAttackNavigatorFreshness({
      imported: [],
      receipts: [
        { techniqueID: "T1082", at: recent, kind: "control_validation" },
        { techniqueID: "T1124", at: staleAt, kind: "qualified_scenario" }
      ],
      supportedScenarioTechniqueIds: ["T1082", "T1124"]
    });

    expect(exported.freshness.windowDays).toBe(
      ATTACK_NAVIGATOR_DEFAULT_WINDOW_DAYS
    );
    expect(exported.freshness.freshTechniqueIds).toEqual(["T1082"]);
    expect(exported.freshness.staleTechniqueIds).toEqual(["T1124"]);
    expect(exported.freshness.numerator).toBe(1);
    expect(exported.freshness.denominator).toBe(2);
    expect(exported.metadata).toEqual(
      expect.arrayContaining([
        { name: "executedCoverage", value: "false" },
        { name: "liveSupported", value: "false" },
        { name: "importedCountedAsExecuted", value: "false" },
        { name: "freshness.numerator", value: "1" },
        { name: "freshness.denominator", value: "2" },
        { name: "freshness.windowDays", value: "30" },
        {
          name: "freshness.summary",
          value: "1 of 2 supported scenarios, window 30d"
        }
      ])
    );
  });

  it("never emits a coverage percent, MITRE catalog denominator, or executed coverage", () => {
    const imported = Array.from({ length: 50 }, (_, index) => ({
      state: "tested" as const,
      techniqueID: `T${String(1000 + index).padStart(4, "0")}`
    }));
    const exported = exportAttackNavigatorFreshness({
      imported,
      receipts: [{ techniqueID: "T1082", at: recent, kind: "lab_receipt" }],
      supportedScenarioTechniqueIds: ["T1082", "T1124"]
    });

    expect(exported.freshness.denominator).toBe(2);
    expect(exported.freshness.denominator).not.toBe(imported.length);
    expect(exported).not.toHaveProperty("coveragePercent");
    expect(JSON.stringify(exported)).not.toMatch(/%/);
    expect(JSON.stringify(exported).toLowerCase()).not.toMatch(/100% att/);
    expect(exported.description.toLowerCase()).toMatch(/not executed coverage/);
    expect(exported.description.toLowerCase()).toMatch(/supported scenarios/);
  });
});
