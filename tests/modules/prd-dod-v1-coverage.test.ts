import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  const end = source.indexOf(nextHeader, start + startHeader.length);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function parseBullets(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

describe("PRD section 23 Definition of Done for V1 coverage", () => {
  it("keeps every V1 DoD bullet atomized from source", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 23. Definition of Done for V1",
      "### 23.1 PRD Audit Discipline"
    );

    expect(section).toContain("Periscan V1 is done when:");
    expect(parseBullets(section)).toEqual([
      "user can self-onboard",
      "user can verify scope",
      "user can connect GitHub and AWS",
      "user can run Validation Snapshot",
      "user receives top 3-5 evidence-backed paths",
      "report includes remediation and verification plan",
      "user can create remediation task",
      "user can run fix verification",
      "evidence updates report",
      "all validation is policy-controlled and auditable",
      "no raw secrets are stored",
      "demo mode is polished enough for design partners"
    ]);
  });

  it("maps onboarding, scope, integrations, Snapshot, remediation, and verification to API tests", async () => {
    const [acceptance, e2e, firstMvpCoverage, finalLoopCoverage] =
      await Promise.all([
        readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts"),
        readRepoFile("tests/e2e/first-customer-proof-loop.spec.ts"),
        readRepoFile("tests/modules/prd-first-mvp-coverage.test.ts"),
        readRepoFile("tests/modules/prd-final-build-rule-coverage.test.ts")
      ]);
    const coverage = `${acceptance}\n${e2e}\n${firstMvpCoverage}\n${finalLoopCoverage}`;

    for (const requiredToken of [
      "/auth/signup",
      "/api/v1/auth/signup",
      "/api/v1/scopes",
      "/verify",
      "/integrations/github/connect",
      "/integrations/aws/connect",
      "/snapshots",
      "maxTopItems: 5",
      "topAttackPaths",
      "evidenceIds",
      "/remediations",
      "/mark-ready-for-verification",
      "/verify",
      "verificationEvent.evidenceIds",
      '["Fixed", "StillExposed"]'
    ]) {
      expect(coverage).toContain(requiredToken);
    }
  });

  it("proves reports include remediation, verification plan, and fresh verification evidence", async () => {
    const [acceptance, reportTests, reportsSource, firstMvpCoverage] =
      await Promise.all([
        readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts"),
        readRepoFile("packages/reports/src/index.test.ts"),
        readRepoFile("packages/reports/src/index.ts"),
        readRepoFile("tests/modules/prd-first-mvp-coverage.test.ts")
      ]);
    const coverage = `${acceptance}\n${reportTests}\n${reportsSource}\n${firstMvpCoverage}`;

    for (const reportProofToken of [
      "Remediation Priorities",
      "Verification Plan",
      "Last verification:",
      "verificationEvent.outcome",
      "reportExportResponse.body",
      "renderValidationSnapshotReportHtml",
      "renderValidationSnapshotReportPdf"
    ]) {
      expect(coverage).toContain(reportProofToken);
    }
  });

  it("keeps policy, audit, no-raw-secret, and design-partner DoD bullets tested", async () => {
    const [
      acceptance,
      security,
      demoStoryCoverage,
      publicDemo,
      sourceLedger,
      requirementLedger
    ] = await Promise.all([
      readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts"),
      readRepoFile("tests/security/security-boundaries.test.ts"),
      readRepoFile("tests/modules/prd-demo-story-coverage.test.ts"),
      readRepoFile("apps/web/src/components/public-demo-report.tsx"),
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md")
    ]);
    const coverage = `${acceptance}\n${security}\n${demoStoryCoverage}\n${publicDemo}`;

    for (const safetyToken of [
      "policy.decision",
      "DeniedByPolicy",
      "/api/v1/audit-events",
      'not.toContain("AKIA")',
      'not.toContain("password=")',
      "/api/v1/tenants/current/design-partner",
      "Periscan Analyst Notes",
      "MVP success signal",
      "Sample report"
    ]) {
      expect(coverage).toContain(safetyToken);
    }

    expect(sourceLedger).toContain("SRC-23-DOD-V1");
    expect(requirementLedger).toContain("PRD-DOD-001");
    expect(requirementLedger).toContain("PRD-COMPLETE-001");
    expect(requirementLedger).toContain("Partial");
  });
});
