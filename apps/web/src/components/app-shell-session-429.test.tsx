import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductActivationState } from "@periscan/shared";

import { PeriscanApiClientError } from "../lib/periscan-api-client";
import { AppShell } from "./app-shell";

const api = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getMe: vi.fn(),
  getProductActivationState: vi.fn(),
  getTenantLocalization: vi.fn(),
  logout: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/findings",
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn()
  })
}));

vi.mock("../lib/periscan-api-client", () => {
  class MockPeriscanApiClientError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "PeriscanApiClientError";
      this.status = status;
    }
  }
  return {
    PeriscanApiClientError: MockPeriscanApiClientError,
    browserPeriscanApiClient: api
  };
});

function activation(): ProductActivationState {
  return {
    completedMilestones: 3,
    currentStage: "Understand",
    diagnostics: [],
    maturity: "Activating",
    measuredAt: "2026-09-17T20:00:00.000Z",
    milestones: [],
    nextAction: {
      href: "/findings",
      label: "Review findings",
      reason: "A measured Community result is persisted."
    },
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

describe("AppShell session chrome on 429", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("does not flip the header to Sign in when getMe is rate limited", async () => {
    api.getMe.mockRejectedValue(
      new PeriscanApiClientError(
        429,
        "Rate limit exceeded, retry in 1 second"
      )
    );
    api.getHealth.mockResolvedValue({
      service: "api",
      status: "ok",
      timestamp: "2026-09-17T20:00:00.000Z"
    });
    api.getProductActivationState.mockResolvedValue(activation());
    api.getTenantLocalization.mockResolvedValue({
      preferredLocale: "en-US"
    });

    render(
      <AppShell>
        <p>findings body</p>
      </AppShell>
    );

    expect(await screen.findByText("findings body")).toBeInTheDocument();
    await waitFor(() => {
      expect(api.getMe).toHaveBeenCalled();
    });
    expect(
      screen.queryByRole("link", { name: "Sign in" })
    ).not.toBeInTheDocument();
  });

  it("still offers Sign in when the session is actually 401", async () => {
    api.getMe.mockRejectedValue(
      new PeriscanApiClientError(401, "Authentication required")
    );
    api.getHealth.mockResolvedValue({
      service: "api",
      status: "ok",
      timestamp: "2026-09-17T20:00:00.000Z"
    });
    api.getProductActivationState.mockResolvedValue(activation());
    api.getTenantLocalization.mockResolvedValue({
      preferredLocale: "en-US"
    });

    render(
      <AppShell>
        <p>findings body</p>
      </AppShell>
    );

    expect(
      await screen.findByRole("link", { name: "Sign in" })
    ).toHaveAttribute("href", "/login");
  });
});
