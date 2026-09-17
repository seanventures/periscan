import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AttackPath } from "@periscan/shared";

import { AttackPathDepth } from "./attack-path-depth";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";

function createAttackPath(overrides: Partial<AttackPath> = {}): AttackPath {
  return {
    confidence: 0.91,
    createdAt: timestamp,
    entryNodeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    evidenceBasis: "Heuristic",
    evidenceIds: [],
    impactNodeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    impactScore: 86,
    methodology: "heuristic-pattern-correlation",
    name: "Repository secret can reach production",
    pathBreakers: [
      {
        createdAt: timestamp,
        description: "Rotating the secret breaks the path.",
        evidenceIds: [],
        pathBreakerId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        priority: 1,
        relatedNodeId: null,
        tenantId,
        title: "Rotate repository secret",
        updatedAt: timestamp
      }
    ],
    pathEdges: [
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [],
        pathEdgeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        rationale: "Secret grants cloud role assumption.",
        relationship: "CAN_ACCESS",
        sourceNodeId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        targetNodeId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId,
        updatedAt: timestamp
      }
    ],
    pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    pathNodes: [
      {
        createdAt: timestamp,
        entityId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        entityType: "Asset",
        evidenceIds: [],
        label: "Production database",
        pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        pathNodeId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        sequence: 1,
        tenantId,
        updatedAt: timestamp
      },
      {
        createdAt: timestamp,
        entityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        entityType: "Scope",
        evidenceIds: [],
        label: "Public GitHub repository",
        pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        pathNodeId: "99999999-9999-4999-8999-999999999999",
        sequence: 0,
        tenantId,
        updatedAt: timestamp
      }
    ],
    tenantId,
    updatedAt: timestamp,
    validationState: "Validated",
    ...overrides
  };
}

describe("AttackPathDepth", () => {
  it("renders ordered steps, edge rationale, and choke points", () => {
    render(<AttackPathDepth attackPath={createAttackPath()} />);

    expect(screen.getByText("91%")).toBeInTheDocument();
    expect(screen.getByText("86")).toBeInTheDocument();

    const steps = screen.getByRole("list", { name: "Attack path steps" });
    const stepItems = steps.querySelectorAll("li");
    expect(stepItems).toHaveLength(2);
    expect(stepItems[0]).toHaveTextContent("Public GitHub repository");
    expect(stepItems[1]).toHaveTextContent("Production database");

    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "LI" &&
          element.textContent ===
            "Heuristic · CAN_ACCESS: Secret grants cloud role assumption."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Rotate repository secret")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Path breaker priority: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Evidence-backed path breakers" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Leading min-cut/i)).not.toBeInTheDocument();
  });

  it("omits optional sections when the API returns no structured data", () => {
    render(
      <AttackPathDepth
        attackPath={createAttackPath({
          pathBreakers: [],
          pathEdges: [],
          pathNodes: []
        })}
      />
    );

    expect(
      screen.queryByRole("list", { name: "Attack path steps" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Evidence-backed path breakers" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Control & step interactions/)
    ).not.toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });
});
