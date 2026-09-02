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

function indexAfter(source: string, token: string, after = 0) {
  const index = source.indexOf(token, after);

  if (index === -1) {
    throw new Error(`Unable to find token after ${after}: ${token}`);
  }

  return index;
}

describe("PRD section 24 Final Build Rule coverage", () => {
  it("keeps the source loop explicit and API-first", async () => {
    const [prd, apiSource] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/api/src/app.ts")
    ]);
    const section = sectionBetween(
      prd,
      "## 24. Final Build Rule",
      "## 25. Real-First Existing-Codebase Addendum"
    );
    const loopMatch = section.match(
      /connect\s*->\s*validate\s*->\s*evidence\s*->\s*fix\s*->\s*verify\s*->\s*report/u
    );
    const loopStages =
      loopMatch?.[0].split("->").map((stage) => stage.trim()) ?? [];

    expect(section).toContain("Build the proof loop first.");
    expect(loopStages).toEqual([
      "connect",
      "validate",
      "evidence",
      "fix",
      "verify",
      "report"
    ]);
    expect(section).toContain("Everything else is expansion.");

    for (const routeToken of [
      '"/api/v1/integrations"',
      '"/api/v1/integrations/github/connect"',
      '"/api/v1/integrations/aws/connect"',
      '"/api/v1/integrations/:id/sync"',
      '"/api/v1/snapshots"',
      '"/api/v1/evidence"',
      '"/api/v1/remediations"',
      '"/api/v1/remediations/:id/mark-ready-for-verification"',
      '"/api/v1/remediations/:id/verify"',
      '"/api/v1/reports"',
      '"/api/v1/reports/:id/export"'
    ]) {
      expect(apiSource).toContain(routeToken);
    }
  });

  it("proves the ordered loop in first-customer API acceptance coverage", async () => {
    const [acceptance, e2e] = await Promise.all([
      readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts"),
      readRepoFile("tests/e2e/first-customer-proof-loop.spec.ts")
    ]);
    const proofLoopCoverage = `${acceptance}\n${e2e}`;
    const connectIndex = indexAfter(
      proofLoopCoverage,
      "/integrations/github/connect"
    );
    const validateIndex = indexAfter(
      proofLoopCoverage,
      "maxTopItems: 5",
      connectIndex
    );
    const evidenceIndex = indexAfter(
      proofLoopCoverage,
      "evidenceIds.length).toBeGreaterThan(0)",
      validateIndex
    );
    const fixIndex = indexAfter(
      proofLoopCoverage,
      'url: "/api/v1/remediations"',
      evidenceIndex
    );
    const verifyIndex = indexAfter(proofLoopCoverage, "/verify`", fixIndex);
    const reportIndex = indexAfter(
      proofLoopCoverage,
      'url: "/api/v1/reports"',
      verifyIndex
    );
    const exportIndex = indexAfter(proofLoopCoverage, "/export", reportIndex);

    expect(connectIndex).toBeLessThan(validateIndex);
    expect(validateIndex).toBeLessThan(evidenceIndex);
    expect(evidenceIndex).toBeLessThan(fixIndex);
    expect(fixIndex).toBeLessThan(verifyIndex);
    expect(verifyIndex).toBeLessThan(reportIndex);
    expect(reportIndex).toBeLessThan(exportIndex);

    for (const sourceGuard of [
      "Verified scope",
      "mockMode: true",
      "signalCount).toBeGreaterThan(0)",
      'evidencePack.status).toBe("Ready")',
      "verificationEvent.evidenceIds.length",
      '["Fixed", "StillExposed"]',
      "content-type"
    ]) {
      expect(proofLoopCoverage).toContain(sourceGuard);
    }
  });

  it("keeps final-loop completion separate from broad product-complete claims", async () => {
    const [sourceLedger, requirementLedger, auditGate] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("scripts/prd-audit-gate.ts")
    ]);

    expect(sourceLedger).toContain("SRC-24-FINAL-BUILD-RULE");
    expect(requirementLedger).toContain("PRD-FINAL-001");
    expect(auditGate).toContain("canClaimFullProductComplete");
    expect(auditGate).toContain("SOURCE_READY_STATUSES");
    expect(auditGate).toContain("REQUIREMENT_UNRESOLVED_STATUSES");
    expect(requirementLedger).toContain("PRD-COMPLETE-001");
    expect(requirementLedger).toContain("Partial");
  });
});
