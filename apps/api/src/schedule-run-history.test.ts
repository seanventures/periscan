import { describe, expect, it } from "vitest";

import {
  appendScheduleRunHistory,
  extractScheduleRunHistory
} from "./runtime-services.js";

describe("P06-10 schedule run history", () => {
  it("appends newest-first and caps length", () => {
    let config: Record<string, unknown> = { audience: "Security Team" };
    for (let i = 0; i < 12; i += 1) {
      config = appendScheduleRunHistory(config, {
        missionId: `mission-${i}`,
        outcome: i % 2 === 0 ? "Succeeded" : "DeniedByPolicy",
        denyReason: i % 2 === 0 ? null : "policy",
        scheduledAt: `2026-07-29T${String(i).padStart(2, "0")}:00:00.000Z`,
        snapshotId: null
      });
    }
    const history = extractScheduleRunHistory(config) ?? [];
    expect(history).toHaveLength(10);
    expect(history[0]?.missionId).toBe("mission-11");
    expect(history[0]?.outcome).toBe("DeniedByPolicy");
  });
});
