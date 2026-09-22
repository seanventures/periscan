import { describe, expect, it } from "vitest";

import {
  ATTACK_TECHNIQUE_COVERAGE_DISCLAIMER,
  ATTACK_TECHNIQUE_COVERAGE_LABELS,
  AttackTechniqueWithCoverageSchema,
  LIVE_DISABLED_EXECUTION_NOTE,
  LIVE_DISABLED_TOOLCHAIN_MODULE_IDS,
  attachAttackTechniqueCoverage,
  getAttackTechniqueCoverage,
  listAttackTechniqueCoverage
} from "./attack-technique-coverage";
import { getAttackTechniqueById, listAttackTechniques } from "./mitre-attack";
import { listControlValidationScenarios } from "./validation-catalog";

describe("ATT&CK → safe-module coverage map", () => {
  it("covers every attack-techniques catalog id with a coverage label", () => {
    const coverage = listAttackTechniqueCoverage();
    const catalogIds = listAttackTechniques().map(
      (technique) => technique.techniqueId
    );

    expect(catalogIds.length).toBeGreaterThan(0);
    expect(coverage.map((row) => row.techniqueId)).toEqual(
      expect.arrayContaining(catalogIds)
    );

    for (const row of coverage) {
      expect(["Safe module", "Catalog only", "Live disabled"]).toContain(
        row.coverageLabel
      );
      expect(ATTACK_TECHNIQUE_COVERAGE_LABELS[row.coverage]).toBe(
        row.coverageLabel
      );
    }
  });

  it("maps unsecured credentials to the gitleaks safe module", () => {
    const row = getAttackTechniqueCoverage("T1552");
    expect(row?.coverageLabel).toBe("Safe module");
    expect(row?.safeModuleId).toBe("gitleaks.repo_secrets");
    expect(row?.executionNote).toBeNull();
  });

  it("marks Atomic-bound catalog techniques live disabled, not executed", () => {
    const scanning = getAttackTechniqueCoverage("T1595");
    expect(scanning?.coverageLabel).toBe("Live disabled");
    expect(scanning?.safeModuleId).toBeNull();
    expect(scanning?.executionNote).toBe("not executed (live disabled)");
    expect(scanning?.executionNote).toBe(LIVE_DISABLED_EXECUTION_NOTE);
    expect(scanning?.liveDisabledModuleIds).toContain(
      "atomic.control_validation_safe"
    );

    const accountDiscovery = getAttackTechniqueCoverage("T1087");
    expect(accountDiscovery?.coverageLabel).toBe("Live disabled");
    expect(accountDiscovery?.executionNote).toBe(
      "not executed (live disabled)"
    );
  });

  it("keeps valid-accounts as catalog only when no safe module exists", () => {
    const row = getAttackTechniqueCoverage("T1078");
    expect(row?.coverageLabel).toBe("Catalog only");
    expect(row?.safeModuleId).toBeNull();
    expect(row?.executionNote).toBeNull();
  });

  it("prefers a safe module over Atomic dry-run for impair-defenses", () => {
    const row = getAttackTechniqueCoverage("T1562");
    expect(row?.coverageLabel).toBe("Safe module");
    expect(row?.safeModuleId).toBe("periscan.endpoint_benign_marker_emit");
    expect(
      listControlValidationScenarios().some(
        (scenario) =>
          scenario.techniqueId === "T1562" &&
          scenario.moduleId === "atomic.control_validation_safe"
      )
    ).toBe(true);
  });

  it("accepts extra Atomic/Caldera bindings without inventing BAS parity", () => {
    const coverage = listAttackTechniqueCoverage([
      { techniqueId: "T1087", moduleId: "caldera.advanced_adversarial" },
      { techniqueId: "T9999", moduleId: "caldera.advanced_adversarial" }
    ]);
    const extra = coverage.find((row) => row.techniqueId === "T9999");
    expect(extra?.coverageLabel).toBe("Live disabled");
    expect(extra?.executionNote).toBe("not executed (live disabled)");
    expect(extra?.liveDisabledModuleIds).toContain(
      "caldera.advanced_adversarial"
    );

    expect(coverage.length).toBeLessThan(50);
    expect(ATTACK_TECHNIQUE_COVERAGE_DISCLAIMER.toLowerCase()).toContain(
      "partial att&ck mapping"
    );
    expect(ATTACK_TECHNIQUE_COVERAGE_DISCLAIMER.toLowerCase()).toContain(
      "execution coverage requires measured receipts"
    );
    expect(
      coverage.some((row) => /bas parity|100% att&ck/i.test(row.techniqueId))
    ).toBe(false);
  });

  it("pins live-disabled toolchain module ids to Atomic and Caldera", () => {
    expect([...LIVE_DISABLED_TOOLCHAIN_MODULE_IDS].sort()).toEqual([
      "atomic.control_validation_safe",
      "caldera.advanced_adversarial"
    ]);
  });

  it("attaches coverage fields onto a catalog technique for the API", () => {
    const technique = getAttackTechniqueById("T1595");
    expect(technique).not.toBeNull();
    const attached = attachAttackTechniqueCoverage(technique!);
    expect(AttackTechniqueWithCoverageSchema.parse(attached)).toMatchObject({
      coverageLabel: "Live disabled",
      executionNote: "not executed (live disabled)",
      techniqueId: "T1595"
    });
  });
});
