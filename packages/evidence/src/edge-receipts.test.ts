import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import type { AttackPath, PathEdgeReceipt } from "@periscan/shared";

import {
  buildHopKey,
  buildPathEdgeReceipt,
  deriveAttackPathMeasurementState,
  hopKeyForPathEdge,
  reattachPathEdgeReceiptsByHopKey,
  recomputeAttackPathFromReceipts,
  receiptMarksMeasured,
  resolveDraftEdgeEvidenceBasis,
  resolveDraftPathEvidenceBasis,
  resolvePathEdgeReceiptValidationState,
  weakestEvidenceBasis
} from "./edge-receipts";

function createPath(): AttackPath {
  const timestamp = new Date().toISOString();
  const tenantId = randomUUID();
  const pathId = randomUUID();
  const nodeA = randomUUID();
  const nodeB = randomUUID();
  const nodeC = randomUUID();
  const entityA = randomUUID();
  const entityB = randomUUID();
  const entityC = randomUUID();
  const evidenceId = randomUUID();
  const edge1 = randomUUID();
  const edge2 = randomUUID();

  return {
    confidence: 0.85,
    createdAt: timestamp,
    entryNodeId: nodeA,
    evidenceBasis: "Heuristic",
    evidenceIds: [evidenceId],
    impactNodeId: nodeC,
    impactScore: 80,
    name: "Two-hop hypothesis",
    pathBreakers: [],
    pathEdges: [
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [evidenceId],
        pathEdgeId: edge1,
        pathId,
        rationale: "hop-1",
        relationship: "CAN_ACCESS",
        sourceNodeId: nodeA,
        targetNodeId: nodeB,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [evidenceId],
        pathEdgeId: edge2,
        pathId,
        rationale: "hop-2",
        relationship: "CAN_ACCESS",
        sourceNodeId: nodeB,
        targetNodeId: nodeC,
        tenantId,
        updatedAt: timestamp
      }
    ],
    pathId,
    pathNodes: [
      {
        createdAt: timestamp,
        entityId: entityA,
        entityType: "Asset",
        evidenceIds: [evidenceId],
        label: "A",
        pathId,
        pathNodeId: nodeA,
        sequence: 0,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        entityId: entityB,
        entityType: "Asset",
        evidenceIds: [evidenceId],
        label: "B",
        pathId,
        pathNodeId: nodeB,
        sequence: 1,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        entityId: entityC,
        entityType: "Asset",
        evidenceIds: [evidenceId],
        label: "C",
        pathId,
        pathNodeId: nodeC,
        sequence: 2,
        tenantId,
        updatedAt: timestamp
      }
    ],
    tenantId,
    updatedAt: timestamp,
    validationState: "Discovered"
  };
}

function receiptFor(
  path: AttackPath,
  edgeIndex: number,
  overrides?: Partial<PathEdgeReceipt>
): PathEdgeReceipt {
  const edge = path.pathEdges[edgeIndex]!;
  const source = path.pathNodes.find((n) => n.pathNodeId === edge.sourceNodeId)!;
  const target = path.pathNodes.find((n) => n.pathNodeId === edge.targetNodeId)!;
  const hopKey = buildHopKey(
    source.entityId,
    target.entityId,
    edge.relationship
  );

  return buildPathEdgeReceipt({
    receiptId: randomUUID(),
    tenantId: path.tenantId,
    pathId: path.pathId,
    pathEdgeId: edge.pathEdgeId,
    hopKey,
    moduleId: "periscan.tcp_reachability",
    outcome: "tcp_port_reachable",
    validationState: "Reachable",
    evidenceIds: [randomUUID()],
    measurementMethod: "periscan.tcp_reachability",
    ...overrides
  });
}

describe("buildHopKey", () => {
  it("is stable for the same entity pair and relationship", () => {
    const a = randomUUID();
    const b = randomUUID();
    expect(buildHopKey(a, b, "CAN_ACCESS")).toBe(
      buildHopKey(a, b, "CAN_ACCESS")
    );
    expect(buildHopKey(a, b, "CAN_ACCESS")).not.toBe(
      buildHopKey(b, a, "CAN_ACCESS")
    );
  });
});

