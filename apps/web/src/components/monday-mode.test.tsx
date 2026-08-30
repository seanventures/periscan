import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  DashboardCommandCenter,
  MONDAY_MODE_STORAGE_KEY,
  resolveMondayModeDefault
} from "./dashboard-command-center";

const now = "2026-07-14T20:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const pathId = "22222222-2222-4222-8222-222222222222";
const findingId = "33333333-3333-4333-8333-333333333333";
const nodeA = "44444444-4444-4444-8444-444444444444";
const nodeB = "55555555-5555-4555-8555-555555555555";
const evidenceId = "66666666-6666-4666-8666-666666666666";

function stubDashboardApis(maturity: "New" | "Activating" | "Measured" | "Operating" = "Operating") {
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
    profile: { productPersona: "SecurityEngineer" }
  } as never);
  vi.spyOn(api, "getMe").mockResolvedValue({
    user: { name: "Operator", email: "op@example.com" },
    tenant: { name: "Acme" }
  } as never);
}

describe("resolveMondayModeDefault (UX-W17)", () => {
  it("defaults ON for Operating when pref unset", () => {
    expect(resolveMondayModeDefault("Operating", null)).toEqual({
      on: true,
      shouldPersistDefault: true
    });
  });

  it("does not default for New / Activating / Measured / unknown", () => {
    for (const maturity of ["New", "Activating", "Measured", null, undefined] as const) {
      expect(resolveMondayModeDefault(maturity, null)).toEqual({
        on: false,
        shouldPersistDefault: false
      });
    }
  });

  it("honors explicit on and explicit off over maturity", () => {
    expect(resolveMondayModeDefault("Operating", "1").on).toBe(true);
    expect(resolveMondayModeDefault("Operating", "0").on).toBe(false);
    expect(resolveMondayModeDefault("New", "1").on).toBe(true);
    expect(resolveMondayModeDefault("New", "0").on).toBe(false);
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
    expect(screen.getByText("Monday mode")).toBeInTheDocument();
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
    expect(screen.getByText("Monday mode")).toBeInTheDocument();
    expect(screen.getByTestId("monday-mode-focus")).toBeInTheDocument();
    // Needs you feed + Monday focus both surface top path/finding (ICP 5.0 denser)
    expect(screen.getAllByText("Monday top path").length).toBeGreaterThanOrEqual(
      1
    );
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

  it("UX-W17: Measured maturity does not default Monday when pref unset", async () => {
    vi.restoreAllMocks();
    stubDashboardApis("Measured");
    render(<DashboardCommandCenter />);

    await screen.findByText("The proof loop, at a glance");
    expect(localStorage.getItem(MONDAY_MODE_STORAGE_KEY)).toBeNull();
    expect(screen.getByTestId("monday-mode-toggle")).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.queryByTestId("monday-mode-focus")).not.toBeInTheDocument();
  });
});
