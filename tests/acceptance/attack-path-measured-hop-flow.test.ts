import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { tryAutoApplyPathEdgeReceiptFromCompletedRun } from "../../apps/api/src/services/findings.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { hopKeyForPathEdge } from "../../packages/evidence/src/edge-receipts.js";
import {
  deriveAttackPathClaim,
  projectPathValidationState
} from "../../packages/shared/src/claim-language.js";
import type { AttackPath } from "../../packages/shared/src/domain.js";
import * as testHelpers from "./helpers.js";

/**
 * Wave A / A8 + PERISCAN-13 residual — measured multi-hop claim contract.
 *
 * Proves the product-facing multi-hop loop over real API + Postgres:
 * 1. Correlated multi-hop paths start as heuristic hypotheses and never surface
 *    Validated / Reachable / Exploitable claim language without hop receipts.
 * 2. Applying a path-edge receipt linked to a Completed hop-bound validation run
 *    upgrades only that hop and updates measured hop fraction.
 * 3. Partially measured paths remain PartiallyMeasuredHypothesis — still cannot
 *    claim Validated. Bare evidenceIds cannot forge Measured.
 * 4. When every hop has a real receipt with evidence IDs, measurementState and
 *    claim language reach FullyMeasured / MeasuredPath (never invent Validated).
 * 5. Completed hop-bound runs auto-apply receipts; multi-edge FullyMeasured only
 *    after every hop has Measured + evidence IDs (claim clamp).
 *
 * Fixtures stay honest: mock connector sync yields real correlated signals;
 * the hop probe run + evidence are tenant-owned rows that the receipt API
 * validates (run linkage, completed status, evidence provenance) before any
 * Measured upgrade.
 */

const EMAIL_PREFIX = "wave-a-hop";
const MODULE_ID = "periscan.tcp_reachability";

type AssessmentItem = {
  attackPath: AttackPath;
  risk: { band: string; score: number; summary: string };
};

type ApplyBody = {
  attackPath: AttackPath;
  measurementState: {
    fullyMeasured: boolean;
    measuredEdgeCount: number;
    totalEdgeCount: number;
  };
  receipt: {
    evidenceIds: string[];
    pathEdgeId: string;
    validationRunId: string | null;
  };
};

async function bootstrapMultiHopPath(app: Awaited<ReturnType<typeof buildApp>>) {
  const { cookie, response: signup } = await testHelpers.performSignup(
    app,
    EMAIL_PREFIX,
    `${EMAIL_PREFIX} Tenant`
  );
  const auth = testHelpers.authHeaders(cookie);
  const tenantId = signup.json().tenant.tenantId as string;
  const userId = signup.json().user.userId as string;

  const scopeResponse = await app.inject({
    cookies: auth,
    method: "POST",
    payload: {
      scopeType: "Domain",
      value: `wave-a-hop-${randomUUID()}.example.com`
    },
    url: "/api/v1/scopes"
  });
  expect(scopeResponse.statusCode).toBe(201);
  const scopeId = scopeResponse.json().scopeId as string;

  const verifyResponse = await app.inject({
    cookies: auth,
    method: "POST",
    payload: { devModeManual: true },
    url: `/api/v1/scopes/${scopeId}/verify`
  });
  expect(verifyResponse.statusCode).toBe(200);

  // Honest product path: mock connector sync produces correlated multi-hop
  // heuristic paths (repo secret → cloud role/data) with ≥2 edges.
  const github = await app.inject({
    cookies: auth,
    method: "POST",
    payload: { mockMode: true },
    url: "/api/v1/integrations/github/connect"
  });
  expect(github.statusCode).toBe(201);
  const aws = await app.inject({
    cookies: auth,
    method: "POST",
    payload: { mockMode: true },
    url: "/api/v1/integrations/aws/connect"
  });
  expect(aws.statusCode).toBe(201);

  for (const integrationId of [
    github.json().integrationId as string,
    aws.json().integrationId as string
  ]) {
    const sync = await app.inject({
      cookies: auth,
      method: "POST",
      url: `/api/v1/integrations/${integrationId}/sync`
    });
    expect(sync.statusCode).toBe(200);
    expect(sync.json().signalCount).toBeGreaterThan(0);
  }

  const pathsResponse = await app.inject({
    cookies: auth,
    method: "GET",
    url: "/api/v1/attack-paths"
  });
  expect(pathsResponse.statusCode).toBe(200);
  const assessments = pathsResponse.json().items as AssessmentItem[];
  expect(assessments.length).toBeGreaterThan(0);

  const multiHop = assessments.find(
    (item) => item.attackPath.pathEdges.length >= 2
  );
  expect(multiHop).toBeDefined();
  const path = multiHop!.attackPath;
  expect(path.pathEdges.length).toBeGreaterThanOrEqual(2);

  return {
    auth,
    multiHop: multiHop!,
    path,
    pathId: path.pathId,
    scopeId,
    tenantId,
    totalEdgeCount: path.pathEdges.length,
    userId
  };
}

