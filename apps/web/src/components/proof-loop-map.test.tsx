import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  COMMUNITY_FIRST_RUN_WATCH_LABEL,
  type ProductActivationState
} from "@periscan/shared";

import { PROOF_LOOP_HELP, PROOF_LOOP_STAGE_LABELS } from "../lib/product-help";
import {
  ProofLoopMap,
  buildProofLoopMapNodes,
  proofLoopMapChip,
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

/**
 * Live 554 walk after Community Gitleaks: parent COMPLETED, SourceConnected
 * still Upcoming (optional extra signal). Command-center map does not pass
 * `community`, so this is the post-GetStarted product map.
 */
function afterCommunityGitleaksProof(): ProductActivationState {
  return activationState({
    completedMilestones: 5,
    currentStage: "Act",
    maturity: "Measured",
    nextAction: {
      href: "/remediation",
      label: "Route the smallest fix",
      reason: "No measured result has been routed into remediation."
    },
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
        "Upcoming",
        "/integrations"
      ),
      milestone(
        "ScopeVerified",
        "Scope verified",
        "Authorize",
        "Completed",
        "/scopes"
      ),
      milestone(
        "PolicyPreviewed",
        "Policy previewed",
        "Authorize",
        "Completed",
        "/missions"
      ),
      milestone(
        "MissionCreated",
        "Mission created",
        "Validate",
        "Completed",
        "/missions"
      ),
      milestone(
        "MeasuredResult",
        "Measured result",
        "Understand",
        "Completed",
        "/findings"
      ),
      milestone(
        "RemediationCreated",
        "Remediation assigned",
        "Act",
        "Current",
        "/remediation"
      ),
      milestone(
        "Revalidated",
        "Fix re-validated",
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
    ]
  });
}

