import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(path.join(__dirname, "../../app/globals.css"), "utf8");
const layout = readFileSync(
  path.join(__dirname, "../../app/layout.tsx"),
  "utf8"
);
const skipLink = readFileSync(
  path.join(__dirname, "../components/skip-link.tsx"),
  "utf8"
);
const appShell = readFileSync(
  path.join(__dirname, "../components/app-shell.tsx"),
  "utf8"
);

describe("skip-link (first-hour a11y)", () => {
  it("is in the root layout and targets #main-content", () => {
    expect(layout).toMatch(/<SkipLink\s*\/>/);
    expect(skipLink).toMatch(/className="skip-link"/);
    expect(skipLink).toMatch(/href="#main-content"/);
    expect(skipLink).toMatch(/Skip to content/);
  });

  it("stays clipped off-canvas until keyboard focus", () => {
    const atRest = css.match(/^\.skip-link \{[^}]+\}/mu)?.[0] ?? "";
    expect(atRest).toMatch(/position:\s*absolute/);
    expect(atRest).toMatch(/width:\s*1px/);
    expect(atRest).toMatch(/height:\s*1px/);
    expect(atRest).toMatch(/clip-path:\s*inset\(50%\)/);
    expect(atRest).not.toMatch(/position:\s*static/);
  });

  it("re-enters layout on :focus without the 554 fixed overlay", () => {
    // Keyboard-first: still clipped at rest. :focus (and :focus-visible)
    // paints an in-flow banner. Do not restore position:fixed + translateY(0)
    // over the rail wordmark (PERISCAN-554).
    expect(css).not.toMatch(/\.skip-link:focus,/);
    const atRest = css.match(/^\.skip-link \{[^}]+\}/mu)?.[0] ?? "";
    expect(atRest).not.toMatch(/position:\s*fixed/);
    expect(css).not.toMatch(/translateY\(-150%\)/);
    const onFocus = css.match(/\.skip-link:focus \{[^}]+\}/u)?.[0] ?? "";
    expect(onFocus).toMatch(/position:\s*static/);
    expect(onFocus).toMatch(/clip-path:\s*none/);
    expect(onFocus).not.toMatch(/position:\s*fixed/);
    expect(onFocus).not.toMatch(/translateY/);
    const onFocusVisible =
      css.match(/\.skip-link:focus-visible \{[^}]+\}/u)?.[0] ?? "";
    expect(onFocusVisible).toMatch(/position:\s*static/);
    expect(onFocusVisible).toMatch(/clip-path:\s*none/);
  });

  it("paints scripted :focus in-flow so mouse-then-focus is not a clipped miss", () => {
    // Chromium after a pointer click matches :focus, not :focus-visible.
    // Reveal on :focus so programmatic focus paints; keep the keyboard
    // :focus-visible rule. Never the combined overlay selector.
    expect(css).toMatch(/\.skip-link:focus \{/);
    expect(css).toMatch(/\.skip-link:focus-visible \{/);
    expect(css).not.toMatch(/\.skip-link:focus,/);
  });

  it("lands on a keyboard-focusable main so Enter can move AT focus", () => {
    expect(appShell).toMatch(
      /<main\s+id="main-content"\s+tabIndex=\{-1\}/
    );
  });
});

