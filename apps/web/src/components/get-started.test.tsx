/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CommunityValidationSuiteResponse,
  ProductActivationState
} from "@periscan/shared";

import {
  FIRST_PROOF_RESUME_KEY,
  writeFirstProofResume
} from "../lib/first-proof-resume";
import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { GetStarted, showFirstMeasuredProofPercent } from "./get-started";

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
    expect(source).toMatch(
      /className="[^"]*underline[^"]*"\s+data-testid="get-started-connect-optional"/
    );
  });
});

describe("GetStarted", () => {
  beforeEach(() => {
    ensureLocalStorage();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    ensureLocalStorage();
    localStorage.clear();
  });

  it("links the 2-step setup into the full getting-started checklist", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              activationState({
                diagnostics: [
                  {
                    code: "source_missing",
                    detail:
                      "Connect a source you already operate. Periscan remains read-only unless the connector explicitly states otherwise.",
                    href: "/integrations",
                    severity: "Attention",
                    title: "No signal source yet"
                  },
                  {
                    code: "scope_missing",
                    detail:
                      "Declare an authorized scope, classify its safety ceiling, and complete verification before active work can run.",
                    href: "/scopes",
                    severity: "Attention",
                    title: "No authorized scope yet"
                  }
                ]
              })
            ),
            { status: 200 }
          )
      )
    );

    render(<GetStarted userName="Ada Lovelace" />);

    expect(
      await screen.findByRole("heading", {
        name: "Keep proving: authorized local path → Gitleaks-class → Fixed after retest."
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/this board stays up/i)
    ).toBeInTheDocument();
    // JTBD-2: hero label MUST match rail — resolveFirstRunPrimaryAction().label.
    const primaryCta = screen.getByTestId("get-started-primary-cta");
    expect(primaryCta).toHaveAttribute("href", "/scopes");
    expect(primaryCta).toHaveTextContent(/Authorize scope/u);
    expect(primaryCta).not.toHaveTextContent(/connect a source/i);
    // Empty Home: one Authorize primary, no Connect twin (optional extra-signal is not a peer CTA).
    expect(
      screen.queryByRole("link", { name: /^Connect a source$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Start — connect a source/u)
    ).not.toBeInTheDocument();
    // Empty tenant: Gitleaks-only one primary. No Prowler second CTA.
    expect(screen.getAllByTestId("get-started-primary-cta")).toHaveLength(1);
    expect(
      screen.queryByTestId("get-started-aws-prowler-cta")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("get-started-primary-reason")).toHaveTextContent(
      /verified authorized scope/u
    );
    expect(
      screen.queryByRole("link", { name: /Full activation guide/u })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Open next proof-loop step/u })
    ).toHaveAttribute("href", "/scopes");
    // Community setup spine: authorize → Community validation (source is optional).
    expect(screen.getByText(/0 of 2 setup steps/u)).toBeInTheDocument();
    expect(screen.queryByText(/0 of 3 setup steps/u)).not.toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: /Board setup progress/u })
    ).toBeInTheDocument();
    const setupCards = screen.getAllByTestId("get-started-step-card");
    expect(setupCards).toHaveLength(2);
    expect(setupCards[0]).toHaveAttribute("href", "/scopes");
    expect(setupCards[0]).toHaveTextContent(/1\s*Authorize scope/u);
    expect(setupCards[0]).not.toHaveTextContent(/Connect a source/i);
    expect(setupCards[1]).toHaveAttribute("href", "/missions");
    expect(setupCards[1]).toHaveTextContent(/2\s*Run Gitleaks-class/u);
    expect(setupCards[1]).toHaveTextContent(/Run Community validation/u);
    expect(setupCards[1]).not.toHaveTextContent(/Prowler/);
    const optionalSource = screen.getByTestId("get-started-connect-optional");
    expect(optionalSource).toHaveAttribute("href", "/integrations");
    expect(optionalSource).toHaveTextContent(/Optional: connect a source/u);
    expect(
      screen.queryByText(/Connect a signal source/u)
    ).not.toBeInTheDocument();
    // First-run diagnostics: scope is the blocker; source-missing is not equal ATTENTION.
    expect(screen.getByText("No authorized scope yet")).toBeInTheDocument();
    expect(screen.queryByText("No signal source yet")).not.toBeInTheDocument();
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
    expect(
      screen.getByTestId("get-started-full-loop-details")
    ).not.toHaveAttribute("open");
    for (const card of screen.getAllByTestId("get-started-step-card")) {
      expect(card.className).toMatch(/focus-visible:ring-2/);
    }

    // Mid-market / VP pilot confidence: Success = Measured + one re-validate.
    expect(
      screen.getByTestId("get-started-success-criteria")
    ).toHaveTextContent(/Success\s*=\s*Measured\s*\+\s*one re-validate/i);
    expect(
      screen.getByTestId("get-started-success-criteria")
    ).toHaveTextContent(/Fixed only via verification/i);
    // P04 trust: runner optional honesty for cloud/source-side snapshot.
    expect(screen.getByTestId("get-started-runner-optional")).toHaveTextContent(
      /Runner optional/i
    );
    expect(screen.getByTestId("get-started-runner-optional")).toHaveTextContent(
      /do not require an internal runner/i
    );

    // P04 VP Eng: TTV strip + first measured proof countdown + API reference footer.
    expect(screen.getByTestId("first-run-ttv-strip")).toBeInTheDocument();
    expect(screen.getByTestId("ttv-milestone-authorize")).toHaveTextContent(
      /10–25 min|10-25 min/
    );
    // Percentage theater: AccountCreated-only is not first proof — hide 17%.
    expect(
      screen.getByTestId("first-measured-proof-countdown")
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("first-measured-proof-percent")
    ).not.toHaveTextContent(/17%/);
    expect(
      screen.getByTestId("first-measured-proof-percent")
    ).toHaveTextContent("—");
    expect(
      screen.getByTestId("first-measured-proof-progressbar")
    ).toHaveAttribute("aria-valuenow", "0");
    expect(
      screen.getByTestId("first-measured-proof-status")
    ).not.toHaveTextContent(/1 of 6 activation milestones/i);
    expect(screen.getByTestId("first-measured-proof-status")).toHaveTextContent(
      /no measured progress yet/i
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
    expect(screen.getByTestId("get-started-footer")).toHaveTextContent(
      /Home, Scope, Validate/
    );
    expect(screen.getByTestId("get-started-footer")).not.toHaveTextContent(
      /Home, Connect, Scope, Validate/
    );
    const allLinks = screen
      .getAllByRole("link")
      .map((a) => a.getAttribute("href"));
    expect(allLinks).not.toContain("/labs");
    expect(allLinks).not.toContain("/swarm");
    expect(allLinks).not.toContain("/workflows");

    // P02-18: interactive spatial map replaces decorative radar.
    expect(screen.getByTestId("proof-loop-map-hero")).toBeInTheDocument();
    expect(screen.getByTestId("proof-loop-map-panel")).toBeInTheDocument();
    // Community first-run: node 1 is Authorize, not Connect-as-Now.
    expect(
      screen.queryByRole("link", { name: /Connect — Now/u })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Authorize — Now/u })
    ).toHaveAttribute("href", "/scopes");
    // P02-4: numbered setup card 1 is Authorize scope, not Connect.
    expect(setupCards[0]).toHaveAttribute("href", "/scopes");
  });

  it("empty Home has one Authorize primary and no Connect twin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(activationState()), { status: 200 })
      )
    );

    render(<GetStarted />);

    const primary = await screen.findByTestId("get-started-primary-cta");
    expect(primary).toHaveAttribute("href", "/scopes");
    expect(primary).toHaveTextContent(/Authorize scope/u);
    expect(screen.getAllByTestId("get-started-primary-cta")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /^Connect a source$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Connect a source →$/i })
    ).not.toBeInTheDocument();
    const setupCards = screen.getAllByTestId("get-started-step-card");
    expect(setupCards[0]).toHaveAttribute("href", "/scopes");
    expect(setupCards[0]).not.toHaveTextContent(/Connect a source/i);
  });

  it("primary CTA stays Authorize scope after an optional source is connected", async () => {
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
      expect(
        screen.getByTestId("first-measured-proof-percent")
      ).toHaveTextContent(/33%/);
    });
    expect(screen.getByTestId("get-started-primary-cta")).toHaveTextContent(
      /Authorize scope/u
    );
    // Optional source is not a numbered setup step — still 0 of 2 until scope.
    expect(screen.getByText(/0 of 2 setup steps/u)).toBeInTheDocument();
    expect(
      screen.queryByTestId("get-started-progress-success")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("get-started-connect-optional")
    ).not.toBeInTheDocument();
    // P04: after source connected, countdown advances + "API for automation" appears.
    expect(
      screen.getByTestId("first-measured-proof-percent")
    ).toHaveTextContent(/33%/);
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

  it("primary CTA is Run Community validation after scope is verified", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              activationState({
                completedMilestones: 2,
                currentStage: "Validate",
                nextAction: {
                  href: "/missions",
                  label: "Preview mission policy",
                  reason: "from API"
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
                    "Current",
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
      expect(screen.getByTestId("get-started-primary-cta")).toHaveTextContent(
        /Run Community validation/u
      );
    });
    expect(screen.getByTestId("get-started-primary-cta")).toHaveAttribute(
      "href",
      "/missions"
    );
    const progress = screen.getByTestId("get-started-progress-success");
    expect(progress).toHaveAttribute("role", "status");
    expect(progress).toHaveTextContent(/1 of 2 setup steps complete/u);
    expect(screen.getByTestId("get-started-setup-meter")).toHaveTextContent(
      /1 of 2 setup steps/u
    );
    const setupCards = screen.getAllByTestId("get-started-step-card");
    expect(setupCards).toHaveLength(2);
    expect(setupCards[0]).toHaveTextContent(/Authorize scope/u);
    expect(setupCards[1]).toHaveTextContent(/Run Community validation/u);
    expect(screen.getByTestId("get-started-connect-optional")).toHaveAttribute(
      "href",
      "/integrations"
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
        async () => new Response(JSON.stringify(completeSetup), { status: 200 })
      )
    );

    render(<GetStarted />);

    expect(
      await screen.findByRole("heading", { name: "Keep proving." })
    ).toBeInTheDocument();
    // UX-W13: calm success when setup complete (not cheese).
    expect(
      screen.getByTestId("get-started-progress-success")
    ).toHaveTextContent(/Setup is in place/u);
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
    expect(
      screen.getByText(/6 of 9 proof-loop milestones/u)
    ).toBeInTheDocument();

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
    expect(screen.getByRole("link", { name: /Act — Now/u })).toHaveAttribute(
      "href",
      "/remediation"
    );
  });

  it("after first Community finding, one Review findings primary and no Connect or Validate twin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              activationState({
                completedMilestones: 6,
                currentStage: "Understand",
                maturity: "Activating",
                nextAction: {
                  href: "/missions",
                  label: "Run Community validation",
                  reason:
                    "Community edition starts live OSS/first-party engines on verified scope."
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

    const primary = await screen.findByTestId("get-started-primary-cta");
    expect(primary).toHaveTextContent(/Review findings/u);
    expect(primary).toHaveAttribute("href", "/findings");
    expect(screen.getAllByTestId("get-started-primary-cta")).toHaveLength(1);
    expect(primary).not.toHaveTextContent(/Run Community validation/i);
    expect(primary).not.toHaveTextContent(/^Validate$/i);
    expect(
      screen.queryByRole("link", { name: /connect a source/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("get-started-connect-optional")
    ).not.toBeInTheDocument();
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

    expect(
      JSON.parse(localStorage.getItem(FIRST_PROOF_RESUME_KEY) ?? "{}")
    ).toEqual(
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
        async () => new Response(JSON.stringify(completeSetup), { status: 200 })
      )
    );

    render(<GetStarted />);

    expect(
      await screen.findByRole("heading", { name: "Keep proving." })
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem(FIRST_PROOF_RESUME_KEY)).toBeNull();
    });
    expect(
      screen.queryByTestId("get-started-resume-cta")
    ).not.toBeInTheDocument();
  });
});

