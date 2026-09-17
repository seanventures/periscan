import { describe, expect, it } from "vitest";

import {
  estimateNextFireTimes,
  estimateNextRunAt,
  formatFireTime
} from "./schedule-next-runs";

describe("estimateNextRunAt / estimateNextFireTimes", () => {
  it("anchors weekly schedules to the selected local weekday", () => {
    expect(
      estimateNextRunAt("Weekly", new Date("2026-07-14T12:00:00.000Z"), {
        blackoutWindows: [],
        dayOfWeek: 1,
        runAtLocalTime: "09:30",
        timeZone: "UTC"
      }).toISOString()
    ).toBe("2026-07-20T09:30:00.000Z");
  });

  it("returns the next three daily fires", () => {
    const fires = estimateNextFireTimes(
      "Daily",
      {
        blackoutWindows: [],
        runAtLocalTime: "09:00",
        timeZone: "UTC"
      },
      3,
      new Date("2026-07-14T12:00:00.000Z")
    );
    expect(fires.map((d) => d.toISOString())).toEqual([
      "2026-07-15T09:00:00.000Z",
      "2026-07-16T09:00:00.000Z",
      "2026-07-17T09:00:00.000Z"
    ]);
  });

  it("moves runs to the end of a recurring blackout window", () => {
    expect(
      estimateNextRunAt("Daily", new Date("2026-07-13T20:00:00.000Z"), {
        blackoutWindows: [
          { daysOfWeek: [2], endTime: "06:00", startTime: "00:00" }
        ],
        runAtLocalTime: "02:00",
        timeZone: "UTC"
      }).toISOString()
    ).toBe("2026-07-14T06:00:00.000Z");
  });

  it("formats fire times in the schedule timezone", () => {
    const label = formatFireTime(
      new Date("2026-07-20T13:30:00.000Z"),
      "America/New_York"
    );
    expect(label).toMatch(/Jul/);
    expect(label).toMatch(/20/);
    expect(label).toMatch(/09:30/);
  });
});
