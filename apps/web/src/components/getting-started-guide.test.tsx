import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductActivationState } from "@periscan/shared";

import { GettingStartedGuide } from "./getting-started-guide";

const activationState: ProductActivationState = {
  completedMilestones: 2,
  currentStage: "Authorize",
  diagnostics: [
    {
      code: "scope_missing",
      detail: "Declare and verify the customer-authorized boundary.",
      href: "/scopes",
      severity: "Attention",
      title: "No authorized scope yet"
    }
  ],
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
      "/remediations"
    ),
    milestone(
      "Revalidated",
      "Revalidated",
      "Verify",
      "Upcoming",
      "/remediations"
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
    href: "/scopes",
    label: "Add a scope",
    reason: "No verified scope has been persisted."
  },
  profile: {
    completedAt: "2026-07-14T14:00:00.000Z",
    membershipId: "17171717-1717-4717-8717-171717171717",
    primaryOutcome: "RunProofLoop",
    productPersona: "SecurityEngineer",
    updatedAt: "2026-07-14T14:00:00.000Z"
  },
  totalMilestones: 9
};

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

describe("GettingStartedGuide", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders persisted activation progress and the recommended next action", async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify(activationState), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchImpl);

    render(<GettingStartedGuide />);

    expect(
      await screen.findByRole("heading", {
        name: "Complete your first proof loop"
      })
    ).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/experience/activation",
      expect.objectContaining({ cache: "no-store" })
    );
    expect(
      screen.getByRole("progressbar", { name: "Getting-started progress" })
    ).toHaveAttribute("aria-valuenow", "22");
    expect(screen.getByText("2 of 9 milestones")).toBeInTheDocument();
    expect(screen.getByText("Add a scope")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue" })).toHaveAttribute(
      "href",
      "/scopes"
    );
    // P02-18: spatial product map from the same activation payload.
    expect(screen.getByTestId("proof-loop-map-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Proof-loop stage map" })
    ).toBeInTheDocument();
    expect(screen.getByText("No authorized scope yet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Practice in demo mode" })
    ).toHaveAttribute("href", "/demo/workspace");
    expect(
      screen.getByText(/Demo progress is intentionally separate/u)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Make continuous proof operational" })
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("heading", { name: "Qualify assets and scope" })
        .closest("article")
        ?.querySelector("a")
    ).toHaveAttribute("href", "/assets");
    expect(
      screen
        .getByRole("heading", { name: "Schedule continuous validation" })
        .closest("article")
        ?.querySelector("a")
    ).toHaveAttribute("href", "/schedules");
    expect(
      screen
        .getByRole("heading", { name: "Harden runner coverage" })
        .closest("article")
        ?.querySelector("a")
    ).toHaveAttribute("href", "/runners");
    expect(
      screen.queryByText("Govern model economics")
    ).not.toBeInTheDocument();
  });
});
