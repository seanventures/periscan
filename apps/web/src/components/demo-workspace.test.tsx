import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPublicDemoValidationSnapshot } from "@periscan/shared";

import { DemoWorkspace } from "./demo-workspace";

describe("DemoWorkspace", () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("walks through the deterministic proof loop without customer actions", () => {
    render(<DemoWorkspace snapshot={createPublicDemoValidationSnapshot()} />);

    expect(screen.getByText("Demo mode")).toBeInTheDocument();
    expect(
      screen.getByText("Deterministic sample data · read-only tour")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Understand the sample" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/never create a session, change a tenant/u)
    ).toBeInTheDocument();
    const guide = within(
      screen.getByRole("navigation", { name: "Demo guide" })
    );

    fireEvent.click(guide.getByRole("button", { name: /Attack path/u }));
    const pathHeading = screen.getByRole("heading", {
      name: "Follow entry to impact"
    });
    expect(pathHeading).toBeInTheDocument();
    expect(pathHeading).toHaveFocus();
    expect(scrollIntoView).toHaveBeenLastCalledWith({
      behavior: "auto",
      block: "start"
    });
    expect(screen.getByText(/Evidence basis:/u)).toBeInTheDocument();

    fireEvent.click(guide.getByRole("button", { name: /Control proof/u }));
    expect(
      screen.getByRole("heading", {
        name: "Check what the control observed"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Missed observation")).toBeInTheDocument();

    fireEvent.click(guide.getByRole("button", { name: /Smallest fix/u }));
    expect(
      screen.getByRole("heading", { name: "Choose the path breaker" })
    ).toBeInTheDocument();

    fireEvent.click(guide.getByRole("button", { name: /Re-test/u }));
    expect(screen.getByText("Fresh evidence required")).toBeInTheDocument();
    expect(
      screen.getByText(/never pretends to execute it/u)
    ).toBeInTheDocument();

    fireEvent.click(guide.getByRole("button", { name: /Deliver proof/u }));
    expect(
      screen.getByRole("heading", { name: "Review the governed output" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /complete sample report/u })
    ).toHaveAttribute("href", "/demo#sample-report");
    expect(
      JSON.parse(localStorage.getItem("periscan.demo.guide.v1") ?? "[]")
    ).toEqual(["start", "path", "control", "fix", "verify", "report"]);
  });
});
