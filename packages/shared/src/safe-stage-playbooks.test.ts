import { describe, expect, it } from "vitest";

import {
  SAFE_STAGE_PLAYBOOKS,
  buildSafeStageHandoffSummary,
  getSafeStagePlaybook,
  listExecutableSafeStages,
  listForbiddenSafeStages
} from "./safe-stage-playbooks";

describe("safe-stage playbooks (P05-17)", () => {
  it("maps every playbook to a measurement class and never assigns modules to Forbidden", () => {
    for (const playbook of SAFE_STAGE_PLAYBOOKS) {
      expect(["Exposure", "Detection", "Config", "Forbidden"]).toContain(
        playbook.measurementClass
      );
      if (playbook.measurementClass === "Forbidden") {
        expect(playbook.defaultModuleId).toBeNull();
        expect(playbook.successCriteria).toContain("NotAttempted");
      }
    }
  });

  it("keeps ransomware impact Forbidden with no module", () => {
    const ransomware = getSafeStagePlaybook("T1486");
    expect(ransomware?.measurementClass).toBe("Forbidden");
    expect(ransomware?.defaultModuleId).toBeNull();
  });

  it("maps credential access to Exposure via secrets scan, not spray", () => {
    const creds = getSafeStagePlaybook("T1110");
    expect(creds?.measurementClass).toBe("Exposure");
    expect(creds?.defaultModuleId).toBe("gitleaks.repo_secrets");
    expect(creds?.playbookTitle.toLowerCase()).toContain("exposure");
  });

  it("lists only executable stages with modules", () => {
    const executable = listExecutableSafeStages();
    expect(executable.length).toBeGreaterThan(0);
    expect(executable.every((p) => p.defaultModuleId)).toBe(true);
    expect(listForbiddenSafeStages().length).toBeGreaterThan(0);
  });

  it("builds an honest RT handoff summary", () => {
    const handoff = buildSafeStageHandoffSummary({
      provedTechniqueIds: ["T1110", "T1190"],
      targetLabel: "lab.example"
    });
    expect(handoff.proved.map((p) => p.techniqueId).sort()).toEqual([
      "T1110",
      "T1190"
    ]);
    expect(handoff.notAttempted.some((p) => p.techniqueId === "T1486")).toBe(
      true
    );
    expect(handoff.summary).toMatch(/schedule human RT/i);
    expect(handoff.summary).toMatch(/lab\.example/);
  });
});
