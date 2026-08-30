/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductActivationState } from "@periscan/shared";

import {
  FIRST_PROOF_RESUME_KEY,
  writeFirstProofResume
} from "../lib/first-proof-resume";
import { GetStarted } from "./get-started";

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
    completedMilestones: 1,
    currentStage: "Connect",
    diagnostics: [],
    maturity: "New",
    measuredAt: "2026-07-14T15:00:00.000Z",
    milestones: [
      milestone("AccountCreated", "Account created", "Connect", "Completed", "/"),
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
    ],
    nextAction: {
      href: "/integrations",
      label: "Connect a source",
      reason: "Measured data begins with an authorized source."
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

function ensureLocalStorage() {
  try {
    if (typeof globalThis.localStorage?.clear === "function") {
      return;
    }
  } catch {
    // Node 26 exposes localStorage as undefined without --localstorage-file.
  }
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      clear: () => {
        store.clear();
      },
      getItem: (key: string) => store.get(key) ?? null,
      key: (index: number) => [...store.keys()][index] ?? null,
      get length() {
        return store.size;
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      }
    }
  });
}

describe("GetStarted Community link a11y", () => {
  it("underlines in-paragraph API copy links", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/get-started.tsx"),
      "utf8"
    );
    expect(source).toMatch(
      /className="[^"]*underline[^"]*"\s+data-testid="get-started-api-reference"/
    );
    expect(source).toMatch(
      /className="[^"]*underline[^"]*"\s+data-testid="get-started-api-for-automation"/
    );
  });
});