/** Parent Community mission still RUNNING; rail Watch is the honest CTA. */
function watchingCommunityActivation(
  measuredState: ProductActivationState["milestones"][number]["state"]
): ProductActivationState {
  return activationState({
    completedMilestones: measuredState === "Completed" ? 6 : 5,
    currentStage: "Understand",
    maturity: "Activating",
    nextAction: {
      href: "/missions/355839a7-3558-4355-8355-355839a73558",
      label: COMMUNITY_FIRST_RUN_WATCH_LABEL,
      reason:
        "Community validation is already in flight. Watch the mission until it captures evidence."
    },
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
        "/scopes"
      ),
      milestone(
        "PolicyPreviewed",
        "Policy previewed",
        "Authorize",
        "Completed",
        "/missions"
      ),
      milestone(
        "MissionCreated",
        "Mission created",
        "Validate",
        "Completed",
        "/missions"
      ),
      milestone(
        "MeasuredResult",
        "Measured result",
        "Understand",
        measuredState,
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
    ]
  });
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
    render(<ProofLoopMap activation={activationState()} variant="hero" />);

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
    render(<ProofLoopMap activation={activationState()} variant="panel" />);
    const map = screen.getByTestId("proof-loop-map-panel");
    expect(
      within(map).getByRole("list", { name: "Proof-loop stage map" })
    ).toBeInTheDocument();
    expect(
      within(map).getByText(/1 of 7 stages complete/u)
    ).toBeInTheDocument();
    expect(
      within(map).getByRole("link", { name: /Connect.*Done/u })
    ).toHaveAttribute("href", "/integrations");
    expect(
      within(map).getByRole("link", { name: /Authorize.*Now/u })
    ).toHaveAttribute("href", "/missions");
  });

  it("renders compact rail variant with next action deep link", () => {
    render(<ProofLoopMap activation={activationState()} variant="rail" />);
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
    render(
      <ProofLoopMap activation={activationState()} loading variant="panel" />
    );
    const map = screen.getByTestId("proof-loop-map-panel");
    expect(
      within(map).getByText(/0 of 7 stages complete/u)
    ).toBeInTheDocument();
  });

  it("Community first-run starts at Authorize, not Connect", () => {
    const emptyCommunity = activationState({
      completedMilestones: 1,
      currentStage: "Connect",
      nextAction: {
        href: "/integrations",
        label: "Connect a source",
        reason: "Measured data begins with an authorized source."
      },
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
          "Current",
          "/integrations"
        ),
        milestone(
          "ScopeVerified",
          "Scope verified",
          "Authorize",
          "Upcoming",
          "/scopes"
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
      ]
    });

    const nodes = buildProofLoopMapNodes(emptyCommunity, { community: true });
    expect(nodes[0]?.stage).toBe("Authorize");
    expect(nodes.some((n) => n.stage === "Connect")).toBe(false);
    expect(nodes[0]?.state).toBe("Current");
    expect(nodes[0]?.href).toBe("/scopes");

    render(
      <ProofLoopMap activation={emptyCommunity} variant="hero" community />
    );
    expect(
      screen.queryByRole("link", { name: /Connect — Now/u })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Authorize — Now/u })
    ).toHaveAttribute("href", "/scopes");
  });

  it("keeps Validate Current, not DONE 1/1, while Community Watch is the primary action", () => {
    const watching = watchingCommunityActivation("Completed");
    const nodes = buildProofLoopMapNodes(watching, { community: true });
    const validate = nodes.find((node) => node.stage === "Validate");

    expect(validate?.state).toBe("Current");
    expect(validate?.state).not.toBe("Completed");
    expect(validate?.completedCount).toBeLessThan(
      Math.max(validate?.totalCount ?? 0, 1)
    );
    expect(validate?.href).toBe(
      "/missions/355839a7-3558-4355-8355-355839a73558"
    );
    expect(
      buildProofLoopMapNodes(watching).find((node) => node.stage === "Validate")
        ?.state
    ).toBe("Current");

    render(<ProofLoopMap activation={watching} variant="panel" community />);
    const map = screen.getByTestId("proof-loop-map-panel");
    const validateLink = within(map).getByRole("link", {
      name: /Validate/u
    });
    expect(validateLink).toHaveAttribute(
      "href",
      "/missions/355839a7-3558-4355-8355-355839a73558"
    );
    expect(validateLink).toHaveAttribute("aria-current", "step");
    expect(validateLink).toHaveTextContent(/Now/u);
    expect(validateLink).not.toHaveTextContent(/Done/u);
    expect(validateLink).not.toHaveTextContent(/1\/1/u);
    expect(
      within(map).getByRole("link", {
        name: new RegExp(COMMUNITY_FIRST_RUN_WATCH_LABEL, "u")
      })
    ).toHaveAttribute("href", "/missions/355839a7-3558-4355-8355-355839a73558");
  });

  it("does not paint Connect IN PROGRESS 1/2 after Community proof when SourceConnected is skipped", () => {
    const proven = afterCommunityGitleaksProof();
    const nodes = buildProofLoopMapNodes(proven);
    const connect = nodes.find((node) => node.stage === "Connect");
    const validate = nodes.find((node) => node.stage === "Validate");

    expect(connect).toBeUndefined();
    expect(nodes.some((node) => node.stage === "Connect")).toBe(false);
    expect(validate?.state).toBe("Completed");
    expect(validate?.chip).toBe("Measured");
    expect(nodes.find((node) => node.stage === "Act")?.state).toBe("Current");

    render(<ProofLoopMap activation={proven} variant="panel" />);
    const map = screen.getByTestId("proof-loop-map-panel");
    expect(
      within(map).queryByRole("link", { name: /Connect/u })
    ).not.toBeInTheDocument();
    expect(map).not.toHaveTextContent(/In progress\s*·\s*1\/2/u);
    expect(map).not.toHaveTextContent(/1\/2/u);
    expect(within(map).getByRole("link", { name: /Act/u })).toHaveTextContent(
      /Now/u
    );
    expect(
      within(map).getByRole("link", { name: /Route the smallest fix/u })
    ).toHaveAttribute("href", "/remediation");
  });

  it("after first Gitleaks measure, Validate is Measured not DONE · 1/1", () => {
    const proven = afterCommunityGitleaksProof();
    const nodes = buildProofLoopMapNodes(proven);
    const validate = nodes.find((node) => node.stage === "Validate");
    const understand = nodes.find((node) => node.stage === "Understand");

    expect(nodes.some((node) => node.stage === "Connect")).toBe(false);
    expect(validate?.state).toBe("Completed");
    expect(validate?.chip).toBe("Measured");
    expect(understand?.state).toBe("Completed");
    expect(understand?.chip).toBe("Done");
    expect(nodes.find((node) => node.stage === "Act")?.state).toBe("Current");
    expect(
      proofLoopMapChip({
        stage: "Validate",
        state: "Completed",
        completedCount: 1,
        totalCount: 1,
        measuredParent: true
      })
    ).toBe("Measured");
    expect(
      proofLoopMapChip({
        stage: "Validate",
        state: "Completed",
        completedCount: 1,
        totalCount: 1,
        measuredParent: false
      })
    ).toBe("Done");

    render(<ProofLoopMap activation={proven} variant="panel" />);
    const map = screen.getByTestId("proof-loop-map-panel");
    const validateLink = within(map).getByRole("link", { name: /Validate/u });
    expect(validateLink).toHaveTextContent(/Measured/u);
    expect(validateLink).not.toHaveTextContent(/Done/u);
    expect(validateLink).not.toHaveTextContent(/1\/1/u);
    expect(map).not.toHaveTextContent(/Done\s*·\s*1\/1/u);
    expect(map).not.toHaveTextContent(/DONE\s*·\s*1\/1/u);
    expect(
      within(map).getByRole("link", { name: /Understand/u })
    ).not.toHaveTextContent(/1\/1/u);
    expect(
      within(map).getByRole("link", { name: /Authorize/u })
    ).toHaveTextContent(/2\/2/u);
    expect(within(map).getByRole("link", { name: /Act/u })).toHaveTextContent(
      /Now/u
    );
    expect(
      within(map).getByRole("link", { name: /Route the smallest fix/u })
    ).toHaveAttribute("href", "/remediation");
  });

  it("still shows Connect as Done when a source is actually connected", () => {
    const connected = activationState();
    const nodes = buildProofLoopMapNodes(connected);
    expect(nodes.find((node) => node.stage === "Connect")?.state).toBe(
      "Completed"
    );
  });
});
