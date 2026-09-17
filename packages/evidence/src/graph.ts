import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "@prisma/client";
import { getPrismaClient } from "@periscan/db";
import {
  AttackPathSchema,
  claimSafePathValidationStateForWrite,
  EdgeRelationshipSchema,
  GraphEdgeSchema,
  GraphNodeSchema,
  GraphNodeTypeSchema,
  PathBreakerSchema,
  PathEdgeSchema,
  PathNodeSchema,
  RelatedEntityTypeSchema,
  ValidationStateSchema,
  isRiskRelatedEntityType,
  type AttackPath,
  type GraphEdge,
  type GraphNode,
  type RelatedEntityType,
  type RiskRelatedEntityType,
  type ValidationState
} from "@periscan/shared";
import { z } from "zod";

import {
  EVIDENCE_ID_TABLE_TARGETS,
  unionEvidenceIds,
  withEvidenceIdsAppendLock
} from "./evidence-ids";

const IdListSchema = z.array(z.string().uuid());
const LooseObjectSchema = z.record(z.string(), z.unknown());

function edgeEvidenceBasis(
  properties: unknown,
  fallback: AttackPath["evidenceBasis"]
): AttackPath["evidenceBasis"] {
  if (
    properties &&
    typeof properties === "object" &&
    !Array.isArray(properties)
  ) {
    const value = (properties as Record<string, unknown>).evidenceBasis;
    if (value === "Measured" || value === "Heuristic") {
      return value;
    }
  }

  return fallback;
}

