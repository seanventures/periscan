import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

// Browser critical-journey E2E (WS4). The sibling first-customer-proof-loop spec
// proves the API loop over HTTP; this one proves the actual UI a customer sees
// renders that real, API-driven data and that a core proof-loop action works
// through the browser. Data is seeded via the web origin's own /api/v1 proxy so
// the session cookie lives in the browser context and every page.goto is
// authenticated.

const DAY_MS = 24 * 60 * 60 * 1000;

function apiPath(path: string) {
  return `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
}

test.describe("critical journey (browser UI)", () => {
  test("signs up, sees a measured finding, dispositions it, and lands on the proof-loop screens", async ({
    page
  }) => {
    // --- Seed a measured finding through the web origin (shares browser cookies) ---
    const email = `e2e-ui-${randomUUID()}@periscan.test`;
    const signup = await page.request.post(apiPath("/auth/signup"), {
      data: {
        email,
        name: "E2E UI Owner",
        password: "periscan-e2e-ui-password",
        tenantName: "E2E UI Tenant"
      }
    });
    expect(signup.status()).toBe(201);

    const host = `ui-e2e-${randomUUID()}.example.com`;
    const scope = await page.request.post(apiPath("/scopes"), {
      data: { scopeType: "Domain", value: host }
    });
    expect(scope.status()).toBe(201);
    const scopeId = (await scope.json()).scopeId as string;

    await page.request.post(apiPath(`/scopes/${scopeId}/verify`), {
      data: { devModeManual: true }
    });

    // A fixture posture check with an expired TLS cert → a measured exposure that
    // surfaces as a validated finding.
    const posture = await page.request.post(
      apiPath(`/scopes/${scopeId}/posture-check`),
      {
        data: {
          executionMode: "Fixture",
          fixtures: {
            "periscan.tls_certificate_check": {
              fixtureCertificate: {
                issuer: "CN=Real CA,O=CA",
                subject: `CN=${host},O=Acme`,
                validFrom: new Date(Date.now() - 400 * DAY_MS).toISOString(),
                validTo: new Date(Date.now() - 10 * DAY_MS).toISOString()
              }
            }
          }
        }
      }
    );
    expect(posture.status()).toBe(201);

    // --- The browser renders the finding on /findings ---
    await page.goto("/findings");
    await expect(
      page.getByRole("heading", { name: "Findings", level: 1 })
    ).toBeVisible();
    // The queue is NOT the empty state — a real finding is present.
    await expect(page.getByText("No findings yet")).toHaveCount(0);

    const firstFinding = page.locator("main ul > li button").first();
    await expect(firstFinding).toBeVisible();

    // --- Apply an analyst disposition through the UI ---
    await firstFinding.click();
    const dispositionSelect = page.getByRole("combobox", {
      name: "Disposition",
      exact: true
    });
    await expect(dispositionSelect).toBeVisible();
    await dispositionSelect.selectOption("Escalated");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    // The disposition badge appears once the transition round-trips.
    await expect(
      page.locator("span").filter({ hasText: /^Escalated$/u }).first()
    ).toBeVisible();

    // --- The core proof-loop screens all load authenticated, in the shell ---
    for (const route of [
      "/dashboard",
      "/executive",
      "/attack-paths",
      "/evidence",
      "/remediation"
    ]) {
      const response = await page.goto(route);
      await expect(
        page.getByRole("navigation", { name: /primary/i })
      ).toBeVisible();
      await expect(page.locator("#main-content")).toBeVisible();
      // Security response headers are present on every route (WS3 hardening) —
      // and the pages still render, proving the CSP doesn't break the app.
      const headers = response?.headers() ?? {};
      expect(headers["x-frame-options"]).toBe("DENY");
      expect(headers["x-content-type-options"]).toBe("nosniff");
      expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    }
  });
});
