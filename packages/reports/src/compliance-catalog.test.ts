import { describe, expect, it } from "vitest";

import {
  COMPLIANCE_CATALOG,
  COMPLIANCE_CATALOG_VERSIONS,
  COMPLIANCE_PACK_DISCLAIMER,
  COMPLIANCE_PACK_DISCLAIMER_SHORT,
  COMPLIANCE_PACK_TYPES,
  computeComplianceCoverage,
  computeSnapshotComplianceTrace,
  deriveSnapshotComplianceEvidence
} from "./compliance-catalog";
import { createPublicDemoValidationSnapshot } from "@periscan/shared";

describe("compliance control catalog", () => {
  it("covers all 11 attestation frameworks with real, evidence-mapped controls", () => {
    const frameworks = Object.keys(COMPLIANCE_CATALOG);
    expect(frameworks).toHaveLength(11);
    expect(COMPLIANCE_PACK_TYPES).toHaveLength(11);
    for (const pack of COMPLIANCE_PACK_TYPES) {
      expect(COMPLIANCE_CATALOG[pack]).toBeDefined();
      expect(COMPLIANCE_CATALOG_VERSIONS[pack]).toBeDefined();
    }
    for (const spec of Object.values(COMPLIANCE_CATALOG)) {
      expect(spec.controls.length).toBeGreaterThan(0);
      for (const control of spec.controls) {
        expect(control.evidencedBy.length).toBeGreaterThan(0);
      }
    }
  });

  it("exports the Wave G2 disclaimer with not certification / not audit opinion", () => {
    expect(COMPLIANCE_PACK_DISCLAIMER).toMatch(/not a certification/i);
    expect(COMPLIANCE_PACK_DISCLAIMER).toMatch(/not an audit opinion/i);
    expect(COMPLIANCE_PACK_DISCLAIMER).toMatch(/partial catalog/i);
    expect(COMPLIANCE_PACK_DISCLAIMER_SHORT).toMatch(/not certification/i);
    expect(COMPLIANCE_PACK_DISCLAIMER_SHORT).toMatch(/not an audit opinion/i);
  });

  it("keeps DORA/NIS2/PCI display names honest about partial coverage", () => {
    for (const key of [
      "DORAAttestation",
      "NIS2Attestation",
      "PCIDSSAttestation"
    ] as const) {
      expect(COMPLIANCE_CATALOG[key].displayName).toMatch(/partial/i);
      expect(COMPLIANCE_CATALOG_VERSIONS[key].catalogVersion).toBe(
        "periscan-2026.07.s3"
      );
    }
  });

  it("keeps Slice B SEC/HIPAA/ISO/GDPR/AI Act/42001 catalogs partial and versioned", () => {
    for (const key of [
      "SECAttestation",
      "HIPAAAttestation",
      "ISO27001Attestation",
      "GDPRAttestation",
      "EUAiActAttestation",
      "ISO42001Attestation"
    ] as const) {
      expect(COMPLIANCE_CATALOG[key].displayName).toMatch(/partial/i);
      expect(COMPLIANCE_CATALOG_VERSIONS[key].catalogVersion).toBe(
        "periscan-2026.08.slice-b"
      );
      expect(COMPLIANCE_CATALOG[key].controls.length).toBeGreaterThanOrEqual(5);
      for (const control of COMPLIANCE_CATALOG[key].controls) {
        expect(control.evidencedBy.length).toBeGreaterThan(0);
        for (const kind of control.evidencedBy) {
          expect([
            "measured-exposure-validation",
            "control-detection-validation",
            "fix-verification",
            "ai-control-validation",
            "attack-path-analysis",
            "continuous-validation",
            "evidence-integrity"
          ]).toContain(kind);
        }
      }
    }
  });

  it("includes Swarm S3 representative DORA/NIS2/PCI control expansions", () => {
    const dora = COMPLIANCE_CATALOG.DORAAttestation;
    const nis2 = COMPLIANCE_CATALOG.NIS2Attestation;
    const pci = COMPLIANCE_CATALOG.PCIDSSAttestation;

    expect(dora.controls.length).toBeGreaterThanOrEqual(7);
    expect(dora.controls.some((c) => c.controlId.includes("Art. 11"))).toBe(
      true
    );
    expect(dora.controls.some((c) => c.controlId.includes("Art. 8"))).toBe(
      true
    );
    expect(dora.controls.some((c) => c.controlId.includes("Art. 10"))).toBe(
      true
    );
    expect(dora.controls.some((c) => c.controlId.includes("Art. 13"))).toBe(
      true
    );

    expect(nis2.controls.length).toBeGreaterThanOrEqual(5);
    expect(
      nis2.controls.some((c) => c.controlId.includes("21(2)(c)"))
    ).toBe(true);
    expect(
      nis2.controls.some((c) => c.controlId.includes("21(2)(d)"))
    ).toBe(true);
    expect(
      nis2.controls.some((c) => c.controlId.includes("21(2)(e)"))
    ).toBe(true);

    expect(pci.controls.length).toBeGreaterThanOrEqual(6);
    expect(pci.controls.some((c) => c.controlId.includes("12.10"))).toBe(true);
    expect(pci.controls.some((c) => c.controlId.includes("6.3"))).toBe(true);
    expect(pci.controls.some((c) => c.controlId.includes("11.5.1"))).toBe(true);
    expect(pci.controls.some((c) => c.controlId.includes("Req. 2.2"))).toBe(
      true
    );

    expect(
      dora.controls.find((c) => c.controlId.includes("Art. 11"))?.evidencedBy
    ).toEqual(
      expect.arrayContaining(["fix-verification", "continuous-validation"])
    );
    expect(
      pci.controls.find((c) => c.controlId.includes("12.10"))?.evidencedBy
    ).toEqual(
      expect.arrayContaining([
        "control-detection-validation",
        "fix-verification",
        "evidence-integrity"
      ])
    );
  });

  it("includes Slice B SEC/HIPAA/ISO/GDPR/AI Act/42001 control expansions", () => {
    const sec = COMPLIANCE_CATALOG.SECAttestation;
    const hipaa = COMPLIANCE_CATALOG.HIPAAAttestation;
    const iso27 = COMPLIANCE_CATALOG.ISO27001Attestation;
    const gdpr = COMPLIANCE_CATALOG.GDPRAttestation;
    const aiAct = COMPLIANCE_CATALOG.EUAiActAttestation;
    const iso42 = COMPLIANCE_CATALOG.ISO42001Attestation;

    expect(sec.controls.some((c) => c.controlId.includes("Item 106(c)"))).toBe(
      true
    );
    expect(sec.controls.some((c) => c.controlId.includes("Item 1.05"))).toBe(
      true
    );
    expect(
      hipaa.controls.some((c) => c.controlId.includes("164.308(a)(6)"))
    ).toBe(true);
    expect(
      hipaa.controls.some((c) => c.controlId.includes("164.312(a)(1)"))
    ).toBe(true);
    expect(iso27.controls.some((c) => c.controlId.includes("A.8.7"))).toBe(
      true
    );
    expect(iso27.controls.some((c) => c.controlId.includes("A.5.26"))).toBe(
      true
    );
    expect(gdpr.controls.some((c) => c.controlId.includes("32(1)(c)"))).toBe(
      true
    );
    expect(gdpr.controls.some((c) => c.controlId.includes("Art. 5(1)(f)"))).toBe(
      true
    );
    expect(aiAct.controls.some((c) => c.controlId.includes("Art. 14"))).toBe(
      true
    );
    expect(aiAct.controls.some((c) => c.controlId.includes("Art. 12"))).toBe(
      true
    );
    expect(iso42.controls.some((c) => c.controlId.includes("A.6.1.2"))).toBe(
      true
    );
    expect(iso42.controls.some((c) => c.controlId.includes("A.9.2"))).toBe(
      true
    );

    // Partial honesty: Met only when every required kind is present.
    const empty = computeComplianceCoverage("HIPAAAttestation", []);
    expect(empty?.metCount).toBe(0);
    expect(empty?.controls.every((c) => c.status === "Unmet")).toBe(true);

    const partial = computeComplianceCoverage("SECAttestation", [
      "measured-exposure-validation"
    ]);
    const risk = partial?.controls.find((c) =>
      c.controlId.includes("Item 106(b) — Risk management")
    );
    expect(risk?.status).toBe("Partial");
    expect(risk?.missing).toContain("continuous-validation");
  });

  it("derives Met only when every required measured evidence kind is present", () => {
    // PCI Req 11.3 needs measured-exposure-validation + fix-verification.
    // Req 12.10 also needs evidence-integrity for full Met.
    // Req 11.5.1 needs continuous-validation — absent here → Partial/Unmet, not Met.
    const full = computeComplianceCoverage("PCIDSSAttestation", [
      "measured-exposure-validation",
      "fix-verification",
      "attack-path-analysis",
      "control-detection-validation",
      "evidence-integrity"
    ]);
    const req113 = full?.controls.find((c) => c.controlId.includes("11.3"));
    expect(req113?.status).toBe("Met");
    expect(req113?.satisfiedBy.length).toBeGreaterThan(0);
    expect(req113?.missing).toEqual([]);

    const req22 = full?.controls.find((c) => c.controlId.includes("Req. 2.2"));
    expect(req22?.status).toBe("Met");

    const req1210 = full?.controls.find((c) => c.controlId.includes("12.10"));
    expect(req1210?.status).toBe("Met");

    const req1151 = full?.controls.find((c) => c.controlId.includes("11.5.1"));
    expect(req1151?.status).toBe("Partial");
    expect(req1151?.missing).toContain("continuous-validation");

    // Every Met control must have zero missing kinds.
    for (const control of full?.controls ?? []) {
      if (control.status === "Met") {
        expect(control.missing).toEqual([]);
        expect(control.satisfiedBy.length).toBeGreaterThan(0);
      }
    }

    const empty = computeComplianceCoverage("PCIDSSAttestation", []);
    expect(empty?.metCount).toBe(0);
    expect(empty?.controls.every((c) => c.status === "Unmet")).toBe(true);
  });

  it("marks a control Partial when only some evidence is present, Unmet when none", () => {
    const partial = computeComplianceCoverage("PCIDSSAttestation", [
      "measured-exposure-validation"
    ]);
    const req113 = partial?.controls.find((c) => c.controlId.includes("11.3"));
    expect(req113?.status).toBe("Partial");
    expect(req113?.missing).toContain("fix-verification");

    // Req 10 needs control-detection-validation, which is absent → Unmet.
    const req10 = partial?.controls.find((c) =>
      c.controlId.includes("Req. 10")
    );
    expect(req10?.status).toBe("Unmet");

    // Req 2.2 only needs measured-exposure → Met with this single kind.
    const req22 = partial?.controls.find((c) =>
      c.controlId.includes("Req. 2.2")
    );
    expect(req22?.status).toBe("Met");
  });

  it("returns null for an unknown framework", () => {
    expect(computeComplianceCoverage("NopeAttestation", [])).toBeNull();
  });

  it("traces each supported control back to snapshot evidence and validation time", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const evidenceId = snapshot.evidenceIds[0]!;
    snapshot.controlObservations[0]!.evidenceIds = [evidenceId];

    const trace = computeSnapshotComplianceTrace(snapshot, "SOC2Attestation", {
      evidenceIntegrity: {
        evidenceIds: [evidenceId],
        validatedAt: snapshot.createdAt,
        verified: true
      }
    });

    expect(trace?.displayName).toBe(
      "Customer SOC 2 support evidence (partial Trust Services Criteria — not vendor attestation)"
    );
    expect(trace?.controls.some((control) => control.evidenceIds.length > 0)).toBe(
      true
    );
    expect(trace?.controls.find((control) => control.evidenceIds.length > 0))
      .toMatchObject({ lastValidatedAt: snapshot.createdAt });
  });

  it("never invents Met kinds from a snapshot without attached measured evidence", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    // Strip measured attack-path evidence, control observations, AI risks, and fixes.
    snapshot.topAttackPaths = snapshot.topAttackPaths.map((entry) => ({
      ...entry,
      attackPath: {
        ...entry.attackPath,
        evidenceBasis: "Heuristic" as const,
        evidenceIds: []
      }
    }));
    snapshot.controlObservations = [];
    snapshot.aiAppRisks = [];
    snapshot.remediationPriorities = snapshot.remediationPriorities.map(
      (remediation) => ({
        ...remediation,
        evidenceIds: [],
        latestVerification: null
      })
    );

    const kinds = deriveSnapshotComplianceEvidence(snapshot);
    // Heuristic paths still contribute attack-path-analysis only when evidenceIds exist.
    // With empty evidenceIds, no kind is present → no Met.
    expect(kinds.every((item) => item.evidenceIds.length > 0)).toBe(true);

    const dora = computeSnapshotComplianceTrace(snapshot, "DORAAttestation");
    expect(dora?.metCount).toBe(0);
    for (const control of dora?.controls ?? []) {
      expect(control.status).not.toBe("Met");
      if (control.status === "Unmet") {
        expect(control.evidenceIds).toEqual([]);
      }
    }
  });
});
