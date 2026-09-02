import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createInMemoryEvidenceGraphService,
  createPrismaEvidenceGraphService,
  UpsertGraphNodeInputSchema
} from "./graph";

describe("evidence graph service", () => {
  it("rejects unknown graph nodeType values on upsert (P11-1 closed ontology)", async () => {
    const graph = createInMemoryEvidenceGraphService();
    const tenantId = randomUUID();

    expect(() =>
      UpsertGraphNodeInputSchema.parse({
        evidenceIds: [],
        label: "Open ontology tax",
        nodeKey: "bad:free-string",
        nodeType: "TotallyInventedType",
        properties: {},
        tenantId
      })
    ).toThrow(/allowlisted|Family\.Leaf|nodeType/i);

    await expect(
      graph.upsertNode({
        evidenceIds: [],
        label: "Open ontology tax",
        nodeKey: "bad:unknown-family",
        nodeType: "UnknownFamily.Leaf",
        properties: {},
        tenantId
      })
    ).rejects.toThrow();

    await expect(
      graph.upsertNode({
        evidenceIds: [],
        label: "Invalid signal leaf",
        nodeKey: "bad:signal-leaf",
        nodeType: "Signal.NotACategory",
        properties: {},
        tenantId
      })
    ).rejects.toThrow();

    const accepted = await graph.upsertNode({
      evidenceIds: [],
      label: "Allowlisted bare type",
      nodeKey: "run:ok",
      nodeType: "ValidationRun",
      properties: {},
      tenantId
    });
    expect(accepted.nodeType).toBe("ValidationRun");
  });

  it("upserts nodes and edges, finds paths, and creates attack paths", async () => {
    const graph = createInMemoryEvidenceGraphService();
    const tenantId = randomUUID();
    const sourceEntityId = randomUUID();
    const middleEntityId = randomUUID();
    const targetEntityId = randomUUID();
    const evidenceId = randomUUID();

    const sourceNode = await graph.upsertNode({
      evidenceIds: [evidenceId],
      label: "Repository secret",
      nodeKey: "signal:repo-secret",
      nodeType: "Signal.Repository",
      properties: {
        category: "Repository"
      },
      relatedEntityId: sourceEntityId,
      relatedEntityType: "Exposure",
      tenantId
    });
    const middleNode = await graph.upsertNode({
      evidenceIds: [evidenceId],
      label: "Cloud role",
      nodeKey: "asset:cloud-role",
      nodeType: "Asset.CloudRole",
      properties: {
        category: "Cloud"
      },
      relatedEntityId: middleEntityId,
      relatedEntityType: "Asset",
      tenantId
    });
    const targetNode = await graph.upsertNode({
      evidenceIds: [evidenceId],
      label: "Production bucket",
      nodeKey: "asset:prod-bucket",
      nodeType: "Asset.StorageBucket",
      properties: {
        category: "Cloud"
      },
      relatedEntityId: targetEntityId,
      relatedEntityType: "Asset",
      tenantId
    });
    const firstEdge = await graph.upsertEdge({
      evidenceBasis: "Measured",
      evidenceIds: [evidenceId],
      measurementMethod: "runner-probe:tcp-connect",
      properties: {
        source: "fixture"
      },
      rationale: "Secret can access role",
      relationship: "CAN_ACCESS",
      sourceNodeId: sourceNode.graphNodeId,
      targetNodeId: middleNode.graphNodeId,
      tenantId
    });
    const secondEdge = await graph.upsertEdge({
      evidenceBasis: "Heuristic",
      evidenceIds: [evidenceId],
      measurementMethod: "configuration-inference",
      properties: {
        source: "fixture"
      },
      rationale: "Role can access bucket",
      relationship: "CAN_ACCESS",
      sourceNodeId: middleNode.graphNodeId,
      targetNodeId: targetNode.graphNodeId,
      tenantId
    });

    // P11-14: hop certainty is first-class on GraphEdge
    expect(firstEdge.evidenceBasis).toBe("Measured");
    expect(firstEdge.measurementMethod).toBe("runner-probe:tcp-connect");
    expect(secondEdge.evidenceBasis).toBe("Heuristic");

    const neighbors = await graph.getNeighbors(
      tenantId,
      middleNode.graphNodeId
    );

    expect(neighbors?.neighbors).toHaveLength(2);

    const paths = await graph.findPaths({
      maxDepth: 3,
      sourceNodeId: sourceNode.graphNodeId,
      targetNodeId: targetNode.graphNodeId,
      tenantId
    });

    expect(paths).toHaveLength(1);
    expect(paths[0]?.edgeIds).toEqual([
      firstEdge.graphEdgeId,
      secondEdge.graphEdgeId
    ]);

    const attackPath = await graph.createAttackPath({
      confidence: 0.91,
      edgeIds: [firstEdge.graphEdgeId, secondEdge.graphEdgeId],
      evidenceBasis: "Measured",
      evidenceIds: [evidenceId],
      impactScore: 87,
      name: "Repo secret to production bucket",
      nodeIds: [
        sourceNode.graphNodeId,
        middleNode.graphNodeId,
        targetNode.graphNodeId
      ],
      pathBreakers: [
        {
          description: "Rotate the secret to break the path.",
          evidenceIds: [evidenceId],
          priority: 1,
          relatedNodeId: sourceNode.graphNodeId,
          title: "Rotate secret"
        }
      ],
      tenantId,
      validationState: "Validated"
    });

    expect(attackPath.pathNodes).toHaveLength(3);
    expect(attackPath.pathEdges).toHaveLength(2);
    expect(attackPath.pathBreakers).toHaveLength(1);
    expect(attackPath.pathEdges.map((edge) => edge.evidenceBasis)).toEqual([
      "Measured",
      "Heuristic"
    ]);
    expect(attackPath.pathEdges[0]?.measurementMethod).toBe(
      "runner-probe:tcp-connect"
    );
    // A single inferred hop prevents a graph-wide Measured claim.
    expect(attackPath.evidenceBasis).toBe("Heuristic");
    // P09-2: Validated without fully-measured hops must not be persisted.
    expect(attackPath.validationState).toBe("Discovered");

    // Overclaiming update is claim-clamped; Fixed (non-certainty) still writes.
    expect(
      (await graph.updatePathState(attackPath.pathId, "Exploitable"))
        .validationState
    ).toBe("Discovered");
    const updatedPath = await graph.updatePathState(attackPath.pathId, "Fixed");

    expect(updatedPath.validationState).toBe("Fixed");

    const updatedNode = await graph.linkEvidence({
      evidenceId: randomUUID(),
      graphNodeId: sourceNode.graphNodeId
    });

    expect(updatedNode.evidenceIds.length).toBe(2);
  });

  it("uses the persisted attack path id when projecting Prisma-backed paths", async () => {
    const tenantId = randomUUID();
    const evidenceId = randomUUID();
    const sourceNodeId = randomUUID();
    const targetNodeId = randomUUID();
    const persistedPathId = randomUUID();
    const fakePrisma = {
      attackPath: {
        async create() {
          return {
            confidence: 0.72,
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            evidenceIds: [evidenceId],
            impactScore: 68,
            name: "Fixture path",
            pathId: persistedPathId,
            tenantId,
            updatedAt: new Date("2026-06-01T00:00:00.000Z"),
            validationState: "Validated"
          };
        },
        async update({
          data,
          where
        }: {
          data: { evidenceBasis?: "Measured" | "Heuristic" };
          where: {
            pathId: string;
          };
        }) {
          if (where.pathId !== persistedPathId) {
            throw new Error(`Expected persisted path id ${persistedPathId}`);
          }

          return {
            confidence: 0.72,
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            entryNodeId: randomUUID(),
            evidenceBasis: data.evidenceBasis ?? "Heuristic",
            evidenceIds: [evidenceId],
            impactNodeId: randomUUID(),
            impactScore: 68,
            methodology: null,
            name: "Fixture path",
            pathId: persistedPathId,
            tenantId,
            updatedAt: new Date("2026-06-01T00:00:00.000Z"),
            validationState: "Validated"
          };
        }
      },
      graphEdge: {
        async findMany() {
          return [
            {
              createdAt: new Date("2026-06-01T00:00:00.000Z"),
              evidenceIds: [evidenceId],
              graphEdgeId: randomUUID(),
              properties: {},
              rationale: "fixture",
              relationship: "CAN_ACCESS",
              sourceNodeId,
              targetNodeId,
              tenantId,
              updatedAt: new Date("2026-06-01T00:00:00.000Z")
            }
          ];
        }
      },
      graphNode: {
        async findMany() {
          return [
            {
              createdAt: new Date("2026-06-01T00:00:00.000Z"),
              evidenceIds: [evidenceId],
              graphNodeId: sourceNodeId,
              label: "Source",
              nodeKey: "source",
              nodeType: "Exposure.RepositorySecret",
              properties: {},
              relatedEntityId: randomUUID(),
              relatedEntityType: "Exposure",
              tenantId,
              updatedAt: new Date("2026-06-01T00:00:00.000Z")
            },
            {
              createdAt: new Date("2026-06-01T00:00:00.000Z"),
              evidenceIds: [evidenceId],
              graphNodeId: targetNodeId,
              label: "Target",
              nodeKey: "target",
              nodeType: "Asset.CloudResource",
              properties: {},
              relatedEntityId: randomUUID(),
              relatedEntityType: "Asset",
              tenantId,
              updatedAt: new Date("2026-06-01T00:00:00.000Z")
            }
          ];
        }
      },
      pathBreaker: {
        async create({
          data
        }: {
          data: {
            description: string;
            evidenceIds: string[];
            pathId: string;
            priority: number;
            relatedNodeId: string | null;
            tenantId: string;
            title: string;
          };
        }) {
          return {
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            description: data.description,
            evidenceIds: data.evidenceIds,
            pathBreakerId: randomUUID(),
            pathId: data.pathId,
            priority: data.priority,
            relatedNodeId: data.relatedNodeId,
            tenantId: data.tenantId,
            title: data.title,
            updatedAt: new Date("2026-06-01T00:00:00.000Z")
          };
        }
      },
      pathEdge: {
        async create({
          data
        }: {
          data: {
            evidenceBasis: "Measured" | "Heuristic";
            evidenceIds: string[];
            measurementMethod: string | null;
            pathId: string;
            rationale: string | null;
            relationship: "CAN_ACCESS";
            sourceNodeId: string;
            targetNodeId: string;
            tenantId: string;
          };
        }) {
          return {
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            evidenceBasis: data.evidenceBasis,
            evidenceIds: data.evidenceIds,
            measurementMethod: data.measurementMethod,
            pathEdgeId: randomUUID(),
            pathId: data.pathId,
            rationale: data.rationale,
            relationship: data.relationship,
            sourceNodeId: data.sourceNodeId,
            targetNodeId: data.targetNodeId,
            tenantId: data.tenantId,
            updatedAt: new Date("2026-06-01T00:00:00.000Z")
          };
        }
      },
      pathNode: {
        async create({
          data
        }: {
          data: {
            entityId: string;
            entityType: "Asset" | "Exposure";
            evidenceIds: string[];
            label: string;
            pathId: string;
            sequence: number;
            tenantId: string;
          };
        }) {
          return {
            createdAt: new Date("2026-06-01T00:00:00.000Z"),
            entityId: data.entityId,
            entityType: data.entityType,
            evidenceIds: data.evidenceIds,
            label: data.label,
            pathId: data.pathId,
            pathNodeId: randomUUID(),
            sequence: data.sequence,
            tenantId: data.tenantId,
            updatedAt: new Date("2026-06-01T00:00:00.000Z")
          };
        }
      }
    };
    const graph = createPrismaEvidenceGraphService(fakePrisma as never);
    const attackPath = await graph.createAttackPath({
      confidence: 0.72,
      edgeIds: [],
      evidenceBasis: "Heuristic",
      evidenceIds: [evidenceId],
      impactScore: 68,
      name: "Fixture path",
      nodeIds: [sourceNodeId, targetNodeId],
      pathBreakers: [],
      tenantId,
      validationState: "Validated"
    });

    expect(attackPath.pathId).toBe(persistedPathId);
    expect(attackPath.pathNodes).toHaveLength(2);
    expect(
      attackPath.pathNodes.every((node) => node.pathId === persistedPathId)
    ).toBe(true);
  });
});
