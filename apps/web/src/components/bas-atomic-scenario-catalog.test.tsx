import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  BasAtomicScenarioCatalogItem,
  BasAtomicScenarioRunResult
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { BasAtomicScenarioCatalog } from "./bas-atomic-scenario-catalog";

const scenarios: BasAtomicScenarioCatalogItem[] = [
  {
    description: "Allowlisted Atomic dry-run catalog entry for T1595.",
    executionMode: "dry-run",
    liveExecutionDisabled: true,
    liveExecutionLabel: "live execution disabled",
    moduleId: "atomic.control_validation_safe",
    name: "Active Discovery Safety Simulation",
    scenarioId: "atomic.T1595",
    source: "atomic-red-team",
    spdxLicenseId: "MIT",
    tactic: "Discovery",
    techniqueId: "T1595"
  },
  {
    description: "Allowlisted Atomic dry-run catalog entry for T1087.",
    executionMode: "dry-run",
    liveExecutionDisabled: true,
    liveExecutionLabel: "live execution disabled",
    moduleId: "atomic.control_validation_safe",
    name: "Account Discovery Dry Run",
    scenarioId: "atomic.T1087",
    source: "atomic-red-team",
    spdxLicenseId: "MIT",
    tactic: "Discovery",
    techniqueId: "T1087"
  }
];

const liveDenied: BasAtomicScenarioRunResult = {
  allowed: false,
  code: "atomic_live_disabled",
  executionMode: "live",
  jobsQueued: 0,
  liveExecutionDisabled: true,
  rationale:
    "atomic.control_validation_safe supports dry-run content import only; Atomic live execution is disabled in the current Periscan release.",
  scenarioId: "atomic.T1595",
  techniqueId: "T1595"
};

describe("BasAtomicScenarioCatalog", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders YAML catalog rows with dry-run, SPDX MIT, and live execution disabled", async () => {
    vi.spyOn(api, "listBasAtomicScenarios").mockResolvedValue(scenarios);

    render(<BasAtomicScenarioCatalog />);

    expect(
      await screen.findByRole("heading", { name: "Atomic scenario catalog" })
    ).toBeInTheDocument();
    expect(screen.getByText("T1595")).toBeInTheDocument();
    expect(
      screen.getByText("Active Discovery Safety Simulation")
    ).toBeInTheDocument();
    expect(screen.getByText("T1087")).toBeInTheDocument();
    expect(screen.getAllByText("dry-run").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("SPDX MIT").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getAllByText("live execution disabled").length
    ).toBeGreaterThanOrEqual(2);
  });

  it("sends Run through policy and stays denied for live (atomic_live_disabled)", async () => {
    vi.spyOn(api, "listBasAtomicScenarios").mockResolvedValue(scenarios);
    const run = vi
      .spyOn(api, "runBasAtomicScenario")
      .mockResolvedValue(liveDenied);

    render(<BasAtomicScenarioCatalog />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Run T1595" })
    );

    await waitFor(() => {
      expect(run).toHaveBeenCalledWith("atomic.T1595", {
        executionMode: "live"
      });
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      /atomic_live_disabled/
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      /live execution disabled/i
    );
  });
});
