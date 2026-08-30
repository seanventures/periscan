// Compliance control catalog — maps real regulatory/framework controls to the
// MEASURED validation evidence Periscan produces, so each evidence-support pack
// evaluates controls against actual measurement (not a generic posture summary).
// Packs are customer audit-support exports only — never vendor certification or
// a formal SOC 2 / ISO / framework attestation. Coverage is derived, never
// asserted: a control is only "Met" when a measured evidence kind it depends on
// is actually present. Catalog depth is representative (partial), not program-complete.

import type { ValidationSnapshot } from "@periscan/shared";

// The measured evidence primitives Periscan can produce, expressed as capability
// kinds a control can depend on.
export type ComplianceEvidenceKind =
  | "measured-exposure-validation"
  | "control-detection-validation"
  | "fix-verification"
  | "ai-control-validation"
  | "attack-path-analysis"
  | "continuous-validation"
  | "evidence-integrity";

export interface ComplianceControl {
  controlId: string;
  title: string;
  // Evidence kinds that, when measured and present, satisfy this control. All
  // present → Met; some present → Partial; none → Unmet.
  evidencedBy: ComplianceEvidenceKind[];
}

export interface ComplianceFramework {
  framework: string;
  displayName: string;
  controls: ComplianceControl[];
}

export type ComplianceControlStatus = "Met" | "Partial" | "Unmet";

export interface ComplianceControlCoverage extends ComplianceControl {
  status: ComplianceControlStatus;
  satisfiedBy: ComplianceEvidenceKind[];
  missing: ComplianceEvidenceKind[];
}

export interface ComplianceCoverageResult {
  framework: string;
  displayName: string;
  controls: ComplianceControlCoverage[];
  metCount: number;
  partialCount: number;
  unmetCount: number;
  // Fraction of controls fully Met (0..1).
  coverageRatio: number;
}

export interface ComplianceEvidenceTrace {
  evidenceIds: string[];
  kind: ComplianceEvidenceKind;
  validatedAt: string;
}

export interface ComplianceControlTrace extends ComplianceControlCoverage {
  evidenceIds: string[];
  lastValidatedAt: string | null;
}

export interface ComplianceTraceResult
  extends Omit<ComplianceCoverageResult, "controls"> {
  controls: ComplianceControlTrace[];
  evidence: ComplianceEvidenceTrace[];
}

export interface SnapshotComplianceOptions {
  continuousValidation?: {
    evidenceIds?: string[];
    validatedAt: string;
  } | null;
  evidenceIntegrity?: {
    evidenceIds?: string[];
    validatedAt: string;
    verified: boolean;
  } | null;
}

