import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CTEM_TO_PROOF_LOOP, PROOF_LOOP_TO_CTEM } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { COMMUNITY_HOME_WATCH_DWELL_MS } from "./community-run-progress";
import {
  DashboardCommandCenter,
  FIRST_HOUR_PROOF_CLOCK,
  MONDAY_MODE_STORAGE_KEY,
  resolveFirstHourHomeAction,
  resolveMondayModeDefault,
  resolveProgramStartedHomeCopy
} from "./dashboard-command-center";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push })
}));

const now = "2026-07-14T20:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const pathId = "22222222-2222-4222-8222-222222222222";
const findingId = "33333333-3333-4333-8333-333333333333";
const nodeA = "44444444-4444-4444-8444-444444444444";
const nodeB = "55555555-5555-4555-8555-555555555555";
const evidenceId = "66666666-6666-4666-8666-666666666666";

function stubDashboardApis(
  maturity: "New" | "Activating" | "Measured" | "Operating" = "Operating"
) {
  vi.spyOn(api, "listAttackPaths").mockResolvedValue([
    {
      attackPath: {
        confidence: 0.8,
        createdAt: now,
        entryNodeId: nodeA,
        evidenceBasis: "Heuristic",
        evidenceIds: [evidenceId],
        impactNodeId: nodeB,
        impactScore: 70,
        methodology: "Evidence graph correlation",
        name: "Monday top path",
        nonSnapPack: null,
        pathBreakers: [],
        pathEdges: [
          {
            createdAt: now,
            evidenceBasis: "Heuristic",
            evidenceIds: [],
            pathEdgeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            pathId,
            relationship: "can_reach",
            sequence: 0,
            sourceNodeId: nodeA,
            targetNodeId: nodeB,
            tenantId,
            updatedAt: now
          }
        ],
        pathId,
        pathNodes: [
          {
            createdAt: now,
            entityId: nodeA,
            entityType: "Asset",
            evidenceIds: [evidenceId],
            label: "Entry",
            pathId,
            pathNodeId: nodeA,
            sequence: 0,
            tenantId,
            updatedAt: now
          },
          {
            createdAt: now,
            entityId: nodeB,
            entityType: "Asset",
            evidenceIds: [evidenceId],
            label: "Impact",
            pathId,
            pathNodeId: nodeB,
            sequence: 1,
            tenantId,
            updatedAt: now
          }
        ],
        tenantId,
        updatedAt: now,
        validationState: "Discovered"
      },
      financialExposure: null,
      risk: {
        band: "High",
        factors: [],
        score: 72,
        summary: "High-risk path"
      }
    }
  ] as never);

  vi.spyOn(api, "listFindings").mockResolvedValue([
    {
      findingId,
      title: "Monday top finding",
      validationState: "Missed",
      severity: "High",
      status: "New",
      disposition: null,
      priorityScore: 80,
      evidenceIds: [evidenceId],
      relatedPathIds: [],
      pathProof: null,
      // PERISCAN-568: Home Findings queue calls projectFindingClaimDisplay,
      // which reads finding.source (gitleaks vs path-linked remap).
      source: "Attack path validation",
      sourceEntityType: null,
      updatedAt: now,
      createdAt: now,
      tenantId
    }
  ] as never);

  vi.spyOn(api, "listRemediations").mockResolvedValue([]);
  vi.spyOn(api, "listThreatAlerts").mockResolvedValue([]);
  vi.spyOn(api, "listSnapshots").mockResolvedValue([
    { snapshotId: "snap-1", createdAt: now, updatedAt: now, tenantId }
  ] as never);
  vi.spyOn(api, "getCTEMProgram").mockResolvedValue({
    stages: [],
    topRiskBand: "High"
  } as never);
  vi.spyOn(api, "listSignalTriggerActivity").mockResolvedValue([]);
  vi.spyOn(api, "getProductWorkQueue").mockResolvedValue({
    total: 0,
    items: [],
    feed: []
  } as never);
  vi.spyOn(api, "getProductActivationState").mockResolvedValue({
    maturity,
    completedMilestones: maturity === "Operating" ? 4 : 1,
    totalMilestones: 4,
    milestones: [{ key: "ScopeVerified", state: "Completed" }],
    diagnostics: [],
    nextAction: { href: "/scopes", label: "Authorize scope" },
    profile: { productPersona: "SecurityEngineer" }
  } as never);
  vi.spyOn(api, "getMe").mockResolvedValue({
    user: { name: "Operator", email: "op@example.com" },
    tenant: { name: "Acme" }
  } as never);
}

