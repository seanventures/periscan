import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AttackPath } from "@periscan/shared";

import { AttackPathGraph } from "./attack-path-graph";

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
    pathBreakers: [],
    pathEdges: [
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [],
        pathEdgeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        pathId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        rationale: "Secret grants cloud role assumption.",
        relationship: "CAN_ACCESS",
        sourceNodeId: "99999999-9999-4999-8999-999999999999",
        targetNodeId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
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

describe("AttackPathGraph", () => {
  it("renders an accessible node + transition fallback ordered by sequence", () => {
    render(<AttackPathGraph attackPath={createAttackPath()} />);

    const figure = screen.getByRole("figure", {
      name: "Attack path graph: Repository secret can reach production"
    });

    const nodes = within(figure).getByRole("list", {
      name: "Attack path nodes"
    });
    const nodeItems = nodes.querySelectorAll("li");
    expect(nodeItems).toHaveLength(2);
    // Ordered by sequence: entry (0) before objective (1).
    expect(nodeItems[0]).toHaveTextContent("Public GitHub repository");
    expect(nodeItems[1]).toHaveTextContent("Production database");

    const transitions = within(figure).getByRole("list", {
      name: "Attack path transitions"
    });
    expect(
      within(transitions).getByText(
        "Public GitHub repository → Production database (CAN_ACCESS)"
      )
    ).toBeInTheDocument();
  });

  it("renders nothing when the path has no nodes", () => {
    const { container } = render(
      <AttackPathGraph attackPath={createAttackPath({ pathNodes: [] })} />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