/**
 * Create tenant-owned evidence + hop-bound Completed run and apply a path-edge
 * receipt via the public API (real-first linkage gates).
 */
async function applyHopReceiptViaApi(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  auth: Record<string, string>;
  edge: AttackPath["pathEdges"][number];
  path: AttackPath;
  pathId: string;
  prisma: ReturnType<typeof createPrismaClient>;
  scopeId: string;
  tenantId: string;
  userId: string;
}): Promise<ApplyBody> {
  const hopKey =
    hopKeyForPathEdge(input.edge, input.path.pathNodes) ??
    `${input.edge.sourceNodeId}|${input.edge.relationship}|${input.edge.targetNodeId}`;

  const receiptEvidence = await input.prisma.evidenceArtifact.create({
    data: {
      artifactType: "NormalizedEvidence",
      redactionStatus: "Redacted",
      relatedEntityId: input.edge.pathEdgeId,
      relatedEntityType: "AttackPath",
      sensitivityLevel: "Moderate",
      sha256: "b".repeat(64),
      storageUri: `s3://wave-a-hop/${randomUUID()}.json`,
      tenantId: input.tenantId
    }
  });
  const receiptEvidenceId = receiptEvidence.evidenceId;

  const mission = await input.prisma.validationMission.create({
    data: {
      completedAt: new Date(),
      evidenceIds: [receiptEvidenceId],
      missionType: "ExposureValidation",
      policyProfile: "attack-path-edge-validation",
      requestedBy: input.userId,
      safetyLevel: "ActiveNonInvasive",
      scopeId: input.scopeId,
      scopeIds: [input.scopeId],
      startedAt: new Date(),
      status: "Completed",
      tenantId: input.tenantId
    }
  });

  const run = await input.prisma.validationRun.create({
    data: {
      completedAt: new Date(),
      evidenceIds: [receiptEvidenceId],
      missionId: mission.missionId,
      moduleId: MODULE_ID,
      outcome: "tcp_port_reachable",
      safetyLevel: "ActiveNonInvasive",
      scopeId: input.scopeId,
      startedAt: new Date(),
      status: "Completed",
      target: {
        attackPathId: input.pathId,
        hopKey,
        moduleId: MODULE_ID,
        pathEdgeId: input.edge.pathEdgeId,
        scenarioType: "AttackPathEdgeValidation"
      },
      techniqueIds: [],
      tenantId: input.tenantId,
      validationState: "Reachable"
    }
  });

  const applyResponse = await input.app.inject({
    cookies: input.auth,
    method: "POST",
    payload: {
      evidenceIds: [receiptEvidenceId],
      measurementMethod: MODULE_ID,
      moduleId: MODULE_ID,
      outcome: "tcp_port_reachable",
      validationRunId: run.runId,
      validationState: "Reachable"
    },
    url: `/api/v1/attack-paths/${input.pathId}/edges/${input.edge.pathEdgeId}/receipts`
  });
  expect(applyResponse.statusCode).toBe(201);
  return applyResponse.json() as ApplyBody;
}

