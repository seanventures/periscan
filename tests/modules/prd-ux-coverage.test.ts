import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function readRepoFile(path: string) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

/**
 * Parse href+label pairs from PRIMARY_NAV / LABS_DESTINATIONS objects.
 * Allows comments between href and label (e.g. Validate honesty notes).
 */
function parsePrimaryNavItems(source: string): Array<{ href: string; label: string }> {
  const items: Array<{ href: string; label: string }> = [];
  const itemBlock =
    /\{\s*href:\s*"([^"]+)",[\s\S]*?label:\s*"([^"]+)"/g;
  for (const match of source.matchAll(itemBlock)) {
    items.push({ href: match[1]!, label: match[2]! });
  }
  return items;
}

function sectionBetween(
  source: string,
  startHeader: string,
  nextHeader: string
) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  const end = source.indexOf(nextHeader, start + startHeader.length);

  if (end === -1) {
    throw new Error(`Unable to find next section header: ${nextHeader}`);
  }

  return source.slice(start, end);
}

function parseBullets(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").trim());
}

function parseNumberedItems(section: string) {
  return section
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/u.test(line))
    .map((line) => line.replace(/^\d+\.\s+/u, "").trim());
}

function sectionFrom(source: string, startHeader: string) {
  const start = source.indexOf(startHeader);

  if (start === -1) {
    throw new Error(`Unable to find section header: ${startHeader}`);
  }

  return source.slice(start);
}

