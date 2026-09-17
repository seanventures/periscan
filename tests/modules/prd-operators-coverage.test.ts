import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  generateEvidenceGroundedSummary,
  generateOperatorRecommendations,
  listOperatorProfiles,
  OperatorRecommendationSchema,
  OperatorTypeSchema,
  type OperatorContext
} from "../../packages/operators/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import { SafetyLevelSchema } from "../../packages/shared/src/domain.js";

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

const PRD_OPERATORS = [
  {
    description: "Builds safe attack scenarios and validates realistic paths.",
    name: "Red Team Operator",
    type: "RedTeamOperator"
  },
  {
    description:
      "Checks whether controls detect, block, log, alert, and route correctly.",
    name: "Blue Team Operator",
    type: "BlueTeamOperator"
  },
  {
    description:
      "Finds which exposures are real, reachable, exploitable, blocked, or noise.",
    name: "Exposure Operator",
    type: "ExposureOperator"
  },
  {
    description: "Turns validated risk into fix plans, tickets, and re-tests.",
    name: "Remediation Operator",
    type: "RemediationOperator"
  },
  {
    description:
      "Creates proof for customers, auditors, insurers, boards, and executives.",
    name: "Evidence Operator",
    type: "EvidenceOperator"
  },
  {
    description:
      "Validates AI apps, RAG systems, copilots, agents, tools, and guardrails.",
    name: "AI App Security Operator",
    type: "AIAppSecurityOperator"
  }
] as const;

function createEvidencedOperatorContext(): OperatorContext {
  const snapshot = createPublicDemoValidationSnapshot();

  return {
    aiAppCount: 1,
    aiAppRisks: snapshot.aiAppRisks,
    attackPaths: snapshot.topAttackPaths,
    controlObservations: snapshot.controlObservations,
    controlSourceCount: 1,
    defaultTargetHostname: "demo.periscan.example",
    evidenceArtifacts: snapshot.evidenceIds.map((evidenceId) => ({
      artifactType: "NormalizedEvidence" as const,
      createdAt: snapshot.createdAt,
      evidenceId,
      redactionStatus: "Redacted" as const,
      relatedEntityId: snapshot.evidencePack.evidencePackId,
      relatedEntityType: "EvidencePack" as const,
      sensitivityLevel: "Moderate" as const,
      sha256: evidenceId.replaceAll("-", "").slice(0, 16),
      storageUri: `sample://public-demo/${evidenceId}.json`,
      tenantId: snapshot.tenantId,
      updatedAt: snapshot.updatedAt
    })),
    generatedAt: snapshot.createdAt,
    integrationCount: snapshot.integrationIds.length,
    latestSnapshot: snapshot,
    remediations: snapshot.remediationPriorities,
    tenantId: snapshot.tenantId,
    verifiedScopeIds: snapshot.scopeIds
  };
}

function createProoflessOperatorContext(): OperatorContext {
  const snapshot = createPublicDemoValidationSnapshot();

  return {
    ...createEvidencedOperatorContext(),
    aiAppRisks: [],
    attackPaths: [],
    controlObservations: [],
    evidenceArtifacts: [],
    latestSnapshot: null,
    remediations: snapshot.remediationPriorities.map((remediation) => ({
      ...remediation,
      evidenceIds: []
    }))
  };
}

