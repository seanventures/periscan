import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function expectTextContains(source: string, token: string) {
  expect(
    source.includes(token),
    `missing required source token: ${token}`
  ).toBe(true);
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

function parseTickets(section: string) {
  return [
    ...section.matchAll(
      /Ticket (\d+) - ([^\n]+)\n([\s\S]*?)(?=\nTicket \d+ - |\n## 22\.)/gu
    )
  ].map((match) => {
    const body = match[3] ?? "";
    const acceptanceStart = body.indexOf("Acceptance:");
    const acceptanceBlock =
      acceptanceStart === -1
        ? ""
        : body.slice(acceptanceStart + "Acceptance:".length);

    return {
      acceptance: acceptanceBlock
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2).trim()),
      number: Number(match[1]),
      title: match[2]?.trim() ?? ""
    };
  });
}

describe("PRD section 21 Codex Implementation Tickets coverage", () => {
  it("keeps every source ticket number, title, and acceptance block explicit", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 21. Codex Implementation Tickets",
      "## 22. First Demo Story"
    );
    const tickets = parseTickets(`${section}\n## 22. First Demo Story`);

    expect(
      tickets.map((ticket) => `${ticket.number}. ${ticket.title}`)
    ).toEqual([
      "1. Monorepo Scaffold",
      "2. Shared Schemas",
      "3. Database and Prisma",
      "4. Auth, Tenant, RBAC",
      "5. Scope Verification",
      "6. Policy Engine",
      "7. Signal Fabric",
      "8. Module Registry",
      "9. Job Scheduler",
      "10. Raw Evidence Store",
      "11. Evidence Graph MVP",
      "12. Validation Snapshot",
      "13. GitHub Connector",
      "14. AWS Connector",
      "15. Gitleaks Module",
      "16. Prowler Module",
      "17. Nuclei Safe External Module",
      "18. Attack Path Correlation",
      "19. Risk Scoring",
      "20. Remediation Engine",
      "21. Jira Integration",
      "22. Fix Verification",
      "23. Report Generator",
      "24. Web UI",
      "25. AI App Registry",
      "26. AI App Validation",
      "27. Control Source Registry",
      "28. Atomic Red Team Safe Wrapper",
      "29. MITRE ATT&CK Mapping",
      "30. Internal Runner Skeleton",
      "31. Runner Task Signing",
      "32. Runner Reachability Module",
      "33. Continuous Validation Scheduler",
      "34. Evidence Pack Templates",
      "35. MSSP Multitenancy",
      "36. Billing/Metering",
      "37. Trust & Safety Page",
      "38. Audit Log Completeness",
      "39. Demo Data",
      "40. E2E Test"
    ]);
    expect(tickets).toHaveLength(40);
    expect(tickets.every((ticket) => ticket.acceptance.length > 0)).toBe(true);
    expect(tickets[0]?.acceptance).toEqual([
      "local dev starts",
      "API health endpoint works",
      "web calls API health endpoint",
      "tests run"
    ]);
    expect(tickets[39]?.acceptance).toEqual([
      "signup",
      "verify scope",
      "connect mock GitHub/AWS",
      "run Snapshot",
      "create remediation",
      "verify fix",
      "generate report"
    ]);
  });

  it("maps tickets 1 through 12 to foundation, policy, execution, evidence, graph, and Snapshot proof", async () => {
    const [
      rootPackage,
      readme,
      apiSource,
      prismaSchema,
      sharedDomain,
      policySource,
      connectorSource,
      moduleSource,
      workerProcessor,
      evidenceStorage,
      evidenceGraph,
      snapshotServices,
      acceptanceCriteria,
      apiAcceptance
    ] = await Promise.all([
      readRepoFile("package.json"),
      readRepoFile("README.md"),
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/db/prisma/schema.prisma"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/policy/src/index.ts"),
      readRepoFile("packages/connectors/src/index.ts"),
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("apps/worker/src/processor.ts"),
      readRepoFile("packages/evidence/src/storage.ts"),
      readRepoFile("packages/evidence/src/graph.ts"),
      readRepoFile("apps/api/src/services/snapshots.ts"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts")
    ]);
    const combined = [
      rootPackage,
      readme,
      apiSource,
      prismaSchema,
      sharedDomain,
      policySource,
      connectorSource,
      moduleSource,
      workerProcessor,
      evidenceStorage,
      evidenceGraph,
      snapshotServices,
      acceptanceCriteria,
      apiAcceptance
    ].join("\n");

    for (const token of [
      '"dev"',
      "/api/v1/health",
      "TenantSchema",
      "ValidationStateSchema",
      "model Tenant",
      "seed",
      '"/api/v1/auth/signup"',
      "another tenant attempts",
      '"/api/v1/scopes"',
      "devModeManual",
      "PolicyDecision",
      "Denied",
      "SignalEnvelope",
      '"/api/v1/integrations/catalog"',
      "ModuleManifestSchema",
      '"/api/v1/modules"',
      "BullMQ",
      "RawModuleOutput",
      "putEvidenceArtifact",
      "redactEvidenceArtifact",
      "upsertNode",
      "findPaths",
      '"/api/v1/snapshots"',
      "topAttackPaths",
      "evidencePack"
    ]) {
      expectTextContains(combined, token);
    }
  });

  it("maps tickets 13 through 24 to connectors, validation modules, risk/path/remediation/report, and API-backed UI", async () => {
    const [
      apiSource,
      runtimeServices,
      connectorSource,
      moduleSource,
      evidenceCorrelation,
      riskSource,
      remediationService,
      reportSource,
      reportLocalization,
      webNavigation,
      apiClient,
      proofLoopE2e
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/api/src/runtime-services.ts"),
      readRepoFile("packages/connectors/src/index.ts"),
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("packages/evidence/src/correlation.ts"),
      readRepoFile("packages/evidence/src/risk.ts"),
      readRepoFile("apps/api/src/services/remediation.ts"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("packages/shared/src/localization.ts"),
      readRepoFile("apps/web/src/lib/primary-nav.tsx"),
      readRepoFile("apps/web/src/lib/periscan-api-client.ts"),
      readRepoFile("tests/e2e/first-customer-proof-loop.spec.ts")
    ]);
    const combined = [
      apiSource,
      runtimeServices,
      connectorSource,
      moduleSource,
      evidenceCorrelation,
      riskSource,
      remediationService,
      reportSource,
      reportLocalization,
      webNavigation,
      apiClient,
      proofLoopE2e
    ].join("\n");

    for (const token of [
      '"/api/v1/integrations/github/connect"',
      '"/api/v1/integrations/aws/connect"',
      "gitleaks.repo_secrets",
      "redactedResponse",
      "prowler.aws_posture",
      "nuclei.external_exposure_safe",
      "rateLimit",
      "repo-secret-cloud-role",
      "pathBreakers",
      "calculateRiskScore",
      "RiskScoreSchema",
      "verificationMethod",
      '"/api/v1/remediations/:id/create-ticket"',
      "Jira",
      '"/api/v1/remediations/:id/verify"',
      "VerificationEvent",
      "Executive Summary",
      "Evidence Appendix",
      "Snapshot",
      "Attack Paths",
      "Remediation",
      "Evidence"
    ]) {
      expectTextContains(combined, token);
    }
  });

  it("maps tickets 25 through 34 to AI app, control validation, ATT&CK, runner, schedules, and evidence packs", async () => {
    const [
      apiSource,
      sharedDomain,
      validationCatalog,
      moduleSource,
      reportSource,
      runnerSource,
      scheduleService,
      acceptance
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/shared/src/validation-catalog.ts"),
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("apps/runner/main.go"),
      readRepoFile("apps/api/src/services/schedules.ts"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const combined = [
      apiSource,
      sharedDomain,
      validationCatalog,
      moduleSource,
      reportSource,
      runnerSource,
      scheduleService,
      acceptance
    ].join("\n");

    for (const token of [
      '"/api/v1/ai-apps"',
      "AIApplicationEndpoint",
      "ai_app.safe_validation",
      "prompt injection",
      "UnsafeToolCallAttempted",
      '"/api/v1/control-sources"',
      '"/api/v1/control-sources/:id/validate"',
      "atomic.control_validation_safe",
      "dryRun",
      "MITRE ATT&CK",
      "techniqueId",
      '"/api/v1/runners/register"',
      '"/api/v1/runners/:id/poll"',
      "ed25519.Verify",
      "runner.reachability_check",
      '"/api/v1/schedules"',
      "buildScheduleDiff",
      "ReopenedRiskDetected",
      "ExecutiveRiskSummary",
      "TechnicalAppendix",
      "redaction"
    ]) {
      expectTextContains(combined, token);
    }
  });

  it("maps tickets 35 through 40 to enterprise, billing, trust, audit, demo, and E2E release gates", async () => {
    const [
      apiSource,
      sharedDomain,
      reportSource,
      webDashboard,
      enterpriseAcceptance,
      governanceAcceptance,
      demoSeed,
      acceptance,
      e2eFlow,
      auditCoverage
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("apps/web/src/components/validation-ops-dashboard.tsx"),
      readRepoFile("tests/acceptance/enterprise-foundation.test.ts"),
      readRepoFile("tests/acceptance/governance-apis-flow.test.ts"),
      readRepoFile("scripts/seed-demo.ts"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md"),
      readRepoFile("tests/e2e/first-customer-proof-loop.spec.ts"),
      readRepoFile("tests/modules/prd-dod-v1-coverage.test.ts")
    ]);
    const combined = [
      apiSource,
      sharedDomain,
      reportSource,
      webDashboard,
      enterpriseAcceptance,
      governanceAcceptance,
      demoSeed,
      acceptance,
      e2eFlow,
      auditCoverage
    ].join("\n");

    for (const token of [
      "parentTenantId",
      '"/api/v1/tenants/current/client-portfolio"',
      "whiteLabelEnabled",
      '"/api/v1/billing/usage"',
      "ValidatedAssets",
      "ControlSources",
      "AIApplications",
      '"/api/v1/tenants/current/trust-safety"',
      "evidence retention",
      '"/api/v1/audit-events/export"',
      "AuditEvent",
      "demo tenant",
      "sample report",
      "first-customer proof loop",
      "verificationEvent",
      "generatedReport"
    ]) {
      expectTextContains(combined, token);
    }
  });

  it("keeps Codex ticket completion tied to source-derived ledgers", async () => {
    const [sourceLedger, requirementLedger, traceability] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md")
    ]);

    expectTextContains(sourceLedger, "SRC-21-CODEX-TICKETS");
    expectTextContains(requirementLedger, "PRD-TICKET-001");
    expectTextContains(requirementLedger, "PRD-TICKET-006");
    expectTextContains(traceability, "SRC-21-CODEX-TICKETS");
  });
});
