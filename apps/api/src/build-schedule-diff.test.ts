import { describe, expect, it } from "vitest";

import type { ValidationSnapshot } from "@periscan/shared";

import { buildScheduleDiff } from "./schedule-diff.js";

// buildScheduleDiff only reads snapshotId + topAttackPaths[].attackPath
// .{pathId,validationState} and .risk.score (no schema parse), so minimal cast
// fixtures exercise the real diff/regression logic deterministically.
function snapshot(
  snapshotId: string,
  paths: Array<{ pathId: string; score: number; validationState: string }>
): ValidationSnapshot {
  return {
    snapshotId,
    topAttackPaths: paths.map((path) => ({
      attackPath: {
        pathId: path.pathId,
        validationState: path.validationState
      },
      risk: { score: path.score }
    }))
  } as unknown as ValidationSnapshot;
}

describe("buildScheduleDiff", () => {
  it("reports NoPreviousRun on the first scheduled result", () => {
    const diff = buildScheduleDiff({
      current: snapshot("s1", [
        { pathId: "p1", score: 80, validationState: "Validated" }
      ]),
      previous: null
    });
    expect(diff.status).toBe("NoPreviousRun");
    expect(diff.addedPathIds).toEqual(["p1"]);
    expect(diff.reopenedPathIds).toEqual([]);
    expect(diff.previousSnapshotId).toBeNull();
  });

  it("flags a previously-Fixed path that is no longer Fixed as ReopenedRiskDetected", () => {
    const diff = buildScheduleDiff({
      current: snapshot("s2", [
        { pathId: "p1", score: 90, validationState: "Exploitable" }
      ]),
      previous: snapshot("s1", [
        { pathId: "p1", score: 0, validationState: "Fixed" }
      ])
    });
    expect(diff.status).toBe("ReopenedRiskDetected");
    expect(diff.reopenedPathIds).toEqual(["p1"]);
    expect(diff.summary).toContain("1 previously fixed path");
  });

  it("reports Changed when paths/risk move but nothing reopened", () => {
    const diff = buildScheduleDiff({
      current: snapshot("s2", [
        { pathId: "p1", score: 80, validationState: "Validated" },
        { pathId: "p2", score: 40, validationState: "Validated" }
      ]),
      previous: snapshot("s1", [
        { pathId: "p1", score: 50, validationState: "Validated" }
      ])
    });
    expect(diff.status).toBe("Changed");
    expect(diff.addedPathIds).toEqual(["p2"]);
    expect(diff.removedPathIds).toEqual([]);
    expect(diff.reopenedPathIds).toEqual([]);
    expect(diff.riskScoreDelta).toBe(70); // (80+40) - 50
  });

  it("reports Unchanged when paths and total risk are identical", () => {
    const paths = [{ pathId: "p1", score: 60, validationState: "Validated" }];
    const diff = buildScheduleDiff({
      current: snapshot("s2", paths),
      previous: snapshot("s1", paths)
    });
    expect(diff.status).toBe("Unchanged");
    expect(diff.riskScoreDelta).toBe(0);
    expect(diff.addedPathIds).toEqual([]);
    expect(diff.removedPathIds).toEqual([]);
  });
});
