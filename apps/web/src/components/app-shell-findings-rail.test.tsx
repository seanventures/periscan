import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductActivationState } from "@periscan/shared";

import { AppShell } from "./app-shell";

const nav = vi.hoisted(() => ({ pathname: "/findings" }));

const api = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getMe: vi.fn(),
  getProductActivationState: vi.fn(),
  getTenantLocalization: vi.fn(),
  logout: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn()
  })
}));

vi.mock("../lib/periscan-api-client", () => ({
  PeriscanApiClientError: class PeriscanApiClientError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "PeriscanApiClientError";
      this.status = status;
    }
  },
  browserPeriscanApiClient: api
}));

function milestone(
  key: ProductActivationState["milestones"][number]["key"],
  stage: ProductActivationState["milestones"][number]["stage"],
  state: ProductActivationState["milestones"][number]["state"],
  href: string
): ProductActivationState["milestones"][number] {
  return {
    completedAt: state === "Completed" ? "2026-09-17T19:00:00.000Z" : null,
    evidenceBasis: `${key} ${state}`,
    href,
    key,
    label: key,
    stage,
    state
  };
}

function activation(
  nextAction: ProductActivationState["nextAction"]
): ProductActivationState {
  return {
    completedMilestones: 6,
    currentStage: "Act",
    diagnostics: [],
    maturity: "Measured",
    measuredAt: "2026-09-17T20:00:00.000Z",
    milestones: [
      milestone("AccountCreated", "Connect", "Completed", "/dashboard"),
      milestone("SourceConnected", "Connect", "Completed", "/integrations"),
      milestone("ScopeVerified", "Authorize", "Completed", "/scopes"),
      milestone("PolicyPreviewed", "Authorize", "Completed", "/missions"),
      milestone("MissionCreated", "Validate", "Completed", "/missions"),
      milestone("MeasuredResult", "Validate", "Completed", "/findings"),
      milestone("RemediationCreated", "Act", "Current", "/remediation"),
      milestone("Revalidated", "Verify", "Upcoming", "/remediation"),
      milestone("ProofDelivered", "Prove", "Upcoming", "/reports")
    ],
    nextAction,
    profile: {
      completedAt: "2026-09-17T19:00:00.000Z",
      membershipId: "17171717-1717-4717-8717-171717171717",
      primaryOutcome: "RunProofLoop",
      productPersona: "SecurityEngineer",
      updatedAt: "2026-09-17T19:00:00.000Z"
    },
    totalMilestones: 9
  };
}

function stubSession() {
  api.getMe.mockResolvedValue({
    user: { name: "G", email: "g@periscan.test" },
    tenant: { name: "GA loop7" }
  });
  api.getHealth.mockResolvedValue({
    service: "api",
    status: "ok",
    timestamp: "2026-09-17T20:00:00.000Z"
  });
  api.getTenantLocalization.mockResolvedValue({
    preferredLocale: "en-US"
  });
}

describe("AppShell findings rail (loop 7 competing CTA)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    nav.pathname = "/findings";
  });

  it("does not paint Route the smallest fix on /findings", async () => {
    stubSession();
    api.getProductActivationState.mockResolvedValue(
      activation({
        href: "/remediation",
        label: "Route the smallest fix",
        reason: "No measured result has been routed into remediation."
      })
    );

    render(
      <AppShell>
        <p>findings body</p>
      </AppShell>
    );

    expect(await screen.findByText("findings body")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getProductActivationState).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(screen.queryByTestId("rail-primary-cta")).not.toBeInTheDocument();
    });
    expect(
      screen.queryByRole("link", { name: /Route the smallest fix/i })
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Show Labs & more/i)).toBeInTheDocument();
    expect(screen.queryByText(/Mark Fixed/i)).not.toBeInTheDocument();
  });

  it("still paints Route the smallest fix on Home", async () => {
    nav.pathname = "/dashboard";
    stubSession();
    api.getProductActivationState.mockResolvedValue(
      activation({
        href: "/remediation",
        label: "Route the smallest fix",
        reason: "No measured result has been routed into remediation."
      })
    );

    render(
      <AppShell>
        <p>home body</p>
      </AppShell>
    );

    const cta = await screen.findByTestId("rail-primary-cta");
    expect(cta).toHaveTextContent(/Route the smallest fix/i);
    expect(cta).toHaveAttribute("href", "/remediation");
  });

  it("keeps Authorize scope on empty /findings", async () => {
    stubSession();
    api.getProductActivationState.mockResolvedValue({
      ...activation({
        href: "/scopes",
        label: "Authorize scope",
        reason: "Nothing runs outside verified authorized scope."
      }),
      completedMilestones: 1,
      currentStage: "Authorize",
      maturity: "New",
      milestones: []
    });

    render(
      <AppShell>
        <p>empty findings</p>
      </AppShell>
    );

    const cta = await screen.findByTestId("rail-primary-cta");
    expect(cta).toHaveTextContent(/Authorize scope/i);
    expect(cta).toHaveAttribute("href", "/scopes");
  });
});