function edgeMeasurementMethod(
  properties: unknown,
  fallback: string | null | undefined
): string | null {
  if (
    properties &&
    typeof properties === "object" &&
    !Array.isArray(properties)
  ) {
    const value = (properties as Record<string, unknown>).measurementMethod;
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return fallback ?? null;
}

function weakestEdgeBasis(
  edges: Array<{ evidenceBasis: AttackPath["evidenceBasis"] }>
): AttackPath["evidenceBasis"] {
  return edges.length > 0 &&
    edges.every((edge) => edge.evidenceBasis === "Measured")
    ? "Measured"
    : "Heuristic";
}

export const UpsertGraphNodeInputSchema = z.object({
  evidenceIds: IdListSchema.default([]),
  label: z.string().min(1),
  nodeKey: z.string().min(1),
  // Closed graph ontology (P11-1): reject unknown families/leaves on write.
  nodeType: GraphNodeTypeSchema,
  properties: LooseObjectSchema.default({}),
  relatedEntityId: z.string().uuid().nullish(),
  // P09-13: risk partition only on graph nodes.
  relatedEntityType: RelatedEntityTypeSchema.nullish().refine(
    (value) =>
      value == null ||
      [
        "Scope",
        "Integration",
        "Asset",
        "Identity",
        "NonHumanIdentity",
        "ComplianceControlGovernance",
        "ControlSource",
        "AIApplication",
        "Exposure",
        "Scenario",
        "ValidationMission",
        "ValidationRun",
        "AttackPath",
        "RemediationTask",
        "RemediationAction",
        "VerificationEvent",
        "EvidencePack",
        "Runner",
        "RunnerTask",
        "ThreatAdvisory",
        "ThreatPackage",
        "AdvisoryImpactAssessment",
        "MissingSignal",
        "ThreatValidationPlan",
        "ThreatValidationPlanItem",
        "AdvisoryReadinessReport",
        "ValidationStimulus",
        "OperatorRecommendation"
      ].includes(value),
    {
      message:
        "GraphNode.relatedEntityType must be a RiskRelatedEntityType (P09-13)."
    }
  ),
  tenantId: z.string().uuid()
});

export const UpsertGraphEdgeInputSchema = z.object({
  evidenceIds: IdListSchema.default([]),
  // P11-14: first-class hop certainty (mirrors PathEdge).
  evidenceBasis: z.enum(["Measured", "Heuristic"]).default("Heuristic"),
  measurementMethod: z.string().min(1).nullish(),
  properties: LooseObjectSchema.default({}),
  rationale: z.string().min(1).nullish(),
  relationship: EdgeRelationshipSchema,
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  tenantId: z.string().uuid()
});

export const LinkGraphEvidenceInputSchema = z
  .object({
    evidenceId: z.string().uuid(),
    graphEdgeId: z.string().uuid().optional(),
    graphNodeId: z.string().uuid().optional()
  })
  .refine((value) => Boolean(value.graphEdgeId || value.graphNodeId), {
    message: "graphEdgeId or graphNodeId is required."
  });

export const FindPathsInputSchema = z.object({
  maxDepth: z.number().int().positive().max(8).default(5),
  sourceNodeId: z.string().uuid(),
  targetNodeId: z.string().uuid(),
  tenantId: z.string().uuid()
});

export const CreateAttackPathInputSchema = z.object({
  confidence: z.number().min(0).max(1),
  edgeIds: IdListSchema.default([]),
  evidenceBasis: z.enum(["Measured", "Heuristic"]).default("Heuristic"),
  evidenceIds: IdListSchema.default([]),
  impactScore: z.number().min(0),
  methodology: z.string().min(1).nullish(),
  name: z.string().min(1),
  nodeIds: IdListSchema.min(2),
  pathBreakers: z
    .array(
      z.object({
        description: z.string().min(1),
        evidenceIds: IdListSchema.default([]),
        priority: z.number().int().min(1).max(5),
        relatedNodeId: z.string().uuid().nullish(),
        title: z.string().min(1)
      })
    )
    .default([]),
  tenantId: z.string().uuid(),
  validationState: ValidationStateSchema
});

export type UpsertGraphNodeInput = z.input<typeof UpsertGraphNodeInputSchema>;
export type UpsertGraphEdgeInput = z.input<typeof UpsertGraphEdgeInputSchema>;
export type LinkGraphEvidenceInput = z.input<
  typeof LinkGraphEvidenceInputSchema
>;
export type FindPathsInput = z.input<typeof FindPathsInputSchema>;
export type CreateAttackPathInput = z.input<typeof CreateAttackPathInputSchema>;

export interface GraphPathResult {
  edgeIds: string[];
  nodeIds: string[];
}

export interface EvidenceGraphService {
  createAttackPath(input: CreateAttackPathInput): Promise<AttackPath>;
  findPaths(input: FindPathsInput): Promise<GraphPathResult[]>;
  getNeighbors(
    tenantId: string,
    graphNodeId: string
  ): Promise<{
    edges: GraphEdge[];
    neighbors: GraphNode[];
    node: GraphNode;
  } | null>;
  linkEvidence(input: LinkGraphEvidenceInput): Promise<GraphEdge | GraphNode>;
  updatePathState(
    pathId: string,
    validationState: ValidationState
  ): Promise<AttackPath>;
  upsertEdge(input: UpsertGraphEdgeInput): Promise<GraphEdge>;
  upsertNode(input: UpsertGraphNodeInput): Promise<GraphNode>;
}

function appendUniqueIds(existing: string[], incoming: string[]) {
  return [...new Set([...existing, ...incoming])];
}

function toRiskRelatedEntityType(
  value: string | null | undefined
): RiskRelatedEntityType | null {
  if (value && isRiskRelatedEntityType(value)) {
    return value;
  }
  // P09-13: platform types on legacy rows are dropped from graph coordinates.
  return null;
}

function serializeGraphNode(record: {
  createdAt: Date;
  evidenceIds: string[];
  graphNodeId: string;
  label: string;
  nodeKey: string;
  nodeType: string;
  properties: Prisma.JsonValue | Record<string, unknown>;
  relatedEntityId: string | null;
  relatedEntityType: string | null;
  tenantId: string;
  updatedAt: Date;
}): GraphNode {
  return GraphNodeSchema.parse({
    createdAt: record.createdAt.toISOString(),
    evidenceIds: record.evidenceIds,
    graphNodeId: record.graphNodeId,
    label: record.label,
    nodeKey: record.nodeKey,
    nodeType: record.nodeType,
    properties:
      typeof record.properties === "object" && record.properties
        ? (record.properties as Record<string, unknown>)
        : {},
    relatedEntityId: record.relatedEntityId,
    relatedEntityType: toRiskRelatedEntityType(record.relatedEntityType),
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  });
}

function serializeGraphEdge(record: {
  createdAt: Date;
  evidenceBasis?: GraphEdge["evidenceBasis"] | null;
  evidenceIds: string[];
  graphEdgeId: string;
  measurementMethod?: string | null;
  properties: Prisma.JsonValue | Record<string, unknown>;
  rationale: string | null;
  relationship: GraphEdge["relationship"];
  sourceNodeId: string;
  targetNodeId: string;
  tenantId: string;
  updatedAt: Date;
}): GraphEdge {
  const properties =
    typeof record.properties === "object" && record.properties
      ? (record.properties as Record<string, unknown>)
      : {};
  // Prefer first-class columns when present; fall back to property bag (pre-migration rows).
  const evidenceBasis =
    record.evidenceBasis === "Measured" || record.evidenceBasis === "Heuristic"
      ? record.evidenceBasis
      : edgeEvidenceBasis(properties, "Heuristic");
  const measurementMethod =
    typeof record.measurementMethod === "string" &&
    record.measurementMethod.length > 0
      ? record.measurementMethod
      : edgeMeasurementMethod(properties, null);

  return GraphEdgeSchema.parse({
    createdAt: record.createdAt.toISOString(),
    evidenceBasis,
    evidenceIds: record.evidenceIds,
    graphEdgeId: record.graphEdgeId,
    measurementMethod,
    properties,
    rationale: record.rationale,
    relationship: record.relationship,
    sourceNodeId: record.sourceNodeId,
    targetNodeId: record.targetNodeId,
    tenantId: record.tenantId,
    updatedAt: record.updatedAt.toISOString()
  });
}

/** Merge first-class hop certainty into properties for backward-compatible writers. */
function mergeEdgeProperties(
  properties: Record<string, unknown>,
  evidenceBasis: "Measured" | "Heuristic",
  measurementMethod: string | null | undefined
): Record<string, unknown> {
  return {
    ...properties,
    evidenceBasis,
    ...(measurementMethod ? { measurementMethod } : {})
  };
}

function toAttackPath(input: {
  createdAt: Date;
  confidence: number;
  evidenceBasis: AttackPath["evidenceBasis"];
  evidenceIds: string[];
  impactScore: number;
  methodology: string | null;
  name: string;
  pathEdges: Array<{
    createdAt: Date;
    evidenceBasis: AttackPath["evidenceBasis"];
    evidenceIds: string[];
    measurementMethod: string | null;
    pathEdgeId: string;
    pathId: string;
    rationale: string | null;
    relationship: GraphEdge["relationship"];
    sourceNodeId: string;
    targetNodeId: string;
    tenantId: string;
    updatedAt: Date;
  }>;
  pathBreakers: Array<{
    createdAt: Date;
    description: string;
    evidenceIds: string[];
    pathBreakerId: string;
    pathId: string;
    priority: number;
    relatedNodeId: string | null;
    tenantId: string;
    title: string;
    updatedAt: Date;
  }>;
  pathId: string;
  pathNodes: Array<{
    createdAt: Date;
    entityId: string;
    entityType: RelatedEntityType;
    evidenceIds: string[];
    label: string;
    pathId: string;
    pathNodeId: string;
    sequence: number;
    tenantId: string;
    updatedAt: Date;
  }>;
  tenantId: string;
  updatedAt: Date;
  validationState: ValidationState;
}): AttackPath {
  return AttackPathSchema.parse({
    confidence: input.confidence,
    createdAt: input.createdAt.toISOString(),
    evidenceBasis: input.evidenceBasis,
    evidenceIds: input.evidenceIds,
    impactScore: input.impactScore,
    impactNodeId:
      input.pathNodes[input.pathNodes.length - 1]?.pathNodeId ??
      input.pathNodes[0]!.pathNodeId,
    entryNodeId: input.pathNodes[0]!.pathNodeId,
    methodology: input.methodology,
    name: input.name,
    pathBreakers: input.pathBreakers.map((breaker) =>
      PathBreakerSchema.parse({
        createdAt: breaker.createdAt.toISOString(),
        description: breaker.description,
        evidenceIds: breaker.evidenceIds,
        pathBreakerId: breaker.pathBreakerId,
        pathId: breaker.pathId,
        priority: breaker.priority,
        relatedNodeId: breaker.relatedNodeId,
        tenantId: breaker.tenantId,
        title: breaker.title,
        updatedAt: breaker.updatedAt.toISOString()
      })
    ),
    pathEdges: input.pathEdges.map((edge) =>
      PathEdgeSchema.parse({
        createdAt: edge.createdAt.toISOString(),
        evidenceBasis: edge.evidenceBasis,
        evidenceIds: edge.evidenceIds,
        measurementMethod: edge.measurementMethod,
        pathEdgeId: edge.pathEdgeId,
        pathId: edge.pathId,
        rationale: edge.rationale,
        relationship: edge.relationship,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        tenantId: edge.tenantId,
        updatedAt: edge.updatedAt.toISOString()
      })
    ),
    pathId: input.pathId,
    pathNodes: input.pathNodes.map((node) =>
      PathNodeSchema.parse({
        createdAt: node.createdAt.toISOString(),
        entityId: node.entityId,
        entityType: node.entityType,
        evidenceIds: node.evidenceIds,
        label: node.label,
        pathId: node.pathId,
        pathNodeId: node.pathNodeId,
        sequence: node.sequence,
        tenantId: node.tenantId,
        updatedAt: node.updatedAt.toISOString()
      })
    ),
    tenantId: input.tenantId,
    updatedAt: input.updatedAt.toISOString(),
    validationState: input.validationState
  });
}

function findPathsInDirectedGraph(
  edges: GraphEdge[],
  sourceNodeId: string,
  targetNodeId: string,
  maxDepth: number
) {
  const adjacency = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    const list = adjacency.get(edge.sourceNodeId) ?? [];

    list.push(edge);
    adjacency.set(edge.sourceNodeId, list);
  }

  const results: GraphPathResult[] = [];
  const queue: GraphPathResult[] = [
    {
      edgeIds: [],
      nodeIds: [sourceNodeId]
    }
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const lastNodeId = current.nodeIds[current.nodeIds.length - 1]!;

    if (lastNodeId === targetNodeId) {
      results.push(current);
      continue;
    }

    if (current.edgeIds.length >= maxDepth) {
      continue;
    }

    for (const edge of adjacency.get(lastNodeId) ?? []) {
      if (current.nodeIds.includes(edge.targetNodeId)) {
        continue;
      }

      queue.push({
        edgeIds: [...current.edgeIds, edge.graphEdgeId],
        nodeIds: [...current.nodeIds, edge.targetNodeId]
      });
    }
  }

  return results;
}

