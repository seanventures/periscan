import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HealthStatusCard } from "./health-status-card";

describe("HealthStatusCard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders API health details returned from the proxy route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          service: "api",
          status: "ok",
          timestamp: "2026-06-01T00:00:00.000Z"
        })
      })
    );

    render(<HealthStatusCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "API health status: Connected"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("2026-06-01T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByLabelText("API health details")).toHaveClass(
      "grid-cols-1",
      "sm:grid-cols-3"
    );
  });

  it("shows an alert and retries when API health fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({
          message: "Upstream health unavailable"
        }),
        ok: false,
        status: 503
      })
      .mockResolvedValueOnce({
        json: async () => ({
          service: "api",
          status: "ok",
          timestamp: "2026-06-01T00:05:00.000Z"
        }),
        ok: true,
        status: 200
      });

    vi.stubGlobal("fetch", fetchImpl);

    render(<HealthStatusCard />);

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "API health status: Unavailable"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Health check failed (503)"
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry API health" }));

    await waitFor(() => {
      expect(
        screen.getByRole("status", {
          name: "API health status: Connected"
        })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("2026-06-01T00:05:00.000Z")).toBeInTheDocument();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
