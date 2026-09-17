import { describe, expect, it } from "vitest";

import {
  isEditableKeyboardTarget,
  KEYBOARD_SHORTCUTS
} from "./keyboard-map";

describe("KEYBOARD_SHORTCUTS", () => {
  it("documents palette, help, and escape", () => {
    const joined = KEYBOARD_SHORTCUTS.map(
      (row) => `${row.keys} ${row.action}`
    ).join(" ");
    expect(joined).toMatch(/⌘K|Ctrl\+K/u);
    expect(joined).toContain("?");
    expect(joined).toMatch(/Escape/iu);
  });
});

describe("isEditableKeyboardTarget", () => {
  it("treats inputs and contenteditable as editable", () => {
    const input = document.createElement("input");
    const area = document.createElement("textarea");
    const select = document.createElement("select");
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "true");
    const plain = document.createElement("button");

    expect(isEditableKeyboardTarget(input)).toBe(true);
    expect(isEditableKeyboardTarget(area)).toBe(true);
    expect(isEditableKeyboardTarget(select)).toBe(true);
    expect(isEditableKeyboardTarget(div)).toBe(true);
    expect(isEditableKeyboardTarget(plain)).toBe(false);
    expect(isEditableKeyboardTarget(null)).toBe(false);
  });
});
