import { describe, expect, it } from "vitest";

import { calculateNextRunAt } from "./runtime-services.js";

// The real schedule-advance helper (runtime-services) — distinct from the
// in-memory double in app.test. It drives mission schedules, threat-feed
// ingestion, and integration sync cadence, so each frequency branch must
// advance the correct UTC interval (and not drift with local time zone).
describe("calculateNextRunAt", () => {
  const from = new Date("2026-06-15T12:00:00.000Z");

  it("advances Daily by exactly one UTC day", () => {
    expect(calculateNextRunAt("Daily", from).toISOString()).toBe(
      "2026-06-16T12:00:00.000Z"
    );
  });

  it("advances Weekly by exactly seven UTC days", () => {
    expect(calculateNextRunAt("Weekly", from).toISOString()).toBe(
      "2026-06-22T12:00:00.000Z"
    );
  });

  it("advances Monthly by one UTC month (the default/else branch)", () => {
    expect(calculateNextRunAt("Monthly", from).toISOString()).toBe(
      "2026-07-15T12:00:00.000Z"
    );
  });

  it("does not mutate the input date", () => {
    const original = from.toISOString();
    calculateNextRunAt("Daily", from);
    expect(from.toISOString()).toBe(original);
  });

  it("crosses a year boundary correctly for Monthly in December", () => {
    expect(
      calculateNextRunAt(
        "Monthly",
        new Date("2026-12-10T00:00:00.000Z")
      ).toISOString()
    ).toBe("2027-01-10T00:00:00.000Z");
  });

  it("keeps a daily wall-clock time across daylight-saving changes", () => {
    const timing = {
      blackoutWindows: [],
      runAtLocalTime: "09:00",
      timeZone: "America/New_York"
    };
    expect(
      calculateNextRunAt(
        "Daily",
        new Date("2026-03-07T15:00:00.000Z"),
        timing
      ).toISOString()
    ).toBe("2026-03-08T13:00:00.000Z");
  });

  it("moves runs to the end of a recurring blackout window", () => {
    expect(
      calculateNextRunAt(
        "Daily",
        new Date("2026-07-13T20:00:00.000Z"),
        {
          blackoutWindows: [
            { daysOfWeek: [2], endTime: "06:00", startTime: "00:00" }
          ],
          runAtLocalTime: "02:00",
          timeZone: "UTC"
        }
      ).toISOString()
    ).toBe("2026-07-14T06:00:00.000Z");
  });

  it("anchors weekly schedules to the selected local weekday", () => {
    expect(
      calculateNextRunAt(
        "Weekly",
        new Date("2026-07-14T12:00:00.000Z"),
        {
          blackoutWindows: [],
          dayOfWeek: 1,
          runAtLocalTime: "09:30",
          timeZone: "UTC"
        }
      ).toISOString()
    ).toBe("2026-07-20T09:30:00.000Z");
  });
});
