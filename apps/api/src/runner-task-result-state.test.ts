import { describe, expect, it } from "vitest";

import {
  isTerminalRunnerTaskStatus,
  unionEvidenceIds
} from "./services/runner.js";

// Guards runner result/artifact callbacks: uploads and results must never be
// accepted against a task whose lifecycle is already closed, or a
// completed/denied/cancelled task could resurrect itself with new evidence.
describe("isTerminalRunnerTaskStatus", () => {
  it("treats every closed lifecycle state as terminal", () => {
    for (const status of [
      "Cancelled",
      "Completed",
      "DeniedByLocalPolicy",
      "DeniedByServerPolicy",
      "Expired",
      "Failed",
      "Rejected"
    ]) {
      expect(isTerminalRunnerTaskStatus(status)).toBe(true);
    }
  });

  it("treats in-flight states as non-terminal so a live task can still report", () => {
    for (const status of ["Queued", "Leased", "Running", "Accepted"]) {
      expect(isTerminalRunnerTaskStatus(status)).toBe(false);
    }
  });

  it("does not treat an unknown status as terminal", () => {
    expect(isTerminalRunnerTaskStatus("SomethingElse")).toBe(false);
  });
});

describe("unionEvidenceIds", () => {
  it("preserves prior uploaded evidence when a Failed result has an empty manifest", () => {
    // Trigger: uploadRunnerTaskArtifact appends id A, then submit Failed with
    // evidenceManifest=[] — wholesale replace would wipe A; union keeps it.
    expect(unionEvidenceIds(["evidence-a"], [])).toEqual(["evidence-a"]);
  });

  it("merges manifest ids with existing ids without duplicates", () => {
    expect(
      unionEvidenceIds(["evidence-a", "evidence-b"], ["evidence-b", "evidence-c"])
    ).toEqual(["evidence-a", "evidence-b", "evidence-c"]);
  });

  it("skips empty ids", () => {
    expect(unionEvidenceIds(["evidence-a", ""], ["", "evidence-b"])).toEqual([
      "evidence-a",
      "evidence-b"
    ]);
  });
});
