import { describe, expect, it } from "vitest";

import {
  buildPrdAuditReport,
  formatPrdAuditReport
} from "../../scripts/prd-audit-gate.js";

describe("PRD audit gate", () => {
  it("allows full-product completion only when source and requirement ledgers are clean", async () => {
    const report = await buildPrdAuditReport(
      new URL("../..", import.meta.url).pathname
    );

    expect(report.protocolPresent).toBe(true);
    expect(report.completionReportMode).toBe("FullProductCompletion");
    expect(report.completionReportScoped).toBe(false);
    expect(report.canClaimFullProductComplete).toBe(true);
    expect(report.sourceCoverage.total).toBeGreaterThan(20);
    expect(report.sourceCoverage.unresolved).toHaveLength(0);
    expect(report.sourceCoverage.byStatus.EvidenceMapped).toBeGreaterThan(30);
    expect(report.sourceCoverage.unresolved.map((row) => row.id)).not.toContain(
      "SRC-14-RUNNER"
    );
    expect(report.requirementLedger.unresolved).toHaveLength(0);
    expect(
      report.requirementLedger.unresolved.map((row) => row.id)
    ).not.toContain("PRD-RUNNER-003");

    const formatted = formatPrdAuditReport(report);
    expect(formatted).toContain("Can claim full product complete: yes");
    expect(formatted).toContain(
      "Completion report mode: FullProductCompletion"
    );
    expect(formatted).toContain(
      "Source sections pending atomization/audit:\n- none"
    );
    expect(formatted).toContain(
      "Requirement atoms blocking full completion claims:\n- none"
    );
  });

  it("does not allow unresolved runner or self-referential completion atoms", async () => {
    const report = await buildPrdAuditReport(
      new URL("../..", import.meta.url).pathname
    );

    expect(report.sourceCoverage.unresolved).toHaveLength(0);
    expect(
      report.requirementLedger.unresolved.map((row) => row.id)
    ).not.toContain("PRD-COMPLETE-001");
    expect(
      report.requirementLedger.unresolved.map((row) => row.id)
    ).not.toContain("PRD-RUNNER-003");
    expect(report.canClaimFullProductComplete).toBe(true);
  });
});
