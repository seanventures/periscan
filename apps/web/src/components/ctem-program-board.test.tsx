/** @vitest-environment jsdom */
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CTEMProgramSummary } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import {
  CTEM_FIRST_MEASURE_NOT_BOARD,
  CTEM_NOT_MEASURED_YET,
  CTEM_RUN_IN_FLIGHT
} from "../lib/ctem-board-honesty";
import { PRIMARY_NAV } from "../lib/primary-nav";
import { CtemProgramBoard } from "./ctem-program-board";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

const tenantId = "11111111-1111-4111-8111-111111111111";
const generatedAt = "2026-07-14T12:00:00.000Z";

const STAGES = [
  "Scope",
  "Discover",
  "Prioritize",
  "Validate",
  "Mobilize",
  "Verify"
] as const;

const STAGE_HREFS = {
  Scope: "/scopes",
  Discover: "/missions",
  Prioritize: "/findings",
  Validate: "/missions",
  Mobilize: "/remediation",
  Verify: "/remediation"
} as const;

function stageSummary(
  stage: (typeof STAGES)[number],
  overrides: Partial<CTEMProgramSummary["stages"][number]> = {}
): CTEMProgramSummary["stages"][number] {
  return {
    stage,
    status: "NotStarted",
    evidenceCount: 0,
    openItemCount: 0,
    trend: "Stable",
    ...overrides
  };
}

function program(
  overrides: Partial<CTEMProgramSummary> = {}
): CTEMProgramSummary {
  return {
    tenantId,
    generatedAt,
    source: "LiveTenantStateBaseline",
    snapshotId: null,
    topRiskBand: "High",
    stages: STAGES.map((stage) => stageSummary(stage)),
    ...overrides
  };
}

function activation(overrides: Record<string, unknown> = {}) {
  return {
    profile: "SecurityLeader",
    maturity: "Measured",
    currentStage: "Validate",
    completedMilestones: 6,
    totalMilestones: 9,
    milestones: [],
    diagnostics: [],
    nextAction: {
      label: "Continue proof loop",
      href: "/findings",
      reason: "MeasuredResult complete"
    },
    measuredAt: generatedAt,
    ...overrides
  };
}

