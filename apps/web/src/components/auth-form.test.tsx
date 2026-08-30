import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh })
}));

function mockLoginFetch(options?: {
  productPersona?: string | null;
}) {
  const persona = options?.productPersona ?? "SecurityEngineer";
  const now = "2026-07-14T20:00:00.000Z";
  const membershipId = "11111111-1111-4111-8111-111111111111";
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/v1/auth/login" && init?.method === "POST") {
      return new Response(JSON.stringify({}), { status: 200 });
    }
    if (String(input) === "/api/v1/experience/activation") {
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
            productPersona: persona,
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
  });
}

async function submitLogin() {
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "owner@acme.example" }
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "a-secure-password" }
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("AuthForm", () => {
  afterEach(() => {
    push.mockReset();
    refresh.mockReset();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    vi.unstubAllGlobals();
  });

  it("opens the isolated demo without creating an authenticated session", () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    render(<AuthForm mode="login" />);

    fireEvent.click(screen.getByRole("button", { name: "Use demo login" }));

    expect(push).toHaveBeenCalledWith("/demo/workspace");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(
      JSON.parse(localStorage.getItem("periscan.demo.guide.v1") ?? "[]")
    ).toEqual(["start"]);
    expect(
      screen.getByText(/No customer session or credentials are created/u)
    ).toBeInTheDocument();
  });

  it("persists a configured evidence-storage region during signup", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/v1/auth/data-residency-options") {
          return new Response(
            JSON.stringify({
              defaultRegion: "us-east-1",
              regions: [
                { id: "eu-central-1", label: "European Union · Frankfurt" },
                { id: "us-east-1", label: "United States · East" }
              ]
            }),
            { status: 200 }
          );
        }
        if (
          String(input) === "/api/v1/auth/signup" &&
          init?.method === "POST"
        ) {
          return new Response(JSON.stringify({}), { status: 201 });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), {
          status: 404
        });
      }
    );
    vi.stubGlobal("fetch", fetchImpl);

    render(<AuthForm mode="signup" />);

    const region = await screen.findByLabelText("Data residency");
    fireEvent.change(region, { target: { value: "eu-central-1" } });
    fireEvent.change(screen.getByLabelText("Your name"), {
      target: { value: "Security Owner" }
    });
    fireEvent.change(screen.getByLabelText("Organization"), {
      target: { value: "Acme" }
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "owner@acme.example" }
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "a-secure-password" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    // P02-1 residual: signup lands on Home GetStarted, not Welcome spine.
    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    const signupCall = fetchImpl.mock.calls.find(
      ([input]) => String(input) === "/api/v1/auth/signup"
    );
    expect(JSON.parse(String(signupCall?.[1]?.body))).toMatchObject({
      dataRegion: "eu-central-1",
      tenantName: "Acme"
    });
  });

  it("honors middleware ?next= deep link after successful login", async () => {
    window.history.replaceState({}, "", "/login?next=/findings");
    vi.stubGlobal("fetch", mockLoginFetch());

    render(<AuthForm mode="login" />);
    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/findings"));
    expect(push).not.toHaveBeenCalledWith("/dashboard");
  });

  it("falls back to persona home when next is absent", async () => {
    window.history.replaceState({}, "", "/login");
    vi.stubGlobal(
      "fetch",
      mockLoginFetch({ productPersona: "SecurityLeader" })
    );

    render(<AuthForm mode="login" />);
    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/executive"));
  });

  it("rejects open-redirect next values and uses persona home instead", async () => {
    window.history.replaceState({}, "", "/login?next=//evil.com");
    vi.stubGlobal(
      "fetch",
      mockLoginFetch({ productPersona: "GrcAuditor" })
    );

    render(<AuthForm mode="login" />);
    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/reports"));
    expect(push).not.toHaveBeenCalledWith("//evil.com");
  });
});
