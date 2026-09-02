import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { tryAutoApplyPathEdgeReceiptFromCompletedRun } from "../../apps/api/src/services/findings.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";
import { hopKeyForPathEdge } from "../../packages/evidence/src/edge-receipts.js";
import {
  deriveAttackPathClaim
} from "../../packages/shared/src/claim-language.js";
import type { AttackPath } from "../../packages/shared/src/domain.js";
import * as testHelpers from "./helpers.js";

/**
 * Swarm S1 — hop receipt auto-apply (P05-1) product edge.
 *
 * Proves tryAutoApplyPathEdgeReceiptFromCompletedRun upgrades a hop when a
 * hop-bound Completed run has tenant-owned evidence IDs — the control-plane /
 * runner completion path used after Measure hop (safe). Launch alone never
 * upgrades; empty evidence never forges Measured; identity import stays Heuristic.
 */

const EMAIL_PREFIX = "s1-auto-apply";
const MODULE_ID = "periscan.tcp_reachability";

type AssessmentItem = {
  attackPath: AttackPath;
};

describe("hop receipt auto-apply from completed run (Swarm S1)", () => {
  let prisma: ReturnType<typeof createPrismaClient>;

  afterEach(async () => {
    if (prisma) {
      await testHelpers.cleanupTestDataByEmailPrefix(prisma, [EMAIL_PREFIX]);
      await prisma.$disconnect();
    }
  });

  it("auto-applies Measured receipt from hop-bound completed run with evidence IDs", async () => {
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

      const scopeResponse = await app.inject({
        cookies: auth,
        method: "POST",
        payload: {
          scopeType: "Domain",
          value: `s1-auto-apply-${randomUUID()}.example.com`
        },
        url: "/api/v1/scopes"
      });
      expect(scopeResponse.statusCode).toBe(201);
      const scopeId = scopeResponse.json().scopeId as string;
      await app.inject({
        cookies: auth,
        method: "POST",
        payload: { devModeManual: true },
        url: `/api/v1/scopes/${scopeId}/verify`
      });

      const github = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { mockMode: true },
        url: "/api/v1/integrations/github/connect"
      });
      const aws = await app.inject({
        cookies: auth,
        method: "POST",
        payload: { mockMode: true },
        url: "/api/v1/integrations/aws/connect"
      });
      expect(github.statusCode).toBe(201);
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
      }

      const pathsResponse = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      const multiHop = (
        pathsResponse.json().items as AssessmentItem[]
      ).find((item) => item.attackPath.pathEdges.length >= 2);
      expect(multiHop).toBeDefined();
      const path = multiHop!.attackPath;
      const pathId = path.pathId;
      const edge = path.pathEdges[0]!;
      const edgeId = edge.pathEdgeId;
      const hopKey =
        hopKeyForPathEdge(edge, path.pathNodes) ??
        `${edge.sourceNodeId}|${edge.relationship}|${edge.targetNodeId}`;

      // No evidence → auto-apply refuses (real-first).
      const noEvidence = await tryAutoApplyPathEdgeReceiptFromCompletedRun(
        prisma,
        {
          actor: userId,
          evidenceIds: [],
          missionId: randomUUID(),
          moduleId: MODULE_ID,
          outcome: "tcp_port_reachable",
          runId: randomUUID(),
          target: {
            attackPathId: pathId,
            hopKey,
            pathEdgeId: edgeId,
            scenarioType: "AttackPathEdgeValidation"
          },
          tenantId,
          validationState: "Reachable"
        }
      );
      expect(noEvidence).toEqual({ applied: false, reason: "no_evidence" });

      // Non-hop target → not applied.
      const notHop = await tryAutoApplyPathEdgeReceiptFromCompletedRun(prisma, {
        actor: userId,
        evidenceIds: [randomUUID()],
        missionId: randomUUID(),
        moduleId: MODULE_ID,
        outcome: "unrelated",
        runId: randomUUID(),
        target: { scenarioType: "ExposureValidation" },
        tenantId,
        validationState: "Reachable"
      });
      expect(notHop).toEqual({ applied: false, reason: "not_hop_bound" });

      const receiptEvidence = await prisma.evidenceArtifact.create({
        data: {
          artifactType: "NormalizedEvidence",
          redactionStatus: "Redacted",
          relatedEntityId: edgeId,
          relatedEntityType: "AttackPath",
          sensitivityLevel: "Moderate",
          sha256: "d".repeat(64),
          storageUri: `s3://s1-auto-apply/${randomUUID()}.json`,
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
            attackPathId: pathId,
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

      // Product auto-apply edge used by runner + control-plane completion.
      const applied = await tryAutoApplyPathEdgeReceiptFromCompletedRun(prisma, {
        actor: `system:test:${userId}`,
        evidenceIds: [receiptEvidenceId],
        missionId: mission.missionId,
        moduleId: MODULE_ID,
        outcome: "tcp_port_reachable",
        runId: run.runId,
        target: run.target,
        tenantId,
        validationState: "Reachable"
      });
      expect(applied).toEqual({ applied: true, reason: "applied" });

      const receipts = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/edge-receipts`
      });
      expect(receipts.statusCode).toBe(200);
      expect(receipts.json().items.length).toBeGreaterThanOrEqual(1);
      const receipt = (
        receipts.json().items as Array<{
          measurementMethod: string;
          pathEdgeId: string;
          validationRunId: string | null;
          evidenceIds: string[];
        }>
      ).find((item) => item.pathEdgeId === edgeId);
      expect(receipt).toBeDefined();
      expect(receipt!.validationRunId).toBe(run.runId);
      expect(receipt!.evidenceIds).toContain(receiptEvidenceId);
      expect(receipt!.measurementMethod).toBe("hop-probe-auto");

      const measurement = await app.inject({
        cookies: auth,
        method: "GET",
        url: `/api/v1/attack-paths/${pathId}/measurement-state`
      });
      expect(measurement.statusCode).toBe(200);
      expect(measurement.json().measuredEdgeCount).toBeGreaterThanOrEqual(1);
      // One hop only — not FullyMeasured unless path was single-edge.
      if (path.pathEdges.length > 1) {
        expect(measurement.json().fullyMeasured).toBe(false);
      }

      const pathsAfter = await app.inject({
        cookies: auth,
        method: "GET",
        url: "/api/v1/attack-paths"
      });
      const after = (
        pathsAfter.json().items as AssessmentItem[]
      ).find((item) => item.attackPath.pathId === pathId);
      expect(after).toBeDefined();
      const measuredEdge = after!.attackPath.pathEdges.find(
        (candidate) => candidate.pathEdgeId === edgeId
      );
      expect(measuredEdge?.evidenceBasis).toBe("Measured");
      expect(measuredEdge?.evidenceIds).toContain(receiptEvidenceId);

      const claim = deriveAttackPathClaim(after!.attackPath);
      expect(claim.measuredEdgeCount).toBeGreaterThanOrEqual(1);
      if (path.pathEdges.length > 1) {
        expect(claim.fullyMeasured).toBe(false);
        expect(claim.kind).toBe("PartiallyMeasuredHypothesis");
      }

      // Audit surface for auto-apply (Prisma enum stores dotted action as snake).
      const auditCount = await prisma.auditEvent.count({
        where: {
          action: "verification_run",
          tenantId
        }
      });
      expect(auditCount).toBeGreaterThanOrEqual(1);
    } finally {
      await app.close();
    }
  }, 90_000);
});
