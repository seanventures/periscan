import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  getFocusableElements,
  inertBackgroundSiblings,
  useFocusTrap
} from "./use-focus-trap";

function TrapHarness({
  onEscape,
  initialTarget = "first"
}: {
  onEscape?: () => void;
  initialTarget?: "first" | "second";
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const secondRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(true);

  useFocusTrap({
    open,
    containerRef,
    onEscape: onEscape ?? (() => setOpen(false)),
    initialFocusRef: initialTarget === "second" ? secondRef : undefined
  });

  if (!open) {
    return <p>Closed</p>;
  }

  return (
    <div>
      <button type="button">Outside</button>
      <div ref={containerRef} role="dialog" data-testid="trap">
        <button type="button">First</button>
        <button ref={secondRef} type="button">
          Second
        </button>
        <button type="button" disabled>
          Disabled
        </button>
        <a href="/next">Link</a>
      </div>
    </div>
  );
}

describe("getFocusableElements", () => {
  it("skips disabled controls and aria-hidden subtrees", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <button type="button">A</button>
      <button type="button" disabled>B</button>
      <div aria-hidden="true"><button type="button">C</button></div>
      <a href="/x">D</a>
      <input type="hidden" value="h" />
      <input type="text" value="e" />
    `;
    document.body.appendChild(root);

    const focusables = getFocusableElements(root);
    expect(focusables.map((el) => el.textContent || (el as HTMLInputElement).value)).toEqual([
      "A",
      "D",
      "e"
    ]);
    root.remove();
  });
});

describe("useFocusTrap", () => {
  it("focuses the first focusable on open", async () => {
    render(<TrapHarness />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    });
  });

  it("honors initialFocusRef when provided", async () => {
    render(<TrapHarness initialTarget="second" />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Second" })).toHaveFocus();
    });
  });

  it("cycles Tab forward and Shift+Tab backward inside the trap", async () => {
    render(<TrapHarness />);
    const first = screen.getByRole("button", { name: "First" });
    const second = screen.getByRole("button", { name: "Second" });
    const link = screen.getByRole("link", { name: "Link" });

    await waitFor(() => expect(first).toHaveFocus());

    fireEvent.keyDown(document, { key: "Tab" });
    // native Tab moves focus; simulate cycle at edges by focusing last then Tab
    link.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(first).toHaveFocus();

    first.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(link).toHaveFocus();

    second.focus();
    // mid-list Tab is left to the browser; trap only wraps edges
    fireEvent.keyDown(document, { key: "Tab" });
    expect(second).toHaveFocus();
  });

  it("calls onEscape on Escape", async () => {
    const onEscape = vi.fn();
    render(<TrapHarness onEscape={onEscape} />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
    });
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it("restores focus to the previously focused element on close", async () => {
    function RestoreCase() {
      const openerRef = useRef<HTMLButtonElement>(null);
      const containerRef = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(false);

      useFocusTrap({
        open,
        containerRef,
        onEscape: () => setOpen(false)
      });

      return (
        <div>
          <button
            ref={openerRef}
            type="button"
            onClick={() => {
              setOpen(true);
            }}
          >
            Open
          </button>
          {open ? (
            <div ref={containerRef} role="dialog">
              <button type="button">Inside</button>
            </div>
          ) : null}
        </div>
      );
    }

    render(<RestoreCase />);
    const opener = screen.getByRole("button", { name: "Open" });
    opener.focus();
    expect(opener).toHaveFocus();
    fireEvent.click(opener);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(opener).toHaveFocus();
  });

  it("marks background siblings inert while open and restores on close [P16-1]", async () => {
    function InertCase() {
      const containerRef = useRef<HTMLDivElement>(null);
      const [open, setOpen] = useState(true);

      useFocusTrap({
        open,
        containerRef,
        onEscape: () => setOpen(false)
      });

      return (
        <div data-testid="shell">
          <main data-testid="main-chrome">
            <button type="button">Rail link</button>
          </main>
          {open ? (
            <div ref={containerRef} role="dialog" data-testid="modal">
              <button type="button">Inside</button>
            </div>
          ) : null}
        </div>
      );
    }

    const { unmount } = render(<InertCase />);
    const chrome = screen.getByTestId("main-chrome");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Inside" })).toHaveFocus();
    });
    expect(chrome).toHaveAttribute("inert");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(chrome).not.toHaveAttribute("inert");
    unmount();
  });
});

describe("inertBackgroundSiblings", () => {
  it("inerts only siblings of the active root path and restores cleanly", () => {
    const shell = document.createElement("div");
    const rail = document.createElement("aside");
    rail.setAttribute("data-testid", "rail");
    const content = document.createElement("div");
    content.setAttribute("data-testid", "content");
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    shell.append(rail, content, dialog);
    document.body.appendChild(shell);

    const release = inertBackgroundSiblings(dialog);
    expect(rail.hasAttribute("inert")).toBe(true);
    expect(content.hasAttribute("inert")).toBe(true);
    expect(dialog.hasAttribute("inert")).toBe(false);

    release();
    expect(rail.hasAttribute("inert")).toBe(false);
    expect(content.hasAttribute("inert")).toBe(false);
    shell.remove();
  });
});
