import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

function sectionBefore(source: string, nextHeader: string) {
  const end = source.indexOf(nextHeader);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(0, end);
}

function extractValueAfterHeading(section: string, heading: string) {
  const start = section.indexOf(heading);

  if (start === -1) {
    throw new Error(`Unable to find heading: ${heading}`);
  }

  const afterHeading = section.slice(start + heading.length);
  const match = afterHeading.match(/\n\n([^\n][\s\S]*?)(?=\n\n## |\n\n$)/u);

  if (!match?.[1]) {
    throw new Error(`Unable to extract value for heading: ${heading}`);
  }

  return match[1].trim();
}

describe("PRD preamble product identity coverage", () => {
  it("keeps product name, category, promise, definition, and founder context explicit in source", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const preamble = sectionBefore(prd, "## 1. Product Vision");

    expect(extractValueAfterHeading(preamble, "## Product Name")).toBe(
      "Periscan"
    );
    expect(extractValueAfterHeading(preamble, "## Product Category")).toBe(
      "Self-service Automated Security Validation platform"
    );
    expect(extractValueAfterHeading(preamble, "## Core Product Promise")).toBe(
      "Find the path. Validate the risk. Prove it's fixed."
    );
    expect(
      extractValueAfterHeading(preamble, "## One-Sentence Product Definition")
    ).toBe(
      "Periscan validates exposure, controls, attack paths, AI applications, and fixes - then turns the results into proof customers can use."
    );

    const marketContext = extractValueAfterHeading(
      preamble,
      "## Founder / Market Context"
    );
    for (const requiredContext of [
      "founded in 2004 by Sean Heiney",
      "rebuilt in 2026",
      "cloud, identity, SaaS, code, AI applications, internal systems, and security controls",
      "Internal market context",
      "Frost report",
      "internal strategy material only"
    ]) {
      expect(marketContext).toContain(requiredContext);
    }
  });

  it("maps product identity and promise to root docs, package metadata, and public app metadata", async () => {
    const [rootPrd, readme, packageJson, appLayout, homePage, apiReference] =
      await Promise.all([
        readRepoFile("PRD.md"),
        readRepoFile("README.md"),
        readRepoFile("package.json"),
        readRepoFile("apps/web/app/layout.tsx"),
        readRepoFile("apps/web/app/page.tsx"),
        readRepoFile("apps/web/src/components/api-reference-console.tsx")
      ]);
    const packageMetadata = JSON.parse(packageJson) as { name?: string };
    const publicIdentityEvidence = [
      rootPrd,
      readme,
      appLayout,
      homePage,
      apiReference
    ].join("\n");

    expect(packageMetadata.name).toBe("periscan");
    expect(rootPrd).toContain(
      "Periscan is a self-service Automated Security Validation platform."
    );
    expect(readme).toContain(
      "Periscan is a self-service Automated Security Validation platform."
    );
    expect(rootPrd).toContain(
      "Find the path. Validate the risk. Prove it's fixed."
    );
    expect(readme).toContain(
      "Find the path. Validate the risk. Prove it's fixed."
    );
    expect(publicIdentityEvidence).toContain(
      "Periscan validates exposure, controls, attack paths, AI applications, and fixes"
    );
    expect(publicIdentityEvidence).toContain("turns the results into proof");
    // The layout title must be Periscan-branded (a descriptive suffix like
    // "— Evidence Command Center" is allowed; the brand must lead).
    expect(appLayout).toContain('title: "Periscan');
    expect(apiReference).toContain("Periscan API");
  });

  it("keeps internal market context out of public product surfaces", async () => {
    const [readme, rootPrd, appLayout, homePage, publicDemo, reportsSource] =
      await Promise.all([
        readRepoFile("README.md"),
        readRepoFile("PRD.md"),
        readRepoFile("apps/web/app/layout.tsx"),
        readRepoFile("apps/web/app/page.tsx"),
        readRepoFile("apps/web/src/components/public-demo-report.tsx"),
        readRepoFile("packages/reports/src/index.ts")
      ]);
    const publicSurfaces = [
      readme,
      rootPrd,
      appLayout,
      homePage,
      publicDemo,
      reportsSource
    ].join("\n");

    for (const internalOnlyToken of [
      "Frost report",
      "Sean Heiney",
      "founded in 2004",
      "uploaded Frost",
      "autonomous penetration testing",
      "red-team automation",
      "breach-and-attack simulation",
      "internal strategy material only"
    ]) {
      expect(publicSurfaces).not.toContain(internalOnlyToken);
    }
  });

  it("keeps product-meta completion tied to source-derived ledgers", async () => {
    const [sourceLedger, requirementLedger, traceability] = await Promise.all([
      readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
      readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
      readRepoFile("docs/TRACEABILITY_MATRIX.md")
    ]);

    expect(sourceLedger).toContain("SRC-0-META");
    expect(requirementLedger).toContain("PRD-META-001");
    expect(requirementLedger).toContain("PRD-META-005");
    expect(traceability).toContain("SRC-0-META");
  });
});
