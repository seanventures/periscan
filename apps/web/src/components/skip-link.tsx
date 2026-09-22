"use client";

import type { MouseEvent } from "react";

/**
 * First-hour bypass (WCAG 2.4.1). Paint is CSS `:focus` (in-flow banner)
 * plus `:focus-visible` (keyboard). Do not restore the PERISCAN-554
 * fixed overlay over the rail wordmark.
 */
export function SkipLink() {
  function onActivate(event: MouseEvent<HTMLAnchorElement>) {
    const main = document.getElementById("main-content");
    if (!(main instanceof HTMLElement)) {
      return;
    }
    // Hash navigation does not reliably move keyboard focus (jsdom, some
    // browsers, Next client routing). Enter still dispatches click.
    event.preventDefault();
    main.focus();
  }

  return (
    <a className="skip-link" href="#main-content" onClick={onActivate}>
      Skip to content
    </a>
  );
}
