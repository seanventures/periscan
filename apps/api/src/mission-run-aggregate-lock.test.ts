import { describe, expect, it } from "vitest";

import { missionRunAggregateLockKey } from "./mission-run-aggregate-lock.js";

describe("missionRunAggregateLockKey", () => {
  it("scopes the advisory lock key to the mission id", () => {
    expect(missionRunAggregateLockKey("mission-1")).toBe(
      "mission-run-aggregate:mission-1"
    );
    expect(missionRunAggregateLockKey("mission-1")).not.toBe(
      missionRunAggregateLockKey("mission-2")
    );
  });
});
