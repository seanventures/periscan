import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBetween(source: string, startHeader: string) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  return source.slice(start);
}

describe("PRD section 25 Real-First Existing-Codebase Addendum coverage", () => {
  it("keeps the real-first source contract explicit", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 25. Real-First Existing-Codebase Addendum"
    );

    for (const requiredSourceText of [
      "The current repository is the source of truth.",
      "Preserve the existing monorepo, Fastify API, Next.js web app, Prisma data layer, policy engine, evidence packages, module registry, runner design, tests, and CI gates.",
      "Product-visible tenant data must come from real persistence, real integrations, real local lab systems, real validation modules, real evidence storage, or honest empty/not-configured states.",
      "Test fixtures remain valid for automated tests.",
      "Sample/demo reports must be isolated and clearly labeled as sample data.",
      "Do not present fake EDR, SIEM, attack-path, evidence, AI-app, fix-verification, or dashboard results as real tenant outcomes."
    ]) {
      expect(section).toContain(requiredSourceText);
    }

    for (const honestStatus of [
      "Not configured",
      "Requires integration",
      "Requires verified scope",
      "Requires internal runner",
      "Requires approval",
      "Not implemented"
    ]) {
      expect(section).toContain(`\`${honestStatus}\``);
    }
  });

  it("maps the repo-preservation and no-mock production contract to enforcement tests", async () => {
    const [
      agents,
      apiUiIntegration,
      packageJson,
      moduleRegistry,
      moduleTests,
      runnerReadme,
      workerConfigTest,
      apiEdgeRegressions,
      securityTests
    ] = await Promise.all([
      readRepoFile("AGENTS.md"),
      readRepoFile("docs/API_UI_INTEGRATION.md"),
      readRepoFile("package.json"),
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("packages/modules/src/index.test.ts"),
      readRepoFile("apps/runner/README.md"),
      readRepoFile("apps/worker/src/config.test.ts"),
      readRepoFile("tests/acceptance/api-edge-regressions.test.ts"),
      readRepoFile("tests/security/security-boundaries.test.ts")
    ]);
    const coverage = `${agents}\n${apiUiIntegration}\n${packageJson}\n${moduleRegistry}\n${moduleTests}\n${runnerReadme}\n${workerConfigTest}\n${apiEdgeRegressions}\n${securityTests}`;

    for (const architectureToken of [
      "Fastify API",
      "Next.js web app",
      "Prisma data layer",
      "policy engine",
      "module registry",
      "runner design",
      "pnpm verify"
    ]) {
      expect(coverage).toContain(architectureToken);
    }

    for (const realFirstToken of [
      "Real-First Rule",
      "never exposes a mock/demo module in the production registry or catalog",
      "mock.*",
      "blocked from the shipping catalog",
      "allows fixture targets only when dev mode is enabled outside production",
      "fixture_mode_disabled",
      "verified_scope_required"
    ]) {
      expect(coverage).toContain(realFirstToken);
    }
  });

  it("keeps sample/demo content isolated and explicitly labeled", async () => {
    const [publicDemo, publicDemoTest, demoSnapshotTest, reportsPage] =
      await Promise.all([
        readRepoFile("apps/web/src/components/public-demo-report.tsx"),
        readRepoFile("apps/web/src/components/public-demo-report.test.tsx"),
        readRepoFile("packages/shared/src/demo-snapshot.test.ts"),
        readRepoFile("apps/web/app/reports/page.tsx")
      ]);
    const coverage = `${publicDemo}\n${publicDemoTest}\n${demoSnapshotTest}\n${reportsPage}`;

    for (const sampleToken of [
      "Public sample data",
      "deterministic sample data",
      "Sample report",
      "Sample report data status: Not real customer data",
      'summary.overview).toContain("sample data")'
    ]) {
      expect(coverage).toContain(sampleToken);
    }
  });

  it("maps the competitive platform priorities to current API-first surfaces", async () => {
    const [
      findingsApi,
      remediationApi,
      triggerApi,
      dashboard,
      threatCenter,
      runtimeServices,
      reportGenerator,
      riskEngine,
      sourceLedger,
      requirementLedger
    ] = await Promise.all([
      readRepoFile("apps/api/src/services/findings.ts"),
      readRepoFile("apps/api/src/services/remediation.ts"),
      readRepoFile("apps/api/src/services/signal-triggers.ts"),
      readRepoFile("apps/web/src/components/validation-ops-dashboard.tsx"),
      readRepoFile("apps/api/src/services/threat-center.ts"),
      readRepoFile("apps/api/src/runtime-services.ts"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("packages/evidence/src/risk.ts"),
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md")
    ]);
    const coverage = `${findingsApi}\n${remediationApi}\n${triggerApi}\n${dashboard}\n${threatCenter}\n${runtimeServices}\n${reportGenerator}\n${riskEngine}`;

    for (const priorityToken of [
      "ValidatedFinding",
      "Control Verdicts",
      "score",
      "createRemediation",
      "verifyRemediation",
      "signal_trigger",
      "Evidence-backed report",
      "CTEM",
      "ThreatAdvisory"
    ]) {
      expect(coverage).toContain(priorityToken);
    }

    expect(sourceLedger).toContain("SRC-25-REAL-FIRST-ADDENDUM");
    expect(requirementLedger).toContain("PRD-REALFIRST-001");
    expect(requirementLedger).toContain("PRD-COMPLETE-001");
    expect(requirementLedger).toContain("Partial");
  });
});
