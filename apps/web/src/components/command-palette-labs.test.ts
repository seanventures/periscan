import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { paletteGroupWeight } from "../lib/primary-nav";
import { buildWeightedPaletteNavItems } from "./command-palette";

/**
 * P02-8 / UX-W10: Command palette must not index Labs destinations by default —
 * same guided escape hatch as the rail ("Show Labs & more"). Deep Labs routes
 * come from LABS_DESTINATIONS (portal list), not PRIMARY_NAV Labs peers.
 *
 * UX-W2 (19–20): weight/group results Operate → Setup → Admin → Labs last.
 */
describe("CommandPalette Labs filter (P02-8 / UX-W10)", () => {
  const source = readFileSync(
    path.join(__dirname, "command-palette.tsx"),
    "utf8"
  );

  it("gates Labs hrefs on showLabs / nav scope all", () => {
    expect(source).toMatch(/LABS_HREFS/);
    expect(source).toMatch(/NAV_SCOPE_KEY/);
    expect(source).toMatch(/showLabs/);
    expect(source).toMatch(/buildWeightedPaletteNavItems/);
    expect(source).toMatch(/LABS_DESTINATIONS/);
  });

  it("reads the same rail scope key as app-shell", () => {
    expect(source).toMatch(/periscan\.nav\.scope/);
  });

  it("indexes PRIMARY_NAV so Shift brief is always jumpable (R8)", () => {
    // Palette builds from PRIMARY_NAV groups (Labs-gated only). /shift is on
    // Operate, so SecurityEngineer and all personas can ⌘K to Blue shift.
    expect(source).toMatch(/PRIMARY_NAV/);
    expect(source).toMatch(/paletteGroupWeight|buildWeightedPaletteNavItems/);
  });
});

describe("Command palette weighting (UX-W2 / UX-W10)", () => {
  it("orders group weights Operate < Setup < Admin < Labs", () => {
    expect(paletteGroupWeight("Operate")).toBeLessThan(
      paletteGroupWeight("Setup")
    );
    expect(paletteGroupWeight("Setup")).toBeLessThan(
      paletteGroupWeight("Admin")
    );
    expect(paletteGroupWeight("Admin")).toBeLessThan(
      paletteGroupWeight("Labs")
    );
  });

  it("lists Operate before Setup and puts Labs last when revealed", () => {
    const items = buildWeightedPaletteNavItems({
      showLabs: true,
      query: ""
    });
    expect(items.length).toBeGreaterThan(10);
    const groups = items.map((i) => i.group);
    const firstOperate = groups.indexOf("Operate");
    const firstSetup = groups.indexOf("Setup");
    const firstAdmin = groups.indexOf("Admin");
    const firstLabs = groups.indexOf("Labs");
    expect(firstOperate).toBe(0);
    expect(firstSetup).toBeGreaterThan(firstOperate);
    expect(firstAdmin).toBeGreaterThan(firstSetup);
    expect(firstLabs).toBeGreaterThan(firstAdmin);
    expect(groups.filter((g) => g === "Labs").length).toBeGreaterThan(0);
    expect(groups.slice(firstLabs).every((g) => g === "Labs")).toBe(true);
  });

  it("indexes portal LABS_DESTINATIONS when showLabs so deep Labs stay jumpable", () => {
    const items = buildWeightedPaletteNavItems({
      showLabs: true,
      query: ""
    });
    expect(items.some((i) => i.href === "/labs")).toBe(true);
    expect(items.some((i) => i.href === "/workflows" && i.group === "Labs")).toBe(
      true
    );
    expect(items.some((i) => i.href === "/threat-center")).toBe(true);
    expect(items.some((i) => i.href === "/mcp")).toBe(true);
  });

  it("excludes Labs destinations when showLabs is false", () => {
    const items = buildWeightedPaletteNavItems({
      showLabs: false,
      query: ""
    });
    expect(items.every((i) => i.group !== "Labs")).toBe(true);
    expect(items.some((i) => i.href === "/threat-center")).toBe(false);
    expect(items.some((i) => i.href === "/workflows")).toBe(false);
    expect(items.some((i) => i.href === "/labs")).toBe(false);
    expect(items.some((i) => i.href === "/dashboard")).toBe(true);
  });

  it("filters by query while preserving weight order", () => {
    const items = buildWeightedPaletteNavItems({
      showLabs: true,
      query: "threat"
    });
    expect(items.some((i) => i.href === "/threat-center")).toBe(true);
    for (let i = 1; i < items.length; i++) {
      expect(paletteGroupWeight(items[i]!.group)).toBeGreaterThanOrEqual(
        paletteGroupWeight(items[i - 1]!.group)
      );
    }
  });
});