describe("CtemProgramBoard", () => {
  beforeEach(() => {
    vi.spyOn(api, "getCTEMProgram").mockResolvedValue(program());
    vi.spyOn(api, "getProductActivationState").mockResolvedValue(
      activation({ maturity: "New" }) as never
    );
    vi.spyOn(api, "listFindings").mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the six live CTEM stages as links into real work surfaces", async () => {
    vi.mocked(api.getCTEMProgram).mockResolvedValue(
      program({
        stages: [
          stageSummary("Scope", { status: "OnTrack", evidenceCount: 2 }),
          stageSummary("Discover", { status: "OnTrack", evidenceCount: 1 }),
          stageSummary("Prioritize", {
            status: "NeedsAttention",
            openItemCount: 3,
            evidenceCount: 1
          }),
          stageSummary("Validate", { status: "NotStarted" }),
          stageSummary("Mobilize", { status: "NotStarted" }),
          stageSummary("Verify", { status: "NotStarted" })
        ]
      })
    );

    render(<CtemProgramBoard />);

    await waitFor(() => {
      expect(api.getCTEMProgram).toHaveBeenCalled();
    });

    const board = await screen.findByTestId("ctem-program-board");
    expect(board).toBeInTheDocument();

    for (const stage of STAGES) {
      const link = screen.getByTestId(`ctem-stage-${stage}`);
      expect(link).toHaveAttribute("href", STAGE_HREFS[stage]);
      expect(link).toHaveTextContent(stage);
    }

    expect(screen.getByTestId("ctem-stage-Verify")).toHaveTextContent(
      /Fixed only via retest/i
    );
  });

  it("shows loading, then an empty not-measured program without a fake percent", async () => {
    let resolveProgram: (value: CTEMProgramSummary) => void = () => undefined;
    vi.mocked(api.getCTEMProgram).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProgram = resolve;
        })
    );

    render(<CtemProgramBoard />);

    expect(screen.getByTestId("loading-skeleton")).toBeInTheDocument();

    resolveProgram(program());

    expect(await screen.findByText(CTEM_NOT_MEASURED_YET)).toBeInTheDocument();
    expect(screen.queryByTestId("loading-skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("ctem-program-board")).not.toHaveTextContent(
      /\d+%/
    );
    expect(screen.getByTestId("ctem-program-board")).not.toHaveTextContent(
      /17%|33%/
    );
  });

  it("surfaces a retryable error when GET /ctem/program fails", async () => {
    vi.mocked(api.getCTEMProgram)
      .mockRejectedValueOnce(new Error("Unable to read CTEM program"))
      .mockResolvedValueOnce(program());

    render(<CtemProgramBoard />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Unable to read CTEM program/
    );

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(await screen.findByTestId("ctem-program-board")).toBeInTheDocument();
    expect(api.getCTEMProgram).toHaveBeenCalledTimes(2);
  });

  it("does not stamp a board percent while a Community run is in flight", async () => {
    vi.mocked(api.getProductActivationState).mockResolvedValue(
      activation({
        maturity: "Activating",
        nextAction: {
          label: "Watch first Community run",
          href: "/missions",
          reason: "Run in flight"
        }
      }) as never
    );
    vi.mocked(api.listFindings).mockResolvedValue([{}] as never);
    vi.mocked(api.getCTEMProgram).mockResolvedValue(
      program({
        stages: STAGES.map((stage) =>
          stageSummary(stage, {
            status: stage === "Verify" ? "OnTrack" : "NotStarted",
            openItemCount: 0
          })
        )
      })
    );

    render(<CtemProgramBoard />);

    expect(await screen.findByText(CTEM_RUN_IN_FLIGHT)).toBeInTheDocument();
    expect(screen.getByTestId("ctem-program-board")).not.toHaveTextContent(
      /\d+%/
    );
    expect(screen.getAllByText("in flight").length).toBeGreaterThan(0);
  });

  it("does not treat first measured Gitleaks as a CTEM score", async () => {
    vi.mocked(api.getProductActivationState).mockResolvedValue(
      activation({
        maturity: "Measured",
        nextAction: {
          label: "Route the smallest fix",
          href: "/remediation",
          reason: "MeasuredResult complete"
        },
        milestones: [
          {
            key: "MeasuredResult",
            state: "Completed"
          }
        ]
      }) as never
    );
    vi.mocked(api.listFindings).mockResolvedValue([{}, {}] as never);
    vi.mocked(api.getCTEMProgram).mockResolvedValue(
      program({
        stages: STAGES.map((stage) =>
          stageSummary(stage, {
            status: stage === "Verify" ? "OnTrack" : "OnTrack",
            openItemCount: 0,
            evidenceCount: 1
          })
        )
      })
    );

    render(<CtemProgramBoard />);

    expect(
      await screen.findByText(CTEM_FIRST_MEASURE_NOT_BOARD)
    ).toBeInTheDocument();
    expect(screen.getByTestId("ctem-program-board")).not.toHaveTextContent(
      /33%/
    );
    expect(screen.getAllByText("first measure").length).toBeGreaterThan(0);
  });

  it("shows earned occupancy once revalidation has actually happened", async () => {
    vi.mocked(api.getProductActivationState).mockResolvedValue(
      activation({
        maturity: "Measured",
        milestones: [{ key: "Revalidated", state: "Completed" }]
      }) as never
    );
    vi.mocked(api.listFindings).mockResolvedValue([{}, {}, {}] as never);
    vi.mocked(api.getCTEMProgram).mockResolvedValue(
      program({
        source: "Snapshot",
        snapshotId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        stages: [
          stageSummary("Scope", { status: "OnTrack", evidenceCount: 4 }),
          stageSummary("Discover", { status: "OnTrack", evidenceCount: 3 }),
          stageSummary("Prioritize", {
            status: "NeedsAttention",
            openItemCount: 2,
            evidenceCount: 3
          }),
          stageSummary("Validate", { status: "OnTrack", evidenceCount: 2 }),
          stageSummary("Mobilize", {
            status: "NeedsAttention",
            openItemCount: 1,
            evidenceCount: 1
          }),
          stageSummary("Verify", { status: "OnTrack", evidenceCount: 1 })
        ]
      })
    );

    render(<CtemProgramBoard />);

    const board = await screen.findByTestId("ctem-program-board");
    expect(board).not.toHaveTextContent(CTEM_NOT_MEASURED_YET);
    expect(board).not.toHaveTextContent(CTEM_FIRST_MEASURE_NOT_BOARD);
    expect(screen.getByText("2 open")).toBeInTheDocument();
    expect(screen.getByText("1 open")).toBeInTheDocument();
    expect(screen.getAllByText("clear").length).toBeGreaterThan(0);
    expect(board).toHaveTextContent(/Snapshot-derived/i);
  });

  it("states AEV/CTEM proof-layer honesty and live tenant provenance", async () => {
    render(<CtemProgramBoard />);

    const board = await screen.findByTestId("ctem-program-board");
    expect(board).toHaveTextContent(
      /AEV \/ CTEM proof layer on authorized scope/i
    );
    expect(board).toHaveTextContent(/not Gartner CTEM/i);
    expect(board).toHaveTextContent(/not live BAS/i);
    expect(board).toHaveTextContent(/not a Wiz replacement/i);
    expect(board).toHaveTextContent(/Live tenant-state baseline/i);
    expect(board).not.toHaveTextContent(/sample fixture/i);
    expect(board).not.toHaveTextContent(/5\.0/);
  });
});