function stubValidatedCommunityFinding() {
  vi.spyOn(api, "listFindings").mockResolvedValue([
    {
      findingId,
      title: "Secret leaked",
      validationState: "Validated",
      severity: "High",
      status: "Validated",
      disposition: null,
      priorityScore: 80,
      evidenceIds: [evidenceId],
      relatedPathIds: [],
      pathProof: null,
      source: "gitleaks.repo_secrets",
      sourceEntityType: null,
      location: "leaked.js:2",
      ruleId: "slack-bot-token",
      updatedAt: now,
      createdAt: now,
      tenantId
    }
  ] as never);
}

describe("resolveMondayModeDefault (UX-W17)", () => {
  it("defaults ON when programStarted and pref unset", () => {
    expect(resolveMondayModeDefault(true, null)).toEqual({
      on: true,
      shouldPersistDefault: true
    });
  });

  it("does not default when program has not started", () => {
    expect(resolveMondayModeDefault(false, null)).toEqual({
      on: false,
      shouldPersistDefault: false
    });
  });

  it("honors explicit on and explicit off over programStarted", () => {
    expect(resolveMondayModeDefault(true, "1").on).toBe(true);
    expect(resolveMondayModeDefault(true, "0").on).toBe(false);
    expect(resolveMondayModeDefault(false, "1").on).toBe(true);
    expect(resolveMondayModeDefault(false, "0").on).toBe(false);
  });
});

describe("resolveProgramStartedHomeCopy (P3-MONDAY)", () => {
  it("leads with review findings / prove Fixed after VALIDATED evidence", () => {
    expect(
      resolveProgramStartedHomeCopy({
        hasValidatedEvidence: true,
        mondayMode: true
      })
    ).toEqual({
      title: "Keep proving. Review findings. Re-verify until Fixed.",
      description:
        "A measured Community result is on the board. Review findings, re-verify, schedule the next run. Fixed only after a retest."
    });
    expect(
      resolveProgramStartedHomeCopy({
        hasValidatedEvidence: true,
        mondayMode: false
      }).title
    ).toBe("Keep proving. Review findings. Re-verify until Fixed.");
  });

  it("does not headline Monday mode, AEV/CTEM platform, or 5.0 after VALIDATED evidence", () => {
    const copy = resolveProgramStartedHomeCopy({
      hasValidatedEvidence: true,
      mondayMode: true
    });
    expect(copy.title).not.toMatch(/Monday mode/i);
    expect(copy.title).not.toMatch(/Automated Security Validation/i);
    expect(copy.title).not.toMatch(/CTEM|AEV|5\.0/);
    expect(copy.description).not.toMatch(/we are a CTEM platform/i);
    expect(copy.description).not.toMatch(/Connect a source/i);
  });

  it("keeps Monday / proof-loop titles only before VALIDATED evidence", () => {
    expect(
      resolveProgramStartedHomeCopy({
        hasValidatedEvidence: false,
        mondayMode: true
      }).title
    ).toBe("Proof board");
    expect(
      resolveProgramStartedHomeCopy({
        hasValidatedEvidence: false,
        mondayMode: false
      }).title
    ).toBe("The proof loop, at a glance");
  });
});

describe("resolveFirstHourHomeAction", () => {
  it("never sends empty-path Home to Connect a source", () => {
    expect(resolveFirstHourHomeAction(null)).toEqual({
      href: "/scopes",
      label: "Authorize scope"
    });
    expect(
      resolveFirstHourHomeAction({
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
          completedAt: now,
          membershipId: tenantId,
          primaryOutcome: "RunProofLoop",
          productPersona: "SecurityEngineer",
          updatedAt: now
        },
        totalMilestones: 9
      } as never)
    ).toEqual({
      href: "/scopes",
      label: "Authorize scope"
    });
  });
});

