import { describe, expect, it } from "vitest";

import { isModelSessionTimedOut } from "./services/model-gateway.js";

// Guards the model-gateway session timeout: a session whose expiresAt window has
// elapsed must stop operating (building context bundles, creating/executing tool
// requests) even before a reaper flips its status to Expired. Guarding only on
// status would let a time-expired session keep working past its window.
describe("isModelSessionTimedOut", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");

  it("treats a session whose expiresAt is in the past as timed out", () => {
    expect(
      isModelSessionTimedOut(
        { expiresAt: new Date("2026-06-16T11:59:59.000Z") },
        now
      )
    ).toBe(true);
  });

  it("treats a session expiring exactly now as timed out (inclusive boundary)", () => {
    expect(
      isModelSessionTimedOut({ expiresAt: new Date(now.getTime()) }, now)
    ).toBe(true);
  });

  it("treats a session whose expiresAt is in the future as live", () => {
    expect(
      isModelSessionTimedOut(
        { expiresAt: new Date("2026-06-16T12:00:01.000Z") },
        now
      )
    ).toBe(false);
  });

  it("treats a session with no expiresAt (never started) as live", () => {
    expect(isModelSessionTimedOut({ expiresAt: null }, now)).toBe(false);
  });
});
