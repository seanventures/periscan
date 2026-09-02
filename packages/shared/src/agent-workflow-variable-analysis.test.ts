import { describe, expect, it } from "vitest";

import {
  compareAgentWorkflowVariableSnapshots,
  type AgentWorkflowVariableSnapshot,
  type AgentWorkflowVariableValue
} from "./agent-workflow-variable-analysis.js";

const timestamp = "2026-07-16T16:00:00.000Z";

function variable(
  key: string,
  valuePreview: string,
  valueHash: string
): AgentWorkflowVariableValue {
  return {
    key,
    namespace: "Control",
    sourceEventId: null,
    sourceSequence: "0",
    stepKey: null,
    valueHash,
    valuePreview,
    valueType: "String"
  };
}

function snapshot(
  sequence: string,
  variables: AgentWorkflowVariableValue[]
): AgentWorkflowVariableSnapshot {
  return {
    changeSummary: { added: 0, changed: 0, removed: 0, unchanged: 0 },
    createdAt: timestamp,
    eventType: sequence === "0" ? "Baseline" : "Transition",
    sequence,
    stepKey: sequence === "0" ? null : "transition",
    variables
  };
}

describe("workflow variable snapshot comparison", () => {
  it("classifies added, changed, removed, and unchanged values by exact hash", () => {
    const deltas = compareAgentWorkflowVariableSnapshots(
      snapshot("1", [
        variable("control.added-later", "absent", "a".repeat(64)),
        variable("control.changed", "Created", "b".repeat(64)),
        variable("control.same", "Verified", "c".repeat(64))
      ]),
      snapshot("2", [
        variable("control.changed", "Completed", "d".repeat(64)),
        variable("control.new", "Bound", "e".repeat(64)),
        variable("control.same", "Verified", "c".repeat(64))
      ])
    );

    expect(
      Object.fromEntries(deltas.map((delta) => [delta.key, delta.changeType]))
    ).toEqual({
      "control.added-later": "Removed",
      "control.changed": "Changed",
      "control.new": "Added",
      "control.same": "Unchanged"
    });
  });
});
