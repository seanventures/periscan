/**
 * In-product keyboard map (UX-W3 / P16-17).
 * Shown in Help (?). Keep labels operator-facing; no key chords invent powers.
 */
export interface KeyboardShortcut {
  keys: string;
  action: string;
}

export const KEYBOARD_SHORTCUTS: readonly KeyboardShortcut[] = [
  { keys: "⌘K / Ctrl+K", action: "Open command palette (jump to a page)" },
  { keys: "?", action: "Open this help drawer (when not typing in a field)" },
  { keys: "Escape", action: "Close palette, help, dialogs, and mobile nav" },
  { keys: "Tab / Shift+Tab", action: "Move focus within open dialogs (trapped)" },
  { keys: "Skip link", action: "Jump past chrome to main content (first Tab)" }
] as const;

/** True when the event target is an editable field — do not steal ? / other chords. */
export function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  // isContentEditable can be false in jsdom until attached; also read the attr.
  if (target.isContentEditable) return true;
  const attr = target.getAttribute("contenteditable");
  if (attr === "true" || attr === "") return true;
  return Boolean(
    target.closest("[contenteditable='true'], [contenteditable='']")
  );
}