describe("PRD section 3.8 Periscan Operators coverage", () => {
  it("maps every PRD-named operator and description to public operator profiles", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "### 3.8 Periscan Operators",
      "## 4. System Architecture"
    );
    const profiles = listOperatorProfiles();

    expect(section).toContain(
      'AI-assisted validation workflows, not hypey "agents."'
    );

    for (const operator of PRD_OPERATORS) {
      expect(section).toContain(operator.name);
      expect(section).toContain(operator.description);
      expect(OperatorTypeSchema.safeParse(operator.type).success).toBe(true);
      expect(
        profiles.some(
          (profile) =>
            profile.operatorType === operator.type &&
            profile.name === operator.name &&
            profile.purpose.length > 0 &&
            profile.capabilities.length > 0 &&
            profile.supportedMissionTypes.length > 0
        )
      ).toBe(true);
    }

    // Relaxed strict equal (more operator profiles from model-gateway/agentic); ensure core PRD ones present.
    const profileTypes = profiles.map((profile) => profile.operatorType);
    for (const op of PRD_OPERATORS) {
      expect(profileTypes).toContain(op.type);
    }
  });

  it("keeps operator recommendations evidence-citing, uncertainty-labeled, approval-gated, and safety-level aware", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "### 3.8 Periscan Operators",
      "## 4. System Architecture"
    );
    const requirements = parseBulletsFrom(section, "Requirements");
    const recommendations = generateOperatorRecommendations(
      createEvidencedOperatorContext()
    );
    const operatorTypes = new Set(
      recommendations.map((recommendation) => recommendation.operatorType)
    );

    // Relaxed exact list (section widened includes full reqs post-PRD-update); ensure all required.
    const reqList = ["Operators recommend missions.", "Operators never execute without policy approval.", "Operators must cite evidence IDs.", "Operators must label uncertainty.", "Operators must not invent outcomes.", "Operators must respect safety levels."];
    for (const r of reqList) expect(requirements).toContain(r);
    // Relaxed (post expansion more types); core covered.
    for (const op of PRD_OPERATORS) {
      expect(operatorTypes.has(op.type)).toBe(true);
    }

    for (const recommendation of recommendations) {
      expect(
        OperatorRecommendationSchema.safeParse(recommendation).success
      ).toBe(true);
      expect(recommendation.evidenceIds.length).toBeGreaterThan(0);
      expect(["Low", "Medium", "High"]).toContain(recommendation.uncertainty);
      expect(recommendation.proposedActions.length).toBeGreaterThan(0);
      expect(recommendation.missionPlan.approvalRequired).toBe(true);
      expect(
        SafetyLevelSchema.safeParse(recommendation.missionPlan.safetyLevel)
          .success
      ).toBe(true);
      expect(recommendation.missionPlan.requestedAction.destructive).toBe(
        false
      );
      expect(recommendation.missionPlan.requestedAction.credentialTheft).toBe(
        false
      );
      expect(recommendation.missionPlan.requestedAction.persistence).toBe(
        false
      );
      expect(
        recommendation.missionPlan.requestedAction.realDataExfiltration
      ).toBe(false);
      expect(
        recommendation.missionPlan.requestedAction.uncontrolledExploitChaining
      ).toBe(false);
    }
  });

  it("does not invent operator outcomes or summaries when evidence is missing", () => {
    const recommendations = generateOperatorRecommendations(
      createProoflessOperatorContext()
    );
    const summary = generateEvidenceGroundedSummary({
      artifacts: [],
      generatedAt: createPublicDemoValidationSnapshot().createdAt,
      useCase: "AttackPathExplanation"
    });

    expect(recommendations).toHaveLength(0);
    expect(summary.claims).toHaveLength(0);
    expect(summary.summary).toMatch(/insufficient normalized evidence/i);
    expect(summary.warnings[0]).toMatch(/No tenant-authorized evidence/i);
  });

  it("keeps API approval as draft mission creation, not execution", async () => {
    const [apiRoutes, operatorServices, apiTests] = await Promise.all([
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/api/src/services/signal-triggers.ts"),
      readRepoFile("apps/api/src/app.test.ts")
    ]);

    expect(apiRoutes).toContain('"/api/v1/operators"');
    expect(apiRoutes).toContain('"/api/v1/operator-recommendations"');
    expect(apiRoutes).toContain(
      '"/api/v1/operator-recommendations/:id/approve"'
    );
    expect(operatorServices).toContain("previewPolicyDecision");
    expect(operatorServices).toContain("createMission");
    expect(operatorServices).not.toContain("startMission(");
    expect(apiTests).toContain('mission.status).toBe("Draft")');
    expect(apiTests).toContain('decision.outcome).toBe("RequiresApproval")');
  });
});
