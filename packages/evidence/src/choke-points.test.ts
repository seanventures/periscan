import { describe, expect, it } from "vitest";

import { computeChokePointAnalysis } from "./choke-points";

describe("choke-point analysis", () => {
  it("collapses many paths sharing a node into one high-impact action", () => {
    // Five paths all traverse the shared "cloud-role" node.
    const paths = Array.from({ length: 5 }, (_, i) => ({
      nodeIds: [`entry-${i}`, "cloud-role", `target-${i}`],
      pathId: `p${i}`
    }));

    const analysis = computeChokePointAnalysis(paths, {
      excludeObjectives: true,
      excludeOrigins: true
    });

    // The shared node is the top choke point on all five paths.
    expect(analysis.chokePoints[0]?.nodeId).toBe("cloud-role");
    expect(analysis.chokePoints[0]?.pathCount).toBe(5);
    expect(analysis.chokePoints[0]?.betweenness).toBe(1);
    // One remediation collapses all five paths.
    expect(analysis.minimalCutSet).toEqual(["cloud-role"]);
    expect(analysis.collapseRatio).toBe(5);
  });

  it("finds a minimal cut set across disjoint path clusters", () => {
    const paths = [
      { nodeIds: ["a", "hub1", "t1"], pathId: "p1" },
      { nodeIds: ["b", "hub1", "t2"], pathId: "p2" },
      { nodeIds: ["c", "hub2", "t3"], pathId: "p3" },
      { nodeIds: ["d", "hub2", "t4"], pathId: "p4" }
    ];

    const analysis = computeChokePointAnalysis(paths, {
      excludeObjectives: true,
      excludeOrigins: true
    });

    // Two hubs break all four paths — collapse 4 → 2.
    expect(analysis.minimalCutSet.sort()).toEqual(["hub1", "hub2"]);
    expect(analysis.collapseRatio).toBe(2);
  });

  it("returns an empty analysis for no paths", () => {
    const analysis = computeChokePointAnalysis([]);
    expect(analysis.totalPaths).toBe(0);
    expect(analysis.minimalCutSet).toEqual([]);
    expect(analysis.totalWeight).toBe(0);
  });

  it("evidence-weights ranking toward measured paths without claiming min-cut", () => {
    // hub-measured sits only on one highly-weighted measured path;
    // hub-heuristic sits on two low-weight heuristic paths.
    // Unweighted would prefer hub-heuristic (2 > 1); weighted prefers hub-measured.
    const paths = [
      {
        nodeIds: ["e1", "hub-measured", "t1"],
        pathId: "measured",
        weight: 2.0
      },
      {
        nodeIds: ["e2", "hub-heuristic", "t2"],
        pathId: "h1",
        weight: 0.25
      },
      {
        nodeIds: ["e3", "hub-heuristic", "t3"],
        pathId: "h2",
        weight: 0.25
      }
    ];

    const analysis = computeChokePointAnalysis(paths, {
      excludeObjectives: true,
      excludeOrigins: true
    });

    expect(analysis.chokePoints[0]?.nodeId).toBe("hub-measured");
    expect(analysis.chokePoints[0]?.weightedPathCount).toBe(2);
    expect(analysis.chokePoints[1]?.nodeId).toBe("hub-heuristic");
    // Greedy still covers all paths — still an approximation, not exact min-cut.
    expect(analysis.minimalCutSet).toContain("hub-measured");
    expect(analysis.minimalCutSet).toContain("hub-heuristic");
    expect(analysis.totalWeight).toBe(2.5);
  });
});
