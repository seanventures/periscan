import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = join(process.cwd());
const pagePath = join(webRoot, "app/attack-navigator/page.tsx");
const workbenchPath = join(
  webRoot,
  "src/components/attack-navigator-workbench.tsx"
);
const helperPath = join(webRoot, "src/lib/attack-navigator-workbench.ts");
const controlsPath = join(webRoot, "src/components/controls-workbench.tsx");
const controlValidationPath = join(
  webRoot,
  "src/components/control-validation-workbench.tsx"
);
const labsPortalPath = join(webRoot, "src/lib/labs-portal.ts");

/**
 * PERISCAN-591: /attack-navigator is an import/export overlay of tested /
 * detected / blocked / stale distinctions. Imported Navigator content is not
 * executed coverage and must never read as 100% ATT&CK or live Atomic.
 */
describe("ATT&CK Navigator overlay honesty", () => {
  it("keeps overlay copy on the 591 honesty floor and secondary-links the workbench", () => {
    const page = readFileSync(pagePath, "utf8");
    const workbench = readFileSync(workbenchPath, "utf8");
    const helper = readFileSync(helperPath, "utf8");
    const controls = readFileSync(controlsPath, "utf8");
    const controlValidation = readFileSync(controlValidationPath, "utf8");
    const labsPortal = readFileSync(labsPortalPath, "utf8");
    const combined = `${page}\n${workbench}\n${helper}`;

    expect(combined).toMatch(/not executed coverage/i);
    expect(combined).toMatch(/not 100% ATT&CK/i);
    expect(combined).toMatch(/not the complete MITRE catalog/i);
    expect(combined).toMatch(/scenario execution requires qualification/i);
    expect(combined).toMatch(/tested/);
    expect(combined).toMatch(/detected/);
    expect(combined).toMatch(/blocked/);
    expect(combined).toMatch(/stale/);
    expect(combined).not.toMatch(/live Atomic/i);
    expect(combined).not.toMatch(/full ATT&CK BAS library/i);
    expect(combined).not.toMatch(/complete ATT&CK BAS parity/i);
    expect(combined).not.toMatch(/PERISCAN_LIVE_OFFENSIVE\s*=\s*1/);
    expect(combined).toMatch(/supported scenarios, window/);
    expect(combined).not.toMatch(/coverage-ring/);
    expect(combined).not.toMatch(/coveragePercent/);
    expect(combined).not.toMatch(/100% ATT&CK coverage/i);

    expect(controls).toMatch(/href=["']\/attack-navigator["']/);
    expect(controlValidation).toMatch(/href=["']\/attack-navigator["']/);
    expect(labsPortal).toMatch(/href:\s*["']\/attack-navigator["']/);
  });
});
