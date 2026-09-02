import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";

import { PRIMARY_NAV_ITEMS } from "../../apps/web/src/lib/primary-nav";
import { signupOnceWithRetry } from "./helpers/signup-with-retry";

const primaryRoutes = PRIMARY_NAV_ITEMS.map((item) => item.href);
const supplementalRoutes = [
  "/welcome",
  "/getting-started",
  "/demo/workspace"
] as const;
const accessibilityRoutes = [
  ...new Set([...primaryRoutes, ...supplementalRoutes])
];
const authPassword = "periscan-e2e-a11y-password";

const dynamicRoutes = [
  "/missions/17171717-1717-4717-8717-171717171717",
  "/snapshots/17171717-1717-4717-8717-171717171717",
  "/snapshots/17171717-1717-4717-8717-171717171717/report"
] as const;
let authCookies: Parameters<BrowserContext["addCookies"]>[0] = [];

function summarizeViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]
) {
  return violations.map((violation) => ({
    help: violation.help,
    id: violation.id,
    impact: violation.impact,
    nodes: violation.nodes.map((node) => ({
      html: node.html,
      target: node.target
    }))
  }));
}

test.describe("web route accessibility", () => {
  // One shared session for the whole suite — avoids signup 429 mid-matrix.
  test.beforeAll(async ({ request }) => {
    authCookies = await signupOnceWithRetry(request, {
      emailPrefix: "e2e-a11y",
      name: "E2E Accessibility Owner",
      password: authPassword,
      tenantNamePrefix: "E2E Accessibility Tenant"
    });
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies(authCookies);
  });

  for (const route of accessibilityRoutes) {
    test(`has no WCAG A/AA axe violations on ${route}`, async ({ page }) => {
      await page.goto(route);

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(summarizeViolations(results.violations)).toEqual([]);
    });
  }

  // Landmark uniqueness is best-practice (not WCAG-tagged) but nested <main>
  // still breaks skip-link / AT navigation. Assert explicitly on shell routes.
  test("authenticated shell routes expose exactly one main landmark", async ({
    page
  }) => {
    await page.goto("/dashboard");
    await expect(page.locator("#main-content")).toHaveCount(1);
    expect(await page.getByRole("main").count()).toBe(1);
  });

  for (const route of dynamicRoutes) {
    test(`has no WCAG A/AA axe violations on dynamic route ${route}`, async ({
      page
    }) => {
      await page.goto(route);
      await expect(
        page.getByRole("navigation", {
          name: "Breadcrumb"
        })
      ).toBeVisible();

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();

      expect(summarizeViolations(results.violations)).toEqual([]);
    });
  }

  test("has no WCAG A/AA axe violations in contextual product help", async ({
    page
  }) => {
    await page.goto("/missions");
    await page
      .getByRole("button", { name: "Open product help", exact: true })
      .click();
    await expect(
      page.getByRole("dialog", {
        name: "Run an authorized validation",
        exact: true
      })
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(summarizeViolations(results.violations)).toEqual([]);
  });
});
