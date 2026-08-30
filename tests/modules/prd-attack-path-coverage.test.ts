import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildScheduleDiff } from "../../apps/api/src/schedule-diff.js";
import { correlateAttackPathsFromSignals } from "../../packages/evidence/src/correlation.js";
import { assessAttackPathRisk } from "../../packages/evidence/src/risk.js";
import {
  executeModuleById,
  getModuleById,
  ModuleExecutionContextSchema
} from "../../packages/modules/src/index.js";
import {
  renderValidationSnapshotReportHtml,
  renderValidationSnapshotReportPdf
} from "../../packages/reports/src/index.js";
import { createPublicDemoValidationSnapshot } from "../../packages/shared/src/demo-snapshot.js";
import {
  AttackPathSchema,
  PathBreakerSchema,
  PathEdgeSchema,
  PathNodeSchema,
  RemediationTaskSchema,
  type SignalEnvelope,
  type ValidationSnapshot
} from "../../packages/shared/src/domain.js";
import { mapAttackTechniqueIds } from "../../packages/shared/src/mitre-attack.js";

async function readRepoFile(repoPath: string) {
  return readFile(new URL(`../../${repoPath}`, import.meta.url), "utf8");
}

function sectionBetween(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

function parseBulletsBetween(source: string, start: string, end: string) {
  return sectionBetween(source, start, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function createSignal(
  input: Pick<SignalEnvelope, "signalCategory" | "signalSubcategory"> & {
    confidence?: number;
    evidenceIds?: string[];
    relatedAssetIds?: string[];
    relatedControlIds?: string[];
    sourceType?: string;
    sourceVendor?: string;
    techniqueIds?: string[];
  }
): SignalEnvelope {
  const timestamp = "2026-06-28T00:00:00.000Z";

  return {
    confidence: input.confidence ?? 0.86,
    createdAt: timestamp,
    evidenceIds: input.evidenceIds ?? [randomUUID()],
    freshness: "Fresh",
    rawPayloadPointer: null,
    redactionStatus: "Redacted",
    relatedAssetIds: input.relatedAssetIds ?? [],
    relatedControlIds: input.relatedControlIds ?? [],
    relatedEvidenceIds: input.evidenceIds ?? [],
    relatedIdentityIds: [],
    relatedPathIds: [],
    sensitivityLevel: "Moderate",
    signalCategory: input.signalCategory,
    signalId: randomUUID(),
    signalSubcategory: input.signalSubcategory,
    sourceIntegrationId: null,
    sourceRunnerId: null,
    sourceType:
      input.sourceType ?? `fixture.${input.signalCategory.toLowerCase()}`,
    sourceVendor: input.sourceVendor ?? "Periscan",
    techniqueIds: input.techniqueIds,
    tenantId: randomUUID(),
    timestampIngested: timestamp,
    timestampObserved: timestamp,
    updatedAt: timestamp
  };
}

function context(overrides: Record<string, unknown> = {}) {
  return ModuleExecutionContextSchema.parse({
    integrationIds: [],
    inputs: {},
    missionId: randomUUID(),
    policyDecisionId: null,
    runId: randomUUID(),
    runnerId: null,
    safetyLevel: "PassiveReadOnly",
    scopeId: randomUUID(),
    target: {},
    tenantId: randomUUID(),
    ...overrides
  });
}

function cloneSnapshot(): ValidationSnapshot {
  return createPublicDemoValidationSnapshot();
}

describe("PRD section 3.4 Attack-Path Validation coverage", () => {
  it("maps every PRD example path class to correlation behavior or a safe identity-pathing module", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "3.4 Attack-Path Validation",
      "3.5 AI App Security Validation"
    );
    const examples = parseBulletsBetween(
      section,
      "Example Paths",
      "Core Concepts"
    );
    const repoEvidenceId = randomUUID();
    const cloudEvidenceId = randomUUID();
    const externalEvidenceId = randomUUID();
    const aiEvidenceId = randomUUID();
    const controlEvidenceId = randomUUID();
    const correlatedPaths = correlateAttackPathsFromSignals({
      signals: [
        createSignal({
          evidenceIds: [repoEvidenceId],
          signalCategory: "Repository",
          signalSubcategory: "SecretScanCandidate",
          sourceType: "fixture.github.secret",
          sourceVendor: "Gitleaks",
          techniqueIds: ["T1552"]
        }),
        createSignal({
          evidenceIds: [cloudEvidenceId],
          relatedAssetIds: [randomUUID()],
          signalCategory: "Cloud",
          signalSubcategory: "PublicExposure",
          sourceType: "fixture.aws.iam",
          sourceVendor: "AWS",
          techniqueIds: ["T1078"]
        }),
        createSignal({
          evidenceIds: [externalEvidenceId],
          relatedAssetIds: [randomUUID()],
          signalCategory: "Exposure",
          signalSubcategory: "ExternalExposure",
          sourceType: "fixture.external.validation",
          sourceVendor: "Nuclei",
          techniqueIds: ["T1595"]
        }),
        createSignal({
          evidenceIds: [aiEvidenceId],
          relatedAssetIds: [randomUUID()],
          signalCategory: "AIApplication",
          signalSubcategory: "RAG authorization risk",
          sourceType: "fixture.ai.safe-validation",
          sourceVendor: "Periscan",
          techniqueIds: ["T1071"]
        }),
        createSignal({
          evidenceIds: [controlEvidenceId],
          relatedControlIds: [randomUUID()],
          signalCategory: "ControlObservation",
          signalSubcategory: "Missed credential-use detection",
          sourceType: "fixture.siem.observer",
          sourceVendor: "Splunk",
          techniqueIds: ["T1552", "T1078"]
        })
      ]
    });
    const patternIds = correlatedPaths.map((candidate) => candidate.patternId);

    expect(examples).toEqual([
      "repo secret -> cloud role -> production data",
      "identity gap -> privileged access -> business system",
      "external service -> vulnerable host -> internal reachability",
      "AI assistant -> RAG abuse -> restricted content",
      "missed control -> undetected activity -> real exposure"
    ]);
    expect(patternIds).toEqual(
      expect.arrayContaining([
        "repo-secret-cloud-role",
        "repo-secret-production-data",
        "internet-facing-production-workload",
        "ai-app-sensitive-data",
        "missed-control-real-exposure"
      ])
    );
    expect(
      correlatedPaths.every((candidate) =>
        candidate.edges.every((edge) => edge.evidenceIds.length > 0)
      )
    ).toBe(true);
    expect(
      correlatedPaths
        .find(
          (candidate) => candidate.patternId === "missed-control-real-exposure"
        )
        ?.edges.map((edge) => edge.relationship)
    ).toEqual(["MISSED_BY", "LEADS_TO"]);

    const bloodhound = getModuleById("bloodhound.identity_pathing");
    const fixtureGraphPath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../packages/modules/fixtures/bloodhound/identity-graph-fixture.json"
    );
    const bloodhoundOutput = await executeModuleById(
      "bloodhound.identity_pathing",
      context({
        target: {
          fixtureGraphPath,
          graphName: "prd-identity-gap"
        }
      })
    );

    expect(bloodhound?.manifest.liveSupported).toBe(false);
    expect(bloodhound?.manifest.safetyLevel).toBe("PassiveReadOnly");
    expect(bloodhoundOutput.outcome).toBe("identity_path_observed");
    expect(
      bloodhoundOutput.signals.map((signal) => signal.signalSubcategory)
    ).toContain("IdentityAdminGap");
    expect(
      bloodhoundOutput.evidence[0]?.attributes.sharpHoundCollectorUsed
    ).toBe(false);
  });

  it("keeps PRD core concepts represented in attack-path schemas and remediation contracts", async () => {
    const prd = await readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md");
    const section = sectionBetween(
      prd,
      "3.4 Attack-Path Validation",
      "3.5 AI App Security Validation"
    );
    const concepts = parseBulletsBetween(
      section,
      "Core Concepts",
      "Requirements"
    );
    const attackPathFields = new Set(Object.keys(AttackPathSchema.shape));
    const pathNodeFields = new Set(Object.keys(PathNodeSchema.shape));
    const pathEdgeFields = new Set(Object.keys(PathEdgeSchema.shape));
    const pathBreakerFields = new Set(Object.keys(PathBreakerSchema.shape));
    const remediationFields = new Set(Object.keys(RemediationTaskSchema.shape));

    expect(concepts).toEqual([
      "path",
      "entry point",
      "intermediate step",
      "impact target",
      "control response",
      "path breaker",
      "business impact",
      "verification plan"
    ]);
    expect([...attackPathFields]).toEqual(
      expect.arrayContaining(["pathId", "name"])
    );
    expect(attackPathFields).toContain("entryNodeId");
    expect(pathNodeFields).toContain("sequence");
    expect(attackPathFields).toContain("impactNodeId");
    expect([...pathEdgeFields]).toEqual(
      expect.arrayContaining(["relationship", "rationale", "evidenceIds"])
    );
    expect([...pathBreakerFields]).toEqual(
      expect.arrayContaining([
        "title",
        "description",
        "priority",
        "evidenceIds"
      ])
    );
    expect(attackPathFields).toContain("impactScore");
    expect(remediationFields).toContain("verificationMethod");
    expect(remediationFields).toContain("latestVerification");
  });

  it("maps PRD requirements to graph paths, edge evidence, control response, ATT&CK mapping, and before/after comparison", async () => {
    const [prd, apiRoutes, fixVerificationSource] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/api/src/app.ts"),
      readRepoFile("apps/api/src/services/remediation.ts")
    ]);
    const section = sectionBetween(
      prd,
      "3.4 Attack-Path Validation",
      "3.5 AI App Security Validation"
    );
    const requirements = parseBulletsBetween(
      section,
      "Requirements",
      "BloodHound"
    );
    const snapshot = cloneSnapshot();
    const html = renderValidationSnapshotReportHtml(snapshot);
    const textExport = renderValidationSnapshotReportPdf(snapshot);
    const firstPath = snapshot.topAttackPaths[0]!.attackPath;
    const controlAwarePath = {
      ...firstPath,
      name: "Missed control to real exposure",
      pathEdges: firstPath.pathEdges.map((edge, index) =>
        index === 0
          ? {
              ...edge,
              rationale: "SIEM control missed the related validation activity.",
              relationship: "MISSED_BY" as const
            }
          : edge
      )
    };
    const controlAwareRisk = assessAttackPathRisk(controlAwarePath);
    const before = cloneSnapshot();
    const after = cloneSnapshot();

    before.topAttackPaths[0]!.attackPath.validationState = "Fixed";
    after.topAttackPaths[0]!.attackPath.validationState = "Validated";

    const diff = buildScheduleDiff({ current: after, previous: before });
    const mappedTechniques = mapAttackTechniqueIds(["T1552", "T1078"]);

    expect(requirements).toEqual([
      "Generate graph-based attack paths.",
      'Identify "path breakers" that reduce the most risk.',
      "Show evidence for each path edge.",
      "Show control response where available.",
      "Show MITRE ATT&CK mapping where applicable.",
      "Support before/after comparison after remediation."
    ]);
    expect(apiRoutes).toContain('"/api/v1/attack-paths"');
    expect(apiRoutes).toContain('"/api/v1/attack-paths/:id"');
    expect(apiRoutes).toContain('"/api/v1/attack-paths/:id/evidence"');
    expect(apiRoutes).toContain('"/api/v1/attack-paths/:id/verify"');
    expect(firstPath.pathNodes.length).toBeGreaterThanOrEqual(2);
    expect(
      firstPath.pathEdges.every((edge) => edge.evidenceIds.length > 0)
    ).toBe(true);
    expect(firstPath.pathBreakers[0]?.evidenceIds.length).toBeGreaterThan(0);
    expect(controlAwareRisk.risk.factors.map((factor) => factor.key)).toContain(
      "control-response"
    );
    expect(
      controlAwareRisk.risk.factors.find(
        (factor) => factor.key === "control-response"
      )?.value
    ).toBe("Missed");
    expect(mappedTechniques.map((technique) => technique.techniqueId)).toEqual([
      "T1552",
      "T1078"
    ]);
    expect(html).toContain("ATT&amp;CK mapping");
    expect(html).toContain("T1552");
    expect(html).toContain("Valid Accounts");
    expect(textExport).toContain("ATT&CK mapping: T1552, T1078");
    expect(diff.status).toBe("ReopenedRiskDetected");
    expect(diff.reopenedPathIds).toContain(firstPath.pathId);
    expect(fixVerificationSource).toContain("buildVerificationResult");
    expect(fixVerificationSource).toContain("previousPath");
    expect(fixVerificationSource).toContain("currentDraft");
    expect(fixVerificationSource).toContain("VerificationEvent");
  });
});
