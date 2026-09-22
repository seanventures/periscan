import {
  SnapshotComplianceCoverageSchema,
  createPublicDemoValidationSnapshot
} from "@periscan/shared";
import { describe, expect, it } from "vitest";

import { buildSnapshotComplianceCoverage } from "./compliance-catalog.js";

function stripMeasuredEvidence() {
  const snapshot = createPublicDemoValidationSnapshot();
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
  return snapshot;
}

describe("SOC2 snapshot compliance coverage", () => {
  it("returns NotConfigured without inventing Met when no snapshot exists", () => {
    const coverage = buildSnapshotComplianceCoverage({
      framework: "SOC2Attestation",
      snapshot: null
    });

    expect(coverage.configured).toBe(false);
    expect(coverage.framework).toBe("SOC2Attestation");
    expect(coverage.notCertification).toBe(true);
    expect(coverage.metCount).toBe(0);
    expect(coverage.controls).toEqual([]);
    expect(coverage.snapshotId).toBeNull();
    expect(coverage.disclaimer).toMatch(/not a certification/i);
    expect(JSON.stringify(coverage).toLowerCase()).not.toMatch(/certified/);
    expect(SnapshotComplianceCoverageSchema.parse(coverage).configured).toBe(
      false
    );
  });

  it("marks every SOC 2 CC* control Unmet when the snapshot has no measured evidence", () => {
    const coverage = buildSnapshotComplianceCoverage({
      framework: "SOC2Attestation",
      snapshot: stripMeasuredEvidence()
    });

    expect(coverage.configured).toBe(true);
    expect(coverage.notCertification).toBe(true);
    expect(coverage.metCount).toBe(0);
    expect(coverage.unmetCount).toBe(coverage.controls.length);
    expect(coverage.controls.map((control) => control.controlId)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/CC7\.1/),
        expect.stringMatching(/CC7\.2/),
        expect.stringMatching(/CC7\.4/)
      ])
    );
    for (const control of coverage.controls) {
      expect(control.status).toBe("Unmet");
      expect(control.satisfiedBy).toEqual([]);
      expect(control.evidenceIds).toEqual([]);
      expect(control.missing.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(coverage).toLowerCase()).not.toMatch(/certified/);
  });

  it("derives Met/Partial/Unmet for CC* rows from measured evidence kinds only", () => {
    const snapshot = stripMeasuredEvidence();
    snapshot.controlObservations = [
      createPublicDemoValidationSnapshot().controlObservations[0]!
    ];

    const coverage = buildSnapshotComplianceCoverage({
      framework: "SOC2Attestation",
      snapshot
    });

    const cc71 = coverage.controls.find((control) =>
      control.controlId.includes("CC7.1")
    );
    const cc72 = coverage.controls.find((control) =>
      control.controlId.includes("CC7.2")
    );
    const cc74 = coverage.controls.find((control) =>
      control.controlId.includes("CC7.4")
    );

    expect(cc72?.status).toBe("Met");
    expect(cc72?.satisfiedBy).toEqual(["control-detection-validation"]);
    expect(cc72?.missing).toEqual([]);
    expect(cc72?.evidenceIds.length).toBeGreaterThan(0);

    expect(cc71?.status).toBe("Partial");
    expect(cc71?.satisfiedBy).toContain("control-detection-validation");
    expect(cc71?.missing).toContain("continuous-validation");

    expect(cc74?.status).toBe("Unmet");
    expect(cc74?.satisfiedBy).toEqual([]);
    expect(cc74?.evidenceIds).toEqual([]);
  });

  it("does not promote CC7.1 to Met without continuous-validation evidence", () => {
    const snapshot = createPublicDemoValidationSnapshot();
    const withoutContinuous = buildSnapshotComplianceCoverage({
      framework: "SOC2Attestation",
      snapshot
    });
    const cc71 = withoutContinuous.controls.find((control) =>
      control.controlId.includes("CC7.1")
    );
    expect(cc71?.status).not.toBe("Met");
    expect(cc71?.missing).toContain("continuous-validation");

    const withContinuous = buildSnapshotComplianceCoverage({
      framework: "SOC2Attestation",
      options: {
        continuousValidation: {
          evidenceIds: snapshot.evidenceIds,
          validatedAt: snapshot.createdAt
        }
      },
      snapshot
    });
    const metCc71 = withContinuous.controls.find((control) =>
      control.controlId.includes("CC7.1")
    );
    expect(metCc71?.status).toBe("Met");
    expect(metCc71?.missing).toEqual([]);
    expect(metCc71?.evidenceIds.length).toBeGreaterThan(0);
  });
});
