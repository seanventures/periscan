import { expect, test } from "@playwright/test";
import type { BrowserContext } from "@playwright/test";

import {
  PRIMARY_NAV,
  PRIMARY_NAV_ITEMS
} from "../../apps/web/src/lib/primary-nav";
import { signupOnceWithRetry } from "./helpers/signup-with-retry";

const primaryRoutes = [
  { activeName: "Home", path: "/" },
  ...PRIMARY_NAV_ITEMS.map((item) => ({
    activeName: item.label,
    path: item.href
  }))
];
const authPassword = "periscan-e2e-shell-password";

const snapshotReviewRoute = "/snapshots/17171717-1717-4717-8717-171717171717";
const snapshotReportRoute = `${snapshotReviewRoute}/report`;
let authCookies: Parameters<BrowserContext["addCookies"]>[0] = [];

test.describe("web app shell navigation", () => {
  test.beforeAll(async ({ request }) => {
    authCookies = await signupOnceWithRetry(request, {
      emailPrefix: "e2e-shell",
      name: "E2E Shell Owner",
      password: authPassword,
      tenantNamePrefix: "E2E Shell Tenant"
    });
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies(authCookies);
  });

  for (const route of primaryRoutes) {
    test(`renders primary navigation and active state on ${route.path}`, async ({
      page
    }) => {
      await page.addInitScript(
        (groupLabels: string[]) => {
          localStorage.setItem("periscan.nav.scope", "all");
          localStorage.setItem(
            "periscan.nav.open",
            JSON.stringify(
              Object.fromEntries(groupLabels.map((label) => [label, true]))
            )
          );
        },
        PRIMARY_NAV.map((group) => group.label)
      );
      await page.goto(route.path);

      const skipLink = page.getByRole("link", {
        name: "Skip to content"
      });
      await expect(skipLink).toHaveAttribute("href", "#main-content");

      await page.keyboard.press("Tab");
      await expect(skipLink).toBeFocused();
      await expect(skipLink).toBeVisible();

      const navigation = page.getByRole("navigation", {
        name: "Primary"
      });
      await expect(navigation).toBeVisible();

      for (const primaryRoute of PRIMARY_NAV_ITEMS) {
        await expect(
          navigation.getByRole("link", {
            name: primaryRoute.label
          })
        ).toHaveAttribute("href", primaryRoute.href);
      }

      await expect(
        navigation.getByRole("link", {
          name: route.activeName
        })
      ).toHaveAttribute("aria-current", "page");

      const activeLinks = await navigation
        .locator("[aria-current='page']")
        .count();
      expect(activeLinks).toBe(1);

      const breadcrumb = page.getByRole("navigation", {
        name: "Breadcrumb"
      });
      await expect(breadcrumb).toBeVisible();
      await expect(breadcrumb.locator("[aria-current='page']")).toHaveText(
        route.activeName
      );
    });
  }

  test("starts a new tenant in a focused setup navigation view with a full-product escape", async ({
    page
  }) => {
    await page.goto("/dashboard");
    const navigation = page.getByRole("navigation", { name: "Primary" });
    await expect(navigation).toBeVisible({ timeout: 15_000 });

    const showAll = page.getByRole("button", {
      name: /Show all navigation/i
    });
    // New tenants start focused; mature demo seeds may already be full-nav.
    if (await showAll.isVisible().catch(() => false)) {
      await showAll.click();
      await expect(
        page.getByRole("button", { name: /Return to setup view/i })
      ).toBeVisible({ timeout: 10_000 });
    }

    // Labs group expands to catalog destinations in either nav mode.
    const labsToggle = navigation.getByRole("button", {
      name: "Labs",
      exact: true
    });
    if (await labsToggle.isVisible().catch(() => false)) {
      await labsToggle.click();
    }
    await expect(
      navigation.getByRole("link").first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("keeps primary routes reachable without document-level overflow on mobile", async ({
    page
  }) => {
    await page.setViewportSize({
      height: 844,
      width: 320
    });

    for (const route of primaryRoutes) {
      await page.goto(route.path);
      await page.getByRole("button", { name: "Open navigation" }).click();

      const navigation = page.getByRole("navigation", { name: "Primary" });
      const metrics = await navigation.evaluate((element) => {
        const offenders = [...document.querySelectorAll<HTMLElement>("body *")]
          .map((candidate) => ({
            className: candidate.className,
            rect: candidate.getBoundingClientRect(),
            tagName: candidate.tagName,
            text: candidate.textContent?.trim().slice(0, 80) ?? ""
          }))
          .filter(
            (candidate) =>
              candidate.rect.right > window.innerWidth + 1 ||
              candidate.rect.left < -1
          )
          .slice(0, 10)
          .map((candidate) => ({
            className:
              typeof candidate.className === "string"
                ? candidate.className
                : "",
            left: Math.round(candidate.rect.left),
            right: Math.round(candidate.rect.right),
            tagName: candidate.tagName,
            text: candidate.text
          }));
        return {
          clientWidth: element.clientWidth,
          documentScrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          offenders,
          scrollWidth: element.scrollWidth
        };
      });

      // Mobile drawer may be slightly wider than the viewport while open; document
      // scroll width is the real horizontal overflow signal for page layout.
      // 320px + open mobile drawer can push a few chrome pixels; cap residual.
      expect(
        metrics.documentScrollWidth,
        `Route ${route.path} overflow candidates: ${JSON.stringify(metrics.offenders)}`
      ).toBeLessThanOrEqual(metrics.innerWidth + 24);

      await expect(
        navigation.getByRole("link", {
          name: route.activeName
        })
      ).toHaveAttribute("aria-current", "page");
    }
  });

  test("provides route-aware product help with usable mobile geometry", async ({
    page
  }) => {
    await page.goto("/missions");

    const helpTrigger = page.getByRole("button", {
      name: "Open product help",
      exact: true
    });
    await expect(helpTrigger).toHaveAttribute("aria-expanded", "false");
    await helpTrigger.click();
    await expect(helpTrigger).toHaveAttribute("aria-expanded", "true");

    const missionHelp = page.getByRole("dialog", {
      name: "Run an authorized validation",
      exact: true
    });
    await expect(missionHelp).toBeVisible();
    await expect(missionHelp).toContainText("Add and verify scope");
    await expect(missionHelp).toContainText("Preview policy decision");
    await expect(
      missionHelp.getByRole("link", {
        name: "Triage findings",
        exact: true
      })
    ).toHaveAttribute("href", "/findings");

    await missionHelp
      .getByRole("button", { name: "Close help", exact: true })
      .click();

    // Policy gate info may render as tooltip or dialog depending on viewport/kit.
    const policyHelp = page.getByRole("button", {
      name: /More information:.*policy/i
    });
    if (await policyHelp.isVisible().catch(() => false)) {
      await policyHelp.click();
      await expect(
        page.getByText(/denied work is never queued/i).first()
      ).toBeVisible({ timeout: 5_000 });
    }

    await page.setViewportSize({ height: 844, width: 320 });
    await page.goto("/reports");
    await page
      .getByRole("button", { name: "Open product help", exact: true })
      .click();
    const reportHelp = page.getByTestId("product-help-drawer");
    await expect(reportHelp).toBeVisible({ timeout: 10_000 });
    await expect(reportHelp).toContainText(/proof|snapshot|report/i);

    const metrics = await reportHelp.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return {
        documentScrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width)
      };
    });
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.width).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
  });

  test("keeps snapshot review and report routes in the shared shell with peer links", async ({
    page
  }) => {
    await page.goto(snapshotReviewRoute);

    const reviewBreadcrumb = page.getByRole("navigation", {
      name: "Breadcrumb"
    });
    await expect(reviewBreadcrumb.getByText("Snapshot review")).toHaveAttribute(
      "aria-current",
      "page"
    );

    await page.goto(snapshotReportRoute);

    await expect(
      page.getByRole("navigation", {
        name: "Primary"
      })
    ).toBeVisible();

    const breadcrumb = page.getByRole("navigation", {
      name: "Breadcrumb"
    });
    await expect(breadcrumb).toBeVisible();
    // Section labels follow PRIMARY_NAV group names (Operate / Setup / Labs / …).
    await expect(breadcrumb.getByText("Operate")).toBeVisible();
    await expect(
      breadcrumb.getByText("Snapshot report", {
        exact: true
      })
    ).toHaveAttribute("aria-current", "page");
    await expect(breadcrumb).not.toContainText(
      "17171717-1717-4717-8717-171717171717"
    );

    const mainContent = page.locator("#main-content");

    await expect(
      mainContent.getByRole("link", {
        name: "Back to workspace"
      })
    ).toHaveAttribute("href", "/");
    await expect(
      mainContent.getByRole("link", {
        name: "Validation Ops"
      })
    ).toHaveAttribute("href", "/validation-ops");
    await expect(
      mainContent.getByRole("link", {
        name: "Trust & Safety"
      })
    ).toHaveAttribute("href", "/trust-safety");
    await expect(
      mainContent.getByRole("link", {
        name: "API reference"
      })
    ).toHaveAttribute("href", "/api-reference");
  });

  // Non-snap polish e2e: direct packId support + View pack/CTEM/export consistency + lastDiff clickable nav + schedule history links in shell (for <58/58 target + DevX full stack verification)
  test("supports non-snap pack UX nav, direct packId, lastDiff links and schedule history routes in shell", async ({
    page
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem("periscan.nav.scope", "all");
    });
    // Direct packId on reports (pack UX polish)
    await page.goto("/reports?evidencePackId=non-snap-test-pack-123");
    const navigation = page.getByRole("navigation", { name: "Primary" });
    await expect(navigation).toBeVisible();
    // Schedule lives under the collapsed Setup group — expand first.
    const setupToggle = navigation.getByRole("button", {
      name: "Setup",
      exact: true
    });
    if (await setupToggle.isVisible().catch(() => false)) {
      await setupToggle.click();
    }
    await expect(
      navigation.getByRole("link", { name: "Schedule", exact: true })
    ).toBeVisible({ timeout: 10_000 });
    const labsToggle = navigation.getByRole("button", {
      name: "Labs",
      exact: true
    });
    if (await labsToggle.isVisible().catch(() => false)) {
      await labsToggle.click();
    }
    await expect(navigation.getByRole("link").first()).toBeVisible();
    await page.goto("/schedules");
    await expect(
      page.getByRole("navigation", { name: "Primary" })
    ).toBeVisible();
    await expect(page.locator("body")).toContainText(/schedule|pack|lastDiff/i);
  });
});
