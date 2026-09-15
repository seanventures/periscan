// Choke-point analysis: collapse a large set of attack paths into the SMALLEST
// set of high-impact remediation nodes (the "choke points"). Two real graph
// computations, not descriptive labels:
//
//   1. Path-betweenness — for each node, how many distinct attack paths pass
//      through it (optionally evidence-weighted). High-betweenness nodes are
//      structural choke points.
//   2. Minimum hitting set (greedy) — the fewest nodes whose remediation breaks
//      EVERY path. Removing a node breaks every path it lies on; greedy set-cover
//      repeatedly takes the node covering the most still-unbroken (weighted)
//      paths. Exact minimum hitting set is NP-hard; greedy is the standard
//      ln(n)-approximation and is optimal on the common case of paths sharing a
//      dominating node.
//
// Honesty: this is NOT exact global min-cut / flow / XM-class choke science.
// Methodology remains GreedyHittingSetApproximation. Optional path weights
// (e.g. measured hop fraction) bias ranking toward evidence-backed paths only.

export interface ChokePointPathInput {
  // Ordered node ids from entry point → objective. Length >= 1.
  nodeIds: string[];
  pathId: string;
  /**
   * Evidence weight for this path (default 1). Callers may pass measured hop
   * fraction (0..1) or 1 + measuredFraction so heuristic paths still count but
   * measured paths rank higher. Must be >= 0.
   */
  weight?: number;
}

export interface ChokePoint {
  // Fraction of total path weight that traverses this node (0..1).
  betweenness: number;
  nodeId: string;
  // Unweighted path count (cardinality of pathIds).
  pathCount: number;
  pathIds: string[];
  /** Sum of path weights that traverse this node. */
  weightedPathCount: number;
}

export interface ChokePointAnalysis {
  chokePoints: ChokePoint[];
  // How many paths one action collapses on average across the cut set. Higher =
  // fewer fixes kill more paths (the whole point of choke-point analysis).
  // Computed from unweighted path cardinality for stable operator intuition.
  collapseRatio: number;
  // Fewest nodes whose remediation breaks every path (greedy hitting set),
  // ordered by the (weighted) cover each one contributes when selected.
  minimalCutSet: string[];
  totalPaths: number;
  /** Sum of all path weights used for ranking. */
  totalWeight: number;
}

// Optionally treat the first node (attacker origin) and/or last node (objective)
// of each path as non-remediable so choke points fall on the controllable middle.
export interface ChokePointOptions {
  excludeObjectives?: boolean;
  excludeOrigins?: boolean;
}

function pathWeight(path: ChokePointPathInput): number {
  const raw = path.weight;
  if (raw === undefined || raw === null || Number.isNaN(raw)) {
    return 1;
  }
  return Math.max(0, raw);
}

export function computeChokePointAnalysis(
  paths: ChokePointPathInput[],
  options: ChokePointOptions = {}
): ChokePointAnalysis {
  const realPaths = paths.filter((path) => path.nodeIds.length > 0);
  const totalPaths = realPaths.length;
  const totalWeight = realPaths.reduce((sum, path) => sum + pathWeight(path), 0);

  if (totalPaths === 0) {
    return {
      chokePoints: [],
      collapseRatio: 0,
      minimalCutSet: [],
      totalPaths: 0,
      totalWeight: 0
    };
  }

  // Candidate break-nodes per path (respecting origin/objective exclusions).
  const pathBreakNodes = new Map<string, Set<string>>();
  // Which paths each node can break.
  const nodeToPaths = new Map<string, Set<string>>();
  const pathWeights = new Map<string, number>();

  for (const path of realPaths) {
    pathWeights.set(path.pathId, pathWeight(path));
    const start = options.excludeOrigins ? 1 : 0;
    const end = options.excludeObjectives
      ? path.nodeIds.length - 1
      : path.nodeIds.length;
    const breakNodes = new Set(path.nodeIds.slice(start, Math.max(start, end)));
    // A path with only excluded nodes still needs *something* to break it — fall
    // back to its full node set so it is never silently uncoverable.
    const effective =
      breakNodes.size > 0 ? breakNodes : new Set(path.nodeIds);

    pathBreakNodes.set(path.pathId, effective);
    for (const nodeId of effective) {
      const set = nodeToPaths.get(nodeId) ?? new Set<string>();
      set.add(path.pathId);
      nodeToPaths.set(nodeId, set);
    }
  }

  const weightFor = (pathId: string) => pathWeights.get(pathId) ?? 1;

  // Betweenness ranking — prefer evidence-weighted coverage, then path count.
  const chokePoints: ChokePoint[] = [...nodeToPaths.entries()]
    .map(([nodeId, pathIds]) => {
      const ids = [...pathIds].sort();
      const weightedPathCount = ids.reduce(
        (sum, pathId) => sum + weightFor(pathId),
        0
      );
      return {
        betweenness: totalWeight > 0 ? weightedPathCount / totalWeight : 0,
        nodeId,
        pathCount: ids.length,
        pathIds: ids,
        weightedPathCount
      };
    })
    .sort(
      (a, b) =>
        b.weightedPathCount - a.weightedPathCount ||
        b.pathCount - a.pathCount ||
        a.nodeId.localeCompare(b.nodeId)
    );

  // Greedy minimum hitting set with evidence-weighted cover scores.
  const uncovered = new Set(realPaths.map((path) => path.pathId));
  const minimalCutSet: string[] = [];

  while (uncovered.size > 0) {
    let bestNode: string | null = null;
    let bestCoverWeight = 0;
    let bestCoverCount = 0;

    for (const [nodeId, pathIds] of nodeToPaths) {
      if (minimalCutSet.includes(nodeId)) {
        continue;
      }
      let coverWeight = 0;
      let coverCount = 0;
      for (const pathId of pathIds) {
        if (uncovered.has(pathId)) {
          coverWeight += weightFor(pathId);
          coverCount += 1;
        }
      }
      // Prefer higher weighted cover, then unweighted count, then stable id.
      if (
        coverWeight > bestCoverWeight ||
        (coverWeight === bestCoverWeight && coverCount > bestCoverCount) ||
        (coverWeight === bestCoverWeight &&
          coverCount === bestCoverCount &&
          coverWeight > 0 &&
          bestNode !== null &&
          nodeId.localeCompare(bestNode) < 0)
      ) {
        bestCoverWeight = coverWeight;
        bestCoverCount = coverCount;
        bestNode = nodeId;
      }
    }

    if (bestNode === null || bestCoverWeight === 0) {
      break;
    }

    minimalCutSet.push(bestNode);
    for (const pathId of nodeToPaths.get(bestNode) ?? []) {
      uncovered.delete(pathId);
    }
  }

  return {
    chokePoints,
    collapseRatio:
      minimalCutSet.length > 0 ? totalPaths / minimalCutSet.length : 0,
    minimalCutSet,
    totalPaths,
    totalWeight
  };
}
