import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  listSecurityCatalogPacks,
  listUniqueSecurityCatalogToolIds
} from "@periscan/shared";

describe("SecurityCatalogManager", () => {
  it("is a pack-grouped install/uninstall catalog over 100+ tools", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/security-catalog-manager.tsx"),
      "utf8"
    );
    expect(source).toMatch(/Install pack/);
    expect(source).toMatch(/Uninstall pack/);
    expect(source).toMatch(/install-open-pack/);
    expect(source).toMatch(/uninstallThirdPartyTool/);
    expect(source).toMatch(/isEngineLabTheaterToolId/);
    expect(listUniqueSecurityCatalogToolIds().length).toBeGreaterThanOrEqual(
      100
    );
    expect(listSecurityCatalogPacks().map((pack) => pack.packId)).toEqual(
      expect.arrayContaining([
        "secrets",
        "sast",
        "sca",
        "iac",
        "containers",
        "cloud",
        "recon",
        "web",
        "tls",
        "detection"
      ])
    );
  });
});
