"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

/** Marker so cleanup only clears inert we applied (P16-1). */
const INERT_MARK = "data-periscan-modal-inert";

function isVisible(el: HTMLElement): boolean {
  if (el.closest("[aria-hidden='true']")) return false;
  if (el.closest("[inert]")) return false;
  // Prefer computed style over offsetParent — jsdom (and fixed/sticky layout)
  // often report offsetParent as null for visible elements.
  const style = window.getComputedStyle(el);
  if (style.visibility === "hidden" || style.display === "none") return false;
  return true;
}

/** Focusable, visible descendants of `container` in document order. */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(isVisible);
}

/**
 * Mark every sibling along the dialog's ancestor chain as `inert` so pointer,
 * keyboard, and AT browse mode cannot reach content behind a modal (P16-1).
 * Restores only nodes this call marked (safe with nested / stacked dialogs).
 */
export function inertBackgroundSiblings(activeRoot: HTMLElement): () => void {
  const marked: HTMLElement[] = [];
  let node: HTMLElement | null = activeRoot;

  while (node && node !== document.body) {
    const parentEl: HTMLElement | null = node.parentElement;
    if (!parentEl || parentEl === document.documentElement) break;

    for (const child of Array.from(parentEl.children)) {
      if (child === node || !(child instanceof HTMLElement)) continue;
      // Leave pre-existing inert alone; only track nodes we set.
      if (child.hasAttribute("inert") || child.inert) continue;
      child.setAttribute("inert", "");
      child.inert = true;
      child.setAttribute(INERT_MARK, "");
      marked.push(child);
    }

    node = parentEl === document.body ? null : parentEl;
  }

  return () => {
    for (const el of marked) {
      if (!el.hasAttribute(INERT_MARK)) continue;
      el.removeAttribute(INERT_MARK);
      el.removeAttribute("inert");
      el.inert = false;
    }
  };
}

export interface UseFocusTrapOptions {
  open: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** Escape while the trap is active. Omit to leave Escape unhandled. */
  onEscape?: () => void;
  /** Prefer this element for initial focus when the trap activates. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Restore focus to the previously focused element on deactivate. Default true. */
  restoreFocus?: boolean;
  /**
   * When true (default), set `inert` on sibling content outside the dialog
   * while open so AT cannot browse under the modal (P16-1 residual).
   */
  inertBackground?: boolean;
}

/**
 * Basic modal focus management for dialogs and drawers:
 * - focuses the preferred (or first) focusable on open
 * - cycles Tab / Shift+Tab inside the container
 * - Escape invokes `onEscape`
 * - restores focus to the opener on close
 * - marks background siblings `inert` while open (P16-1)
 */
export function useFocusTrap({
  open,
  containerRef,
  onEscape,
  initialFocusRef,
  restoreFocus = true,
  inertBackground = true
}: UseFocusTrapOptions): void {
  useEffect(() => {
    if (!open) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const releaseInert = inertBackground
      ? inertBackgroundSiblings(container)
      : () => undefined;

    const focusTimer = window.setTimeout(() => {
      const root = containerRef.current;
      if (!root) return;
      const preferred = initialFocusRef?.current;
      if (preferred && root.contains(preferred) && isVisible(preferred)) {
        preferred.focus();
        return;
      }
      getFocusableElements(root)[0]?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!onEscape) return;
        event.preventDefault();
        onEscape();
        return;
      }

      if (event.key !== "Tab") return;

      const root = containerRef.current;
      if (!root) return;

      const focusables = getFocusableElements(root);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !root.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      releaseInert();
      if (
        restoreFocus &&
        previouslyFocused &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus();
      }
    };
  }, [
    open,
    containerRef,
    onEscape,
    initialFocusRef,
    restoreFocus,
    inertBackground
  ]);
}
