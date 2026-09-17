import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { APP_NAV_ITEMS } from "./app-navigation";
import { PRIMARY_NAV_ITEMS } from "./primary-nav";

const webRoot = join(process.cwd());
const missionsPagePath = join(webRoot, "app/missions/page.tsx");
const appDir = join(webRoot, "app");

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

/**
 * P0 honesty: /missions is the guided Validation Snapshot surface.
 * Multi-type MissionsWorkbench must not be claimed in primary nav while
 * it remains unmounted from app routes. Rail label is the honest Operate
 * verb "Validate" (single nav source: primary-nav).
 */
describe("missions nav honesty", () => {
  it("mounts ValidationSnapshotFlow on /missions and not multi-type workbench", () => {
    const source = readFileSync(missionsPagePath, "utf8");

    expect(source).toMatch(
      /import\s*\{\s*ValidationSnapshotFlow\s*\}\s*from/
    );
    expect(source).toMatch(/return\s*<ValidationSnapshotFlow\s*\/>/);
    expect(source).not.toMatch(
      /import\s*\{[^}]*MissionsWorkbench[^}]*\}\s*from/
    );
  });

  it("does not import multi-type mission workbench from any app page route", () => {
    const pages = collectPageFiles(appDir);
    const offenders = pages.filter((pagePath) => {
      const source = readFileSync(pagePath, "utf8");
      return /import\s*\{[^}]*MissionsWorkbench[^}]*\}\s*from/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it("labels /missions as Validate from the single primary-nav source", () => {
    const primary = PRIMARY_NAV_ITEMS.find((item) => item.href === "/missions");
    const derived = APP_NAV_ITEMS.find((item) => item.href === "/missions");

    expect(primary?.label).toBe("Validate");
    expect(derived?.label).toBe("Validate");
    expect(primary?.label).toBe(derived?.label);
    expect(primary?.label).not.toBe("Missions");
    expect(primary?.hint).toMatch(/Validation Snapshot/i);
  });

  it("documents multi-type MissionsWorkbench as unmounted lab surface", () => {
    const workbenchPath = join(
      webRoot,
      "src/components/missions-workbench.tsx"
    );
    const source = readFileSync(workbenchPath, "utf8");
    expect(source).toMatch(/NOT mounted on any product app/i);
    expect(source).toMatch(/Labs \/ not mounted on product routes/i);
  });
});