describe("CTEM nav placement", () => {
  it("indexes CTEM on Setup next to Executive, never as first-hour Home", () => {
    const operate = PRIMARY_NAV.find((group) => group.label === "Operate")!;
    const setup = PRIMARY_NAV.find((group) => group.label === "Setup")!;

    expect(operate.items[0]).toEqual(
      expect.objectContaining({ href: "/dashboard", label: "Home" })
    );
    expect(operate.items.map((item) => item.href)).not.toContain("/ctem");

    const ctem = setup.items.find((item) => item.href === "/ctem");
    expect(ctem?.label).toBe("CTEM");
    const executiveIndex = setup.items.findIndex(
      (item) => item.href === "/executive"
    );
    const ctemIndex = setup.items.findIndex((item) => item.href === "/ctem");
    expect(executiveIndex).toBeGreaterThanOrEqual(0);
    expect(ctemIndex).toBe(executiveIndex + 1);
  });

  it("mounts the live board from /ctem and keeps CTEM off the Operating default rail", () => {
    const page = readFileSync(
      path.join(__dirname, "../../app/ctem/page.tsx"),
      "utf8"
    );
    expect(page).toMatch(/CtemProgramBoard/);
    expect(page).not.toMatch(/redirect\(/);

    const shell = readFileSync(path.join(__dirname, "app-shell.tsx"), "utf8");
    const operatingBody =
      shell.match(
        /const OPERATING_DEFAULT_NAV = new Set\(\[([\s\S]*?)\]\);/
      )?.[1] ?? "";
    const newTenantBody =
      shell.match(/const NEW_TENANT_NAV = new Set\(\[([\s\S]*?)\]\);/)?.[1] ??
      "";
    expect(operatingBody).not.toMatch(/"\/ctem"/);
    expect(newTenantBody).not.toMatch(/"\/ctem"/);
    expect(shell).toMatch(/OPERATING_SETUP_HIDDEN[\s\S]*"\/ctem"/);
  });
});
