// @ts-nocheck
/**
 * P11-7 object workspace + graph neighborhood read plane.
 * Tenant-scoped, risk-partition entity types only.
 */

import { createPrismaEvidenceGraphService } from "@periscan/evidence";
import {
  isRiskRelatedEntityType,
  type GraphEdge,
  type GraphNode
} from "@periscan/shared";

import type { AuthenticatedContext } from "../runtime-services.js";
import type { RuntimeServiceDeps } from "../runtime-services.js";
import { AppServiceError } from "../runtime-services.js";

export type ObjectWorkspaceResponse = {
  edges: GraphEdge[];
  neighbors: GraphNode[];
  node: GraphNode | null;
  relatedEntity: {
    entityId: string;
    entityType: string;
    found: boolean;
  };
};

export function createObjectWorkspaceServices(deps: RuntimeServiceDeps) {
  const { prisma } = deps;
  const graph = createPrismaEvidenceGraphService(prisma);

  return {
    async getObjectWorkspace(context: AuthenticatedContext, entityType: string, entityId: string) {
      if (!isRiskRelatedEntityType(entityType)) {
        throw new AppServiceError(
          "Object workspace supports RiskRelatedEntityType only (P09-13).",
          400,
          "object_workspace_platform_type"
        );
      }

      const node = await prisma.graphNode.findFirst({
        orderBy: { updatedAt: "desc" },
        where: {
          relatedEntityId: entityId,
          relatedEntityType: entityType,
          tenantId: context.tenant.tenantId
        }
      });

      if (!node) {
        return {
          edges: [],
          neighbors: [],
          node: null,
          relatedEntity: {
            entityId,
            entityType,
            found: false
          }
        } satisfies ObjectWorkspaceResponse;
      }

      const neighborhood = await graph.getNeighbors(
        context.tenant.tenantId,
        node.graphNodeId
      );

      return {
        edges: neighborhood?.edges ?? [],
        neighbors: neighborhood?.neighbors ?? [],
        node: neighborhood?.node ?? null,
        relatedEntity: {
          entityId,
          entityType,
          found: true
        }
      } satisfies ObjectWorkspaceResponse;
    },

    async getGraphNeighborhood(context: AuthenticatedContext, graphNodeId: string) {
      const neighborhood = await graph.getNeighbors(
        context.tenant.tenantId,
        graphNodeId
      );
      if (!neighborhood) {
        throw new AppServiceError(
          "Graph node not found.",
          404,
          "graph_node_not_found"
        );
      }
      return neighborhood;
    }
  };
}