describe("weakestEvidenceBasis", () => {
  it("requires every edge Measured with evidence IDs", () => {
    expect(
      weakestEvidenceBasis([
        { evidenceBasis: "Measured", evidenceIds: [randomUUID()] },
        { evidenceBasis: "Measured", evidenceIds: [randomUUID()] }
      ])
    ).toBe("Measured");
    expect(
      weakestEvidenceBasis([
        { evidenceBasis: "Measured", evidenceIds: [randomUUID()] },
        { evidenceBasis: "Heuristic", evidenceIds: [] }
      ])
    ).toBe("Heuristic");
    expect(weakestEvidenceBasis([])).toBe("Heuristic");
  });

  it("does not count Measured with empty evidenceIds as Measured", () => {
    expect(
      weakestEvidenceBasis([
        { evidenceBasis: "Measured", evidenceIds: [] },
        { evidenceBasis: "Measured", evidenceIds: [randomUUID()] }
      ])
    ).toBe("Heuristic");
    expect(
      weakestEvidenceBasis([{ evidenceBasis: "Measured", evidenceIds: [] }])
    ).toBe("Heuristic");
    // Missing evidenceIds is treated as empty (not Measured).
    expect(weakestEvidenceBasis([{ evidenceBasis: "Measured" }])).toBe(
      "Heuristic"
    );
  });
});

describe("resolveDraftEdgeEvidenceBasis / resolveDraftPathEvidenceBasis", () => {
  it("never stamps Measured from draft.heuristic alone (no edge basis)", () => {
    expect(
      resolveDraftEdgeEvidenceBasis({
        evidenceIds: [randomUUID()]
      })
    ).toBe("Heuristic");
    expect(
      resolveDraftPathEvidenceBasis([
        { evidenceIds: [randomUUID()] },
        { evidenceIds: [randomUUID()] }
      ])
    ).toBe("Heuristic");
  });

  it("allows Measured only when the draft edge explicitly sets Measured with evidence", () => {
    const evidenceId = randomUUID();
    expect(
      resolveDraftEdgeEvidenceBasis({
        evidenceBasis: "Measured",
        evidenceIds: [evidenceId]
      })
    ).toBe("Measured");
    expect(
      resolveDraftEdgeEvidenceBasis({
        evidenceBasis: "Measured",
        evidenceIds: []
      })
    ).toBe("Heuristic");
    expect(
      resolveDraftPathEvidenceBasis([
        { evidenceBasis: "Measured", evidenceIds: [evidenceId] },
        { evidenceBasis: "Measured", evidenceIds: [randomUUID()] }
      ])
    ).toBe("Measured");
    expect(
      resolveDraftPathEvidenceBasis([
        { evidenceBasis: "Measured", evidenceIds: [evidenceId] },
        { evidenceIds: [randomUUID()] }
      ])
    ).toBe("Heuristic");
  });
});

describe("receiptMarksMeasured", () => {
  it("requires evidence IDs", () => {
    expect(
      receiptMarksMeasured({
        evidenceIds: [],
        validationState: "Reachable"
      })
    ).toBe(false);
    expect(
      receiptMarksMeasured({
        evidenceIds: [randomUUID()],
        validationState: "Reachable"
      })
    ).toBe(true);
    expect(
      receiptMarksMeasured({
        evidenceIds: [randomUUID()],
        validationState: "NoEvidence"
      })
    ).toBe(false);
  });
});

describe("resolvePathEdgeReceiptValidationState", () => {
  it("prefers server validationState when present", () => {
    expect(
      resolvePathEdgeReceiptValidationState({
        clientValidationState: "Reachable",
        isIdentityImport: false,
        resolvedRunId: randomUUID(),
        serverValidationState: "Inconclusive"
      })
    ).toBe("Inconclusive");
  });

  it("does not forge Measured from client state when linked run omitted validationState", () => {
    const state = resolvePathEdgeReceiptValidationState({
      clientValidationState: "Reachable",
      isIdentityImport: false,
      resolvedRunId: randomUUID(),
      serverValidationState: null
    });
    expect(state).toBe("Inconclusive");
    expect(
      receiptMarksMeasured({
        evidenceIds: [randomUUID()],
        validationState: state
      })
    ).toBe(false);
  });

  it("forces Inconclusive for identity graph import", () => {
    expect(
      resolvePathEdgeReceiptValidationState({
        clientValidationState: "Reachable",
        isIdentityImport: true,
        resolvedRunId: randomUUID(),
        serverValidationState: "Reachable"
      })
    ).toBe("Inconclusive");
  });
});

