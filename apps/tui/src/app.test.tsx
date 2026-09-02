import React from "react";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { TuiApp } from "./app.js";

afterEach(() => {
  cleanup();
});

function renderChrome(apiUrl = "http://127.0.0.1:3001"): string {
  const { lastFrame, unmount } = render(<TuiApp apiUrl={apiUrl} />);
  const frame = lastFrame() ?? "";
  unmount();
  return frame;
}

describe("TuiApp chrome", () => {
  it("renders PERISCAN", () => {
    expect(renderChrome()).toContain("PERISCAN");
  });

  it("documents q to quit", () => {
    expect(renderChrome()).toMatch(/q\s+quit/iu);
  });

  it("lists number keys for screens", () => {
    const frame = renderChrome();
    expect(frame).toContain("1:home");
    expect(frame).toContain("2:auth");
    expect(frame).toContain("3:scopes");
    expect(frame).toContain("4:run");
    expect(frame).toContain("5:missions");
    expect(frame).toContain("6:findings");
    expect(frame).toContain("7:fix");
    expect(frame).toContain("8:engines");
    expect(frame).toContain("9:health");
    expect(frame).toContain("1–9");
  });
});
