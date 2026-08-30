import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { BlueShiftBriefPanel } from "./blue-shift-brief";

const generatedAt = "2026-07-31T12:00:00.000Z";

describe("BlueShiftBriefPanel (ICP 5.0 residual)", () => {
  beforeEach(() => {
    vi.spyOn(api, "listSchedules").mockResolvedValue({
      items: [],
      page: { hasMore: false, limit: 50, offset: 0 }
    } as never);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps continuous health and exposes one Start triage CTA to Active findings", async () => {
    vi.spyOn(api, "getBlueShiftBrief").mockResolvedValue({
      generatedAt,
      programNote: "Morning validated program health.",
      totalActionable: 3,
      buckets: [
        {
          id: "unowned-findings",
          title: "Unowned findings",
          detail: "High priority without an owner",
          count: 3,
          urgency: "Now",
          href: "/findings?view=priority-unowned"
        }
      ],
      falsePositiveByReason: []
    } as never);

    render(<BlueShiftBriefPanel />);

    expect(
      await screen.findByTestId("continuous-health-strip")
    ).toBeInTheDocument();

    const cta = await screen.findByTestId("shift-start-triage");
    expect(cta).toHaveTextContent("Start triage");
    expect(cta).toHaveAttribute("href", "/findings");
    // P09 mid-market: ≥44px touch target (min-h-11).
    expect(cta.className).toMatch(/min-h-11/);

    await waitFor(() => {
      expect(screen.getByText("Blue shift pack")).toBeInTheDocument();
    });
    expect(screen.getByText("Morning validated program health.")).toBeInTheDocument();
    // Single primary CTA — not a SIEM wall of live claims.
    expect(screen.getAllByTestId("shift-start-triage")).toHaveLength(1);
    // No Active-queue bucket in this payload → omit Active count.
    expect(
      screen.queryByTestId("shift-active-finding-count")
    ).not.toBeInTheDocument();
  });

  it("shows Active finding count when shift brief has new-findings / Active bucket (P02)", async () => {
    vi.spyOn(api, "getBlueShiftBrief").mockResolvedValue({
      generatedAt,
      programNote: "Active queue needs triage.",
      totalActionable: 5,
      buckets: [
        {
          id: "new-findings",
          title: "New findings need disposition",
          detail: "Validated findings without a disposition.",
          count: 4,
          urgency: "Soon",
          href: "/findings?view=active"
        }
      ],
      falsePositiveByReason: []
    } as never);

    render(<BlueShiftBriefPanel />);

    const active = await screen.findByTestId("shift-active-finding-count");
    expect(active).toHaveTextContent(/4 Active findings/);
    expect(screen.getByTestId("shift-start-triage")).toHaveAttribute(
      "href",
      "/findings"
    );
  });

  it("still offers Start triage when the brief fails to load", async () => {
    vi.spyOn(api, "getBlueShiftBrief").mockRejectedValue(
      new Error("brief unavailable")
    );

    render(<BlueShiftBriefPanel />);

    expect(
      await screen.findByTestId("continuous-health-strip")
    ).toBeInTheDocument();
    const cta = await screen.findByTestId("shift-start-triage");
    expect(cta).toHaveAttribute("href", "/findings");
    expect(await screen.findByText("brief unavailable")).toBeInTheDocument();
  });
});