describe("recomputeAttackPathFromReceipts", () => {
  it("upgrades only the receipt-matched edge and keeps path Heuristic until all hops measured", () => {
    const path = createPath();
    const receipt = receiptFor(path, 0);

    const next = recomputeAttackPathFromReceipts({
      path,
      receipts: [receipt]
    });

    expect(next.pathEdges[0]?.evidenceBasis).toBe("Measured");
    expect(next.pathEdges[0]?.evidenceIds).toContain(receipt.evidenceIds[0]);
    expect(next.pathEdges[0]?.measurementMethod).toBe(
      "periscan.tcp_reachability"
    );
    // Unrelated second edge stays heuristic.
    expect(next.pathEdges[1]?.evidenceBasis).toBe("Heuristic");
    expect(next.evidenceBasis).toBe("Heuristic");
  });

  it("never upgrades an unrelated edge by association", () => {
    const path = createPath();
    const otherPathEdgeId = randomUUID();
    const receipt = receiptFor(path, 0, {
      pathEdgeId: otherPathEdgeId,
      hopKey: "unrelated|CAN_ACCESS|hop"
    });

    const next = recomputeAttackPathFromReceipts({
      path,
      receipts: [receipt]
    });

    expect(next.pathEdges.every((edge) => edge.evidenceBasis === "Heuristic")).toBe(
      true
    );
    expect(next.evidenceBasis).toBe("Heuristic");
  });

  it("marks the path Measured only when every hop has a measured receipt", () => {
    const path = createPath();
    const r0 = receiptFor(path, 0);
    const r1 = receiptFor(path, 1, {
      moduleId: "periscan.http_health_check",
      outcome: "http_healthy",
      validationState: "Validated",
      measurementMethod: "periscan.http_health_check"
    });

    const next = recomputeAttackPathFromReceipts({
      path,
      receipts: [r0, r1]
    });

    expect(next.pathEdges.every((edge) => edge.evidenceBasis === "Measured")).toBe(
      true
    );
    expect(next.evidenceBasis).toBe("Measured");
    // Discovered does not upgrade to Validated merely because hops are Measured.
    expect(next.validationState).toBe("Discovered");
  });

  it("clamps overclaimed Validated to Discovered until all hops have receipts", () => {
    const path = {
      ...createPath(),
      validationState: "Validated" as const
    };
    const r0 = receiptFor(path, 0);

    const partial = recomputeAttackPathFromReceipts({
      path,
      receipts: [r0]
    });
    expect(partial.evidenceBasis).toBe("Heuristic");
    expect(partial.validationState).toBe("Discovered");
    expect(partial.pathEdges[0]?.evidenceBasis).toBe("Measured");
    expect(partial.pathEdges[1]?.evidenceBasis).toBe("Heuristic");

    const r1 = receiptFor(path, 1);
    const fullyMeasuredPath = {
      ...path,
      validationState: "Validated" as const
    };
    const full = recomputeAttackPathFromReceipts({
      path: fullyMeasuredPath,
      receipts: [r0, r1]
    });
    expect(full.evidenceBasis).toBe("Measured");
    // Fully measured + recorded Validated stays claim-safe Validated.
    expect(full.validationState).toBe("Validated");
  });

  it("never invents Exploitable from partial hop receipts", () => {
    const path = {
      ...createPath(),
      validationState: "Exploitable" as const
    };
    const next = recomputeAttackPathFromReceipts({
      path,
      receipts: [receiptFor(path, 0)]
    });
    expect(next.validationState).toBe("Discovered");
    expect(next.evidenceBasis).toBe("Heuristic");
  });

  it("does not mark Measured when receipt has no evidence", () => {
    const path = createPath();
    expect(() =>
      buildPathEdgeReceipt({
        receiptId: randomUUID(),
        pathId: path.pathId,
        pathEdgeId: path.pathEdges[0]!.pathEdgeId,
        hopKey: "a|CAN_ACCESS|b",
        moduleId: "periscan.tcp_reachability",
        outcome: "fabricated",
        validationState: "Reachable",
        evidenceIds: [],
        measurementMethod: "fabricated"
      })
    ).toThrow(/evidence ID/i);
  });

  it("matches receipts by hopKey when pathEdgeId differs", () => {
    const path = createPath();
    const edge = path.pathEdges[0]!;
    const source = path.pathNodes.find((n) => n.pathNodeId === edge.sourceNodeId)!;
    const target = path.pathNodes.find((n) => n.pathNodeId === edge.targetNodeId)!;
    const hopKey = buildHopKey(
      source.entityId,
      target.entityId,
      edge.relationship
    );

    const receipt = buildPathEdgeReceipt({
      receiptId: randomUUID(),
      pathId: path.pathId,
      // Different edge id — still matches via hopKey
      pathEdgeId: randomUUID(),
      hopKey,
      moduleId: "periscan.dns_resolution_check",
      outcome: "dns_resolves",
      validationState: "Reachable",
      evidenceIds: [randomUUID()],
      measurementMethod: "periscan.dns_resolution_check"
    });

    const next = recomputeAttackPathFromReceipts({
      path,
      receipts: [receipt]
    });

    expect(next.pathEdges[0]?.evidenceBasis).toBe("Measured");
    expect(next.pathEdges[1]?.evidenceBasis).toBe("Heuristic");
  });

  it("ignores NoEvidence outcomes for basis upgrade", () => {
    const path = createPath();
    const receipt = receiptFor(path, 0, {
      validationState: "NoEvidence",
      outcome: "tcp_reachability_no_target"
    });

    const next = recomputeAttackPathFromReceipts({
      path,
      receipts: [receipt]
    });

    expect(next.pathEdges[0]?.evidenceBasis).toBe("Heuristic");
  });
});

