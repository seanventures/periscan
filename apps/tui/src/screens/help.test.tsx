import { cleanup, render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";

import { HelpScreen } from "./help.js";

const ANSI_STYLE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "gu");

function stripAnsi(value: string): string {
  return value.replace(ANSI_STYLE, "");
}

function renderHelp(): string {
  const { lastFrame } = render(<HelpScreen />);
  return stripAnsi(lastFrame() ?? "");
}

describe("HelpScreen", () => {
  afterEach(() => {
    cleanup();
  });

  it("documents the full keyboard map (q, ?, 1–9 screens)", () => {
    const frame = renderHelp();

    expect(frame).toMatch(/q\s+quit/iu);
    expect(frame).toMatch(/\?\s+this help/iu);
    expect(frame).toMatch(/1\s+home/iu);
    expect(frame).toMatch(/2\s+auth/iu);
    expect(frame).toMatch(/3\s+scopes/iu);
    expect(frame).toMatch(/4\s+run/iu);
    expect(frame).toMatch(/5\s+missions/iu);
    expect(frame).toMatch(/6\s+findings/iu);
    expect(frame).toMatch(/7\s+fix/iu);
    expect(frame).toMatch(/8\s+engines/iu);
    expect(frame).toMatch(/9\s+health/iu);
  });

  it("names the Community proof loop without Connect-first", () => {
    const frame = renderHelp();

    expect(frame).toMatch(/proof loop/iu);
    expect(frame).toMatch(
      /Authorize.+Run.+Evidence.+Fixed-only-via-verify/su
    );
    expect(frame).not.toMatch(/Connect\s*→\s*Authorize/u);
    expect(frame).not.toMatch(
      /Connect.+Authorize.+Validate.+Understand.+Act.+Verify.+Prove/su
    );
    expect(frame).not.toMatch(/Scope\s*→\s*Discover\s*→\s*Prioritize/u);
  });

  it("states SETTLED safety without refuse-catalog claims", () => {
    const frame = renderHelp();

    expect(frame).toMatch(/SETTLED/u);
    expect(frame).toMatch(/BAS adapters/u);
    expect(frame).toMatch(/policy approval/u);
    expect(frame).toMatch(/verified cleanup/u);
    expect(frame).toMatch(/qualified scenarios/iu);
    expect(frame).toMatch(/authorized scope/iu);
    expect(frame).toMatch(/Fixed/u);
    expect(frame).toMatch(/verif/iu);
    expect(frame).toMatch(/never queued/iu);
    expect(frame).toMatch(/weakest-hop/iu);
    expect(frame).not.toMatch(/full multi-vector BAS platform/iu);
    expect(frame).not.toMatch(/We make you DORA/u);
  });

  it("states the Apache-2.0 product license", () => {
    const frame = renderHelp();

    expect(frame).toMatch(/Apache-2\.0/u);
  });

  it("documents PERISCAN_API_URL", () => {
    const frame = renderHelp();

    expect(frame).toContain("PERISCAN_API_URL");
    expect(frame).toContain("http://127.0.0.1:3001");
  });

  it("documents g pin and keeps nav at 1–9 + ? + q", () => {
    const frame = renderHelp();

    expect(frame).toContain("gitleaks.repo_secrets");
    expect(frame).toMatch(/\bg\b.*pin/iu);
    expect(frame).toMatch(/run --scope/i);
    expect(frame).toMatch(/1\s+home/iu);
    expect(frame).toMatch(/9\s+health/iu);
    expect(frame).toMatch(/q\s+quit/iu);
    expect(frame).toMatch(/\?\s+this help/iu);
    expect(frame).not.toMatch(/CTEM/u);
    expect(frame).not.toMatch(/Mark Fixed/iu);
  });

  it("documents b BAS without replacing 1–9, ?, q, or g pin", () => {
    const frame = renderHelp();

    expect(frame).toMatch(/\bb\s+bas\b/iu);
    expect(frame).toMatch(/1\s+home/iu);
    expect(frame).toMatch(/9\s+health/iu);
    expect(frame).toMatch(/q\s+quit/iu);
    expect(frame).toMatch(/\?\s+this help/iu);
    expect(frame).toContain("gitleaks.repo_secrets");
    expect(frame).toMatch(/\bg\b.*pin/iu);
  });
});
