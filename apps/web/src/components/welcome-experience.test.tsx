import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WelcomeExperience } from "./welcome-experience";

const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
let searchParams = new URLSearchParams("customize=1");

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh, replace }),
  useSearchParams: () => searchParams
}));

describe("WelcomeExperience", () => {
  afterEach(() => {
    push.mockReset();
    replace.mockReset();
    refresh.mockReset();
    searchParams = new URLSearchParams("customize=1");
    vi.unstubAllGlobals();
  });

  it("stores role and outcome as navigation preferences and always continues to Home", async () => {
    const now = "2026-07-14T20:00:00.000Z";
    const membershipId = "11111111-1111-4111-8111-111111111111";
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === "/api/v1/experience/activation") {
        return new Response(
          JSON.stringify({
            completedMilestones: 1,
            currentStage: "Connect",
            diagnostics: [],
            maturity: "New",
            measuredAt: now,
            milestones: [],
            nextAction: {
              href: "/integrations",
              label: "Connect a source",
              reason: "Measured data begins with an authorized source."
            },
            profile: {
              completedAt: null,
              membershipId,
              primaryOutcome: null,
              productPersona: null,
              updatedAt: now
            },
            totalMilestones: 9
          }),
          { status: 200 }
        );
      }

      if (input === "/api/v1/experience/profile" && init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            completedAt: now,
            membershipId,
            primaryOutcome: "RunProofLoop",
            productPersona: "SecurityEngineer",
            updatedAt: now
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: "unexpected" }), {
        status: 404
      });
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<WelcomeExperience />);

    expect(
      await screen.findByText(/Security leaders continue to Executive/u)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Security engineer/ }));
    fireEvent.click(screen.getByRole("button", { name: /Run a proof loop/ }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Continue to Home setup/u
      })
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/v1/experience/profile",
      expect.objectContaining({
        body: JSON.stringify({
          primaryOutcome: "RunProofLoop",
          productPersona: "SecurityEngineer"
        }),
        method: "PUT"
      })
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("lands SecurityLeader on /executive after persona save (leadership first-run)", async () => {
    const now = "2026-07-14T20:00:00.000Z";
    const membershipId = "11111111-1111-4111-8111-111111111111";
    const fetchImpl = vi.fn(async (input: string, init?: RequestInit) => {
      if (input === "/api/v1/experience/activation") {
        return new Response(
          JSON.stringify({
            completedMilestones: 1,
            currentStage: "Connect",
            diagnostics: [],
            maturity: "New",
            measuredAt: now,
            milestones: [],
            nextAction: {
              href: "/integrations",
              label: "Connect a source",
              reason: "Measured data begins with an authorized source."
            },
            profile: {
              completedAt: null,
              membershipId,
              primaryOutcome: null,
              productPersona: null,
              updatedAt: now
            },
            totalMilestones: 9
          }),
          { status: 200 }
        );
      }

      if (input === "/api/v1/experience/profile" && init?.method === "PUT") {
        return new Response(
          JSON.stringify({
            completedAt: now,
            membershipId,
            primaryOutcome: "PrioritizeRisk",
            productPersona: "SecurityLeader",
            updatedAt: now
          }),
          { status: 200 }
        );
      }

      return new Response(JSON.stringify({ error: "unexpected" }), {
        status: 404
      });
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<WelcomeExperience />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Security leader/i })
    );
    fireEvent.click(screen.getByRole("button", { name: /Prioritize risk/i }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Continue to Executive/u
      })
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith("/executive"));
  });

  it("redirects signed-in bare /welcome to Home (not a first-run spine)", async () => {
    searchParams = new URLSearchParams();
    const now = "2026-07-14T20:00:00.000Z";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/experience/activation") {
          return new Response(
            JSON.stringify({
              completedMilestones: 1,
              currentStage: "Connect",
              diagnostics: [],
              maturity: "New",
              measuredAt: now,
              milestones: [],
              nextAction: {
                href: "/integrations",
                label: "Connect a source",
                reason: "Measured data begins with an authorized source."
              },
              profile: {
                completedAt: null,
                membershipId: "11111111-1111-4111-8111-111111111111",
                primaryOutcome: null,
                productPersona: null,
                updatedAt: now
              },
              totalMilestones: 9
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ error: "unexpected" }), {
          status: 404
        });
      })
    );

    render(<WelcomeExperience />);

    expect(
      await screen.findByText(/Setup lives on the dashboard/u)
    ).toBeInTheDocument();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    expect(
      screen.queryByRole("button", { name: /Security engineer/ })
    ).not.toBeInTheDocument();
  });

  it("shows login and signup only when unauthenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401
        })
      )
    );

    render(<WelcomeExperience />);

    expect(
      await screen.findByRole("heading", { name: /Sign in to get started/u })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in/u })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      screen.getByRole("link", { name: /Create account/u })
    ).toHaveAttribute("href", "/signup");
    expect(
      screen.queryByRole("button", { name: /Security engineer/ })
    ).not.toBeInTheDocument();
  });
});
