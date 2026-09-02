/**
 * UX-W16 / P08: component-level axe WCAG A/AA smoke for key static surfaces.
 * Not a full-page certification — route-level Playwright remains the browser gate.
 * Expanded beyond first-run: findings, executive, mssp, shift empty shells.
 * ICP residual: findings dual-pane mounted shell with aria-keyshortcuts.
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProductActivationState } from "@periscan/shared";

import {
  formatAxeViolations,
  runAxeSmoke
} from "../lib/a11y-smoke";
import { buttonClassName } from "../ui/button";
import { EmptyState } from "../ui/empty-state";
import { NotConfigured } from "../ui/feedback";
import { FindingsWorkbench } from "./findings-workbench";
import { GetStarted } from "./get-started";
import { StatusPanel } from "./status-panel";

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

function emptyActivation(): ProductActivationState {
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
    totalMilestones: 9
  };
}

async function expectNoAxeViolations(container: HTMLElement) {
  const violations = await runAxeSmoke(container);
  expect(violations, formatAxeViolations(violations)).toEqual([]);
}

describe("a11y smoke (axe-core / jsdom)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("GetStarted empty first-run has no WCAG A/AA axe violations (jsdom)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify(emptyActivation()), { status: 200 })
      )
    );

    const { container } = render(<GetStarted userName="Ada Lovelace" />);

    expect(
      await screen.findByRole("heading", {
        name: "Let's prove your first path."
      })
    ).toBeInTheDocument();

    await waitFor(async () => {
      await expectNoAxeViolations(container);
    });
  });

  it("StatusPanel empty state has no WCAG A/AA axe violations (jsdom)", async () => {
    const { container } = render(
      <StatusPanel
        body="No findings appear until a validation run correlates evidence."
        kind="empty"
        title="No findings yet"
        actions={
          <a href="/missions">Run a Validation Snapshot</a>
        }
      />
    );

    expect(
      screen.getByRole("status", { name: "No findings yet" })
    ).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it("Findings-style NotConfigured empty has no WCAG A/AA axe violations (jsdom)", async () => {
    const { container } = render(
      <div>
        <NotConfigured
          title="No findings yet"
          message="Findings appear here once a validation run correlates evidence to an exposure."
          action={{ href: "/missions", label: "Run a Validation Snapshot" }}
        />
        <EmptyState
          title="No findings yet"
          description="Start a Validation Snapshot on authorized scope."
          action={<a href="/missions">Run a Validation Snapshot</a>}
        />
      </div>
    );

    expect(screen.getAllByText("No findings yet").length).toBeGreaterThan(0);
    await expectNoAxeViolations(container);
  });

  it("Findings empty primary+secondary CTA shell has no axe violations (P08)", async () => {
    const { container } = render(
      <div data-testid="findings-empty">
        <h1>Findings</h1>
        <EmptyState
          title="No findings yet"
          description="Findings appear here once a validation run correlates evidence to an exposure."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href="/missions"
                className={buttonClassName({ size: "sm", variant: "primary" })}
              >
                Run a Validation Snapshot
              </a>
              <a
                href="/integrations"
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                Connect a source
              </a>
            </div>
          }
        />
      </div>
    );
    expect(screen.getByRole("heading", { name: "Findings" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Run a Validation Snapshot" })
    ).toHaveClass("focus-visible:ring-2");
    await expectNoAxeViolations(container);
  });

  it("Executive overview empty honesty shell has no axe violations (P08)", async () => {
    const { container } = render(
      <div data-testid="executive-a11y-shell">
        <header>
          <p>Prove · Leadership</p>
          <h1>Executive overview</h1>
          <p>
            Posture at a glance — control effectiveness, validated exposure,
            path risk and remediation velocity.
          </p>
        </header>
        <EmptyState
          title="No executive metrics yet"
          description="Executive trends appear after validation runs produce claim-safe posture signals."
          action={
            <a
              href="/missions"
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              Run a Validation Snapshot
            </a>
          }
        />
      </div>
    );
    expect(
      screen.getByRole("heading", { name: "Executive overview" })
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("MSSP portfolio empty shell has no axe violations (P08)", async () => {
    const { container } = render(
      <div data-testid="mssp-a11y-shell">
        <header>
          <p>Admin · Clients</p>
          <h1>Client portfolio</h1>
          <p>
            Multi-tenant architecture is real. Primary GTM is still one org
            completing Snapshot → fix verified → proof pack.
          </p>
        </header>
        <NotConfigured
          title="No client tenants"
          message="This workspace isn't managing client tenants yet. Create a client when this account is an MSSP parent."
          action={{ href: "/missions", label: "Finish parent proof loop" }}
        />
      </div>
    );
    expect(
      screen.getByRole("heading", { name: "Client portfolio" })
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("Blue shift / continuous health empty shell has no axe violations (P08)", async () => {
    const { container } = render(
      <div data-testid="shift-a11y-shell">
        <h1>Blue shift</h1>
        <StatusPanel
          body="Program health loads after the first Validation Snapshot correlates actionable items."
          kind="empty"
          title="No shift brief yet"
          actions={
            <a
              href="/missions"
              className={buttonClassName({ size: "sm", variant: "primary" })}
            >
              Run a Validation Snapshot
            </a>
          }
        />
      </div>
    );
    expect(screen.getByRole("heading", { name: "Blue shift" })).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "No shift brief yet" })
    ).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("Workbench primary empty CTAs carry focus-visible rings (P08)", async () => {
    const { container } = render(
      <div>
        <a
          href="/findings"
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          Review findings
        </a>
        <a
          href="/attack-paths"
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          Measure path hops
        </a>
        <a
          href="/remediation"
          className={buttonClassName({ size: "sm", variant: "primary" })}
        >
          Open remediations
        </a>
      </div>
    );
    for (const name of [
      "Review findings",
      "Measure path hops",
      "Open remediations"
    ]) {
      const link = screen.getByRole("link", { name });
      expect(link.className).toMatch(/focus-visible:ring-2/);
      expect(link.className).toMatch(/focus-visible:ring-offset-2/);
    }
    await expectNoAxeViolations(container);
  });

  it("Compliance empty shell has no axe violations (ICP residual)", async () => {
    const { container } = render(
      <div
        data-testid="compliance-a11y-shell"
        role="region"
        aria-label="Compliance control trace"
      >
        <header>
          <p>Prove</p>
          <h1>Compliance control trace</h1>
          <p>
            Map measured validation evidence to a control matrix. Exports are
            evidence-support packs — not certification.
          </p>
        </header>
        <NotConfigured
          title="No validation snapshot yet"
          message="Run a Validation Snapshot first. Compliance support is derived only from persisted evidence, never sample claims."
          action={{ href: "/missions", label: "Run a Validation Snapshot" }}
        />
        <p role="status" className="text-sm text-fixed">
          Hand to auditor as measured-control evidence support — not a
          certification or audit opinion.
        </p>
      </div>
    );
    expect(
      screen.getByRole("heading", { name: "Compliance control trace" })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(/Hand to auditor/i);
    await expectNoAxeViolations(container);
  });

  it("Reports empty shell has no axe violations (ICP residual)", async () => {
    const { container } = render(
      <div
        data-testid="reports-a11y-shell"
        role="region"
        aria-label="Reports workbench"
      >
        <header>
          <p>Prove</p>
          <h1>Reports</h1>
          <p>
            Evidence packs from measured validation — Board pack, technical
            review, and auditor assurance.
          </p>
        </header>
        <EmptyState
          title="No evidence packs yet"
          description="Build a board pack or validation report after a Validation Snapshot produces claim-safe evidence."
          action={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a
                href="/missions"
                className={buttonClassName({ size: "sm", variant: "primary" })}
              >
                Run a Validation Snapshot
              </a>
              <a
                href="/compliance"
                className={buttonClassName({
                  size: "sm",
                  variant: "secondary"
                })}
              >
                Open compliance trace
              </a>
            </div>
          }
        />
      </div>
    );
    expect(screen.getByRole("heading", { name: "Reports" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Run a Validation Snapshot" })
    ).toHaveClass("focus-visible:ring-2");
    await expectNoAxeViolations(container);
  });

  it("Findings dual-pane mounted state has no serious axe violations (ICP residual)", async () => {
    const timestamp = "2026-07-14T12:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const userId = "22222222-2222-4222-8222-222222222222";
    const membershipId = "33333333-3333-4333-8333-333333333333";
    const findingId = "44444444-4444-4444-8444-444444444444";
    const evidenceId = "55555555-5555-4555-8555-555555555555";
    const fingerprint =
      "a1b2c3d4e5f6789012345678abcdef0123456789abcdef0123456789abcdef01";
    const user = {
      createdAt: timestamp,
      email: "owner@example.com",
      emailVerifiedAt: timestamp,
      mfaEnabledAt: null,
      name: "Risk Owner",
      status: "Active",
      updatedAt: timestamp,
      userId
    };
    const membership = {
      createdAt: timestamp,
      membershipId,
      role: "Owner",
      tenantId,
      updatedAt: timestamp,
      userId
    };
    const finding = {
      createdAt: timestamp,
      crossLinks: [],
      disposition: null,
      evidenceIds: [evidenceId],
      exploitability: "Validated",
      findingId,
      fingerprint,
      impact: "A public identity path reaches production data.",
      measuredInNetwork: true,
      missingSignalImpact: null,
      nonSnapPack: null,
      occurrenceCount: 1,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      pathProof: {
        blastRadiusSummary: "Production records are reachable.",
        chokePoints: ["Remove the public trust"],
        claimDisplayLabel: "Partially measured hypothesis",
        entryPoint: "Public workload identity",
        fullyMeasured: false,
        intermediateSteps: ["Assume production role"],
        measuredEdgeCount: 1,
        objective: "Production data access",
        objectiveState: "Reached",
        totalEdgeCount: 2
      },
      priorityReason: {
        businessContext: "Production data store.",
        controlEffectiveness: "No compensating control observed.",
        exploitability: "Validated from a runner.",
        pathContext: "One trust hop to the objective.",
        summary: "Validated public path to production data."
      },
      priorityFormula:
        "Priority = clamp(sum of atomic path-risk contributions, 0, 100).",
      priorityScore: 96,
      riskFactors: [],
      relatedAssetIds: [],
      relatedControlIds: [],
      relatedPathIds: [findingId],
      relatedRemediationIds: [],
      remediation: "Remove the public trust and revalidate.",
      rootCauseSummary: "Public workload identity trusts production role.",
      severity: "Critical",
      source: "Attack path validation",
      sourceEntityId: findingId,
      sourceEntityType: "AttackPath",
      sourceMotion: "APT",
      status: "Validated",
      tenantId,
      title: "Public workload identity reaches production",
      updatedAt: timestamp,
      validationState: "Validated"
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const route = String(input).split("?")[0] ?? "";
      const payloads: Record<string, unknown> = {
        "/api/v1/findings": {
          items: [finding],
          page: { hasMore: false, limit: 50, offset: 0 }
        },
        "/api/v1/findings/disposition-feedback": {
          generatedAt: timestamp,
          totalFalsePositive: 0,
          totalSuppressed: 0,
          byReason: [],
          byFingerprint: [],
          bySource: []
        },
        "/api/v1/me": {
          membership,
          tenant: {
            billingAccountId: null,
            createdAt: timestamp,
            dataRegion: "us-east-1",
            name: "Demo Security",
            parentTenantId: null,
            tenantId,
            type: "Organization",
            updatedAt: timestamp
          },
          user
        },
        "/api/v1/tenants/current/members": {
          items: [{ membership, user }]
        }
      };
      if (!(route in payloads)) {
        return {
          json: async () => ({ error: `Unhandled route ${route}` }),
          ok: false,
          status: 404
        };
      }
      return { json: async () => payloads[route], ok: true, status: 200 };
    }) as unknown as typeof fetch;

    vi.stubGlobal("fetch", fetchMock);
    window.history.replaceState(null, "", "/findings");

    const { container } = render(<FindingsWorkbench />);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Expand finding: Public workload identity reaches production"
      })
    );

    const dualPane = await screen.findByTestId("findings-dual-pane");
    expect(dualPane).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowUp ArrowDown Escape"
    );
    expect(screen.getByTestId("findings-detail-pane")).toHaveAttribute(
      "aria-keyshortcuts",
      "ArrowUp ArrowDown Escape"
    );

    await waitFor(async () => {
      await expectNoAxeViolations(container);
    });
  });

});