describe("Monday mode (UX-W5 / UX-W17)", () => {
  beforeEach(() => {
    localStorage.clear();
    stubDashboardApis("Operating");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("UX-W17: defaults Monday mode ON for Operating when pref unset (persists 1)", async () => {
    render(<DashboardCommandCenter />);

    await waitFor(() => {
      expect(localStorage.getItem(MONDAY_MODE_STORAGE_KEY)).toBe("1");
    });
    expect(screen.getByTestId("monday-mode-toggle")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("monday-mode-focus")).toBeInTheDocument();
    expect(screen.getByText("Proof board")).toBeInTheDocument();
    expect(screen.getByTestId("home-cadence-link")).toHaveAttribute(
      "href",
      "/schedules"
    );
    expect(screen.getByTestId("home-cadence-link")).toHaveTextContent(
      /Keep on a cadence/i
    );
    // ICP-P1-3: collapsed triage uses Show program context affordance
    expect(
      screen.getByRole("button", { name: /Show program context/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard-program-context")
    ).not.toBeInTheDocument();
    // ICP 5.0 residual: top path + top finding always one-click from Needs you
    expect(await screen.findByTestId("needs-you-top-work")).toBeInTheDocument();
    const topPath = screen.getByTestId("needs-you-top-path");
    expect(topPath).toHaveAttribute(
      "href",
      `/attack-paths/${pathId}#weakest-link`
    );
    expect(topPath).toHaveTextContent("Monday top path");
    const topFinding = screen.getByTestId("needs-you-top-finding");
    expect(topFinding).toHaveAttribute("href", "/findings");
    expect(topFinding).toHaveTextContent("Monday top finding");
  });

  it("PERISCAN-490: first-hour Home eyebrow is Proof OS, never Command center", async () => {
    render(<DashboardCommandCenter />);

    await waitFor(() => {
      expect(screen.getByTestId("monday-mode-focus")).toBeInTheDocument();
    });
    // Jobs objection / SETTLED-legal: rename eyebrow only — keep Command Center IA
    expect(screen.queryByText(/Command center/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Proof OS$/i)).toBeInTheDocument();
    expect(screen.queryByText(/^First hour$/i)).not.toBeInTheDocument();
  });

  it("PERISCAN-490: expanded Home chrome eyebrow is Proof OS, never Command center", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "0");
    render(<DashboardCommandCenter />);

    await screen.findByText("The proof loop, at a glance");
    expect(screen.queryByText(/Command center/i)).not.toBeInTheDocument();
    expect(screen.getByText(/^Proof OS$/i)).toBeInTheDocument();
  });

  it("toggles Monday mode; exit persists periscan-monday-mode=0 (not unset)", async () => {
    // Start with explicit off so we exercise toggle without W17 default race.
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "0");
    render(<DashboardCommandCenter />);

    await screen.findByText("The proof loop, at a glance");

    expect(screen.getByTestId("monday-mode-toggle")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(localStorage.getItem(MONDAY_MODE_STORAGE_KEY)).toBe("0");
    expect(
      screen.getByRole("button", { name: /Hide program context/i })
    ).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-program-context")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("monday-mode-toggle"));

    await waitFor(() => {
      expect(localStorage.getItem(MONDAY_MODE_STORAGE_KEY)).toBe("1");
      expect(screen.getByTestId("monday-mode-toggle")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
    });
    expect(screen.getByText("Proof board")).toBeInTheDocument();
    expect(screen.getByTestId("monday-mode-focus")).toBeInTheDocument();
    expect(screen.getByTestId("home-cadence-link")).toHaveAttribute(
      "href",
      "/schedules"
    );
    // Needs you feed + Monday focus both surface top path/finding (ICP 5.0 denser)
    expect(
      screen.getAllByText("Monday top path").length
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText("Monday top finding").length
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("needs-you-top-path")).toBeInTheDocument();
    expect(screen.getByTestId("needs-you-top-finding")).toBeInTheDocument();
    // Collapsed chrome: charts / full path board titles stay out of Monday focus
    expect(
      screen.queryByText("Attack paths by risk band")
    ).not.toBeInTheDocument();
    expect(screen.queryByText("CTEM stage")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("dashboard-program-context")
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("monday-mode-toggle"));
    await waitFor(() => {
      expect(localStorage.getItem(MONDAY_MODE_STORAGE_KEY)).toBe("0");
      expect(screen.getByTestId("monday-mode-toggle")).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });
  });

  it("restores Monday mode from localStorage on mount", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "1");
    render(<DashboardCommandCenter />);

    await waitFor(() => {
      expect(screen.getByTestId("monday-mode-focus")).toBeInTheDocument();
    });
    expect(screen.getByTestId("monday-mode-toggle")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("UX-W17: explicit off (0) is not re-defaulted for Operating", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "0");
    render(<DashboardCommandCenter />);

    await screen.findByText("The proof loop, at a glance");
    expect(localStorage.getItem(MONDAY_MODE_STORAGE_KEY)).toBe("0");
    expect(screen.getByTestId("monday-mode-toggle")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.queryByTestId("monday-mode-focus")).not.toBeInTheDocument();
  });

  it("UX-W17: defaults Monday ON when programStarted even if maturity is Measured", async () => {
    vi.restoreAllMocks();
    stubDashboardApis("Measured");
    render(<DashboardCommandCenter />);

    await waitFor(() => {
      expect(localStorage.getItem(MONDAY_MODE_STORAGE_KEY)).toBe("1");
    });
    expect(screen.getByTestId("monday-mode-toggle")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByTestId("monday-mode-focus")).toBeInTheDocument();
  });

  it("does not persist Monday default while program has not started", async () => {
    vi.restoreAllMocks();
    stubDashboardApis("New");
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([]);
    vi.spyOn(api, "listFindings").mockResolvedValue([]);
    vi.spyOn(api, "listSnapshots").mockResolvedValue([]);
    render(<DashboardCommandCenter />);

    await screen.findByTestId("get-started-primary-cta");
    expect(localStorage.getItem(MONDAY_MODE_STORAGE_KEY)).toBeNull();
    expect(
      screen.queryByRole("link", { name: /^Connect a source$/i })
    ).not.toBeInTheDocument();
  });

  it("P2-CTEMCOPY: empty Home does not headline ASV/CTEM/attack-paths mall", async () => {
    vi.restoreAllMocks();
    stubDashboardApis("New");
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([]);
    vi.spyOn(api, "listFindings").mockResolvedValue([]);
    vi.spyOn(api, "listSnapshots").mockResolvedValue([]);
    vi.spyOn(api, "getProductActivationState").mockResolvedValue({
      maturity: "New",
      completedMilestones: 1,
      totalMilestones: 9,
      milestones: [
        { key: "AccountCreated", state: "Completed" },
        { key: "ScopeVerified", state: "Upcoming" },
        { key: "MeasuredResult", state: "Upcoming" }
      ],
      diagnostics: [],
      nextAction: { href: "/scopes", label: "Authorize scope" },
      profile: { productPersona: "SecurityEngineer" }
    } as never);
    render(<DashboardCommandCenter />);

    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Keep proving/i);
    expect(heading).toHaveTextContent(/authorized local path/i);
    expect(heading).toHaveTextContent(/Gitleaks-class/i);
    expect(heading).toHaveTextContent(/Fixed after retest/i);
    expect(heading).not.toHaveTextContent(/first hour/i);
    expect(heading).not.toHaveTextContent(/Let's prove your first path/i);
    expect(heading).not.toHaveTextContent(/Automated Security Validation/i);
    expect(heading).not.toHaveTextContent(/CTEM/i);
    expect(heading).not.toHaveTextContent(/attack path/i);
    expect(
      screen.queryByText(/we are a CTEM platform/i)
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId("get-started-primary-cta")).toHaveLength(1);
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
    expect(screen.queryByText(/^Proof OS$/i)).not.toBeInTheDocument();
  });

  it("does not send first-hour operators to Connect a source on empty paths", async () => {
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([]);
    render(<DashboardCommandCenter />);
    const empty = await screen.findByTestId("dashboard-paths-empty");
    expect(
      screen.queryByRole("link", { name: /connect a source/i })
    ).not.toBeInTheDocument();
    expect(empty).toHaveTextContent(/Community findings still count/i);
    const primary = await screen.findByTestId("dashboard-primary-cta");
    expect(within(primary).getByRole("link")).toHaveTextContent(
      /review findings/i
    );
  });

  it("does not invent Validated or a CTEM percent while first-hour lists load", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "1");
    vi.spyOn(api, "listFindings").mockReturnValue(new Promise(() => undefined));
    vi.spyOn(api, "listAttackPaths").mockReturnValue(
      new Promise(() => undefined)
    );

    render(<DashboardCommandCenter />);

    await waitFor(() => {
      expect(
        screen.queryByRole("link", { name: /connect a source/i })
      ).not.toBeInTheDocument();
    });
    expect(screen.queryByText(/^Validated$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/33%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Command center/i)).not.toBeInTheDocument();
  });

  it("does not send first-hour operators to Connect a source on empty paths when Monday is off", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "0");
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([]);
    render(<DashboardCommandCenter />);
    const empty = await screen.findByTestId("dashboard-paths-empty");
    expect(
      screen.queryByRole("link", { name: /connect a source/i })
    ).not.toBeInTheDocument();
    expect(
      within(empty).queryByRole("link", {
        name: /authorize scope|run community|connect a source/i
      })
    ).not.toBeInTheDocument();
    expect(empty).toHaveTextContent(/Community findings still count/i);
    const primary = await screen.findByTestId("dashboard-primary-cta");
    expect(within(primary).getByRole("link")).toHaveTextContent(
      /review findings/i
    );
  });
});

