import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  renderValidationSnapshotReportHtml,
  renderValidationSnapshotReportPdf
} from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import type {
  EvidencePack,
  ValidationSnapshot
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

function withAudience(
  snapshot: ValidationSnapshot,
  audience: string
): ValidationSnapshot {
  return {
    ...snapshot,
    evidencePack: {
      ...snapshot.evidencePack,
      audience
    }
  };
}

const PRD_REPORT_SECTIONS = [
  "Executive Summary",
  "Priority Attack Paths",
  "Control Verdicts",
  "AI App Validation",
  "Remediation Priorities",
  "Verification Plan",
  "Evidence Appendix",
  "Methodology and Safety Notes"
];

const PRD_AUDIENCE_VARIANTS: Array<{
  audience: string;
  label: string;
  packType: EvidencePack["packType"];
}> = [
  {
    audience: "Executive",
    label: "Periscan Executive Risk Summary",
    packType: "ExecutiveRiskSummary"
  },
  {
    audience: "Security Team",
    label: "Periscan Validation Snapshot Report",
    packType: "ValidationSnapshotReport"
  },
  {
    audience: "GRC",
    label: "Periscan SOC 2 Support Pack",
    packType: "SOC2Support"
  },
  {
    audience: "Customer Review",
    label: "Periscan Customer Security Review Pack",
    packType: "CustomerSecurityReview"
  },
  {
    audience: "Auditor",
    label: "Periscan ISO Support Pack",
    packType: "ISOSupport"
  },
  {
    audience: "Cyber Insurance",
    label: "Periscan Cyber Insurance Evidence Pack",
    packType: "CyberInsuranceEvidence"
  },
  {
    audience: "MSSP Client",
    label: "Periscan MSSP Client QBR",
    packType: "MSSPClientQBR"
  },
  {
    audience: "Technical Appendix",
    label: "Periscan Technical Appendix",
    packType: "TechnicalAppendix"
  }
];

describe("PRD section 16 Reports coverage", () => {
  it("renders every PRD Validation Snapshot Report section in HTML and PDF", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(prd, "## 16. Reports", "## 17. Pricing");
    const sourceSections = parseBulletsBetween(
      section,
      "Sections:",
      "### 16.2 Audience Variants"
    );
    const snapshot = createPublicDemoValidationSnapshot();
    const html = renderValidationSnapshotReportHtml(snapshot, {
      packType: "ValidationSnapshotReport"
    });
    const pdf = renderValidationSnapshotReportPdf(snapshot, {
      packType: "ValidationSnapshotReport"
    });

    expect(sourceSections).toEqual(PRD_REPORT_SECTIONS);
    expect(html).toContain("Periscan Validation Snapshot Report");
    expect(pdf).toContain("Periscan Validation Snapshot Report");

    for (const reportSection of sourceSections) {
      expect(html).toContain(reportSection);
      expect(pdf).toContain(reportSection);
    }

    expect(html).toContain("generated this report from normalized evidence");
    expect(html).toContain(snapshot.evidenceIds[0]!);
    expect(html).toContain("Raw tool output is intentionally excluded");
  });

  it("supports every PRD audience variant through API-stable report templates", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(prd, "## 16. Reports", "## 17. Pricing");
    const sourceAudiences = parseBulletsFrom(
      section,
      "### 16.2 Audience Variants"
    );
    const snapshot = createPublicDemoValidationSnapshot();

    expect(sourceAudiences).toEqual(
      PRD_AUDIENCE_VARIANTS.map(({ audience }) => audience)
    );

    for (const { audience, label, packType } of PRD_AUDIENCE_VARIANTS) {
      const audienceSnapshot = withAudience(snapshot, audience);
      const html = renderValidationSnapshotReportHtml(audienceSnapshot, {
        packType
      });
      const pdf = renderValidationSnapshotReportPdf(audienceSnapshot, {
        packType
      });

      expect(html).toContain(label);
      expect(html).toContain(audience);
      expect(html).toContain("Audience Guidance");
      expect(html).toContain("Primary use");
      expect(html).toContain("Redaction posture");
      expect(pdf).toContain(label);
      expect(pdf).toContain(`Audience: ${audience}`);
    }
  });
});
