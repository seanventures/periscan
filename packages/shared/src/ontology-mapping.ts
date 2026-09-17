/**
 * Path ↔ Graph ontology bridge (P11-11 / P11R-2).
 *
 * PathNode.entityType uses the closed RelatedEntityType product enum.
 * GraphNode.nodeType uses the closed GraphNodeType family/bare catalog.
 * Writers and readers must cross this table — never invent ad-hoc dual dialects.
 *
 * Projection may *link* types via edges; it must not *erase* type identity.
 * Mission ≠ Run, Scope ≠ Asset, Integration ≠ ControlSource (P11R-2).
 *
 * GraphNodeType ontology lives in domain.ts (GRAPH_NODE_* / isAllowedGraphNodeType).
 * Bump GRAPH_NODE_TYPE_ONTOLOGY_VERSION when allowlists change incompatibly.
 */

import {
  GRAPH_NODE_BARE_TYPES,
  isAllowedGraphNodeType,
  resolveGraphNodeType,
  type RelatedEntityType
} from "./domain";

/**
 * Preferred bare graph nodeType for a path/product RelatedEntityType.
 * 1:1 where graph-eligible; EvidencePack → EvidenceArtifact is the sole
 * intentional artifact projection (pack is the product object, artifact the graph node).
 * NonHumanIdentity → Identity is principal-family projection (P09-18), not type erase of
 * Mission/Scope/Integration.
 */
export const RELATED_ENTITY_TO_GRAPH_NODE_TYPE: Partial<
  Record<RelatedEntityType, string>
> = {
  Asset: "Asset",
  Identity: "Identity",
  NonHumanIdentity: "Identity",
  Exposure: "Exposure",
  ControlSource: "ControlSource",
  AIApplication: "AIApplication",
  ValidationRun: "ValidationRun",
  ValidationMission: "ValidationMission",
  Scope: "Scope",
  Integration: "Integration",
  Runner: "Runner",
  RunnerTask: "RunnerTask",
  ThreatAdvisory: "ThreatAdvisory",
  Scenario: "Scenario",
  AttackPath: "AttackPath",
  RemediationTask: "RemediationTask",
  VerificationEvent: "VerificationEvent",
  // Evidence packs are artifacts on the graph when projected
  EvidencePack: "EvidenceArtifact"
};

/**
 * Map a PathNode / product RelatedEntityType to a GraphNode.nodeType.
 * Family.Leaf forms may be supplied via `leaf` (e.g. assetType, exposureType).
 * Unknown leaves collapse to bare family via resolveGraphNodeType (P11R-1).
 */
export function relatedEntityTypeToGraphNodeType(
  entityType: RelatedEntityType,
  leaf?: string | null
): string | null {
  const bare = RELATED_ENTITY_TO_GRAPH_NODE_TYPE[entityType];
  if (!bare) return null;

  const resolved = resolveGraphNodeType(bare, leaf);
  if (isAllowedGraphNodeType(resolved)) return resolved;
  return null;
}

/**
 * Extract the product RelatedEntityType family from a GraphNode.nodeType.
 * `Asset.CloudResource` → Asset; bare `ValidationRun` → ValidationRun.
 * Prefers exact 1:1 bare matches so Mission and Run stay distinguishable (P11R-2).
 * Returns null when the nodeType is not a known related-entity family.
 */
export function graphNodeTypeToRelatedEntityType(
  nodeType: string
): RelatedEntityType | null {
  if (!nodeType || !isAllowedGraphNodeType(nodeType)) return null;

  const family = nodeType.includes(".") ? nodeType.split(".")[0]! : nodeType;

  // Prefer exact 1:1: family is itself a RelatedEntityType that maps to itself.
  const asRelated = family as RelatedEntityType;
  if (RELATED_ENTITY_TO_GRAPH_NODE_TYPE[asRelated] === family) {
    return asRelated;
  }

  // Bare graph types that map back to product entities (e.g. EvidenceArtifact → EvidencePack)
  if ((GRAPH_NODE_BARE_TYPES as readonly string[]).includes(family)) {
    // Prefer the RelatedEntityType whose preferred bare equals family AND whose
    // name equals family when present; otherwise first reverse match.
    let fallback: RelatedEntityType | null = null;
    for (const [entity, bare] of Object.entries(
      RELATED_ENTITY_TO_GRAPH_NODE_TYPE
    )) {
      if (bare !== family) continue;
      if (entity === family) return entity as RelatedEntityType;
      if (!fallback) fallback = entity as RelatedEntityType;
    }
    return fallback;
  }

  return null;
}

/** True when path entityType and graph nodeType describe the same world object family. */
export function pathEntityMatchesGraphNodeType(
  entityType: RelatedEntityType,
  nodeType: string
): boolean {
  const expectedBare = RELATED_ENTITY_TO_GRAPH_NODE_TYPE[entityType];
  if (!expectedBare) return false;
  if (!isAllowedGraphNodeType(nodeType)) return false;
  const family = nodeType.includes(".") ? nodeType.split(".")[0]! : nodeType;
  return family === expectedBare;
}
