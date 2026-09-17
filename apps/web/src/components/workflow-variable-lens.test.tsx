import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentWorkflowVariableAnalysis,
  AgentWorkflowVariableValue
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { WorkflowVariableLens } from "./workflow-variable-lens";

const timestamp = "2026-07-16T16:00:00.000Z";
const runId = "11111111-1111-4111-8111-111111111111";

function value(input: {
  hash: string;
  key: string;
  namespace: AgentWorkflowVariableValue["namespace"];
  preview: string;
  sequence: string;
}): AgentWorkflowVariableValue {
  return {
    key: input.key,
    namespace: input.namespace,
    sourceEventId: null,
    sourceSequence: input.sequence,
    stepKey: null,
    valueHash: input.hash.repeat(64),
    valuePreview: input.preview,
    valueType: input.namespace === "Performance" ? "Number" : "String"
  };
}

function analysis(): AgentWorkflowVariableAnalysis {
  const created = value({
    hash: "a",
    key: "control.run.status",
    namespace: "Control",
    preview: "Created",
    sequence: "0"
  });
  const running = value({
    hash: "b",
    key: "control.run.status",
    namespace: "Control",
    preview: "Running",
    sequence: "1"
  });
  const completed = value({
    hash: "c",
    key: "control.run.status",
    namespace: "Control",
    preview: "Completed",
    sequence: "2"
  });
  const latency = value({
    hash: "d",
    key: "performance.run.totalLatencyMs",
    namespace: "Performance",
    preview: "284",
    sequence: "2"
  });
  return {
    generatedAt: timestamp,
    integrityVerified: true,
    limitations: ["Only redacted persisted variables are analyzed."],
    namespaceCounts: {
      Context: 0,
      Control: 1,
      Evidence: 0,
      Input: 0,
      Model: 0,
      Performance: 1,
      Policy: 0,
      Tool: 0,
      Transition: 0
    },
    snapshots: [
      {
        changeSummary: { added: 1, changed: 0, removed: 0, unchanged: 0 },
        createdAt: timestamp,
        eventType: "Baseline",
        sequence: "0",
        stepKey: null,
        variables: [created]
      },
      {
        changeSummary: { added: 0, changed: 1, removed: 0, unchanged: 0 },
        createdAt: timestamp,
        eventType: "StepStarted",
        sequence: "1",
        stepKey: "context",
        variables: [running]
      },
      {
        changeSummary: { added: 1, changed: 1, removed: 0, unchanged: 0 },
        createdAt: timestamp,
        eventType: "RunCompleted",
        sequence: "2",
        stepKey: "transition",
        variables: [completed, latency]
      }
    ],
    summary: {
      changedVariableCount: 1,
      eventCount: 2,
      snapshotCount: 3,
      totalCostMicrousd: "1000",
      totalLatencyMs: 284,
      variableCount: 2
    },
    variables: [
      {
        changeCount: 2,
        firstSeenSequence: "0",
        key: "control.run.status",
        lastSeenSequence: "2",
        latestValueHash: "c".repeat(64),
        latestValuePreview: "Completed",
        namespace: "Control",
        observationCount: 3,
        valueType: "String"
      },
      {
        changeCount: 0,
        firstSeenSequence: "2",
        key: "performance.run.totalLatencyMs",
        lastSeenSequence: "2",
        latestValueHash: "d".repeat(64),
        latestValuePreview: "284",
        namespace: "Performance",
        observationCount: 1,
        valueType: "Number"
      }
    ],
    workflowRunId: runId
  };
}

describe("WorkflowVariableLens", () => {
  afterEach(() => vi.restoreAllMocks());

  it("compares two recorded moments and inspects exact before/after state", async () => {
    vi.spyOn(api, "getAgentWorkflowVariableAnalysis").mockResolvedValue(
      analysis()
    );

    render(<WorkflowVariableLens workflowRunId={runId} />);

    expect(
      await screen.findByText(
        "Compare what the workflow knew at any two moments"
      )
    ).toBeInTheDocument();
    expect(screen.getByText("History verified")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText("Compare variables from")).toHaveValue("1")
    );
    expect(screen.getByLabelText("Compare variables to")).toHaveValue("2");
    expect(screen.getAllByText("control.run.status")).toHaveLength(2);
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Compare variables from"), {
      target: { value: "0" }
    });
    fireEvent.change(screen.getByLabelText("Filter variable family"), {
      target: { value: "Performance" }
    });

    await waitFor(() =>
      expect(
        screen.getAllByText("performance.run.totalLatencyMs")
      ).toHaveLength(2)
    );
    expect(screen.getByText("Not present")).toBeInTheDocument();
    expect(screen.getByText("284")).toBeInTheDocument();
  });
});