/**
 * Create hop-bound Completed run evidence and auto-apply receipt the same way
 * runner/control-plane completion does (P05-1).
 */
async function completeHopRunAndAutoApply(input: {
  edge: AttackPath["pathEdges"][number];
  path: AttackPath;
  pathId: string;
  prisma: ReturnType<typeof createPrismaClient>;
  scopeId: string;
  tenantId: string;
  userId: string;
}): Promise<{ applied: boolean; reason: string; evidenceId: string }> {
  const hopKey =
    hopKeyForPathEdge(input.edge, input.path.pathNodes) ??
    `${input.edge.sourceNodeId}|${input.edge.relationship}|${input.edge.targetNodeId}`;

  const receiptEvidence = await input.prisma.evidenceArtifact.create({
    data: {
      artifactType: "NormalizedEvidence",
      redactionStatus: "Redacted",
      relatedEntityId: input.edge.pathEdgeId,
      relatedEntityType: "AttackPath",
      sensitivityLevel: "Moderate",
      sha256: "c".repeat(64),
      storageUri: `s3://wave-a-hop-auto/${randomUUID()}.json`,
      tenantId: input.tenantId
    }
  });
  const evidenceId = receiptEvidence.evidenceId;

  const mission = await input.prisma.validationMission.create({
    data: {
      completedAt: new Date(),
      evidenceIds: [evidenceId],
      missionType: "ExposureValidation",
      policyProfile: "attack-path-edge-validation",
      requestedBy: input.userId,
      safetyLevel: "ActiveNonInvasive",
      scopeId: input.scopeId,
      scopeIds: [input.scopeId],
      startedAt: new Date(),
      status: "Completed",
      tenantId: input.tenantId
    }
  });

  const run = await input.prisma.validationRun.create({
    data: {
      completedAt: new Date(),
      evidenceIds: [evidenceId],
      missionId: mission.missionId,
      moduleId: MODULE_ID,
      outcome: "tcp_port_reachable",
      safetyLevel: "ActiveNonInvasive",
      scopeId: input.scopeId,
      startedAt: new Date(),
      status: "Completed",
      target: {
        attackPathId: input.pathId,
        hopKey,
        moduleId: MODULE_ID,
        pathEdgeId: input.edge.pathEdgeId,
        scenarioType: "AttackPathEdgeValidation"
      },
      techniqueIds: [],
      tenantId: input.tenantId,
      validationState: "Reachable"
    }
  });

  const result = await tryAutoApplyPathEdgeReceiptFromCompletedRun(
    input.prisma,
    {
      actor: "system:auto-apply-test",
      evidenceIds: [evidenceId],
      missionId: mission.missionId,
      moduleId: MODULE_ID,
      outcome: "tcp_port_reachable",
      runId: run.runId,
      target: run.target,
      tenantId: input.tenantId,
      validationState: "Reachable"
    }
  );

  return { ...result, evidenceId };
}

