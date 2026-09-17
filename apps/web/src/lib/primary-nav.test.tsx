import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { LABS_DESTINATION_HREFS, LABS_DESTINATIONS } from "./labs-portal";
import {
  PRIMARY_NAV,
  PRIMARY_NAV_ITEMS,
  isNavItemActive,
  paletteGroupWeight
} from "./primary-nav";

describe("PRIMARY_NAV (Proof OS / UX-W10 Labs portal-only)", () => {
  it("keeps Operate rail on JOBS-SIMPLE spine (Home · Scope · Validate · Findings · Remediate · Evidence)", () => {
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate");
    expect(operate).toBeDefined();
    expect(operate!.defaultOpen).toBe(true);
    // JOBS-SIMPLE: Operate is the product. Competing daily peers (Shift,
    // Connect, Paths, Executive, Reports) live on collapsed Setup — Connect
    // is not a peer of Scope; the rail CTA is resolveFirstRunPrimaryAction.
    expect(operate!.items.map((i) => i.label)).toEqual([
      "Home",
      "Scope",
      "Validate",
      "Findings",
      "Remediate",
      "Evidence"
    ]);
    expect(operate!.items.map((i) => i.href)).toEqual([
      "/dashboard",
      "/scopes",
      "/missions",
      "/findings",
      "/remediation",
      "/evidence"
    ]);
    expect(operate!.items.length).toBe(6);
    expect(operate!.items.length).toBeLessThanOrEqual(10);
    const hrefs = operate!.items.map((i) => i.href);
    expect(hrefs).not.toContain("/schedules");
    expect(hrefs).not.toContain("/integrations");
    expect(hrefs).not.toContain("/shift");
    expect(hrefs).not.toContain("/attack-paths");
    expect(hrefs).not.toContain("/executive");
    expect(hrefs).not.toContain("/reports");
    expect(hrefs).not.toContain("/mssp");
    expect(hrefs).not.toContain("/labs");
    expect(hrefs).not.toContain("/admin");
  });

  it("keeps Setup/Labs/Admin collapsed by default (Operate only defaultOpen)", () => {
    for (const group of PRIMARY_NAV) {
      if (group.label === "Operate") {
        expect(group.defaultOpen).toBe(true);
      } else {
        expect(group.defaultOpen ?? false).toBe(false);
      }
    }
  });

  it("keeps Schedule on Setup (not Operate) for Proof OS rail slim", () => {
    const setup = PRIMARY_NAV.find((g) => g.label === "Setup")!;
    expect(setup.items.map((i) => i.href)).toEqual(
      expect.arrayContaining(["/schedules"])
    );
    expect(setup.items.find((i) => i.href === "/schedules")?.label).toBe(
      "Schedule"
    );
  });

  it("indexes Shift brief on Setup (not Operate) so Home is the only morning door", () => {
    expect(PRIMARY_NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/shift",
          label: "Shift brief"
        })
      ])
    );
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate")!;
    const setup = PRIMARY_NAV.find((g) => g.label === "Setup")!;
    expect(operate.items.find((i) => i.href === "/shift")).toBeUndefined();
    expect(operate.items.findIndex((i) => i.href === "/dashboard")).toBe(0);
    expect(setup.items.find((i) => i.href === "/shift")?.label).toBe(
      "Shift brief"
    );
  });

  it("forbids Engines / Autonomous surfaces on Operate (P07-1 spine law)", () => {
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate")!;
    const operateHrefs = new Set(operate.items.map((i) => i.href));
    for (const href of [
      "/engines",
      "/schedules",
      "/swarm",
      "/workflows",
      "/operators",
      "/engagements",
      "/mcp",
      "/model-gateway",
      "/labs"
    ]) {
      expect(operateHrefs.has(href)).toBe(false);
    }
    const setup = PRIMARY_NAV.find((g) => g.label === "Setup")!;
    expect(setup.items.map((i) => i.href)).toEqual(
      expect.arrayContaining(["/engines", "/runners", "/assets", "/schedules"])
    );
  });

  it("keeps full Setup catalog for palette / Show Labs (UX-W15 shell collapses Operating)", () => {
    // PRIMARY_NAV remains the full catalog; app-shell allow-lists collapse
    // Operating Setup to Runners · Engines (+ Schedule for engineer daily).
    // JOBS-SIMPLE: Connect is Setup (not a Scope peer). Evidence is Operate.
    const setup = PRIMARY_NAV.find((g) => g.label === "Setup")!;
    const hrefs = setup.items.map((i) => i.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/getting-started",
        "/integrations",
        "/runners",
        "/engines",
        "/schedules",
        "/assets",
        "/external-validation",
        "/controls",
        "/compliance",
        "/shift",
        "/attack-paths",
        "/executive",
        "/reports"
      ])
    );
    expect(hrefs).not.toContain("/evidence");
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate")!;
    const operateHrefs = operate.items.map((i) => i.href);
    expect(operateHrefs).toEqual(
      expect.arrayContaining(["/scopes", "/evidence"])
    );
    expect(operateHrefs).not.toContain("/integrations");
    expect(operateHrefs).not.toContain("/schedules");
    expect(operateHrefs).not.toContain("/executive");
  });

  it("demotes Executive / Reports / Connect / Paths off Operate (JOBS-SIMPLE)", () => {
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate")!;
    const setup = PRIMARY_NAV.find((g) => g.label === "Setup")!;
    expect(operate.items.find((i) => i.href === "/executive")).toBeUndefined();
    expect(operate.items.find((i) => i.href === "/reports")).toBeUndefined();
    expect(operate.items.find((i) => i.href === "/integrations")).toBeUndefined();
    expect(operate.items.find((i) => i.href === "/attack-paths")).toBeUndefined();
    expect(setup.items.find((i) => i.href === "/executive")?.label).toBe(
      "Executive"
    );
    expect(setup.items.find((i) => i.href === "/integrations")?.label).toBe(
      "Connect"
    );
    expect(setup.items.map((i) => i.href)).toEqual(
      expect.arrayContaining(["/compliance", "/reports", "/attack-paths"])
    );
  });

  it("keeps Labs rail portal-only (Labs → /labs) with peers on LABS_DESTINATIONS", () => {
    const labs = PRIMARY_NAV.find((g) => g.label === "Labs");
    expect(labs).toBeDefined();
    // P04: Labs never defaultOpen — not part of default demo / first-run path.
    expect(labs!.defaultOpen).toBe(false);
    expect(PRIMARY_NAV.find((g) => g.label === "Operate")!.defaultOpen).toBe(
      true
    );
    expect(labs!.items).toHaveLength(1);
    expect(labs!.items[0]).toEqual(
      expect.objectContaining({ href: "/labs", label: "Labs" })
    );
    for (const href of [
      "/swarm",
      "/workflows",
      "/mcp",
      "/model-gateway",
      "/ai-apps",
      "/threat-center"
    ]) {
      expect(labs!.items.map((i) => i.href)).not.toContain(href);
      expect(LABS_DESTINATION_HREFS.has(href)).toBe(true);
    }
    expect(LABS_DESTINATIONS.length).toBeGreaterThanOrEqual(8);
  });

  it("marks Labs portal door active on deep Labs destinations (UX-W10)", () => {
    expect(isNavItemActive("/labs", "/labs")).toBe(true);
    expect(isNavItemActive("/workflows", "/labs")).toBe(true);
    expect(isNavItemActive("/swarm", "/labs")).toBe(true);
    expect(isNavItemActive("/threat-feed", "/labs")).toBe(true);
    expect(isNavItemActive("/findings", "/labs")).toBe(false);
  });

  it("flattens all groups into PRIMARY_NAV_ITEMS for shell consumers", () => {
    expect(PRIMARY_NAV_ITEMS.length).toBeGreaterThan(10);
    expect(PRIMARY_NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: "/engines", label: "Engines" }),
        expect.objectContaining({ href: "/scopes", label: "Scope" }),
        expect.objectContaining({ href: "/findings", label: "Findings" }),
        expect.objectContaining({ href: "/labs", label: "Labs" }),
        expect.objectContaining({ href: "/schedules", label: "Schedule" })
      ])
    );
    expect(PRIMARY_NAV_ITEMS.find((i) => i.href === "/workflows")).toBeUndefined();
  });

  it("labels inventory Assets & ownership at /assets; Scope is authorize (P07-2)", () => {
    const assets = PRIMARY_NAV_ITEMS.find((i) => i.href === "/assets");
    expect(assets?.label).toBe("Assets & ownership");
    expect(PRIMARY_NAV_ITEMS.find((i) => i.href === "/data-fabric")).toBeUndefined();
    const scope = PRIMARY_NAV.find((g) => g.label === "Operate")!.items.find(
      (i) => i.href === "/scopes"
    );
    expect(scope?.label).toBe("Scope");
  });

  it("indexes Getting started for rail + command palette [P02-11]", () => {
    expect(PRIMARY_NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/getting-started",
          label: "Getting started"
        })
      ])
    );
  });

  it("keeps /getting-started as a live alias so rail aria-current can land [P02-11]", () => {
    const source = readFileSync(
      path.join(__dirname, "../../app/getting-started/page.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/redirect\(/);
    expect(isNavItemActive("/getting-started", "/getting-started")).toBe(true);
    expect(isNavItemActive("/getting-started", "/dashboard")).toBe(false);
  });

  it("keeps Findings label aligned with page H1 (not Validated Results) [P01-13]", () => {
    const findings = PRIMARY_NAV_ITEMS.find((i) => i.href === "/findings");
    expect(findings?.label).toBe("Findings");
  });

  it("orders palette group weights Operate < Setup < Admin < Labs (UX-W2)", () => {
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

  it("marks threat deep-links active under Threats hub path (UX-W2 residual)", () => {
    expect(isNavItemActive("/threat-center", "/threat-center")).toBe(true);
    expect(isNavItemActive("/threat-feed", "/threat-center")).toBe(true);
    expect(isNavItemActive("/signal-activity", "/threat-center")).toBe(true);
    expect(isNavItemActive("/findings", "/threat-center")).toBe(false);
  });
});