describe("reattachPathEdgeReceiptsByHopKey", () => {
  it("preserves hop A Measured and hop B Heuristic across pathEdgeId rewrite", () => {
    // Simulate: measure hop A, correlation refresh recreates edges with new IDs.
    const before = createPath();
    const hopAReceipt = receiptFor(before, 0);
    const measuredBefore = recomputeAttackPathFromReceipts({
      path: before,
      receipts: [hopAReceipt]
    });
    expect(measuredBefore.pathEdges[0]?.evidenceBasis).toBe("Measured");
    expect(measuredBefore.pathEdges[1]?.evidenceBasis).toBe("Heuristic");
    expect(measuredBefore.evidenceBasis).toBe("Heuristic");

    // Correlation refresh: same entities/relationships, new pathEdgeIds + node ids.
    const timestamp = new Date().toISOString();
    const newNodeA = randomUUID();
    const newNodeB = randomUUID();
    const newNodeC = randomUUID();
    const newEdgeA = randomUUID();
    const newEdgeB = randomUUID();
    const afterRefresh: AttackPath = {
      ...before,
      entryNodeId: newNodeA,
      impactNodeId: newNodeC,
      pathEdges: [
        {
          createdAt: timestamp,
          evidenceBasis: "Heuristic",
          evidenceIds: before.evidenceIds,
          measurementMethod: "heuristic-pattern-correlation",
          pathEdgeId: newEdgeA,
          pathId: before.pathId,
          rationale: "hop-1-rewritten",
          relationship: "CAN_ACCESS",
          sourceNodeId: newNodeA,
          targetNodeId: newNodeB,
          tenantId: before.tenantId,
          updatedAt: timestamp
        },
        {
          createdAt: timestamp,
          evidenceBasis: "Heuristic",
          evidenceIds: before.evidenceIds,
          measurementMethod: "heuristic-pattern-correlation",
          pathEdgeId: newEdgeB,
          pathId: before.pathId,
          rationale: "hop-2-rewritten",
          relationship: "CAN_ACCESS",
          sourceNodeId: newNodeB,
          targetNodeId: newNodeC,
          tenantId: before.tenantId,
          updatedAt: timestamp
        }
      ],
      pathNodes: [
        {
          ...before.pathNodes[0]!,
          pathNodeId: newNodeA,
          updatedAt: timestamp
        },
        {
          ...before.pathNodes[1]!,
          pathNodeId: newNodeB,
          updatedAt: timestamp
        },
        {
          ...before.pathNodes[2]!,
          pathNodeId: newNodeC,
          updatedAt: timestamp
        }
      ],
      updatedAt: timestamp
    };

    expect(newEdgeA).not.toBe(before.pathEdges[0]!.pathEdgeId);
    expect(newEdgeB).not.toBe(before.pathEdges[1]!.pathEdgeId);

    const { reattachedReceipts, droppedReceiptCount } =
      reattachPathEdgeReceiptsByHopKey({
        pathEdges: afterRefresh.pathEdges,
        pathId: afterRefresh.pathId,
        pathNodes: afterRefresh.pathNodes,
        receipts: [hopAReceipt]
      });

    expect(droppedReceiptCount).toBe(0);
    expect(reattachedReceipts).toHaveLength(1);
    expect(reattachedReceipts[0]?.pathEdgeId).toBe(newEdgeA);
    expect(reattachedReceipts[0]?.hopKey).toBe(
      hopKeyForPathEdge(afterRefresh.pathEdges[0]!, afterRefresh.pathNodes)
    );
    // Stable hop identity survived the rewrite.
    expect(reattachedReceipts[0]?.hopKey).toBe(hopAReceipt.hopKey);

    const after = recomputeAttackPathFromReceipts({
      path: afterRefresh,
      receipts: reattachedReceipts
    });

    expect(after.pathEdges[0]?.evidenceBasis).toBe("Measured");
    expect(after.pathEdges[0]?.evidenceIds).toEqual(
      expect.arrayContaining(hopAReceipt.evidenceIds)
    );
    expect(after.pathEdges[0]?.measurementMethod).toBe(
      hopAReceipt.measurementMethod
    );
    // Unrelated hop B must remain Heuristic — never upgraded without a receipt.
    expect(after.pathEdges[1]?.evidenceBasis).toBe("Heuristic");
    expect(after.evidenceBasis).toBe("Heuristic");
  });

  it("drops receipts whose hopKey is no longer present after topology change", () => {
    const path = createPath();
    const receipt = receiptFor(path, 0);
    const orphaned = {
      ...receipt,
      hopKey: buildHopKey(randomUUID(), randomUUID(), "CAN_ACCESS")
    };

    const { reattachedReceipts, droppedReceiptCount } =
      reattachPathEdgeReceiptsByHopKey({
        pathEdges: path.pathEdges,
        pathId: path.pathId,
        pathNodes: path.pathNodes,
        receipts: [orphaned]
      });

    expect(reattachedReceipts).toHaveLength(0);
    expect(droppedReceiptCount).toBe(1);
  });
});

