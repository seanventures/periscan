import { describe, expect, it } from "vitest";

import { countOpenRemediations, countResolvedRemediations } from "./domain.js";

describe("countResolvedRemediations", () => {
  it("counts only remediations that are Fixed or Mitigated", () => {
    const count = countResolvedRemediations([
      { status: "Open" }, // open
      { status: "InProgress" }, // open
      { status: "StillExposed" }, // open
      { status: "VerificationPending" }, // open
      { status: "Reopened" }, // open
      { status: "PartiallyFixed" }, // open (not fully resolved)
      { status: "Fixed" }, // resolved
      { status: "Mitigated" } // resolved
    ]);
    expect(count).toBe(2);
  });

  it("returns 0 when nothing is Fixed or Mitigated", () => {
    expect(
      countResolvedRemediations([
        { status: "Open" },
        { status: "PartiallyFixed" }
      ])
    ).toBe(0);
  });

  it("returns 0 for an empty set", () => {
    expect(countResolvedRemediations([])).toBe(0);
  });

  it("is the exact complement of countOpenRemediations (resolved + open === total)", () => {
    const remediations = [
      { status: "Open" },
      { status: "Fixed" },
      { status: "Mitigated" },
      { status: "PartiallyFixed" },
      { status: "Reopened" }
    ];
    expect(
      countResolvedRemediations(remediations) +
        countOpenRemediations(remediations)
    ).toBe(remediations.length);
  });
});
