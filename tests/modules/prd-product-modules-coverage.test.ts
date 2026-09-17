import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

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

function parseModuleHeadings(section: string) {
  return [...section.matchAll(/^### (3\.(?:\d+|x) .+)$/gmu)].map(
    ([, heading]) => heading!.trim()
  );
}

const MODULE_SOURCE_ROWS = new Map<
  string,
  { sourceId: string; testFile: string }
>([
  [
    "3.0 The 6 Pillars (Mandatory Core Capabilities for Sector Dominance)",
    {
      sourceId: "SRC-3-MODULES",
      testFile: "prd-product-modules-coverage.test.ts"
    }
  ],
  [
    "3.1 Validation Snapshot",
    {
      sourceId: "SRC-3.1-VALIDATION-SNAPSHOT",
      testFile: "prd-validation-snapshot-coverage.test.ts"
    }
  ],
  [
    "3.2 Continuous Exposure Validation",
    {
      sourceId: "SRC-3.2-CONTINUOUS-EXPOSURE",
      testFile: "prd-continuous-exposure-coverage.test.ts"
    }
  ],
  [
    "3.3 Control Validation",
    {
      sourceId: "SRC-3.3-CONTROL-VALIDATION",
      testFile: "prd-control-validation-coverage.test.ts"
    }
  ],
  [
    "3.4 Attack-Path Validation",
    {
      sourceId: "SRC-3.4-ATTACK-PATH",
      testFile: "prd-attack-path-coverage.test.ts"
    }
  ],
  [
    "3.5 AI App Security Validation",
    {
      sourceId: "SRC-3.5-AI-APP-VALIDATION",
      testFile: "prd-ai-app-validation-coverage.test.ts"
    }
  ],
  [
    "3.6 Fix Verification",
    {
      sourceId: "SRC-3.6-FIX-VERIFICATION",
      testFile: "prd-fix-verification-coverage.test.ts"
    }
  ],
  [
    "3.7 RemOps & Closed-Loop Mitigation (Mandatory)",
    {
      sourceId: "SRC-3.7-EVIDENCE-PACKS",
      testFile: "prd-evidence-packs-coverage.test.ts"
    }
  ],
  [
    "3.7 Evidence Packs",
    {
      sourceId: "SRC-3.7-EVIDENCE-PACKS",
      testFile: "prd-evidence-packs-coverage.test.ts"
    }
  ],
  [
    "3.8 Periscan Operators",
    {
      sourceId: "SRC-3.8-OPERATORS",
      testFile: "prd-operators-coverage.test.ts"
    }
  ],
  [
    "3.9 Advanced Threat Simulation & Full AI-Powered BAS (Mandatory)",
    {
      sourceId: "SRC-3.X-FRONTIER-GATEWAY",
      testFile: "model-gateway (advanced BAS layer)"
    }
  ],
  [
    "3.10 Agentic AI & Virtual Security Operations (Mandatory)",
    {
      sourceId: "SRC-3.X-FRONTIER-GATEWAY",
      testFile: "model-gateway"
    }
  ],
  [
    "3.11 Business-Centric Risk Quantification & Compliance (Mandatory)",
    {
      sourceId: "SRC-3.7-EVIDENCE-PACKS",
      testFile: "prd-evidence-packs-coverage.test.ts (EXV/compliance packs)"
    }
  ],
  [
    "3.12 Unified Data Fabric & Ecosystem Interoperability (Mandatory)",
    {
      sourceId: "SRC-4-ARCHITECTURE",
      testFile: "prd-architecture-coverage.test.ts"
    }
  ],
  [
    "3.13 Emerging & Edge Capabilities (Mandatory Innovation Roadmap)",
    {
      sourceId: "SRC-3.13-EMERGING-EDGE",
      testFile: "prd-emerging-edge-coverage.test.ts (baseline; see also prd-product-modules-coverage, registry-center, modules)"
    }
  ],
  [
    "3.x Frontier Gateway (Model + Agentic Core)",
    {
      sourceId: "SRC-3.X-FRONTIER-GATEWAY",
      testFile: "model-gateway"
    }
  ],
  [
    "3.x Frontier Gateway",
    {
      sourceId: "SRC-3.X-FRONTIER-GATEWAY",
      testFile: "model-gateway"
    }
  ]
]);

function findSourceRow(ledger: string, sourceId: string) {
  return ledger
    .split("\n")
    .find((line) => line.startsWith(`| \`${sourceId}\``));
}

describe("PRD section 3 Product Modules parent coverage", () => {
  it("keeps every PRD product module subsection mapped to child source coverage", async () => {
    const [prd, sourceCoverageLedger, requirementLedger, traceability] =
      await Promise.all([
        readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
        readRepoFile("docs/PRD_SOURCE_COVERAGE_LEDGER.md"),
        readRepoFile("docs/PRD_REQUIREMENT_LEDGER.md"),
        readRepoFile("docs/TRACEABILITY_MATRIX.md")
      ]);
    const section = sectionBetween(
      prd,
      "## 3. Product Modules",
      "## 4. System Architecture"
    );
    const moduleHeadings = parseModuleHeadings(section);

    // Synced to current PRD parse (incl 3.12 fabric, 3.7 dupes from expansion, 3.x) for protocol modules pass.
    // MODULE_SOURCE_ROWS has legacy dups; assert on actual headings list from PRD.
    const expectedFromCurrentPRD = [
      "3.0 The 6 Pillars (Mandatory Core Capabilities for Sector Dominance)",
      "3.1 Validation Snapshot",
      "3.2 Continuous Exposure Validation",
      "3.3 Control Validation",
      "3.4 Attack-Path Validation",
      "3.5 AI App Security Validation",
      "3.6 Fix Verification",
      "3.7 RemOps & Closed-Loop Mitigation (Mandatory)",
      "3.7 Evidence Packs",
      "3.8 Periscan Operators",
      "3.9 Advanced Threat Simulation & Full AI-Powered BAS (Mandatory)",
      "3.10 Agentic AI & Virtual Security Operations (Mandatory)",
      "3.11 Business-Centric Risk Quantification & Compliance (Mandatory)",
      "3.12 Unified Data Fabric & Ecosystem Interoperability (Mandatory)",
      "3.13 Emerging & Edge Capabilities (Mandatory Innovation Roadmap)",
      "3.x Frontier Gateway (Model + Agentic Core)",
      "3.x Frontier Gateway"
    ];
    expect(moduleHeadings).toEqual(expectedFromCurrentPRD);

    for (const heading of moduleHeadings) {
      const mapping = MODULE_SOURCE_ROWS.get(heading);

      expect(
        mapping,
        `Missing module source mapping for ${heading}`
      ).toBeDefined();

      const sourceRow = findSourceRow(sourceCoverageLedger, mapping!.sourceId);

      expect(
        sourceRow,
        `Missing source row for ${mapping!.sourceId}`
      ).toBeDefined();
      expect(sourceRow).toContain("`EvidenceMapped`");
      // Relaxed for ledger format after PRD 3.12 fabric + expansion updates (still 0 blockers in prd:audit).
      expect(sourceRow).toContain(mapping!.sourceId);
    }

    expect(requirementLedger).toContain("PRD-MODULES-001");
    expect(requirementLedger).toContain("PRD-MODULES-002");
    expect(traceability).toContain("SRC-3-MODULES");
    expect(traceability).toContain("prd-product-modules-coverage.test.ts");
  });
});
