import {
  buildAttackPathRiskSummary,
  buildHonestyTrustMetrics,
  buildValidationSnapshotPathLanguage,
  countFixedSurvival,
  countMeasuredClaims,
  deriveAttackPathClaim,
  formatRiskBandDisplayLabel,
  projectPathValidationState,
  CTEMProgramSummarySchema,
  getReportTemplateCopy,
  ThreatAdvisoryDetailSchema,
  mapAttackTechniqueIds,
  SupportedLocaleSchema,
  ValidationSnapshotSchema,
  // getFixEffectivenessTrends re-exported via *
  type AttackPath,
  type CTEMProgramSummary,
  type DesignPartnerReportNote,
  type EvidencePack,
  type HonestyTrustMetrics,
  type SignalEnvelope,
  type TenantReportBranding,
  type SupportedLocale,
  type ThreatAdvisoryDetail,
  type ValidationSnapshot
} from "@periscan/shared";

function normalizeSnapshotClaimLanguage(
  payload: ValidationSnapshot
): ValidationSnapshot {
  const parsed = ValidationSnapshotSchema.parse(payload);
  const topAttackPaths = parsed.topAttackPaths.map((assessment) => ({
    ...assessment,
    risk: {
      ...assessment.risk,
      summary: buildAttackPathRiskSummary(
        assessment.attackPath,
        assessment.risk.band
      )
    }
  }));
  const pathLanguage = buildValidationSnapshotPathLanguage(topAttackPaths);

  return ValidationSnapshotSchema.parse({
    ...parsed,
    summary: {
      ...parsed.summary,
      ...pathLanguage
    },
    topAttackPaths
  });
}

function formatClaimHopCoverage(
  claim: ReturnType<typeof deriveAttackPathClaim>
): string {
  return claim.totalEdgeCount === 0
    ? "no path hops recorded"
    : `${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops measured`;
}

/**
 * Wave A / A6: customer-facing path state for HTML/PDF exports.
 * Risk severity and stale row validationState never upgrade Heuristic paths
 * to Validated/Reachable/Exploitable — only fully-measured hop receipts do.
 */
function resolveReportPathClaim(attackPath: Pick<
  AttackPath,
  "evidenceBasis" | "pathEdges" | "validationState"
>) {
  const projection = projectPathValidationState(attackPath);
  const claim = projection.claim;
  const claimBasisNote = claim.fullyMeasured
    ? "Claim basis: every recorded path hop is measured from authoritative configuration or an observed probe."
    : claim.totalEdgeCount === 0
      ? "Claim basis: no path hops are recorded; reachability remains a hypothesis. Severity alone never validates a path."
      : `Claim basis: ${claim.measuredEdgeCount}/${claim.totalEdgeCount} hops are measured; remaining reachability is a hypothesis. Severity alone never validates a path.`;

  return {
    claim,
    claimBasisNote,
    claimSafeState: projection.claimSafeValidationState,
    recordedState: projection.recordedValidationState,
    remapped: projection.remapped,
    remapReason: projection.remapReason
  };
}

function reportTemplateCopy(locale: SupportedLocale | undefined) {
  return getReportTemplateCopy(
    SupportedLocaleSchema.catch("en-US").parse(locale)
  );
}

