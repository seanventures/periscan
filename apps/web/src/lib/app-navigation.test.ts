import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_NAV_ITEMS, APP_NAV_SECTIONS } from "./app-navigation";
import { PRIMARY_NAV, PRIMARY_NAV_ITEMS } from "./primary-nav";

const appRoot = join(process.cwd(), "app");
const dynamicRoutesCoveredByE2e = new Set([
  "/attack-paths/[id]",
  "/missions/[id]",
  "/remediation/[id]",
  "/snapshots/[id]",
  "/snapshots/[id]/report",
  // Object explorer shells (P11 light / P01-2 workspace) — not primary rail
  "/objects/[type]",
  "/objects/[type]/[id]"
]);
// Auth screens and legacy redirects are intentionally outside the primary navigation.
const excludedStaticRoutes = new Set<string>([
  "/accept-invite",
  "/login",
  "/reset-password",
  "/signup",
  "/verify-email",
  "/welcome"
]);
/**
 * Static product pages that are intentionally off the primary rail
 * (deep links, aliases, guided demo, first-run). They must stay real pages
 * but are not required on PRIMARY_NAV / APP_NAV.
 */
const offRailStaticRoutes = new Set<string>([
  "/", // redirect → /dashboard
  "/demo",
  "/demo/workspace",
  "/registries", // product alias; primary rail uses /engines (Setup)
  // P07-18: legacy fabric URL redirects to /assets (primary label)
  "/data-fabric",
  // Deep-link / demoted surfaces kept off the primary catalog
  "/attack-techniques",
  "/continuous",
  "/packs",
  // P07-2: /scopes is now on Operate (authorize home) — not off-rail
  "/signal-activity",
  "/threat-feed",
  // UX-W2 alias → /threat-center (single Threats door)
  "/threats",
  "/validation-ops",
  // Object explorer catalog (P11 light) — /shift is on Operate rail (P18-2)
  "/objects",
  // UX-W10: former Labs rail peers — reachable via /labs portal + palette only
  "/swarm",
  "/workflows",
  "/operators",
  "/engagements",
  "/mcp",
  "/model-gateway",
  "/ai-apps",
  "/non-human-identities",
  "/threat-center"
]);

function collectPageFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "api" || entry.name.startsWith(".")) {
        return [];
      }

      return collectPageFiles(entryPath);
    }

    return entry.isFile() && entry.name === "page.tsx" ? [entryPath] : [];
  });
}

function routeForPageFile(pageFile: string): string {
  const routePath = relative(appRoot, pageFile).split(sep).join("/");
  const routeSegments = routePath
    .replace(/\/page\.tsx$/, "")
    .replace(/^page\.tsx$/, "")
    .split("/")
    .filter((segment) => segment.length > 0)
    .filter((segment) => !segment.startsWith("("));

  return routeSegments.length === 0 ? "/" : `/${routeSegments.join("/")}`;
}

function collectAppPageRoutes(): string[] {
  return collectPageFiles(appRoot).map(routeForPageFile).sort();
}

describe("app navigation route contract", () => {
  it("derives APP_NAV from PRIMARY_NAV (single source of truth)", () => {
    expect(APP_NAV_SECTIONS.map((s) => s.label)).toEqual(
      PRIMARY_NAV.map((g) => g.label)
    );
    expect(APP_NAV_ITEMS).toEqual(
      PRIMARY_NAV_ITEMS.map(({ href, label }) => ({ href, label }))
    );
  });

  it("registers every primary-nav href as a real static page", () => {
    const staticPageRoutes = new Set(
      collectAppPageRoutes().filter((route) => !route.includes("["))
    );
    const navRoutes = APP_NAV_ITEMS.map((item) => item.href);

    expect(new Set(navRoutes).size).toBe(navRoutes.length);
    for (const href of navRoutes) {
      expect(
        staticPageRoutes.has(href),
        `PRIMARY_NAV href ${href} has no static page.tsx`
      ).toBe(true);
    }
  });

  it("keeps every static first-party page on primary nav or an explicit off-rail list", () => {
    const staticPageRoutes = collectAppPageRoutes().filter(
      (route) =>
        !route.includes("[") &&
        !excludedStaticRoutes.has(route) &&
        !route.startsWith("/api/")
    );
    const navRoutes = new Set(APP_NAV_ITEMS.map((item) => item.href));
    const uncovered = staticPageRoutes.filter(
      (route) => !navRoutes.has(route) && !offRailStaticRoutes.has(route)
    );

    expect(uncovered).toEqual([]);
  });

  it("keeps dynamic first-party pages explicitly covered by release gates", () => {
    const dynamicPageRoutes = collectAppPageRoutes().filter((route) =>
      route.includes("[")
    );

    expect(dynamicPageRoutes).toEqual([...dynamicRoutesCoveredByE2e].sort());
  });
});
