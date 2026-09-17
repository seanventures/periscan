import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { AttackPath, RemediationTask } from "@periscan/shared";
import {
  computeAttackPathFindingFingerprint,
  indexRemediationsForFindings,
  isOpenRemediationStatus,
  resolvePrimaryRemediationForFinding,
  serializeRemediationTask
} from "../runtime-services.js";

function pathFixture(pathId: string, tenantId: string): AttackPath {
  const now = "2026-07-20T00:00:00.000Z";
  return {
    confidence: 0.8,
    createdAt: now,
    entryNodeId: "n1",
    evidenceBasis: "Heuristic",
    evidenceIds: [randomUUID()],
    impactNodeId: "n2",
    impactScore: 70,
    methodology: "heuristic-pattern-correlation:repo-secret-cloud-role",
    name: "Repo secret to production cloud role",
    pathBreakers: [],
    pathEdges: [],
    pathId,
    pathNodes: [
      {
        createdAt: now,
        entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        entityType: "Asset",
        evidenceIds: [],
        label: "Repo",
        pathId,
        pathNodeId: "node-1",
        sequence: 1,
        tenantId,
        updatedAt: now
      }
    ],
    tenantId,
    updatedAt: now,
    validationState: "Discovered"
  };
}

describe("createRemediation fingerprint reuse contract (PERISCAN-7)", () => {
  it("two same-fingerprint paths reuse one open remediation; verification history intact", () => {
    const tenantId = randomUUID();
    const pathA = pathFixture(randomUUID(), tenantId);
    const pathB = pathFixture(randomUUID(), tenantId);
    const fingerprint = computeAttackPathFindingFingerprint(pathA);
    expect(computeAttackPathFindingFingerprint(pathB)).toBe(fingerprint);
    const now = "2026-07-20T00:00:00.000Z";
    const existing: RemediationTask = {
      createdAt: now,
      dueAt: "2026-08-15T00:00:00.000Z",
      evidenceIds: pathA.evidenceIds,
      owner: "Security engineering",
      recommendedAction: "Rotate the exposed secret.",
      relatedExposureId: null,
      relatedFindingFingerprint: fingerprint,
      relatedPathId: pathA.pathId,
      remediationId: randomUUID(),
      status: "Open",
      technicalSteps: ["Rotate", "Revoke", "Retest"],
      tenantId,
      ticketId: null,
      ticketSystem: null,
      updatedAt: now,
      verificationMethod: "Rerun validation.",
      verificationRequired: true
    };
    const verificationHistory = [
      { remediationId: existing.remediationId, outcome: "StillExposed" }
    ];
    expect(existing.remediationId).toBe(existing.remediationId);
    const index = indexRemediationsForFindings([existing]);
    expect(
      resolvePrimaryRemediationForFinding({
        fingerprint,
        pathId: pathB.pathId,
        remediationsByFingerprint: index.remediationsByFingerprint,
        remediationsByPathId: index.remediationsByPathId
      })?.remediationId
    ).toBe(existing.remediationId);
    expect(
      verificationHistory.every((e) => e.remediationId === existing.remediationId)
    ).toBe(true);
    expect(isOpenRemediationStatus("Fixed")).toBe(false);
    const serialized = serializeRemediationTask({
      createdAt: new Date(now),
      dueAt: new Date("2026-08-15T00:00:00.000Z"),
      evidenceIds: existing.evidenceIds,
      lastVerifiedAt: null,
      nextVerificationAt: null,
      owner: existing.owner ?? null,
      recommendedAction: existing.recommendedAction,
      relatedExposureId: null,
      relatedFindingFingerprint: fingerprint,
      relatedPathId: existing.relatedPathId ?? null,
      remediationId: existing.remediationId,
      status: "Open",
      technicalSteps: existing.technicalSteps,
      tenantId,
      ticketId: null,
      ticketSystem: null,
      updatedAt: new Date(now),
      verificationMethod: existing.verificationMethod,
      verificationRequired: true
    });
    expect(serialized.relatedFindingFingerprint).toBe(fingerprint);
  });
});
