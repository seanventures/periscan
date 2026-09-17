import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { hopKeyForPathEdge } from "../../packages/evidence/src/edge-receipts.js";
import {
  deriveAttackPathClaim,
  projectPathValidationState
} from "../../packages/shared/src/claim-language.js";
import type { AttackPath } from "../../packages/shared/src/domain.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S1 — multi-hop FullyMeasured product path (acceptance).
 *
 * Completes the hop-by-hop measured loop over real API + Postgres:
 * 1. Correlated multi-hop path starts as HeuristicHypothesis.
 * 2. Every hop receives a Measured edge receipt with tenant-owned evidence IDs.
 * 3. measurement-state + claim language become FullyMeasured / MeasuredPath
 *    (or MeasuredReachable when path certainty supports it).
 * 4. Snapshot HTML report export surfaces claim-safe path state and fully-measured
 *    multi-hop counts — never inventing Validated without full hop receipts.
 *
 * Launch alone never upgrades certainty; bare evidenceIds cannot forge Measured.
 */

const EMAIL_PREFIX = "s1-fully-measured";
const MODULE_ID = "periscan.tcp_reachability";

type AssessmentItem = {
  attackPath: AttackPath;
  risk: { band: string; score: number; summary: string };
};

async function applyHopReceipt(input: {
  app: Awaited<ReturnType<typeof buildApp>>;
  auth: Record<string, string>;
  edge: AttackPath["pathEdges"][number];
  path: AttackPath;
  prisma: ReturnType<typeof createPrismaClient>;
  scopeId: string;
  tenantId: string;
  userId: string;
}) {
  const {
    app,
    auth,
    edge,
    path,
    prisma,
    scopeId,
    tenantId,
    userId
  } = input;
  const edgeId = edge.pathEdgeId;
  const hopKey =
    hopKeyForPathEdge(edge, path.pathNodes) ??
    `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`;

  const receiptEvidence = await prisma.evidenceArtifact.create({
    data: {
      artifactType: "NormalizedEvidence",
      redactionStatus: "Redacted",
      relatedEntityId: edgeId,
      relatedEntityType: "AttackPath",
      sensitivityLevel: "Moderate",
      sha256: "c".repeat(64),
      storageUri: `s3://s1-fully-measured/${randomUUID()}.json`,
      tenantId
    }
  });
  const receiptEvidenceId = receiptEvidence.evidenceId;

  const mission = await prisma.validationMission.create({
    data: {
      completedAt: new Date(),
      evidenceIds: [receiptEvidenceId],
      missionType: "ExposureValidation",
      policyProfile: "attack-path-edge-validation",
      requestedBy: userId,
      safetyLevel: "ActiveNonInvasive",
      scopeId,
      scopeIds: [scopeId],
      startedAt: new Date(),
      status: "Completed",
      tenantId
    }
  });

  const run = await prisma.validationRun.create({
    data: {
      completedAt: new Date(),
      evidenceIds: [receiptEvidenceId],
      missionId: mission.missionId,
      moduleId: MODULE_ID,
      outcome: "tcp_port_reachable",
      safetyLevel: "ActiveNonInvasive",
      scopeId,
      startedAt: new Date(),
      status: "Completed",
      target: {
        attackPathId: path.pathId,
        hopKey,
        moduleId: MODULE_ID,
        pathEdgeId: edgeId,
        scenarioType: "AttackPathEdgeValidation"
      },
      techniqueIds: [],
      tenantId,
      validationState: "Reachable"
    }
  });

  const applyResponse = await app.inject({
    cookies: auth,
    method: "POST",
    payload: {
      evidenceIds: [receiptEvidenceId],
      measurementMethod: MODULE_ID,
      moduleId: MODULE_ID,
      outcome: "tcp_port_reachable",
      validationRunId: run.runId,
      validationState: "Reachable"
    },
    url: `/api/v1/attack-paths/${path.pathId}/edges/${edgeId}/receipts`
  });
  expect(applyResponse.statusCode).toBe(201);
  return applyResponse.json() as {
    attackPath: AttackPath;
    measurementState: {
      claimSafeValidationState: string;
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
}

describe("multi-hop FullyMeasured + claim-safe report export (Swarm S1)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [EMAIL_PREFIX]);
      await prisma.$disconnect();
    }
  });

  it("measures every hop → FullyMeasured → claim-safe labels → export includes claim-safe state", async () => {
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
      const { cookie, response: signup } = await testHelpers.performSignup(
        app,
        EMAIL_PREFIX,
        `${EMAIL_PREFIX} Tenant`
      );
      const auth = testHelpers.authHeaders(cookie);
      const tenantId = signup.json().tenant.tenantId as string;
      const userId = signup.json().user.userId as string;

      // Evidence packs / snapshot export require a billing package with packs.
      await prisma.tenant.update({
        data: { billingPackageKey: "ValidationSnapshot" },
        where: { tenantId }
      });

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `s1-fully-measured-${randomUUID()}.example.com`
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
      let path = multiHop!.attackPath;
      const pathId = path.pathId;
      const totalEdgeCount = path.pathEdges.length;
      expect(totalEdgeCount).toBeGreaterThanOrEqual(2);

      const baselineClaim = deriveAttackPathClaim(path);
      expect(baselineClaim.fullyMeasured).toBe(false);
      expect(baselineClaim.kind).toBe("HeuristicHypothesis");
      expect(baselineClaim.canClaimValidated).toBe(false);

      // Measure EVERY hop via product receipt API (run-linked evidence).
      let lastMeasurement: {
        fullyMeasured: boolean;
        measuredEdgeCount: number;
        totalEdgeCount: number;
        claimSafeValidationState: string;
      } | null = null;

      for (const edge of path.pathEdges) {
        // Re-read path edges after each apply so hopKeys stay stable against
        // the current edge ids (reattach may rewrite ids across refreshes).
        const currentPaths = await app.inject({
          cookies: auth,
          method: "GET",
          url: "/api/v1/attack-paths"
        });
        const current = (
          currentPaths.json().items as AssessmentItem[]
        ).find((item) => item.attackPath.pathId === pathId);
        expect(current).toBeDefined();
        path = current!.attackPath;
        const liveEdge =
          path.pathEdges.find((candidate) => candidate.pathEdgeId === edge.pathEdgeId) ??
          path.pathEdges.find(
            (candidate) =>
              candidate.evidenceBasis !== "Measured" ||
              !candidate.evidenceIds?.length
          );
        // Prefer still-unmeasured edge by hop identity when edge id rewrites.
        const unmeasured =
          path.pathEdges.find(
            (candidate) =>
              candidate.evidenceBasis !== "Measured" ||
              !candidate.evidenceIds?.length
          ) ?? liveEdge;
        expect(unmeasured).toBeDefined();

        const applied = await applyHopReceipt({
          app,
          auth,
          edge: unmeasured!,
          path,
          prisma,
          scopeId,
          tenantId,
          userId
        });
        lastMeasurement = applied.measurementState;
        path = applied.attackPath;
      }

      expect(lastMeasurement).not.toBeNull();
      expect(lastMeasurement!.fullyMeasured).toBe(true);
      expect(lastMeasurement!.measuredEdgeCount).toBe(totalEdgeCount);
      expect(lastMeasurement!.totalEdgeCount).toBe(totalEdgeCount);

      const measurementState = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/measurement-state`
      });
      expect(measurementState.statusCode).toBe(200);
      expect(measurementState.json()).toMatchObject({
        fullyMeasured: true,
        measuredEdgeCount: totalEdgeCount,
        pathId,
        totalEdgeCount
      });

      const fullClaim = deriveAttackPathClaim(path);
      expect(fullClaim.fullyMeasured).toBe(true);
      expect(fullClaim.measuredEdgeCount).toBe(totalEdgeCount);
      expect(fullClaim.totalEdgeCount).toBe(totalEdgeCount);
      // Full hop receipts → Measured* kinds; never stay HeuristicHypothesis.
      expect(fullClaim.kind).toMatch(/^Measured/);
      expect(fullClaim.displayLabel).toMatch(/measured/i);
      expect(path.evidenceBasis).toBe("Measured");
      expect(
        path.pathEdges.every(
          (edge) =>
            edge.evidenceBasis === "Measured" && edge.evidenceIds.length > 0
        )
      ).toBe(true);

      // Claim-safe projection: certainty states only when measurement supports them.
      const projection = projectPathValidationState(path);
      expect(projection.claim.fullyMeasured).toBe(true);
      expect(projection.claimSafeValidationState).toBe(
        measurementState.json().claimSafeValidationState
      );
      // Without every hop Measured we cannot claim Validated — already fully measured,
      // so canClaimValidated only if path.validationState is Validated/Exploitable.
      if (path.validationState !== "Validated" && path.validationState !== "Exploitable") {
        expect(projection.claim.canClaimValidated).toBe(false);
      }

      const receiptsList = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/edge-receipts`
      });
      expect(receiptsList.statusCode).toBe(200);
      expect(receiptsList.json().items.length).toBeGreaterThanOrEqual(
        totalEdgeCount
      );

      // Product list risk language reflects measured path (not heuristic-only).
      const pathsAfter = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      const afterAssessment = (
        pathsAfter.json().items as AssessmentItem[]
      ).find((item) => item.attackPath.pathId === pathId);
      expect(afterAssessment).toBeDefined();
      const afterClaim = deriveAttackPathClaim(afterAssessment!.attackPath);
      expect(afterClaim.fullyMeasured).toBe(true);
      expect(afterClaim.kind).toMatch(/^Measured/);

      // Snapshot + HTML report: claim-safe state + fully measured multi-hop strip.
      const snapshotResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { audience: "Security Team", maxTopItems: 5 },
        url: "/api/v1/snapshots"
      });
      if (snapshotResponse.statusCode !== 201) {
        // Surface body for diagnosis when snapshot gates fail (package, scope, render).
        throw new Error(
          `snapshot failed ${snapshotResponse.statusCode}: ${snapshotResponse.body}`
        );
      }
      expect(snapshotResponse.statusCode).toBe(201);
      const snapshot = snapshotResponse.json() as {
        evidencePack: { evidencePackId: string; status: string };
        snapshotId: string;
        topAttackPaths: AssessmentItem[];
      };
      expect(snapshot.evidencePack.status).toBe("Ready");
      expect(snapshot.topAttackPaths.length).toBeGreaterThan(0);

      const snapPath = snapshot.topAttackPaths.find(
        (item) => item.attackPath.pathId === pathId
      );
      // Path may re-correlate under a stable id; if present, claim must stay fully measured.
      if (snapPath) {
        const snapClaim = deriveAttackPathClaim(snapPath.attackPath);
        expect(snapClaim.fullyMeasured).toBe(true);
      }

      const reportResponse = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/snapshots/${snapshot.snapshotId}/report`
      });
      expect(reportResponse.statusCode).toBe(200);
      const html = reportResponse.body;
      // Snapshot Coverage strip (all ValidationSnapshot packs).
      expect(html).toContain("Fully measured multi-hop");
      // Per-path claim-safe projection in Priority Attack Paths.
      expect(html).toContain("Claim-safe path state");
      // Overview language from deriveAttackPathClaim: at least one fully measured path.
      expect(html).toMatch(/other fully measured path|measured (reachable|validated) path/i);
      // With ≥1 fully measured multi-hop path, hypothesis mode banner must not fire.
      expect(html).not.toContain("zero fully measured multi-hop paths");
      // Coverage count must not be 0 of N when we measured every hop on a path.
      expect(html).toMatch(
        /Fully measured multi-hop<\/dt><dd>[1-9]\d* of [1-9]/
      );

      // Export endpoint also returns claim-safe HTML for the pack.
      const exportResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { format: "html" },
        url: `/api/v1/reports/${snapshot.evidencePack.evidencePackId}/export`
      });
      expect(exportResponse.statusCode).toBe(200);
      const exportBody =
        typeof exportResponse.body === "string"
          ? exportResponse.body
          : JSON.stringify(exportResponse.json());
      expect(exportBody).toMatch(/Claim-safe path state|Fully measured multi-hop/i);
    } finally {
      await app.close();
    }
  }, 120_000);
});