class InMemoryEvidenceGraphService implements EvidenceGraphService {
  public readonly attackPaths = new Map<string, AttackPath>();
  public readonly edges = new Map<string, GraphEdge>();
  public readonly nodes = new Map<string, GraphNode>();

  async upsertNode(payload: UpsertGraphNodeInput) {
    const input = UpsertGraphNodeInputSchema.parse(payload);
    const existing = [...this.nodes.values()].find(
      (node) =>
        node.tenantId === input.tenantId &&
        node.nodeType === input.nodeType &&
        node.nodeKey === input.nodeKey
    );
    const timestamp = new Date().toISOString();
    const node = GraphNodeSchema.parse({
      createdAt: existing?.createdAt ?? timestamp,
      evidenceIds: appendUniqueIds(
        existing?.evidenceIds ?? [],
        input.evidenceIds
      ),
      graphNodeId: existing?.graphNodeId ?? randomUUID(),
      label: input.label,
      nodeKey: input.nodeKey,
      nodeType: input.nodeType,
      properties: input.properties,
      relatedEntityId: input.relatedEntityId ?? null,
      relatedEntityType: input.relatedEntityType ?? null,
      tenantId: input.tenantId,
      updatedAt: timestamp
    });

    this.nodes.set(node.graphNodeId, node);

    return node;
  }