describe("GetStarted SETTLED first-hour copy (PERISCAN-555)", () => {
  beforeEach(() => {
    ensureLocalStorage();
    localStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(activationState()), { status: 200 })
      )
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    ensureLocalStorage();
    localStorage.clear();
  });

  async function renderEmptyTenant() {
    render(<GetStarted userName="Ada Lovelace" />);
    expect(
      await screen.findByRole("heading", {
        name: "Keep proving: authorized local path → Gitleaks-class → Fixed after retest."
      })
    ).toBeInTheDocument();
  }

  it("Community start card names Gitleaks default start, not the 38-engine pack as the door", async () => {
    await renderEmptyTenant();
    const runCard = screen.getAllByTestId("get-started-step-card")[1];
    expect(runCard).toHaveTextContent(/Gitleaks/i);
    expect(runCard).not.toHaveTextContent(/first[- ]hour/i);
    expect(runCard).toHaveTextContent(/default start/i);
    expect(runCard).toHaveTextContent(/secrets/i);
    expect(runCard).toHaveTextContent(/full Community pack/i);
    expect(runCard).not.toHaveTextContent(/default repo pack/i);
    expect(runCard).not.toHaveTextContent(/38/i);
    expect(runCard).not.toHaveTextContent(/Nuclei/i);
    expect(runCard).not.toHaveTextContent(/Prowler/i);
    expect(runCard).not.toHaveTextContent(/kube CIS/i);
    expect(runCard).not.toHaveTextContent(/recon/i);
  });

  it("P2-CTEMCOPY: empty Home headlines one first-hour job, not ASV/CTEM/attack-paths mall", async () => {
    render(<GetStarted userName="Ada Lovelace" />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Keep proving/i);
    expect(heading).toHaveTextContent(/authorized local path/i);
    expect(heading).toHaveTextContent(/Gitleaks-class/i);
    expect(heading).toHaveTextContent(/Fixed after retest/i);
    expect(heading).not.toHaveTextContent(/first hour/i);
    expect(heading).not.toHaveTextContent(/first path/i);
    expect(heading).not.toHaveTextContent(/Automated Security Validation/i);
    expect(heading).not.toHaveTextContent(/CTEM/i);
    expect(heading).not.toHaveTextContent(/attack path/i);

    const hero = heading.closest("section");
    expect(hero).not.toBeNull();
    expect(hero!).not.toHaveTextContent(/AEV\/CTEM proof layer/i);
    expect(hero!).not.toHaveTextContent(
      /Automated Security Validation platform/i
    );
    expect(hero!).not.toHaveTextContent(/we are a CTEM platform/i);
    expect(hero!).not.toHaveTextContent(/33%/);
    expect(hero!).not.toHaveTextContent(/Verify·100|Verify · 100/i);

    expect(screen.getAllByTestId("get-started-primary-cta")).toHaveLength(1);
    expect(screen.getByTestId("get-started-primary-cta")).toHaveTextContent(
      /Authorize scope/i
    );
    expect(
      screen.queryByTestId("get-started-aws-prowler-cta")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Assess connected AWS/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/full cloud BAS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/High-danger/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Connect a source$/i })
    ).not.toBeInTheDocument();

    const details = screen.getByTestId("get-started-full-loop-details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent(/AEV\/CTEM proof layer/i);
    expect(details).toContainElement(
      screen.getByTestId("get-started-aev-bas-boundary")
    );
  });

  it("empty-tenant hero names the authorized local path and does not claim attacker reachability", async () => {
    render(<GetStarted userName="Ada Lovelace" />);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/authorized local path/i);
    const lede = screen.getByText(/this board stays up/i);
    expect(lede).toHaveTextContent(/authorize a local path/i);
    expect(lede).toHaveTextContent(/Gitleaks-class/i);
    expect(lede).not.toHaveTextContent(/^Ada/i);
    expect(lede).not.toHaveTextContent(/attacker can actually reach/i);
    expect(lede).not.toHaveTextContent(/can actually reach/i);
    expect(lede).not.toHaveTextContent(/attack path/i);
  });

  it("keeps qualified BAS/AEV execution below the first-hour fold", async () => {
    render(<GetStarted userName="Ada Lovelace" />);
    await screen.findByRole("heading", { level: 1 });
    const boundary = screen.getByTestId("get-started-aev-bas-boundary");
    expect(screen.getByTestId("get-started-full-loop-details")).toContainElement(
      boundary
    );
    expect(boundary).toHaveTextContent(
      /we prove authorized exposure/i
    );
    expect(boundary).toHaveTextContent(
      /BAS\/AEV scenario execution requires qualified adapters/i
    );
    expect(boundary).toHaveTextContent(/AEV\/CTEM proof layer/i);
    expect(boundary).not.toHaveTextContent(/Full BAS platform/i);
    expect(boundary).not.toHaveTextContent(/automated pentest/i);
    expect(boundary).not.toHaveTextContent(/ransomware emulation/i);
    expect(boundary.closest("section")).toBeNull();
  });

  it("TTV strip is Authorize → Validate and hides AccountCreated 1/9 theater", async () => {
    await renderEmptyTenant();
    const ttv = screen.getByTestId("first-run-ttv-strip");
    expect(ttv).toHaveTextContent(/Authorize → Validate/);
    expect(ttv).not.toHaveTextContent(/Connect → Authorize → Validate/);
    expect(ttv).not.toHaveTextContent(/Default demo path/i);
    expect(ttv).not.toHaveTextContent(/1\/9/);
    expect(ttv).not.toHaveTextContent(/17%/);
    expect(screen.getByTestId("ttv-milestone-prove")).not.toHaveTextContent(
      /1\/9/
    );
  });

  it("offers Assess connected AWS (Prowler) as a second primary when AWS is Connected", async () => {
    vi.spyOn(api, "getCommunityValidationSuite").mockResolvedValue({
      cloudAwsAvailable: true,
      copyleftOptIn: {
        hint: "GPL/LGPL extras stay Engine Lab.",
        licensedToolIds: [],
        modules: []
      },
      deferredModules: [],
      editionId: "community",
      includeExternalPoa: false,
      licenseNote: "Not live Atomic.",
      modules: [],
      runnerAvailable: false,
      scopeType: null,
      startableModuleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"],
      valueLine: "Community edition is the open-core validation pack."
    } satisfies CommunityValidationSuiteResponse);

    await renderEmptyTenant();

    expect(screen.getAllByTestId("get-started-primary-cta")).toHaveLength(1);
    expect(screen.getByTestId("get-started-primary-cta")).toHaveTextContent(
      /Authorize scope/i
    );
    const awsCta = screen.getByTestId("get-started-aws-prowler-cta");
    expect(awsCta).toHaveTextContent("Assess connected AWS (Prowler)");
    expect(awsCta).toHaveAttribute("href", "/missions?moduleIds=prowler.aws_posture");
    expect(awsCta).not.toHaveTextContent(/full cloud BAS/i);
    expect(screen.queryByText(/full cloud BAS/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/High-danger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/33%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/CTEM %/i)).not.toBeInTheDocument();
  });
});

describe("showFirstMeasuredProofPercent", () => {
  it("hides AccountCreated-only progress (empty tenant 17% theater)", () => {
    expect(showFirstMeasuredProofPercent(activationState())).toBe(false);
    expect(showFirstMeasuredProofPercent(null)).toBe(false);
  });

  it("shows percent after completedMilestones > 1", () => {
    expect(
      showFirstMeasuredProofPercent(activationState({ completedMilestones: 2 }))
    ).toBe(true);
  });

  it("shows percent when MeasuredResult is Current or Completed", () => {
    expect(
      showFirstMeasuredProofPercent(
        activationState({
          completedMilestones: 1,
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
              "Current",
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
      )
    ).toBe(true);
  });
});
