import { access, readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

async function expectRepoPath(path: string) {
  await expect(
    access(new URL(`../../${path}`, import.meta.url))
  ).resolves.toBeUndefined();
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

function phaseBlock(section: string, phaseHeader: string, nextHeader: string) {
  return sectionBetween(section, phaseHeader, nextHeader);
}

function parseBulletsBetween(
  section: string,
  startLabel: string,
  endLabel?: string
) {
  const start = section.indexOf(startLabel);

  if (start === -1) {
    throw new Error(`Unable to find label: ${startLabel}`);
  }

  const end = endLabel
    ? section.indexOf(endLabel, start + startLabel.length)
    : section.length;

  if (endLabel && end === -1) {
    throw new Error(`Unable to find end label: ${endLabel}`);
  }

  return section
    .slice(start + startLabel.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

function parsePhases(section: string) {
  const headers = [
    "Phase 0 - Foundation",
    "Phase 1 - Validation Snapshot",
    "Phase 2 - AI App Validation",
    "Phase 3 - Control Validation",
    "Phase 4 - Fix Verification",
    "Phase 5 - Internal Runner",
    "Phase 6 - Continuous Validation",
    "Phase 7 - Operators",
    "Phase 8 - MSSP / Enterprise",
    "## 19. First Sellable MVP"
  ];

  return headers.slice(0, -1).map((header, index) => {
    const block = phaseBlock(section, header, headers[index + 1] ?? "");

    return {
      build: parseBulletsBetween(block, "Build:", "Exit criteria:"),
      exitCriteria: parseBulletsBetween(block, "Exit criteria:"),
      header
    };
  });
}

describe("PRD section 18 Build Phases coverage", () => {
  it("keeps every build phase, build bullet, and exit criterion explicit", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 18. Build Phases",
      "## 19. First Sellable MVP"
    );
    const phases = parsePhases(`${section}\n## 19. First Sellable MVP`);

    expect(phases.map((phase) => phase.header)).toEqual([
      "Phase 0 - Foundation",
      "Phase 1 - Validation Snapshot",
      "Phase 2 - AI App Validation",
      "Phase 3 - Control Validation",
      "Phase 4 - Fix Verification",
      "Phase 5 - Internal Runner",
      "Phase 6 - Continuous Validation",
      "Phase 7 - Operators",
      "Phase 8 - MSSP / Enterprise"
    ]);
    expect(phases[0]?.build).toEqual([
      "monorepo",
      "tenant model",
      "auth",
      "RBAC",
      "integration registry",
      "module registry",
      "job scheduler",
      "raw evidence store",
      "normalized evidence schema",
      "basic evidence graph",
      "report generator",
      "policy engine",
      "audit logs"
    ]);
    expect(phases[0]?.exitCriteria).toEqual([
      "tenant can be created",
      "verified scope can be created",
      "mock module can run",
      "evidence is stored",
      "simple report renders"
    ]);
    expect(phases[8]?.build).toEqual([
      "parent/child tenants",
      "white-label reports",
      "client dashboards",
      "SSO/SAML/OIDC",
      "SCIM",
      "baseline multi-role RBAC (six fixed roles: Owner, Admin, SecurityEngineer, Viewer, MSSPOwner, ClientAdmin; custom/ABAC roles are roadmap)",
      "API",
      "audit exports",
      "private runners"
    ]);
    expect(phases[8]?.exitCriteria).toEqual([
      "MSSP can manage multiple clients",
      "enterprise can govern multiple business units"
    ]);
  });

  it("maps Phase 0 and Phase 1 foundation/Snapshot exit criteria to implementation and tests", async () => {
    const [
      packageJson,
      apiSource,
      prismaSchema,
      moduleSource,
      runtimeServices,
      evidenceStorage,
      evidenceGraph,
      reportSource,
      policySource,
      sharedDomainTests,
      workerSource,
      apiAcceptance
    ] = await Promise.all([
      readRepoFile("package.json"),
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/db/prisma/schema.prisma"),
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("apps/api/src/runtime-services.ts"),
      readRepoFile("packages/evidence/src/storage.ts"),
      readRepoFile("packages/evidence/src/graph.ts"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("packages/policy/src/index.ts"),
      readRepoFile("packages/shared/src/domain.test.ts"),
      readRepoFile("apps/worker/src/processor.ts"),
      readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts")
    ]);
    const foundationEvidence = [
      packageJson,
      apiSource,
      prismaSchema,
      moduleSource,
      runtimeServices,
      evidenceStorage,
      evidenceGraph,
      reportSource,
      policySource,
      sharedDomainTests,
      workerSource,
      apiAcceptance
    ].join("\n");

    for (const path of [
      "apps/web",
      "apps/api",
      "apps/worker",
      "apps/runner",
      "packages/shared",
      "packages/db",
      "packages/policy",
      "packages/evidence",
      "packages/connectors",
      "packages/modules",
      "packages/reports"
    ]) {
      await expectRepoPath(path);
    }

    for (const token of [
      "model Tenant",
      '"/api/v1/auth/signup"',
      "MembershipRoleSchema",
      '"/api/v1/integrations/catalog"',
      '"/api/v1/modules"',
      "BullMQ",
      "putEvidenceArtifact",
      "EvidenceArtifact",
      "upsertNode",
      "renderValidationSnapshotReportHtml",
      "PolicyDecision",
      '"/api/v1/audit-events"',
      '"/api/v1/scopes"',
      "devModeManual",
      "mock.external_exposure",
      "evidenceIds.length).toBeGreaterThan(0)",
      'evidencePack.status).toBe("Ready")'
    ]) {
      expectTextContains(foundationEvidence, token);
    }

    for (const snapshotToken of [
      '"/api/v1/integrations/github/connect"',
      '"/api/v1/integrations/aws/connect"',
      "nuclei.external_exposure_safe",
      "gitleaks.repo_secrets",
      "prowler.aws_posture",
      "trivy.repo_dependency_scan",
      "osv.repo_dependency_scan",
      "correlateAttackPaths",
      "ensureSnapshotRemediationForPath",
      '"/api/v1/snapshots"',
      '"/api/v1/snapshots/:id/export"',
      "maxTopItems: 5",
      "verificationMethod"
    ]) {
      expectTextContains(foundationEvidence, snapshotToken);
    }
  });

  it("maps Phases 2 through 4 to AI app, control validation, and fix-verification proof", async () => {
    const [apiSource, sharedDomain, moduleSource, reportSource, acceptance] =
      await Promise.all([
        readRepoFile("apps/api/src/app.ts"),
        readRepoFile("packages/shared/src/domain.ts"),
        readRepoFile("packages/modules/src/index.ts"),
        readRepoFile("packages/reports/src/index.ts"),
        readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
      ]);
    const proofEvidence = [
      apiSource,
      sharedDomain,
      moduleSource,
      reportSource,
      acceptance
    ].join("\n");

    for (const sourceCoverageTest of [
      "tests/modules/prd-ai-app-validation-coverage.test.ts",
      "tests/modules/prd-control-validation-coverage.test.ts",
      "tests/modules/prd-fix-verification-coverage.test.ts",
      "tests/acceptance/ai-app-validation-provenance-flow.test.ts",
      "tests/acceptance/connector-telemetry-coverage-flow.test.ts",
      "tests/acceptance/fix-verification-measured-posture-flow.test.ts"
    ]) {
      await expectRepoPath(sourceCoverageTest);
    }

    for (const phaseToken of [
      '"/api/v1/ai-apps"',
      '"/api/v1/ai-apps/:id/validate"',
      "ai_app.safe_validation",
      "promptfoo",
      "pyrit",
      "rag",
      "redactionStatus",
      "Periscan AI Security Validation Report",
      '"/api/v1/control-sources/:id/validate"',
      "atomic.control_validation_safe",
      "MITRE ATT&CK",
      "CrowdStrike",
      "Splunk",
      "Detected",
      "Blocked",
      "Missed",
      "NoEvidence",
      "Periscan Control Validation Report",
      '"/api/v1/remediations/:id/create-ticket"',
      '"/api/v1/remediations/:id/verify"',
      "Jira",
      "VerificationEvent",
      "before/after"
    ]) {
      expectTextContains(proofEvidence, phaseToken);
    }
  });

  it("maps Phases 5 through 7 to runner, continuous validation, and operators", async () => {
    const [
      apiSource,
      runnerSource,
      runnerReadme,
      scheduleService,
      scheduleDiffSource,
      runtimeServices,
      operatorSource,
      acceptance
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/runner/main.go"),
      readRepoFile("apps/runner/README.md"),
      readRepoFile("apps/api/src/services/schedules.ts"),
      readRepoFile("apps/api/src/schedule-diff.ts"),
      readRepoFile("apps/api/src/runtime-services.ts"),
      readRepoFile("packages/operators/src/index.ts"),
      readRepoFile("docs/ACCEPTANCE_CRITERIA.md")
    ]);
    const executionEvidence = [
      apiSource,
      runnerSource,
      runnerReadme,
      scheduleService,
      scheduleDiffSource,
      runtimeServices,
      operatorSource,
      acceptance
    ].join("\n");

    for (const sourceCoverageTest of [
      "tests/modules/prd-runner-coverage.test.ts",
      "tests/modules/prd-continuous-exposure-coverage.test.ts",
      "tests/modules/prd-operators-coverage.test.ts",
      "tests/acceptance/runner-gateway-flow.test.ts",
      "tests/acceptance/schedule-pause-run-flow.test.ts"
    ]) {
      await expectRepoPath(sourceCoverageTest);
    }

    for (const phaseToken of [
      '"/api/v1/runners/register"',
      '"/api/v1/runners/:id/poll"',
      "ed25519.Verify",
      "unsigned",
      "scope",
      "runner.reachability_check",
      "upload",
      '"/api/v1/schedules"',
      "buildScheduleDiff",
      "ReopenedRiskDetected",
      '"/api/v1/ctem/program"',
      "RedTeamOperator",
      "BlueTeamOperator",
      "ExposureOperator",
      "RemediationOperator",
      "EvidenceOperator",
      "AIAppSecurityOperator",
      '"/api/v1/operator-recommendations"',
      '"/api/v1/operator-recommendations/:id/approve"',
      "evidenceIds",
      "approvalRequired"
    ]) {
      expectTextContains(executionEvidence, phaseToken);
    }
  });

  it("maps Phase 8 MSSP/Enterprise to tenant hierarchy, branding, SSO, baseline RBAC, APIs, audit exports, and runners", async () => {
    const [
      apiSource,
      sharedDomain,
      prismaSchema,
      msspAcceptance,
      ssoAcceptance,
      governanceAcceptance,
      traceability,
      productionReadiness
    ] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("packages/db/prisma/schema.prisma"),
      readRepoFile("tests/acceptance/enterprise-foundation.test.ts"),
      readRepoFile("tests/acceptance/tenant-sso-config-flow.test.ts"),
      readRepoFile("tests/acceptance/governance-apis-flow.test.ts"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md"),
      readRepoFile("docs/PRODUCTION_READINESS.md")
    ]);
    const enterpriseEvidence = [
      apiSource,
      sharedDomain,
      prismaSchema,
      msspAcceptance,
      ssoAcceptance,
      governanceAcceptance,
      traceability
    ].join("\n");

    // Real enterprise capabilities with executable proof (not string-only).
    for (const phaseToken of [
      "parentTenantId",
      '"/api/v1/tenants/current/clients"',
      '"/api/v1/tenants/current/client-portfolio"',
      '"/api/v1/tenants/current/branding"',
      "white-label",
      "TenantSsoProviderTypeSchema",
      "OIDC",
      "SAML",
      "MembershipRoleSchema",
      "MSSPOwner",
      "ClientAdmin",
      '"/api/v1/audit-events/export"',
      '"/api/v1/runners"',
      "x-periscan-tenant-id",
      "MSSP can manage multiple clients",
      "enterprise can govern multiple business units"
    ]) {
      expectTextContains(enterpriseEvidence, phaseToken);
    }

    // P17-12 honesty: do NOT treat connector "SCIM" or the token "advanced RBAC"
    // as proof of inbound SCIM / custom-role RBAC. Require explicit NotConfigured
    // product honesty for inbound SCIM and BaselineRolesOnly for advanced RBAC.
    const identityHonesty = [sharedDomain, apiSource, productionReadiness].join(
      "\n"
    );
    expectTextContains(identityHonesty, "buildIdentityProvisioningHonesty");
    expectTextContains(identityHonesty, "scimInbound");
    expectTextContains(identityHonesty, "NotConfigured");
    expectTextContains(identityHonesty, "BaselineRolesOnly");
    expectTextContains(identityHonesty, "inbound_scim_not_configured");
    expectTextContains(
      identityHonesty,
      "/api/v1/scim/v2/ServiceProviderConfig"
    );
    expectTextContains(
      identityHonesty,
      "Inbound SCIM 2.0 provisioning of Periscan users"
    );
    // PERISCAN-30: Partial plane + order-form residual (never SCIM Production).
    expectTextContains(identityHonesty, 'planeStatus: "Partial"');
    expectTextContains(identityHonesty, "docs/ENTERPRISE_IDENTITY_LIFECYCLE.md");
    expectTextContains(
      identityHonesty,
      "docs/ops/ENTERPRISE_TRUST_RESIDUAL_2026-07-31.md"
    );
    // customRolesSupported must be literally false in the honesty contract.
    expectTextContains(identityHonesty, "customRolesSupported: false");
    // Must not claim a live SCIM server via successful Users resource handling.
    expect(apiSource.includes("registerScimNotConfiguredRoute")).toBe(true);
    expect(apiSource.includes('status: "501"')).toBe(true);
  });

  it("keeps Build Phases completion tied to source-derived ledgers", async () => {
    const [sourceLedger, requirementLedger, traceability] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md")
    ]);

    expectTextContains(sourceLedger, "SRC-18-BUILD-PHASES");
    expectTextContains(requirementLedger, "PRD-PHASE-001");
    expectTextContains(requirementLedger, "PRD-PHASE-006");
    expectTextContains(traceability, "SRC-18-BUILD-PHASES");
  });
});
