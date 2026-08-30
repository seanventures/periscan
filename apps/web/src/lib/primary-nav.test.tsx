import { describe, expect, it } from "vitest";

import { LABS_DESTINATION_HREFS, LABS_DESTINATIONS } from "./labs-portal";
import {
  PRIMARY_NAV,
  PRIMARY_NAV_ITEMS,
  isNavItemActive,
  paletteGroupWeight
} from "./primary-nav";

describe("PRIMARY_NAV (Proof OS / UX-W10 Labs portal-only)", () => {
  it("keeps Operate rail on Proof OS spine + Shift brief (≤10, no zoo)", () => {
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate");
    expect(operate).toBeDefined();
    expect(operate!.defaultOpen).toBe(true);
    // UX-W1/W10 + ICP-P1-4: Operate capped at ≤10 (Home · Shift · Connect ·
    // Scope · Validate · Paths · Findings · Remediation · Executive · Reports).
    // Evidence demoted to Setup so Executive fits board/CISO buyer path.
    expect(operate!.items.length).toBeLessThanOrEqual(10);
    expect(operate!.items.length).toBe(10);
    const hrefs = operate!.items.map((i) => i.href);
    expect(hrefs).toEqual([
      "/dashboard",
      "/shift",
      "/integrations",
      "/scopes",
      "/missions",
      "/attack-paths",
      "/findings",
      "/remediation",
      "/executive",
      "/reports"
    ]);
    expect(hrefs).not.toContain("/schedules");
    expect(hrefs).not.toContain("/evidence");
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

  it("indexes Shift brief on Operate for morning discoverability (P18-2)", () => {
    expect(PRIMARY_NAV_ITEMS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: "/shift",
          label: "Shift brief"
        })
      ])
    );
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate")!;
    const shiftIndex = operate.items.findIndex((i) => i.href === "/shift");
    const homeIndex = operate.items.findIndex((i) => i.href === "/dashboard");
    expect(homeIndex).toBe(0);
    expect(shiftIndex).toBe(1);
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
    // Operating Setup to Runners · Engines (+ Schedule/Evidence for engineer daily).
    // Connect/Scope stay on Operate (Proof OS ≤10). ICP-P1-4: Executive on Operate.
    const setup = PRIMARY_NAV.find((g) => g.label === "Setup")!;
    const hrefs = setup.items.map((i) => i.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/getting-started",
        "/runners",
        "/engines",
        "/schedules",
        "/assets",
        "/external-validation",
        "/controls",
        "/evidence",
        "/compliance"
      ])
    );
    expect(hrefs).not.toContain("/executive");
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate")!;
    const operateHrefs = operate.items.map((i) => i.href);
    expect(operateHrefs).toEqual(
      expect.arrayContaining(["/integrations", "/scopes", "/executive"])
    );
    expect(operateHrefs).not.toContain("/schedules");
  });

  it("promotes Executive to Operate for board/CISO path (ICP-P1-4)", () => {
    const operate = PRIMARY_NAV.find((g) => g.label === "Operate")!;
    expect(operate.items.find((i) => i.href === "/executive")?.label).toBe(
      "Executive"
    );
    const setup = PRIMARY_NAV.find((g) => g.label === "Setup")!;
    expect(setup.items.map((i) => i.href)).toEqual(
      expect.arrayContaining(["/evidence", "/compliance"])
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
