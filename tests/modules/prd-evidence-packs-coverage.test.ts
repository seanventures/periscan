import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  renderValidationSnapshotReportHtml,
  renderValidationSnapshotReportPdf
} from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import {
  EvidencePackTypeSchema,
  ReportExportFormatSchema,
  type EvidencePack,
  type TenantReportBranding
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

type PackMapping = {
  labels: string[];
  packTypes: EvidencePack["packType"][];
};

const PRD_PACK_TYPE_MAP = new Map<string, PackMapping>([
  [
    "Executive Risk Summary",
    {
      labels: ["Periscan Executive Risk Summary"],
      packTypes: ["ExecutiveRiskSummary"]
    }
  ],
  [
    "Customer Security Review Pack",
    {
      labels: ["Periscan Customer Security Review Pack"],
      packTypes: ["CustomerSecurityReview"]
    }
  ],
  [
    "Cyber Insurance Evidence Pack",
    {
      labels: ["Periscan Cyber Insurance Evidence Pack"],
      packTypes: ["CyberInsuranceEvidence"]
    }
  ],
  [
    "SOC 2 / ISO Support Pack",
    {
      labels: ["Periscan SOC 2 Support Pack", "Periscan ISO Support Pack"],
      packTypes: ["SOC2Support", "ISOSupport"]
    }
  ],
  [
    "PCI Support Pack",
    {
      labels: ["Periscan PCI Support Pack"],
      packTypes: ["PCISupport"]
    }
  ],
  [
    "BAS / Control Validation Report",
    {
      labels: ["Periscan Control Validation Report"],
      packTypes: ["ControlValidationReport"]
    }
  ],
  [
    "AI Security Validation Report",
    {
      labels: ["Periscan AI Security Validation Report"],
      packTypes: ["AIAppValidationReport"]
    }
  ],
  [
    "CTEM Program Summary",
    {
      labels: ["Periscan CTEM Program Summary"],
      packTypes: ["CTEMProgramSummary"]
    }
  ],
  [
    "MSSP Client QBR",
    {
      labels: ["Periscan MSSP Client QBR"],
      packTypes: ["MSSPClientQBR"]
    }
  ],
  [
    "Technical Appendix",
    {
      labels: ["Periscan Technical Appendix"],
      packTypes: ["TechnicalAppendix"]
    }
  ],
  [
    "Remediation Closure Pack",
    {
      labels: ["Periscan Remediation Closure Pack"],
      packTypes: ["RemediationClosurePack"]
    }
  ]
]);

describe("PRD section 3.7 Evidence Packs coverage", () => {
  it("maps every PRD evidence-pack type to public report contracts and rendered labels", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "### 3.7 Evidence Packs",
      "### 3.8 Periscan Operators"
    );
    const packBullets = parseBulletsBetween(
      section,
      "Evidence Pack Types",
      "Requirements"
    );
    const snapshot = createPublicDemoValidationSnapshot();

    expect(packBullets).toEqual([...PRD_PACK_TYPE_MAP.keys()]);

    for (const sourceLabel of packBullets) {
      const mapping = PRD_PACK_TYPE_MAP.get(sourceLabel);

      expect(
        mapping,
        `Missing Evidence Pack mapping for ${sourceLabel}`
      ).toBeDefined();

      for (const packType of mapping!.packTypes) {
        expect(EvidencePackTypeSchema.safeParse(packType).success).toBe(true);
        const html = renderValidationSnapshotReportHtml(snapshot, { packType });

        expect(html).toContain("Audience Guidance");
        expect(html).toContain("Primary use");
        expect(html).toContain("Redaction posture");
        expect(html).toContain("Evidence IDs");
      }

      for (const label of mapping!.labels) {
        const htmlForLabels = mapping!.packTypes
          .map((packType) =>
            renderValidationSnapshotReportHtml(snapshot, { packType })
          )
          .join("\n");

        expect(htmlForLabels).toContain(label);
      }
    }
  });

  it("proves Evidence Pack requirements from normalized, redacted, evidence-ID backed report data", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "### 3.7 Evidence Packs",
      "### 3.8 Periscan Operators"
    );
    const requirements = parseBulletsFrom(section, "Requirements");
    const snapshot = createPublicDemoValidationSnapshot();
    const reportHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "CyberInsuranceEvidence"
    });
    const executiveHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "ExecutiveRiskSummary"
    });
    const technicalHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "TechnicalAppendix"
    });
    const controlHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "ControlValidationReport"
    });
    const aiHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "AIAppValidationReport"
    });
    const msspHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "MSSPClientQBR"
    });
    const closureHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "RemediationClosurePack"
    });

    expect(requirements).toEqual([
      "Reports must be generated from normalized evidence.",
      "Reports must include evidence IDs.",
      "Reports must redact sensitive data.",
      "Reports must support different audiences.",
      "Reports must export as HTML and PDF.",
      "Reports must support white-labeling for MSSPs."
    ]);

    expect(reportHtml).toContain(
      "generated this report from normalized evidence"
    );
    expect(reportHtml).toContain(snapshot.evidenceIds[0]!);
    expect(reportHtml).toContain("Raw tool output is intentionally excluded");
    expect(reportHtml).not.toContain("AKIA");
    expect(reportHtml).not.toContain("password=");
    expect(reportHtml).not.toContain("rawPayloadPointer");

    expect(executiveHtml).toContain("Periscan Executive Risk Summary");
    expect(executiveHtml).not.toContain("Evidence Appendix");
    expect(technicalHtml).toContain("Periscan Technical Appendix");
    expect(technicalHtml).toContain("Evidence Appendix");
    expect(controlHtml).toContain("Control Verdicts");
    expect(controlHtml).not.toContain("AI App Validation");
    expect(aiHtml).toContain("Periscan AI Security Validation Report");
    expect(aiHtml).toContain("AI App Validation");
    expect(aiHtml).not.toContain("Control Verdicts");
    expect(msspHtml).toContain("MSSP Client Delivery Notes");
    expect(msspHtml).toContain("CTEM Program View");
    expect(closureHtml).toContain("Remediation Closure Evidence");
  });

  it("keeps HTML/PDF export APIs and white-label branding tied to evidence packs", async () => {
    const [apiRoutes, snapshotServices, prismaSchema] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/api/src/services/snapshots.ts"),
      readRepoFile("packages/db/prisma/schema.prisma")
    ]);
    const snapshot = createPublicDemoValidationSnapshot();
    const pdf = renderValidationSnapshotReportPdf(snapshot, {
      packType: "MSSPClientQBR"
    });
    const branding: TenantReportBranding = {
      createdAt: snapshot.createdAt,
      logoUrl: "https://assets.periscan.test/partner.svg",
      organizationName: "Partner SOC",
      primaryColor: "#0F766E",
      reportFooter: "Prepared by Partner SOC for its managed client.",
      supportEmail: "support@partner-soc.example",
      tenantId: snapshot.tenantId,
      updatedAt: snapshot.updatedAt,
      whiteLabelEnabled: true
    };
    const brandedHtml = renderValidationSnapshotReportHtml(snapshot, {
      branding,
      packType: "MSSPClientQBR"
    });

    expect(ReportExportFormatSchema.options).toEqual(["html", "pdf"]);
    expect(apiRoutes).toContain('"/api/v1/reports/:id/export"');
    expect(apiRoutes).toContain('"/api/v1/snapshots/:id/export"');
    expect(snapshotServices).toContain("renderValidationSnapshotReportHtml");
    expect(snapshotServices).toContain("loadOrCreateEvidencePackPdf");
    expect(prismaSchema).toContain("model EvidencePack");
    expect(prismaSchema).toContain("model TenantReportBranding");

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("Periscan MSSP Client QBR");
    expect(pdf).toContain(snapshot.evidenceIds[0]!);
    expect(pdf).toContain("%%EOF");

    expect(brandedHtml).toContain("Partner SOC");
    expect(brandedHtml).toContain("Prepared by Partner SOC");
    expect(brandedHtml).toContain("support@partner-soc.example");
    expect(brandedHtml).toContain("--accent: #0F766E");
  });
});
