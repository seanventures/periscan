import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ControlRuleCoverageSummary } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { AttackNavigatorWorkbench } from "./attack-navigator-workbench";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const EVIDENCE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const controlSourceId = "99999999-9999-4999-8999-999999999999";

const importedLayerJson = {
  domain: "enterprise-attack",
  name: "Imported SOC layer",
  techniques: [
    {
      color: "#2A9D8F",
      comment: "blocked in prod SIEM",
      links: [
        {
          label: "Evidence",
          url: `/api/v1/evidence/${EVIDENCE_ID}`
        }
      ],
      techniqueID: "T1059"
    },
    {
      metadata: [{ name: "state", value: "detected" }],
      tactic: "command-and-control",
      techniqueID: "T1071"
    },
    {
      metadata: [{ name: "state", value: "stale" }],
      techniqueID: "T1562"
    },
    {
      metadata: [{ name: "state", value: "tested" }],
      techniqueID: "T1595"
    }
  ],
  versions: { attack: "14", layer: "4.5", navigator: "4.9.1" }
};

function coverageItem(
  overrides: ControlRuleCoverageSummary["items"][number]
): ControlRuleCoverageSummary["items"][number] {
  return overrides;
}

const coverage: ControlRuleCoverageSummary = {
  blockedTechniques: 1,
  controlSourceId,
  coveredTechniques: 1,
  generatedAt: timestamp,
  history: [],
  improvedTechniques: 0,
  items: [
    coverageItem({
      confidence: 0.9,
      controlSourceId,
      evidenceIds: [EVIDENCE_ID],
      expectedBehaviors: ["Blocked"],
      lastObservedAt: timestamp,
      observedBehaviors: ["Blocked"],
      observedSources: ["SIEM"],
      previousStatus: null,
      recommendation: "Keep validating this rule after changes.",
      scenarioId: "scenario.execution",
      signalIds: ["88888888-8888-4888-8888-888888888888"],
      status: "Blocked",
      tacticName: "Execution",
      techniqueId: "T1059",
      techniqueName: "Command and Scripting Interpreter",
      title: "Execution blocked",
      trend: "New"
    }),
    coverageItem({
      confidence: 0.8,
      controlSourceId,
      evidenceIds: [EVIDENCE_ID],
      expectedBehaviors: ["Detected"],
      lastObservedAt: timestamp,
      observedBehaviors: ["Detected"],
      observedSources: ["SIEM"],
      previousStatus: null,
      recommendation: "Keep validating this rule after changes.",
      scenarioId: "scenario.c2",
      signalIds: ["77777777-7777-4777-8777-777777777777"],
      status: "Covered",
      tacticName: "Command and Control",
      techniqueId: "T1071",
      techniqueName: "Application Layer Protocol",
      title: "C2 detected",
      trend: "New"
    }),
    coverageItem({
      confidence: 0.2,
      controlSourceId,
      evidenceIds: [],
      expectedBehaviors: ["Detected"],
      lastObservedAt: timestamp,
      observedBehaviors: [],
      observedSources: [],
      previousStatus: null,
      recommendation: "Re-run the scenario; this observation is stale.",
      scenarioId: "scenario.defense-evasion",
      signalIds: [],
      status: "Stale",
      tacticName: "Defense Evasion",
      techniqueId: "T1562",
      techniqueName: "Impair Defenses",
      title: "Stale impair-defenses observation",
      trend: "Unchanged"
    }),
    coverageItem({
      confidence: 0,
      controlSourceId,
      evidenceIds: [],
      expectedBehaviors: ["Detected"],
      lastObservedAt: null,
      observedBehaviors: [],
      observedSources: [],
      previousStatus: null,
      recommendation: "Not tested.",
      scenarioId: "scenario.valid-accounts",
      signalIds: [],
      status: "NotTested",
      tacticName: "Initial Access",
      techniqueId: "T1078",
      techniqueName: "Valid Accounts",
      title: "Valid accounts not tested",
      trend: "New"
    })
  ],
  loggedOnlyTechniques: 0,
  missedTechniques: 0,
  needsTuningTechniques: 0,
  noEvidenceTechniques: 0,
  notTestedTechniques: 1,
  recommendations: [],
  regressedTechniques: 0,
  snapshotId: null,
  staleTechniques: 1,
  tenantId,
  totalTechniques: 4
};

function importLayer() {
  fireEvent.change(screen.getByLabelText("Navigator layer JSON"), {
    target: { value: JSON.stringify(importedLayerJson) }
  });
  fireEvent.click(screen.getByRole("button", { name: "Import layer" }));
}

