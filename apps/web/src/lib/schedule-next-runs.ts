import type { MissionSchedule, ScheduleTiming } from "@periscan/shared";

/**
 * Client-side estimate of upcoming schedule fire times.
 * Mirrors apps/api calculateNextRunAt timing logic (local wall-clock,
 * weekday/month anchors, blackout push-out) for create-form preview only.
 * Server remains the source of truth after create.
 */

function zonedScheduleParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return {
    day,
    dayOfWeek: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    hour: read("hour"),
    minute: read("minute"),
    month,
    year
  };
}

function localScheduleDate(
  input: {
    day: number;
    hour: number;
    minute: number;
    month: number;
    year: number;
  },
  timeZone: string
) {
  let candidate = new Date(
    Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute)
  );
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const actual = zonedScheduleParts(candidate, timeZone);
    const desiredAsUtc = Date.UTC(
      input.year,
      input.month - 1,
      input.day,
      input.hour,
      input.minute
    );
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute
    );
    candidate = new Date(candidate.getTime() + desiredAsUtc - actualAsUtc);
  }
  return candidate;
}

function shiftLocalScheduleDate(
  input: { day: number; month: number; year: number },
  days: number
) {
  const shifted = new Date(
    Date.UTC(input.year, input.month - 1, input.day + days)
  );
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth() + 1,
    year: shifted.getUTCFullYear()
  };
}

function timeMinutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function moveScheduleOutsideBlackout(candidate: Date, timing: ScheduleTiming) {
  let next = candidate;
  for (let iteration = 0; iteration < 10; iteration += 1) {
    const local = zonedScheduleParts(next, timing.timeZone);
    const minuteOfDay = local.hour * 60 + local.minute;
    const previousDay = (local.dayOfWeek + 6) % 7;
    let moved = false;
    for (const window of timing.blackoutWindows) {
      const start = timeMinutes(window.startTime);
      const end = timeMinutes(window.endTime);
      let endDayOffset = 0;
      let blocked = false;
      if (start < end) {
        blocked =
          window.daysOfWeek.includes(local.dayOfWeek) &&
          minuteOfDay >= start &&
          minuteOfDay < end;
      } else if (start > end) {
        if (
          window.daysOfWeek.includes(local.dayOfWeek) &&
          minuteOfDay >= start
        ) {
          blocked = true;
          endDayOffset = 1;
        } else if (
          window.daysOfWeek.includes(previousDay) &&
          minuteOfDay < end
        ) {
          blocked = true;
        }
      }
      if (!blocked) continue;
      const date = shiftLocalScheduleDate(local, endDayOffset);
      next = localScheduleDate(
        {
          ...date,
          hour: Math.floor(end / 60),
          minute: end % 60
        },
        timing.timeZone
      );
      moved = true;
      break;
    }
    if (!moved) return next;
  }
  return next;
}

export function estimateNextRunAt(
  frequency: MissionSchedule["frequency"],
  from: Date,
  timing: ScheduleTiming
): Date {
  const local = zonedScheduleParts(from, timing.timeZone);
  const [hour, minute] = timing.runAtLocalTime.split(":").map(Number);
  let date = { day: local.day, month: local.month, year: local.year };

  if (frequency === "Weekly") {
    const targetDay = timing.dayOfWeek ?? local.dayOfWeek;
    date = shiftLocalScheduleDate(
      date,
      (targetDay - local.dayOfWeek + 7) % 7
    );
  } else if (frequency === "Monthly") {
    date.day = timing.dayOfMonth ?? Math.min(local.day, 28);
  }

  let candidate = localScheduleDate(
    { ...date, hour: hour ?? 0, minute: minute ?? 0 },
    timing.timeZone
  );
  if (candidate.getTime() <= from.getTime()) {
    if (frequency === "Daily") {
      date = shiftLocalScheduleDate(date, 1);
    } else if (frequency === "Weekly") {
      date = shiftLocalScheduleDate(date, 7);
    } else {
      // date.month is 1-indexed; Date.UTC month is 0-indexed — this advances one month.
      const shiftedMonth = new Date(Date.UTC(date.year, date.month, 1));
      date = {
        day: timing.dayOfMonth ?? Math.min(local.day, 28),
        month: shiftedMonth.getUTCMonth() + 1,
        year: shiftedMonth.getUTCFullYear()
      };
    }
    candidate = localScheduleDate(
      { ...date, hour: hour ?? 0, minute: minute ?? 0 },
      timing.timeZone
    );
  }
  return moveScheduleOutsideBlackout(candidate, timing);
}

/** Next 1–3 fire times from `from` (defaults to now). */
export function estimateNextFireTimes(
  frequency: MissionSchedule["frequency"],
  timing: ScheduleTiming,
  count = 3,
  from: Date = new Date()
): Date[] {
  const n = Math.max(1, Math.min(3, count));
  const times: Date[] = [];
  let cursor = from;
  for (let i = 0; i < n; i += 1) {
    const next = estimateNextRunAt(frequency, cursor, timing);
    times.push(next);
    cursor = next;
  }
  return times;
}

export function formatFireTime(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      month: "short",
      timeZone,
      timeZoneName: "short",
      weekday: "short",
      year: "numeric"
    }).format(date);
  } catch {
    return date.toISOString();
  }
}
