import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductActivationState } from "@periscan/shared";

import { PROOF_LOOP_HELP, PROOF_LOOP_STAGE_LABELS } from "../lib/product-help";
import {
  ProofLoopMap,
  buildProofLoopMapNodes,
  proofLoopMapProgress
} from "./proof-loop-map";

function milestone(
  key: ProductActivationState["milestones"][number]["key"],
  label: string,
  stage: ProductActivationState["milestones"][number]["stage"],
  state: ProductActivationState["milestones"][number]["state"],
  href: string
): ProductActivationState["milestones"][number] {
  return {
    completedAt: state === "Completed" ? "2026-07-14T14:30:00.000Z" : null,
    evidenceBasis: `${label} is backed by persisted workspace state.`,
    href,
    key,
    label,
    stage,
    state
  };
}

function activationState(
  overrides: Partial<ProductActivationState> = {}
): ProductActivationState {
  return {
    completedMilestones: 3,
    currentStage: "Authorize",
    diagnostics: [],
    maturity: "Activating",
    measuredAt: "2026-07-14T15:00:00.000Z",
    milestones: [
      milestone("AccountCreated", "Account created", "Connect", "Completed", "/"),
      milestone(
        "SourceConnected",
        "Source connected",
        "Connect",
        "Completed",
        "/integrations"
      ),
      milestone(
        "ScopeVerified",
        "Scope verified",
        "Authorize",
        "Current",
        "/missions"
      ),
      milestone(
        "PolicyPreviewed",
        "Policy previewed",
        "Authorize",
        "Upcoming",
        "/missions"
      ),
      milestone(
        "MissionCreated",
        "Mission created",
        "Validate",
        "Upcoming",
        "/missions"
      ),
      milestone(
        "MeasuredResult",
        "Measured result",
        "Understand",
        "Upcoming",
        "/findings"
      ),
      milestone(
        "RemediationCreated",
        "Remediation created",
        "Act",
        "Upcoming",
        "/remediation"
      ),
      milestone(
        "Revalidated",
        "Revalidated",
        "Verify",
        "Upcoming",
        "/remediation"
      ),
      milestone(
        "ProofDelivered",
        "Proof delivered",
        "Prove",
        "Upcoming",
        "/reports"
      )
    ],
    nextAction: {
      href: "/missions",
      label: "Finish scope verification",
      reason: "No scope has a current Verified status."
    },
    profile: {
      completedAt: "2026-07-14T14:00:00.000Z",
      membershipId: "17171717-1717-4717-8717-171717171717",
      primaryOutcome: "RunProofLoop",
      productPersona: "SecurityEngineer",
      updatedAt: "2026-07-14T14:00:00.000Z"
    },
    totalMilestones: 9,
    ...overrides
  };
}

describe("buildProofLoopMapNodes", () => {
  it("maps product stages in PROOF_LOOP_HELP order with live milestone state", () => {
    const nodes = buildProofLoopMapNodes(activationState());
    expect(nodes.map((n) => n.stage)).toEqual([...PROOF_LOOP_STAGE_LABELS]);
    expect(nodes.find((n) => n.stage === "Connect")?.state).toBe("Completed");
    expect(nodes.find((n) => n.stage === "Authorize")?.state).toBe("Current");
    expect(nodes.find((n) => n.stage === "Authorize")?.href).toBe("/missions");
    expect(nodes.find((n) => n.stage === "Validate")?.state).toBe("Upcoming");
    expect(nodes.find((n) => n.stage === "Prove")?.href).toBe("/reports");
  });

  it("uses catalog hrefs when activation is empty (honest upcoming)", () => {
    const nodes = buildProofLoopMapNodes(null);
    expect(nodes.every((n) => n.state === "Upcoming")).toBe(true);
    expect(nodes.map((n) => n.href)).toEqual(
      PROOF_LOOP_HELP.map((stage) => stage.href)
    );
  });

  it("marks Partial when some stage milestones are complete", () => {
    const nodes = buildProofLoopMapNodes(
      activationState({
        currentStage: "Validate",
        milestones: [
          milestone(
            "AccountCreated",
            "Account created",
            "Connect",
            "Completed",
            "/"
          ),
          milestone(
            "SourceConnected",
            "Source connected",
            "Connect",
            "Completed",
            "/integrations"
          ),
          milestone(
            "ScopeVerified",
            "Scope verified",
            "Authorize",
            "Completed",
            "/missions"
          ),
          milestone(
            "PolicyPreviewed",
            "Policy previewed",
            "Authorize",
            "Upcoming",
            "/missions"
          ),
          milestone(
            "MissionCreated",
            "Mission created",
            "Validate",
            "Current",
            "/missions"
          ),
          milestone(
            "MeasuredResult",
            "Measured result",
            "Understand",
            "Upcoming",
            "/findings"
          ),
          milestone(
            "RemediationCreated",
            "Remediation created",
            "Act",
            "Upcoming",
            "/remediation"
          ),
          milestone(
            "Revalidated",
            "Revalidated",
            "Verify",
            "Upcoming",
            "/remediation"
          ),
          milestone(
            "ProofDelivered",
            "Proof delivered",
            "Prove",
            "Upcoming",
            "/reports"
          )
        ],
        nextAction: {
          href: "/missions",
          label: "Preview mission policy",
          reason: "Policy still needed."
        }
      })
    );
    expect(nodes.find((n) => n.stage === "Authorize")?.state).toBe("Partial");
    expect(nodes.find((n) => n.stage === "Validate")?.state).toBe("Current");
  });
});

