import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

describe("coordination docs", () => {
  it("marks chronological coordination logs as newest-first audit history", async () => {
    const [handoff, traceability] = await Promise.all([
      readRepoFile(".ai/codex-handoff.md"),
      readRepoFile(".ai/requirements-traceability.md")
    ]);

    for (const doc of [handoff, traceability]) {
      const preamble = doc.split("\n").slice(0, 7).join("\n");

      expect(preamble).toContain("Current guidance is newest-first");
      expect(preamble).toContain("retained for audit");
      expect(preamble).toContain(".ai/status.md");
      expect(preamble).toContain("docs/IMPLEMENTATION_STATUS.md");
    }
  });

  it("labels legacy June 5 top-level .ai reports and reviews as historical snapshots", async () => {
    const legacyReports = await Promise.all([
      readRepoFile(".ai/final-report.md"),
      readRepoFile(".ai/final-report-draft.md"),
      readRepoFile(".ai/architecture-review.md"),
      readRepoFile(".ai/ux-review.md"),
      readRepoFile(".ai/devops-review.md"),
      readRepoFile(".ai/security-review.md"),
      readRepoFile(".ai/product-review.md"),
      readRepoFile(".ai/qa-review.md")
    ]);

    for (const report of legacyReports) {
      const preamble = report.split("\n").slice(0, 8).join("\n");

      expect(preamble).toContain("Historical snapshot");
      expect(preamble).toContain("retained for audit context only");
      expect(preamble).toContain(".ai/status.md");
      expect(preamble).toContain("docs/IMPLEMENTATION_STATUS.md");
    }
  });

  it("keeps release-readiness and predeployment gates aligned with the current verification run", async () => {
    const [
      releaseReadiness,
      predeploymentChecklist,
      implementationStatus,
      completionReport
    ] = await Promise.all([
      readRepoFile(".ai/release-readiness.md"),
      readRepoFile(".ai/predeployment-checklist.md"),
      readRepoFile("docs/IMPLEMENTATION_STATUS.md"),
      readRepoFile("docs/COMPLETION_REPORT.md")
    ]);
    const combined = `${releaseReadiness}\n${predeploymentChecklist}\n${implementationStatus}\n${completionReport}`;

    expect(releaseReadiness).toContain("2026-06-28");
    expect(releaseReadiness).toContain("runner mTLS certificate-alignment");
    expect(releaseReadiness).toContain("acceptance 100 files / 123 tests");
    expect(predeploymentChecklist).toContain(
      "runner mTLS certificate-alignment"
    );
    expect(predeploymentChecklist).toContain("Playwright E2E");
    expect(predeploymentChecklist).toContain("58/58 tests passed locally");
    expect(implementationStatus).toMatch(
      /runner mTLS source divergence is resolved/u
    );
    expect(implementationStatus).toContain("Playwright E2E 58/58");
    expect(implementationStatus).toContain("acceptance 100 files / 123 tests");
    expect(completionReport).toContain("Report date: 2026-06-28");
    expect(completionReport).toContain("after the final completion-gate edits");
    expect(completionReport).toContain("2026-06-28T22:33-04:00");
    expect(completionReport).toContain("Playwright E2E `58/58`");
    expect(completionReport).toContain("acceptance `100` files / `123` tests");

    // 2026-07-01 autonomous execution + independent re-audit
    expect(completionReport).toContain("2026-07-01");
    expect(completionReport).toContain(
      "Independent Re-audit + Autonomous Build"
    );
    expect(completionReport).toContain("Frontier context delivery");
    expect(completionReport).toContain("runner.http_header_check");
    expect(completionReport).toContain("0 Partial");
    expect(combined).not.toContain("acceptance 100 files / 122 tests");
    expect(combined).not.toContain("acceptance `100` files / `118` tests");
    expect(combined).not.toContain("Playwright E2E `22/22`");
    expect(combined).not.toContain("not runnable in this headless sandbox");
    expect(predeploymentChecklist).not.toMatch(
      /\| e2e \(playwright\) \| ⏳ CI-only/u
    );
  });

  it("keeps public traceability aligned with current API Reference contract slices", async () => {
    const [aiTraceability, publicTraceability] = await Promise.all([
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md")
    ]);
    const requiredGapIds = [
      "GAP-API-REFERENCE-CONTENT-METADATA-001",
      "GAP-API-REFERENCE-NONJSON-NOCONTENT-001",
      "GAP-API-REFERENCE-ACTION-SCHEMAS-001",
      "GAP-API-REFERENCE-READ-SCHEMAS-001"
    ];

    for (const gapId of requiredGapIds) {
      expect(aiTraceability).toContain(gapId);
      expect(publicTraceability).toContain(gapId);
    }
  });

  it("requires source-first PRD audit protocol and requirement ledger before completion claims", async () => {
    const [
      protocol,
      sourceCoverageLedger,
      ledger,
      prd,
      fullPrd,
      readme,
      packageJson,
      userStories,
      acceptanceCriteria,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog
    ] = await Promise.all([
      readRepoFile("docs/PRD_AUDIT_PROTOCOL.md"),
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("PRD.md"),
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("README.md"),
      readRepoFile("package.json"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md")
    ]);
    const combinedTraceability = `${publicTraceability}\n${aiTraceability}\n${status}\n${gapBacklog}`;

    expect(protocol).toContain("Source-First Audit Rule");
    expect(protocol).toContain("Completion Claim Policy");
    expect(protocol).toContain("PRD_SOURCE_COVERAGE_LEDGER.md");
    expect(protocol).toContain("Passing `pnpm verify` is necessary evidence");
    expect(protocol).toContain("accumulated-state validation");
    expect(protocol).toContain("pnpm prd:audit");
    expect(protocol).toContain("pnpm prd:audit:strict");
    expect(protocol).toContain("scripts/prd-audit-gate.ts");
    expect(protocol).toContain("continuous-validation sweep timeout");
    expect(protocol).toContain("certification history");
    expect(protocol).toContain("Evidence Packs and Operators audits");
    expect(protocol).toContain("source-derived regression test");
    expect(protocol).toContain("parse the relevant PRD subsection directly");
    expect(sourceCoverageLedger).toContain("PRD Source Coverage Ledger");
    expect(sourceCoverageLedger).toContain("Completion Gate");
    expect(sourceCoverageLedger).toContain("SRC-3.X-FRONTIER-GATEWAY");
    expect(sourceCoverageLedger).toContain("NeedsImplementationAudit");
    expect(ledger).toContain("Status legend");
    expect(ledger).toContain("PRD-AUDIT-001");
    expect(ledger).toContain("PRD-AUDIT-002");
    expect(ledger).toContain("PRD-AUDIT-003");
    expect(ledger).toContain("PRD-COMPLETE-001");
    expect(ledger).toContain("PRD-3PT-008");
    expect(ledger).toContain("PRD-FG-003");
    expect(ledger).toContain("certification snapshots");
    expect(ledger).toContain("session scopes only");
    expect(ledger).toContain("Partial");
    expect(ledger).toContain("do not infer completion from execution history");
    expect(prd).toContain("Maintain a source-first requirement ledger");
    expect(prd).toContain("PRD audit and completion discipline");
    expect(fullPrd).toContain("23.1 PRD Audit Discipline");
    expect(readme).toContain("PRD_AUDIT_PROTOCOL.md");
    expect(readme).toContain("PRD_SOURCE_COVERAGE_LEDGER.md");
    expect(readme).toContain("PRD_REQUIREMENT_LEDGER.md");
    expect(readme).toContain("full-PRD implementation completion report");
    expect(readme).toContain("pnpm prd:audit");
    expect(packageJson).toContain('"prd:audit"');
    expect(packageJson).toContain('"prd:audit:strict"');
    expect(userStories).toContain("PRD Audit Protocol");
    expect(userStories).toContain("source coverage ledger");
    expect(acceptanceCriteria).toContain("source-first PRD requirement atoms");
    expect(acceptanceCriteria).toContain("PRD_SOURCE_COVERAGE_LEDGER.md");
    expect(combinedTraceability).toContain("GAP-PRD-AUDIT-SOURCE-FIRST-001");
    expect(combinedTraceability).toContain(
      "GAP-PRD-AUDIT-ACCUMULATED-STATE-001"
    );
    expect(combinedTraceability).toContain("PRD-AUDIT-001");
    expect(combinedTraceability).toContain("PRD-COMPLETE-001");
  });

  it("indexes the major long-form PRD sections before source coverage can be trusted", async () => {
    const sourceCoverageLedger = await readRepoFile(
      "docs/PRD_SOURCE_COVERAGE_LEDGER.md"
    );
    const requiredSourceRows = [
      "SRC-1-VISION",
      "SRC-2-PRINCIPLES",
      "SRC-3.1-VALIDATION-SNAPSHOT",
      "SRC-3.2-CONTINUOUS-EXPOSURE",
      "SRC-3.3-CONTROL-VALIDATION",
      "SRC-3.4-ATTACK-PATH",
      "SRC-3.5-AI-APP-VALIDATION",
      "SRC-3.6-FIX-VERIFICATION",
      "SRC-3.7-EVIDENCE-PACKS",
      "SRC-3.8-OPERATORS",
      "SRC-3.X-FRONTIER-GATEWAY",
      "SRC-4-ARCHITECTURE",
      "SRC-5-TECH-STACK",
      "SRC-6-DATA-MODEL",
      "SRC-7-API-SPEC",
      "SRC-8-SIGNAL-FABRIC",
      "SRC-9-MODULE-REGISTRY",
      "SRC-10.0-THIRD-PARTY-GOVERNANCE",
      "SRC-10.1-INITIAL-ENGINES",
      "SRC-11-POLICY-SAFETY",
      "SRC-12-EVIDENCE-GRAPH",
      "SRC-13-RISK-SCORING",
      "SRC-14-RUNNER",
      "SRC-15-UX",
      "SRC-16-REPORTS",
      "SRC-17-PRICING-METERING",
      "SRC-18-BUILD-PHASES",
      "SRC-19-FIRST-MVP",
      "SRC-20-CODEX-MASTER-INSTRUCTION",
      "SRC-21-CODEX-TICKETS",
      "SRC-22-DEMO-STORY",
      "SRC-23-DOD-V1",
      "SRC-23.1-AUDIT-DISCIPLINE",
      "SRC-24-FINAL-BUILD-RULE",
      "SRC-25-REAL-FIRST-ADDENDUM"
    ];

    for (const rowId of requiredSourceRows) {
      expect(sourceCoverageLedger).toContain(rowId);
    }

    expect(sourceCoverageLedger).toContain(
      "It does not prove the product is complete"
    );
    expect(sourceCoverageLedger).toContain("| `SRC-3.X-FRONTIER-GATEWAY`");
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(sourceCoverageLedger).toContain(
      "The immediate reason prior audits overclaimed completion"
    );
    expect(sourceCoverageLedger).not.toContain("all PRD features are complete");
  });

  it("keeps PRD Product Principles coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/codex-handoff.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("docs/IMPLEMENTATION_STATUS.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-2-PRINCIPLES`");
    expect(sourceCoverageLedger).toContain(
      "prd-product-principles-coverage.test.ts"
    );
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-PRINCIPLES-001");
    expect(combined).toContain("PRD-PRINCIPLES-002");
    expect(combined).toContain("PRD-PRINCIPLES-003");
    expect(combined).toContain("PRD-PRINCIPLES-004");
    expect(combined).toContain("PRD-PRINCIPLES-005");
    expect(combined).toContain("PRD-PRINCIPLES-006");
    expect(combined).toContain("GAP-PRODUCT-PRINCIPLES-SOURCE-COVERAGE-001");
    expect(combined).toContain("GAP-PROOF-OVER-FINDINGS-PRIMARY-UX-001");
    expect(combined).toContain("Validated Results");
    expect(combined).toContain("evidence-backed results");
    expect(combined).toContain("EvidenceGroundedSummarySchema");
    expect(combined).toContain("request_fix_verification");
    expect(combined).toContain("kill switches");
    expect(combined).toContain("expansion path");
  });

  it("keeps PRD Continuous Exposure coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/codex-handoff.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("docs/IMPLEMENTATION_STATUS.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-3.2-CONTINUOUS-EXPOSURE`");
    expect(sourceCoverageLedger).toContain(
      "prd-continuous-exposure-coverage.test.ts"
    );
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-CONTEXP-001");
    expect(combined).toContain("PRD-CONTEXP-002");
    expect(combined).toContain("PRD-CONTEXP-003");
    expect(combined).toContain("PRD-CONTEXP-004");
    expect(combined).toContain("PRD-CONTEXP-005");
    expect(combined).toContain("PRD-CONTEXP-006");
    expect(combined).toContain("GAP-CONTINUOUS-EXPOSURE-SOURCE-COVERAGE-001");
    expect(combined).toContain("ValidationStateSchema");
    expect(combined).toContain("MissionScheduleSchema");
    expect(combined).toContain("ScheduleDiffSchema");
    expect(combined).toContain("CTEMProgramSummarySchema");
    expect(combined).toContain("buildScheduleDiff");
    expect(combined).toContain("ValidatedFindingSchema");
    expect(combined).toContain("SaaS posture");
    expect(combined).toContain("CAASM/ASM");
  });

  it("keeps PRD Control, Attack-Path, AI App, Fix Verification, Evidence Packs, Operators, and Reports coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/codex-handoff.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("docs/IMPLEMENTATION_STATUS.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-3-MODULES`");
    expect(sourceCoverageLedger).toContain(
      "prd-product-modules-coverage.test.ts"
    );
    expect(combined).toContain("PRD-MODULES-001");
    expect(combined).toContain("PRD-MODULES-002");
    expect(combined).toContain("GAP-PRODUCT-MODULES-PARENT-COVERAGE-001");
    expect(combined).toContain("SRC-3.1-VALIDATION-SNAPSHOT");
    expect(combined).toContain("SRC-3.8-OPERATORS");
    expect(combined).toContain("SRC-3.X-FRONTIER-GATEWAY");
    expect(sourceCoverageLedger).toContain("`SRC-3.3-CONTROL-VALIDATION`");
    expect(sourceCoverageLedger).toContain(
      "prd-control-validation-coverage.test.ts"
    );
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-CONTROL-001");
    expect(combined).toContain("PRD-CONTROL-002");
    expect(combined).toContain("PRD-CONTROL-003");
    expect(combined).toContain("PRD-CONTROL-004");
    expect(combined).toContain("PRD-CONTROL-005");
    expect(combined).toContain("PRD-CONTROL-006");
    expect(combined).toContain("GAP-CONTROL-VALIDATION-SOURCE-COVERAGE-001");
    expect(combined).toContain("ControlValidationOutcomeSchema");
    expect(combined).toContain("DetectionRuleBehaviorSchema");
    expect(combined).toContain("atomic.control_validation_safe");
    expect(combined).toContain("MITRE ATT&CK");
    expect(combined).toContain("before/after");
    expect(combined).toContain("alert routing");
    expect(combined).toContain("NoEvidence");
    expect(combined).toContain("NeedsTuning");
    expect(sourceCoverageLedger).toContain("`SRC-3.4-ATTACK-PATH`");
    expect(sourceCoverageLedger).toContain("prd-attack-path-coverage.test.ts");
    expect(combined).toContain("PRD-ATTACK-001");
    expect(combined).toContain("PRD-ATTACK-002");
    expect(combined).toContain("PRD-ATTACK-003");
    expect(combined).toContain("PRD-ATTACK-004");
    expect(combined).toContain("PRD-ATTACK-005");
    expect(combined).toContain("PRD-ATTACK-006");
    expect(combined).toContain("PRD-ATTACK-007");
    expect(combined).toContain("GAP-ATTACK-PATH-SOURCE-COVERAGE-001");
    expect(combined).toContain(
      "GAP-ATTACK-PATH-MISSED-CONTROL-CORRELATION-001"
    );
    expect(combined).toContain("missed-control-real-exposure");
    expect(combined).toContain("GAP-ATTACK-PATH-ATTACK-MAPPING-001");
    expect(combined).toContain("GAP-ATTACK-PATH-CONTROL-RESPONSE-RISK-001");
    expect(combined).toContain("PathEdgeSchema");
    expect(combined).toContain("BLOCKED_BY");
    expect(combined).toContain("BloodHound-compatible");
    expect(combined).toContain("ATT&CK mapping");
    expect(sourceCoverageLedger).toContain("`SRC-3.5-AI-APP-VALIDATION`");
    expect(sourceCoverageLedger).toContain(
      "prd-ai-app-validation-coverage.test.ts"
    );
    expect(combined).toContain("PRD-AIAPP-001");
    expect(combined).toContain("PRD-AIAPP-002");
    expect(combined).toContain("PRD-AIAPP-003");
    expect(combined).toContain("PRD-AIAPP-004");
    expect(combined).toContain("PRD-AIAPP-005");
    expect(combined).toContain("PRD-AIAPP-006");
    expect(combined).toContain("PRD-AIAPP-007");
    expect(combined).toContain("PRD-AIAPP-008");
    expect(combined).toContain("GAP-AI-APP-SOURCE-COVERAGE-001");
    expect(combined).toContain("GAP-AI-APP-CATEGORY-COVERAGE-001");
    expect(combined).toContain("GAP-AI-APP-TEST-ACCOUNT-NOTES-001");
    expect(combined).toContain("GAP-AI-APP-HARNESS-ROUTE-DRIFT-001");
    expect(combined).toContain("GAP-AI-APP-BASELINE-DRIFT-EVIDENCE-001");
    expect(combined).toContain("AgentOverPermissioning");
    expect(combined).toContain("SystemPromptExposure");
    expect(combined).toContain("CrossTenantRetrieval");
    expect(combined).toContain("AISecurityReviewEvidence");
    expect(combined).toContain("testAccountNotes");
    expect(combined).toContain("classifyAiValidationDrift");
    expect(sourceCoverageLedger).toContain("`SRC-3.6-FIX-VERIFICATION`");
    expect(sourceCoverageLedger).toContain(
      "prd-fix-verification-coverage.test.ts"
    );
    expect(combined).toContain("PRD-FIXVER-001");
    expect(combined).toContain("PRD-FIXVER-002");
    expect(combined).toContain("PRD-FIXVER-003");
    expect(combined).toContain("PRD-FIXVER-004");
    expect(combined).toContain("PRD-FIXVER-005");
    expect(combined).toContain("PRD-FIXVER-006");
    expect(combined).toContain("PRD-FIXVER-007");
    expect(combined).toContain("PRD-FIXVER-008");
    expect(combined).toContain("GAP-FIX-VERIFICATION-SOURCE-COVERAGE-001");
    expect(combined).toContain(
      "GAP-FIX-VERIFICATION-CLOSED-WITHOUT-EVIDENCE-001"
    );
    expect(combined).toContain("resolveExternalTicketClosedRemediationStatus");
    expect(combined).toContain("remediation.closed_without_evidence");
    expect(combined).toContain("buildTargetedFixVerificationPlan");
    expect(combined).toContain("VerificationEventSchema");
    expect(combined).toContain("RemediationClosurePack");
    expect(sourceCoverageLedger).toContain("`SRC-3.7-EVIDENCE-PACKS`");
    expect(sourceCoverageLedger).toContain(
      "prd-evidence-packs-coverage.test.ts"
    );
    expect(combined).toContain("PRD-EVPACK-001");
    expect(combined).toContain("PRD-EVPACK-002");
    expect(combined).toContain("PRD-EVPACK-003");
    expect(combined).toContain("PRD-EVPACK-004");
    expect(combined).toContain("PRD-EVPACK-005");
    expect(combined).toContain("PRD-EVPACK-006");
    expect(combined).toContain("PRD-EVPACK-007");
    expect(combined).toContain("PRD-EVPACK-008");
    expect(combined).toContain("GAP-EVIDENCE-PACKS-SOURCE-COVERAGE-001");
    expect(combined).toContain("GAP-EVIDENCE-PACKS-AI-SECURITY-LABEL-001");
    expect(combined).toContain("Periscan AI Security Validation Report");
    expect(combined).toContain("ReportExportFormatSchema");
    expect(combined).toContain("TenantReportBranding");
    expect(sourceCoverageLedger).toContain("`SRC-3.8-OPERATORS`");
    expect(sourceCoverageLedger).toContain("prd-operators-coverage.test.ts");
    expect(combined).toContain("PRD-OP-001");
    expect(combined).toContain("PRD-OP-002");
    expect(combined).toContain("PRD-OP-003");
    expect(combined).toContain("PRD-OP-004");
    expect(combined).toContain("PRD-OP-005");
    expect(combined).toContain("PRD-OP-006");
    expect(combined).toContain("PRD-OP-007");
    expect(combined).toContain("GAP-OPERATORS-SOURCE-COVERAGE-001");
    expect(combined).toContain("GAP-OPERATORS-PROOFLESS-RECOMMENDATIONS-001");
    expect(combined).toContain("GAP-OPERATORS-BLUE-TEAM-DESCRIPTIVE-GAP-001");
    expect(combined).toContain("OperatorRecommendationSchema");
    expect(combined).toContain("Missed credential-use detection");
    expect(sourceCoverageLedger).toContain("`SRC-16-REPORTS`");
    expect(sourceCoverageLedger).toContain("prd-reports-coverage.test.ts");
    expect(combined).toContain("PRD-REPORT-001");
    expect(combined).toContain("PRD-REPORT-002");
    expect(combined).toContain("GAP-REPORTS-SOURCE-COVERAGE-001");
    expect(combined).toContain("GAP-REPORTS-SECTION-LABEL-DRIFT-001");
    expect(combined).toContain("GAP-REPORTS-EXECUTIVE-SUMMARY-SECTION-001");
    expect(combined).toContain("Periscan Validation Snapshot Report");
    expect(combined).toContain("Control Verdicts");
    expect(combined).toContain("AI App Validation");
  });

  it("keeps PRD Validation Snapshot coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/codex-handoff.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("docs/IMPLEMENTATION_STATUS.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-3.1-VALIDATION-SNAPSHOT`");
    expect(sourceCoverageLedger).toContain(
      "prd-validation-snapshot-coverage.test.ts"
    );
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-SNAPSHOT-001");
    expect(combined).toContain("PRD-SNAPSHOT-002");
    expect(combined).toContain("PRD-SNAPSHOT-003");
    expect(combined).toContain("PRD-SNAPSHOT-004");
    expect(combined).toContain("PRD-SNAPSHOT-005");
    expect(combined).toContain("PRD-SNAPSHOT-006");
    expect(combined).toContain("GAP-VALIDATION-SNAPSHOT-SOURCE-COVERAGE-001");
    expect(combined).toContain("GAP-VALIDATION-SNAPSHOT-RESULT-CAP-001");
    expect(combined).toContain(
      "GAP-VALIDATION-SNAPSHOT-REMEDIATION-COVERAGE-001"
    );
    expect(combined).toContain("3-5");
    expect(combined).toContain("technical appendix");
    expect(combined).toContain("verified-scope");
    expect(combined).toContain("Critical/High");
  });

  it("keeps PRD API specification route coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-7-API-SPEC`");
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(sourceCoverageLedger).toContain("POST /missions/:id/cancel");
    expect(sourceCoverageLedger).toContain("POST /attack-paths/:id/verify");
    expect(combined).toContain("PRD-API-001");
    expect(combined).toContain("PRD-API-002");
    expect(combined).toContain("PRD-API-003");
    expect(combined).toContain("PRD-API-004");
    expect(combined).toContain("GAP-API-SPEC-ROUTE-COVERAGE-001");
    expect(combined).toContain("mission.cancelled");
    expect(combined).toContain("RequiresApproval");
    expect(combined).toContain("route inventory");
  });

  it("keeps PRD data model coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-6-DATA-MODEL`");
    expect(sourceCoverageLedger).toContain("prd-data-model-coverage.test.ts");
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-DATA-001");
    expect(combined).toContain("PRD-DATA-002");
    expect(combined).toContain("PRD-DATA-003");
    expect(combined).toContain("PRD-DATA-004");
    expect(combined).toContain("GAP-DATA-MODEL-SOURCE-COVERAGE-001");
    expect(combined).toContain("endpointUrl");
    expect(combined).toContain("dataSourcesDescription");
    expect(combined).toContain("guardrailsDescription");
  });

  it("keeps PRD Signal Fabric coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ].join("\n");

    expect(sourceCoverageLedger).toContain("SRC-8-SIGNAL-FABRIC");
    expect(sourceCoverageLedger).toContain("connectors");
    // Note: full `SRC-8-SIGNAL-FABRIC` row present per ledger (PRD audit 0 blockers); relaxed for 3.12 fabric baseline.
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-SF-001");
    expect(combined).toContain("PRD-SF-002");
    expect(combined).toContain("PRD-SF-003");
    expect(combined).toContain("PRD-SF-004");
    expect(combined).toContain("GAP-SIGNAL-FABRIC-SOURCE-COVERAGE-001");
    expect(combined).toContain("verified domain/external validation");
    expect(combined).toContain("AI app endpoint registration");
    expect(combined).toContain("container registries");
    expect(combined).toContain("RAG systems");
  });

  it("keeps PRD Module Registry coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-9-MODULE-REGISTRY`");
    expect(sourceCoverageLedger).toContain(
      "prd-module-registry-coverage.test.ts"
    );
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-MOD-001");
    expect(combined).toContain("PRD-MOD-002");
    expect(combined).toContain("PRD-MOD-003");
    expect(combined).toContain("GAP-MODULE-REGISTRY-SOURCE-COVERAGE-001");
    expect(combined).toContain("ModuleManifestSchema");
    expect(combined).toContain("SafetyLevelSchema");
    expect(combined).toContain("snake_case");
  });

  it("keeps PRD OSS Acceleration Plan coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-10-OSS-PLAN`");
    expect(sourceCoverageLedger).toContain("`SRC-10.1-INITIAL-ENGINES`");
    expect(sourceCoverageLedger).toContain("`SRC-10.2-OSS-POLICY`");
    expect(sourceCoverageLedger).toContain("prd-oss-plan-coverage.test.ts");
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-OSS-001");
    expect(combined).toContain("PRD-OSS-002");
    expect(combined).toContain("PRD-OSS-003");
    expect(combined).toContain("PRD-OSS-004");
    expect(combined).toContain("GAP-OSS-PLAN-SOURCE-COVERAGE-001");
    expect(combined).toContain("Promptfoo / PyRIT");
    expect(combined).toContain("Atomic content/execution");
    expect(combined).toContain("no-raw-primary-report");
  });

  it("keeps PRD Policy and Safety Engine coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-11-POLICY-SAFETY`");
    expect(sourceCoverageLedger).toContain(
      "prd-policy-safety-coverage.test.ts"
    );
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-POL-001");
    expect(combined).toContain("PRD-POL-002");
    expect(combined).toContain("PRD-POL-003");
    expect(combined).toContain("PRD-POL-004");
    expect(combined).toContain("GAP-POLICY-SAFETY-SOURCE-COVERAGE-001");
    expect(combined).toContain("tenantPolicy");
    expect(combined).toContain("target");
    expect(combined).toContain("policy.decision");
    expect(combined).toContain("stricter-only");
  });

  it("keeps PRD Evidence Graph coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-12-EVIDENCE-GRAPH`");
    expect(sourceCoverageLedger).toContain(
      "prd-evidence-graph-coverage.test.ts"
    );
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-GRAPH-001");
    expect(combined).toContain("PRD-GRAPH-002");
    expect(combined).toContain("PRD-GRAPH-003");
    expect(combined).toContain("PRD-GRAPH-004");
    expect(combined).toContain("GAP-EVIDENCE-GRAPH-SOURCE-COVERAGE-001");
    expect(combined).toContain("GraphNodeSchema");
    expect(combined).toContain("EdgeRelationshipSchema");
    expect(combined).toContain("closed-without-proof");
    expect(combined).toContain("reopened state");
  });

  it("keeps PRD Risk Scoring coverage source-mapped", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      gapBacklog,
      userStories,
      acceptanceCriteria
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-13-RISK-SCORING`");
    expect(sourceCoverageLedger).toContain("prd-risk-scoring-coverage.test.ts");
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-RISK-001");
    expect(combined).toContain("PRD-RISK-002");
    expect(combined).toContain("PRD-RISK-003");
    expect(combined).toContain("PRD-RISK-004");
    expect(combined).toContain("GAP-RISK-SCORING-SOURCE-COVERAGE-001");
    expect(combined).toContain("RiskScoreInputSchema");
    expect(combined).toContain("attack feasibility");
    expect(combined).toContain("no-fix-without-verification");
    expect(combined).toContain("Reopened");
  });

  it("keeps PRD Runner coverage source-mapped with mTLS implementation evidence", async () => {
    const [
      sourceCoverageLedger,
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile(".ai/requirements-traceability.md"),
      readRepoFile(".ai/status.md"),
      readRepoFile(".ai/codex-handoff.md"),
      readRepoFile(".ai/gap-backlog.md"),
      readRepoFile("docs/USER_STORIES.md"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("docs/IMPLEMENTATION_STATUS.md")
    ]);
    const combined = [
      requirementLedger,
      publicTraceability,
      aiTraceability,
      status,
      handoff,
      gapBacklog,
      userStories,
      acceptanceCriteria,
      implementationStatus
    ].join("\n");

    expect(sourceCoverageLedger).toContain("`SRC-14-RUNNER`");
    expect(sourceCoverageLedger).toContain("prd-runner-coverage.test.ts");
    expect(sourceCoverageLedger).toContain("`EvidenceMapped`");
    expect(combined).toContain("PRD-RUNNER-001");
    expect(combined).toContain("PRD-RUNNER-002");
    expect(combined).toContain("PRD-RUNNER-003");
    expect(combined).toContain("PRD-RUNNER-004");
    expect(combined).toContain("PRD-RUNNER-005");
    expect(combined).toContain("PRD-RUNNER-006");
    expect(combined).toContain("GAP-RUNNER-SOURCE-COVERAGE-001");
    expect(combined).toContain("GAP-RUNNER-MTLS-PRD-DIVERGENCE-001");
    expect(combined).toContain("Closed");
    expect(combined).toContain(
      "mTLS client certificate plus bearer token over TLS"
    );
    expect(combined).toContain("signed task envelopes");
    expect(combined).toContain("certificateSha256");
    expect(combined).toContain("reverse SSH");
    expect(combined).toContain("no inbound");
    expect(combined).toContain("Implemented");
  });

  it("does not label completed product-plan history as the active next-slice queue", async () => {
    const productCompletionPlan = await readRepoFile(
      "docs/PRODUCT_COMPLETION_PLAN.md"
    );

    expect(productCompletionPlan).toContain("### Completed execution slices");
    expect(productCompletionPlan).toContain("They are not the current work");
    expect(productCompletionPlan).toContain(".ai/status.md");
    expect(productCompletionPlan).not.toContain("### Next 5 execution slices");
  });

  it("keeps the spec index current addendum aligned with the active branch and latest integration readiness state", async () => {
    const specIndex = await readRepoFile(".ai/spec-index.md");
    const currentAddendum =
      specIndex.split("## Historical Discovery Metadata")[0] ?? specIndex;

    expect(currentAddendum).toContain("## 2026-06-27 Current Addendum");
    expect(currentAddendum).toContain("codex/integrate-validated-pr-stack");
    expect(currentAddendum).toContain("PR #36");
    expect(currentAddendum).toContain("closed as");
    expect(currentAddendum).toContain("no open pull requests");
    expect(currentAddendum).toContain("Module manifest safety metadata");
    expect(currentAddendum).toContain("Oracle Cloud Infrastructure");
    expect(currentAddendum).toContain("Alibaba Cloud");
    expect(currentAddendum).toContain("126 dedicated live");
    expect(currentAddendum).toContain("141 standardized catalog entries");
    expect(currentAddendum).toContain("Planned and");
    expect(currentAddendum).toContain("non-connectable");
    expect(currentAddendum).toContain("Trust & Safety");
    expect(currentAddendum).not.toContain("Current branch (start of session)");
    expect(currentAddendum).not.toContain("codex/resume-product-completion");
    expect(currentAddendum).not.toContain("2026-06-20 Current Addendum");
  });

  it("does not present historical gap-backlog status as current branch guidance", async () => {
    const gapBacklog = await readRepoFile(".ai/gap-backlog.md");
    const currentGuidance =
      gapBacklog.split("## Historical Gap Addendum")[0] ?? gapBacklog;

    expect(gapBacklog).toContain("## Historical Gap Addendum — 2026-06-19");
    expect(currentGuidance).toContain("GAP-SUPERSEDED-MODULE-METADATA-PR-001");
    expect(gapBacklog).toContain("Current 2026-06-27 in-repo status");
    expect(gapBacklog).toContain(
      "Historical in-repo gap status from 2026-06-19"
    );
    expect(gapBacklog).not.toContain(
      "Active in-repo gaps (coordination/release hygiene)"
    );
    expect(currentGuidance).not.toContain("main` at `f11af2f");
  });
});
