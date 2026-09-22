import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { OPERATE_SCREEN_JOBS } from "./operate-screen-jobs";
import { PRIMARY_NAV } from "./primary-nav";

describe("security-feeds operator page", () => {
  const page = readFileSync(
    path.join(__dirname, "../../app/security-feeds/page.tsx"),
    "utf8"
  );
  const home = readFileSync(
    path.join(__dirname, "../components/get-started.tsx"),
    "utf8"
  );
  const dashboard = readFileSync(
    path.join(__dirname, "../components/dashboard-command-center.tsx"),
    "utf8"
  );
  const shell = readFileSync(
    path.join(__dirname, "../components/app-shell.tsx"),
    "utf8"
  );

  it("mounts the pin-review workbench on /security-feeds", () => {
    expect(page).toMatch(/SecurityFeedPinReview/);
    expect(page).toMatch(/from ["'].*security-feed-pin-review["']/);
    expect(page).toMatch(/title:\s*["'].*Feed pins/i);
    expect(page).not.toMatch(/liveSupported:\s*true/);
    expect(page).not.toMatch(/LIVE_OFFENSIVE/);
    expect(page).not.toMatch(/eval\(/);
  });

  it("stays off Home, Operate spine, and Gitleaks first-hour", () => {
    const operate = PRIMARY_NAV.find((group) => group.label === "Operate")!;
    expect(operate.items.map((item) => item.href)).not.toContain(
      "/security-feeds"
    );
    expect(OPERATE_SCREEN_JOBS.map((row) => row.href)).not.toContain(
      "/security-feeds"
    );
    expect(home).not.toMatch(/security-feeds/);
    expect(dashboard).not.toMatch(/security-feeds/);
    expect(shell).toMatch(
      /const OPERATING_DEFAULT_NAV = new Set\(\[([\s\S]*?)\]\);/
    );
    const operatingBody =
      shell.match(
        /const OPERATING_DEFAULT_NAV = new Set\(\[([\s\S]*?)\]\);/
      )?.[1] ?? "";
    expect(operatingBody).not.toMatch(/"\/security-feeds"/);
  });

  it("indexes Feed pins on collapsed Setup (mobile More), not High-danger Home", () => {
    const setup = PRIMARY_NAV.find((group) => group.label === "Setup")!;
    expect(setup.items.find((item) => item.href === "/security-feeds")).toEqual(
      expect.objectContaining({
        href: "/security-feeds",
        label: "Feed pins"
      })
    );
    expect(setup.defaultOpen).toBe(false);
    expect(page).not.toMatch(/High-danger/i);
    expect(page).not.toMatch(/T1486/);
    const hidden =
      shell.match(
        /const OPERATING_SETUP_HIDDEN = new Set\(\[([\s\S]*?)\]\);/
      )?.[1] ?? "";
    expect(hidden).toMatch(/"\/security-feeds"/);
  });
});