describe("Monday/Home after first Community finding (PERISCAN-490)", () => {
  beforeEach(() => {
    localStorage.clear();
    stubDashboardApis("Measured");
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("has one Review findings primary and no Connect, Command center, or Validate twin", async () => {
    render(<DashboardCommandCenter />);

    const primary = await screen.findByTestId("dashboard-primary-cta");
    expect(
      screen.queryByTestId("get-started-primary-cta")
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId("dashboard-primary-cta")).toHaveLength(1);
    const cta = within(primary).getByRole("link");
    expect(cta).toHaveTextContent(/^Review findings$/i);
    expect(cta).toHaveAttribute("href", "/findings");
    expect(cta.className).toMatch(/bg-brand-fill/);

    expect(
      screen.queryByRole("link", { name: /connect a source/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/command center/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^validate$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /run community validation/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /run a snapshot/i })
    ).not.toBeInTheDocument();
  });

  it("switches the one primary to Verify when Open remediations exist", async () => {
    vi.spyOn(api, "listRemediations").mockResolvedValue([
      { status: "Open" }
    ] as never);

    render(<DashboardCommandCenter />);

    const primary = await screen.findByTestId("dashboard-primary-cta");
    const cta = within(primary).getByRole("link");
    expect(cta).toHaveTextContent(/^Verify$/);
    expect(cta).toHaveAttribute("href", "/remediation");
    expect(screen.getAllByTestId("dashboard-primary-cta")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /^Review findings$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /connect a source/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/command center/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /run community validation/i })
    ).not.toBeInTheDocument();
  });

  it("keeps one Review findings primary when Monday is off", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "0");
    render(<DashboardCommandCenter />);

    const primary = await screen.findByTestId("dashboard-primary-cta");
    expect(within(primary).getByRole("link")).toHaveTextContent(
      /^Review findings$/i
    );
    expect(within(primary).getByRole("link")).toHaveAttribute(
      "href",
      "/findings"
    );
    expect(screen.getAllByTestId("dashboard-primary-cta")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /connect a source/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/command center/i)).not.toBeInTheDocument();
  });

  it("P3-MONDAY: after VALIDATED Community evidence H1 is review findings / prove Fixed, not platform mall", async () => {
    stubValidatedCommunityFinding();
    render(<DashboardCommandCenter />);

    const primary = await screen.findByTestId("dashboard-primary-cta");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/review findings/i);
    expect(heading).toHaveTextContent(/Re-verify until Fixed/i);
    expect(heading).not.toHaveTextContent(/Monday mode/i);
    expect(heading).not.toHaveTextContent(/The proof loop, at a glance/i);
    expect(heading).not.toHaveTextContent(/authorized local path/i);
    expect(heading).not.toHaveTextContent(/Automated Security Validation/i);
    expect(heading).not.toHaveTextContent(/CTEM/i);
    expect(heading).not.toHaveTextContent(/AEV/i);
    expect(heading).not.toHaveTextContent(/5\.0/);
    expect(
      screen.queryByText(/we are a CTEM platform/i)
    ).not.toBeInTheDocument();
    expect(screen.getByText(/^Proof OS$/i)).toBeInTheDocument();

    expect(screen.getAllByTestId("dashboard-primary-cta")).toHaveLength(1);
    expect(within(primary).getByRole("link")).toHaveTextContent(
      /^Review findings$/i
    );
    expect(within(primary).getByRole("link")).toHaveAttribute(
      "href",
      "/findings"
    );
    expect(
      screen.queryByRole("link", { name: /^Connect a source$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^validate$/i })
    ).not.toBeInTheDocument();
  });

  it("P3-MONDAY: expanded Home after VALIDATED evidence still leads with the first-hour job", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "0");
    stubValidatedCommunityFinding();
    render(<DashboardCommandCenter />);

    await screen.findByTestId("dashboard-primary-cta");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/review findings/i);
    expect(heading).toHaveTextContent(/Re-verify until Fixed/i);
    expect(heading).not.toHaveTextContent(/The proof loop, at a glance/i);
    expect(heading).not.toHaveTextContent(/Monday mode/i);
    expect(heading).not.toHaveTextContent(/authorized local path/i);
    expect(screen.getAllByTestId("dashboard-primary-cta")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /^Connect a source$/i })
    ).not.toBeInTheDocument();
  });

  it("P3-HOMEMISSION: after Community evidence Review findings includes missionId", async () => {
    const missionId = "13d9422a-3dc2-4e82-8a29-a7d2527e764f";
    stubValidatedCommunityFinding();
    vi.spyOn(api, "listSnapshots").mockResolvedValue([
      {
        snapshotId: "snap-1",
        createdAt: now,
        updatedAt: now,
        tenantId,
        missionId
      }
    ] as never);
    vi.spyOn(api, "getProductActivationState").mockResolvedValue({
      maturity: "Measured",
      completedMilestones: 1,
      totalMilestones: 4,
      milestones: [
        { key: "ScopeVerified", state: "Completed" },
        {
          href: `/missions/${missionId}`,
          key: "MeasuredResult",
          state: "Completed"
        }
      ],
      diagnostics: [],
      nextAction: { href: "/scopes", label: "Authorize scope" },
      profile: { productPersona: "SecurityEngineer" }
    } as never);

    render(<DashboardCommandCenter />);

    const primary = await screen.findByTestId("dashboard-primary-cta");
    const cta = within(primary).getByRole("link");
    expect(cta).toHaveTextContent(/^Review findings$/i);
    expect(cta).toHaveAttribute("href", `/findings?missionId=${missionId}`);
    expect(screen.getAllByTestId("dashboard-primary-cta")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /^Connect a source$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^validate$/i })
    ).not.toBeInTheDocument();
  });

  it("P3-MONDAY: H1 stays prove Fixed when the one primary is Verify", async () => {
    stubValidatedCommunityFinding();
    vi.spyOn(api, "listRemediations").mockResolvedValue([
      { status: "Open" }
    ] as never);
    render(<DashboardCommandCenter />);

    const primary = await screen.findByTestId("dashboard-primary-cta");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/review findings/i);
    expect(heading).toHaveTextContent(/Re-verify until Fixed/i);
    expect(heading).not.toHaveTextContent(/Monday mode/i);
    expect(within(primary).getByRole("link")).toHaveTextContent(/^Verify$/);
    expect(screen.getAllByTestId("dashboard-primary-cta")).toHaveLength(1);
    expect(
      screen.queryByRole("link", { name: /^Review findings$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /^Connect a source$/i })
    ).not.toBeInTheDocument();
  });
});

