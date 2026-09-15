import { describe, expect, it } from "vitest";

import { deriveRunnerFleetHealth } from "./runner-fleet.js";

const now = new Date("2026-07-16T16:00:00.000Z");

function health(
  overrides: Partial<Parameters<typeof deriveRunnerFleetHealth>[0]> = {}
) {
  return deriveRunnerFleetHealth({
    attentionAfterSeconds: 90,
    killSwitchActive: false,
    lastSeenAt: new Date("2026-07-16T15:59:30.000Z"),
    now,
    offlineAfterSeconds: 300,
    revokedAt: null,
    status: "Active",
    ...overrides
  });
}

describe("deriveRunnerFleetHealth", () => {
  it("derives healthy, attention, and offline from server-received age", () => {
    expect(health()).toEqual({
      healthState: "Healthy",
      heartbeatAgeSeconds: 30
    });
    expect(
      health({ lastSeenAt: new Date("2026-07-16T15:58:00.000Z") })
    ).toEqual({ healthState: "Attention", heartbeatAgeSeconds: 120 });
    expect(
      health({ lastSeenAt: new Date("2026-07-16T15:54:00.000Z") })
    ).toEqual({ healthState: "Offline", heartbeatAgeSeconds: 360 });
  });

  it("gives revoked and halted controls precedence over heartbeat freshness", () => {
    expect(health({ killSwitchActive: true }).healthState).toBe("Halted");
    expect(
      health({
        killSwitchActive: true,
        revokedAt: new Date("2026-07-16T15:50:00.000Z")
      }).healthState
    ).toBe("Revoked");
  });
});
