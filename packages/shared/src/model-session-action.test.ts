import { describe, expect, it } from "vitest";

import { evaluateModelSessionAction } from "./domain.js";

const ASOF = new Date("2026-06-13T00:00:00.000Z");
const PAST = new Date("2026-06-12T00:00:00.000Z");
const FUTURE = new Date("2026-06-14T00:00:00.000Z");

describe("evaluateModelSessionAction", () => {
  it("allows an Active session inside its window", () => {
    expect(
      evaluateModelSessionAction({ expiresAt: FUTURE, status: "Active" }, ASOF)
    ).toBe("allow");
  });

  it("allows an Active session with no expiry", () => {
    expect(
      evaluateModelSessionAction({ expiresAt: null, status: "Active" }, ASOF)
    ).toBe("allow");
  });

  it("rejects Paused/Blocked/Created sessions as notActive even when live", () => {
    // These are exactly the statuses evaluateModelSessionLiveness reports as
    // "live": a deliberate pause/block halt, or a never-started session. None of
    // them may create or execute tool requests.
    for (const status of ["Created", "Paused", "Blocked"]) {
      expect(
        evaluateModelSessionAction({ expiresAt: FUTURE, status }, ASOF)
      ).toBe("notActive");
    }
  });

  it("treats a Created session with no enforced window as notActive", () => {
    expect(
      evaluateModelSessionAction({ expiresAt: null, status: "Created" }, ASOF)
    ).toBe("notActive");
  });

  it("reports ended for Terminated/Expired regardless of window or activity", () => {
    for (const status of ["Terminated", "Expired"]) {
      expect(
        evaluateModelSessionAction({ expiresAt: FUTURE, status }, ASOF)
      ).toBe("ended");
    }
  });

  it("reports timedOut for an Active session past its window", () => {
    expect(
      evaluateModelSessionAction({ expiresAt: PAST, status: "Active" }, ASOF)
    ).toBe("timedOut");
  });

  it("treats the expiresAt boundary as timedOut (inclusive)", () => {
    expect(
      evaluateModelSessionAction({ expiresAt: ASOF, status: "Active" }, ASOF)
    ).toBe("timedOut");
  });

  it("prefers ended over timedOut for an overdue Terminated session", () => {
    expect(
      evaluateModelSessionAction(
        { expiresAt: PAST, status: "Terminated" },
        ASOF
      )
    ).toBe("ended");
  });

  it("prefers timedOut over notActive for a Paused session past its window", () => {
    // A window that has already closed ends the session before its pause state
    // matters — the caller will lazily expire it.
    expect(
      evaluateModelSessionAction({ expiresAt: PAST, status: "Paused" }, ASOF)
    ).toBe("timedOut");
  });
});