  async upsertEdge(payload: UpsertGraphEdgeInput) {
    const input = UpsertGraphEdgeInputSchema.parse(payload);
    const existing = [...this.edges.values()].find(
      (edge) =>
        edge.tenantId === input.tenantId &&
        edge.sourceNodeId === input.sourceNodeId &&
        edge.targetNodeId === input.targetNodeId &&
        edge.relationship === input.relationship
    );
    const timestamp = new Date().toISOString();
    const evidenceBasis =
      input.evidenceBasis ??
      edgeEvidenceBasis(input.properties, existing?.evidenceBasis ?? "Heuristic");
    const measurementMethod =
      input.measurementMethod !== undefined
        ? input.measurementMethod
        : edgeMeasurementMethod(
            input.properties,
            existing?.measurementMethod ?? null
          );
    const edge = GraphEdgeSchema.parse({
      createdAt: existing?.createdAt ?? timestamp,
      evidenceBasis,
      evidenceIds: appendUniqueIds(
        existing?.evidenceIds ?? [],
        input.evidenceIds
      ),
      graphEdgeId: existing?.graphEdgeId ?? randomUUID(),
      measurementMethod,
      properties: mergeEdgeProperties(
        input.properties,
        evidenceBasis,
        measurementMethod
      ),
      rationale: input.rationale ?? null,
      relationship: input.relationship,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      tenantId: input.tenantId,
      updatedAt: timestamp
    });

    this.edges.set(edge.graphEdgeId, edge);

    return edge;
  }

  async getNeighbors(tenantId: string, graphNodeId: string) {
    const node = this.nodes.get(graphNodeId);

    if (!node || node.tenantId !== tenantId) {
      return null;
    }

    const edges = [...this.edges.values()].filter(
      (edge) =>
        edge.tenantId === tenantId &&
        (edge.sourceNodeId === graphNodeId || edge.targetNodeId === graphNodeId)
    );
    const neighborIds = new Set<string>();

    for (const edge of edges) {
      neighborIds.add(
        edge.sourceNodeId === graphNodeId
          ? edge.targetNodeId
          : edge.sourceNodeId
      );
    }

    return {
      edges,
      neighbors: [...neighborIds]
        .map((id) => this.nodes.get(id))
        .filter((value): value is GraphNode => Boolean(value)),
      node
    };
  }

  async findPaths(payload: FindPathsInput) {
    const input = FindPathsInputSchema.parse(payload);

    return findPathsInDirectedGraph(
      [...this.edges.values()].filter(
        (edge) => edge.tenantId === input.tenantId
      ),
      input.sourceNodeId,
      input.targetNodeId,
      input.maxDepth
    );
  }