export const COMPLIANCE_PACK_TYPES = [
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

/**
 * Canonical customer-facing disclaimer for every compliance evidence-support
 * pack (Wave G2). Required language: not certification / not audit opinion.
 * Reuse in HTML, PDF, workbench, and report template audience guidance so copy
 * cannot drift into formal attestation claims.
 */
export const COMPLIANCE_PACK_DISCLAIMER =
  "Customer evidence support only (partial catalog). This pack is not a certification and not an audit opinion. It is not a vendor SOC 2 Type II report or formal framework attestation. It does not assert certification status or replace auditor judgment.";

/** Short banner for UI surfaces that cannot carry the full disclaimer. */
export const COMPLIANCE_PACK_DISCLAIMER_SHORT =
  "Customer evidence support — not certification and not an audit opinion";

export interface ComplianceCatalogVersion {
  catalogVersion: string;
  lastReviewedAt: string;
  sourceVersion: string;
}

// Framework source versions are intentionally separate from Periscan's catalog
// revision. A regulatory source update does not silently rewrite an existing
// sign-off; governance records retain the catalogVersion they were reviewed on.
export const COMPLIANCE_CATALOG_VERSIONS: Record<
  (typeof COMPLIANCE_PACK_TYPES)[number],
  ComplianceCatalogVersion
> = {
  DORAAttestation: {
    // Swarm S3: expanded representative control→evidence links (still partial).
    catalogVersion: "periscan-2026.07.s3",
    lastReviewedAt: "2026-07-31T00:00:00.000Z",
    sourceVersion: "Regulation (EU) 2022/2554"
  },
  NIS2Attestation: {
    catalogVersion: "periscan-2026.07.s3",
    lastReviewedAt: "2026-07-31T00:00:00.000Z",
    sourceVersion: "Directive (EU) 2022/2555"
  },
  SECAttestation: {
    // Slice B: expanded representative control→evidence links (still partial).
    catalogVersion: "periscan-2026.08.slice-b",
    lastReviewedAt: "2026-08-01T00:00:00.000Z",
    sourceVersion: "SEC Release 33-11216 (2023)"
  },
  GDPRAttestation: {
    catalogVersion: "periscan-2026.08.slice-b",
    lastReviewedAt: "2026-08-01T00:00:00.000Z",
    sourceVersion: "Regulation (EU) 2016/679"
  },
  PCIDSSAttestation: {
    catalogVersion: "periscan-2026.07.s3",
    lastReviewedAt: "2026-07-31T00:00:00.000Z",
    sourceVersion: "PCI DSS v4.0.1"
  },
  ISO27001Attestation: {
    catalogVersion: "periscan-2026.08.slice-b",
    lastReviewedAt: "2026-08-01T00:00:00.000Z",
    sourceVersion: "ISO/IEC 27001:2022"
  },
  EUAiActAttestation: {
    catalogVersion: "periscan-2026.08.slice-b",
    lastReviewedAt: "2026-08-01T00:00:00.000Z",
    sourceVersion: "Regulation (EU) 2024/1689"
  },
  ISO42001Attestation: {
    catalogVersion: "periscan-2026.08.slice-b",
    lastReviewedAt: "2026-08-01T00:00:00.000Z",
    sourceVersion: "ISO/IEC 42001:2023"
  },
  HIPAAAttestation: {
    catalogVersion: "periscan-2026.08.slice-b",
    lastReviewedAt: "2026-08-01T00:00:00.000Z",
    sourceVersion: "45 CFR Parts 160 and 164"
  },
  SOC2Attestation: {
    catalogVersion: "periscan-2026.07",
    lastReviewedAt: "2026-07-14T00:00:00.000Z",
    sourceVersion: "AICPA Trust Services Criteria 2017 (2022 points of focus)"
  },
  NISTCSFAttestation: {
    catalogVersion: "periscan-2026.07",
    lastReviewedAt: "2026-07-14T00:00:00.000Z",
    sourceVersion: "NIST CSF 2.0"
  }
};

// Representative real controls per framework, mapped to measured evidence. The
// control ids reference the actual instrument (article / requirement / Annex A).
export const COMPLIANCE_CATALOG: Record<string, ComplianceFramework> = {
  DORAAttestation: {
    displayName:
      "Measured control evidence for DORA (Digital Operational Resilience Act) (partial)",
    framework: "DORAAttestation",
    controls: [
      {
        controlId: "DORA Art. 6 — ICT risk management framework",
        evidencedBy: ["measured-exposure-validation", "continuous-validation"],
        title: "Identify and continuously validate ICT risk"
      },
      {
        controlId: "DORA Art. 24–27 — Threat-led penetration testing",
        evidencedBy: ["attack-path-analysis", "measured-exposure-validation"],
        title: "Advanced testing of ICT tools and systems"
      },
      {
        controlId: "DORA Art. 17–19 — ICT incident detection",
        evidencedBy: ["control-detection-validation"],
        title: "Detect and report ICT-related incidents"
      },
      {
        controlId: "DORA Art. 12 — Recovery and evidence integrity",
        evidencedBy: ["fix-verification", "evidence-integrity"],
        title: "Backup, restoration, and tamper-evident records"
      },
      {
        controlId: "DORA Art. 11 — ICT business continuity",
        evidencedBy: ["fix-verification", "continuous-validation"],
        title: "ICT business continuity and response/recovery testing"
      },
      // Swarm S3 expansions — only kinds Periscan already measures.
      {
        controlId: "DORA Art. 8 — Protection and prevention",
        evidencedBy: [
          "measured-exposure-validation",
          "fix-verification",
          "control-detection-validation"
        ],
        title: "Protect ICT systems and prevent security events with measured proof"
      },
      {
        controlId: "DORA Art. 10 — Detection",
        evidencedBy: ["control-detection-validation", "continuous-validation"],
        title: "Mechanisms to promptly detect anomalous activities"
      },
      {
        controlId: "DORA Art. 13 — Learning and evolving",
        evidencedBy: ["fix-verification", "attack-path-analysis"],
        title: "Gather information on vulnerabilities and cyber threats; revalidate fixes"
      }
    ]
  },
  NIS2Attestation: {
    displayName: "Measured control evidence for NIS2 Directive (partial)",
    framework: "NIS2Attestation",
    controls: [
      {
        controlId: "NIS2 Art. 21(2)(a) — Risk analysis",
        evidencedBy: ["measured-exposure-validation", "attack-path-analysis"],
        title: "Risk-analysis and information-system security policies"
      },
      {
        controlId: "NIS2 Art. 21(2)(b) — Incident handling",
        evidencedBy: ["control-detection-validation"],
        title: "Incident detection and handling"
      },
      {
        controlId: "NIS2 Art. 21(2)(f) — Effectiveness testing",
        evidencedBy: ["control-detection-validation", "continuous-validation"],
        title: "Policies to assess the effectiveness of measures"
      },
      // Swarm S3 expansions — map only to measured Periscan evidence kinds.
      {
        controlId: "NIS2 Art. 21(2)(c) — Business continuity",
        evidencedBy: ["fix-verification", "continuous-validation"],
        title: "Business continuity and crisis management backed by revalidation"
      },
      {
        controlId: "NIS2 Art. 21(2)(d) — Supply chain security",
        evidencedBy: ["attack-path-analysis", "measured-exposure-validation"],
        title: "Supply-chain and third-party path exposure validation"
      },
      {
        controlId: "NIS2 Art. 21(2)(e) — Network and system security",
        evidencedBy: [
          "measured-exposure-validation",
          "control-detection-validation"
        ],
        title: "Security in network and information systems acquisition and maintenance"
      }
    ]
  },
  PCIDSSAttestation: {
    displayName: "Measured control evidence for PCI DSS v4.0 (partial)",
    framework: "PCIDSSAttestation",
    controls: [
      {
        controlId: "PCI DSS Req. 11.3 — Vulnerability testing",
        evidencedBy: ["measured-exposure-validation", "fix-verification"],
        title: "Regularly test security systems for vulnerabilities"
      },
      {
        controlId: "PCI DSS Req. 11.4 — Penetration testing",
        evidencedBy: ["attack-path-analysis", "measured-exposure-validation"],
        title: "External and internal penetration testing"
      },
      {
        controlId: "PCI DSS Req. 10 — Detection and logging",
        evidencedBy: ["control-detection-validation"],
        title: "Log and monitor access; validate detections fire"
      },
      {
        controlId: "PCI DSS Req. 12.10 — Incident response",
        evidencedBy: [
          "control-detection-validation",
          "fix-verification",
          "evidence-integrity"
        ],
        title: "Implement and maintain an incident response plan with proof"
      },
      // Swarm S3 expansions — representative only; never program-complete PCI.
      {
        controlId: "PCI DSS Req. 6.3 — Secure software and vulnerabilities",
        evidencedBy: ["measured-exposure-validation", "fix-verification"],
        title: "Identify and manage vulnerabilities in software and systems"
      },
      {
        controlId: "PCI DSS Req. 11.5.1 — Change-detection mechanisms",
        evidencedBy: ["control-detection-validation", "continuous-validation"],
        title: "Detect unauthorized changes; revalidate monitoring continuously"
      },
      {
        controlId: "PCI DSS Req. 2.2 — System configuration standards",
        evidencedBy: ["measured-exposure-validation"],
        title: "Apply secure configuration standards and validate residual exposure"
      }
    ]
  },
  ISO27001Attestation: {
    displayName:
      "Measured control evidence for ISO/IEC 27001:2022 (Annex A) (partial)",
    framework: "ISO27001Attestation",
    controls: [
      {
        controlId: "ISO 27001 A.8.8 — Technical vulnerability management",
        evidencedBy: ["measured-exposure-validation", "fix-verification"],
        title: "Manage technical vulnerabilities"
      },
      {
        controlId: "ISO 27001 A.8.16 — Monitoring activities",
        evidencedBy: ["control-detection-validation"],
        title: "Monitor and validate detection of anomalous activity"
      },
      {
        controlId: "ISO 27001 A.5.7 — Threat intelligence",
        evidencedBy: ["attack-path-analysis"],
        title: "Collect and act on threat intelligence"
      },
      // Slice B expansions — only kinds Periscan already measures; never program-complete.
      {
        controlId: "ISO 27001 A.8.7 — Protection against malware",
        evidencedBy: [
          "control-detection-validation",
          "measured-exposure-validation"
        ],
        title: "Implement and validate protection against malware"
      },
      {
        controlId: "ISO 27001 A.5.26 — Response to information security incidents",
        evidencedBy: ["fix-verification", "control-detection-validation"],
        title: "Respond to incidents and revalidate restored controls"
      },
      {
        controlId: "ISO 27001 A.8.15 — Logging",
        evidencedBy: ["control-detection-validation", "evidence-integrity"],
        title: "Produce, protect, and examine logs with integrity-backed evidence"
      },
      {
        controlId: "ISO 27001 A.8.9 — Configuration management",
        evidencedBy: ["measured-exposure-validation", "continuous-validation"],
        title: "Define, implement, and continuously validate secure configurations"
      }
    ]
  },
  SECAttestation: {
    displayName:
      "Measured control evidence for SEC Cybersecurity Disclosure Rules (partial)",
    framework: "SECAttestation",
    controls: [
      {
        controlId: "SEC Item 106(b) — Risk management & strategy",
        evidencedBy: ["measured-exposure-validation", "continuous-validation"],
        title: "Processes to assess, identify, and manage material cyber risk"
      },
      {
        controlId: "SEC Item 106(b)(2) — Third-party oversight",
        evidencedBy: ["attack-path-analysis"],
        title: "Assess risks from third-party systems"
      },
      // Slice B expansions — disclosure support evidence only, not a Form 8-K filing.
      {
        controlId: "SEC Item 106(c) — Governance",
        evidencedBy: ["continuous-validation", "fix-verification"],
        title: "Board/management oversight backed by recurring measured validation"
      },
      {
        controlId: "SEC Item 1.05 context — Material incident detection support",
        evidencedBy: [
          "control-detection-validation",
          "evidence-integrity",
          "attack-path-analysis"
        ],
        title: "Detect material cyber incidents and preserve trustworthy evidence"
      },
      {
        controlId: "SEC Item 106(b) — Risk assessment processes",
        evidencedBy: [
          "measured-exposure-validation",
          "attack-path-analysis",
          "fix-verification"
        ],
        title: "Assess, prioritize, and revalidate material cybersecurity risks"
      }
    ]
  },
  GDPRAttestation: {
    displayName: "Measured control evidence for GDPR (partial)",
    framework: "GDPRAttestation",
    controls: [
      {
        controlId: "GDPR Art. 32(1)(d) — Regular testing",
        evidencedBy: ["measured-exposure-validation", "control-detection-validation"],
        title: "Test, assess, and evaluate the effectiveness of security measures"
      },
      {
        controlId: "GDPR Art. 32(1)(b) — Confidentiality & integrity",
        evidencedBy: ["evidence-integrity", "fix-verification"],
        title: "Ensure ongoing confidentiality and integrity"
      },
      // Slice B expansions — technical measures support only; not a DPA or certification.
      {
        controlId: "GDPR Art. 32(1)(c) — Resilience & restore",
        evidencedBy: ["fix-verification", "continuous-validation"],
        title: "Restore availability and access after an incident with revalidation"
      },
      {
        controlId: "GDPR Art. 32(2) — Risk-appropriate security",
        evidencedBy: ["measured-exposure-validation", "attack-path-analysis"],
        title: "Account for risks from accidental or unlawful destruction or access"
      },
      {
        controlId: "GDPR Art. 5(1)(f) — Integrity and confidentiality principle",
        evidencedBy: [
          "evidence-integrity",
          "control-detection-validation",
          "measured-exposure-validation"
        ],
        title: "Process personal data with integrity-backed security measures"
      }
    ]
  },
  EUAiActAttestation: {
    displayName: "Measured control evidence for EU AI Act (partial)",
    framework: "EUAiActAttestation",
    controls: [
      {
        controlId: "EU AI Act Art. 15 — Accuracy, robustness, cybersecurity",
        evidencedBy: ["ai-control-validation"],
        title: "High-risk AI systems resilient to attempts to alter use/behaviour"
      },
      {
        controlId: "EU AI Act Art. 9 — Risk management system",
        evidencedBy: ["ai-control-validation", "continuous-validation"],
        title: "Continuous, iterative AI risk management"
      },
      // Slice B expansions — measured AI control evidence only; not a conformity assessment.
      {
        controlId: "EU AI Act Art. 14 — Human oversight",
        evidencedBy: ["ai-control-validation", "evidence-integrity"],
        title: "Enable effective human oversight with integrity-backed evidence"
      },
      {
        controlId: "EU AI Act Art. 12 — Record-keeping",
        evidencedBy: ["evidence-integrity", "continuous-validation"],
        title: "Automatic logging of events over the lifetime of the high-risk system"
      },
      {
        controlId: "EU AI Act Art. 15(5) — Cybersecurity measures",
        evidencedBy: [
          "ai-control-validation",
          "measured-exposure-validation",
          "fix-verification"
        ],
        title: "Technical solutions for AI cybersecurity with revalidation after fix"
      }
    ]
  },
  ISO42001Attestation: {
    displayName:
      "Measured control evidence for ISO/IEC 42001 (AI management system) (partial)",
    framework: "ISO42001Attestation",
    controls: [
      {
        controlId: "ISO 42001 A.6.2 — AI system impact assessment",
        evidencedBy: ["ai-control-validation"],
        title: "Assess AI system risks and impacts"
      },
      {
        controlId: "ISO 42001 A.8.3 — AI system security",
        evidencedBy: ["ai-control-validation", "evidence-integrity"],
        title: "Security controls over the AI system lifecycle"
      },
      // Slice B expansions — AIMS support evidence only; not an accredited certification.
      {
        controlId: "ISO 42001 A.6.1.2 — AI risk assessment",
        evidencedBy: ["ai-control-validation", "attack-path-analysis"],
        title: "Identify and assess AI-related risks with measured controls"
      },
      {
        controlId: "ISO 42001 A.8.4 — AI system performance",
        evidencedBy: ["ai-control-validation", "continuous-validation"],
        title: "Monitor AI system performance and revalidate continuously"
      },
      {
        controlId: "ISO 42001 A.9.2 — Internal audit (AI MS support)",
        evidencedBy: [
          "evidence-integrity",
          "fix-verification",
          "ai-control-validation"
        ],
        title: "Support internal audit of AI controls with measured evidence"
      }
    ]
  },
  HIPAAAttestation: {
    displayName: "Measured control evidence for HIPAA Security Rule (partial)",
    framework: "HIPAAAttestation",
    controls: [
      {
        controlId: "45 CFR §164.308(a)(1)(ii)(A) — Risk analysis",
        evidencedBy: ["measured-exposure-validation", "attack-path-analysis"],
        title: "Assess risks and vulnerabilities to electronic protected health information"
      },
      {
        controlId: "45 CFR §164.308(a)(8) — Evaluation",
        evidencedBy: ["continuous-validation", "fix-verification"],
        title: "Perform periodic technical and nontechnical evaluation"
      },
      {
        controlId: "45 CFR §164.312(b) — Audit controls",
        evidencedBy: ["control-detection-validation", "evidence-integrity"],
        title: "Record and examine activity in systems containing ePHI"
      },
      // Slice B expansions — Security Rule technical safeguard support only.
      {
        controlId: "45 CFR §164.308(a)(6)(ii) — Response and reporting",
        evidencedBy: ["control-detection-validation", "fix-verification"],
        title: "Identify and respond to suspected or known security incidents"
      },
      {
        controlId: "45 CFR §164.312(a)(1) — Access control",
        evidencedBy: [
          "measured-exposure-validation",
          "attack-path-analysis",
          "control-detection-validation"
        ],
        title: "Implement technical policies to allow only authorized access to ePHI"
      },
      {
        controlId: "45 CFR §164.312(c)(1) — Integrity",
        evidencedBy: ["evidence-integrity", "fix-verification"],
        title: "Protect ePHI from improper alteration or destruction"
      },
      {
        controlId: "45 CFR §164.308(a)(1)(ii)(B) — Risk management",
        evidencedBy: [
          "measured-exposure-validation",
          "continuous-validation",
          "fix-verification"
        ],
        title: "Implement security measures to reduce risks to a reasonable level"
      }
    ]
  },
  SOC2Attestation: {
    displayName:
      "Customer SOC 2 support evidence (partial Trust Services Criteria — not vendor attestation)",
    framework: "SOC2Attestation",
    controls: [
      {
        controlId: "SOC 2 CC7.1 — Detection and monitoring",
        evidencedBy: ["control-detection-validation", "continuous-validation"],
        title: "Detect configuration changes and new vulnerabilities"
      },
      {
        controlId: "SOC 2 CC7.2 — Security event monitoring",
        evidencedBy: ["control-detection-validation"],
        title: "Monitor system components for anomalies and security events"
      },
      {
        controlId: "SOC 2 CC7.4 — Incident response",
        evidencedBy: ["attack-path-analysis", "fix-verification"],
        title: "Respond to identified security incidents and restore control"
      }
    ]
  },
  NISTCSFAttestation: {
    displayName:
      "Measured control evidence for NIST Cybersecurity Framework 2.0 (partial)",
    framework: "NISTCSFAttestation",
    controls: [
      {
        controlId: "NIST CSF 2.0 ID.RA-05 — Threats and vulnerabilities",
        evidencedBy: ["measured-exposure-validation", "attack-path-analysis"],
        title: "Understand, validate, and prioritize threats and vulnerabilities"
      },
      {
        controlId: "NIST CSF 2.0 DE.CM-01 — Network monitoring",
        evidencedBy: ["control-detection-validation", "continuous-validation"],
        title: "Monitor networks and services for adverse events"
      },
      {
        controlId: "NIST CSF 2.0 RS.MA-05 — Incident recovery",
        evidencedBy: ["fix-verification", "evidence-integrity"],
        title: "Verify incident recovery and preserve trustworthy evidence"
      }
    ]
  }
};

// Given which measured evidence kinds a tenant actually has, compute per-control
// coverage for a framework. Derived only — no control is "Met" without measured
// evidence backing it.
export function computeComplianceCoverage(
  framework: string,
  presentEvidence: ReadonlySet<ComplianceEvidenceKind> | ComplianceEvidenceKind[]
): ComplianceCoverageResult | null {
  const spec = COMPLIANCE_CATALOG[framework];
  if (!spec) {
    return null;
  }

  const present =
    presentEvidence instanceof Set
      ? presentEvidence
      : new Set(presentEvidence);

  const controls: ComplianceControlCoverage[] = spec.controls.map((control) => {
    const satisfiedBy = control.evidencedBy.filter((kind) => present.has(kind));
    const missing = control.evidencedBy.filter((kind) => !present.has(kind));
    const status: ComplianceControlStatus =
      satisfiedBy.length === 0
        ? "Unmet"
        : missing.length === 0
          ? "Met"
          : "Partial";

    return { ...control, missing, satisfiedBy, status };
  });

  const metCount = controls.filter((c) => c.status === "Met").length;
  const partialCount = controls.filter((c) => c.status === "Partial").length;
  const unmetCount = controls.filter((c) => c.status === "Unmet").length;

  return {
    controls,
    coverageRatio: controls.length > 0 ? metCount / controls.length : 0,
    displayName: spec.displayName,
    framework: spec.framework,
    metCount,
    partialCount,
    unmetCount
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

/**
 * Derive compliance primitives only from evidence already attached to a real
 * tenant snapshot. Optional continuous-validation and chain-integrity facts are
 * accepted separately because a snapshot alone cannot honestly prove either.
 */
export function deriveSnapshotComplianceEvidence(
  snapshot: ValidationSnapshot,
  options: SnapshotComplianceOptions = {}
): ComplianceEvidenceTrace[] {
  const evidence: ComplianceEvidenceTrace[] = [];
  const add = (
    kind: ComplianceEvidenceKind,
    evidenceIds: string[],
    validatedAt = snapshot.createdAt
  ) => {
    const uniqueEvidenceIds = unique(evidenceIds);
    if (uniqueEvidenceIds.length > 0) {
      evidence.push({ evidenceIds: uniqueEvidenceIds, kind, validatedAt });
    }
  };

  add(
    "measured-exposure-validation",
    snapshot.topAttackPaths
      .filter(({ attackPath }) => attackPath.evidenceBasis === "Measured")
      .flatMap(({ attackPath }) => attackPath.evidenceIds)
  );
  add(
    "attack-path-analysis",
    snapshot.topAttackPaths.flatMap(({ attackPath }) => attackPath.evidenceIds)
  );
  add(
    "control-detection-validation",
    snapshot.controlObservations.flatMap((signal) => signal.evidenceIds)
  );
  add(
    "ai-control-validation",
    snapshot.aiAppRisks.flatMap((signal) => signal.evidenceIds)
  );

  const measuredFixes = snapshot.remediationPriorities.filter(
    (remediation) => remediation.latestVerification?.measuredRevalidation === true
  );
  const fixValidatedAt = measuredFixes
    .map((remediation) => remediation.latestVerification?.verifiedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  add(
    "fix-verification",
    measuredFixes.flatMap((remediation) => remediation.evidenceIds),
    fixValidatedAt ?? snapshot.createdAt
  );

  if (options.continuousValidation) {
    add(
      "continuous-validation",
      options.continuousValidation.evidenceIds ?? snapshot.evidenceIds,
      options.continuousValidation.validatedAt
    );
  }
  if (options.evidenceIntegrity?.verified) {
    add(
      "evidence-integrity",
      options.evidenceIntegrity.evidenceIds ?? snapshot.evidenceIds,
      options.evidenceIntegrity.validatedAt
    );
  }

  return evidence;
}

export function computeSnapshotComplianceTrace(
  snapshot: ValidationSnapshot,
  framework: string,
  options: SnapshotComplianceOptions = {}
): ComplianceTraceResult | null {
  const evidence = deriveSnapshotComplianceEvidence(snapshot, options);
  const coverage = computeComplianceCoverage(
    framework,
    evidence.map((item) => item.kind)
  );
  if (!coverage) {
    return null;
  }

  return {
    ...coverage,
    controls: coverage.controls.map((control) => {
      const supportingEvidence = evidence.filter((item) =>
        control.satisfiedBy.includes(item.kind)
      );
      return {
        ...control,
        evidenceIds: unique(
          supportingEvidence.flatMap((item) => item.evidenceIds)
        ),
        lastValidatedAt:
          supportingEvidence
            .map((item) => item.validatedAt)
            .sort()
            .at(-1) ?? null
      };
    }),
    evidence
  };
}
