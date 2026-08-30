import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DegradedBanner } from "./degraded-banner";

describe("DegradedBanner (P07-22)", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders nothing when no rails failed", () => {
    const { container } = render(<DegradedBanner rails={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names failed rails and supports retry", () => {
    const onRetry = vi.fn();
    render(
      <DegradedBanner
        rails={["Findings", "Attack paths"]}
        onRetry={onRetry}
        lastUpdatedAt="2026-07-29T12:00:00.000Z"
      />
    );
    expect(screen.getByTestId("degraded-banner")).toBeInTheDocument();
    expect(screen.getByText(/Findings, Attack paths/)).toBeInTheDocument();
    expect(screen.getByText(/Partial load/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry failed loads/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
