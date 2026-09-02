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

function parseBulletsBetween(
  section: string,
  startLabel: string,
  endLabel: string
) {
  const start = section.indexOf(startLabel);

  if (start === -1) {
    throw new Error(`Unable to find label: ${startLabel}`);
  }

  const end = section.indexOf(endLabel, start + startLabel.length);

  if (end === -1) {
    throw new Error(`Unable to find end label: ${endLabel}`);
  }

  return section
    .slice(start + startLabel.length, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
}

describe("PRD section 20 Codex Master Instruction coverage", () => {
  it("keeps the standing product outcome, tagline, safety rules, engineering rules, and stack explicit", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 20. Codex Master Instruction",
      "## 21. Codex Implementation Tickets"
    );

    expectTextContains(
      section,
      "Periscan validates exposure, controls, attack paths, AI applications, and fixes, then turns the results into proof."
    );
    expectTextContains(
      section,
      "Find the path. Validate the risk. Prove it's fixed."
    );
    expectTextContains(
      section,
      "Use open-source tools as internal validation engines where useful, but do not expose OSS plumbing to the user."
    );
    expectTextContains(
      section,
      "Periscan owns the control plane, policy engine, evidence graph, signal fabric, module registry, risk engine, remediation engine, fix verification, evidence packs, integrations, and product UX."
    );

    expect(
      parseBulletsBetween(section, "Safety rules:", "Engineering rules:")
    ).toEqual([
      "Only validate customer-authorized scope.",
      "No destructive actions.",
      "No real data exfiltration.",
      "No persistence.",
      "No credential theft.",
      "No uncontrolled exploit chaining.",
      "No third-party scanning without verified authorization.",
      "Default to read-only and passive checks.",
      "Every validation task must be scoped, policy-approved, logged, auditable, and evidence-backed."
    ]);
    expect(
      parseBulletsBetween(section, "Engineering rules:", "Stack:")
    ).toEqual([
      "Implement in small PR-sized slices.",
      "Add tests for every new service and module.",
      "Keep modules pluggable.",
      "Use typed schemas and runtime validation.",
      "Keep raw evidence separate from normalized evidence.",
      "Every conclusion must link to evidence.",
      "Do not mark a risk fixed unless a verification event proves it."
    ]);
    expect(
      parseBulletsBetween(
        `${section}\n## 21. Codex Implementation Tickets`,
        "Stack:",
        "## 21. Codex Implementation Tickets"
      )
    ).toEqual([
      "apps/web: Next.js + TypeScript.",
      "apps/api: Fastify or NestJS + TypeScript.",
      "apps/worker: TypeScript worker.",
      "apps/runner: Go runner.",
      "packages/shared: shared schemas and types.",
      "packages/policy: policy/safety engine.",
      "packages/evidence: evidence graph and storage.",
      "packages/connectors: integration connectors.",
      "packages/modules: validation modules.",
      "packages/reports: evidence pack generator.",
      "Postgres, Redis/BullMQ, MinIO/S3."
    ]);
  });

  it("maps product promise and OSS-internal philosophy to public docs and product-owned surfaces", async () => {
    const [
      readme,
      prd,
      architecture,
      roadmap,
      openSourcePolicy,
      reports,
      modules,
      evidence,
      connectors
    ] = await Promise.all([
      readRepoFile("README.md"),
      readRepoFile("PRD.md"),
      readRepoFile("ARCHITECTURE.md"),
      readRepoFile("ROADMAP.md"),
      readRepoFile("OPEN_SOURCE_POLICY.md"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("packages/modules/src/index.ts"),
      readRepoFile("packages/evidence/src/index.ts"),
      readRepoFile("packages/connectors/src/index.ts")
    ]);
    const combined = [
      readme,
      prd,
      architecture,
      roadmap,
      openSourcePolicy,
      reports,
      modules,
      evidence,
      connectors
    ].join("\n");

    for (const token of [
      "self-service Automated Security Validation platform",
      "validates exposure, controls, attack paths, AI applications, and fixes",
      "Find the path. Validate the risk. Prove it's fixed.",
      "Periscan uses open-source tools internally as validation engines",
      "Raw tool output must not become the primary user experience.",
      "control plane",
      "policy engine",
      "evidence graph",
      "module registry",
      "Fix Verification",
      "evidence pack",
      "integration"
    ]) {
      expectTextContains(combined, token);
    }
  });

  it("maps safety rules to executable boundaries, policy gates, and security tests", async () => {
    const [
      agents,
      boundaries,
      policySource,
      validationService,
      workerTest,
      securityTests
    ] = await Promise.all([
      readRepoFile("AGENTS.md"),
      readRepoFile("SECURITY_BOUNDARIES.md"),
      readRepoFile("packages/policy/src/index.ts"),
      readRepoFile("apps/api/src/services/validation.ts"),
      readRepoFile("apps/worker/src/processor.test.ts"),
      readRepoFile("tests/security/security-boundaries.test.ts")
    ]);
    const combined = [
      agents,
      boundaries,
      policySource,
      validationService,
      workerTest,
      securityTests
    ].join("\n");

    for (const token of [
      "Only validate verified customer-authorized scope.",
      "No destructive actions.",
      "No real data exfiltration.",
      "No persistence",
      "credential theft",
      "uncontrolled exploit chaining",
      "No third-party scanning without verified authorization.",
      "Default to read-only collection and passive validation.",
      "Every validation run needs a policy decision and audit event.",
      "Denied tasks must never be queued.",
      "requires verified scope and prevents denied safety decisions from queueing jobs",
      "denies unsafe OSS module starts before queueing jobs"
    ]) {
      expectTextContains(combined, token);
    }
  });

  it("maps engineering rules to typed schemas, tests, evidence separation, and verification-only fixed state", async () => {
    const [
      agents,
      packageJson,
      sharedDomain,
      workerProcessor,
      reportSource,
      remediationService,
      validationProvenance,
      fixVerificationAcceptance,
      auditProtocol
    ] = await Promise.all([
      readRepoFile("AGENTS.md"),
      readRepoFile("package.json"),
      readRepoFile("packages/shared/src/domain.ts"),
      readRepoFile("apps/worker/src/processor.ts"),
      readRepoFile("packages/reports/src/index.ts"),
      readRepoFile("apps/api/src/services/remediation.ts"),
      readRepoFile("tests/security/validation-provenance.test.ts"),
      readRepoFile(
        "tests/acceptance/fix-verification-measured-posture-flow.test.ts"
      ),
      readRepoFile("docs/PRD_AUDIT_PROTOCOL.md")
    ]);
    const combined = [
      agents,
      packageJson,
      sharedDomain,
      workerProcessor,
      reportSource,
      remediationService,
      validationProvenance,
      fixVerificationAcceptance,
      auditProtocol
    ].join("\n");

    for (const token of [
      "Add tests for schema, service, route, module, policy, and evidence behavior",
      '"verify"',
      "zod",
      "EvidenceArtifact",
      "RawModuleOutput",
      "NormalizedEvidence",
      "evidenceIds",
      "VerificationEvent",
      "A risk cannot be marked fixed without a verification event.",
      "source-derived regression test"
    ]) {
      expectTextContains(combined, token);
    }
  });

  it("maps the prescribed stack to workspace packages and runtime dependencies", async () => {
    for (const path of [
      "apps/web",
      "apps/api",
      "apps/worker",
      "apps/runner",
      "packages/shared",
      "packages/policy",
      "packages/evidence",
      "packages/connectors",
      "packages/modules",
      "packages/reports",
      "infra/docker-compose"
    ]) {
      await expectRepoPath(path);
    }

    const [
      webPackage,
      apiPackage,
      workerPackage,
      rootPackage,
      runnerModule,
      compose,
      dbSchema
    ] = await Promise.all([
      readRepoFile("apps/web/package.json"),
      readRepoFile("apps/api/package.json"),
      readRepoFile("apps/worker/package.json"),
      readRepoFile("package.json"),
      readRepoFile("apps/runner/go.mod"),
      readRepoFile("infra/docker-compose/docker-compose.yml"),
      readRepoFile("packages/db/prisma/schema.prisma")
    ]);
    const combined = [
      webPackage,
      apiPackage,
      workerPackage,
      rootPackage,
      runnerModule,
      compose,
      dbSchema
    ].join("\n");

    for (const token of [
      '"next"',
      '"typescript"',
      '"fastify"',
      '"bullmq"',
      "go 1.22",
      "postgres",
      "redis",
      "minio",
      "datasource db"
    ]) {
      expectTextContains(combined, token);
    }
  });

  it("keeps Codex Master Instruction completion tied to source-derived ledgers", async () => {
    const [sourceLedger, requirementLedger, traceability] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md")
    ]);

    expectTextContains(sourceLedger, "SRC-20-CODEX-MASTER-INSTRUCTION");
    expectTextContains(requirementLedger, "PRD-CODEXMASTER-001");
    expectTextContains(requirementLedger, "PRD-CODEXMASTER-006");
    expectTextContains(traceability, "SRC-20-CODEX-MASTER-INSTRUCTION");
  });
});
