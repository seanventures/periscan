import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatDataAge, LiveUpdatePill } from "./live-update-pill";

describe("formatDataAge", () => {
  const now = Date.parse("2026-07-31T12:00:00.000Z");

  it("reports waiting when stamp missing or invalid", () => {
    expect(formatDataAge(null, now)).toBe("waiting for data");
    expect(formatDataAge("not-a-date", now)).toBe("waiting for data");
  });

  it("formats seconds, minutes, hours, and days", () => {
    expect(formatDataAge("2026-07-31T11:59:58.000Z", now)).toBe("just now");
    expect(formatDataAge("2026-07-31T11:59:30.000Z", now)).toBe("30s ago");
    expect(formatDataAge("2026-07-31T11:45:00.000Z", now)).toBe("15m ago");
    expect(formatDataAge("2026-07-31T09:00:00.000Z", now)).toBe("3h ago");
    expect(formatDataAge("2026-07-29T12:00:00.000Z", now)).toBe("2d ago");
  });
});

describe("LiveUpdatePill", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes polite status with polled age (not live SIEM)", () => {
    render(
      <LiveUpdatePill lastUpdatedAt="2026-07-31T11:59:40.000Z" />
    );
    const pill = screen.getByRole("status");
    expect(pill).toHaveAttribute("aria-live", "polite");
    expect(pill).toHaveTextContent("Polled 20s ago");
    expect(pill).toHaveAttribute(
      "title",
      expect.stringContaining("Last successful poll")
    );
    expect(pill).not.toHaveTextContent(/Live/i);
  });

  it("announces polled refresh without inventing a stamp or live claim", () => {
    render(
      <LiveUpdatePill lastUpdatedAt="2026-07-31T11:59:00.000Z" refreshing />
    );
    expect(screen.getByRole("status")).toHaveTextContent("Polled · refreshing");
    expect(screen.getByRole("status")).not.toHaveTextContent(/Live/i);
  });

  it("waits honestly when no poll has succeeded", () => {
    render(<LiveUpdatePill lastUpdatedAt={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Polled · waiting for data"
    );
  });
});
