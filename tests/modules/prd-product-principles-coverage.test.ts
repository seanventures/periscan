import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  generateEvidenceGroundedSummary,
  listOperatorProfiles
} from "../../packages/operators/src/index.js";
import { renderValidationSnapshotReportHtml } from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import type { EvidenceArtifact } from "../../packages/shared/src/domain.js";

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

function parseBulletsFrom(section: string, startLabel: string) {
  const start = section.indexOf(startLabel);

  if (start === -1) {
    throw new Error(`Unable to find section label: ${startLabel}`);
  }

  return section
    .slice(start)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

function createEvidenceArtifact(): EvidenceArtifact {
  const timestamp = "2026-06-01T00:00:00.000Z";

  return {
    artifactType: "NormalizedEvidence",
    createdAt: timestamp,
    evidenceId: randomUUID(),
    redactionStatus: "Redacted",
    relatedEntityId: randomUUID(),
    relatedEntityType: "ValidationRun",
    sensitivityLevel: "Moderate",
    sha256: "evidence-sha256",
    storageUri: "memory://normalized-evidence.json",
    tenantId: randomUUID(),
    updatedAt: timestamp
  };
}

describe("PRD section 2 Product Principles coverage", () => {
  it("maps Proof Over Findings to primary product surfaces and keeps raw output out of the main experience", async () => {
    const [prd, reportsSource, navSource, findingsPage, securityBoundaries] =
      await Promise.all([
        readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
        readRepoFile("packages/reports/src/index.ts"),
        readRepoFile("apps/web/src/lib/primary-nav.tsx"),
        readRepoFile("apps/web/src/components/findings-workbench.tsx"),
        readRepoFile("docs/SECURITY_BOUNDARIES.md")
      ]);
    const principles = sectionBetween(
      prd,
      "## 2. Product Principles",
      "## 3. Product Modules"
    );
    const proofSection = sectionBetween(
      principles,
      "### 2.1 Proof Over Findings",
      "### 2.2 Self-Service, Not Low-End"
    );
    const shouldShow = parseBulletsBetween(
      proofSection,
      "It should show:",
      "Raw tool output"
    );
    const snapshot = createPublicDemoValidationSnapshot();
    const html = renderValidationSnapshotReportHtml(snapshot);
    const normalizedPrimarySurface = normalize(
      `${html}\n${reportsSource}\n${findingsPage}`
    );

    expect(shouldShow).toEqual([
      "validated exposure",
      "attack paths",
      "control verdicts",
      "remediation actions",
      "verification status",
      "evidence packs"
    ]);
    expect(snapshot.topAttackPaths.length).toBeGreaterThan(0);
    expect(
      snapshot.topAttackPaths.every(
        (item) => item.attackPath.evidenceIds.length > 0
      )
    ).toBe(true);
    expect(normalizedPrimarySurface).toContain(normalize("validated exposure"));
    expect(normalizedPrimarySurface).toContain(
      normalize("Priority Attack Paths")
    );
    expect(normalizedPrimarySurface).toContain(normalize("Control Verdicts"));
    expect(normalizedPrimarySurface).toContain(
      normalize("Remediation Priorities")
    );
    expect(normalizedPrimarySurface).toContain(normalize("Verification Plan"));
    expect(normalizedPrimarySurface).toContain(normalize("Evidence Pack"));
    expect(reportsSource).toContain(
      "raw tool output excluded from the primary report"
    );
    expect(reportsSource).toContain("Periscan Technical Appendix");
    expect(securityBoundaries).toContain(
      "Raw scanner output must not be primary UX"
    );
    // Honest product rail: Findings (not raw scanner "Exposure" dashboard).
    expect(navSource).toContain('label: "Findings"');
    expect(navSource).toContain('href: "/findings"');
    expect(findingsPage).toContain("evidence-backed results layer");
    expect(findingsPage).toContain("/api/v1/findings API");
  });

  it("maps AI-in-the-workflow claims to deterministic operators and evidence-grounded summaries", async () => {
    const [prd, toolCatalog, operatorsSource] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("packages/model-gateway/src/tool-catalog.ts"),
      readRepoFile("packages/operators/src/index.ts")
    ]);
    const principles = sectionBetween(
      prd,
      "## 2. Product Principles",
      "## 3. Product Modules"
    );
    const aiSection = sectionBetween(
      principles,
      "### 2.3 AI in the Workflow, Not the Headline",
      "### 2.4 Safety Is Product"
    );
    const aiTasks = parseBulletsBetween(
      aiSection,
      "AI should help Periscan:",
      "But the validation"
    );
    const profiles = listOperatorProfiles();
    const artifact = createEvidenceArtifact();
    const summary = generateEvidenceGroundedSummary({
      artifacts: [artifact],
      generatedAt: artifact.createdAt,
      useCase: "AttackPathExplanation"
    });
    const insufficient = generateEvidenceGroundedSummary({
      artifacts: [],
      generatedAt: artifact.createdAt,
      useCase: "ExecutiveSummary"
    });

    expect(aiTasks).toEqual([
      "choose what to validate",
      "correlate signals",
      "explain attack paths",
      "prioritize remediation",
      "write fix steps",
      "re-test fixes",
      "generate evidence"
    ]);
    expect(profiles.map((profile) => profile.operatorType)).toEqual(
      expect.arrayContaining([
        "RedTeamOperator",
        "BlueTeamOperator",
        "ExposureOperator",
        "RemediationOperator",
        "EvidenceOperator",
        "AIAppSecurityOperator"
      ])
    );
    expect(toolCatalog).toContain("recommend_validation_missions");
    expect(toolCatalog).toContain("query_evidence_graph");
    expect(toolCatalog).toContain("get_attack_paths");
    expect(toolCatalog).toContain("create_remediation_plan");
    expect(toolCatalog).toContain("request_fix_verification");
    expect(toolCatalog).toContain("generate_evidence_pack_draft");
    expect(toolCatalog).toContain("summarize_evidence");
    expect(operatorsSource).toContain("approvalRequired");
    expect(operatorsSource).toContain("uncertainty");
    expect(summary.evidenceIds).toEqual([artifact.evidenceId]);
    expect(summary.claims).toHaveLength(1);
    expect(summary.claims[0]?.evidenceIds).toEqual([artifact.evidenceId]);
    expect(summary.summary).toContain("Every claim below cites evidence IDs");
    expect(insufficient.evidenceIds).toEqual([]);
    expect(insufficient.claims).toEqual([]);
    expect(insufficient.summary).toContain("insufficient normalized evidence");
    expect(insufficient.warnings).toContain(
      "No tenant-authorized evidence artifacts were supplied for this summary."
    );
  });

  it("maps Safety Is Product bullets to central policy, audit, runner, and security-boundary evidence", async () => {
    const [
      prd,
      securityBoundaries,
      policySource,
      validationService,
      runnerService,
      scopesService,
      securityTests
    ] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("docs/SECURITY_BOUNDARIES.md"),
      readRepoFile("packages/policy/src/index.ts"),
      readRepoFile("apps/api/src/services/validation.ts"),
      readRepoFile("apps/api/src/services/runner.ts"),
      readRepoFile("apps/api/src/services/scopes.ts"),
      readRepoFile("tests/security/security-boundaries.test.ts")
    ]);
    const principles = sectionBetween(
      prd,
      "## 2. Product Principles",
      "## 3. Product Modules"
    );
    const safetySection = sectionBetween(
      principles,
      "### 2.4 Safety Is Product",
      "### 2.5 Land With Proof, Expand Into Platform"
    );
    const rules = parseBulletsFrom(safetySection, "Rules:");
    const combined = [
      securityBoundaries,
      policySource,
      validationService,
      runnerService,
      scopesService,
      securityTests
    ].join("\n");

    expect(rules).toEqual([
      "verified customer scope required",
      "no destructive actions",
      "no real data exfiltration",
      "no persistence",
      "no credential theft",
      "no uncontrolled exploit chaining",
      "no unauthorized third-party testing",
      "policy approvals for sensitive validation",
      "audit logs for all validation",
      "clear test boundaries",
      "emergency kill switch"
    ]);
    for (const phrase of [
      "Only validate customer-authorized verified scope",
      "No destructive actions",
      "No real data exfiltration",
      "No persistence, credential theft",
      "uncontrolled exploit chaining",
      "No unauthorized third-party testing",
      "Every validation run needs a policy decision and audit event",
      "Denied tasks must never be queued",
      "kill switch"
    ]) {
      expect(combined).toContain(phrase);
    }
    expect(combined).toContain("destructive");
    expect(combined).toContain("realDataExfiltration");
    expect(combined).toContain("persistence");
    expect(combined).toContain("credentialTheft");
    expect(combined).toContain("uncontrolledExploitChaining");
    expect(combined).toContain("RequiresApproval");
    expect(combined).toContain("policy.decision");
    expect(combined).toContain("verified scope");
    expect(combined).toContain("fixtureRequested");
    expect(combined).toContain("Runner kill switch is active");
  });

  it("maps the land-with-proof expansion path to API-first platform surfaces", async () => {
    const [prd, apiRoutes, sharedSchemas, msspUi] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("apps/web/src/components/mssp-portfolio-dashboard.tsx")
    ]);
    const principles = sectionBetween(
      prd,
      "## 2. Product Principles",
      "## 3. Product Modules"
    );
    const expansionSection = principles.slice(
      principles.indexOf("### 2.5 Land With Proof, Expand Into Platform")
    );
    const afterExpansion = (expansionSection.split("Expansion path:")[1] || "").trim();
    const expansionRaw = afterExpansion.split("\n")[0]?.replace(/\.$/, "").trim() || afterExpansion;
    const expansionPath = expansionRaw.includes("→") || expansionRaw.includes("->")
      ? expansionRaw.split(/→|->/).map((item) => item.trim())
      : [expansionRaw];

    // Updated for current PRD (post 3.12 fabric + pillars expansion). Asserts key markers incl. Unified Fabric.
    expect(expansionRaw).toContain("Land with Validation Snapshot");
    expect(expansionRaw).toContain("Unified Fabric + Deep Integrations");
    expect(expansionRaw).toContain("6 Pillars");
    for (const route of [
      '"/api/v1/snapshots"',
      '"/api/v1/schedules"',
      '"/api/v1/ctem/program"',
      '"/api/v1/control-sources"',
      '"/api/v1/ai-apps"',
      '"/api/v1/remediations/:id/verify"',
      '"/api/v1/reports"',
      '"/api/v1/runners"',
      '"/api/v1/tenants/current/clients"',
      '"/api/v1/tenants/current/client-portfolio"'
    ]) {
      expect(apiRoutes).toContain(route);
    }
    expect(sharedSchemas).toContain("EvidencePackSchema");
    expect(sharedSchemas).toContain("MSSPClientPortfolioSchema");
    expect(msspUi).toContain("/api/v1/tenants/current/client-portfolio");
    expect(apiRoutes).toContain(
      'summary: "Read the MSSP client portfolio summary"'
    );
  });
});
