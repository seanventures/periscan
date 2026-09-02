import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type {
  DesignPartnerReportNote,
  EvidencePack,
  TenantReportBranding,
  ThreatAdvisoryDetail,
  ValidationSnapshot
} from "@periscan/shared";
import { createPublicDemoValidationSnapshot } from "@periscan/shared";

import {
  buildCTEMProgramSummary,
  renderAdvisoryReadinessReportHtml,
  renderAdvisoryReadinessReportPdf,
  renderValidationSnapshotReportHtml,
  renderValidationSnapshotReportPdf
} from "./index.js";

function createSnapshotFixture(): ValidationSnapshot {
  const timestamp = "2026-06-01T00:00:00.000Z";
  const tenantId = randomUUID();
  const evidenceId = randomUUID();
  const pathId = randomUUID();
  const remediationId = randomUUID();

  return {
    aiAppRisks: [],
    controlObservations: [
      {
        confidence: 0.78,
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        freshness: "Fresh",
        rawPayloadPointer: null,
        redactionStatus: "Redacted",
        relatedAssetIds: [],
        relatedControlIds: [randomUUID()],
        relatedEvidenceIds: [evidenceId],
        relatedIdentityIds: [],
        relatedPathIds: [],
        sensitivityLevel: "Moderate",
        signalCategory: "ControlObservation",
        signalId: randomUUID(),
        signalSubcategory: "Missed",
        sourceIntegrationId: randomUUID(),
        sourceType: "mock.control_validation.validation",
        sourceVendor: "Periscan",
        techniqueIds: ["T1595"],
        tenantId,
        timestampIngested: timestamp,
        timestampObserved: timestamp,
        updatedAt: timestamp
      }
    ],
    createdAt: timestamp,
    evidenceIds: [evidenceId],
    evidencePack: {
      audience: "Security Team",
      createdAt: timestamp,
      evidenceIds: [evidenceId],
      evidencePackId: randomUUID(),
      packType: "ValidationSnapshotReport",
      redactionLevel: "Moderate",
      status: "Ready",
      storageUri: "file:///tmp/snapshot.html",
      tenantId,
      title: "Validation Snapshot",
      updatedAt: timestamp
    },
    integrationIds: [randomUUID(), randomUUID()],
    metrics: {
      aiRiskCount: 0,
      controlObservationCount: 1,
      correlatedThreatAdvisoryCount: 1,
      highRiskPathCount: 1,
      integrationCount: 2,
      openThreatAdvisoryCount: 2,
      remediationCount: 1,
      staleVerificationCount: 1,
      topPathCount: 1,
      verifiedScopeCount: 1
    },
    missionId: randomUUID(),
    remediationPriorities: [
      {
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        owner: "Security engineering",
        recommendedAction:
          "Rotate the exposed secret and remove the role path.",
        relatedExposureId: randomUUID(),
        relatedPathId: pathId,
        remediationId,
        status: "Open",
        technicalSteps: [
          "Rotate the secret",
          "Revoke the role session",
          "Rerun validation"
        ],
        tenantId,
        ticketId: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod:
          "Rerun the repository and cloud validation modules.",
        verificationRequired: true
      },
      {
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        latestVerification: {
          measuredRevalidation: true,
          outcome: "Fixed",
          retestMethod: "Reran the cloud posture module.",
          verifiedAt: timestamp
        },
        owner: "Cloud platform",
        recommendedAction: "Restrict the over-permissioned IAM role.",
        relatedExposureId: randomUUID(),
        relatedPathId: pathId,
        remediationId: randomUUID(),
        status: "Fixed",
        technicalSteps: ["Scope the role policy", "Rerun cloud posture"],
        tenantId,
        ticketId: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod: "Rerun the cloud posture module.",
        verificationRequired: true
      }
    ],
    scopeIds: [randomUUID()],
    snapshotId: randomUUID(),
    summary: {
      headline: "Validated repo secret path",
      overview:
        "Periscan found a production path that should be remediated immediately.",
      topRiskBand: "Critical"
    },
    tenantId,
    topAttackPaths: [
      {
        attackPath: {
          confidence: 0.92,
          createdAt: timestamp,
          entryNodeId: randomUUID(),
          evidenceBasis: "Heuristic",
          evidenceIds: [evidenceId],
          impactNodeId: randomUUID(),
          impactScore: 91,
          name: "Repository secret to production cloud role",
          pathBreakers: [
            {
              createdAt: timestamp,
              description: "Rotate the secret.",
              evidenceIds: [evidenceId],
              pathBreakerId: randomUUID(),
              pathId,
              priority: 1,
              relatedNodeId: null,
              tenantId,
              title: "Rotate secret",
              updatedAt: timestamp
            }
          ],
          pathEdges: [],
          pathId,
          pathNodes: [],
          tenantId,
          updatedAt: timestamp,
          validationState: "Validated"
        },
        risk: {
          band: "Critical",
          factors: [],
          score: 89,
          summary: "Validated production path with urgent remediation priority."
        }
      }
    ],
    updatedAt: timestamp,
    verificationPlan: ["Rerun the repository and cloud validation modules."]
  };
}

