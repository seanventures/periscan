import { describe, expect, it } from "vitest";

import { countOpenRemediations } from "./domain.js";

describe("countOpenRemediations", () => {
  it("counts every remediation that is not Fixed or Mitigated", () => {
    const count = countOpenRemediations([
      { status: "Open" }, // open
      { status: "InProgress" }, // open
      { status: "StillExposed" }, // open
      { status: "VerificationPending" }, // open
      { status: "Reopened" }, // open
      { status: "PartiallyFixed" }, // open
      { status: "Fixed" }, // resolved
      { status: "Mitigated" } // resolved
    ]);
    expect(count).toBe(6);
  });

  it("returns 0 when every remediation is Fixed or Mitigated", () => {
    expect(
      countOpenRemediations([
        { status: "Fixed" },
        { status: "Mitigated" },
        { status: "Fixed" }
      ])
    ).toBe(0);
  });

  it("returns 0 for an empty set", () => {
    expect(countOpenRemediations([])).toBe(0);
  });
});