describe("Proof clock CTEM secondary aliases (PERISCAN-490)", () => {
  beforeEach(() => {
    localStorage.clear();
    stubDashboardApis("Operating");
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("maps first-hour primary verbs through ontology CTEM aliases", () => {
    expect(FIRST_HOUR_PROOF_CLOCK.map((step) => step.primary)).toEqual([
      "Authorize",
      "Run",
      "Review",
      "Verify"
    ]);
    for (const step of FIRST_HOUR_PROOF_CLOCK) {
      expect(PROOF_LOOP_TO_CTEM[step.proofStage]).toBe(step.ctemAlias);
      expect(CTEM_TO_PROOF_LOOP[step.ctemAlias]).toContain(step.proofStage);
    }
    // Never put Connect / Discover on the first-hour clock.
    expect(FIRST_HOUR_PROOF_CLOCK.map((step) => step.primary)).not.toContain(
      "Connect"
    );
    expect(FIRST_HOUR_PROOF_CLOCK.map((step) => step.proofStage)).not.toContain(
      "Connect"
    );
    expect(FIRST_HOUR_PROOF_CLOCK.map((step) => step.ctemAlias)).not.toContain(
      "Discover"
    );
  });

  it("shows CTEM aliases as secondary labels on Monday proof clock after programStarted", async () => {
    render(<DashboardCommandCenter />);

    const clock = await screen.findByTestId("proof-clock");
    expect(clock).toBeInTheDocument();
    // Nested under Monday focus — not a Command Center IA rewrite.
    expect(screen.getByTestId("monday-mode-focus")).toContainElement(clock);

    for (const step of FIRST_HOUR_PROOF_CLOCK) {
      const chip = within(clock).getByTestId(
        `proof-clock-step-${step.primary.toLowerCase()}`
      );
      expect(within(chip).getByTestId("proof-clock-primary")).toHaveTextContent(
        step.primary
      );
      expect(
        within(chip).getByTestId("proof-clock-ctem-alias")
      ).toHaveTextContent(step.ctemAlias);
    }

    expect(within(clock).queryByText(/^Connect$/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/we are a CTEM platform/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /connect a source/i })
    ).not.toBeInTheDocument();
  });

  it("hides the proof clock when Monday mode is off (no Command Center rewrite)", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "0");
    render(<DashboardCommandCenter />);

    await screen.findByText("The proof loop, at a glance");
    expect(screen.queryByTestId("proof-clock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("monday-mode-focus")).not.toBeInTheDocument();
  });
});

describe("Home path certainty from weakest hop (PERISCAN-490)", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Monday top finding remaps path-linked Validated without hop receipts to Discovered", async () => {
    localStorage.clear();
    stubDashboardApis("Operating");
    vi.spyOn(api, "listFindings").mockResolvedValue([
      {
        findingId,
        title: "Critical path finding without hops",
        validationState: "Validated",
        severity: "Critical",
        status: "Validated",
        disposition: null,
        priorityScore: 95,
        evidenceIds: [evidenceId],
        relatedPathIds: [pathId],
        pathProof: null,
        source: "Attack path validation",
        sourceEntityType: "AttackPath",
        updatedAt: now,
        createdAt: now,
        tenantId
      }
    ] as never);

    render(<DashboardCommandCenter />);

    const focus = await screen.findByTestId("monday-mode-focus");
    const claimSafe = within(focus).getByTestId(
      "dashboard-top-finding-claim-safe"
    );
    expect(claimSafe).toHaveTextContent("Discovered");
    expect(claimSafe).not.toHaveTextContent("Validated");
    expect(focus.textContent).not.toMatch(/Validated high-impact path/i);
  });

  it("expanded Home path snippet never says Validated from Critical heuristic severity", async () => {
    localStorage.setItem(MONDAY_MODE_STORAGE_KEY, "0");
    stubDashboardApis("Operating");
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([
      {
        attackPath: {
          confidence: 0.95,
          createdAt: now,
          entryNodeId: nodeA,
          evidenceBasis: "Heuristic",
          evidenceIds: [evidenceId],
          impactNodeId: nodeB,
          impactScore: 99,
          methodology: "Evidence graph correlation",
          name: "Critical heuristic path",
          nonSnapPack: null,
          pathBreakers: [],
          pathEdges: [
            {
              createdAt: now,
              evidenceBasis: "Heuristic",
              evidenceIds: [],
              pathEdgeId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
              pathId,
              relationship: "can_reach",
              sequence: 0,
              sourceNodeId: nodeA,
              targetNodeId: nodeB,
              tenantId,
              updatedAt: now
            }
          ],
          pathId,
          pathNodes: [
            {
              createdAt: now,
              entityId: nodeA,
              entityType: "Asset",
              evidenceIds: [evidenceId],
              label: "Entry",
              pathId,
              pathNodeId: nodeA,
              sequence: 0,
              tenantId,
              updatedAt: now
            },
            {
              createdAt: now,
              entityId: nodeB,
              entityType: "Asset",
              evidenceIds: [evidenceId],
              label: "Impact",
              pathId,
              pathNodeId: nodeB,
              sequence: 1,
              tenantId,
              updatedAt: now
            }
          ],
          tenantId,
          updatedAt: now,
          validationState: "Validated"
        },
        financialExposure: null,
        risk: {
          band: "Critical",
          factors: [],
          score: 95,
          summary:
            "Critical-risk heuristic path hypothesis requires measurement before any reachable or validated-path claim."
        }
      }
    ] as never);
    vi.spyOn(api, "listFindings").mockResolvedValue([
      {
        findingId,
        title: "Critical path finding without hops",
        validationState: "Validated",
        severity: "Critical",
        status: "Validated",
        disposition: null,
        priorityScore: 95,
        evidenceIds: [evidenceId],
        relatedPathIds: [pathId],
        pathProof: null,
        source: "Attack path validation",
        sourceEntityType: "AttackPath",
        updatedAt: now,
        createdAt: now,
        tenantId
      }
    ] as never);

    render(<DashboardCommandCenter />);

    const snippet = await screen.findByTestId(
      "dashboard-top-path-claim-snippet"
    );
    expect(snippet).toHaveTextContent(/Heuristic hypothesis/i);
    expect(snippet.textContent).not.toMatch(/\bValidated\b/i);
    expect(
      screen.queryByText(/Validated high-impact path/i)
    ).not.toBeInTheDocument();

    const findingState = screen.getByTestId("dashboard-finding-claim-safe");
    expect(findingState).toHaveTextContent("Discovered");
    expect(findingState).not.toHaveTextContent("Validated");
  });
});

