import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkipLink } from "./skip-link";

function Harness() {
  return (
    <>
      <SkipLink />
      <nav>
        <a href="/dashboard">Home</a>
      </nav>
      <main id="main-content" tabIndex={-1}>
        canvas
      </main>
    </>
  );
}

describe("skip-link keyboard path (WCAG 2.4.1)", () => {
  it("is a real in-page link to main", () => {
    render(<Harness />);
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(skip).toHaveAttribute("href", "#main-content");
    expect(skip).toHaveClass("skip-link");
  });

  it("Tab can land on the skip-link (first-hour bypass target)", () => {
    render(<Harness />);
    const skip = screen.getByRole("link", { name: "Skip to content" });
    skip.focus();
    expect(skip).toHaveFocus();
  });

  it("Enter / activation jumps keyboard focus to #main-content", () => {
    render(<Harness />);
    const skip = screen.getByRole("link", { name: "Skip to content" });
    const main = document.getElementById("main-content");
    expect(main).not.toBeNull();
    skip.focus();
    // Enter on a focused link dispatches click.
    fireEvent.click(skip);
    expect(document.activeElement).toBe(main);
  });
});
