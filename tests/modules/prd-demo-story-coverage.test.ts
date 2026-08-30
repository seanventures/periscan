import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

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

function parseNumberedItems(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s/u.test(line))
    .map((line) => line.replace(/^\d+\.\s/u, "").trim());
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

describe("PRD section 22 First Demo Story coverage", () => {
  it("keeps the public demo story aligned to every numbered PRD step", async () => {
    const [prd, demoComponent, demoComponentTest] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/web/src/components/public-demo-report.tsx"),
      readRepoFile("apps/web/src/components/public-demo-report.test.tsx")
    ]);
    const section = sectionBetween(
      prd,
      "## 22. First Demo Story",
      "## 23. Definition of Done for V1"
    );
    const storySteps = parseNumberedItems(section);
    const storyListMatch = demoComponent.match(
      /<ol className="story-list">(?<body>[\s\S]*?)<\/ol>/u
    );
    const renderedStoryItems =
      storyListMatch?.groups?.body.match(/<li>/gu) ?? [];

    expect(storySteps).toEqual([
      "Periscan finds a fake repo secret.",
      "Periscan maps it to possible cloud access.",
      "Periscan identifies a path to production impact.",
      "Periscan checks whether a control saw related activity.",
      "Periscan recommends a path breaker.",
      "Periscan creates a remediation task.",
      "Periscan re-tests.",
      "Periscan marks the risk fixed or still exposed.",
      "Periscan generates evidence."
    ]);
    expect(renderedStoryItems).toHaveLength(storySteps.length);

    for (const sourceMappedFragment of [
      "redacted fake repository secret",
      "possible cloud role access",
      "production impact",
      "mock SIEM saw related credential-use activity",
      "highest-value path breaker",
      "remediation task with evidence IDs",
      "fix verification workflow",
      "fixed or still exposed",
      "evidence pack without raw scanner dumps"
    ]) {
      expect(normalizeWhitespace(demoComponent)).toContain(
        sourceMappedFragment
      );
      expect(demoComponentTest).toContain(sourceMappedFragment);
    }
  });

  it("backs the first demo story with normalized sample Snapshot evidence", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const serializedSnapshot = JSON.stringify(snapshot);
    const secretPath = snapshot.topAttackPaths.find(
      ({ attackPath }) =>
        attackPath.name === "Repository secret to production cloud role"
    );

    expect(secretPath).toBeDefined();
    expect(serializedSnapshot).toContain("redacted repository secret");
    expect(serializedSnapshot).toContain("redacted secret fingerprint");
    expect(serializedSnapshot).not.toContain("AKIA");
    expect(serializedSnapshot).not.toContain("password=");

    expect(secretPath!.attackPath.pathNodes.map((node) => node.label)).toEqual([
      "GitHub repo: periscan-fixtures/demo-app",
      "Sample cloud role: prod-artifact-reader",
      "Production artifact bucket"
    ]);
    expect(
      secretPath!.attackPath.pathEdges.map((edge) => edge.relationship)
    ).toContain("CAN_ACCESS");
    expect(secretPath!.attackPath.impactScore).toBeGreaterThanOrEqual(90);
    expect(secretPath!.risk.band).toBe("Critical");
    expect(secretPath!.attackPath.evidenceIds.length).toBeGreaterThan(0);

    expect(snapshot.controlObservations[0]).toMatchObject({
      signalSubcategory: "Missed credential-use detection",
      sourceType: "Mock SIEM observer",
      sourceVendor: "Splunk"
    });
    expect(secretPath!.attackPath.pathBreakers[0]).toMatchObject({
      title: "Rotate credential and remove role trust"
    });

    const remediation = snapshot.remediationPriorities.find(
      (candidate) => candidate.relatedPathId === secretPath!.attackPath.pathId
    );

    expect(remediation).toBeDefined();
    expect(remediation!.evidenceIds.length).toBeGreaterThan(0);
    expect(remediation!.recommendedAction).toContain("Rotate");
    expect(remediation!.verificationMethod).toContain("mark fixed only after");
    expect(snapshot.verificationPlan.join("\n")).toContain(
      "Rerun GitHub secret validation"
    );
    expect(snapshot.verificationPlan.join("\n")).toContain(
      "mock SIEM observer"
    );
    expect(snapshot.evidencePack.status).toBe("Ready");
    expect(snapshot.evidencePack.evidenceIds).toEqual(snapshot.evidenceIds);
  });

  it("requires the API-first proof loop to create, retest, verdict, evidence, and report", async () => {
    const [acceptance, e2e] = await Promise.all([
      readRepoFile("tests/acceptance/api-first-mvp-flow.test.ts"),
      readRepoFile("tests/e2e/first-customer-proof-loop.spec.ts")
    ]);
    const proofLoopCoverage = `${acceptance}\n${e2e}`;

    for (const routeOrAssertion of [
      "/remediations",
      "/create-ticket",
      "/mark-ready-for-verification",
      "/verify",
      "repository secret",
      "demoStoryPath",
      "verificationEvent.evidenceIds",
      "verificationEvent.outcome",
      '["Fixed", "StillExposed"]',
      "/evidence/",
      "/reports",
      "/export"
    ]) {
      expect(proofLoopCoverage).toContain(routeOrAssertion);
    }
  });
});