describe("deriveAttackPathMeasurementState", () => {
  it("summarizes partial measurement", () => {
    const path = createPath();
    const receipt = receiptFor(path, 0);
    const measured = recomputeAttackPathFromReceipts({
      path,
      receipts: [receipt]
    });
    const state = deriveAttackPathMeasurementState(measured, [receipt]);

    expect(state.measuredEdgeCount).toBe(1);
    expect(state.totalEdgeCount).toBe(2);
    expect(state.measuredHopFraction).toBe(0.5);
    expect(state.fullyMeasured).toBe(false);
    expect(state.pathEvidenceBasis).toBe("Heuristic");
    expect(state.claimSafeValidationState).toBe("Discovered");
    expect(state.edgeStates[0]?.latestReceiptId).toBe(receipt.receiptId);
  });

  it("treats Measured edges without evidence as unmeasured for path-level basis", () => {
    const path = createPath();
    path.pathEdges = path.pathEdges.map((edge) => ({
      ...edge,
      evidenceBasis: "Measured" as const,
      evidenceIds: []
    }));
    path.evidenceBasis = "Measured";
    path.validationState = "Validated";

    const state = deriveAttackPathMeasurementState(path, []);
    expect(state.measuredEdgeCount).toBe(0);
    expect(state.measuredHopFraction).toBe(0);
    expect(state.fullyMeasured).toBe(false);
    expect(state.pathEvidenceBasis).toBe("Heuristic");
    expect(state.claimSafeValidationState).toBe("Discovered");
  });

  it("reports fully measured hop fraction and keeps claim-safe Validated", () => {
    const path = {
      ...createPath(),
      validationState: "Validated" as const
    };
    const receipts = [receiptFor(path, 0), receiptFor(path, 1)];
    const measured = recomputeAttackPathFromReceipts({ path, receipts });
    const state = deriveAttackPathMeasurementState(measured, receipts);

    expect(state.measuredEdgeCount).toBe(2);
    expect(state.measuredHopFraction).toBe(1);
    expect(state.fullyMeasured).toBe(true);
    expect(state.claimSafeValidationState).toBe("Validated");
  });
});
