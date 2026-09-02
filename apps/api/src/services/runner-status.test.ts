import { describe, expect, it } from "vitest";

import { withEffectiveRunnerStatus } from "./runner.js";

describe("withEffectiveRunnerStatus", () => {
  const now = new Date("2026-07-29T12:00:00.000Z");

  it("projects Offline when lastSeenAt exceeds offline threshold", () => {
    const runner = {
      lastSeenAt: new Date("2026-07-29T11:50:00.000Z"),
      status: "Active"
    };
    const next = withEffectiveRunnerStatus(runner, 300, now);
    expect(next.status).toBe("Offline");
  });

  it("keeps Active when heartbeat is fresh", () => {
    const runner = {
      lastSeenAt: new Date("2026-07-29T11:59:00.000Z"),
      status: "Active"
    };
    const next = withEffectiveRunnerStatus(runner, 300, now);
    expect(next.status).toBe("Active");
  });

  it("does not override Revoked or KillSwitchActive", () => {
    expect(
      withEffectiveRunnerStatus(
        { lastSeenAt: null, status: "Revoked" },
        300,
        now
      ).status
    ).toBe("Revoked");
    expect(
      withEffectiveRunnerStatus(
        { lastSeenAt: null, status: "KillSwitchActive" },
        300,
        now
      ).status
    ).toBe("KillSwitchActive");
  });

  it("treats never-seen runners as Offline", () => {
    expect(
      withEffectiveRunnerStatus(
        { lastSeenAt: null, status: "Active" },
        300,
        now
      ).status
    ).toBe("Offline");
  });
});
