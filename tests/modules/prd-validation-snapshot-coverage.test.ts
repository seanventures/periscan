import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { getConnectorCatalog } from "../../packages/connectors/src/index.js";
import {
  renderValidationSnapshotReportHtml,
  renderValidationSnapshotReportPdf
} from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import {
  AIApplicationSchema,
  ControlSourceSchema,
  IntegrationCategorySchema,
  ReportExportFormatSchema,
  ScopeTypeSchema,
  ValidationSnapshotSchema
} from "../../packages/shared/src/domain.js";

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

describe("PRD section 3.1 Validation Snapshot coverage", () => {
  it("maps every PRD Snapshot input to API-visible scope, integration, app, control, or runner surfaces", async () => {
    const [prd, connectorSource, runnerSpec] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("packages/connectors/src/index.ts"),
      readRepoFile("docs/RUNNER_SPEC.md")
    ]);
    const snapshotSection = sectionBetween(
      prd,
      "### 3.1 Validation Snapshot",
      "### 3.2 Continuous Exposure Validation"
    );
    const inputs = parseBulletsBetween(snapshotSection, "Inputs", "Outputs");
    const scopeTypes = new Set(ScopeTypeSchema.options);
    const integrationCategories = new Set(IntegrationCategorySchema.options);
    const catalog = getConnectorCatalog();
    const snapshotConnectors = catalog.filter((entry) =>
      entry.supportedMissionTypes.includes("ValidationSnapshot")
    );

    expect(inputs).toEqual([
      "verified domain",
      "cloud account",
      "identity provider",
      "code repository",
      "SaaS system",
      "AI app endpoint",
      "security control integration",
      "optional internal runner"
    ]);

    expect([...scopeTypes]).toEqual(
      expect.arrayContaining(["Domain", "Subdomain"])
    );
    expect(scopeTypes).toContain("CloudAccount");
    expect(scopeTypes).toContain("Repository");
    expect(scopeTypes).toContain("AIApplicationEndpoint");
    expect(scopeTypes).toContain("ControlSource");
    expect([...integrationCategories]).toEqual(
      expect.arrayContaining([
        "AIStack",
        "Cloud",
        "Code",
        "Identity",
        "SecurityControl"
      ])
    );
    expect(AIApplicationSchema.shape).toHaveProperty("endpointUrl");
    expect(ControlSourceSchema.shape).toHaveProperty("integrationId");
    expect(snapshotConnectors.some((entry) => entry.category === "Cloud")).toBe(
      true
    );
    expect(
      snapshotConnectors.some((entry) => entry.category === "Identity")
    ).toBe(true);
    expect(snapshotConnectors.some((entry) => entry.category === "Code")).toBe(
      true
    );
    expect(
      snapshotConnectors.some((entry) => entry.category === "SecurityControl")
    ).toBe(true);
    expect(
      snapshotConnectors.some((entry) => entry.category === "AIStack")
    ).toBe(true);
    expect(connectorSource).toContain("SaaSApplication");
    expect(
      snapshotConnectors.some((entry) =>
        /Okta|OneLogin|PingOne|Google Workspace/iu.test(
          `${entry.vendor} ${entry.product}`
        )
      )
    ).toBe(true);
    expect(runnerSpec).toContain("customer-network execution point");
    expect(runnerSpec).toContain("Outbound-only");
    expect(runnerSpec).toContain("outbound poll loop");
    expect(runnerSpec).toContain("HTTPS");
  });

  it("maps Snapshot outputs to normalized snapshot schema fields and report sections", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const snapshotSection = sectionBetween(
      prd,
      "### 3.1 Validation Snapshot",
      "### 3.2 Continuous Exposure Validation"
    );
    const outputs = parseBulletsBetween(
      snapshotSection,
      "Outputs",
      "Requirements"
    );
    const snapshot = ValidationSnapshotSchema.parse(
      createPublicDemoValidationSnapshot()
    );
    const html = renderValidationSnapshotReportHtml(snapshot);
    const technicalHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "TechnicalAppendix"
    });

    expect(outputs).toEqual([
      "top validated exposure paths",
      "control observations",
      "AI app risks, if applicable",
      "attack-path evidence",
      "business impact",
      "remediation priorities",
      "verification plan",
      "evidence summary",
      "technical appendix"
    ]);

    expect(snapshot.topAttackPaths.length).toBeGreaterThanOrEqual(1);
    expect(snapshot.topAttackPaths.length).toBeLessThanOrEqual(5);
    expect(snapshot.controlObservations.length).toBeGreaterThan(0);
    expect(snapshot.aiAppRisks.length).toBeGreaterThan(0);
    expect(snapshot.remediationPriorities.length).toBeGreaterThanOrEqual(
      snapshot.topAttackPaths.length
    );
    expect(snapshot.verificationPlan.length).toBeGreaterThan(0);
    expect(snapshot.evidenceIds.length).toBeGreaterThan(0);
    expect(
      snapshot.topAttackPaths.every(
        ({ attackPath }) =>
          attackPath.evidenceIds.length > 0 && attackPath.impactScore > 0
      )
    ).toBe(true);
    expect(
      snapshot.topAttackPaths.every(({ attackPath }) =>
        snapshot.remediationPriorities.some(
          (remediation) =>
            remediation.relatedPathId === attackPath.pathId &&
            remediation.evidenceIds.length > 0 &&
            remediation.verificationMethod.length > 0
        )
      )
    ).toBe(true);

    const outputReportLabels: Record<string, string> = {
      "AI app risks, if applicable": "AI App Validation",
      "attack-path evidence": "Evidence IDs",
      "business impact": "Impact score",
      "control observations": "Control Verdicts",
      "evidence summary": "Snapshot Coverage",
      "remediation priorities": "Remediation Priorities",
      "technical appendix": "Technical Appendix",
      "top validated exposure paths": "Priority Attack Paths",
      "verification plan": "Verification Plan"
    };

    for (const output of outputs) {
      expect(normalize(`${html}\n${technicalHtml}`)).toContain(
        normalize(outputReportLabels[output] ?? output)
      );
    }
  });

  it("keeps Snapshot requirements API-first, runner-optional, bounded, evidence-backed, and exportable", async () => {
    const [prd, apiRoutes, snapshotService, runtimeServices, reportTests, e2e] =
      await Promise.all([
        readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
        readRepoFile("apps/api/src/app.ts"),
        readRepoFile("apps/api/src/services/snapshots.ts"),
        readRepoFile("apps/api/src/runtime-services.ts"),
        readRepoFile("packages/reports/src/index.test.ts"),
        readRepoFile("tests/e2e/first-customer-proof-loop.spec.ts")
      ]);
    const snapshotSection = sectionBetween(
      prd,
      "### 3.1 Validation Snapshot",
      "### 3.2 Continuous Exposure Validation"
    );
    const requirements = parseBulletsFrom(snapshotSection, "Requirements");
    const createSnapshotInput = sectionBetween(
      apiRoutes,
      "export const CreateSnapshotInputSchema",
      "export const ThreatFeedScheduleInputSchema"
    );
    const snapshot = ValidationSnapshotSchema.parse(
      createPublicDemoValidationSnapshot()
    );
    const pdf = renderValidationSnapshotReportPdf(snapshot);

    expect(requirements).toEqual([
      "Must be usable without deploying internal software.",
      "Must support API-first onboarding.",
      "Must produce 3-5 high-value results, not 500 findings.",
      "Must show evidence and remediation for every result.",
      "Must include a verification plan.",
      "Must be exportable as HTML and PDF."
    ]);

    expect(createSnapshotInput).not.toMatch(/runnerId|internalRunner/iu);
    for (const route of [
      '"/api/v1/auth/signup"',
      '"/api/v1/scopes"',
      '"/api/v1/integrations"',
      '"/api/v1/snapshots"',
      '"/api/v1/snapshots/:id/report"',
      '"/api/v1/snapshots/:id/export"',
      '"/api/v1/reports"',
      '"/api/v1/reports/:id/export"'
    ]) {
      expect(apiRoutes).toContain(route);
    }
    expect(snapshotService).toContain("verified_scope_required");
    expect(snapshotService).toContain(
      "Math.max(3, Math.min(input.maxTopItems ?? 5, 5))"
    );
    expect(runtimeServices).toContain("Math.min(input.maxTopItems, 5)");
    expect(runtimeServices).toContain("for (const path of topAttackPaths)");
    expect(runtimeServices).toContain("remediations.push");
    expect(runtimeServices).not.toContain(
      'path.risk.band === "Critical" || path.risk.band === "High"'
    );
    expect(ReportExportFormatSchema.options).toEqual(["html", "pdf"]);
    expect(reportTests).toContain(
      "renders the required snapshot report sections"
    );
    expect(reportTests).toContain(
      "renders PDF exports from normalized snapshot data"
    );
    expect(e2e).toContain("connectMockIntegration");
    expect(e2e).toContain("/snapshots");
    expect(e2e).toContain("/remediations");
    expect(e2e).toContain("/reports");
    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).toContain("%%EOF");
  });
});