describe("GetStarted", () => {
  beforeEach(() => {
    ensureLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    ensureLocalStorage();
    localStorage.clear();
  });

  it("links the 3-step setup into the full getting-started checklist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(activationState()), { status: 200 })
      )
    );

    render(<GetStarted userName="Ada Lovelace" />);

    expect(
      await screen.findByRole("heading", {
        name: "Let's prove your first path."
      })
    ).toBeInTheDocument();
    // P02-5 / UX-W1 #36–38: singular primary CTA from resolveFirstRunPrimaryAction.
    const primaryCta = screen.getByTestId("get-started-primary-cta");
    expect(primaryCta).toHaveAttribute("href", "/scopes");
    expect(primaryCta).toHaveTextContent(/Start — connect a source/u);
    // Exactly one primary CTA test id (no competing brand-filled heroes).
    expect(screen.getAllByTestId("get-started-primary-cta")).toHaveLength(1);
    expect(screen.getByTestId("get-started-primary-reason")).toHaveTextContent(
      /verified authorized scope/u
    );
    expect(
      screen.queryByRole("link", { name: /Full activation guide/u })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open next proof-loop step/u })
    ).toHaveAttribute("href", "/scopes");
    // Progress bar/text is the 3 setup steps only (AccountCreated alone ≠ source connected)
    expect(screen.getByText(/0 of 3 setup steps/u)).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /First-run setup progress/u })
    ).toBeInTheDocument();
    // UX-W13: no calm success line until at least one setup step is done.
    expect(
      screen.queryByTestId("get-started-progress-success")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/proof-loop milestones/u)
    ).not.toBeInTheDocument();
    // Demo is secondary (muted text), not a peer primary button.
    expect(screen.getByTestId("get-started-demo-secondary")).toHaveAttribute(
      "href",
      "/demo"
    );
    expect(
      screen.getByRole("link", {
        name: /Explore a live sample/u
      })
    ).toHaveAttribute("href", "/demo");
    expect(
      screen.getByText(/left rail shows the Operate path/u)
    ).toBeInTheDocument();
    expect(screen.getByTestId("get-started-setup-meter")).toBeInTheDocument();
    expect(screen.getByTestId("get-started-full-loop-details")).not.toHaveAttribute(
      "open"
    );
    for (const card of screen.getAllByTestId("get-started-step-card")) {
      expect(card.className).toMatch(/focus-visible:ring-2/);
    }

    // Mid-market / VP pilot confidence: Success = Measured + one re-validate.
    expect(screen.getByTestId("get-started-success-criteria")).toHaveTextContent(
      /Success\s*=\s*Measured\s*\+\s*one re-validate/i
    );
    expect(screen.getByTestId("get-started-success-criteria")).toHaveTextContent(
      /Fixed only via verification/i
    );
    // P04 trust: runner optional honesty for cloud/source-side snapshot.
    expect(screen.getByTestId("get-started-runner-optional")).toHaveTextContent(
      /Runner optional/i
    );
    expect(screen.getByTestId("get-started-runner-optional")).toHaveTextContent(
      /do not require an internal runner/i
    );

    // P04 VP Eng: TTV strip + first measured proof countdown + API reference footer.
    expect(screen.getByTestId("first-run-ttv-strip")).toBeInTheDocument();
    expect(screen.getByTestId("ttv-milestone-connect")).toHaveTextContent(
      /10–20 min|10-20 min/
    );
    // Real progress % from activation (AccountCreated only → ~17%).
    expect(screen.getByTestId("first-measured-proof-countdown")).toBeInTheDocument();
    expect(screen.getByTestId("first-measured-proof-percent")).toHaveTextContent(
      /17%/
    );
    expect(screen.getByTestId("first-measured-proof-status")).toHaveTextContent(
      /1 of 6 activation milestones/i
    );
    // No source yet → API for automation not shown as post-connect CTA.
    expect(
      screen.queryByTestId("get-started-api-for-automation")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("get-started-api-reference")).toHaveAttribute(
      "href",
      "/api-reference"
    );
    expect(screen.getByTestId("get-started-api-reference")).toHaveTextContent(
      /API reference/i
    );
    expect(screen.getByTestId("get-started-api-reference").className).toMatch(
      /underline/
    );
    expect(screen.getByTestId("get-started-footer")).toHaveTextContent(
      /Labs stay hidden/i
    );
    const allLinks = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(allLinks).not.toContain("/labs");
    expect(allLinks).not.toContain("/swarm");
    expect(allLinks).not.toContain("/workflows");

    // P02-18: interactive spatial map replaces decorative radar.
    expect(screen.getByTestId("proof-loop-map-hero")).toBeInTheDocument();
    expect(screen.getByTestId("proof-loop-map-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Connect — Now/u })
    ).toHaveAttribute("href", "/integrations");
    // P02-4: Authorize setup card lands on /scopes.
    expect(
      screen.getByRole("link", { name: /Authorize scope/u })
    ).toHaveAttribute("href", "/scopes");
  });

  it("primary CTA moves to Authorize scope after source is connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              activationState({
                completedMilestones: 2,
                currentStage: "Authorize",
                nextAction: {
                  href: "/scopes",
                  label: "Add a scope",
                  reason: "No verified scope has been persisted."
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
              })
            ),
            { status: 200 }
          )
      )
    );

    render(<GetStarted />);

    await waitFor(() => {
      expect(screen.getByTestId("get-started-primary-cta")).toHaveAttribute(
        "href",
        "/scopes"
      );
    });
    expect(screen.getByTestId("get-started-primary-cta")).toHaveTextContent(
      /Authorize scope/u
    );
    // UX-W13: one calm progress line when activation advances.
    const progress = screen.getByTestId("get-started-progress-success");
    expect(progress).toHaveAttribute("role", "status");
    expect(progress).toHaveTextContent(/1 of 3 setup steps complete/u);
    // P04: after source connected, countdown advances + "API for automation" appears.
    expect(screen.getByTestId("first-measured-proof-percent")).toHaveTextContent(
      /33%/
    );
    expect(screen.getByTestId("first-measured-proof-status")).toHaveTextContent(
      /2 of 6 activation milestones/i
    );
    const apiAuto = screen.getByTestId("get-started-api-for-automation");
    expect(apiAuto).toHaveAttribute("href", "/api-reference");
    expect(apiAuto).toHaveTextContent(/API for automation/i);
    expect(apiAuto.className).toMatch(/underline/);
    expect(screen.getByTestId("get-started-api-reference")).toHaveTextContent(
      /API for automation/i
    );
    expect(screen.getByTestId("get-started-api-reference").className).toMatch(
      /underline/
    );
  });

  it("after setup steps complete, CTAs continue toward Prove milestones", async () => {
    const completeSetup = activationState({
      completedMilestones: 6,
      currentStage: "Act",
      maturity: "Activating",
      nextAction: {
        href: "/remediation",
        label: "Assign remediation",
        reason: "A measured result is ready to act on."
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
          "Completed",
          "/findings"
        ),
        milestone(
          "RemediationCreated",
          "Remediation created",
          "Act",
          "Current",
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

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(completeSetup), { status: 200 })
      )
    );

    render(<GetStarted />);

    expect(
      await screen.findByRole("heading", { name: "Continue toward Prove." })
    ).toBeInTheDocument();
    // UX-W13: calm success when setup complete (not cheese).
    expect(screen.getByTestId("get-started-progress-success")).toHaveTextContent(
      /Setup is in place/u
    );
    // P02-5: helper drives primary CTA from API nextAction after setup.
    expect(screen.getByTestId("get-started-primary-cta")).toHaveAttribute(
      "href",
      "/remediation"
    );
    expect(screen.getByTestId("get-started-primary-cta")).toHaveTextContent(
      "Assign remediation"
    );
    expect(
      screen.queryByRole("link", { name: /Full activation guide/u })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Assign remediation" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: /Continue 3 remaining milestone/u
      })
    ).toHaveAttribute("href", "/remediation");
    expect(screen.getByText(/6 of 9 proof-loop milestones/u)).toBeInTheDocument();

    // After first measured validation, flagship multi-hop journey is visible.
    expect(screen.getByTestId("flagship-multihop-journey")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Measure multi-hop paths hop by hop"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Measure path hops/u })
    ).toHaveAttribute("href", "/attack-paths");
    expect(
      screen.getByRole("link", { name: /Confirm authorized scope/u })
    ).toHaveAttribute("href", "/scopes");

    // Spatial map lights Act as current with remediation deep link.
    expect(screen.getByTestId("proof-loop-map-hero")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Act — Now/u })
    ).toHaveAttribute("href", "/remediation");
  });

  it("shows Resume link from first-proof resume when setup is incomplete", async () => {
    writeFirstProofResume("Authorize scope", "/scopes");

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(activationState()), { status: 200 })
      )
    );

    render(<GetStarted />);

    const resume = await screen.findByTestId("get-started-resume-cta");
    expect(resume).toHaveAttribute("href", "/scopes");
    expect(resume).toHaveTextContent("Resume: Authorize scope");
  });

  it("stores first-proof resume when primary CTA is activated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(activationState()), { status: 200 })
      )
    );

    render(<GetStarted />);

    const primary = await screen.findByTestId("get-started-primary-cta");
    fireEvent.click(primary);

    expect(JSON.parse(localStorage.getItem(FIRST_PROOF_RESUME_KEY) ?? "{}")).toEqual(
      expect.objectContaining({
        step: "Authorize scope",
        href: "/scopes"
      })
    );
  });

  it("clears first-proof resume once setup is complete", async () => {
    writeFirstProofResume("Connect a source", "/integrations");

    const completeSetup = activationState({
      completedMilestones: 6,
      currentStage: "Act",
      maturity: "Activating",
      nextAction: {
        href: "/remediation",
        label: "Assign remediation",
        reason: "A measured result is ready to act on."
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
          "Completed",
          "/findings"
        ),
        milestone(
          "RemediationCreated",
          "Remediation created",
          "Act",
          "Current",
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

    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(completeSetup), { status: 200 })
      )
    );

    render(<GetStarted />);

    expect(
      await screen.findByRole("heading", { name: "Continue toward Prove." })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem(FIRST_PROOF_RESUME_KEY)).toBeNull();
    });
    expect(screen.queryByTestId("get-started-resume-cta")).not.toBeInTheDocument();
  });
});
