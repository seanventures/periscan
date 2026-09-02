import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { BILLING_PACKAGE_CATALOG } from "../../apps/api/src/runtime-services.js";
import {
  renderValidationSnapshotReportHtml,
  renderValidationSnapshotReportPdf
} from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import { ValidationSnapshotSchema } from "../../packages/shared/src/domain.js";

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

function parseNumberedItems(
  section: string,
  startLabel: string,
  endLabel: string
) {
  return sectionBetween(section, startLabel, endLabel)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s/u.test(line))
    .map((line) => line.replace(/^\d+\.\s/u, "").trim());
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

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

describe("PRD section 19 First Sellable MVP coverage", () => {
  it("maps the MVP flow to API-first acceptance and E2E proof-loop coverage", async () => {
    const [prd, acceptance, e2e, apiRoutes] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts"),
      readRepoFile("tests/e2e/first-customer-proof-loop.spec.ts"),
      readRepoFile("apps/api/src/app.ts")
    ]);
    const section = sectionBetween(
      prd,
      "## 19. First Sellable MVP",
      "## 20. Codex Master Instruction"
    );
    const flow = parseNumberedItems(section, "MVP Flow", "MVP Report");
    const flowEvidence = `${acceptance}\n${e2e}`;
    const validationSnapshotPackage = BILLING_PACKAGE_CATALOG.find(
      (billingPackage) => billingPackage.packageKey === "ValidationSnapshot"
    );

    expect(section).toContain("Periscan Validation Snapshot");
    expect(flow).toEqual([
      "User creates account.",
      "User verifies domain.",
      "User connects GitHub.",
      "User connects AWS.",
      "User optionally registers AI app.",
      "Periscan runs safe validation modules.",
      "Periscan correlates top paths.",
      "Periscan generates Snapshot report.",
      "User creates remediation.",
      "User triggers fix verification."
    ]);

    for (const route of [
      "/auth/signup",
      "/scopes",
      "/verify",
      "/integrations/github/connect",
      "/integrations/aws/connect",
      "/snapshots",
      "/snapshots/${snapshotResponse.json().snapshotId}/report",
      "/remediations",
      "/mark-ready-for-verification",
      "/verify"
    ]) {
      expect(flowEvidence).toContain(route);
    }

    expect(apiRoutes).toContain('"/api/v1/ai-apps"');
    expect(flowEvidence).toContain("/ai-apps");
    expect(validationSnapshotPackage?.includedCapabilities).toContain(
      "AI app registry"
    );
    expect(validationSnapshotPackage?.includedMeterNames).toContain(
      "AIApplications"
    );
    expect(flowEvidence).toContain("maxTopItems: 5");
    expect(flowEvidence).toContain("topAttackPaths");
    expect(flowEvidence).toContain("evidenceIds");
  });

  it("renders the MVP report sections from a 3-5 item evidence-backed Snapshot", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "## 19. First Sellable MVP",
      "## 20. Codex Master Instruction"
    );
    const reportBullets = parseBulletsBetween(
      section,
      "MVP Report",
      "MVP Success Signal"
    );
    const snapshot = ValidationSnapshotSchema.parse(
      createPublicDemoValidationSnapshot()
    );
    const html = renderValidationSnapshotReportHtml(snapshot, {
      packType: "ValidationSnapshotReport"
    });
    const pdf = renderValidationSnapshotReportPdf(snapshot, {
      packType: "ValidationSnapshotReport"
    });

    expect(reportBullets).toEqual([
      "executive summary",
      "top 3-5 validated paths",
      "control observations",
      "AI app risks",
      "remediation priorities",
      "verification plan",
      "evidence appendix"
    ]);

    expect(snapshot.topAttackPaths.length).toBeGreaterThanOrEqual(3);
    expect(snapshot.topAttackPaths.length).toBeLessThanOrEqual(5);
    expect(snapshot.metrics.topPathCount).toBe(snapshot.topAttackPaths.length);
    expect(snapshot.controlObservations.length).toBeGreaterThan(0);
    expect(snapshot.aiAppRisks.length).toBeGreaterThan(0);
    expect(snapshot.remediationPriorities.length).toBeGreaterThanOrEqual(
      snapshot.topAttackPaths.length
    );
    expect(snapshot.verificationPlan.length).toBeGreaterThan(0);

    for (const { attackPath } of snapshot.topAttackPaths) {
      expect(attackPath.evidenceIds.length).toBeGreaterThan(0);
      expect(attackPath.pathBreakers.length).toBeGreaterThan(0);
      expect(
        snapshot.remediationPriorities.some(
          (remediation) =>
            remediation.relatedPathId === attackPath.pathId &&
            remediation.evidenceIds.length > 0 &&
            remediation.verificationMethod.length > 0
        )
      ).toBe(true);
    }

    for (const label of [
      "Executive Summary",
      "Priority Attack Paths",
      "Control Verdicts",
      "AI App Validation",
      "Remediation Priorities",
      "Verification Plan",
      "Evidence Appendix"
    ]) {
      expect(html).toContain(label);
      expect(pdf).toContain(label);
    }
  });

  it("keeps the MVP success signal visible in the public demo surface", async () => {
    const [prd, demoComponent, demoComponentTest] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/web/src/components/public-demo-report.tsx"),
      readRepoFile("apps/web/src/components/public-demo-report.test.tsx")
    ]);
    const section = sectionBetween(
      prd,
      "## 19. First Sellable MVP",
      "## 20. Codex Master Instruction"
    );
    const sourceQuoteMatch = section.match(/"This is not a scanner\.[^"]+"/u);

    expect(sourceQuoteMatch?.[0]).toBeDefined();

    const sourceQuote = normalizeWhitespace(sourceQuoteMatch![0]);

    expect(normalizeWhitespace(demoComponent)).toContain(sourceQuote);
    expect(demoComponent).toContain("MVP success signal");
    expect(demoComponentTest).toContain("MVP success signal");
    expect(demoComponentTest).toContain("This is not a scanner");
  });
});