describe("P2-WATCH Home dwell after jobsQueued=1 evidence", () => {
  const dwellNow = "2026-09-17T20:50:00.000Z";
  const dwellNowMs = Date.parse(dwellNow);

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    push.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(dwellNowMs);
    stubDashboardApis("Measured");
    vi.spyOn(api, "listAttackPaths").mockResolvedValue([]);
    vi.spyOn(api, "listFindings").mockResolvedValue([
      {
        findingId,
        title: "Secret leaked",
        validationState: "Validated",
        severity: "High",
        status: "Validated",
        disposition: null,
        priorityScore: 80,
        evidenceIds: [evidenceId],
        relatedPathIds: [],
        pathProof: null,
        source: "gitleaks.repo_secrets",
        sourceEntityType: null,
        location: "leaked.js:2",
        ruleId: "slack-bot-token",
        updatedAt: dwellNow,
        createdAt: dwellNow,
        tenantId
      }
    ] as never);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows VALIDATED path·rule for ≥1s before any auto-nav", async () => {
    render(<DashboardCommandCenter />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const dwell = screen.getByTestId("home-watch-dwell");
    expect(within(dwell).getByTestId("community-run-watch")).toHaveTextContent(
      /^Watch$/
    );
    expect(within(dwell).getByTestId("home-watch-finding")).toHaveTextContent(
      "leaked.js:2 · slack-bot-token"
    );
    expect(dwell).toHaveTextContent(/Validated/i);
    expect(dwell).not.toHaveTextContent("%");
    expect(dwell).not.toHaveTextContent(/percent complete/i);
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(999);
      await Promise.resolve();
    });

    expect(screen.getByTestId("home-watch-dwell")).toBeInTheDocument();
    expect(screen.getByTestId("home-watch-finding")).toHaveTextContent(
      "leaked.js:2 · slack-bot-token"
    );
    expect(push).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(COMMUNITY_HOME_WATCH_DWELL_MS);
      await Promise.resolve();
    });

    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("leaked.js:2 · slack-bot-token").length
    ).toBeGreaterThan(0);
  });

  it("does not replay the 1.5s Watch beat on Home remount of the same finding", async () => {
    const first = render(<DashboardCommandCenter />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("home-watch-dwell")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(screen.getByTestId("home-watch-dwell")).toBeInTheDocument();

    first.unmount();

    render(<DashboardCommandCenter />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("home-watch-dwell")).toBeInTheDocument();
    expect(screen.getByTestId("home-watch-finding")).toHaveTextContent(
      "leaked.js:2 · slack-bot-token"
    );

    await act(async () => {
      vi.advanceTimersByTime(COMMUNITY_HOME_WATCH_DWELL_MS - 500);
      await Promise.resolve();
    });
    expect(screen.queryByTestId("home-watch-dwell")).not.toBeInTheDocument();

    cleanup();
    render(<DashboardCommandCenter />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTestId("home-watch-dwell")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("leaked.js:2 · slack-bot-token").length
    ).toBeGreaterThan(0);
  });

  it("keeps Watch + VALIDATED path·rule for ≥1s when the walker navigates immediately after evidence", async () => {
    const first = render(<DashboardCommandCenter />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const dwell = screen.getByTestId("home-watch-dwell");
    expect(within(dwell).getByTestId("community-run-watch")).toHaveTextContent(
      /^Watch$/
    );
    expect(within(dwell).getByTestId("home-watch-finding")).toHaveTextContent(
      "leaked.js:2 · slack-bot-token"
    );
    expect(dwell).toHaveTextContent(/Validated/i);
    expect(dwell).not.toHaveTextContent("%");
    expect(screen.queryByText(/High-danger/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/T1486/)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    first.unmount();

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await Promise.resolve();
    });

    render(<DashboardCommandCenter />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByTestId("home-watch-dwell")).toBeInTheDocument();
    expect(screen.getByTestId("community-run-watch")).toHaveTextContent(
      /^Watch$/
    );
    expect(screen.getByTestId("home-watch-finding")).toHaveTextContent(
      "leaked.js:2 · slack-bot-token"
    );
    expect(screen.getByTestId("home-watch-dwell")).toHaveTextContent(
      /Validated/i
    );
    expect(screen.queryByText(/High-danger/i)).not.toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(999);
      await Promise.resolve();
    });

    expect(screen.getByTestId("home-watch-dwell")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
