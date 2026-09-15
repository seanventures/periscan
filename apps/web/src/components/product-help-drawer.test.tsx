import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProductHelpDrawer } from "./product-help-drawer";

describe("ProductHelpDrawer", () => {
  it("shows route-aware, operational help for a validation", () => {
    render(<ProductHelpDrawer open pathname="/missions" onClose={vi.fn()} />);

    expect(
      screen.getByRole("dialog", { name: "Run an authorized validation" })
    ).toBeVisible();
    expect(screen.getByText("Add and verify scope")).toBeVisible();
    expect(
      screen.getByText("Preview policy decision", { exact: false })
    ).toBeVisible();
    expect(screen.getByText("Scope ceiling")).toBeVisible();
    expect(screen.getByText("Guardrail")).toBeVisible();
    // P02-1 / GA-4: one first-run — Home GetStarted only.
    expect(
      screen.getByRole("link", { name: /Get started on Home/u })
    ).toHaveAttribute("href", "/dashboard");
    expect(
      screen.queryByRole("link", { name: /Full activation guide/u })
    ).not.toBeInTheDocument();
  });

  it("documents keyboard map including ⌘K, ?, and Escape (UX-W3)", () => {
    render(<ProductHelpDrawer open pathname="/findings" onClose={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Keyboard" })
    ).toBeVisible();
    expect(screen.getByText(/⌘K \/ Ctrl\+K/u)).toBeVisible();
    expect(
      screen.getByText("Open this help drawer (when not typing in a field)")
    ).toBeVisible();
    expect(
      screen.getByText("Close palette, help, dialogs, and mobile nav")
    ).toBeVisible();
    expect(screen.getByText(/respect reduced motion/iu)).toBeVisible();
  });

  it("gates drawer enter animation with motion-safe (prefers-reduced-motion)", () => {
    render(<ProductHelpDrawer open pathname="/missions" onClose={vi.fn()} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.className).toMatch(/motion-safe:animate-\[help-enter/u);
  });

  it("closes from Escape and from a destination link", async () => {
    const onClose = vi.fn();
    render(<ProductHelpDrawer open pathname="/findings" onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close help" })).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("link", { name: /Open remediation/i }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("cycles Tab within the drawer and skips the backdrop", async () => {
    render(<ProductHelpDrawer open pathname="/missions" onClose={vi.fn()} />);

    const close = screen.getByRole("button", { name: "Close help" });
    await waitFor(() => expect(close).toHaveFocus());

    // Backdrop is a non-focusable div (P16-1) — no second "Close product help" tab stop.
    expect(
      screen.queryByRole("button", { name: "Close product help" })
    ).not.toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const focusables = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [tabindex]:not([tabindex='-1']), summary"
      )
    );
    const last = focusables[focusables.length - 1]!;
    last.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("inerts sibling chrome while open and closes from non-focusable backdrop [P16-1]", async () => {
    const onClose = vi.fn();
    render(
      <div>
        <main data-testid="shell-chrome">
          <button type="button">Behind help</button>
        </main>
        <ProductHelpDrawer open pathname="/missions" onClose={onClose} />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Close help" })).toHaveFocus();
    });
    expect(screen.getByTestId("shell-chrome")).toHaveAttribute("inert");

    // Click the full-screen backdrop (aria-hidden, not a button).
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement;
    expect(overlay).toBeTruthy();
    const backdrop = overlay!.querySelector("[aria-hidden]") as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not mount hidden help into the accessibility tree", () => {
    render(
      <ProductHelpDrawer open={false} pathname="/reports" onClose={vi.fn()} />
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("explains variable comparison, recorder integrity, and fork-only replay", () => {
    render(<ProductHelpDrawer open pathname="/workflows" onClose={vi.fn()} />);

    expect(
      screen.getByRole("dialog", {
        name: "Verify workflow history and deployment trust"
      })
    ).toBeVisible();
    expect(screen.getByText("Verify recorder integrity")).toBeVisible();
    expect(screen.getByText("Choose two moments")).toBeVisible();
    expect(screen.getByText("Inspect the exact delta")).toBeVisible();
    expect(screen.getByText("Official TCK proof")).toBeVisible();
    expect(screen.getByText("Qualify with fresh TEE evidence")).toBeVisible();
    expect(screen.getByText("Respond and escalate")).toBeVisible();
    expect(screen.getByText("Qualification receipt")).toBeVisible();
    expect(screen.getByText("Veraison session")).toBeVisible();
    expect(screen.getByText("Checkpoint fork")).toBeVisible();
    expect(
      screen.getByText("denies checkpoint reuse", { exact: false })
    ).toBeVisible();
  });

  it("explains signed intervention decisions and retained pre-turn limits", () => {
    render(
      <ProductHelpDrawer open pathname="/model-gateway" onClose={vi.fn()} />
    );

    expect(
      screen.getByRole("dialog", {
        name: "Resolve a paused model action safely"
      })
    ).toBeVisible();
    expect(screen.getByText("Open Interventions")).toBeVisible();
    expect(screen.getByText("Verify the envelope")).toBeVisible();
    expect(screen.getByText("Resume or cancel once")).toBeVisible();
    expect(screen.getByText("Pre-turn fallback")).toBeVisible();
    expect(
      screen.getByText("plain message has no authority", { exact: false })
    ).toBeVisible();
  });

  it("explains bounded scenario cycles and fresh branch evidence", () => {
    render(
      <ProductHelpDrawer open pathname="/engagements" onClose={vi.fn()} />
    );

    expect(
      screen.getByRole("dialog", {
        name: "Operate a bounded evidence feedback loop"
      })
    ).toBeVisible();
    expect(screen.getByText("Review the signed graph")).toBeVisible();
    expect(screen.getByText("Record the next decision")).toBeVisible();
    expect(screen.getByText("Inspect fresh branch evidence")).toBeVisible();
    expect(screen.getByText("Signed cycle budget")).toBeVisible();
    expect(
      screen.getByText("not self-modifying autonomy", { exact: false })
    ).toBeVisible();
  });

  it("explains ownership, endpoint receipts, and measured path fusion", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <ProductHelpDrawer open pathname="/data-fabric" onClose={onClose} />
    );

    expect(screen.getByText("Review the ownership boundary")).toBeVisible();
    expect(screen.getByText("Ownership confidence")).toBeVisible();

    rerender(<ProductHelpDrawer open pathname="/runners" onClose={onClose} />);
    expect(
      screen.getByRole("dialog", {
        name: "Operate the runner fleet"
      })
    ).toBeVisible();
    expect(screen.getByText("Read liveness as a receipt")).toBeVisible();
    expect(screen.getByText("Heartbeat receipt")).toBeVisible();

    rerender(
      <ProductHelpDrawer open pathname="/attack-paths" onClose={onClose} />
    );
    expect(
      screen.getByText("Inspect proof fusion and hop plan")
    ).toBeVisible();
    expect(
      screen.getByText("not cluster-breakout or exploitability proof", {
        exact: false
      })
    ).toBeVisible();
  });
});