function createAdvisoryDetailFixture(): ThreatAdvisoryDetail {
  const timestamp = "2026-06-01T00:00:00.000Z";
  const tenantId = randomUUID();
  const threatAdvisoryId = randomUUID();
  const evidenceId = randomUUID();
  const normalizedEvidenceId = randomUUID();
  const missingSignalId = randomUUID();
  const planId = randomUUID();
  const planItemId = randomUUID();
  const readinessReportId = randomUUID();
  const evidencePackId = randomUUID();

  return {
    advisory: {
      createdAt: timestamp,
      cveIds: ["CVE-2026-12345"],
      evidenceIds: [evidenceId, normalizedEvidenceId],
      iocValues: ["https://advisory.example.invalid/path", "203.0.113.55"],
      publishedAt: timestamp,
      rawEvidenceId: evidenceId,
      receivedAt: timestamp,
      sourceName: "Manual advisory",
      sourceUrl: "https://source.example.invalid/advisory",
      status: "PlanReady",
      summary:
        "Advisory summary suitable for readiness planning without raw payloads.",
      techniqueIds: ["T1059.001"],
      tenantId,
      threatAdvisoryId,
      title: "Manual campaign advisory",
      updatedAt: timestamp
    },
    impactAssessment: {
      advisoryImpactAssessmentId: randomUUID(),
      affectedAssetIds: [],
      affectedFindingIds: [],
      confidence: 0.42,
      createdAt: timestamp,
      evidenceIds: [normalizedEvidenceId],
      missingSignalIds: [missingSignalId],
      summary:
        "Impact remains incomplete until missing tenant telemetry is configured.",
      tenantId,
      threatAdvisoryId,
      updatedAt: timestamp
    },
    missingSignals: [
      {
        createdAt: timestamp,
        missingSignalId,
        reason: "No verified scope is present for this advisory.",
        relatedEntityId: threatAdvisoryId,
        relatedEntityType: "ThreatAdvisory",
        requiredIntegrationCategory: null,
        signalType: "verified_scope",
        status: "RequiresVerifiedScope",
        tenantId,
        updatedAt: timestamp
      }
    ],
    package: {
      createdAt: timestamp,
      cveIds: ["CVE-2026-12345"],
      evidenceIds: [normalizedEvidenceId],
      iocValues: ["https://advisory.example.invalid/path", "203.0.113.55"],
      summary: "Normalized advisory package.",
      techniqueIds: ["T1059.001"],
      tenantId,
      threatAdvisoryId,
      threatPackageId: randomUUID(),
      title: "Manual campaign advisory",
      updatedAt: timestamp
    },
    rawEvidenceId: evidenceId,
    readinessReport: {
      advisoryReadinessReportId: readinessReportId,
      createdAt: timestamp,
      evidenceIds: [normalizedEvidenceId],
      evidencePackId,
      missingSignalIds: [missingSignalId],
      readinessStatus: "MissingSignals",
      summary: "Readiness is blocked by 1 missing signal source.",
      tenantId,
      threatAdvisoryId,
      updatedAt: timestamp
    },
    validationPlan: {
      createdAt: timestamp,
      evidenceIds: [normalizedEvidenceId],
      planItems: [
        {
          createdAt: timestamp,
          evidenceIds: [normalizedEvidenceId],
          missingSignalIds: [missingSignalId],
          missionType: "ExposureValidation",
          rationale:
            "Assess advisory relevance only after verified customer scope exists.",
          requiredIntegrationCategories: [],
          requiredScopeTypes: ["Domain"],
          safetyLevel: "PassiveReadOnly",
          status: "RequiresVerifiedScope",
          tenantId,
          threatValidationPlanId: planId,
          threatValidationPlanItemId: planItemId,
          title: "Assess advisory relevance against verified scope",
          updatedAt: timestamp
        }
      ],
      status: "RequiresVerifiedScope",
      summary:
        "Non-executing advisory validation plan. Items remain policy-gated.",
      tenantId,
      threatAdvisoryId,
      threatValidationPlanId: planId,
      updatedAt: timestamp
    }
  };
}