  async createAttackPath(payload: CreateAttackPathInput) {
    const input = CreateAttackPathInputSchema.parse(payload);
    const timestamp = new Date().toISOString();
    const graphNodes = input.nodeIds.map((nodeId) => {
      const node = this.nodes.get(nodeId);

      if (!node || node.tenantId !== input.tenantId) {
        throw new Error(`Graph node not found: ${nodeId}`);
      }

      if (!node.relatedEntityType || !node.relatedEntityId) {
        throw new Error(
          `Graph node ${nodeId} cannot be projected into an attack path.`
        );
      }

      return node;
    });
    const graphEdges =
      input.edgeIds.length > 0
        ? input.edgeIds.map((edgeId) => {
            const edge = this.edges.get(edgeId);

            if (!edge || edge.tenantId !== input.tenantId) {
              throw new Error(`Graph edge not found: ${edgeId}`);
            }

            return edge;
          })
        : graphNodes.slice(0, -1).map((node, index) => {
            const nextNode = graphNodes[index + 1]!;
            const edge = [...this.edges.values()].find(
              (candidate) =>
                candidate.tenantId === input.tenantId &&
                candidate.sourceNodeId === node.graphNodeId &&
                candidate.targetNodeId === nextNode.graphNodeId
            );

            if (!edge) {
              throw new Error(
                `Graph edge not found between ${node.graphNodeId} and ${nextNode.graphNodeId}.`
              );
            }

            return edge;
          });
    const pathId = randomUUID();
    const pathNodes = graphNodes.map((node, index) =>
      PathNodeSchema.parse({
        createdAt: timestamp,
        entityId: node.relatedEntityId!,
        entityType: node.relatedEntityType!,
        evidenceIds: appendUniqueIds(node.evidenceIds, input.evidenceIds),
        label: node.label,
        pathId,
        pathNodeId: randomUUID(),
        sequence: index,
        tenantId: input.tenantId,
        updatedAt: timestamp
      })
    );
    const graphToPathNode = new Map(
      graphNodes.map(
        (node, index) => [node.graphNodeId, pathNodes[index]!] as const
      )
    );
    const pathEdges = graphEdges.map((edge) =>
      PathEdgeSchema.parse({
        createdAt: timestamp,
        evidenceBasis: edge.evidenceBasis ?? edgeEvidenceBasis(edge.properties, input.evidenceBasis),
        evidenceIds: appendUniqueIds(edge.evidenceIds, input.evidenceIds),
        measurementMethod: edge.measurementMethod ?? edgeMeasurementMethod(
          edge.properties,
          input.methodology
        ),
        pathEdgeId: randomUUID(),
        pathId,
        rationale: edge.rationale ?? null,
        relationship: edge.relationship,
        sourceNodeId: graphToPathNode.get(edge.sourceNodeId)!.pathNodeId,
        targetNodeId: graphToPathNode.get(edge.targetNodeId)!.pathNodeId,
        tenantId: input.tenantId,
        updatedAt: timestamp
      })
    );
    const pathBreakers = input.pathBreakers.map((breaker) =>
      PathBreakerSchema.parse({
        createdAt: timestamp,
        description: breaker.description,
        evidenceIds: breaker.evidenceIds,
        pathBreakerId: randomUUID(),
        pathId,
        priority: breaker.priority,
        relatedNodeId: breaker.relatedNodeId
          ? (graphToPathNode.get(breaker.relatedNodeId)?.pathNodeId ?? null)
          : null,
        tenantId: input.tenantId,
        title: breaker.title,
        updatedAt: timestamp
      })
    );
    const pathEvidenceBasis = weakestEdgeBasis(pathEdges);
    // P09-2: refuse to persist Reachable/Validated/Exploitable without hop
    // measurement that supports the claim (claim-safe write clamp).
    const claimSafeValidationState = claimSafePathValidationStateForWrite({
      evidenceBasis: pathEvidenceBasis,
      pathEdges,
      requestedValidationState: input.validationState
    });
    const attackPath = AttackPathSchema.parse({
      confidence: input.confidence,
      createdAt: timestamp,
      evidenceBasis: pathEvidenceBasis,
      evidenceIds: input.evidenceIds,
      entryNodeId: pathNodes[0]!.pathNodeId,
      impactNodeId: pathNodes[pathNodes.length - 1]!.pathNodeId,
      impactScore: input.impactScore,
      methodology: input.methodology ?? null,
      name: input.name,
      pathBreakers,
      pathEdges,
      pathId,
      pathNodes,
      tenantId: input.tenantId,
      updatedAt: timestamp,
      validationState: claimSafeValidationState
    });

    this.attackPaths.set(pathId, attackPath);

    return attackPath;
  }

  async updatePathState(pathId: string, validationState: ValidationState) {
    const path = this.attackPaths.get(pathId);

    if (!path) {
      throw new Error(`Attack path not found: ${pathId}`);
    }

    const claimSafeValidationState = claimSafePathValidationStateForWrite({
      evidenceBasis: path.evidenceBasis,
      pathEdges: path.pathEdges,
      requestedValidationState: validationState
    });

    const updatedPath = AttackPathSchema.parse({
      ...path,
      updatedAt: new Date().toISOString(),
      validationState: claimSafeValidationState
    });

    this.attackPaths.set(pathId, updatedPath);

    return updatedPath;
  }

  async linkEvidence(payload: LinkGraphEvidenceInput) {
    const input = LinkGraphEvidenceInputSchema.parse(payload);

    if (input.graphNodeId) {
      const node = this.nodes.get(input.graphNodeId);

      if (!node) {
        throw new Error(`Graph node not found: ${input.graphNodeId}`);
      }

      const updatedNode = GraphNodeSchema.parse({
        ...node,
        evidenceIds: appendUniqueIds(node.evidenceIds, [input.evidenceId]),
        updatedAt: new Date().toISOString()
      });

      this.nodes.set(updatedNode.graphNodeId, updatedNode);

      return updatedNode;
    }

    const edge = this.edges.get(input.graphEdgeId!);

    if (!edge) {
      throw new Error(`Graph edge not found: ${input.graphEdgeId}`);
    }

    const updatedEdge = GraphEdgeSchema.parse({
      ...edge,
      evidenceIds: appendUniqueIds(edge.evidenceIds, [input.evidenceId]),
      updatedAt: new Date().toISOString()
    });

    this.edges.set(updatedEdge.graphEdgeId, updatedEdge);

    return updatedEdge;
  }
}

class PrismaEvidenceGraphService implements EvidenceGraphService {
  constructor(private readonly prisma: PrismaClient = getPrismaClient()) {}

