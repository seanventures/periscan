import { describe, expect, it } from "vitest";

import { evaluateModelSessionLiveness } from "./domain.js";

const ASOF = new Date("2026-06-13T00:00:00.000Z");
const PAST = new Date("2026-06-12T00:00:00.000Z");
const FUTURE = new Date("2026-06-14T00:00:00.000Z");

describe("evaluateModelSessionLiveness", () => {
  it("treats an Active session inside its window as live", () => {
    expect(
      evaluateModelSessionLiveness(
        { expiresAt: FUTURE, status: "Active" },
        ASOF
      )
    ).toBe("live");
  });

  it("treats an Active session with no expiry as live", () => {
    expect(
      evaluateModelSessionLiveness({ expiresAt: null, status: "Active" }, ASOF)
    ).toBe("live");
  });

  it("treats Created/Paused/Blocked sessions inside their window as live", () => {
    for (const status of ["Created", "Paused", "Blocked"]) {
      expect(
        evaluateModelSessionLiveness({ expiresAt: FUTURE, status }, ASOF)
      ).toBe("live");
    }
  });

  it("reports an ended session for Terminated/Expired regardless of expiry", () => {
    for (const status of ["Terminated", "Expired"]) {
      // Even with a future window, a terminated/expired session is ended.
      expect(
        evaluateModelSessionLiveness({ expiresAt: FUTURE, status }, ASOF)
      ).toBe("ended");
    }
  });

  it("reports a timed-out session when an active window has closed", () => {
    expect(
      evaluateModelSessionLiveness({ expiresAt: PAST, status: "Active" }, ASOF)
    ).toBe("timedOut");
  });

  it("treats the expiresAt boundary as timed out (inclusive)", () => {
    expect(
      evaluateModelSessionLiveness({ expiresAt: ASOF, status: "Active" }, ASOF)
    ).toBe("timedOut");
  });

  it("prefers ended over timedOut for an overdue Terminated session", () => {
    // A kill-switched session past its window is already ended; it must not be
    // re-classified as a fresh timeout transition.
    expect(
      evaluateModelSessionLiveness(
        { expiresAt: PAST, status: "Terminated" },
        ASOF
      )
    ).toBe("ended");
  });
});
