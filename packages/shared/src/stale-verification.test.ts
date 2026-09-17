import { describe, expect, it } from "vitest";

import { countStaleVerifications } from "./domain.js";

const ASOF = new Date("2026-06-11T00:00:00.000Z");
const PAST = "2026-06-10T00:00:00.000Z";
const FUTURE = "2026-06-18T00:00:00.000Z";

describe("countStaleVerifications", () => {
  it("counts only settled fixes whose re-verification is overdue", () => {
    const count = countStaleVerifications(
      [
        { nextVerificationAt: PAST, status: "Fixed" }, // overdue -> stale
        { nextVerificationAt: PAST, status: "Mitigated" }, // overdue -> stale
        { nextVerificationAt: FUTURE, status: "Fixed" }, // scheduled, fresh
        { nextVerificationAt: PAST, status: "StillExposed" }, // not settled
        { nextVerificationAt: null, status: "Fixed" }, // not scheduled
        { status: "Fixed" } // no field
      ],
      ASOF
    );
    expect(count).toBe(2);
  });

  it("returns 0 when nothing is settled+overdue", () => {
    expect(
      countStaleVerifications(
        [
          { nextVerificationAt: FUTURE, status: "Fixed" },
          { nextVerificationAt: PAST, status: "Open" }
        ],
        ASOF
      )
    ).toBe(0);
  });
});
