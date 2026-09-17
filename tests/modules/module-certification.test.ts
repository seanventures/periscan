import { describe, expect, it } from "vitest";

import {
  buildCertificationReport,
  renderCertificationReport
} from "../../scripts/module-certification.ts";

describe("module certification harness", () => {
  it("certifies every registered module with no hard failures", async () => {
    const report = await buildCertificationReport();

    expect(report.summary.total).toBeGreaterThan(0);
    expect(
      report.summary.notCertified,
      report.summary.failingModuleIds.join(", ")
    ).toBe(0);
    expect(report.summary.failingModuleIds).toEqual([]);
  });

  it("enforces the approval-required safety invariant for high safety levels", async () => {
    const report = await buildCertificationReport();

    const highSafety = report.modules.filter(
      (module) =>
        module.safetyLevel === "BASLite" ||
        module.safetyLevel === "AdvancedAdversarial"
    );

    for (const module of highSafety) {
      const approvalCheck = module.checks.find(
        (check) => check.id === "approval_gate"
      );
      expect(approvalCheck?.severity, module.moduleId).toBe("pass");
    }
  });

  it("flags no blocked licenses among registered modules", async () => {
    const report = await buildCertificationReport();
    const blocked = report.modules.filter(
      (module) => module.licenseDisposition === "Blocked"
    );
    expect(blocked.map((module) => module.moduleId)).toEqual([]);
  });

  it("certifies explicit safety metadata claims for registered modules", async () => {
    const report = await buildCertificationReport();

    for (const module of report.modules) {
      for (const checkId of [
        "license_risk",
        "execution_template",
        "network_metadata",
        "no_target_modification",
        "no_exfiltration",
        "no_live_destructive",
        "redaction_rules",
        "blocked_not_live"
      ]) {
        const check = module.checks.find((item) => item.id === checkId);
        expect(check?.severity, `${module.moduleId}:${checkId}`).toBe("pass");
      }

      expect(module.safetyMetadata.canModifyTarget, module.moduleId).toBe(
        false
      );
      expect(module.safetyMetadata.canExfiltrateData, module.moduleId).toBe(
        false
      );
    }
  });

  it("renders a markdown report with status and detail sections", async () => {
    const report = await buildCertificationReport();
    const markdown = renderCertificationReport(report);

    expect(markdown).toContain("# Module Certification Report");
    expect(markdown).toContain("## Module Status");
    expect(markdown).toContain("## Module Detail");
    expect(markdown).toContain("gitleaks.repo_secrets");
  });
});
