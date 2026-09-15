import { describe, expect, it } from "vitest";

import { reconcileMissionAggregateFromRuns } from "./services/runner.js";

// Hybrid compile queues N runner tasks under one mission. A single task result
// must not stamp the mission Completed/Failed or replace mission.evidenceIds.
describe("reconcileMissionAggregateFromRuns", () => {
  it("keeps the mission Running when only the first of N runs is Completed", () => {
    const aggregate = reconcileMissionAggregateFromRuns([
      { evidenceIds: ["e1"], status: "Completed" },
      { evidenceIds: [], status: "Queued" }
    ]);

    expect(aggregate.status).toBe("Running");
    expect(aggregate.isTerminal).toBe(false);
    expect(aggregate.completedAt).toBeNull();
    expect(aggregate.evidenceIds).toEqual(["e1"]);
  });

  it("unions evidence across siblings and Completes only when every run Completed", () => {
    const aggregate = reconcileMissionAggregateFromRuns([
      { evidenceIds: ["e1"], status: "Completed" },
      { evidenceIds: ["e2", "e1"], status: "Completed" }
    ]);

    expect(aggregate.status).toBe("Completed");
    expect(aggregate.isTerminal).toBe(true);
    expect(aggregate.completedAt).toBeInstanceOf(Date);
    expect(aggregate.evidenceIds).toEqual(["e1", "e2"]);
  });

  it("does not let a later Failed wipe sibling evidence from the aggregate", () => {
    const aggregate = reconcileMissionAggregateFromRuns([
      { evidenceIds: ["e1"], status: "Completed" },
      { evidenceIds: [], status: "Failed" }
    ]);

    expect(aggregate.status).toBe("Failed");
    expect(aggregate.isTerminal).toBe(true);
    expect(aggregate.evidenceIds).toEqual(["e1"]);
  });

  it("treats Leased/Accepted siblings as in-flight (not Completed)", () => {
    const aggregate = reconcileMissionAggregateFromRuns([
      { evidenceIds: ["e1"], status: "Completed" },
      { evidenceIds: [], status: "Leased" }
    ]);

    expect(aggregate.status).toBe("Running");
    expect(aggregate.isTerminal).toBe(false);
  });
});