describe("proofLoopMapProgress", () => {
  it("counts completed stages and surfaces current", () => {
    const progress = proofLoopMapProgress(
      buildProofLoopMapNodes(activationState())
    );
    expect(progress.completedStages).toBe(1);
    expect(progress.totalStages).toBe(7);
    expect(progress.current?.stage).toBe("Authorize");
  });
});

describe("ProofLoopMap", () => {
  it("renders hero variant with product stages and deep links (not CTEM)", () => {
    render(
      <ProofLoopMap activation={activationState()} variant="hero" />
    );

    const map = screen.getByTestId("proof-loop-map-hero");
    expect(map).toHaveAttribute("aria-label", "Proof loop product map");

    for (const stage of PROOF_LOOP_STAGE_LABELS) {
      expect(
        within(map).getByRole("link", { name: new RegExp(`^${stage}\\b`, "u") })
      ).toBeInTheDocument();
    }

    // CTEM program vocabulary must not replace the product loop on this map.
    expect(within(map).queryByRole("link", { name: /Discover/u })).toBeNull();
    expect(within(map).queryByRole("link", { name: /Prioritize/u })).toBeNull();
    expect(within(map).queryByRole("link", { name: /Mobilize/u })).toBeNull();

    const authorize = within(map).getByRole("link", {
      name: /Authorize — Now/u
    });
    expect(authorize).toHaveAttribute("href", "/missions");
    expect(authorize).toHaveAttribute("aria-current", "step");

    expect(
      within(map).getByRole("link", { name: /Finish scope verification/u })
    ).toHaveAttribute("href", "/missions");
  });

  it("renders panel variant with stage connectors and milestone counts", () => {
    render(
      <ProofLoopMap activation={activationState()} variant="panel" />
    );
    const map = screen.getByTestId("proof-loop-map-panel");
    expect(
      within(map).getByRole("list", { name: "Proof-loop stage map" })
    ).toBeInTheDocument();
    expect(within(map).getByText(/1 of 7 stages complete/u)).toBeInTheDocument();
    expect(
      within(map).getByRole("link", { name: /Connect.*Done/u })
    ).toHaveAttribute("href", "/integrations");
    expect(
      within(map).getByRole("link", { name: /Authorize.*Now/u })
    ).toHaveAttribute("href", "/missions");
  });

  it("renders compact rail variant with next action deep link", () => {
    render(
      <ProofLoopMap activation={activationState()} variant="rail" />
    );
    const map = screen.getByTestId("proof-loop-map-rail");
    expect(map).toBeInTheDocument();
    expect(
      within(map).getByRole("link", { name: /Finish scope verification/u })
    ).toHaveAttribute("href", "/missions");
    expect(
      within(map).getByRole("link", { name: "Authorize: Now" })
    ).toHaveAttribute("href", "/missions");
  });

  it("loading keeps stages upcoming without inventing completion", () => {
    render(<ProofLoopMap activation={activationState()} loading variant="panel" />);
    const map = screen.getByTestId("proof-loop-map-panel");
    expect(within(map).getByText(/0 of 7 stages complete/u)).toBeInTheDocument();
  });
});
