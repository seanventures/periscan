import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("traps Tab within the dialog and closes on Escape", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Revoke key"
        description="This cannot be undone."
        confirmLabel="Revoke"
        destructive
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Revoke" });

    // Destructive non-phrase: initial focus on Cancel (safe default).
    await waitFor(() => expect(cancel).toHaveFocus());

    confirm.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(cancel).toHaveFocus();

    cancel.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(confirm).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("focuses the phrase input when confirmPhrase is set", async () => {
    render(
      <ConfirmDialog
        open
        title="Redact evidence"
        description="Type the evidence id."
        confirmLabel="Redact"
        destructive
        confirmPhrase="ev-123"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("textbox")).toHaveFocus();
    });
    expect(screen.getByRole("button", { name: "Redact" })).toBeDisabled();
  });

  it("does not cancel on Escape while busy", async () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Working"
        description="Hang tight."
        confirmLabel="Confirm"
        busy
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Working…" })).toBeDisabled();
    });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("gates enter animation with motion-safe for reduced-motion users", () => {
    const { container } = render(
      <ConfirmDialog
        open
        title="Confirm"
        description="Proceed?"
        confirmLabel="OK"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    const dialog = container.querySelector("[role='dialog']");
    const panel = dialog?.querySelector("div.relative");
    expect(panel?.className ?? "").toMatch(/motion-safe:animate-\[ps-modal/u);
  });

  it("focuses Confirm for non-destructive confirms", async () => {
    render(
      <ConfirmDialog
        open
        title="Resume mission"
        description="Continue the paused run."
        confirmLabel="Resume"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Resume" })).toHaveFocus();
    });
  });

  it("marks sibling chrome inert while open [P16-1]", async () => {
    render(
      <div>
        <main data-testid="page-chrome">
          <button type="button">Behind modal</button>
        </main>
        <ConfirmDialog
          open
          title="Revoke key"
          description="This cannot be undone."
          confirmLabel="Revoke"
          destructive
          onConfirm={vi.fn()}
          onCancel={vi.fn()}
        />
      </div>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });
    expect(screen.getByTestId("page-chrome")).toHaveAttribute("inert");
  });
});