describe("AttackNavigatorWorkbench", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows an honest empty overlay without executed coverage or invented detections", () => {
    render(<AttackNavigatorWorkbench />);

    expect(
      screen.getByRole("heading", { name: "ATT&CK Navigator overlay" })
    ).toBeInTheDocument();
    expect(screen.getByTestId("attack-navigator-honesty")).toHaveTextContent(
      /not executed coverage/i
    );
    expect(screen.getByTestId("attack-navigator-honesty")).toHaveTextContent(
      /not 100% ATT&CK/i
    );
    expect(screen.getByText("No Navigator overlay loaded")).toBeInTheDocument();
    expect(
      screen.queryByRole("row", { name: /T\d{4}/ })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("attack-navigator-workbench")).toHaveAttribute(
      "data-executed-coverage",
      "false"
    );
    expect(screen.queryByText(/live Atomic/i)).not.toBeInTheDocument();
  });

  it("imports a layer and shows tested, detected, blocked, and stale with evidence links", () => {
    render(<AttackNavigatorWorkbench />);
    importLayer();

    const table = screen.getByRole("table", {
      name: "Navigator overlay techniques"
    });
    expect(within(table).getByText("T1059")).toBeInTheDocument();
    expect(within(table).getByText("Blocked")).toBeInTheDocument();
    expect(within(table).getByText("Detected")).toBeInTheDocument();
    expect(within(table).getByText("Stale")).toBeInTheDocument();
    expect(within(table).getByText("Tested")).toBeInTheDocument();
    expect(
      within(table).getByRole("link", { name: "Evidence" })
    ).toHaveAttribute("href", `/api/v1/evidence/${EVIDENCE_ID}`);
    expect(screen.getByTestId("attack-navigator-workbench")).toHaveAttribute(
      "data-executed-coverage",
      "false"
    );
    expect(
      screen.getAllByText(/Imported content is not executed coverage/i).length
    ).toBeGreaterThan(0);
  });

  it("overlays control-validation coverage from the API without inventing NotTested rows", async () => {
    vi.spyOn(api, "getControlRuleCoverage").mockResolvedValue(coverage);

    render(<AttackNavigatorWorkbench />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Overlay from control-validation coverage"
      })
    );

    await waitFor(() => {
      expect(screen.getByText("T1059")).toBeInTheDocument();
    });

    const table = screen.getByRole("table", {
      name: "Navigator overlay techniques"
    });
    expect(within(table).getByText("T1071")).toBeInTheDocument();
    expect(within(table).getByText("T1562")).toBeInTheDocument();
    expect(within(table).queryByText("T1078")).not.toBeInTheDocument();
    expect(
      within(table).getAllByRole("link", { name: "Evidence" })[0]
    ).toHaveAttribute("href", `/api/v1/evidence/${EVIDENCE_ID}`);
    expect(screen.getByTestId("attack-navigator-workbench")).toHaveAttribute(
      "data-executed-coverage",
      "false"
    );
  });

  it("keeps coverage failures honest and does not paint fake detections", async () => {
    vi.spyOn(api, "getControlRuleCoverage").mockRejectedValue(
      new Error("Authentication required")
    );

    render(<AttackNavigatorWorkbench />);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Overlay from control-validation coverage"
      })
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /control-validation coverage/i
      );
    });
    expect(screen.queryByText("T1059")).not.toBeInTheDocument();
    expect(screen.getByTestId("attack-navigator-workbench")).toHaveAttribute(
      "data-executed-coverage",
      "false"
    );
  });

  it("exports a round-trip layer that still is not executed coverage", () => {
    render(<AttackNavigatorWorkbench />);
    importLayer();

    fireEvent.click(
      screen.getByRole("button", { name: "Export Navigator layer" })
    );

    const exportedJson =
      screen.getByTestId("navigator-export-json").textContent ?? "";
    const payload = JSON.parse(exportedJson) as {
      metadata: Array<{ name: string; value: string }>;
      techniques: Array<{ techniqueID: string }>;
    };
    expect(payload.metadata).toEqual(
      expect.arrayContaining([
        { name: "executedCoverage", value: "false" },
        { name: "liveSupported", value: "false" }
      ])
    );
    expect(payload.techniques.map((row) => row.techniqueID)).toContain("T1059");

    fireEvent.click(screen.getByRole("button", { name: "Clear overlay" }));
    expect(screen.getByText("No Navigator overlay loaded")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Navigator layer JSON"), {
      target: { value: exportedJson }
    });
    fireEvent.click(screen.getByRole("button", { name: "Import layer" }));

    const table = screen.getByRole("table", {
      name: "Navigator overlay techniques"
    });
    expect(within(table).getByText("T1059")).toBeInTheDocument();
    expect(within(table).getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByTestId("attack-navigator-workbench")).toHaveAttribute(
      "data-executed-coverage",
      "false"
    );
  });

  it("shows N of D supported scenarios, window 30d and no coverage percent ring", () => {
    const recent = new Date().toISOString();
    render(
      <AttackNavigatorWorkbench
        receipts={[{ techniqueID: "T1082", at: recent, kind: "lab_receipt" }]}
        supportedScenarioTechniqueIds={["T1082", "T1124"]}
      />
    );

    const freshness = screen.getByTestId("attack-navigator-freshness");
    expect(freshness).toHaveTextContent(
      "1 of 2 supported scenarios, window 30d"
    );
    expect(freshness).not.toHaveTextContent("%");
    expect(
      screen.queryByTestId("attack-navigator-coverage-ring")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("attack-navigator-workbench")).toHaveAttribute(
      "data-executed-coverage",
      "false"
    );

    importLayer();
    expect(screen.getByTestId("attack-navigator-freshness")).toHaveTextContent(
      "1 of 2 supported scenarios, window 30d"
    );
    expect(screen.getByText("T1059")).toBeInTheDocument();
    expect(screen.getByTestId("attack-navigator-workbench")).toHaveAttribute(
      "data-executed-coverage",
      "false"
    );
  });
});
