import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm } from "./auth-form";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh })
}));

const AUTH_TAGLINE = "Find the path. Validate the risk. Prove it's fixed.";
const AUTH_WHAT =
  "Prove authorized exposures with evidence. Fixed only after a retest.";

function mockResidencyFetch(options?: {
  defaultRegion?: string;
  failOptions?: boolean;
  regions?: { id: string; label: string }[];
}) {
  const defaultRegion = options?.defaultRegion ?? "us-east-1";
  const regions = options?.regions ?? [
    { id: "eu-central-1", label: "European Union · Frankfurt" },
    { id: "us-east-1", label: "United States · East" }
  ];
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/v1/auth/data-residency-options") {
      if (options?.failOptions) {
        return new Response(JSON.stringify({ error: "unavailable" }), {
          status: 500
        });
      }
      return new Response(JSON.stringify({ defaultRegion, regions }), {
        status: 200
      });
    }
    if (String(input) === "/api/v1/auth/signup" && init?.method === "POST") {
      return new Response(JSON.stringify({}), { status: 201 });
    }
    return new Response(JSON.stringify({ error: "unexpected" }), {
      status: 404
    });
  });
}

async function submitSignup() {
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
}

function mockLoginFetch(options?: { productPersona?: string | null }) {
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
    cleanup();
    push.mockReset();
    refresh.mockReset();
    window.history.replaceState({}, "", "/");
    try {
      window.localStorage.clear();
    } catch {
      // Node 26 may expose a non-functional localStorage; jsdom still persists.
    }
    vi.unstubAllGlobals();
  });

  it("opens the isolated demo without creating an authenticated session", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, value);
      }
    });
    const fetchImpl = vi.fn();
    vi.stubGlobal("fetch", fetchImpl);

    render(<AuthForm mode="login" />);

    fireEvent.click(screen.getByRole("button", { name: "Use demo login" }));

    expect(push).toHaveBeenCalledWith("/demo/workspace");
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(JSON.parse(store.get("periscan.demo.guide.v1") ?? "[]")).toEqual([
      "start"
    ]);
    expect(
      screen.getByText(/No customer session or credentials are created/u)
    ).toBeInTheDocument();
  });

  it("puts create-account on the login card as a peer of sign-in", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<AuthForm mode="login" />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Sign in" })
    ).toBeInTheDocument();
    expect(screen.getByText(AUTH_TAGLINE)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create account" })
    ).toHaveAttribute("href", "/signup");
    expect(
      screen.queryByRole("link", { name: "Sign in" })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/New to Periscan/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/evidence command center/i)
    ).not.toBeInTheDocument();
  });

  it("says what Periscan is on login first paint, not BAS or a scanner", () => {
    vi.stubGlobal("fetch", vi.fn());

    render(<AuthForm mode="login" />);

    expect(screen.getByText(AUTH_TAGLINE)).toBeInTheDocument();
    expect(screen.getByText(AUTH_WHAT)).toBeInTheDocument();
    expect(screen.getByText(/authorized/)).toBeInTheDocument();
    expect(screen.getByText(/evidence/)).toBeInTheDocument();
    expect(screen.getByText(/Fixed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "What this is" })).toHaveAttribute(
      "href",
      "/demo"
    );
    expect(
      screen.queryByText(/evidence command center/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/\bBAS\b/)).not.toBeInTheDocument();
    expect(screen.queryByText(/scanner/i)).not.toBeInTheDocument();
  });

  it("keeps signup H1 as Create account and drops command-center jargon", async () => {
    const fetchImpl = mockResidencyFetch({
      regions: [{ id: "us-east-1", label: "United States · East" }]
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<AuthForm mode="signup" />);
    await waitFor(() => expect(fetchImpl).toHaveBeenCalled());

    expect(
      screen.getByRole("heading", { level: 1, name: "Create account" })
    ).toBeInTheDocument();
    expect(screen.getByText(AUTH_TAGLINE)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login"
    );
    expect(
      screen.queryByRole("link", { name: "Create account" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/evidence command center/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Already have an account/i)
    ).not.toBeInTheDocument();
  });

  it("defaults a single Community region without residency ceremony", async () => {
    const fetchImpl = mockResidencyFetch({
      defaultRegion: "us-east-1",
      regions: [{ id: "us-east-1", label: "United States · East" }]
    });
    vi.stubGlobal("fetch", fetchImpl);

    render(<AuthForm mode="signup" />);
    await waitFor(() =>
      expect(
        fetchImpl.mock.calls.some(
          ([input]) => String(input) === "/api/v1/auth/data-residency-options"
        )
      ).toBe(true)
    );

    expect(screen.queryByLabelText("Data residency")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Loading configured regions/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/fixed at workspace provisioning/i)
    ).not.toBeInTheDocument();

    await submitSignup();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    const signupCall = fetchImpl.mock.calls.find(
      ([input]) => String(input) === "/api/v1/auth/signup"
    );
    expect(JSON.parse(String(signupCall?.[1]?.body))).toMatchObject({
      dataRegion: "us-east-1",
      tenantName: "Acme"
    });
  });

  it("creates an account on the deployment default when residency options fail", async () => {
    const fetchImpl = mockResidencyFetch({ failOptions: true });
    vi.stubGlobal("fetch", fetchImpl);

    render(<AuthForm mode="signup" />);
    await submitSignup();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    const signupCall = fetchImpl.mock.calls.find(
      ([input]) => String(input) === "/api/v1/auth/signup"
    );
    const body = JSON.parse(String(signupCall?.[1]?.body)) as {
      dataRegion?: string;
    };
    expect(body.dataRegion).toBeUndefined();
    expect(screen.queryByLabelText("Data residency")).not.toBeInTheDocument();
  });

  it("persists a chosen region when more than one is configured", async () => {
    const fetchImpl = mockResidencyFetch();
    vi.stubGlobal("fetch", fetchImpl);

    render(<AuthForm mode="signup" />);

    const region = await screen.findByLabelText("Data residency");
    expect(
      screen.getByText("Where evidence is stored. Can't change later.")
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/fixed at workspace provisioning/i)
    ).not.toBeInTheDocument();
    fireEvent.change(region, { target: { value: "eu-central-1" } });
    await submitSignup();

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
    vi.stubGlobal("fetch", mockLoginFetch({ productPersona: "GrcAuditor" }));

    render(<AuthForm mode="login" />);
    await submitLogin();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/reports"));
    expect(push).not.toHaveBeenCalledWith("//evil.com");
  });
});
