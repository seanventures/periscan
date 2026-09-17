import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Activating lifecycle rail: Findings/Remediation discoverable (prior P02-8);
 * /validation-ops stays deep-link only (P07-8 / P01-6).
 */
describe("ACTIVATING_TENANT_NAV", () => {
  it("includes findings and remediation destinations", () => {
    const source = readFileSync(
      path.join(__dirname, "app-shell.tsx"),
      "utf8"
    );
    const block = source.match(
      /const ACTIVATING_TENANT_NAV = new Set\(\[([\s\S]*?)\]\);/
    );
    expect(block).not.toBeNull();
    const body = block![1];
    expect(body).toMatch(/"\/findings"/);
    expect(body).toMatch(/"\/remediation"/);
  });

  it("does not teach nav-less /validation-ops (P07-8 / P01-6)", () => {
    const source = readFileSync(
      path.join(__dirname, "app-shell.tsx"),
      "utf8"
    );
    const block = source.match(
      /const ACTIVATING_TENANT_NAV = new Set\(\[([\s\S]*?)\]\);/
    );
    expect(block).not.toBeNull();
    expect(block![1]).not.toMatch(/"\/validation-ops"/);
  });
});
