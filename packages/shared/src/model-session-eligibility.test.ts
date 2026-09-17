import { describe, expect, it } from "vitest";

import {
  evaluateModelSessionTurnEligibility,
  isModelProviderUsable,
  isModelToolEnabled,
  isModelToolRequestExecutable,
  MODEL_TOOL_REQUEST_EXECUTABLE_STATUSES,
  resolveProviderStatusAfterConnectionTest
} from "./domain.js";

const ASOF = new Date("2026-06-13T00:00:00.000Z");
const PAST = new Date("2026-06-12T00:00:00.000Z");
const FUTURE = new Date("2026-06-14T00:00:00.000Z");

describe("evaluateModelSessionTurnEligibility", () => {
  it("runs an Active session still inside its time window", () => {
    expect(
      evaluateModelSessionTurnEligibility(
        { expiresAt: FUTURE, status: "Active" },
        ASOF
      )
    ).toBe("run");
  });

  it("runs an Active session with no expiry set", () => {
    expect(
      evaluateModelSessionTurnEligibility(
        { expiresAt: null, status: "Active" },
        ASOF
      )
    ).toBe("run");
  });

  it("expires an Active session whose window has already closed", () => {
    expect(
      evaluateModelSessionTurnEligibility(
        { expiresAt: PAST, status: "Active" },
        ASOF
      )
    ).toBe("expire");
  });

  it("expires exactly at the expiresAt boundary (inclusive)", () => {
    expect(
      evaluateModelSessionTurnEligibility(
        { expiresAt: ASOF, status: "Active" },
        ASOF
      )
    ).toBe("expire");
  });

  it("skips a non-Active session regardless of expiry", () => {
    for (const status of [
      "Created",
      "Paused",
      "Blocked",
      "Terminated",
      "Expired",
      "Archived"
    ]) {
      expect(
        evaluateModelSessionTurnEligibility({ expiresAt: FUTURE, status }, ASOF)
      ).toBe("skip");
    }
  });

  it("skips (does not expire) a non-Active session even when overdue", () => {
    // A Terminated/Blocked session past its expiresAt is already ended; it must
    // not be re-transitioned to Expired by the turn worker.
    expect(
      evaluateModelSessionTurnEligibility(
        { expiresAt: PAST, status: "Terminated" },
        ASOF
      )
    ).toBe("skip");
  });
});

describe("isModelProviderUsable", () => {
  it("allows an Active provider", () => {
    expect(isModelProviderUsable("Active")).toBe(true);
  });

  it("refuses a Disabled provider (operator halt)", () => {
    // An admin who disables a provider must stop its in-flight sessions, not
    // only block new ones.
    expect(isModelProviderUsable("Disabled")).toBe(false);
  });

  it("refuses an Error provider", () => {
    expect(isModelProviderUsable("Error")).toBe(false);
  });

  it("refuses any unrecognized status (fail closed)", () => {
    expect(isModelProviderUsable("")).toBe(false);
    expect(isModelProviderUsable("active")).toBe(false);
  });
});

describe("isModelToolEnabled", () => {
  it("treats a tool with no override as enabled", () => {
    // The default catalog state is enabled; only an explicit override disables.
    expect(isModelToolEnabled(null)).toBe(true);
    expect(isModelToolEnabled(undefined)).toBe(true);
  });

  it("honors an explicit enabled override", () => {
    expect(isModelToolEnabled({ enabled: true })).toBe(true);
  });

  it("refuses a disabled tool (operator halt)", () => {
    // An admin who disables a tool must stop its already-Allowed/Approved
    // in-flight requests at execution, not only block new requests.
    expect(isModelToolEnabled({ enabled: false })).toBe(false);
  });
});

describe("isModelToolRequestExecutable", () => {
  // The full ModelToolRequestStatus enum (packages/db schema).
  const ALL_STATUSES = [
    "Requested",
    "Allowed",
    "Denied",
    "RequiresApproval",
    "Approved",
    "Running",
    "Completed",
    "Failed",
    "Cancelled",
    "Expired"
  ] as const;

  it("treats Allowed and Approved as executable, and only those", () => {
    // executeModelToolRequest runs a request only while Allowed or Approved.
    expect(isModelToolRequestExecutable("Allowed")).toBe(true);
    expect(isModelToolRequestExecutable("Approved")).toBe(true);
  });

  it("refuses every non-executable status (pending, terminal, in-progress)", () => {
    for (const status of ALL_STATUSES) {
      if (status === "Allowed" || status === "Approved") {
        continue;
      }
      expect(isModelToolRequestExecutable(status)).toBe(false);
    }
  });

  it("fails closed on an unrecognized status", () => {
    expect(isModelToolRequestExecutable("")).toBe(false);
    expect(isModelToolRequestExecutable("allowed")).toBe(false);
  });

  it("includes Allowed in the executable source-of-truth set (the halt-cancel bug)", () => {
    // The kill switch and session-terminate cancel sets derive their executable
    // members from this constant; an omitted executable status would leave a
    // halted request non-terminal and under-count the kill switch metric.
    expect([...MODEL_TOOL_REQUEST_EXECUTABLE_STATUSES]).toEqual([
      "Allowed",
      "Approved"
    ]);
  });
});

describe("resolveProviderStatusAfterConnectionTest", () => {
  it("recovers an errored provider to Active on a successful test", () => {
    expect(resolveProviderStatusAfterConnectionTest("Error", true)).toBe(
      "Active"
    );
  });

  it("keeps an Active provider Active on a successful test", () => {
    expect(resolveProviderStatusAfterConnectionTest("Active", true)).toBe(
      "Active"
    );
  });

  it("degrades a provider to Error on a failed test", () => {
    expect(resolveProviderStatusAfterConnectionTest("Active", false)).toBe(
      "Error"
    );
    expect(resolveProviderStatusAfterConnectionTest("Error", false)).toBe(
      "Error"
    );
  });

  it("never resurrects a deliberately Disabled provider (operator halt is sticky)", () => {
    // A connection test must not undo an operator's deliberate Disable — not on
    // success (would silently re-enable it) nor on failure (would relabel the
    // chosen Disabled as Error). Only updateModelProvider re-enables it.
    expect(resolveProviderStatusAfterConnectionTest("Disabled", true)).toBe(
      "Disabled"
    );
    expect(resolveProviderStatusAfterConnectionTest("Disabled", false)).toBe(
      "Disabled"
    );
  });
});