  async upsertNode(payload: UpsertGraphNodeInput) {
    const input = UpsertGraphNodeInputSchema.parse(payload);
    // Lock on the stable natural key so concurrent upserts of the same node
    // cannot clobber each other's evidenceIds (or race create/update).
    const lockEntityId = `${input.tenantId}:${input.nodeType}:${input.nodeKey}`;

    const node = await withEvidenceIdsAppendLock(
      this.prisma,
      EVIDENCE_ID_TABLE_TARGETS.GraphNode.table,
      lockEntityId,
      async (tx) => {
        const existing = await tx.graphNode.findUnique({
          where: {
            tenantId_nodeType_nodeKey: {
              nodeKey: input.nodeKey,
              nodeType: input.nodeType,
              tenantId: input.tenantId
            }
          }
        });

        if (existing) {
          return tx.graphNode.update({
            where: {
              graphNodeId: existing.graphNodeId
            },
            data: {
              evidenceIds: unionEvidenceIds(
                existing.evidenceIds,
                input.evidenceIds
              ),
              label: input.label,
              properties: input.properties as Prisma.InputJsonValue,
              relatedEntityId: input.relatedEntityId ?? null,
              relatedEntityType: input.relatedEntityType ?? null
            }
          });
        }

        return tx.graphNode.create({
          data: {
            evidenceIds: input.evidenceIds,
            label: input.label,
            nodeKey: input.nodeKey,
            nodeType: input.nodeType,
            properties: input.properties as Prisma.InputJsonValue,
            relatedEntityId: input.relatedEntityId ?? null,
            relatedEntityType: input.relatedEntityType ?? null,
            tenantId: input.tenantId
          }
        });
      }
    );

    return serializeGraphNode(node);
  }

  async upsertEdge(payload: UpsertGraphEdgeInput) {
    const input = UpsertGraphEdgeInputSchema.parse(payload);
    const lockEntityId = `${input.tenantId}:${input.sourceNodeId}:${input.targetNodeId}:${input.relationship}`;

    const edge = await withEvidenceIdsAppendLock(
      this.prisma,
      EVIDENCE_ID_TABLE_TARGETS.GraphEdge.table,
      lockEntityId,
      async (tx) => {
        const existing = await tx.graphEdge.findUnique({
          where: {
            tenantId_sourceNodeId_targetNodeId_relationship: {
              relationship: input.relationship,
              sourceNodeId: input.sourceNodeId,
              targetNodeId: input.targetNodeId,
              tenantId: input.tenantId
            }
          }
        });
        const evidenceBasis =
          input.evidenceBasis ??
          edgeEvidenceBasis(
            input.properties,
            edgeEvidenceBasis(existing?.properties, "Heuristic")
          );
        const measurementMethod =
          input.measurementMethod !== undefined
            ? input.measurementMethod
            : edgeMeasurementMethod(
                input.properties,
                edgeMeasurementMethod(existing?.properties, null)
              );
        // P11-14: first-class hop certainty columns + property mirror for back-compat readers.
        const properties = mergeEdgeProperties(
          input.properties,
          evidenceBasis,
          measurementMethod
        );

        if (existing) {
          return tx.graphEdge.update({
            where: {
              graphEdgeId: existing.graphEdgeId
            },
            data: {
              evidenceBasis,
              evidenceIds: unionEvidenceIds(
                existing.evidenceIds,
                input.evidenceIds
              ),
              measurementMethod: measurementMethod ?? null,
              properties: properties as Prisma.InputJsonValue,
              rationale: input.rationale ?? null
            }
          });
        }

        return tx.graphEdge.create({
          data: {
            evidenceBasis,
            evidenceIds: input.evidenceIds,
            measurementMethod: measurementMethod ?? null,
            properties: properties as Prisma.InputJsonValue,
            rationale: input.rationale ?? null,
            relationship: input.relationship,
            sourceNodeId: input.sourceNodeId,
            targetNodeId: input.targetNodeId,
            tenantId: input.tenantId
          }
        });
      }
    );

    return serializeGraphEdge(edge);
  }

  async getNeighbors(tenantId: string, graphNodeId: string) {
    const node = await this.prisma.graphNode.findFirst({
      where: {
        graphNodeId,
        tenantId
      }
    });

    if (!node) {
      return null;
    }

    const edges = await this.prisma.graphEdge.findMany({
      where: {
        tenantId,
        OR: [
          {
            sourceNodeId: graphNodeId
          },
          {
            targetNodeId: graphNodeId
          }
        ]
      }
    });
    const neighborIds = [
      ...new Set(
        edges.flatMap((edge) => [
          edge.sourceNodeId === graphNodeId
            ? edge.targetNodeId
            : edge.sourceNodeId
        ])
      )
    ];
    const neighbors = await this.prisma.graphNode.findMany({
      where: {
        graphNodeId: {
          in: neighborIds
        },
        tenantId
      }
    });

    return {
      edges: edges.map(serializeGraphEdge),
      neighbors: neighbors.map(serializeGraphNode),
      node: serializeGraphNode(node)
    };
  }

  async findPaths(payload: FindPathsInput) {
    const input = FindPathsInputSchema.parse(payload);
    const edges = await this.prisma.graphEdge.findMany({
      where: {
        tenantId: input.tenantId
      }
    });

    return findPathsInDirectedGraph(
      edges.map(serializeGraphEdge),
      input.sourceNodeId,
      input.targetNodeId,
      input.maxDepth
    );
  }

