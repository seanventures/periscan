import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AttackPath } from "@periscan/shared";

import {
  AttackPathClaimBadge,
  SafetyLevelBadge,
  formatSafetyLevelLabel
} from "./state-badge";

const timestamp = "2026-07-16T12:00:00.000Z";
const tenantId = "44444444-4444-4444-8444-444444444444";
const pathId = "33333333-3333-4333-8333-333333333333";

function path(
  validationState: AttackPath["validationState"] = "Validated"
): AttackPath {
  return {
    confidence: 0.9,
    createdAt: timestamp,
    entryNodeId: "11111111-1111-4111-8111-111111111111",
    evidenceBasis: "Heuristic",
    evidenceIds: [],
    impactNodeId: "22222222-2222-4222-8222-222222222222",
    impactScore: 90,
    methodology: "test",
    name: "Heuristic path",
    nonSnapPack: null,
    pathBreakers: [],
    pathEdges: [
      {
        createdAt: timestamp,
        evidenceBasis: "Heuristic",
        evidenceIds: [],
        measurementMethod: null,
        pathEdgeId: "00000000-0000-4000-8000-000000000001",
        pathId,
        rationale: "hop",
        relationship: "LEADS_TO",
        sourceNodeId: "11111111-1111-4111-8111-111111111111",
        targetNodeId: "22222222-2222-4222-8222-222222222222",
        tenantId,
        updatedAt: timestamp
      }
    ],
    pathId,
    pathNodes: [],
    tenantId,
    updatedAt: timestamp,
    validationState
  };
}

describe("AttackPathClaimBadge SR labels [UX-W11]", () => {
  it("exposes claim-safe + remapped aria-label when recorded Validated is not measured", () => {
    render(<AttackPathClaimBadge attackPath={path("Validated")} />);

    const badge = screen.getByText("Heuristic hypothesis");
    expect(badge).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/claim-safe/i)
    );
    expect(badge).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/remapped from recorded Validated/i)
    );
    expect(badge).toHaveAttribute(
      "title",
      expect.stringMatching(/claim-safe/i)
    );
  });

  it("exposes claim-safe aria-label without remapped note when states agree", () => {
    render(<AttackPathClaimBadge attackPath={path("Discovered")} />);

    const badge = screen.getByText("Heuristic hypothesis");
    expect(badge).toHaveAttribute(
      "aria-label",
      expect.stringMatching(/claim-safe/i)
    );
    expect(badge.getAttribute("aria-label") ?? "").not.toMatch(/remapped from/i);
    expect(badge.getAttribute("title") ?? "").toMatch(
      /recorded Discovered vs evidence certainty Heuristic hypothesis/i
    );
  });

  it("title always includes recorded vs evidence certainty when remapped", () => {
    render(<AttackPathClaimBadge attackPath={path("Validated")} />);
    const badge = screen.getByText("Heuristic hypothesis");
    expect(badge.getAttribute("title") ?? "").toMatch(
      /recorded Validated vs evidence certainty Heuristic hypothesis/i
    );
  });
});

describe("SafetyLevelBadge [P08 / ICP-P2-7]", () => {
  it("renames BASLite to limited safe stimulus (no BAS peer parity label)", () => {
    expect(formatSafetyLevelLabel("BASLite")).toBe("limited safe stimulus");
    render(<SafetyLevelBadge level="BASLite" />);
    expect(screen.getByText("limited safe stimulus")).toBeInTheDocument();
    expect(screen.queryByText("BASLite")).not.toBeInTheDocument();
  });
});