function attachAiRisk(snapshot: ValidationSnapshot) {
  const aiEvidenceId = randomUUID();

  snapshot.aiAppRisks = [
    {
      confidence: 0.81,
      createdAt: snapshot.createdAt,
      evidenceIds: [aiEvidenceId],
      freshness: "Fresh",
      rawPayloadPointer: null,
      redactionStatus: "Redacted",
      relatedAssetIds: [],
      relatedControlIds: [],
      relatedEvidenceIds: [aiEvidenceId],
      relatedIdentityIds: [],
      relatedPathIds: [],
      sensitivityLevel: "Moderate",
      signalCategory: "AIApplication",
      signalId: randomUUID(),
      signalSubcategory: "PromptInjectionSusceptibility",
      sourceIntegrationId: randomUUID(),
      sourceType: "mock.ai_app_validation.validation",
      sourceVendor: "Periscan",
      techniqueIds: [],
      tenantId: snapshot.tenantId,
      timestampIngested: snapshot.createdAt,
      timestampObserved: snapshot.createdAt,
      updatedAt: snapshot.updatedAt
    }
  ];
  snapshot.metrics.aiRiskCount = 1;
}

describe("renderValidationSnapshotReportHtml", () => {
  it("localizes report-template chrome while preserving evidence identifiers and claim values", () => {
    const snapshot = createSnapshotFixture();
    const html = renderValidationSnapshotReportHtml(snapshot, {
      locale: "es-ES"
    });

    expect(html).toContain('<html lang="es-ES">');
    expect(html).toContain("Resumen ejecutivo");
    expect(html).toContain("Rutas de ataque prioritarias");
    for (const evidenceId of snapshot.evidenceIds) {
      expect(html).toContain(evidenceId);
    }
    expect(html).toContain(snapshot.summary.topRiskBand);
  });

  it("renders the required snapshot report sections", () => {
    const html = renderValidationSnapshotReportHtml(createSnapshotFixture());

    expect(html).toContain("Periscan Validation Snapshot Report");
    expect(html).toContain("Snapshot Coverage");
    expect(html).toContain("Priority Attack Paths");
    // Each path card declares its evidence basis (measured vs heuristic) so the
    // report is honest about which paths are proven vs inferred.
    expect(html).toContain("Claim certainty");
    expect(html).toContain(
      "Claim basis: no path hops are recorded; reachability remains a hypothesis."
    );
    // Inline-SVG risk-band distribution chart, driven by the real snapshot.
    expect(html).toContain("Priority paths by risk band");
    expect(html).toContain("<svg");
    expect(html).toContain("<title>Critical: 1</title>");
    expect(html).toContain("Control Verdicts");
    expect(html).not.toContain("AI App Validation");
    expect(html).toContain("Remediation Priorities");
    // Continuous-validation surface: re-verification staleness + threat exposure.
    expect(html).toContain("Fixes overdue for re-verification");
    expect(html).toContain("Open threat advisories");
    expect(html).toContain("Verification Plan");
    expect(html).toContain("Evidence Appendix");
    expect(html).toContain("Methodology and Safety Notes");
    expect(html).toContain(
      "Rotate the exposed secret and remove the role path."
    );
    expect(html).toContain("Last verification:");
    expect(html).toContain("Fixed (measured re-validation)");
    expect(html).toContain(
      "No AI validation signals were attached to this snapshot."
    );
    expect(html).toContain("Evidence IDs:");
    expect(html).toContain("T1595");
    expect(html).toContain("Active Scanning");
    // Detection telemetry by technique surfaces which tool reported each
    // technique (techniqueId + sourceVendor) in the rendered report.
    expect(html).toContain("Detection telemetry by technique");
    expect(html).toContain("Periscan");
  });

  it("re-derives path claims during export so stale heuristic data cannot claim validation", () => {
    const snapshot = createSnapshotFixture();
    snapshot.summary.headline = "Critical validated paths require action.";
    snapshot.summary.overview =
      "A critical path was validated from heuristic correlation.";
    snapshot.topAttackPaths[0]!.risk.summary =
      "Validated production path with urgent remediation priority.";

    const html = renderValidationSnapshotReportHtml(snapshot);
    const pdf = renderValidationSnapshotReportPdf(snapshot);

    expect(html).toContain(
      "Critical-risk heuristic path hypothesis requires measurement before any reachable or validated-path claim."
    );
    expect(pdf).toContain(
      "Critical-risk heuristic path hypothesis requires measurement before any reachable or"
    );
    expect(pdf).toContain("validated-path claim.");
    for (const report of [html, pdf]) {
      expect(report).toContain(
        "Critical-risk path hypothesis requires validation."
      );
      expect(report).not.toContain("Critical validated paths require action.");
      expect(report).not.toContain(
        "Validated production path with urgent remediation priority."
      );
    }
  });

  it("never presents Heuristic paths as Validated from severity or stale row state (Wave A / A6)", () => {
    const snapshot = createSnapshotFixture();
    // Fixture path: evidenceBasis Heuristic, validationState Validated, empty hops,
    // Critical band — severity must not mint a validated-path claim.
    expect(snapshot.topAttackPaths[0]!.attackPath.evidenceBasis).toBe(
      "Heuristic"
    );
    expect(snapshot.topAttackPaths[0]!.attackPath.validationState).toBe(
      "Validated"
    );
    expect(snapshot.topAttackPaths[0]!.risk.band).toBe("Critical");

    const html = renderValidationSnapshotReportHtml(snapshot);
    const pdf = renderValidationSnapshotReportPdf(snapshot);

    for (const report of [html, pdf]) {
      // Claim-safe state is remapped off Validated when hops are not fully measured.
      expect(report).toContain("Claim-safe path state");
      expect(report).toContain("Discovered");
      expect(report).toContain("Heuristic hypothesis");
      // PDF wraps long lines — assert the phrase in pieces.
      expect(report).toContain("Severity alone");
      expect(report).toContain("never validates a path");
      // Stale headline / risk copy must not reappear.
      expect(report).not.toContain("Validated production path");
    }

    // HTML: claim-safe dd is Discovered; recorded Validated is labeled not claim-safe.
    expect(html).toContain(
      "<div><dt>Claim-safe path state</dt><dd>Discovered</dd></div>"
    );
    expect(html).not.toContain(
      "<div><dt>Claim-safe path state</dt><dd>Validated</dd></div>"
    );
    expect(html).toContain("Severity alone never validates a path");
    expect(html).toContain("not claim-safe");
    expect(html).toContain("Path certainty remap");
    expect(html).toContain(
      "Risk severity sets priority only; it never upgrades path certainty."
    );
    // PDF records claim-safe Discovered and remapped recorded-row disclosure.
    expect(pdf).toContain("Claim-safe path state: Discovered");
    expect(pdf).not.toContain("Claim-safe path state: Validated");
    expect(pdf).toContain("not claim-safe");
    expect(pdf).toContain("Claim basis:");
  });

  it("renders the AI App Validation section only when AI evidence is attached", () => {
    const snapshot = createSnapshotFixture();
    attachAiRisk(snapshot);

    const html = renderValidationSnapshotReportHtml(snapshot);

    expect(html).toContain("AI App Validation");
    expect(html).toContain("PromptInjectionSusceptibility");
  });

  it("renders every PRD evidence pack type with audience guidance", () => {
    const cases: Array<[EvidencePack["packType"], string]> = [
      ["ExecutiveRiskSummary", "Periscan Executive Risk Summary"],
      ["CustomerSecurityReview", "Periscan Customer Security Review Pack"],
      ["CyberInsuranceEvidence", "Periscan Cyber Insurance Evidence Pack"],
      [
        "SOC2Support",
        "Customer SOC 2 support evidence (not vendor attestation)"
      ],
      ["ISOSupport", "Periscan ISO Support Pack"],
      ["PCISupport", "Periscan PCI Support Pack"],
      ["ControlValidationReport", "Periscan Control Validation Report"],
      ["AIAppValidationReport", "Periscan AI Security Validation Report"],
      ["CTEMProgramSummary", "Periscan CTEM Program Summary"],
      ["MSSPClientQBR", "Periscan MSSP Client QBR"],
      ["TechnicalAppendix", "Periscan Technical Appendix"],
      ["RemediationClosurePack", "Periscan Remediation Closure Pack"],
      ["ValidationSnapshotReport", "Periscan Validation Snapshot Report"],
      [
        "ThreatAdvisoryReadinessReport",
        "Periscan Threat Advisory Readiness Report"
      ]
    ];

    for (const [packType, label] of cases) {
      const html = renderValidationSnapshotReportHtml(createSnapshotFixture(), {
        packType
      });

      expect(html).toContain(label);
      expect(html).toContain("Audience Guidance");
      expect(html).toContain("Primary use");
      expect(html).toContain("Redaction posture");
    }
  });

  it("renders compliance and customer-review packs without claiming certification", () => {
    const html = renderValidationSnapshotReportHtml(createSnapshotFixture(), {
      packType: "SOC2Support"
    });

    expect(html).toContain("Compliance Support");
    expect(html).toContain("customer evidence support");
    expect(html).toContain("does not assert");
    expect(html).toMatch(/not a certification/i);
    expect(html).toMatch(/not an audit opinion/i);
    expect(html).toContain("Evidence Appendix");
  });

  it("puts not certification / not audit opinion on every compliance attestation pack HTML and PDF", () => {
    const frameworks = [
      "DORAAttestation",
      "NIS2Attestation",
      "SECAttestation",
      "GDPRAttestation",
      "PCIDSSAttestation",
      "ISO27001Attestation",
      "EUAiActAttestation",
      "ISO42001Attestation",
      "HIPAAAttestation",
      "SOC2Attestation",
      "NISTCSFAttestation"
    ] as const;

    for (const packType of frameworks) {
      const html = renderValidationSnapshotReportHtml(createSnapshotFixture(), {
        packType
      });
      const pdf = renderValidationSnapshotReportPdf(createSnapshotFixture(), {
        packType
      });
      expect(html, packType).toMatch(/not a certification/i);
      expect(html, packType).toMatch(/not an audit opinion/i);
      expect(pdf, packType).toMatch(/not a certification/i);
      expect(pdf, packType).toMatch(/not an audit opinion/i);
    }
  });

  it("puts not certification / not audit opinion on SOC2/ISO/PCI support packs HTML and PDF", () => {
    for (const packType of ["SOC2Support", "ISOSupport", "PCISupport"] as const) {
      const html = renderValidationSnapshotReportHtml(createSnapshotFixture(), {
        packType
      });
      const pdf = renderValidationSnapshotReportPdf(createSnapshotFixture(), {
        packType
      });
      expect(html, packType).toMatch(/not a certification/i);
      expect(html, packType).toMatch(/not an audit opinion/i);
      expect(pdf, packType).toMatch(/not a certification/i);
      expect(pdf, packType).toMatch(/not an audit opinion/i);
      expect(html, packType).toMatch(/Customer evidence support only/i);
    }
  });

  it("renders a compliance evidence-support pack as a per-control measured evidence trace in HTML and PDF", () => {
    const snapshot = createSnapshotFixture();
    const riskEvidenceId = randomUUID();
    const riskAcceptances = [
      {
        approvalState: "Approved" as const,
        approvedAt: "2026-07-14T12:30:00.000Z",
        approvedByLabel: "Independent Reviewer",
        evidenceId: riskEvidenceId,
        expiresAt: "2026-10-14T23:59:59.000Z",
        findingId: "finding-cloud-trust",
        note: "Compensating monitoring remains active.",
        ownerLabel: "Cloud Platform",
        requestedByLabel: "Security Lead",
        updatedAt: "2026-07-14T12:00:00.000Z"
      }
    ];
    const html = renderValidationSnapshotReportHtml(snapshot, {
      packType: "HIPAAAttestation",
      riskAcceptances
    });
    const pdf = renderValidationSnapshotReportPdf(snapshot, {
      packType: "HIPAAAttestation",
      riskAcceptances
    });

    expect(html).toContain("Compliance Control Trace");
    expect(html).toContain(
      "Measured control evidence for HIPAA Security Rule (partial)"
    );
    expect(html).toContain("Customer evidence support only");
    expect(html).toMatch(/not a certification/i);
    expect(html).toMatch(/not an audit opinion/i);
    expect(html).toContain("45 CFR §164.308");
    expect(html).toContain("Measured support");
    expect(html).toContain(snapshot.evidenceIds[0]!);
    expect(html).toContain("Accepted-Risk Governance");
    expect(html).toContain("Independent Reviewer");
    expect(html).toContain(riskEvidenceId);
    expect(pdf).toContain("Compliance Control Trace");
    // PDF escapes parentheses in text operators, e.g. \(partial\).
    expect(pdf).toContain("Measured control evidence for HIPAA Security Rule");
    expect(pdf).toContain("Customer evidence support only");
    expect(pdf).toMatch(/not a certification/i);
    expect(pdf).toMatch(/not an audit opinion/i);
    expect(pdf).toContain("164.308");
    expect(pdf).toContain("Accepted-Risk Governance");
    expect(pdf).toContain("Independent Reviewer");
    expect(pdf).toContain(riskEvidenceId);
  });

  it("renders customer security review as customer-safe without the technical appendix", () => {
    const html = renderValidationSnapshotReportHtml(createSnapshotFixture(), {
      packType: "CustomerSecurityReview"
    });

    expect(html).toContain("Periscan Customer Security Review Pack");
    expect(html).toContain("Compliance Support");
    expect(html).not.toContain("Evidence Appendix");
  });

  it("renders focused AI and control validation reports without unrelated sections", () => {
    const snapshot = createSnapshotFixture();
    attachAiRisk(snapshot);

    const controlHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "ControlValidationReport"
    });
    const aiHtml = renderValidationSnapshotReportHtml(snapshot, {
      packType: "AIAppValidationReport"
    });

    expect(controlHtml).toContain("Control Verdicts");
    expect(controlHtml).not.toContain("AI App Validation");
    expect(aiHtml).toContain("AI App Validation");
    expect(aiHtml).not.toContain("Control Verdicts");
  });

  it("renders MSSP QBR and remediation closure template sections", () => {
    const msspHtml = renderValidationSnapshotReportHtml(
      createSnapshotFixture(),
      {
        packType: "MSSPClientQBR"
      }
    );
    const closureHtml = renderValidationSnapshotReportHtml(
      createSnapshotFixture(),
      {
        packType: "RemediationClosurePack"
      }
    );

    expect(msspHtml).toContain("MSSP Client Delivery Notes");
    expect(msspHtml).toContain("CTEM Program View");
    expect(closureHtml).toContain("Remediation Closure Evidence");
    expect(closureHtml).toContain("Still requiring proof");
    expect(closureHtml).toContain("Measured re-validations");
    expect(closureHtml).toContain("1 of 1");
    expect(closureHtml).toContain("measured re-validation");
    expect(closureHtml).toContain("Restrict the over-permissioned IAM role.");
  });

  it("renders executive reports without the evidence appendix", () => {
    const html = renderValidationSnapshotReportHtml(createSnapshotFixture(), {
      packType: "ExecutiveRiskSummary"
    });

    expect(html).toContain("Periscan Executive Risk Summary");
    expect(html).not.toContain("Evidence Appendix");
    expect(html).toContain("Priority Attack Paths");
    // P04-11: board pack must disclose Measured vs Heuristic path honesty.
    expect(html).toContain("Path claim honesty");
    // P12-17: honesty trust metrics on every executive-facing pack
    expect(html).toContain("Honesty trust metrics");
    expect(html).toContain("% claims Measured");
    expect(html).toContain("Do not treat this pack as certification");
    expect(html).toContain("Fully measured multi-hop");
    // P04-20: board packs count Closed without evidence separately from Fixed.
    expect(html).toContain("Remediation Closure Evidence");
    expect(html).toContain("Closed without evidence");
    expect(html).toContain("Fixed or mitigated (verified)");
  });

  it("counts ClosedWithoutEvidence separately from Fixed in remediation closure", () => {
    const snapshot = createSnapshotFixture();
    snapshot.remediationPriorities.push({
      ...snapshot.remediationPriorities[0]!,
      recommendedAction: "Ticket-closed without retest",
      remediationId: randomUUID(),
      status: "ClosedWithoutEvidence",
      latestVerification: undefined
    });
    const html = renderValidationSnapshotReportHtml(snapshot, {
      packType: "RemediationClosurePack"
    });

    expect(html).toContain("Closed without evidence");
    // One Fixed in the fixture, one ClosedWithoutEvidence added.
    expect(html).toMatch(/Closed without evidence<\/dt><dd>1<\/dd>/);
    expect(html).toContain(
      "must not be reported as verified remediation"
    );
  });

  it("renders technical appendix reports with the appendix visible", () => {
    const html = renderValidationSnapshotReportHtml(createSnapshotFixture(), {
      packType: "TechnicalAppendix"
    });

    expect(html).toContain("Periscan Technical Appendix");
    expect(html).toContain("Evidence Appendix");
  });

  it("renders Periscan analyst notes in HTML exports when attached", () => {
    const snapshot = createSnapshotFixture();
    const analystNote: DesignPartnerReportNote = {
      authorLabel: "Periscan Analyst",
      body: "Founder context for the customer review.\n\nValidate the fix before the audit.",
      createdAt: snapshot.createdAt,
      reportId: snapshot.evidencePack.evidencePackId,
      tenantId: snapshot.tenantId,
      title: "Founder note",
      updatedAt: snapshot.updatedAt
    };
    const html = renderValidationSnapshotReportHtml(snapshot, {
      analystNote
    });

    expect(html).toContain("Periscan Analyst Notes");
    expect(html).toContain("Founder note");
    expect(html).toContain("Periscan Analyst");
    expect(html).toContain("Founder context for the customer review.");
    expect(html).toContain("Validate the fix before the audit.");
  });

  it("renders PDF exports from normalized snapshot data", () => {
    const snapshot = createSnapshotFixture();
    const pdf = renderValidationSnapshotReportPdf(snapshot);

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("Periscan Validation Snapshot Report");
    expect(pdf).toContain("Repository secret to production cloud role");
    expect(pdf).toContain(snapshot.evidenceIds[0]!);
    expect(pdf).toContain("Raw tool output is intentionally excluded");
    expect(pdf).toContain("Detection Telemetry by Technique");
    expect(pdf).toContain(
      "Last verification: Fixed \\(measured re-validation\\)"
    );
    expect(pdf).toContain("%%EOF");
  });

  it("renders executive PDF exports without the evidence appendix", () => {
    const snapshot = createSnapshotFixture();
    const pdf = renderValidationSnapshotReportPdf(snapshot, {
      packType: "ExecutiveRiskSummary"
    });

    expect(pdf).toContain("Periscan Executive Risk Summary");
    expect(pdf).not.toContain("Evidence Appendix");
  });

  it("renders Periscan analyst notes in PDF exports when attached", () => {
    const snapshot = createSnapshotFixture();
    const analystNote: DesignPartnerReportNote = {
      authorLabel: "Periscan Analyst",
      body: "Founder context for the customer review.",
      createdAt: snapshot.createdAt,
      reportId: snapshot.evidencePack.evidencePackId,
      tenantId: snapshot.tenantId,
      title: "Founder note",
      updatedAt: snapshot.updatedAt
    };
    const pdf = renderValidationSnapshotReportPdf(snapshot, {
      analystNote
    });

    expect(pdf).toContain("Periscan Analyst Notes");
    expect(pdf).toContain("Founder note");
    expect(pdf).toContain("Author: Periscan Analyst");
    expect(pdf).toContain("Founder context for the customer review.");
  });

  it("discloses measured re-validation basis in the PDF closure pack", () => {
    const snapshot = createSnapshotFixture();
    const pdf = renderValidationSnapshotReportPdf(snapshot, {
      packType: "RemediationClosurePack"
    });

    expect(pdf).toContain("Remediation Closure Evidence");
    expect(pdf).toContain("Measured re-validations: 1 of 1");
    // PDF string delimiters escape parens, so match the escaped form.
    expect(pdf).toContain(
      "Last verification: Fixed \\(measured re-validation\\)"
    );
  });

  it("renders the CTEM program view when requested", () => {
    const html = renderValidationSnapshotReportHtml(createSnapshotFixture(), {
      packType: "CTEMProgramSummary"
    });

    expect(html).toContain("Periscan CTEM Program Summary");
    expect(html).toContain("CTEM Program View");
    expect(html).toContain("Scope");
    expect(html).toContain("Validate");
  });

  it("preserves CTEM summary provenance for Snapshot and live baselines", () => {
    const snapshot = createSnapshotFixture();
    const snapshotProgram = buildCTEMProgramSummary(snapshot);
    const baselineProgram = buildCTEMProgramSummary(snapshot, {
      snapshotId: null,
      source: "LiveTenantStateBaseline"
    });
    const html = renderValidationSnapshotReportHtml(snapshot, {
      ctemProgram: baselineProgram,
      packType: "CTEMProgramSummary"
    });

    expect(snapshotProgram).toMatchObject({
      snapshotId: snapshot.snapshotId,
      source: "Snapshot"
    });
    expect(baselineProgram).toMatchObject({
      snapshotId: null,
      source: "LiveTenantStateBaseline"
    });
    expect(html).toContain(
      "Live tenant-state baseline; no Snapshot report has been generated yet"
    );
  });

  it("renders explicitly enabled white-label report branding", () => {
    const snapshot = createSnapshotFixture();
    const branding: TenantReportBranding = {
      createdAt: snapshot.createdAt,
      logoUrl: "https://assets.periscan.test/acme.svg",
      organizationName: "Acme Advisory",
      primaryColor: "#0F766E",
      reportFooter: "Prepared by Acme Advisory for the customer security team.",
      supportEmail: "security@acme.test",
      tenantId: snapshot.tenantId,
      updatedAt: snapshot.updatedAt,
      whiteLabelEnabled: true
    };
    const html = renderValidationSnapshotReportHtml(snapshot, {
      branding
    });

    expect(html).toContain("Acme Advisory");
    expect(html).toContain("Prepared by Acme Advisory");
    expect(html).toContain("security@acme.test");
    expect(html).toContain("--accent: #0F766E");
  });

  it("renders the public demo snapshot through the same report generator", () => {
    const html = renderValidationSnapshotReportHtml(
      createPublicDemoValidationSnapshot()
    );

    expect(html).toContain("Sample Validation Snapshot");
    expect(html).toContain(
      "Critical-risk path hypothesis requires validation."
    );
    expect(html).toContain("Priority Attack Paths");
    expect(html).toContain("Control Verdicts");
    expect(html).toContain("AI App Validation");
    expect(html).toContain("T1552");
    expect(html).toContain("Unsecured Credentials");
    expect(html).toContain("Evidence IDs");
    expect(html).not.toContain("AKIA");
    expect(html).not.toContain("password=");
  });
});

describe("renderAdvisoryReadinessReportHtml", () => {
  it("renders advisory readiness sections from normalized data only", () => {
    const html = renderAdvisoryReadinessReportHtml(
      createAdvisoryDetailFixture()
    );

    expect(html).toContain("Periscan Threat Center");
    expect(html).toContain("Manual campaign advisory");
    expect(html).toContain("Readiness is blocked by 1 missing signal source.");
    expect(html).toContain("Extracted Advisory Context");
    expect(html).toContain("Missing Signals");
    expect(html).toContain("Non-executing, policy-gated recommendations");
    expect(html).toContain("Evidence Appendix");
    expect(html).toContain("CVE-2026-12345");
    expect(html).toContain("T1059.001");
    expect(html).toContain("Unmapped");
    expect(html).not.toContain("raw_payload_secret");
    expect(html).not.toContain("validation has executed");
  });

  it("renders advisory readiness PDFs", () => {
    const pdf = renderAdvisoryReadinessReportPdf(createAdvisoryDetailFixture());

    expect(pdf).toContain("%PDF-1.4");
    expect(pdf).toContain("Threat Advisory Readiness Report");
    expect(pdf).not.toContain("raw_payload_secret");
  });
});
