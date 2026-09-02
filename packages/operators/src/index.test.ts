import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  generateEvidenceGroundedSummary,
  generateOperatorRecommendations,
  listOperatorProfiles,
  type OperatorContext
} from "./index.js";

const timestamp = "2026-06-02T00:00:00.000Z";

function createContext(
  overrides: Partial<OperatorContext> = {}
): OperatorContext {
  const tenantId = randomUUID();
  const scopeId = randomUUID();
  const evidenceId = randomUUID();
  const pathId = randomUUID();

  return {
    aiAppCount: 1,
    aiAppRisks: [],
    attackPaths: [
      {
        attackPath: {
          confidence: 0.91,
          createdAt: timestamp,
          entryNodeId: randomUUID(),
          evidenceIds: [evidenceId],
          impactNodeId: randomUUID(),
          impactScore: 90,
          name: "Repository secret to production role",
          pathBreakers: [
            {
              createdAt: timestamp,
              description: "Rotate the exposed token.",
              evidenceIds: [evidenceId],
              pathBreakerId: randomUUID(),
              pathId,
              priority: 1,
              relatedNodeId: null,
              tenantId,
              title: "Rotate token",
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
          score: 91,
          summary: "Validated path with production impact."
        }
      }
    ],
    controlObservations: [
      {
        confidence: 0.8,
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        freshness: "Fresh",
        rawPayloadPointer: null,
        redactionStatus: "Redacted",
        relatedAssetIds: [],
        relatedControlIds: [],
        relatedEvidenceIds: [evidenceId],
        relatedIdentityIds: [],
        relatedPathIds: [],
        sensitivityLevel: "Moderate",
        signalCategory: "ControlObservation",
        signalId: randomUUID(),
        signalSubcategory: "Missed",
        sourceIntegrationId: null,
        sourceType: "mock.siem.observer",
        sourceVendor: "Periscan",
        techniqueIds: ["T1595"],
        tenantId,
        timestampIngested: timestamp,
        timestampObserved: timestamp,
        updatedAt: timestamp
      }
    ],
    controlSourceCount: 1,
    defaultTargetHostname: "app.example.com",
    evidenceArtifacts: [
      {
        artifactType: "NormalizedEvidence",
        createdAt: timestamp,
        evidenceId,
        redactionStatus: "Redacted",
        relatedEntityId: pathId,
        relatedEntityType: "AttackPath",
        sensitivityLevel: "Moderate",
        sha256: "abc123",
        storageUri: "memory://evidence.json",
        tenantId,
        updatedAt: timestamp
      }
    ],
    generatedAt: timestamp,
    integrationCount: 2,
    latestSnapshot: null,
    remediations: [
      {
        createdAt: timestamp,
        evidenceIds: [evidenceId],
        owner: "Security engineering",
        recommendedAction: "Rotate the exposed token.",
        relatedExposureId: null,
        relatedPathId: pathId,
        remediationId: randomUUID(),
        status: "Open",
        technicalSteps: ["Rotate the token"],
        tenantId,
        ticketId: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod: "Rerun validation.",
        verificationRequired: true
      }
    ],
    tenantId,
    verifiedScopeIds: [scopeId],
    ...overrides
  };
}

describe("Periscan operators", () => {
  it("lists the six PRD-defined operators", () => {
    expect(
      listOperatorProfiles().map((profile) => profile.operatorType)
    ).toEqual([
      "RedTeamOperator",
      "BlueTeamOperator",
      "ExposureOperator",
      "RemediationOperator",
      "EvidenceOperator",
      "AIAppSecurityOperator"
    ]);
  });

  it("generates evidence-citing recommendations without executing missions", () => {
    const recommendations = generateOperatorRecommendations(createContext());
    const redTeam = recommendations.find(
      (item) => item.operatorType === "RedTeamOperator"
    );
    const blueTeam = recommendations.find(
      (item) => item.operatorType === "BlueTeamOperator"
    );

    expect(redTeam?.evidenceIds.length).toBeGreaterThan(0);
    expect(redTeam?.missionPlan.approvalRequired).toBe(true);
    expect(redTeam?.missionPlan.missionType).toBe("ExposureValidation");
    expect(blueTeam?.missionPlan.executionEnvironment).toBe("InternalRunner");
    expect(recommendations.every((item) => item.evidenceIds.length > 0)).toBe(
      true
    );
    expect(
      recommendations.every((item) => item.missionPlan.approvalRequired)
    ).toBe(true);
    expect(
      recommendations.every((item) =>
        ["Low", "Medium", "High"].includes(item.uncertainty)
      )
    ).toBe(true);
  });

  it("marks recommendations not actionable when verified scope is absent", () => {
    const recommendations = generateOperatorRecommendations(
      createContext({
        verifiedScopeIds: []
      })
    );

    expect(
      recommendations.some((item) => item.status === "NotActionable")
    ).toBe(true);
    expect(
      recommendations
        .filter((item) => item.status === "NotActionable")
        .every((item) => item.missionPlan.scopeId === null)
    ).toBe(true);
  });

  it("does not invent proofless recommendations from configuration counts alone", () => {
    const recommendations = generateOperatorRecommendations(
      createContext({
        aiAppCount: 1,
        aiAppRisks: [],
        attackPaths: [],
        controlObservations: [],
        controlSourceCount: 1,
        evidenceArtifacts: [],
        latestSnapshot: null,
        remediations: [
          {
            ...createContext().remediations[0]!,
            evidenceIds: []
          }
        ]
      })
    );

    expect(recommendations).toHaveLength(0);
  });

  it("generates summaries only from supplied evidence IDs", () => {
    const context = createContext();
    const summary = generateEvidenceGroundedSummary({
      artifacts: context.evidenceArtifacts,
      generatedAt: timestamp,
      useCase: "ExecutiveSummary"
    });

    expect(summary.summary).toContain("1 normalized evidence artifact");
    expect(summary.claims[0]?.evidenceIds).toEqual([
      context.evidenceArtifacts[0]?.evidenceId
    ]);
    expect(JSON.stringify(summary)).not.toContain("secret");

    const insufficient = generateEvidenceGroundedSummary({
      artifacts: [],
      generatedAt: timestamp,
      useCase: "AttackPathExplanation"
    });

    expect(insufficient.claims).toHaveLength(0);
    expect(insufficient.warnings[0]).toMatch(/No tenant-authorized evidence/i);
  });
});
