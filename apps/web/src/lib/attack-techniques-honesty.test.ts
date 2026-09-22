import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const webRoot = join(process.cwd());
const pagePath = join(webRoot, "app/attack-techniques/page.tsx");
const catalogPath = join(
  webRoot,
  "src/components/attack-techniques-catalog.tsx"
);

/**
 * PERISCAN-490: /attack-techniques is a curated safe-example overlay of
 * tenant control-validation coverage. It must never read as a complete
 * MITRE catalog, 100% ATT&CK, or a BAS library.
 */
describe("ATT&CK overlay honesty", () => {
  it("keeps curated-subset copy and denies full ATT&CK / BAS library parity", () => {
    const page = readFileSync(pagePath, "utf8");
    const catalog = readFileSync(catalogPath, "utf8");
    const combined = `${page}\n${catalog}`;

    expect(page).toMatch(/curated safe-example subset/i);
    expect(page).toMatch(/control-validation coverage/i);
    expect(page).toMatch(/not the complete MITRE catalog/i);
    expect(combined).toMatch(/not 100% ATT&CK/i);
    expect(combined).toMatch(/scenario execution requires qualification/i);
    expect(combined).not.toMatch(/live Atomic/i);
    expect(combined).not.toMatch(/full ATT&CK BAS library/i);
    expect(combined).not.toMatch(/complete ATT&CK BAS parity/i);
  });
});
