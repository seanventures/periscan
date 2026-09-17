import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { SOC_DARK_STORAGE_KEY } from "./app-shell";

describe("SOC dark cockpit (UX-W5 / 196)", () => {
  it("uses periscan-soc-dark localStorage key off by default", () => {
    expect(SOC_DARK_STORAGE_KEY).toBe("periscan-soc-dark");
  });

  it("wires shell toggle, body class, and bloom-reducing CSS", () => {
    const shell = readFileSync(
      path.join(__dirname, "app-shell.tsx"),
      "utf8"
    );
    const css = readFileSync(
      path.join(__dirname, "../../app/globals.css"),
      "utf8"
    );

    expect(shell).toContain('data-testid="soc-dark-toggle"');
    expect(shell).toContain("soc-dark-cockpit");
    expect(shell).toContain("SOC_DARK_STORAGE_KEY");
    expect(shell).toContain("ClaimGuardHud");
    expect(css).toMatch(/body\.soc-dark-cockpit/);
    expect(css).toMatch(/background-image:\s*none/);
  });
});
