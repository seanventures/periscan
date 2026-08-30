import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P07-17 + UX-W15 (PERISCAN-483): Mature default rail stays slim; Show Labs
 * reveals the zoo. Setup collapses to Runners · Engines on Operating.
 * Security engineer gets a daily allow-list, not full catalog.
 */
describe("nav scope (P07-17 / UX-W15)", () => {
  const source = readFileSync(path.join(__dirname, "app-shell.tsx"), "utf8");

  function setHrefs(constName: string): string[] {
    // Match Set([...]) including spreads; collect only string literal hrefs.
    const block = source.match(
      new RegExp(`const ${constName} = new Set\\(\\[([\\s\\S]*?)\\]\\);`)
    );
    expect(block).not.toBeNull();
    return [...(block?.[1] ?? "").matchAll(/"(\/[^"]+)"/g)].map((m) => m[1]!);
  }

  it("defines OPERATING_DEFAULT_NAV with Proof OS spine + collapsed Setup (UX-W1/W15)", () => {
    const body =
      source.match(
        /const OPERATING_DEFAULT_NAV = new Set\(\[([\s\S]*?)\]\);/
      )?.[1] ?? "";
    const hrefs = [...body.matchAll(/"(\/[^"]+)"/g)].map((m) => m[1]!);
    // Operate Proof OS ≤10 spine literals; Setup infrastructure via spread.
    // ICP-P1-4: /executive replaces /evidence on Operate allow-list literals.
    expect(body).toMatch(/\.\.\.OPERATING_SETUP_NAV/);
    expect(hrefs.length).toBeLessThanOrEqual(10);
    expect(hrefs).toEqual(
      expect.arrayContaining([
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
      ])
    );
    // UX-W1: Schedule stays off Operate default literals.
    expect(hrefs).not.toContain("/schedules");
    // ICP-P1-4: Evidence demoted off Operate default literals.
    expect(hrefs).not.toContain("/evidence");
    // UX-W15: Setup junk drawer stays off Operating default.
    for (const hidden of [
      "/getting-started",
      "/assets",
      "/external-validation",
      "/controls",
      "/compliance"
    ]) {
      expect(hrefs).not.toContain(hidden);
      expect(setHrefs("OPERATING_SETUP_NAV")).not.toContain(hidden);
    }
    expect(setHrefs("OPERATING_SETUP_NAV").sort()).toEqual([
      "/engines",
      "/runners"
    ]);
  });

  it("defines OPERATING_SETUP_NAV as Runners + Engines only (UX-W15)", () => {
    const hrefs = setHrefs("OPERATING_SETUP_NAV");
    expect(hrefs.sort()).toEqual(["/engines", "/runners"]);
  });

  it("lists OPERATING_SETUP_HIDDEN junk drawer for mature Setup collapse", () => {
    const hrefs = setHrefs("OPERATING_SETUP_HIDDEN");
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "/getting-started",
        "/assets",
        "/external-validation",
        "/controls",
        "/compliance"
      ])
    );
    // ICP-P1-4: Executive is on Operate — not a Setup junk-drawer entry.
    expect(hrefs).not.toContain("/executive");
    expect(hrefs).not.toContain("/runners");
    expect(hrefs).not.toContain("/engines");
    expect(hrefs).not.toContain("/schedules");
    expect(hrefs).not.toContain("/evidence");
  });

  it("marks Operate rail with data-proof-os-spine progressive attribute (UX-W1 #200)", () => {
    expect(source).toMatch(/data-proof-os-spine/);
    expect(source).toMatch(/group\.label === "Operate"/);
  });

  it("applies inert to shell chrome/main when mobile nav or major dialogs open (P16-1)", () => {
    // Content sibling of overlays is inerted for mobile drawer + palette + help.
    expect(source).toMatch(/shellDialogOpen\s*=\s*mobileOpen\s*\|\|\s*paletteOpen\s*\|\|\s*helpOpen/);
    expect(source).toMatch(/shellDialogOpen\s*\?\s*\{\s*inert:\s*true/);
    // Desktop rail inert under palette/help so AT cannot reach under modal.
    expect(source).toMatch(/chromeInert\s*=\s*paletteOpen\s*\|\|\s*helpOpen/);
    expect(source).toMatch(/chromeInert\s*\?\s*\{\s*inert:\s*true/);
    // Single main landmark owned by shell (no nested main wrapper).
    // UX-W13: skip link → #main-content; product-main owns the authenticated canvas.
    expect(source).toMatch(/id="main-content"/);
    expect(source).toMatch(/<main[\s\S]*id="main-content"/);
    expect(source).toMatch(/className="product-main/);
    const mainCount = (source.match(/<main\b/g) ?? []).length;
    expect(mainCount).toBe(1);
  });

  it("extends SecurityEngineer with a slim daily set (UX-W15)", () => {
    expect(source).toMatch(/SecurityEngineer:\s*ENGINEER_DAILY_NAV/);
    expect(source).toMatch(/const ENGINEER_DAILY_NAV = new Set/);
    const engineerBody =
      source.match(
        /const ENGINEER_DAILY_NAV = new Set\(\[([\s\S]*?)\]\);/
      )?.[1] ?? "";
    // Spreads OPERATING (runners/engines); Schedule + Evidence + trust-safety.
    expect(engineerBody).toMatch(/\.\.\.OPERATING_DEFAULT_NAV/);
    expect(engineerBody).toMatch(/"\/schedules"/);
    expect(engineerBody).toMatch(/"\/evidence"/);
    expect(engineerBody).toMatch(/"\/trust-safety"/);
    // UX-W15: engineer daily no longer pins Getting started / Assets.
    expect(engineerBody).not.toMatch(/"\/getting-started"/);
    expect(engineerBody).not.toMatch(/"\/assets"/);
  });

  it("keeps Shift brief on SecurityEngineer daily rail (P18-2 / R8)", () => {
    // ENGINEER_DAILY_NAV spreads OPERATING_DEFAULT_NAV which must include /shift.
    expect(source).toMatch(
      /const OPERATING_DEFAULT_NAV = new Set\(\[[\s\S]*?"\/shift"[\s\S]*?\]\);/
    );
    expect(source).toMatch(
      /const ENGINEER_DAILY_NAV = new Set\(\[\s*\.\.\.OPERATING_DEFAULT_NAV/
    );
  });

  it("collapses Setup on mature maturity and restores full list via showAllNavigation", () => {
    expect(source).toMatch(/collapseOperatingSetup/);
    expect(source).toMatch(/maturity !== "New"/);
    expect(source).toMatch(/maturity !== "Activating"/);
    expect(source).toMatch(/OPERATING_SETUP_HIDDEN\.has/);
    // Escape hatch still bypasses allow-lists.
    expect(source).toMatch(/showAllNavigation \|\|/);
    // New/Activating keep richer first-run sets.
    expect(source).toMatch(/maturity === "New"/);
    expect(source).toMatch(/NEW_TENANT_NAV/);
    expect(source).toMatch(/maturity === "Activating"/);
    expect(source).toMatch(/ACTIVATING_TENANT_NAV/);
  });

  it("omits /getting-started from NEW_TENANT_NAV (Home alias is not a rail item)", () => {
    expect(setHrefs("NEW_TENANT_NAV")).not.toContain("/getting-started");
  });

  it("unions /executive onto New/Activating only for SecurityLeader", () => {
    expect(source).toMatch(/persona === "SecurityLeader"/);
    expect(source).toMatch(/new Set\(\[\.\.\.base, "\/executive"\]\)/);
    expect(setHrefs("NEW_TENANT_NAV")).not.toContain("/executive");
    expect(setHrefs("ACTIVATING_TENANT_NAV")).not.toContain("/executive");
  });

  it("labels the escape hatch Show Labs & more (not Show all navigation)", () => {
    expect(source).toMatch(/Show Labs & more/);
    expect(source).not.toMatch(/Show all navigation/);
  });

  it("keeps Labs hidden unless showAllNavigation", () => {
    expect(source).toMatch(
      /group\.label === "Labs" && !showAllNavigation/
    );
  });

  it("wires mobile nav trigger aria-expanded / aria-controls (P16-2)", () => {
    expect(source).toMatch(/aria-expanded=\{mobileNavOpen\}/);
    expect(source).toMatch(/aria-controls=\{mobileNavId\}/);
    expect(source).toMatch(/id=\{mobileNavId\}/);
  });

  it("wires adaptive density from localStorage periscan-density (UX-W9 / #192)", () => {
    expect(source).toMatch(/const DENSITY_KEY = "periscan-density"/);
    expect(source).toMatch(/data-density=\{density\}/);
    expect(source).toMatch(/data-testid="density-toggle"/);
    expect(source).toMatch(/"comfortable"\s*\|\s*"compact"/);
    expect(source).toMatch(/localStorage\.getItem\(DENSITY_KEY\)/);
    expect(source).toMatch(/localStorage\.setItem\(DENSITY_KEY/);
  });

  it("hides rail ProofLoopMap on first-run New maturity (UX-W2 dual metaphor)", () => {
    // Prefer GetStarted hero map only while maturity is New.
    expect(source).toMatch(/maturity && maturity !== "New"/);
    expect(source).toMatch(/variant="rail"/);
  });

  it("mobile drawer is Operate-first with Labs/Admin under More (UX-W7/#21)", () => {
    expect(source).toMatch(/layout="mobile"/);
    expect(source).toMatch(/layout="desktop"/);
    expect(source).toMatch(/data-testid="mobile-nav-more"/);
    expect(source).toMatch(/layout\s*!==\s*"mobile"/);
    // Non-Operate groups (Setup / Labs / Admin) fold under More on mobile.
    expect(source).toMatch(/g\.label !== "Operate"/);
    expect(source).toMatch(/>\s*More\s*</);
  });

  it("gives command bar palette/help/density/soc focus-visible rings (UX-W12)", () => {
    expect(source).toMatch(/data-testid="command-bar-palette"/);
    expect(source).toMatch(/data-testid="command-bar-help"/);
    expect(source).toMatch(/data-testid="density-toggle"/);
    expect(source).toMatch(/data-testid="soc-dark-toggle"/);
    expect(source).toMatch(/aria-haspopup="dialog"/);
    expect(source).toMatch(/aria-expanded=\{paletteOpen\}/);
    expect(source).toMatch(/commandBarFocus/);
    expect(source).toMatch(/focus-visible:ring-2 focus-visible:ring-brand/);
  });

  it("keeps Working as chrome always visible on mobile with Leave confirm (P05)", () => {
    // Working-as branch must use flex (not hidden sm:flex) so mobile operators
    // always see the client tenant they are mutating.
    expect(source).toMatch(/data-testid="working-tenant-chrome"/);
    expect(source).toMatch(
      /className="flex max-w-\[min\(100%,20rem\)\] shrink-0 items-center gap-2 rounded-control border border-brand\/50/
    );
    // Default workspace chrome remains sm-only; working-as must not reintroduce
    // the hidden sm:flex pattern on the brand/50 working-as panel.
    expect(source).not.toMatch(
      /className="hidden max-w-\[min\(100%,20rem\)\][\s\S]*?border-brand\/50/
    );
    expect(source).toMatch(/data-testid="leave-working-tenant"/);
    expect(source).toMatch(/Leave client workspace\?/);
    expect(source).toMatch(/confirmLabel="Leave client"/);
    expect(source).toMatch(/ConfirmDialog/);
  });
});