describe("PRD section 15 UX Requirements coverage", () => {
  it("keeps every PRD main navigation item visible in the primary route contract", async () => {
    const [prd, primaryNavSource, appNavSource, labsPortalSource] =
      await Promise.all([
        readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
        readRepoFile("apps/web/src/lib/primary-nav.tsx"),
        readRepoFile("apps/web/src/lib/app-navigation.ts"),
        // UX-W10: AI Apps lives on LABS_DESTINATIONS (portal), not PRIMARY_NAV peers.
        readRepoFile("apps/web/src/lib/labs-portal.ts")
      ]);
    const uxSection = sectionBetween(
      prd,
      "## 15. UX Requirements",
      "## 16. Reports"
    );
    const navigationItems = parseBullets(
      sectionBetween(
        uxSection,
        "### 15.1 Main Navigation",
        "### 15.2 Dashboard Cards"
      )
    );
    // PRD §15.1 historical labels → honest PRIMARY_NAV rail labels/hrefs.
    // Single source of truth is primary-nav; APP_NAV derives from it.
    // Labs portal destinations (AI Apps) remain product-reachable via /labs.
    const prdToProductNav: Record<string, { href: string; label: string }> = {
      Dashboard: { href: "/dashboard", label: "Home" },
      "Validation Snapshot": { href: "/missions", label: "Validate" },
      Exposure: { href: "/findings", label: "Findings" },
      "Attack Paths": { href: "/attack-paths", label: "Paths" },
      Controls: { href: "/controls", label: "Controls" },
      "AI Apps": { href: "/ai-apps", label: "AI Apps" },
      Remediation: { href: "/remediation", label: "Remediation" },
      Evidence: { href: "/evidence", label: "Evidence" },
      Reports: { href: "/reports", label: "Reports" },
      Integrations: { href: "/integrations", label: "Connect" },
      Runners: { href: "/runners", label: "Runners" },
      Policies: { href: "/policies", label: "Policies" },
      Admin: { href: "/admin", label: "Admin" }
    };
    const productNavItems = [
      ...parsePrimaryNavItems(primaryNavSource),
      ...parsePrimaryNavItems(labsPortalSource)
    ];
    const byHref = new Map(productNavItems.map((item) => [item.href, item]));

    expect(navigationItems).toEqual([
      "Dashboard",
      "Validation Snapshot",
      "Exposure",
      "Attack Paths",
      "Controls",
      "AI Apps",
      "Remediation",
      "Evidence",
      "Reports",
      "Integrations",
      "Runners",
      "Policies",
      "Admin"
    ]);

    // app-navigation must derive from primary-nav (no parallel product catalog).
    expect(appNavSource).toMatch(/from\s+["']\.\/primary-nav["']/);
    expect(appNavSource).toMatch(/PRIMARY_NAV/);
    expect(appNavSource).not.toMatch(/label:\s*"Exposure"/);

    for (const prdItem of navigationItems) {
      const mapped = prdToProductNav[prdItem];
      expect(mapped, `No product mapping for PRD nav item ${prdItem}`).toBeDefined();
      const item = byHref.get(mapped.href);
      expect(
        item?.label,
        `Missing or dishonest product nav for PRD "${prdItem}" → ${mapped.href}`
      ).toBe(mapped.label);
    }
  });

  it("keeps the PRD dashboard cards rendered from API-backed dashboard state", async () => {
    const [prd, dashboardSource] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/web/src/components/validation-ops-dashboard.tsx")
    ]);
    const uxSection = sectionBetween(
      prd,
      "## 15. UX Requirements",
      "## 16. Reports"
    );
    const dashboardCards = parseBullets(
      sectionBetween(
        uxSection,
        "### 15.2 Dashboard Cards",
        "### 15.3 Status Badges"
      )
    );

    expect(dashboardCards).toEqual([
      "Priority exposure paths",
      "Controls needing proof",
      "AI apps with failed checks",
      "Fixes awaiting re-test",
      "Risk reduced this month",
      "Evidence packs ready"
    ]);

    for (const card of dashboardCards) {
      expect(dashboardSource, `Missing PRD dashboard card ${card}`).toContain(
        `label: "${card}"`
      );
    }

    expect(dashboardSource).toContain(
      "browserPeriscanApiClient.listSnapshots()"
    );
    expect(dashboardSource).toContain(
      "browserPeriscanApiClient.listAttackPaths()"
    );
    expect(dashboardSource).toContain(
      "browserPeriscanApiClient.getControlRuleCoverage()"
    );
    expect(dashboardSource).toContain(
      "browserPeriscanApiClient.getExecutiveTrends()"
    );
  });

  it("keeps every PRD status badge label in the shared UI badge vocabulary", async () => {
    const [prd, statusSource] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/web/src/ui/status-pill.tsx")
    ]);
    const uxSection = sectionBetween(
      prd,
      "## 15. UX Requirements",
      "## 16. Reports"
    );
    const statusBadges = parseBullets(
      sectionBetween(
        uxSection,
        "### 15.3 Status Badges",
        "### 15.4 Snapshot Flow"
      )
    );

    expect(statusBadges).toEqual([
      "Validated",
      "Blocked",
      "Detected",
      "Missed",
      "Mitigated",
      "Fixed",
      "Reopened",
      "Needs Review"
    ]);

    for (const status of statusBadges) {
      expect(statusSource, `Missing PRD status badge ${status}`).toContain(
        `"${status}"`
      );
    }
  });

  it("keeps the PRD Snapshot flow visible in the API-backed workspace", async () => {
    const [prd, snapshotSource] = await Promise.all([
      readRepoFile("docs/PERISCAN_FULL_PRODUCT_PRD.md"),
      readRepoFile("apps/web/src/components/snapshot-workbench.tsx")
    ]);
    const uxSection = sectionBetween(
      prd,
      "## 15. UX Requirements",
      "## 16. Reports"
    );
    const flowSteps = parseNumberedItems(
      sectionFrom(uxSection, "### 15.4 Snapshot Flow")
    );

    expect(flowSteps).toEqual([
      "Define scope",
      "Connect systems",
      "Run validation",
      "Review report",
      "Create remediation",
      "Verify fix",
      "Export evidence"
    ]);

    for (const [index, step] of flowSteps.entries()) {
      expect(
        snapshotSource,
        `Missing PRD Snapshot flow step ${step}`
      ).toContain(`"${index + 1}. ${step}"`);
    }
  });
});
