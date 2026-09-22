import React from "react";
import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TuiApp } from "./app.js";

afterEach(() => {
  cleanup();
});

const ANSI_COLOR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function visible(frame: string | undefined): string {
  return (frame ?? "").replace(ANSI_COLOR, "");
}

function renderChrome(apiUrl = "http://127.0.0.1:3001"): string {
  const { lastFrame, unmount } = render(<TuiApp apiUrl={apiUrl} />);
  const frame = lastFrame() ?? "";
  unmount();
  return frame;
}

async function frameHas(
  instance: ReturnType<typeof render>,
  needle: string | RegExp
): Promise<string> {
  return vi.waitFor(() => {
    const frame = visible(instance.lastFrame());
    if (typeof needle === "string") {
      expect(frame).toContain(needle);
    } else {
      expect(frame).toMatch(needle);
    }
    return frame;
  });
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

  it("leaves auth with Esc so 1–9 can reach scopes after login", async () => {
    const instance = render(<TuiApp apiUrl="http://127.0.0.1:3001" />);
    await frameHas(instance, "[1:home]");
    await new Promise((resolve) => setTimeout(resolve, 50));
    instance.stdin.write("2");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await frameHas(instance, "[2:auth]");
    instance.stdin.write("\x1B");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await frameHas(instance, "[1:home]");
    instance.unmount();
  });

  it("does not trap 1–9 on run — validate has no text field", async () => {
    const instance = render(<TuiApp apiUrl="http://127.0.0.1:3001" />);
    await frameHas(instance, "[1:home]");
    await new Promise((resolve) => setTimeout(resolve, 50));
    instance.stdin.write("4");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await frameHas(instance, "[4:run]");
    instance.stdin.write("6");
    await new Promise((resolve) => setTimeout(resolve, 50));
    await frameHas(instance, "[6:findings]");
    instance.unmount();
  });

  it("opens BAS with b and keeps 1–9 + ? + q; High-danger stays off Home", async () => {
    const instance = render(<TuiApp apiUrl="http://127.0.0.1:3001" />);
    const home = await frameHas(instance, "[1:home]");
    expect(home).not.toMatch(/High-danger|High danger/iu);
    expect(home).toContain("1:home");
    expect(home).toContain("9:health");
    expect(home).toMatch(/1–9/u);

    await new Promise((resolve) => setTimeout(resolve, 50));
    instance.stdin.write("b");
    const bas = await frameHas(instance, /High danger/i);
    expect(bas).toContain("1:home");
    expect(bas).toContain("9:health");
    expect(bas).toMatch(/liveSupported false/i);
    instance.unmount();
  });
});