  async createAttackPath(payload: CreateAttackPathInput) {
    const input = CreateAttackPathInputSchema.parse(payload);
    const graphNodes = await this.prisma.graphNode.findMany({
      where: {
        graphNodeId: {
          in: input.nodeIds
        },
        tenantId: input.tenantId
      }
    });

    if (graphNodes.length !== input.nodeIds.length) {
      throw new Error("One or more graph nodes were not found.");
    }

    for (const node of graphNodes) {
      if (!node.relatedEntityType || !node.relatedEntityId) {
        throw new Error(
          `Graph node ${node.graphNodeId} cannot be projected into an attack path.`
        );
      }
    }

    const graphEdges =
      input.edgeIds.length > 0
        ? await this.prisma.graphEdge.findMany({
            where: {
              graphEdgeId: {
                in: input.edgeIds
              },
              tenantId: input.tenantId
            }
          })
        : await this.prisma.graphEdge.findMany({
            where: {
              tenantId: input.tenantId
            }
          });

    const attackPathRecord = await this.prisma.attackPath.create({
      data: {
        confidence: input.confidence,
        entryNodeId: randomUUID(),
        evidenceBasis: input.evidenceBasis,
        evidenceIds: input.evidenceIds,
        impactNodeId: randomUUID(),
        impactScore: input.impactScore,
        methodology: input.methodology ?? null,
        name: input.name,
        tenantId: input.tenantId,
        validationState: input.validationState
      }
    });
    const pathId = attackPathRecord.pathId;

    const pathNodes = [];
    const graphNodeIdToPathNodeId = new Map<string, string>();

    for (const [index, nodeId] of input.nodeIds.entries()) {
      const graphNode = graphNodes.find((item) => item.graphNodeId === nodeId)!;
      const pathNode = await this.prisma.pathNode.create({
        data: {
          entityId: graphNode.relatedEntityId!,
          entityType: graphNode.relatedEntityType!,
          evidenceIds: appendUniqueIds(
            graphNode.evidenceIds,
            input.evidenceIds
          ),
          label: graphNode.label,
          pathId,
          sequence: index,
          tenantId: input.tenantId
        }
      });

      graphNodeIdToPathNodeId.set(graphNode.graphNodeId, pathNode.pathNodeId);
      pathNodes.push(pathNode);
    }

    await this.prisma.attackPath.update({
      where: {
        pathId
      },
      data: {
        entryNodeId: pathNodes[0]!.pathNodeId,
        impactNodeId: pathNodes[pathNodes.length - 1]!.pathNodeId
      }
    });

    const selectedEdges =
      input.edgeIds.length > 0
        ? graphEdges
        : input.nodeIds.slice(0, -1).map((nodeId, index) => {
            const nextNodeId = input.nodeIds[index + 1]!;
            const edge = graphEdges.find(
              (candidate) =>
                candidate.sourceNodeId === nodeId &&
                candidate.targetNodeId === nextNodeId
            );

            if (!edge) {
              throw new Error(
                `Graph edge not found between ${nodeId} and ${nextNodeId}.`
              );
            }

            return edge;
          });

    const pathEdges = [];

    for (const edge of selectedEdges) {
      pathEdges.push(
        await this.prisma.pathEdge.create({
          data: {
            evidenceBasis:
              edge.evidenceBasis === "Measured" ||
              edge.evidenceBasis === "Heuristic"
                ? edge.evidenceBasis
                : edgeEvidenceBasis(edge.properties, input.evidenceBasis),
            evidenceIds: appendUniqueIds(edge.evidenceIds, input.evidenceIds),
            measurementMethod:
              typeof edge.measurementMethod === "string" &&
              edge.measurementMethod.length > 0
                ? edge.measurementMethod
                : edgeMeasurementMethod(edge.properties, input.methodology),
            pathId,
            rationale: edge.rationale ?? null,
            relationship: edge.relationship,
            sourceNodeId: graphNodeIdToPathNodeId.get(edge.sourceNodeId)!,
            targetNodeId: graphNodeIdToPathNodeId.get(edge.targetNodeId)!,
            tenantId: input.tenantId
          }
        })
      );
    }

    const pathEvidenceBasis = weakestEdgeBasis(pathEdges);
    // P09-2: claim-safe validationState after edges exist (may remap overclaim).
    const provisionalPath = toAttackPath({
      createdAt: attackPathRecord.createdAt,
      confidence: attackPathRecord.confidence,
      evidenceBasis: pathEvidenceBasis,
      evidenceIds: attackPathRecord.evidenceIds,
      impactScore: attackPathRecord.impactScore,
      methodology: attackPathRecord.methodology,
      name: attackPathRecord.name,
      pathBreakers: [],
      pathEdges,
      pathId,
      pathNodes,
      tenantId: input.tenantId,
      updatedAt: attackPathRecord.updatedAt,
      validationState: input.validationState
    });
    const claimSafeValidationState = claimSafePathValidationStateForWrite({
      evidenceBasis: provisionalPath.evidenceBasis,
      pathEdges: provisionalPath.pathEdges,
      requestedValidationState: input.validationState
    });

    const finalAttackPathRecord = await this.prisma.attackPath.update({
      data: {
        evidenceBasis: pathEvidenceBasis,
        validationState: claimSafeValidationState
      },
      where: {
        pathId
      }
    });

    const pathBreakers = [];

    for (const breaker of input.pathBreakers) {
      pathBreakers.push(
        await this.prisma.pathBreaker.create({
          data: {
            description: breaker.description,
            evidenceIds: breaker.evidenceIds,
            pathId,
            priority: breaker.priority,
            relatedNodeId: breaker.relatedNodeId
              ? (graphNodeIdToPathNodeId.get(breaker.relatedNodeId) ?? null)
              : null,
            tenantId: input.tenantId,
            title: breaker.title
          }
        })
      );
    }

    return toAttackPath({
      createdAt: finalAttackPathRecord.createdAt,
      confidence: finalAttackPathRecord.confidence,
      evidenceBasis: finalAttackPathRecord.evidenceBasis,
      evidenceIds: finalAttackPathRecord.evidenceIds,
      impactScore: finalAttackPathRecord.impactScore,
      methodology: finalAttackPathRecord.methodology,
      name: finalAttackPathRecord.name,
      pathBreakers,
      pathEdges,
      pathId: finalAttackPathRecord.pathId,
      pathNodes,
      tenantId: input.tenantId,
      updatedAt: finalAttackPathRecord.updatedAt,
      validationState: finalAttackPathRecord.validationState
    });
  }

