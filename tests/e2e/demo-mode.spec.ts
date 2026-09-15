import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("isolated demo mode", () => {
  test("enters from demo login and completes the guided proof loop", async ({
    context,
    page
  }) => {
    await context.clearCookies();
    await page.goto("/login");

    await page.getByRole("button", { name: "Use demo login" }).click();

    await expect(page).toHaveURL(/\/demo\/workspace$/u);
    await expect(page.locator('[data-demo-mode="true"]')).toBeVisible();
    await expect(page.getByText("Demo mode", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Deterministic sample data · read-only tour")
    ).toBeVisible();
    expect(
      (await context.cookies()).filter((cookie) =>
        cookie.name.toLowerCase().includes("session")
      )
    ).toEqual([]);
    const guide = page.getByRole("navigation", { name: "Demo guide" });

    await guide.getByRole("button", { name: /Attack path/u }).click();
    await expect(
      page.getByRole("heading", { name: "Follow entry to impact" })
    ).toBeVisible();

    await guide.getByRole("button", { name: /Control proof/u }).click();
    await expect(page.getByText("Missed observation")).toBeVisible();

    await guide.getByRole("button", { name: /Smallest fix/u }).click();
    await expect(
      page.getByRole("heading", { name: "Choose the path breaker" })
    ).toBeVisible();

    await guide.getByRole("button", { name: /Re-test/u }).click();
    await expect(page.getByText("Fresh evidence required")).toBeVisible();

    await guide.getByRole("button", { name: /Deliver proof/u }).click();
    await expect(
      page.getByRole("heading", { name: "Review the governed output" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /complete sample report/u })
    ).toHaveAttribute("href", "/demo#sample-report");
  });

  test("keeps the guide usable and free of document overflow on mobile", async ({
    page
  }) => {
    await page.setViewportSize({ height: 844, width: 320 });
    await page.goto("/demo/workspace");

    const geometry = await page
      .locator('[data-demo-mode="true"]')
      .evaluate((element) => ({
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        workspaceWidth: element.getBoundingClientRect().width
      }));

    expect(geometry.documentWidth).toBeLessThanOrEqual(
      geometry.viewportWidth + 1
    );
    expect(geometry.workspaceWidth).toBeLessThanOrEqual(geometry.viewportWidth);

    await page
      .getByRole("navigation", { name: "Demo guide" })
      .getByRole("button", { name: /Attack path/u })
      .click();
    await expect(
      page.getByRole("heading", { name: "Follow entry to impact" })
    ).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