describe("attack-path measured hop claim contract (Wave A / A8)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [EMAIL_PREFIX]);
      await prisma.$disconnect();
    }
  });

  it("updates measured hop fraction from edge receipts and never labels heuristic paths Validated", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma
      })
    });

    try {
      const boot = await bootstrapMultiHopPath(app);
      const {
        auth,
        multiHop,
        path,
        pathId,
        scopeId,
        tenantId,
        totalEdgeCount,
        userId
      } = boot;

      // --- Heuristic claim language: never Validated / Reachable / Exploitable ---
      const baselineClaim = deriveAttackPathClaim(path);
      expect(baselineClaim.fullyMeasured).toBe(false);
      expect(baselineClaim.measuredEdgeCount).toBe(0);
      expect(baselineClaim.totalEdgeCount).toBe(totalEdgeCount);
      expect(baselineClaim.kind).toBe("HeuristicHypothesis");
      expect(baselineClaim.canClaimValidated).toBe(false);
      expect(baselineClaim.canClaimReachable).toBe(false);
      expect(baselineClaim.canClaimExploitable).toBe(false);
      expect(baselineClaim.displayLabel).toMatch(/heuristic/i);

      // Even if a path row were over-labeled Validated, claim projection remaps.
      const overclaimProjection = projectPathValidationState({
        evidenceBasis: path.evidenceBasis,
        pathEdges: path.pathEdges,
        validationState: "Validated"
      });
      expect(overclaimProjection.claimSafeValidationState).not.toBe(
        "Validated"
      );
      expect(overclaimProjection.claim.canClaimValidated).toBe(false);
      expect(overclaimProjection.remapped).toBe(true);

      // Product risk summary must not advertise validated-path certainty.
      expect(multiHop.risk.summary).toMatch(/heuristic path hypothesis/i);
      expect(multiHop.risk.summary).not.toMatch(/measured validated path/i);
      expect(path.evidenceBasis).toBe("Heuristic");
      expect(path.validationState).not.toBe("Validated");
      expect(path.validationState).not.toBe("Exploitable");
      expect(
        path.pathEdges.every((edge) => edge.evidenceBasis === "Heuristic")
      ).toBe(true);

      const baselineMeasurement = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/measurement-state`
      });
      expect(baselineMeasurement.statusCode).toBe(200);
      expect(baselineMeasurement.json()).toMatchObject({
        fullyMeasured: false,
        measuredEdgeCount: 0,
        pathId,
        totalEdgeCount
      });

      const edge = path.pathEdges[0]!;
      const edgeId = edge.pathEdgeId;

      // Bare evidenceIds alone must never forge Measured.
      const forgeEvidence = await prisma.evidenceArtifact.create({
        data: {
          artifactType: "NormalizedEvidence",
          redactionStatus: "Redacted",
          relatedEntityId: edgeId,
          relatedEntityType: "AttackPath",
          sensitivityLevel: "Moderate",
          sha256: "a".repeat(64),
          storageUri: `s3://wave-a-hop-forge/${randomUUID()}.json`,
          tenantId
        }
      });
      const forgeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          evidenceIds: [forgeEvidence.evidenceId],
          measurementMethod: MODULE_ID,
          moduleId: MODULE_ID,
          outcome: "tcp_port_reachable",
          validationState: "Reachable"
        },
        url: `/api/v1/attack-paths/${pathId}/edges/${edgeId}/receipts`
      });
      expect(forgeResponse.statusCode).toBe(400);
      expect(forgeResponse.json().code).toBe(
        "path_edge_receipt_run_linkage_required"
      );

      const applyBody = await applyHopReceiptViaApi({
        app,
        auth,
        edge,
        path,
        pathId,
        prisma,
        scopeId,
        tenantId,
        userId
      });

      expect(applyBody.receipt.pathEdgeId).toBe(edgeId);
      expect(applyBody.receipt.evidenceIds.length).toBeGreaterThan(0);
      expect(applyBody.receipt.validationRunId).toBeTruthy();

      // Hop fraction updates: 1 of N measured; not fully measured.
      expect(applyBody.measurementState).toMatchObject({
        fullyMeasured: false,
        measuredEdgeCount: 1,
        totalEdgeCount
      });

      const updatedEdge = applyBody.attackPath.pathEdges.find(
        (candidate) => candidate.pathEdgeId === edgeId
      )!;
      expect(updatedEdge.evidenceBasis).toBe("Measured");
      expect(updatedEdge.evidenceIds.length).toBeGreaterThan(0);
      expect(updatedEdge.measurementMethod).toBe(MODULE_ID);

      // Unrelated edges stay Heuristic — never upgraded by association.
      const otherEdges = applyBody.attackPath.pathEdges.filter(
        (candidate) => candidate.pathEdgeId !== edgeId
      );
      expect(otherEdges.length).toBeGreaterThan(0);
      expect(
        otherEdges.every((candidate) => candidate.evidenceBasis === "Heuristic")
      ).toBe(true);
      // Path-level basis is weakest edge.
      expect(applyBody.attackPath.evidenceBasis).toBe("Heuristic");

      // Partially measured: still cannot claim Validated / Reachable / Exploitable.
      const partialClaim = deriveAttackPathClaim(applyBody.attackPath);
      expect(partialClaim.kind).toBe("PartiallyMeasuredHypothesis");
      expect(partialClaim.measuredEdgeCount).toBe(1);
      expect(partialClaim.totalEdgeCount).toBe(totalEdgeCount);
      expect(partialClaim.fullyMeasured).toBe(false);
      expect(partialClaim.canClaimValidated).toBe(false);
      expect(partialClaim.canClaimReachable).toBe(false);
      expect(partialClaim.canClaimExploitable).toBe(false);
      expect(partialClaim.displayLabel).toMatch(/partially measured/i);

      // Multi-edge claim clamp: even if path row were Validated after 1 hop,
      // projection remaps until every hop is Measured with evidence IDs.
      const partialOverclaim = projectPathValidationState({
        evidenceBasis: applyBody.attackPath.evidenceBasis,
        pathEdges: applyBody.attackPath.pathEdges,
        validationState: "Validated"
      });
      expect(partialOverclaim.claim.kind).toBe("PartiallyMeasuredHypothesis");
      expect(partialOverclaim.claimSafeValidationState).toBe("Discovered");
      expect(partialOverclaim.remapped).toBe(true);

      const measurementAfter = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/measurement-state`
      });
      expect(measurementAfter.statusCode).toBe(200);
      expect(measurementAfter.json()).toMatchObject({
        fullyMeasured: false,
        measuredEdgeCount: 1,
        pathId,
        totalEdgeCount
      });

      const receiptsList = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/edge-receipts`
      });
      expect(receiptsList.statusCode).toBe(200);
      expect(receiptsList.json().items).toHaveLength(1);

      // Re-list via product API: risk language stays hypothesis / partial, never
      // "measured validated path".
      const pathsAfter = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      expect(pathsAfter.statusCode).toBe(200);
      const afterAssessment = (
        pathsAfter.json().items as AssessmentItem[]
      ).find((item) => item.attackPath.pathId === pathId);
      expect(afterAssessment).toBeDefined();
      const afterClaim = deriveAttackPathClaim(afterAssessment!.attackPath);
      // Receipts reattach across correlation refresh (hopKey-stable).
      expect(afterClaim.measuredEdgeCount).toBeGreaterThanOrEqual(1);
      expect(afterClaim.canClaimValidated).toBe(false);
      expect(afterClaim.kind).not.toBe("MeasuredValidated");
      expect(afterAssessment!.risk.summary).not.toMatch(
        /measured validated path/i
      );
      expect(afterAssessment!.risk.summary).toMatch(
        /hypothesis|hops measured|measurement/i
      );

      // --- FullyMeasured substrate: real receipts for every remaining hop ---
      // Reload path so hopKeys/edge ids match post-correlation state.
      let currentPath = afterAssessment!.attackPath;
      let lastApply: ApplyBody | null = null;
      const remaining = currentPath.pathEdges.filter(
        (candidate) =>
          candidate.evidenceBasis !== "Measured" ||
          !candidate.evidenceIds?.length
      );
      expect(remaining.length).toBeGreaterThanOrEqual(1);

      for (const hop of remaining) {
        lastApply = await applyHopReceiptViaApi({
          app,
          auth,
          edge: hop,
          path: currentPath,
          pathId,
          prisma,
          scopeId,
          tenantId,
          userId
        });
        currentPath = lastApply.attackPath;
      }

      expect(lastApply).not.toBeNull();
      expect(lastApply!.measurementState).toMatchObject({
        fullyMeasured: true,
        measuredEdgeCount: totalEdgeCount,
        totalEdgeCount
      });
      expect(lastApply!.attackPath.evidenceBasis).toBe("Measured");
      expect(
        lastApply!.attackPath.pathEdges.every(
          (candidate) =>
            candidate.evidenceBasis === "Measured" &&
            candidate.evidenceIds.length > 0
        )
      ).toBe(true);

      const fullClaim = deriveAttackPathClaim(lastApply!.attackPath);
      expect(fullClaim.fullyMeasured).toBe(true);
      expect(fullClaim.measuredEdgeCount).toBe(totalEdgeCount);
      expect(fullClaim.totalEdgeCount).toBe(totalEdgeCount);
      // Receipts upgrade hop basis; path validationState is claim-clamped from
      // recorded state and does not invent Validated/Exploitable.
      expect(fullClaim.canClaimValidated).toBe(false);
      expect(fullClaim.canClaimExploitable).toBe(false);
      expect(["MeasuredPath", "MeasuredReachable"]).toContain(fullClaim.kind);
      expect(fullClaim.displayLabel).toMatch(/measured/i);
      expect(fullClaim.kind).not.toBe("PartiallyMeasuredHypothesis");
      expect(fullClaim.kind).not.toBe("HeuristicHypothesis");

      const measurementFull = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/measurement-state`
      });
      expect(measurementFull.statusCode).toBe(200);
      expect(measurementFull.json()).toMatchObject({
        fullyMeasured: true,
        measuredEdgeCount: totalEdgeCount,
        pathId,
        totalEdgeCount
      });

      const receiptsFull = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/edge-receipts`
      });
      expect(receiptsFull.statusCode).toBe(200);
      expect(receiptsFull.json().items.length).toBeGreaterThanOrEqual(
        totalEdgeCount
      );

      // Product list: fully measured path still never forges Validated language
      // unless recorded validationState is claim-safe Validated (it is not).
      const pathsFull = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      expect(pathsFull.statusCode).toBe(200);
      const fullAssessment = (pathsFull.json().items as AssessmentItem[]).find(
        (item) => item.attackPath.pathId === pathId
      );
      expect(fullAssessment).toBeDefined();
      const listClaim = deriveAttackPathClaim(fullAssessment!.attackPath);
      expect(listClaim.fullyMeasured).toBe(true);
      expect(listClaim.canClaimValidated).toBe(false);
      expect(listClaim.kind).not.toBe("MeasuredValidated");
      expect(fullAssessment!.risk.summary).not.toMatch(
        /measured validated path/i
      );
      expect(fullAssessment!.risk.summary).toMatch(
        /measured|hops measured|path/i
      );
    } finally {
      await app.close();
    }
  }, 120_000);

  it("auto-applies hop receipts on completed runs and reaches FullyMeasured only when all hops have evidence IDs", async () => {
    prisma = createPrismaClient();
    await testHelpers.probeDatabaseConnection(prisma);

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        missionQueue: {
          async enqueueValidationJob() {
            return;
          }
        },
        prisma
      })
    });

    try {
      const boot = await bootstrapMultiHopPath(app);
      const { auth, path, pathId, scopeId, tenantId, totalEdgeCount, userId } =
        boot;

      // Auto-apply first hop only → Partial, never FullyMeasured / Validated.
      const first = path.pathEdges[0]!;
      const auto1 = await completeHopRunAndAutoApply({
        edge: first,
        path,
        pathId,
        prisma,
        scopeId,
        tenantId,
        userId
      });
      expect(auto1.applied).toBe(true);
      expect(auto1.reason).toBe("applied");

      const partialState = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/measurement-state`
      });
      expect(partialState.statusCode).toBe(200);
      expect(partialState.json()).toMatchObject({
        fullyMeasured: false,
        measuredEdgeCount: 1,
        totalEdgeCount
      });

      const pathsPartial = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      const partialAssessment = (
        pathsPartial.json().items as AssessmentItem[]
      ).find((item) => item.attackPath.pathId === pathId);
      expect(partialAssessment).toBeDefined();
      let currentPath = partialAssessment!.attackPath;
      const partialClaim = deriveAttackPathClaim(currentPath);
      expect(partialClaim.kind).toBe("PartiallyMeasuredHypothesis");
      expect(partialClaim.fullyMeasured).toBe(false);
      expect(partialClaim.canClaimValidated).toBe(false);

      // Claim clamp: Measured without evidence IDs on remaining hops still
      // blocks FullyMeasured (honesty gate; no forge from empty IDs).
      const emptyIdProjection = projectPathValidationState({
        evidenceBasis: "Measured",
        pathEdges: currentPath.pathEdges.map((edge, index) =>
          index === 0
            ? edge
            : {
                ...edge,
                evidenceBasis: "Measured" as const,
                evidenceIds: []
              }
        ),
        validationState: "Validated"
      });
      expect(emptyIdProjection.claim.fullyMeasured).toBe(false);
      expect(emptyIdProjection.claim.canClaimValidated).toBe(false);
      expect(emptyIdProjection.claimSafeValidationState).toBe("Discovered");

      // Auto-apply remaining hops → FullyMeasured substrate.
      const remaining = currentPath.pathEdges.filter(
        (edge) =>
          edge.evidenceBasis !== "Measured" || !edge.evidenceIds?.length
      );
      expect(remaining.length).toBeGreaterThanOrEqual(1);

      for (const hop of remaining) {
        const auto = await completeHopRunAndAutoApply({
          edge: hop,
          path: currentPath,
          pathId,
          prisma,
          scopeId,
          tenantId,
          userId
        });
        expect(auto.applied).toBe(true);
      }

      const fullState = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/measurement-state`
      });
      expect(fullState.statusCode).toBe(200);
      expect(fullState.json()).toMatchObject({
        fullyMeasured: true,
        measuredEdgeCount: totalEdgeCount,
        pathId,
        totalEdgeCount
      });

      const pathsFull = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      const fullAssessment = (pathsFull.json().items as AssessmentItem[]).find(
        (item) => item.attackPath.pathId === pathId
      );
      expect(fullAssessment).toBeDefined();
      currentPath = fullAssessment!.attackPath;
      const fullClaim = deriveAttackPathClaim(currentPath);
      expect(fullClaim.fullyMeasured).toBe(true);
      expect(fullClaim.measuredEdgeCount).toBe(totalEdgeCount);
      expect(fullClaim.canClaimValidated).toBe(false);
      expect(fullClaim.canClaimExploitable).toBe(false);
      expect(["MeasuredPath", "MeasuredReachable"]).toContain(fullClaim.kind);

      // Only when recorded certainty is Validated AND every hop is Measured
      // with evidence IDs may claim-safe Validated survive (unit-level gate
      // exercised against live multi-edge path shape).
      const validatedWhenFull = projectPathValidationState({
        evidenceBasis: currentPath.evidenceBasis,
        pathEdges: currentPath.pathEdges,
        validationState: "Validated"
      });
      expect(validatedWhenFull.claim.fullyMeasured).toBe(true);
      expect(validatedWhenFull.claim.canClaimValidated).toBe(true);
      expect(validatedWhenFull.claimSafeValidationState).toBe("Validated");
      expect(validatedWhenFull.remapped).toBe(false);

      const receipts = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/edge-receipts`
      });
      expect(receipts.statusCode).toBe(200);
      expect(receipts.json().items.length).toBeGreaterThanOrEqual(
        totalEdgeCount
      );
    } finally {
      await app.close();
    }
  }, 120_000);
});