  async updatePathState(pathId: string, validationState: ValidationState) {
    const pathNodes = await this.prisma.pathNode.findMany({
      orderBy: {
        sequence: "asc"
      },
      where: {
        pathId
      }
    });
    const pathEdges = await this.prisma.pathEdge.findMany({
      orderBy: {
        createdAt: "asc"
      },
      where: {
        pathId
      }
    });
    const existing = await this.prisma.attackPath.findUniqueOrThrow({
      where: {
        pathId
      }
    });
    const claimSafeValidationState = claimSafePathValidationStateForWrite({
      evidenceBasis: existing.evidenceBasis as AttackPath["evidenceBasis"],
      pathEdges: pathEdges.map((edge) =>
        PathEdgeSchema.parse({
          createdAt: edge.createdAt.toISOString(),
          evidenceBasis: edge.evidenceBasis,
          evidenceIds: edge.evidenceIds,
          measurementMethod: edge.measurementMethod,
          pathEdgeId: edge.pathEdgeId,
          pathId: edge.pathId,
          rationale: edge.rationale,
          relationship: edge.relationship,
          sourceNodeId: edge.sourceNodeId,
          targetNodeId: edge.targetNodeId,
          tenantId: edge.tenantId,
          updatedAt: edge.updatedAt.toISOString()
        })
      ),
      requestedValidationState: validationState
    });

    const record = await this.prisma.attackPath.update({
      where: {
        pathId
      },
      data: {
        validationState: claimSafeValidationState
      }
    });
    const pathBreakers = await this.prisma.pathBreaker.findMany({
      orderBy: {
        createdAt: "asc"
      },
      where: {
        pathId
      }
    });

    return toAttackPath({
      createdAt: record.createdAt,
      confidence: record.confidence,
      evidenceBasis: record.evidenceBasis,
      evidenceIds: record.evidenceIds,
      impactScore: record.impactScore,
      methodology: record.methodology,
      name: record.name,
      pathBreakers,
      pathEdges,
      pathId: record.pathId,
      pathNodes,
      tenantId: record.tenantId,
      updatedAt: record.updatedAt,
      validationState: record.validationState
    });
  }

  async linkEvidence(payload: LinkGraphEvidenceInput) {
    const input = LinkGraphEvidenceInputSchema.parse(payload);

    if (input.graphNodeId) {
      const updatedNode = await withEvidenceIdsAppendLock(
        this.prisma,
        EVIDENCE_ID_TABLE_TARGETS.GraphNode.table,
        input.graphNodeId,
        async (tx) => {
          const existingNode = await tx.graphNode.findUnique({
            where: {
              graphNodeId: input.graphNodeId
            }
          });

          if (!existingNode) {
            throw new Error(`Graph node not found: ${input.graphNodeId}`);
          }

          return tx.graphNode.update({
            where: {
              graphNodeId: input.graphNodeId
            },
            data: {
              evidenceIds: unionEvidenceIds(existingNode.evidenceIds, [
                input.evidenceId
              ])
            }
          });
        }
      );

      return serializeGraphNode(updatedNode);
    }

    const graphEdgeId = input.graphEdgeId!;
    const updatedEdge = await withEvidenceIdsAppendLock(
      this.prisma,
      EVIDENCE_ID_TABLE_TARGETS.GraphEdge.table,
      graphEdgeId,
      async (tx) => {
        const existingEdge = await tx.graphEdge.findUnique({
          where: {
            graphEdgeId
          }
        });

        if (!existingEdge) {
          throw new Error(`Graph edge not found: ${graphEdgeId}`);
        }

        return tx.graphEdge.update({
          where: {
            graphEdgeId
          },
          data: {
            evidenceIds: unionEvidenceIds(existingEdge.evidenceIds, [
              input.evidenceId
            ])
          }
        });
      }
    );

    return serializeGraphEdge(updatedEdge);
  }
}

export function createInMemoryEvidenceGraphService() {
  return new InMemoryEvidenceGraphService();
}

export function createPrismaEvidenceGraphService(prisma = getPrismaClient()) {
  return new PrismaEvidenceGraphService(prisma);
}

// P11-5 / P11-10 residual: Living-map / Cyber Terrain / swarm-KB stubs
// (seedDiscoveryAssetsForASVEASM, queryForTerrain, computeLivingMapDelta,
// queryContinuousInventory, $$ crown-jewel helpers) were removed from this
// production surface. They live only in
// packages/evidence/src/fixtures/living-map-terrain.ts and are not re-exported
// from @periscan/evidence. Real inventory/path truth is Asset + GraphNode.
// Customer-visible Threat Center does not render a Living Map SVG fixture.