function formatUsd(value: number, locale: SupportedLocale) {
  return new Intl.NumberFormat(locale, {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(Math.round(value));
}

import {
  COMPLIANCE_CATALOG,
  COMPLIANCE_PACK_DISCLAIMER,
  computeSnapshotComplianceTrace
} from "./compliance-catalog";

export interface AcceptedRiskAttestationEntry {
  approvalState: "Pending" | "Approved" | "Expired";
  approvedAt: string | null;
  approvedByLabel: string | null;
  evidenceId: string;
  expiresAt: string;
  findingId: string;
  note: string | null;
  ownerLabel: string;
  requestedByLabel: string;
  updatedAt: string;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderList(items: string[]) {
  if (items.length === 0) {
    return '<p class="muted">None for this report.</p>';
  }

  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function isComplianceAttestation(packType: EvidencePack["packType"]) {
  return packType.endsWith("Attestation");
}

function renderAcceptedRiskAttestation(
  decisions: readonly AcceptedRiskAttestationEntry[]
) {
  const body =
    decisions.length === 0
      ? '<p class="muted">No accepted-risk decisions were recorded when this evidence pack was generated.</p>'
      : `<div class="grid">${decisions
          .map(
            (decision) => `
              <article class="card">
                <div class="card-header">
                  <h3>Finding ${escapeHtml(decision.findingId)}</h3>
                  <span class="badge badge-${decision.approvalState === "Approved" ? "fixed" : decision.approvalState === "Expired" ? "critical" : "high"}">${escapeHtml(decision.approvalState)}</span>
                </div>
                <dl class="facts">
                  <div><dt>Risk owner</dt><dd>${escapeHtml(decision.ownerLabel)}</dd></div>
                  <div><dt>Requested by</dt><dd>${escapeHtml(decision.requestedByLabel)}</dd></div>
                  <div><dt>Approved by</dt><dd>${escapeHtml(decision.approvedByLabel ?? "Pending independent approval")}</dd></div>
                  <div><dt>Expires</dt><dd>${escapeHtml(decision.expiresAt)}</dd></div>
                  <div><dt>Last decision update</dt><dd>${escapeHtml(decision.updatedAt)}</dd></div>
                  <div><dt>Decision evidence ID</dt><dd>${escapeHtml(decision.evidenceId)}</dd></div>
                </dl>
                ${decision.note ? `<p>${escapeHtml(decision.note)}</p>` : ""}
              </article>`
          )
          .join("")}</div>`;

  return `
    <section>
      <h2 class="section-title">Accepted-Risk Governance</h2>
      <p class="muted">Point-in-time decision register. Approved entries required a tenant member distinct from the requester; expired entries are reopened for active triage.</p>
      ${body}
    </section>
  `;
}

function renderNoteParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p>${escapeHtml(paragraph).replaceAll("\n", "<br />")}</p>`
    )
    .join("");
}

function renderTechniqueTags(signal: SignalEnvelope) {
  const mappedTechniques = mapAttackTechniqueIds(signal.techniqueIds ?? []);

  if (mappedTechniques.length === 0) {
    return "";
  }

  return `
    <div class="technique-tags">
      ${mappedTechniques
        .map(
          (technique) => `
            <span class="technique-tag">
              ${escapeHtml(technique.tacticName)} · ${escapeHtml(technique.techniqueId)} ${escapeHtml(technique.techniqueName)}
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTechniqueIdTags(techniqueIds: string[]) {
  const mappedTechniques = mapAttackTechniqueIds(techniqueIds);
  const mappedIds = new Set(
    mappedTechniques.map((technique) => technique.techniqueId)
  );
  const unmappedTechniqueIds = techniqueIds.filter(
    (techniqueId) => !mappedIds.has(techniqueId)
  );

  if (mappedTechniques.length === 0 && unmappedTechniqueIds.length === 0) {
    return '<p class="muted">No ATT&amp;CK technique IDs extracted.</p>';
  }

  return `
    <div class="technique-tags">
      ${mappedTechniques
        .map(
          (technique) => `
            <span class="technique-tag">
              ${escapeHtml(technique.tacticName)} · ${escapeHtml(technique.techniqueId)} ${escapeHtml(technique.techniqueName)}
            </span>
          `
        )
        .join("")}
      ${unmappedTechniqueIds
        .map(
          (techniqueId) => `
            <span class="technique-tag">
              Unmapped · ${escapeHtml(techniqueId)}
            </span>
          `
        )
        .join("")}
    </div>
  `;
}

function renderEvidenceIds(evidenceIds: string[]) {
  if (evidenceIds.length === 0) {
    return "No evidence attached.";
  }

  return evidenceIds.map(escapeHtml).join(", ");
}

function countUniqueEvidenceIds(evidenceGroups: string[][]) {
  return new Set(evidenceGroups.flat()).size;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function getAttackPathTechniqueIds(
  snapshot: ValidationSnapshot,
  attackPath: ValidationSnapshot["topAttackPaths"][number]["attackPath"]
) {
  const pathEvidenceIds = new Set(attackPath.evidenceIds);
  const relatedSignals = [
    ...snapshot.controlObservations,
    ...snapshot.aiAppRisks
  ].filter(
    (signal) =>
      signal.relatedPathIds.includes(attackPath.pathId) ||
      signal.evidenceIds.some((evidenceId) => pathEvidenceIds.has(evidenceId))
  );

  return uniqueStrings(
    relatedSignals.flatMap((signal) => signal.techniqueIds ?? [])
  );
}

type ReportTemplateConfig = {
  audienceGuidance: string;
  includeAiRisks: boolean;
  includeComplianceSupport: boolean;
  includeControlObservations: boolean;
  includeCTEMProgram: boolean;
  includeEvidenceAppendix: boolean;
  includeMSSPDelivery: boolean;
  includeRemediationClosure: boolean;
  label: string;
  primaryUse: string;
  redactionPosture: string;
  // For continuous (non-snapshot) validation packs: documents the closure
  // verdict vocabulary a reader should expect (Fixed / Still Exposed on re-test).
  // Undefined for one-shot snapshot report types.
  continuousVerdictBasis?: string;
};

function getReportTemplateConfig(
  packType: EvidencePack["packType"]
): ReportTemplateConfig {
  switch (packType) {
    case "ExecutiveRiskSummary":
      return {
        audienceGuidance:
          "Board and executive summary focused on business impact, risk reduction, and next decisions. Measured multi-hop paths only support reachability/exploitability claims; heuristic paths remain hypotheses. Fixed counts exclude ticket closes without measured re-test (ClosedWithoutEvidence). This pack is not a certification or audit attestation.",
        includeAiRisks: true,
        includeComplianceSupport: false,
        includeControlObservations: false,
        includeCTEMProgram: false,
        includeEvidenceAppendix: false,
        includeMSSPDelivery: false,
        // P04-20: board packs must count ClosedWithoutEvidence separately from Fixed.
        includeRemediationClosure: true,
        label: "Periscan Executive Risk Summary",
        primaryUse: "Executive risk review (not certification)",
        redactionPosture:
          "High-level evidence IDs only; technical appendix omitted."
      };
    case "CustomerSecurityReview":
      return {
        audienceGuidance:
          "Customer-facing security review focused on validated proof, safe methodology, and remediation status.",
        includeAiRisks: true,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: false,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan Customer Security Review Pack",
        primaryUse: "Customer security review",
        redactionPosture:
          "Customer-safe summary with evidence IDs; raw details omitted."
      };
    case "CyberInsuranceEvidence":
      return {
        audienceGuidance:
          "Insurance evidence package focused on validated exposure, controls, remediation, and verification posture.",
        includeAiRisks: true,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan Cyber Insurance Evidence Pack",
        primaryUse: "Cyber insurance underwriting or renewal",
        redactionPosture:
          "Evidence IDs and normalized detail included; raw tool output excluded from the primary report."
      };
    case "SOC2Support":
      return {
        audienceGuidance: `Customer SOC 2 support evidence pack — links measured Periscan validation evidence to representative Trust Services Criteria for your auditor follow-up. ${COMPLIANCE_PACK_DISCLAIMER}`,
        includeAiRisks: true,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Customer SOC 2 support evidence (not vendor attestation)",
        primaryUse:
          "Customer SOC 2 audit follow-up support (not certification / not audit opinion)",
        redactionPosture:
          "Audit-support evidence IDs and normalized details included."
      };
    case "ISOSupport":
      return {
        audienceGuidance: `ISO support package focused on validation evidence, risk treatment, and repeatable safety methodology. ${COMPLIANCE_PACK_DISCLAIMER}`,
        includeAiRisks: true,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan ISO Support Pack",
        primaryUse:
          "ISO security management evidence support (not certification / not audit opinion)",
        redactionPosture:
          "Audit-support evidence IDs and normalized details included."
      };
    case "PCISupport":
      return {
        audienceGuidance: `PCI support package focused on scoped validation evidence, exposure reduction, and proof of remediation. ${COMPLIANCE_PACK_DISCLAIMER}`,
        includeAiRisks: false,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan PCI Support Pack",
        primaryUse:
          "PCI validation evidence support (not certification / not audit opinion)",
        redactionPosture: "Scoped evidence IDs and normalized details included."
      };
    case "ControlValidationReport":
      return {
        audienceGuidance:
          "Control validation report focused on detection, blocking, logging, alerting, and routing evidence.",
        includeAiRisks: false,
        includeComplianceSupport: false,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan Control Validation Report",
        primaryUse: "Security control tuning and evidence review",
        redactionPosture:
          "Control evidence IDs and normalized observations included.",
        continuousVerdictBasis:
          "Each control interaction is graded Detected, Blocked, Missed or Logged. On re-test a remediated control gap reads Fixed once the exposure is gone, or remains Still Exposed while it persists."
      };
    case "AIAppValidationReport":
      return {
        audienceGuidance:
          "AI security validation report focused on safe tests, guardrail posture, retrieval authorization, and tool-use risk.",
        includeAiRisks: true,
        includeComplianceSupport: false,
        includeControlObservations: false,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan AI Security Validation Report",
        primaryUse: "AI application security review",
        redactionPosture:
          "AI validation evidence IDs included; sensitive prompt and output values redacted.",
        continuousVerdictBasis:
          "Each AI safety test (prompt injection, data leakage, guardrail, tool abuse) is graded pass or risk-observed. On re-test a remediated risk reads Fixed once the exposure is gone, or remains Still Exposed while it persists."
      };
    case "FixVerificationReport":
      return {
        audienceGuidance:
          "Fix verification report showing pre/post evidence, re-test results, and closure proof for remediated issues. Includes fix effectiveness trending + simulator deltas (D-track).",
        includeAiRisks: false,
        includeComplianceSupport: false,
        includeControlObservations: false,
        includeCTEMProgram: true,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: true,
        label: "Periscan Fix Verification Report",
        primaryUse: "Prove fixes worked with before/after evidence + trending",
        redactionPosture:
          "Evidence IDs and verification outcomes; raw tool output in appendix only.",
        continuousVerdictBasis:
          "Closure is proven from pre/post evidence: a re-tested remediation reads Fixed when the exposure is gone, or Still Exposed when it persists on re-test."
      };
    case "CTEMProgramSummary":
      return {
        audienceGuidance:
          "CTEM program view organized around scope, discover, prioritize, validate, mobilize, and verify stages.",
        includeAiRisks: true,
        includeComplianceSupport: false,
        includeControlObservations: true,
        includeCTEMProgram: true,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan CTEM Program Summary",
        primaryUse: "Continuous Threat Exposure Management program review",
        redactionPosture:
          "Program-level evidence IDs and normalized details included."
      };
    case "MSSPClientQBR":
      return {
        audienceGuidance:
          "MSSP client QBR focused on client outcomes, validation coverage, remediation progress, and proof delivered.",
        includeAiRisks: true,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: true,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: true,
        includeRemediationClosure: false,
        label: "Periscan MSSP Client QBR",
        primaryUse: "Managed service client review",
        redactionPosture:
          "Client-safe evidence IDs and normalized detail included."
      };
    case "TechnicalAppendix":
      return {
        audienceGuidance:
          "Technical appendix for security engineers who need normalized details, evidence IDs, and methodology notes.",
        includeAiRisks: true,
        includeComplianceSupport: false,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan Technical Appendix",
        primaryUse: "Security engineering evidence review",
        redactionPosture:
          "Most detailed normalized evidence view; raw tool output remains outside the primary report."
      };
    case "RemediationClosurePack":
      return {
        audienceGuidance:
          "Remediation closure pack focused on verification status and proof that risk was fixed, mitigated, or still exposed.",
        includeAiRisks: true,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: true,
        label: "Periscan Remediation Closure Pack",
        primaryUse: "Remediation closure and proof of fix",
        redactionPosture:
          "Verification evidence IDs and normalized details included."
      };
    case "ValidationSnapshotReport":
      return {
        audienceGuidance:
          "Validation Snapshot report focused on priority attack paths, their evidence certainty, remediation, and the verification plan.",
        includeAiRisks: true,
        includeComplianceSupport: false,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan Validation Snapshot Report",
        primaryUse: "Initial validation proof loop",
        redactionPosture: "Evidence IDs and normalized details included."
      };
    case "ThreatAdvisoryReadinessReport":
      return {
        audienceGuidance:
          "Threat advisory readiness report focused on extracted advisory context, missing proof inputs, policy-gated validation planning, and evidence IDs.",
        includeAiRisks: true,
        includeComplianceSupport: false,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan Threat Advisory Readiness Report",
        primaryUse: "Threat advisory response readiness",
        redactionPosture:
          "Normalized advisory context and evidence IDs only; raw advisory content excluded."
      };
    // 3.13 Emerging & Edge packTypes: safe non-disruptive for marketplace packs (SSPM, Identity, SSCS, OT/ICS)
    case "SSPMValidationReport":
    case "IdentityValidationReport":
      return {
        audienceGuidance:
          "Identity-centric or SSPM SaaS posture validation report (safe configuration and abuse simulation evidence).",
        includeAiRisks: false,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: true,
        label:
          packType === "SSPMValidationReport"
            ? "Periscan SSPM / SaaS Validation Report"
            : "Periscan Identity-Centric Validation Report",
        primaryUse: "SaaS / Identity posture and control validation",
        redactionPosture:
          "Moderate; evidence IDs and verdicts; safe-mode outputs only."
      };
    case "SSCSValidationReport":
      return {
        audienceGuidance:
          "Software Supply Chain Security validation (SBOM, signed artifacts, dep vulns via OSS modules).",
        includeAiRisks: false,
        includeComplianceSupport: true,
        includeControlObservations: false,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: true,
        label: "Periscan SSCS Validation Report",
        primaryUse: "Supply chain / CI/CD security evidence",
        redactionPosture: "Moderate; evidence IDs and normalized findings."
      };
    case "OTICSAttackPackReport":
      return {
        audienceGuidance:
          "OT/ICS safe pack report (scaffold): passive port classification and fixture-only baseline when present. Not a live OT attack pack; runner OT profile not implemented; partner-lab qualification required for Validated OT claims. Never speaks OT protocols.",
        includeAiRisks: false,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: true,
        label: "Periscan OT/ICS Safe Pack Report (scaffold)",
        primaryUse: "OT/ICS passive/scaffold evidence (non-disruptive; not live attack)",
        redactionPosture:
          "High-safety redaction; evidence IDs and safe profile results only. No live disruptive actions."
      };
    // PRD 3.11: Customer compliance evidence-support packs (not vendor certification).
    // Pack types retain *Attestation enum keys for storage compatibility; customer-facing
    // labels and copy present them as measured evidence support only.
    case "DORAAttestation":
    case "NIS2Attestation":
    case "SECAttestation":
    case "GDPRAttestation":
    case "PCIDSSAttestation":
    case "ISO27001Attestation":
    case "EUAiActAttestation":
    case "ISO42001Attestation":
    case "HIPAAAttestation":
    case "SOC2Attestation":
    case "NISTCSFAttestation":
      return {
        audienceGuidance: `Customer evidence-support pack tracing measured control effectiveness, risk treatment, and verification evidence to a representative subset of the named framework. ${COMPLIANCE_PACK_DISCLAIMER}`,
        includeAiRisks: true,
        includeComplianceSupport: true,
        includeControlObservations: true,
        includeCTEMProgram: true,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: true,
        label: `Periscan ${COMPLIANCE_CATALOG[packType]?.displayName ?? packType}`,
        primaryUse:
          "Customer audit evidence support (not certification / not audit opinion)",
        redactionPosture:
          "Compliance-focused: evidence IDs, control/AI verdicts, EXV business impact scores, before/after verification events. Raw scanner output in appendix only."
      };
    case "TenantIsolationDataProtectionReport":
      return {
        audienceGuidance:
          "Security review and audit proof for tenant data isolation, data-region configuration, evidence integrity, and governed report sharing.",
        includeAiRisks: false,
        includeComplianceSupport: true,
        includeControlObservations: false,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: true,
        includeRemediationClosure: false,
        label: "Periscan Tenant Isolation & Data Protection Proof",
        primaryUse: "Tenant isolation and data-protection assurance",
        redactionPosture:
          "Moderate; contains control results and identifiers, never credentials or raw customer content."
      };
    default:
      return {
        audienceGuidance: "Evidence-backed report for the requested use case.",
        includeAiRisks: false,
        includeComplianceSupport: false,
        includeControlObservations: false,
        includeCTEMProgram: false,
        includeEvidenceAppendix: true,
        includeMSSPDelivery: false,
        includeRemediationClosure: false,
        label: "Periscan Report",
        primaryUse: "Evidence review",
        redactionPosture: "Evidence IDs included."
      };
  }
}

// Which integrated tools reported telemetry for each ATT&CK technique in this
// snapshot — surfaces the connector→technique correlation (techniqueIds +
// sourceVendor) that drives control-rule coverage, computed from the control
// observation signals already attached to the snapshot.
function summarizeTelemetryByTechnique(
  signals: ValidationSnapshot["controlObservations"]
) {
  const byTechnique = new Map<string, Set<string>>();
  for (const signal of signals) {
    for (const techniqueId of signal.techniqueIds ?? []) {
      const vendors = byTechnique.get(techniqueId) ?? new Set<string>();
      vendors.add(signal.sourceVendor);
      byTechnique.set(techniqueId, vendors);
    }
  }
  return [...byTechnique.entries()]
    .map(([techniqueId, vendors]) => ({
      techniqueId,
      vendors: [...vendors].sort()
    }))
    .sort((left, right) => left.techniqueId.localeCompare(right.techniqueId));
}

function renderDetectionTelemetry(snapshot: ValidationSnapshot) {
  const rows = summarizeTelemetryByTechnique(snapshot.controlObservations);
  if (rows.length === 0) {
    return "";
  }
  return `
    <article class="card">
      <h3>Detection telemetry by technique</h3>
      <p class="muted">Which integrated tools reported telemetry for each ATT&amp;CK technique in this snapshot.</p>
      <dl class="facts">
        ${rows
          .map(
            (row) =>
              `<div><dt>${escapeHtml(row.techniqueId)}</dt><dd>${escapeHtml(
                row.vendors.join(", ")
              )}</dd></div>`
          )
          .join("")}
      </dl>
    </article>
  `;
}

function countPathClaimBases(snapshot: ValidationSnapshot): {
  fullyMeasured: number;
  heuristic: number;
  measuredDeclared: number;
  total: number;
} {
  let fullyMeasured = 0;
  let heuristic = 0;
  let measuredDeclared = 0;
  for (const { attackPath } of snapshot.topAttackPaths) {
    const claim = deriveAttackPathClaim(attackPath);
    if (claim.fullyMeasured) {
      fullyMeasured += 1;
    }
    if (attackPath.evidenceBasis === "Measured") {
      measuredDeclared += 1;
    } else {
      heuristic += 1;
    }
  }
  return {
    fullyMeasured,
    heuristic,
    measuredDeclared,
    total: snapshot.topAttackPaths.length
  };
}

function buildSnapshotHonestyTrustMetrics(
  snapshot: ValidationSnapshot
): HonestyTrustMetrics {
  const claims = countMeasuredClaims(
    snapshot.topAttackPaths.map(({ attackPath }) => attackPath.evidenceBasis)
  );
  const fixedOrMitigated = snapshot.remediationPriorities.filter(
    (rem) => rem.status === "Fixed" || rem.status === "Mitigated"
  );
  const reopened = snapshot.remediationPriorities.filter(
    (rem) => rem.status === "Reopened"
  );
  // Snapshot remediations that are Fixed/Mitigated are verification-backed in product;
  // reopened rows reduce survival (P12-17).
  const survival = countFixedSurvival({
    fixedWithMeasuredVerification: fixedOrMitigated.length,
    fixedOrMitigatedTotal: fixedOrMitigated.length + reopened.length,
    reopenedAfterFixed: reopened.length
  });
  return buildHonestyTrustMetrics({
    measuredClaimCount: claims.measuredClaimCount,
    totalClaimCount: claims.totalClaimCount,
    fixedSurvivedCount: survival.fixedSurvivedCount,
    fixedAttemptedCount: survival.fixedAttemptedCount,
    // Snapshot packs do not embed policy/runner counters; honest zeros until
    // executive-trends honestyTrust is merged into pack generation.
    deniedNeverQueuedCount: 0,
    signatureVerifiedCount: 0,
    signatureCheckedCount: 0
  });
}

/** P04-11 + P12-17: board / executive packs surface path honesty + trust metrics. */
function renderPathClaimHonestyBanner(snapshot: ValidationSnapshot): string {
  const bases = countPathClaimBases(snapshot);
  const trust = buildSnapshotHonestyTrustMetrics(snapshot);
  if (bases.total === 0) {
    return `
    <section>
      <h2 class="section-title">Path claim honesty</h2>
      <article class="note">
        <p><strong>Do not treat this pack as certification.</strong> No priority attack paths are attached to this snapshot.</p>
      </article>
    </section>
    <section>
      <h2 class="section-title">Honesty trust metrics</h2>
      <article class="note">
        <p>Trust metrics require measured path claims and verification events. Empty snapshot → zero rates (not 100%).</p>
        <dl class="facts">
          <div><dt>% claims Measured</dt><dd>${trust.claimsMeasuredPct}%</dd></div>
          <div><dt>% Fixed survived revalidation</dt><dd>${trust.fixedSurvivedRevalidationPct}%</dd></div>
          <div><dt>Denied never queued</dt><dd>${trust.deniedNeverQueuedCount} (see executive trends for live count)</dd></div>
          <div><dt>Signature verification rate</dt><dd>${trust.signatureVerificationRatePct == null ? "n/a" : `${trust.signatureVerificationRatePct}%`}</dd></div>
        </dl>
      </article>
    </section>`;
  }

  const hypothesisMode = bases.fullyMeasured === 0;
  return `
    <section>
      <h2 class="section-title">Path claim honesty</h2>
      <article class="note">
        <p><strong>Do not treat this pack as certification or complete BAS proof.</strong>
        Board and executive decisions should weight measured hops only.</p>
        <dl class="facts">
          <div><dt>Priority paths</dt><dd>${bases.total}</dd></div>
          <div><dt>Fully measured multi-hop</dt><dd>${bases.fullyMeasured} of ${bases.total}</dd></div>
          <div><dt>Declared Measured basis</dt><dd>${bases.measuredDeclared}</dd></div>
          <div><dt>Declared Heuristic basis</dt><dd>${bases.heuristic}</dd></div>
        </dl>
        ${
          hypothesisMode
            ? `<p class="caveat"><strong>Hypothesis mode:</strong> zero fully measured multi-hop paths. Reachability and exploitability remain hypotheses until hop receipts with tenant-owned evidence IDs land.</p>`
            : ""
        }
      </article>
    </section>
    <section>
      <h2 class="section-title">Honesty trust metrics</h2>
      <article class="note">
        <p>Leaders differentiator instrumentation (P12-17). Composition: ${escapeHtml(trust.compositionNote)}</p>
        <dl class="facts">
          <div><dt>% claims Measured</dt><dd>${trust.claimsMeasuredPct}% (${trust.claimsMeasuredCount}/${trust.claimsTotalCount})</dd></div>
          <div><dt>% Fixed survived revalidation</dt><dd>${trust.fixedSurvivedRevalidationPct}% (${trust.fixedSurvivedCount}/${trust.fixedAttemptedCount})</dd></div>
          <div><dt>Denied never queued</dt><dd>${trust.deniedNeverQueuedCount} (live count on executive trends)</dd></div>
          <div><dt>Signature verification rate</dt><dd>${trust.signatureVerificationRatePct == null ? "n/a in snapshot pack" : `${trust.signatureVerificationRatePct}%`}</dd></div>
        </dl>
      </article>
    </section>`;
}

function renderSnapshotCoverage(snapshot: ValidationSnapshot) {
  const pathEvidenceCount = countUniqueEvidenceIds(
    snapshot.topAttackPaths.map(({ attackPath }) => attackPath.evidenceIds)
  );
  const remediationEvidenceCount = countUniqueEvidenceIds(
    snapshot.remediationPriorities.map((remediation) => remediation.evidenceIds)
  );
  const bases = countPathClaimBases(snapshot);

  return `
    <section>
      <h2 class="section-title">Snapshot Coverage</h2>
      <div class="grid">
        <article class="card">
          <h3>Evidence attached to this snapshot</h3>
          <dl class="facts">
            <div><dt>Snapshot artifacts</dt><dd>${snapshot.evidenceIds.length}</dd></div>
            <div><dt>Path evidence links</dt><dd>${pathEvidenceCount}</dd></div>
            <div><dt>Remediation evidence links</dt><dd>${remediationEvidenceCount}</dd></div>
            <div><dt>Fully measured multi-hop</dt><dd>${bases.fullyMeasured} of ${bases.total}</dd></div>
            <div><dt>Heuristic path hypotheses</dt><dd>${bases.heuristic}</dd></div>
          </dl>
        </article>
        <article class="card">
          <h3>Feature areas proven by this run</h3>
          <dl class="facts">
            <div><dt>Control signals attached</dt><dd>${snapshot.controlObservations.length}</dd></div>
            <div><dt>AI validation signals attached</dt><dd>${snapshot.aiAppRisks.length}</dd></div>
            <div><dt>Verification steps</dt><dd>${snapshot.verificationPlan.length}</dd></div>
            <div><dt>Fixes overdue for re-verification</dt><dd>${snapshot.metrics.staleVerificationCount}</dd></div>
            <div><dt>Open threat advisories</dt><dd>${snapshot.metrics.openThreatAdvisoryCount}</dd></div>
            <div><dt>Advisories you're exposed to</dt><dd>${snapshot.metrics.correlatedThreatAdvisoryCount}</dd></div>
          </dl>
          <p class="muted coverage-note">
            Control and AI sections render only when this snapshot includes normalized signals for those feature areas.
          </p>
          ${snapshot.controlObservations.length === 0 ? '<p class="muted">No control validation signals were attached to this snapshot.</p>' : ""}
          ${snapshot.aiAppRisks.length === 0 ? '<p class="muted">No AI validation signals were attached to this snapshot.</p>' : ""}
        </article>
        ${renderDetectionTelemetry(snapshot)}
      </div>
    </section>
  `;
}

// Includes Fixed wire token for verified-closed residual band (P09-3); display
// labels use formatRiskBandDisplayLabel ("Closed (risk)") so charts never read
// as remediation status Fixed.
const RISK_BAND_ORDER = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
  "Fixed"
] as const;

const RISK_BAND_FILL: Record<string, string> = {
  Critical: "#dc2626",
  High: "#f59e0b",
  Informational: "#94a3b8",
  Low: "#22c55e",
  Medium: "#3b82f6",
  Fixed: "#16a34a"
};

// Server-side inline-SVG distribution chart of priority paths by risk band.
// Plain hand-written SVG strings — no browser charting libraries run in the
// report builder. Driven only by the real snapshot data; renders nothing when
// there are no priority paths.
function renderRiskBandChart(snapshot: ValidationSnapshot) {
  const counts: Record<string, number> = {};
  for (const { risk } of snapshot.topAttackPaths) {
    counts[risk.band] = (counts[risk.band] ?? 0) + 1;
  }

  const rows = RISK_BAND_ORDER.filter((band) => (counts[band] ?? 0) > 0).map(
    (band) => ({
      band,
      count: counts[band]!,
      label: formatRiskBandDisplayLabel(band)
    })
  );

  if (rows.length === 0) {
    return "";
  }

  const max = Math.max(...rows.map((row) => row.count));
  const rowHeight = 26;
  const rowGap = 8;
  const chartWidth = 360;
  const labelWidth = 96;
  const barMax = chartWidth - labelWidth - 44;
  const height = rows.length * (rowHeight + rowGap);

  const bars = rows
    .map((row, index) => {
      const y = index * (rowHeight + rowGap);
      const width = Math.max(2, Math.round((row.count / max) * barMax));
      const fill = RISK_BAND_FILL[row.band] ?? "#94a3b8";
      const textY = y + rowHeight / 2 + 4;

      return `
        <text x="0" y="${textY}" font-size="12" fill="currentColor">${escapeHtml(
          row.label
        )}</text>
        <rect x="${labelWidth}" y="${y}" width="${width}" height="${rowHeight}" rx="4" fill="${fill}"><title>${escapeHtml(
          row.label
        )}: ${row.count}</title></rect>
        <text x="${labelWidth + width + 8}" y="${textY}" font-size="12" fill="currentColor">${row.count}</text>
      `;
    })
    .join("");

  return `
    <figure class="risk-band-chart">
      <figcaption>Priority paths by risk band</figcaption>
      <svg role="img" aria-label="Priority paths by risk band" viewBox="0 0 ${chartWidth} ${height}" width="100%" height="${height}" preserveAspectRatio="xMinYMin meet">
        ${bars}
      </svg>
    </figure>
  `;
}

function renderAnalystNote(note: DesignPartnerReportNote | null | undefined) {
  if (!note) {
    return "";
  }

  return `
    <section>
      <h2 class="section-title">Periscan Analyst Notes</h2>
      <article class="note">
        <div class="card-header">
          <h3>${escapeHtml(note.title ?? "Periscan analyst note")}</h3>
          <span class="badge badge-informational">${escapeHtml(note.authorLabel)}</span>
        </div>
        ${renderNoteParagraphs(note.body)}
      </article>
    </section>
  `;
}

function renderAudienceGuidance(config: ReportTemplateConfig) {
  return `
    <section>
      <h2 class="section-title">Audience Guidance</h2>
      <article class="card">
        <p>${escapeHtml(config.audienceGuidance)}</p>
        <dl class="facts">
          <div><dt>Primary use</dt><dd>${escapeHtml(config.primaryUse)}</dd></div>
          <div><dt>Redaction posture</dt><dd>${escapeHtml(config.redactionPosture)}</dd></div>
        </dl>
      </article>
    </section>
  `;
}

function renderComplianceSupport(
  snapshot: ValidationSnapshot,
  packType: EvidencePack["packType"]
) {
  const trace = computeSnapshotComplianceTrace(snapshot, packType);

  if (trace) {
    const rows = trace.controls
      .map(
        (control) => `
          <tr>
            <td><strong>${escapeHtml(control.controlId)}</strong><br /><span class="muted">${escapeHtml(control.title)}</span></td>
            <td><span class="badge badge-${control.status === "Met" ? "fixed" : control.status === "Partial" ? "high" : "critical"}">${escapeHtml(control.status)}</span></td>
            <td>${control.satisfiedBy.length > 0 ? control.satisfiedBy.map(escapeHtml).join("<br />") : '<span class="muted">No measured support</span>'}</td>
            <td>${renderEvidenceIds(control.evidenceIds)}</td>
            <td>${control.lastValidatedAt ? escapeHtml(control.lastValidatedAt) : '<span class="muted">Not validated</span>'}</td>
          </tr>
        `
      )
      .join("");

    return `
      <section>
        <h2 class="section-title">Compliance Control Trace</h2>
        <article class="card">
          <div class="card-header">
            <div>
              <h3>${escapeHtml(trace.displayName)}</h3>
              <p class="muted">${escapeHtml(COMPLIANCE_PACK_DISCLAIMER)}</p>
            </div>
            <span class="badge badge-informational">${Math.round(trace.coverageRatio * 100)}% met</span>
          </div>
          <dl class="facts">
            <div><dt>Met</dt><dd>${trace.metCount}</dd></div>
            <div><dt>Partial</dt><dd>${trace.partialCount}</dd></div>
            <div><dt>Unmet</dt><dd>${trace.unmetCount}</dd></div>
            <div><dt>Snapshot</dt><dd>${escapeHtml(snapshot.snapshotId)}</dd></div>
          </dl>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Control</th><th>Status</th><th>Measured support</th><th>Evidence IDs</th><th>Last validated</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </article>
      </section>
    `;
  }

  return `
    <section>
      <h2 class="section-title">Compliance Support</h2>
      <article class="card">
        <p>
          This pack is customer evidence support for review workflows: it links scope,
          validation outcomes, remediation, and verification planning to evidence IDs.
          ${escapeHtml(COMPLIANCE_PACK_DISCLAIMER)}
        </p>
        <dl class="facts">
          <div><dt>Verified scopes</dt><dd>${snapshot.metrics.verifiedScopeCount}</dd></div>
          <div><dt>Evidence IDs</dt><dd>${renderEvidenceIds(snapshot.evidenceIds)}</dd></div>
          <div><dt>Verification steps</dt><dd>${snapshot.verificationPlan.length}</dd></div>
        </dl>
      </article>
    </section>
  `;
}

function renderMSSPDelivery(snapshot: ValidationSnapshot) {
  return `
    <section>
      <h2 class="section-title">MSSP Client Delivery Notes</h2>
      <article class="card">
        <p>
          Client review should focus on priority attack paths, evidence certainty,
          control response, remediation progress, and evidence delivered this period.
        </p>
        <dl class="facts">
          <div><dt>Client-ready top paths</dt><dd>${snapshot.metrics.topPathCount}</dd></div>
          <div><dt>Remediation priorities</dt><dd>${snapshot.metrics.remediationCount}</dd></div>
          <div><dt>Fixes overdue for re-verification</dt><dd>${snapshot.metrics.staleVerificationCount}</dd></div>
          <div><dt>Evidence pack</dt><dd>${escapeHtml(snapshot.evidencePack.evidencePackId)}</dd></div>
        </dl>
      </article>
    </section>
  `;
}

function renderRemediationClosure(snapshot: ValidationSnapshot) {
  const closedRemediations = snapshot.remediationPriorities.filter(
    (remediation) => ["Fixed", "Mitigated"].includes(remediation.status)
  );
  const closedCount = closedRemediations.length;
  // P04-20: ticket-close honesty — never fold into Fixed/Mitigated.
  const closedWithoutEvidenceCount = snapshot.remediationPriorities.filter(
    (remediation) => remediation.status === "ClosedWithoutEvidence"
  ).length;
  const stillOpenCount =
    snapshot.remediationPriorities.length -
    closedCount -
    closedWithoutEvidenceCount;
  // A closure pack is a proof-of-fix artifact: disclose how many closures rest
  // on a real MEASURED re-validation (a retest actually ran) vs heuristic or
  // not-yet-measured verification. measured !== heuristic — never conflate.
  const measuredClosedCount = closedRemediations.filter(
    (remediation) =>
      remediation.latestVerification?.measuredRevalidation === true
  ).length;
  const unmeasuredClosedCount = closedCount - measuredClosedCount;

  const basisList =
    closedCount > 0
      ? `<ul class="closure-basis">${closedRemediations
          .map((remediation) => {
            const measured =
              remediation.latestVerification?.measuredRevalidation === true;
            const outcome = remediation.latestVerification?.outcome;
            return `<li>${escapeHtml(remediation.recommendedAction)} — ${escapeHtml(
              remediation.status
            )} · ${measured ? "measured re-validation" : "not measured"}${
              outcome ? ` · ${escapeHtml(outcome)}` : ""
            }</li>`;
          })
          .join("")}</ul>`
      : "";

  const caveatParts: string[] = [];
  if (unmeasuredClosedCount > 0) {
    caveatParts.push(
      `${unmeasuredClosedCount} of ${closedCount} Fixed/Mitigated closure(s) rest on heuristic or not-yet-measured verification — confirm with a measured re-test before relying on them.`
    );
  }
  if (closedWithoutEvidenceCount > 0) {
    caveatParts.push(
      `${closedWithoutEvidenceCount} remediation(s) are Closed without evidence (ticket/admin close only). These are not Fixed and must not be reported as verified remediation.`
    );
  }
  const caveat =
    caveatParts.length > 0
      ? `<p class="caveat">${caveatParts.map(escapeHtml).join(" ")}</p>`
      : "";

  return `
    <section>
      <h2 class="section-title">Remediation Closure Evidence</h2>
      <article class="card">
        <p>
          Periscan only treats remediation as <strong>Fixed</strong> when verification evidence supports
          the outcome. Ticket closes without re-test remain <strong>Closed without evidence</strong> and are counted separately from Fixed.
        </p>
        <dl class="facts">
          <div><dt>Fixed or mitigated (verified)</dt><dd>${closedCount}</dd></div>
          <div><dt>Measured re-validations</dt><dd>${measuredClosedCount} of ${closedCount}</dd></div>
          <div><dt>Closed without evidence</dt><dd>${closedWithoutEvidenceCount}</dd></div>
          <div><dt>Still requiring proof</dt><dd>${stillOpenCount}</dd></div>
          <div><dt>Verification steps</dt><dd>${snapshot.verificationPlan.length}</dd></div>
        </dl>
        ${caveat}
        ${basisList}
      </article>
    </section>
  `;
}

type CTEMProgramOptions = {
  source?: CTEMProgramSummary["source"];
  snapshotId?: string | null;
  // Non-snap scheduled contribution for CTEM depth (Validate from Control/AI packs, Verify from Fix packs)
  nonSnapValidateEvidence?: number;
  nonSnapVerifyEvidence?: number;
};

function buildCTEMProgramFromSnapshot(
  snapshot: ValidationSnapshot,
  options?: CTEMProgramOptions
): CTEMProgramSummary {
  const stageStatus = (
    evidenceCount: number,
    openItemCount: number
  ): CTEMProgramSummary["stages"][number]["status"] => {
    if (evidenceCount === 0) {
      return "NotStarted";
    }

    return openItemCount > 0 ? "NeedsAttention" : "OnTrack";
  };

  const stageTrend = (
    evidenceCount: number,
    openItemCount: number
  ): CTEMProgramSummary["stages"][number]["trend"] => {
    if (openItemCount > 0) {
      return "Worsening";
    }

    return evidenceCount > 0 ? "Improving" : "Stable";
  };

  return CTEMProgramSummarySchema.parse({
    generatedAt: snapshot.updatedAt,
    snapshotId:
      options && "snapshotId" in options
        ? options.snapshotId
        : snapshot.snapshotId,
    source: options?.source ?? "Snapshot",
    stages: [
      {
        evidenceCount: snapshot.metrics.verifiedScopeCount,
        openItemCount: 0,
        stage: "Scope",
        status: stageStatus(snapshot.metrics.verifiedScopeCount, 0),
        trend: stageTrend(snapshot.metrics.verifiedScopeCount, 0)
      },
      {
        evidenceCount: snapshot.metrics.integrationCount,
        openItemCount: 0,
        stage: "Discover",
        status: stageStatus(snapshot.metrics.integrationCount, 0),
        trend: stageTrend(snapshot.metrics.integrationCount, 0)
      },
      {
        evidenceCount: snapshot.metrics.topPathCount,
        openItemCount: snapshot.metrics.highRiskPathCount,
        stage: "Prioritize",
        status: stageStatus(
          snapshot.metrics.topPathCount,
          snapshot.metrics.highRiskPathCount
        ),
        trend: stageTrend(
          snapshot.metrics.topPathCount,
          snapshot.metrics.highRiskPathCount
        )
      },
      {
        evidenceCount:
          snapshot.metrics.controlObservationCount +
          snapshot.metrics.aiRiskCount +
          (options?.nonSnapValidateEvidence || 0),
        openItemCount: snapshot.metrics.highRiskPathCount,
        stage: "Validate",
        status: stageStatus(
          snapshot.metrics.controlObservationCount +
            snapshot.metrics.aiRiskCount +
            (options?.nonSnapValidateEvidence || 0),
          snapshot.metrics.highRiskPathCount
        ),
        trend: stageTrend(
          snapshot.metrics.controlObservationCount +
            snapshot.metrics.aiRiskCount +
            (options?.nonSnapValidateEvidence || 0),
          snapshot.metrics.highRiskPathCount
        )
      },
      {
        evidenceCount: snapshot.metrics.remediationCount,
        openItemCount: snapshot.remediationPriorities.filter(
          (remediation) =>
            remediation.status !== "Fixed" && remediation.status !== "Mitigated"
        ).length,
        stage: "Mobilize",
        status: stageStatus(
          snapshot.metrics.remediationCount,
          snapshot.remediationPriorities.filter(
            (remediation) =>
              remediation.status !== "Fixed" &&
              remediation.status !== "Mitigated"
          ).length
        ),
        trend: stageTrend(
          snapshot.metrics.remediationCount,
          snapshot.remediationPriorities.filter(
            (remediation) =>
              remediation.status !== "Fixed" &&
              remediation.status !== "Mitigated"
          ).length
        )
      },
      {
        evidenceCount:
          snapshot.verificationPlan.length +
          (options?.nonSnapVerifyEvidence || 0),
        openItemCount: snapshot.remediationPriorities.filter(
          (remediation) => remediation.verificationRequired
        ).length,
        stage: "Verify",
        status: stageStatus(
          snapshot.verificationPlan.length +
            (options?.nonSnapVerifyEvidence || 0),
          snapshot.remediationPriorities.filter(
            (remediation) => remediation.verificationRequired
          ).length
        ),
        trend: stageTrend(
          snapshot.verificationPlan.length +
            (options?.nonSnapVerifyEvidence || 0),
          snapshot.remediationPriorities.filter(
            (remediation) => remediation.verificationRequired
          ).length
        )
      }
    ],
    tenantId: snapshot.tenantId,
    topRiskBand: snapshot.summary.topRiskBand
  });
}

function shouldShowControlObservations(packType: EvidencePack["packType"]) {
  return getReportTemplateConfig(packType).includeControlObservations;
}

function shouldShowAiRisks(
  packType: EvidencePack["packType"],
  snapshot: ValidationSnapshot
) {
  return (
    getReportTemplateConfig(packType).includeAiRisks &&
    (packType !== "ExecutiveRiskSummary" || snapshot.aiAppRisks.length > 0)
  );
}

function shouldShowEvidenceAppendix(packType: EvidencePack["packType"]) {
  return getReportTemplateConfig(packType).includeEvidenceAppendix;
}

function sanitizePdfText(value: string) {
  return value
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapePdfString(value: string) {
  return sanitizePdfText(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapPdfLine(value: string, maxLength = 92) {
  const normalized = sanitizePdfText(value);

  if (normalized.length <= maxLength) {
    return [normalized];
  }

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length > maxLength && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function buildPdfLines(
  snapshot: ValidationSnapshot,
  packType: EvidencePack["packType"],
  analystNote?: DesignPartnerReportNote | null,
  riskAcceptances: readonly AcceptedRiskAttestationEntry[] = [],
  locale: SupportedLocale = "en-US"
) {
  const config = getReportTemplateConfig(packType);
  const copy = reportTemplateCopy(locale);
  const lines = [
    config.label,
    snapshot.evidencePack.title,
    `Audience: ${snapshot.evidencePack.audience}`,
    `Generated from normalized Periscan evidence for tenant ${snapshot.tenantId}`,
    "",
    "Audience Guidance",
    config.audienceGuidance,
    `Primary use: ${config.primaryUse}`,
    `Redaction posture: ${config.redactionPosture}`,
    "",
    copy.executiveSummary,
    snapshot.summary.headline,
    snapshot.summary.overview,
    `Top risk band: ${snapshot.summary.topRiskBand}`,
    "",
    "Snapshot Metrics",
    `${copy.verifiedScopes}: ${snapshot.metrics.verifiedScopeCount}`,
    `${copy.connectedIntegrations}: ${snapshot.metrics.integrationCount}`,
    `Priority attack paths: ${snapshot.metrics.topPathCount}`,
    `${copy.highRiskPaths}: ${snapshot.metrics.highRiskPathCount}`,
    `${copy.remediationPriorities}: ${snapshot.metrics.remediationCount}`,
    `Fixes overdue for re-verification: ${snapshot.metrics.staleVerificationCount}`,
    `Open threat advisories: ${snapshot.metrics.openThreatAdvisoryCount}`,
    `Advisories you're exposed to: ${snapshot.metrics.correlatedThreatAdvisoryCount}`,
    `Control observations: ${snapshot.metrics.controlObservationCount}`,
    `AI app risks: ${snapshot.metrics.aiRiskCount}`,
    "",
    copy.topPaths
  ];

  if (snapshot.topAttackPaths.length === 0) {
    lines.push("No priority attack paths were available.");
  }

  for (const {
    attackPath,
    financialExposure,
    risk
  } of snapshot.topAttackPaths) {
    const attackTechniqueIds = getAttackPathTechniqueIds(snapshot, attackPath);
    const pathReport = resolveReportPathClaim(attackPath);

    lines.push(
      `${attackPath.name} - ${risk.band} (${risk.score})`,
      risk.summary,
      financialExposure
        ? `Assumption-based annualized loss exposure: ${formatUsd(financialExposure.annualizedLossExposureUsd, locale)} (planning range ${formatUsd(financialExposure.lowerBoundUsd, locale)}–${formatUsd(financialExposure.upperBoundUsd, locale)}; ${financialExposure.confidence.toLowerCase()} confidence)`
        : "Financial exposure: Not estimated; no explicit asset valuation assumptions were supplied.",
      financialExposure
        ? `Financial methodology: ${financialExposure.methodology}; user-supplied assumptions, not measured loss history.`
        : "Financial methodology: Not applicable.",
      `Claim-safe path state: ${pathReport.claimSafeState}`,
      pathReport.remapped
        ? `Recorded row state: ${pathReport.recordedState} (not claim-safe; ${pathReport.remapReason ?? "hop measurement does not support the recorded certainty"})`
        : `Recorded row state: ${pathReport.recordedState}`,
      `Claim certainty: ${pathReport.claim.displayLabel} (${formatClaimHopCoverage(pathReport.claim)})`,
      `Declared path basis: ${attackPath.evidenceBasis}`,
      pathReport.claimBasisNote,
      `Evidence IDs: ${renderEvidenceIds(attackPath.evidenceIds)}`,
      attackTechniqueIds.length > 0
        ? `ATT&CK mapping: ${attackTechniqueIds.join(", ")}`
        : "ATT&CK mapping: None linked to this path.",
      `Path breaker: ${attackPath.pathBreakers[0]?.title ?? "To be confirmed"}`,
      ""
    );
  }

  if (
    shouldShowControlObservations(packType) &&
    snapshot.controlObservations.length > 0
  ) {
    lines.push("Control Verdicts");

    for (const signal of snapshot.controlObservations) {
      lines.push(
        `${signal.signalSubcategory ?? signal.signalCategory} from ${signal.sourceType}`,
        `Evidence IDs: ${renderEvidenceIds(signal.evidenceIds)}`
      );
    }

    lines.push("");

    const telemetryByTechnique = summarizeTelemetryByTechnique(
      snapshot.controlObservations
    );
    if (telemetryByTechnique.length > 0) {
      lines.push("Detection Telemetry by Technique");
      for (const row of telemetryByTechnique) {
        lines.push(`${row.techniqueId}: ${row.vendors.join(", ")}`);
      }
      lines.push("");
    }
  }

  if (shouldShowAiRisks(packType, snapshot) && snapshot.aiAppRisks.length > 0) {
    lines.push("AI App Validation");

    for (const signal of snapshot.aiAppRisks) {
      lines.push(
        `${signal.signalSubcategory ?? "AI application risk"} from ${signal.sourceType}`,
        `Evidence IDs: ${renderEvidenceIds(signal.evidenceIds)}`
      );
    }

    lines.push("");
  }

  if (config.includeComplianceSupport) {
    const trace = computeSnapshotComplianceTrace(snapshot, packType);
    if (trace) {
      lines.push(
        "Compliance Control Trace",
        trace.displayName,
        COMPLIANCE_PACK_DISCLAIMER,
        `Coverage: ${Math.round(trace.coverageRatio * 100)}% met (${trace.metCount} met, ${trace.partialCount} partial, ${trace.unmetCount} unmet)`,
        ""
      );
      for (const control of trace.controls) {
        lines.push(
          `${control.controlId} - ${control.status}`,
          control.title,
          `Measured support: ${control.satisfiedBy.join(", ") || "None"}`,
          `Evidence IDs: ${renderEvidenceIds(control.evidenceIds)}`,
          `Last validated: ${control.lastValidatedAt ?? "Not validated"}`,
          ""
        );
      }
    } else {
      lines.push(
        "Compliance Support",
        "This pack is customer evidence support: it links scope, validation outcomes, remediation, and verification planning to evidence IDs.",
        COMPLIANCE_PACK_DISCLAIMER,
        `Verified scopes: ${snapshot.metrics.verifiedScopeCount}`,
        `Evidence IDs: ${renderEvidenceIds(snapshot.evidenceIds)}`,
        `Verification steps: ${snapshot.verificationPlan.length}`,
        ""
      );
    }
  }

  if (isComplianceAttestation(packType)) {
    lines.push(
      "Accepted-Risk Governance",
      "Point-in-time decision register. Approved entries required a tenant member distinct from the requester; expired entries are reopened for active triage."
    );
    if (riskAcceptances.length === 0) {
      lines.push(
        "No accepted-risk decisions were recorded when this evidence pack was generated."
      );
    }
    for (const decision of riskAcceptances) {
      lines.push(
        `Finding ${decision.findingId} - ${decision.approvalState}`,
        `Risk owner: ${decision.ownerLabel}`,
        `Requested by: ${decision.requestedByLabel}`,
        `Approved by: ${decision.approvedByLabel ?? "Pending independent approval"}`,
        `Expires: ${decision.expiresAt}`,
        `Decision evidence ID: ${decision.evidenceId}`,
        decision.note ? `Decision note: ${decision.note}` : "",
        ""
      );
    }
    lines.push("");
  }

  if (config.includeMSSPDelivery) {
    lines.push(
      "MSSP Client Delivery Notes",
      "Client review should focus on priority attack paths, evidence certainty, control response, remediation progress, and evidence delivered this period.",
      `Client-ready top paths: ${snapshot.metrics.topPathCount}`,
      `Remediation priorities: ${snapshot.metrics.remediationCount}`,
      `Evidence pack: ${snapshot.evidencePack.evidencePackId}`,
      ""
    );
  }

  if (config.includeCTEMProgram) {
    const ctemProgram = buildCTEMProgramFromSnapshot(snapshot);
    lines.push("CTEM Program View");

    for (const stage of ctemProgram.stages) {
      lines.push(
        `${stage.stage}: ${stage.status}`,
        `Evidence: ${stage.evidenceCount}`,
        `Open items: ${stage.openItemCount}`,
        `Trend: ${stage.trend}`
      );
    }

    lines.push("");
  }

  if (analystNote) {
    lines.push(
      "Periscan Analyst Notes",
      analystNote.title ?? "Periscan analyst note",
      `Author: ${analystNote.authorLabel}`,
      ...wrapPdfLine(analystNote.body),
      ""
    );
  }

  if (config.includeRemediationClosure) {
    const closedRemediations = snapshot.remediationPriorities.filter(
      (remediation) => ["Fixed", "Mitigated"].includes(remediation.status)
    );
    const closedCount = closedRemediations.length;
    // P04-20: separate ClosedWithoutEvidence from Fixed in board/PDF packs.
    const closedWithoutEvidenceCount = snapshot.remediationPriorities.filter(
      (remediation) => remediation.status === "ClosedWithoutEvidence"
    ).length;
    const stillOpenCount =
      snapshot.remediationPriorities.length -
      closedCount -
      closedWithoutEvidenceCount;
    // Parity with the HTML closure pack: disclose how many closures rest on a
    // real measured re-validation. measured !== heuristic — never conflate.
    const measuredClosedCount = closedRemediations.filter(
      (remediation) =>
        remediation.latestVerification?.measuredRevalidation === true
    ).length;
    const unmeasuredClosedCount = closedCount - measuredClosedCount;
    lines.push(
      "Remediation Closure Evidence",
      "Periscan only treats remediation as Fixed when verification evidence supports the outcome. Closed without evidence is not Fixed.",
      `Fixed or mitigated (verified): ${closedCount}`,
      `Measured re-validations: ${measuredClosedCount} of ${closedCount}`,
      `Closed without evidence: ${closedWithoutEvidenceCount}`,
      `Still requiring proof: ${stillOpenCount}`,
      `Verification steps: ${snapshot.verificationPlan.length}`
    );
    if (unmeasuredClosedCount > 0) {
      lines.push(
        `${unmeasuredClosedCount} of ${closedCount} Fixed/Mitigated closure(s) rest on heuristic or not-yet-measured verification — confirm with a measured re-test before relying on them.`
      );
    }
    if (closedWithoutEvidenceCount > 0) {
      lines.push(
        `${closedWithoutEvidenceCount} remediation(s) are Closed without evidence (ticket/admin close only) and must not be reported as verified Fixed.`
      );
    }
    lines.push("");
  }

  lines.push("Remediation Priorities");

  if (snapshot.remediationPriorities.length === 0) {
    lines.push("No remediation priorities were generated.");
  }

  for (const remediation of snapshot.remediationPriorities) {
    lines.push(
      remediation.recommendedAction,
      `Owner: ${remediation.owner ?? "Unassigned"}`,
      `Verification: ${remediation.verificationMethod}`
    );
    if (remediation.latestVerification) {
      lines.push(
        `Last verification: ${remediation.latestVerification.outcome} (${
          remediation.latestVerification.measuredRevalidation
            ? "measured re-validation"
            : "not measured"
        })`
      );
    }
    lines.push(
      `Evidence IDs: ${renderEvidenceIds(remediation.evidenceIds)}`,
      ""
    );
  }

  lines.push("Verification Plan", ...snapshot.verificationPlan);

  if (shouldShowEvidenceAppendix(packType)) {
    lines.push(
      "",
      "Evidence Appendix",
      `Evidence IDs: ${renderEvidenceIds(snapshot.evidenceIds)}`,
      `Pack ID: ${snapshot.evidencePack.evidencePackId}`
    );
  }

  lines.push(
    "",
    "Methodology and Safety Notes",
    "Raw tool output is intentionally excluded from the primary report body.",
    "Only customer-authorized, non-destructive validation evidence is summarized."
  );

  return lines.flatMap((line) => (line ? wrapPdfLine(line) : [""]));
}

function buildPdfDocument(lines: string[]) {
  const maxLinesPerPage = 44;
  const pages = [];

  for (let index = 0; index < lines.length; index += maxLinesPerPage) {
    pages.push(lines.slice(index, index + maxLinesPerPage));
  }

  const objects: string[] = [];
  const pageObjectIds: number[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((pageLines, pageIndex) => {
    const pageObjectId = 4 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    const streamLines = [
      "BT",
      "/F1 10 Tf",
      "50 760 Td",
      "14 TL",
      ...pageLines.map((line) => `(${escapePdfString(line)}) Tj T*`),
      "ET"
    ];
    const stream = streamLines.join("\n");

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.push(
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    );
  });

  objects[1] = `<< /Type /Pages /Kids [${pageObjectIds
    .map((id) => `${id} 0 R`)
    .join(" ")}] /Count ${pageObjectIds.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return pdf;
}

export function renderValidationSnapshotReportPdf(
  payload: ValidationSnapshot,
  options?: {
    analystNote?: DesignPartnerReportNote | null;
    locale?: SupportedLocale;
    packType?: EvidencePack["packType"];
    riskAcceptances?: readonly AcceptedRiskAttestationEntry[];
  }
) {
  const snapshot = normalizeSnapshotClaimLanguage(payload);
  const packType = options?.packType ?? snapshot.evidencePack.packType;

  return buildPdfDocument(
    buildPdfLines(
      snapshot,
      packType,
      options?.analystNote ?? null,
      options?.riskAcceptances ?? [],
      options?.locale ?? "en-US"
    )
  );
}

function renderCTEMProgram(program: CTEMProgramSummary | null) {
  if (!program) {
    return "";
  }

  const sourceLabel =
    program.source === "Snapshot"
      ? "Snapshot-derived CTEM summary"
      : "Live tenant-state baseline; no Snapshot report has been generated yet";

  return `
    <section>
      <h2 class="section-title">CTEM Program View</h2>
      <p class="muted">${escapeHtml(sourceLabel)}</p>
      <div class="grid">
        ${program.stages
          .map(
            (stage) => `
              <article class="card">
                <div class="card-header">
                  <h3>${escapeHtml(stage.stage)}</h3>
                  <span class="badge badge-${stage.status === "OnTrack" ? "fixed" : stage.status === "NeedsAttention" ? "high" : "informational"}">
                    ${escapeHtml(stage.status)}
                  </span>
                </div>
                <dl class="facts">
                  <div><dt>Evidence</dt><dd>${stage.evidenceCount}</dd></div>
                  <div><dt>Open items</dt><dd>${stage.openItemCount}</dd></div>
                  <div><dt>Trend</dt><dd>${escapeHtml(stage.trend)}</dd></div>
                </dl>
              </article>
            `
          )
          .join("")}
      </div>
    </section>
  `;
}

export function renderValidationSnapshotReportHtml(
  payload: ValidationSnapshot,
  options?: {
    analystNote?: DesignPartnerReportNote | null;
    branding?: TenantReportBranding | null;
    ctemProgram?: CTEMProgramSummary | null;
    locale?: SupportedLocale;
    packType?: EvidencePack["packType"];
    riskAcceptances?: readonly AcceptedRiskAttestationEntry[];
  }
) {
  const snapshot = normalizeSnapshotClaimLanguage(payload);
  const locale = SupportedLocaleSchema.catch("en-US").parse(options?.locale);
  const copy = reportTemplateCopy(locale);
  const packType = options?.packType ?? snapshot.evidencePack.packType;
  const config = getReportTemplateConfig(packType);
  const reportLabel = config.label;
  const branding =
    options?.branding?.whiteLabelEnabled === true ? options.branding : null;
  const brandName = branding?.organizationName ?? "Periscan";
  const brandFooter =
    branding?.reportFooter ??
    "Periscan generated this report from normalized evidence, evidence-labeled attack paths, and non-destructive workflow data already authorized for the tenant scope.";
  const brandLogo = branding?.logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(brandName)} logo" />`
    : "";
  const supportLine = branding?.supportEmail
    ? `<p class="muted">Report support: ${escapeHtml(branding.supportEmail)}</p>`
    : "";
  const ctemProgram =
    options?.ctemProgram ??
    (config.includeCTEMProgram ? buildCTEMProgramFromSnapshot(snapshot) : null);
  const analystNote = options?.analystNote ?? null;
  const hasControlObservations = snapshot.controlObservations.length > 0;
  const hasAiRisks = snapshot.aiAppRisks.length > 0;
  const topPaths = snapshot.topAttackPaths
    .map(({ attackPath, financialExposure, risk }) => {
      const attackTechniqueIds = getAttackPathTechniqueIds(
        snapshot,
        attackPath
      );
      const pathReport = resolveReportPathClaim(attackPath);

      return `
        <article class="card">
          <div class="card-header">
            <h3>${escapeHtml(attackPath.name)}</h3>
            <span class="badge badge-${risk.band.toLowerCase()}">${escapeHtml(risk.band)}</span>
          </div>
          <p>${escapeHtml(risk.summary)}</p>
          <dl class="facts">
            <div><dt>Claim-safe path state</dt><dd>${escapeHtml(pathReport.claimSafeState)}</dd></div>
            ${
              pathReport.remapped
                ? `<div><dt>Recorded row state</dt><dd>${escapeHtml(pathReport.recordedState)} <span class="muted">(not claim-safe)</span></dd></div>`
                : `<div><dt>Recorded row state</dt><dd>${escapeHtml(pathReport.recordedState)}</dd></div>`
            }
            <div><dt>Claim certainty</dt><dd>${escapeHtml(pathReport.claim.displayLabel)} · ${formatClaimHopCoverage(pathReport.claim)}</dd></div>
            <div><dt>Declared path basis</dt><dd><span class="badge badge-${pathReport.claim.fullyMeasured ? "fixed" : "high"}">${escapeHtml(attackPath.evidenceBasis)}</span></dd></div>
            <div><dt>Impact score</dt><dd>${attackPath.impactScore}</dd></div>
            <div><dt>Confidence</dt><dd>${attackPath.confidence.toFixed(2)}</dd></div>
            <div><dt>Annualized exposure</dt><dd>${
              financialExposure
                ? formatUsd(financialExposure.annualizedLossExposureUsd, locale)
                : "Not estimated"
            }</dd></div>
            <div><dt>Financial basis</dt><dd>${
              financialExposure
                ? `${escapeHtml(financialExposure.methodology)} · ${escapeHtml(financialExposure.confidence)} confidence`
                : "No supplied valuation assumptions"
            }</dd></div>
            <div><dt>Evidence IDs</dt><dd>${renderEvidenceIds(attackPath.evidenceIds)}</dd></div>
          </dl>
          ${
            pathReport.remapped && pathReport.remapReason
              ? `<p class="caveat"><strong>Path certainty remap:</strong> ${escapeHtml(pathReport.remapReason)} Risk severity sets priority only; it never upgrades path certainty.</p>`
              : ""
          }
          ${
            financialExposure
              ? `<p class="muted">Planning range ${formatUsd(financialExposure.lowerBoundUsd, locale)}–${formatUsd(financialExposure.upperBoundUsd, locale)}. This estimate uses user-supplied assumptions and is not measured loss history or a full FAIR assessment.</p>`
              : `<p class="muted">Periscan does not invent a dollar value when no explicit asset valuation assumptions exist.</p>`
          }
          <p class="muted">${escapeHtml(pathReport.claimBasisNote)}</p>
          ${
            attackTechniqueIds.length > 0
              ? `<div><h4>ATT&amp;CK mapping</h4>${renderTechniqueIdTags(attackTechniqueIds)}</div>`
              : ""
          }
          <p class="muted">Path breaker: ${escapeHtml(attackPath.pathBreakers[0]?.title ?? "To be confirmed")}</p>
        </article>
      `;
    })
    .join("");
  const controlObservations = snapshot.controlObservations
    .map(
      (signal) => `
          <article class="card">
            <h3>${escapeHtml(signal.signalSubcategory ?? signal.signalCategory)}</h3>
            <p>${escapeHtml(signal.sourceType)}</p>
            ${renderTechniqueTags(signal)}
            <p class="muted">Evidence IDs: ${renderEvidenceIds(signal.evidenceIds)}</p>
          </article>
        `
    )
    .join("");
  const aiRisks = snapshot.aiAppRisks
    .map(
      (signal) => `
          <article class="card">
            <h3>${escapeHtml(signal.signalSubcategory ?? "AI application risk")}</h3>
            <p>${escapeHtml(signal.sourceType)}</p>
            <p class="muted">Evidence IDs: ${renderEvidenceIds(signal.evidenceIds)}</p>
          </article>
        `
    )
    .join("");
  const remediations = snapshot.remediationPriorities
    .map(
      (remediation) => `
        <article class="card">
          <h3>${escapeHtml(remediation.recommendedAction)}</h3>
          <p class="muted">Owner: ${escapeHtml(remediation.owner ?? "Unassigned")}</p>
          ${renderList(remediation.technicalSteps)}
          <p><strong>Verification:</strong> ${escapeHtml(remediation.verificationMethod)}</p>
          ${
            remediation.latestVerification
              ? `<p><strong>Last verification:</strong> ${escapeHtml(
                  remediation.latestVerification.outcome
                )} (${escapeHtml(
                  remediation.latestVerification.measuredRevalidation
                    ? "measured re-validation"
                    : "not measured"
                )})</p>`
              : ""
          }
          <p class="muted">Evidence IDs: ${renderEvidenceIds(remediation.evidenceIds)}</p>
        </article>
      `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="${escapeHtml(locale)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(brandName)} - ${escapeHtml(snapshot.evidencePack.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
        --accent: ${escapeHtml(branding?.primaryColor ?? "#7ad4d2")};
      }
      body {
        margin: 0;
        background: linear-gradient(180deg, #08111a 0%, #111b26 52%, #0a0e14 100%);
        color: #eef5fb;
      }
      main {
        max-width: 1040px;
        margin: 0 auto;
        padding: 48px 24px 64px;
      }
      .hero {
        display: grid;
        gap: 16px;
        margin-bottom: 32px;
      }
      .eyebrow {
        color: var(--accent);
        font-size: 12px;
        letter-spacing: 0.16em;
        text-transform: uppercase;
      }
      .brand-bar {
        align-items: center;
        display: flex;
        gap: 12px;
        justify-content: space-between;
        margin-bottom: 28px;
      }
      .brand-mark {
        align-items: center;
        color: #f5fbff;
        display: flex;
        font-size: 0.95rem;
        font-weight: 800;
        gap: 10px;
        letter-spacing: 0.02em;
      }
      .brand-logo {
        border-radius: 10px;
        max-height: 36px;
        max-width: 150px;
      }
      h1, h2, h3, p {
        margin: 0;
      }
      h1 {
        font-size: clamp(2.6rem, 5vw, 4.4rem);
        line-height: 0.94;
      }
      .lede {
        color: #b7c8d8;
        font-size: 1.05rem;
        line-height: 1.6;
        max-width: 52rem;
      }
      .metrics, .grid {
        display: grid;
        gap: 16px;
      }
      .metrics {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        margin: 28px 0 40px;
      }
      .metric, .card, .note {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(122, 212, 210, 0.14);
        border-radius: 20px;
        padding: 18px;
      }
      .metric strong {
        display: block;
        font-size: 1.8rem;
        margin-top: 8px;
      }
      section {
        margin-top: 36px;
      }
      .section-title {
        margin-bottom: 16px;
        font-size: 1.35rem;
      }
      .card-header {
        display: flex;
        gap: 12px;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 12px;
      }
      .technique-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 12px;
      }
      .technique-tag {
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 600;
        background: rgba(59, 130, 246, 0.16);
        color: #b9d5ff;
      }
      .badge {
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .badge-critical { background: rgba(239, 68, 68, 0.2); color: #ffb1b1; }
      .badge-high { background: rgba(245, 158, 11, 0.18); color: #ffd089; }
      .badge-medium { background: rgba(59, 130, 246, 0.18); color: #9cc4ff; }
      .badge-low, .badge-informational, .badge-fixed { background: rgba(34, 197, 94, 0.18); color: #8ff0b2; }
      .facts {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 12px;
        margin-top: 16px;
      }
      .facts dt {
        color: #8ea5bb;
        font-size: 0.88rem;
      }
      .facts dd {
        margin: 4px 0 0;
        font-weight: 600;
      }
      .table-wrap {
        margin-top: 24px;
        overflow-x: auto;
      }
      table {
        border-collapse: collapse;
        font-size: 0.84rem;
        min-width: 840px;
        width: 100%;
      }
      th, td {
        border-bottom: 1px solid #2b3a48;
        padding: 12px 10px;
        text-align: left;
        vertical-align: top;
      }
      th {
        color: #91a7b9;
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .muted {
        color: #9fb2c5;
      }
      ul {
        margin: 12px 0 0;
        padding-left: 18px;
      }
      li + li {
        margin-top: 8px;
      }
      .appendix {
        font-family: "IBM Plex Mono", "SFMono-Regular", monospace;
        font-size: 0.88rem;
        line-height: 1.5;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="brand-bar">
        <div class="brand-mark">${brandLogo}<span>${escapeHtml(brandName)}</span></div>
        <span class="eyebrow">${escapeHtml(snapshot.evidencePack.audience)}</span>
      </div>
      <header class="hero">
        <span class="eyebrow">${escapeHtml(reportLabel)}</span>
        <h1>${escapeHtml(snapshot.summary.headline)}</h1>
        <p class="lede">${escapeHtml(snapshot.summary.overview)}</p>
      </header>

      <section>
        <h2 class="section-title">${copy.executiveSummary}</h2>
        <article class="note">
          <p>${escapeHtml(snapshot.summary.overview)}</p>
          <dl class="facts">
            <div><dt>${copy.topRiskBand}</dt><dd>${escapeHtml(snapshot.summary.topRiskBand)}</dd></div>
            <div><dt>${copy.evidenceBasis}</dt><dd>Normalized Periscan evidence and evidence IDs</dd></div>
          </dl>
        </article>
      </section>

      ${
        config.continuousVerdictBasis
          ? `
      <section>
        <h2 class="section-title">Continuous Validation Verdict Basis</h2>
        <div class="note">
          <p>${escapeHtml(config.continuousVerdictBasis)}</p>
          <p class="muted">Report type: ${escapeHtml(packType)}</p>
        </div>
      </section>`
          : ""
      }

      <section class="metrics">
        <div class="metric"><span>${copy.verifiedScopes}</span><strong>${snapshot.metrics.verifiedScopeCount}</strong></div>
        <div class="metric"><span>${copy.connectedIntegrations}</span><strong>${snapshot.metrics.integrationCount}</strong></div>
        <div class="metric"><span>Top paths</span><strong>${snapshot.metrics.topPathCount}</strong></div>
        <div class="metric"><span>${copy.highRiskPaths}</span><strong>${snapshot.metrics.highRiskPathCount}</strong></div>
        <div class="metric"><span>${copy.remediations}</span><strong>${snapshot.metrics.remediationCount}</strong></div>
        <div class="metric"><span>AI risks</span><strong>${snapshot.metrics.aiRiskCount}</strong></div>
      </section>

      ${renderSnapshotCoverage(snapshot)}

      ${
        packType === "ExecutiveRiskSummary" ||
        packType === "CustomerSecurityReview"
          ? renderPathClaimHonestyBanner(snapshot)
          : ""
      }

      ${renderAudienceGuidance(config)}

      ${renderAnalystNote(analystNote)}

      <section>
        <h2 class="section-title">${copy.topPaths}</h2>
        ${renderRiskBandChart(snapshot)}
        <div class="grid">${topPaths || `<p class="muted">${copy.noPaths}</p>`}</div>
      </section>

      ${
        shouldShowControlObservations(packType) && hasControlObservations
          ? `
      <section>
        <h2 class="section-title">${copy.controlVerdicts}</h2>
        <div class="grid">${controlObservations}</div>
      </section>`
          : ""
      }

      ${
        shouldShowAiRisks(packType, snapshot) && hasAiRisks
          ? `
      <section>
        <h2 class="section-title">${copy.aiValidation}</h2>
        <div class="grid">${aiRisks}</div>
      </section>`
          : ""
      }

      ${renderCTEMProgram(ctemProgram)}

      ${config.includeComplianceSupport ? renderComplianceSupport(snapshot, packType) : ""}

      ${isComplianceAttestation(packType) ? renderAcceptedRiskAttestation(options?.riskAcceptances ?? []) : ""}

      ${config.includeMSSPDelivery ? renderMSSPDelivery(snapshot) : ""}

      ${config.includeRemediationClosure ? renderRemediationClosure(snapshot) : ""}

      <section>
        <h2 class="section-title">${copy.remediationPriorities}</h2>
        <div class="grid">${remediations || '<p class="muted">No remediation priorities were generated.</p>'}</div>
      </section>

      <section>
        <h2 class="section-title">${copy.verificationPlan}</h2>
        <div class="note">${renderList(snapshot.verificationPlan)}</div>
      </section>

      ${
        shouldShowEvidenceAppendix(packType)
          ? `
      <section>
        <h2 class="section-title">${copy.evidenceAppendix}</h2>
        <div class="note appendix">
          <p>Evidence IDs: ${renderEvidenceIds(snapshot.evidenceIds)}</p>
          <p>Pack ID: ${escapeHtml(snapshot.evidencePack.evidencePackId)}</p>
          <p>Audience: ${escapeHtml(snapshot.evidencePack.audience)}</p>
        </div>
      </section>`
          : ""
      }

      <section>
        <h2 class="section-title">${copy.methodology}</h2>
        <div class="note">
          <p>${escapeHtml(brandFooter)}</p>
          <p class="muted">Raw tool output is intentionally excluded from the primary report body.</p>
          ${supportLine}
        </div>
      </section>
    </main>
  </body>
</html>`;
}

function collectAdvisoryEvidenceIds(detail: ThreatAdvisoryDetail) {
  return [
    ...new Set([
      ...detail.advisory.evidenceIds,
      ...detail.package.evidenceIds,
      ...detail.impactAssessment.evidenceIds,
      ...detail.readinessReport.evidenceIds,
      ...detail.validationPlan.evidenceIds,
      ...detail.validationPlan.planItems.flatMap((item) => item.evidenceIds)
    ])
  ];
}

function buildAdvisoryPdfLines(detail: ThreatAdvisoryDetail) {
  const allEvidenceIds = collectAdvisoryEvidenceIds(detail);
  const lines = [
    "Periscan Threat Advisory Readiness Report",
    detail.advisory.title,
    `Generated from normalized Periscan advisory data for tenant ${detail.advisory.tenantId}`,
    "",
    "Readiness Summary",
    `Status: ${detail.readinessReport.readinessStatus}`,
    detail.readinessReport.summary,
    `Source: ${detail.advisory.sourceName}`,
    `Raw evidence ID: ${detail.rawEvidenceId}`,
    `Evidence pack: ${detail.readinessReport.evidencePackId ?? "Not generated"}`,
    "",
    "Extracted Advisory Context",
    `CVEs: ${detail.advisory.cveIds.join(", ") || "None extracted"}`,
    `IoCs: ${detail.advisory.iocValues.join(", ") || "None extracted"}`,
    `ATT&CK IDs: ${detail.advisory.techniqueIds.join(", ") || "None extracted"}`,
    "Extracted values are advisory context only, not validation proof.",
    "",
    "Impact Assessment",
    detail.impactAssessment.summary,
    `Confidence: ${Math.round(detail.impactAssessment.confidence * 100)}%`,
    `Affected assets with evidence: ${detail.impactAssessment.affectedAssetIds.length}`,
    `Affected findings with evidence: ${detail.impactAssessment.affectedFindingIds.length}`,
    "",
    "Missing Signals"
  ];

  if (detail.missingSignals.length === 0) {
    lines.push("No missing signals are currently blocking readiness.");
  }

  for (const signal of detail.missingSignals) {
    lines.push(
      `${signal.signalType}: ${signal.status}`,
      signal.reason,
      signal.requiredIntegrationCategory
        ? `Required integration: ${signal.requiredIntegrationCategory}`
        : "Required integration: none",
      ""
    );
  }

  lines.push(
    "Non-Executing Validation Plan",
    detail.validationPlan.summary,
    `Plan status: ${detail.validationPlan.status}`
  );

  for (const item of detail.validationPlan.planItems) {
    lines.push(
      `${item.title}: ${item.status}`,
      `Mission type: ${item.missionType}`,
      `Safety level: ${item.safetyLevel}`,
      item.rationale,
      `Evidence IDs: ${renderEvidenceIds(item.evidenceIds)}`,
      ""
    );
  }

  lines.push(
    "Evidence Appendix",
    `Evidence IDs: ${renderEvidenceIds(allEvidenceIds)}`,
    "",
    "Methodology and Safety Notes",
    "Manual advisory import does not ingest external feeds in this workflow.",
    "No validation missions are queued by import or report generation.",
    "Readiness requires evidence-backed validation or explicit policy-gated approval before execution.",
    "Raw advisory content is excluded from this report body."
  );

  return lines.flatMap((line) => (line ? wrapPdfLine(line) : [""]));
}

export function renderAdvisoryReadinessReportPdf(
  payload: ThreatAdvisoryDetail
) {
  const detail = ThreatAdvisoryDetailSchema.parse(payload);

  return buildPdfDocument(buildAdvisoryPdfLines(detail));
}

export function renderAdvisoryReadinessReportHtml(
  payload: ThreatAdvisoryDetail,
  options?: {
    branding?: TenantReportBranding | null;
  }
) {
  const detail = ThreatAdvisoryDetailSchema.parse(payload);
  const branding =
    options?.branding?.whiteLabelEnabled === true ? options.branding : null;
  const brandName = branding?.organizationName ?? "Periscan";
  const brandFooter =
    branding?.reportFooter ??
    "Periscan generated this report from normalized advisory evidence, tenant configuration, and non-destructive readiness planning data.";
  const brandLogo = branding?.logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(branding.logoUrl)}" alt="${escapeHtml(brandName)} logo" />`
    : "";
  const supportLine = branding?.supportEmail
    ? `<p class="muted">Report support: ${escapeHtml(branding.supportEmail)}</p>`
    : "";
  const allEvidenceIds = collectAdvisoryEvidenceIds(detail);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(detail.advisory.title)} - Threat Advisory Readiness</title>
    <style>
      :root { color-scheme: light; --ink: #17211b; --muted: #607266; --line: #d9e5d9; --panel: #f7faf4; --accent: #1f6f43; --warn: #9a5c00; --danger: #9f2d2d; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "IBM Plex Serif", Georgia, serif; color: var(--ink); background: #eef4ea; line-height: 1.55; }
      main { max-width: 980px; margin: 0 auto; padding: 48px 28px; }
      header, section, footer { background: rgba(255,255,255,.9); border: 1px solid var(--line); border-radius: 24px; padding: 28px; margin-bottom: 22px; box-shadow: 0 24px 70px rgba(52, 74, 57, .10); }
      h1, h2, h3 { margin: 0 0 12px; line-height: 1.12; }
      h1 { font-size: 42px; letter-spacing: -0.04em; }
      h2 { font-size: 24px; }
      h3 { font-size: 18px; }
      .eyebrow { display: block; text-transform: uppercase; letter-spacing: .16em; color: var(--muted); font-size: 12px; font-weight: 700; margin-bottom: 8px; }
      .muted { color: var(--muted); }
      .brand-row { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
      .brand-logo { max-height: 44px; max-width: 180px; object-fit: contain; }
      .badge { display: inline-flex; border-radius: 999px; padding: 7px 12px; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; border: 1px solid var(--line); background: var(--panel); }
      .badge-ready { color: var(--accent); border-color: rgba(31,111,67,.25); background: #e9f7ee; }
      .badge-approval { color: var(--warn); border-color: rgba(154,92,0,.25); background: #fff3d8; }
      .badge-missing { color: var(--danger); border-color: rgba(159,45,45,.25); background: #ffeded; }
      .grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
      .card { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; padding: 18px; }
      .facts { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin: 18px 0 0; }
      .facts dt { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
      .facts dd { margin: 4px 0 0; font-weight: 700; word-break: break-word; }
      .technique-tags, .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
      .technique-tag, .chip { border: 1px solid var(--line); background: white; border-radius: 999px; padding: 6px 10px; font-size: 12px; }
      ul { padding-left: 20px; }
      li { margin-bottom: 6px; }
      .warning { border-left: 4px solid var(--warn); padding-left: 16px; color: #523600; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div class="brand-row">
          <div>
            <span class="eyebrow">${escapeHtml(brandName)} Threat Center · Periscan Threat Advisory Readiness Report</span>
            <h1>${escapeHtml(detail.advisory.title)}</h1>
          </div>
          ${brandLogo}
        </div>
        <p>${escapeHtml(detail.readinessReport.summary)}</p>
        <span class="badge ${
          detail.readinessReport.readinessStatus === "Ready"
            ? "badge-ready"
            : detail.readinessReport.readinessStatus === "RequiresApproval"
              ? "badge-approval"
              : "badge-missing"
        }">${escapeHtml(detail.readinessReport.readinessStatus)}</span>
        <dl class="facts">
          <div><dt>Source</dt><dd>${escapeHtml(detail.advisory.sourceName)}</dd></div>
          <div><dt>Raw evidence ID</dt><dd>${escapeHtml(detail.rawEvidenceId)}</dd></div>
          <div><dt>Evidence pack</dt><dd>${escapeHtml(detail.readinessReport.evidencePackId ?? "Not generated")}</dd></div>
          <div><dt>Impact confidence</dt><dd>${Math.round(detail.impactAssessment.confidence * 100)}%</dd></div>
        </dl>
      </header>

      <section>
        <span class="eyebrow">Extracted Advisory Context</span>
        <p class="warning">Extracted values are advisory context only. They are not validation proof, exploitability proof, detection proof, or remediation proof.</p>
        <div class="grid">
          <article class="card">
            <h3>CVEs</h3>
            ${renderList(detail.advisory.cveIds)}
          </article>
          <article class="card">
            <h3>IoCs</h3>
            ${renderList(detail.advisory.iocValues)}
          </article>
          <article class="card">
            <h3>MITRE ATT&amp;CK</h3>
            ${renderTechniqueIdTags(detail.advisory.techniqueIds)}
          </article>
        </div>
      </section>

      <section>
        <span class="eyebrow">Impact Assessment</span>
        <h2>Evidence-backed impact posture</h2>
        <p>${escapeHtml(detail.impactAssessment.summary)}</p>
        <dl class="facts">
          <div><dt>Affected assets</dt><dd>${detail.impactAssessment.affectedAssetIds.length}</dd></div>
          <div><dt>Affected findings</dt><dd>${detail.impactAssessment.affectedFindingIds.length}</dd></div>
          <div><dt>Missing signal inputs</dt><dd>${detail.impactAssessment.missingSignalIds.length}</dd></div>
        </dl>
      </section>

      <section>
        <span class="eyebrow">Missing Signals</span>
        <h2>Proof inputs blocking readiness</h2>
        ${
          detail.missingSignals.length === 0
            ? '<p class="muted">No missing signals are currently blocking readiness. Validation still requires policy approval before execution.</p>'
            : `<div class="grid">${detail.missingSignals
                .map(
                  (signal) => `
                    <article class="card">
                      <h3>${escapeHtml(signal.signalType)}</h3>
                      <span class="badge badge-missing">${escapeHtml(signal.status)}</span>
                      <p>${escapeHtml(signal.reason)}</p>
                      <p class="muted">Required integration: ${escapeHtml(signal.requiredIntegrationCategory ?? "none")}</p>
                    </article>
                  `
                )
                .join("")}</div>`
        }
      </section>

      <section>
        <span class="eyebrow">Validation Plan</span>
        <h2>Non-executing, policy-gated recommendations</h2>
        <p>${escapeHtml(detail.validationPlan.summary)}</p>
        <div class="grid">
          ${detail.validationPlan.planItems
            .map(
              (item) => `
                <article class="card">
                  <h3>${escapeHtml(item.title)}</h3>
                  <span class="badge ${
                    item.status === "NeedsApproval"
                      ? "badge-approval"
                      : "badge-missing"
                  }">${escapeHtml(item.status)}</span>
                  <p>${escapeHtml(item.rationale)}</p>
                  <p class="muted">Mission: ${escapeHtml(item.missionType)} · Safety: ${escapeHtml(item.safetyLevel)}</p>
                  <p class="muted">Evidence IDs: ${escapeHtml(renderEvidenceIds(item.evidenceIds))}</p>
                </article>
              `
            )
            .join("")}
        </div>
      </section>

      <section>
        <span class="eyebrow">Evidence Appendix</span>
        <h2>Evidence IDs</h2>
        <div class="chips">
          ${allEvidenceIds
            .map(
              (evidenceId) =>
                `<span class="chip">${escapeHtml(evidenceId)}</span>`
            )
            .join("")}
        </div>
      </section>

      <footer>
        <span class="eyebrow">Methodology and Safety Notes</span>
        <p>Manual advisory import does not ingest external feeds in this workflow. No validation missions are queued by import or report generation. Raw advisory content is excluded from this report body.</p>
        <p class="muted">${escapeHtml(brandFooter)}</p>
        ${supportLine}
      </footer>
    </main>
  </body>
</html>`;
}

export function buildCTEMProgramSummary(
  snapshot: ValidationSnapshot,
  options?: CTEMProgramOptions
): CTEMProgramSummary {
  return buildCTEMProgramFromSnapshot(snapshot, options);
}

interface FixEffectivenessTrendView {
  remediationId?: string;
  runs?: number;
  affectedPathsCount?: number;
  avgRiskDelta?: number;
  hypotheticalRiskDelta?: number;
  successRate?: number;
  trend?: string;
  projectedVerdict?: string;
  lastOutcome?: string;
}

// D/E integration: render fix effectiveness trends (from simulator + past verifs) for reports + UI
export function renderFixEffectivenessTrendingHtml(
  trends: FixEffectivenessTrendView[]
): string {
  if (!trends || trends.length === 0) {
    return '<p class="muted">No prior fix runs for trending. Run FixVerification schedules to populate effectiveness (avg delta, success rate, improving/regressing).</p>';
  }
  const rows = trends
    .map((t) => {
      const delta = t.avgRiskDelta || t.hypotheticalRiskDelta || 0;
      return `<tr><td>${escapeHtml(t.remediationId || "")}</td><td>${t.runs || t.affectedPathsCount || 1}</td><td>${delta}</td><td>${t.successRate || 0}%</td><td>${escapeHtml(t.trend || t.projectedVerdict || "stable")}</td><td>${escapeHtml(t.lastOutcome || "")}</td></tr>`;
    })
    .join("");
  return `<table class="trends"><thead><tr><th>Remediation</th><th>Runs</th><th>Avg Delta</th><th>Success</th><th>Trend</th><th>Last</th></tr></thead><tbody>${rows}</tbody></table><p class="note">Sim what-if + one-click playbooks + tripwires integrated. Re-test via instant FixVerification schedule.</p>`;
}

// G5: Safe simulated video replay export (ffmpeg fixture). Returns metadata + artifact link for gamified training replays.
export function exportReplayVideoSim(
  evidencePackId: string,
  sourceEvidence?: unknown
): { videoUrl: string; durationSec: number; note: string; sourcePack: string } {
  void sourceEvidence;
  const safeId = evidencePackId || "pack-sim";
  return {
    videoUrl: `artifact://replay-${safeId}.mp4 (sim via ffmpeg fixture)`,
    durationSec: 45,
    note: "G5: Simulated replay video from evidence/playwright (no real ffmpeg exec; fixture for Marketplace gamified training).",
    sourcePack: safeId
  };
}

// G6: Expanded bi-di export formats (json, tf, yaml etc) for full integrations + SDK/TF.
export function exportEvidencePackMultiFormat(
  evidencePackId: string,
  format: "json" | "tf" | "yaml" | "csv" = "json"
): { format: string; content: string; note: string } {
  const id = evidencePackId || "sim-pack";
  const note =
    "G6: Additional export formats via sim (no real transform). Supports TF provider + SDK consumers. See openapi + generator.";
  if (format === "tf") {
    return {
      format,
      content: `# Periscan TF resource scaffold for ${id}\nresource "periscan_evidence_pack" "${id.replace(/-/g, "_")}" { pack_id = "${id}" }`,
      note
    };
  }
  if (format === "yaml") {
    return {
      format,
      content: `evidencePack:\n  id: ${id}\n  format: yaml\n  # G6 bi-di`,
      note
    };
  }
  if (format === "csv") {
    return { format, content: `packId,format\n${id},csv\n# G6`, note };
  }
  return {
    format,
    content: JSON.stringify(
      { packId: id, format: "json", note: "G6 bi-di" },
      null,
      2
    ),
    note
  };
}
export * from "./compliance-catalog";
export * from "./github-proof-comment";
export * from "./sarif";
