import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { renderValidationSnapshotReportHtml } from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";

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

function parseBulletsBetween(
  section: string,
  startLabel: string,
  endLabel: string
) {
  return sectionBetween(section, startLabel, endLabel)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

describe("PRD section 1 Product Vision coverage", () => {
  it("keeps every source vision claim explicit", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 1. Product Vision",
      "## 2. Product Principles"
    );
    const questions = parseBulletsBetween(
      section,
      "They still struggle to answer:",
      "Periscan answers"
    );

    expect(section).toContain("validation and proof layer for modern security");
    expect(questions).toEqual([
      "What can actually compromise us?",
      "Would our controls catch it?",
      "Which path matters most?",
      "What should we fix first?",
      "Did the fix actually work?",
      "Can we prove it?"
    ]);
    expect(section).toContain(
      "continuously validating exposure, controls, attack paths, AI applications, and remediation outcomes"
    );
    expect(section).toContain("not a scanner dashboard");
    expect(section).toContain("not a traditional pentest");
    expect(section).toContain("not a generic BAS tool");
    expect(section).toContain("evidence-backed validation system");
    for (const thirdPartyGate of [
      "reviewed catalog metadata",
      "module/capability implementation",
      "required evidence",
      "tenant governance",
      "runtime readiness",
      "runner prerequisites",
      "policy gates",
      "safety boundaries",
      "API-visible reports"
    ]) {
      expect(section).toContain(thirdPartyGate);
    }
  });

  it("maps every vision question to API-first product contracts", async () => {
    const [
      apiSource,
      correlationSource,
      riskSource,
      runtimeServices,
      remediationService,
      sharedDomain,
      reportsSource,
      acceptanceFlow
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/evidence/src/correlation.ts"),
      readRepoFile("packages/evidence/src/risk.ts"),
      readRepoFile("apps/api/src/runtime-services.ts"),
      readRepoFile("apps/api/src/services/remediation.ts"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts")
    ]);
    const implementationEvidence = [
      apiSource,
      correlationSource,
      riskSource,
      runtimeServices,
      remediationService,
      sharedDomain,
      reportsSource,
      acceptanceFlow
    ].join("\n");

    for (const routeToken of [
      '"/api/v1/findings"',
      '"/api/v1/attack-paths"',
      '"/api/v1/attack-paths/:id/verify"',
      '"/api/v1/control-sources/:id/validate"',
      '"/api/v1/control-sources/rule-coverage"',
      '"/api/v1/remediations"',
      '"/api/v1/remediations/:id/mark-ready-for-verification"',
      '"/api/v1/remediations/:id/verify"',
      '"/api/v1/evidence"',
      '"/api/v1/reports"',
      '"/api/v1/snapshots"'
    ]) {
      expect(apiSource).toContain(routeToken);
    }

    for (const implementationToken of [
      "correlateAttackPaths",
      "assessAttackPathRisk",
      "ensureSnapshotRemediationForPath",
      "VerificationEventSchema",
      "EvidencePackSchema",
      "evidenceIds",
      "latestVerification",
      "risk.score",
      "verificationEvent.evidenceIds.length"
    ]) {
      expect(implementationEvidence).toContain(implementationToken);
    }

    expect(implementationEvidence).toContain(
      ".sort((left, right) => right.risk.score - left.risk.score)"
    );
  });

  it("maps continuous validation domains to implemented API and backend surfaces", async () => {
    const [
      apiSource,
      sharedDomain,
      scheduleService,
      runtimeServices,
      controlAiService,
      remediationService
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("apps/api/src/services/schedules.ts"),
      readRepoFile("apps/api/src/runtime-services.ts"),
      readRepoFile("apps/api/src/services/control-ai.ts"),
      readRepoFile("apps/api/src/services/remediation.ts")
    ]);
    const continuousEvidence = [
      apiSource,
      sharedDomain,
      scheduleService,
      runtimeServices,
      controlAiService,
      remediationService
    ].join("\n");

    for (const domainRoute of [
      '"/api/v1/schedules"',
      '"/api/v1/findings"',
      '"/api/v1/control-sources"',
      '"/api/v1/attack-paths"',
      '"/api/v1/ai-apps"',
      '"/api/v1/remediations/:id/verify"'
    ]) {
      expect(apiSource).toContain(domainRoute);
    }

    for (const domainToken of [
      "ContinuousValidation",
      "buildScheduleDiff",
      "ReopenedRiskDetected",
      "Reopened",
      "AIApplication",
      "ControlSource",
      "AttackPath",
      "Exposure",
      "VerificationEvent"
    ]) {
      expect(continuousEvidence).toContain(domainToken);
    }
  });

  it("keeps the product from degrading into scanner, pentest, or generic BAS UX", async () => {
    const [
      findingsPage,
      navigationSource,
      reportSource,
      publicDemo,
      securityBoundaries
    ] = await Promise.all([
      readRepoFile("apps/web/src/components/findings-workbench.tsx"),
      readRepoFile("apps/web/src/lib/primary-nav.tsx"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("apps/web/src/components/public-demo-report.tsx"),
      readRepoFile("docs/SECURITY_BOUNDARIES.md")
    ]);
    const snapshot = createPublicDemoValidationSnapshot();
    const renderedReport = renderValidationSnapshotReportHtml(snapshot);
    const primaryUx = normalize(
      `${findingsPage}\n${navigationSource}\n${reportSource}\n${publicDemo}\n${renderedReport}`
    );

    expect(primaryUx).toContain(normalize("Findings"));
    expect(primaryUx).toContain(normalize("evidence-backed results layer"));
    expect(primaryUx).toContain(normalize("Priority Attack Paths"));
    expect(primaryUx).toContain(normalize("Control Verdicts"));
    expect(primaryUx).toContain(normalize("Remediation Priorities"));
    expect(primaryUx).toContain(normalize("Verification Plan"));
    expect(publicDemo).toContain("This is not a scanner");
    expect(reportSource).toContain(
      "raw tool output excluded from the primary report"
    );
    expect(reportSource).toContain("Periscan Technical Appendix");
    expect(securityBoundaries).toContain(
      "Raw scanner output must not be primary UX"
    );
    // Single nav source uses honest Findings label for /findings.
    expect(navigationSource).toContain('label: "Findings"');
    expect(navigationSource).toContain('href: "/findings"');
  });

  it("maps third-party tool vision gates to read-only certification and governance evidence", async () => {
    const [
      apiSource,
      thirdPartyService,
      openSourceDocs,
      registryCenter,
      sharedOpenSource
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/api/src/services/third-party-tools.ts"),
      readRepoFile("docs/OPEN_SOURCE_VALIDATION_ENGINES.md"),
      readRepoFile("apps/web/src/components/registry-center.tsx"),
      readRepoFile("packages/shared/src/open-source.ts")
    ]);
    const governanceEvidence = [
      apiSource,
      thirdPartyService,
      openSourceDocs,
      registryCenter,
      sharedOpenSource
    ].join("\n");

    for (const routeToken of [
      '"/api/v1/third-party-tools"',
      '"/api/v1/third-party-tools/coverage-audit"',
      '"/api/v1/third-party-tools/intake/validate"',
      '"/api/v1/third-party-tools/intake/candidates"',
      '"/api/v1/third-party-tools/intake/candidates/:candidateId/readiness"',
      '"/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages"',
      '"/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certification-report"',
      '"/api/v1/third-party-tools/intake/candidates/:candidateId/promotion-packages/:promotionPackageId/certifications"',
      '"/api/v1/third-party-tools/:toolId/runner-eligibility"',
      '"/api/v1/third-party-tools/:toolId/runner-dispatch"'
    ]) {
      expect(apiSource).toContain(routeToken);
    }

    for (const certificationGate of [
      "Reviewed catalog entry exists for the tool.",
      "Registered module manifest declares the promoted tool ID.",
      "Runtime readiness is captured in the promotion package snapshot.",
      "Internal runner readiness",
      "Execution policy gates",
      "Read-only certification boundary",
      "verified scope",
      "tenant governance",
      "runtime readiness",
      "runner prerequisites",
      "policy decisions",
      "audit logging",
      "requiredEvidence"
    ]) {
      expect(governanceEvidence).toContain(certificationGate);
    }

    expect(registryCenter).toContain("Load certification report");
    expect(registryCenter).toContain("Save certification snapshot");
    expect(registryCenter).toContain(
      "Read-only certification. No enablement, installs"
    );
  });

  it("keeps Product Vision completion tied to source-derived ledgers", async () => {
    const [sourceLedger, requirementLedger, traceability] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md")
    ]);

    expect(sourceLedger).toContain("SRC-1-VISION");
    expect(requirementLedger).toContain("PRD-VISION-001");
    expect(requirementLedger).toContain("PRD-VISION-006");
    expect(traceability).toContain("SRC-1-VISION");
  });
});
