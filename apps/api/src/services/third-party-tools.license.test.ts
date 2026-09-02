import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  getOpenSourceToolCatalogEntryWithRuntime,
  getOpenSourceToolDefinition
} from "@periscan/modules";

import {
  computeToolLicenseTextHash,
  isEnableHardBlocked,
  isInstallHardBlocked
} from "./third-party-tools.js";

describe("tool license acceptance helpers", () => {
  it("hashes the ceremony payload deterministically for a pin", () => {
    const tool = getOpenSourceToolDefinition("semgrep");
    expect(tool).toBeDefined();
    expect(tool?.policyStatus).toBe("RequiresLegalReview");

    const version = tool!.defaultVersion;
    const spdx = tool!.license;
    const hash = computeToolLicenseTextHash({
      docsUrl: tool!.docsUrl,
      spdx,
      toolId: tool!.toolId,
      version
    });

    expect(hash).toBe(
      createHash("sha256")
        .update(
          [
            tool!.toolId,
            version,
            spdx,
            tool!.docsUrl,
            "upstream-not-redistributed-by-periscan"
          ].join("|"),
          "utf8"
        )
        .digest("hex")
    );
    expect(hash).toMatch(/^[a-f0-9]{64}$/u);

    const otherVersion = computeToolLicenseTextHash({
      docsUrl: tool!.docsUrl,
      spdx,
      toolId: tool!.toolId,
      version: `${version}-next`
    });
    expect(otherVersion).not.toBe(hash);
  });

  it("never offers install or enable for Engine Lab theater tools", async () => {
    for (const toolId of [
      "sqlmap",
      "sharphound",
      "atomic-red-team",
      "caldera",
      "metasploit"
    ] as const) {
      const entry = await getOpenSourceToolCatalogEntryWithRuntime(toolId);
      expect(entry, toolId).toBeTruthy();
      expect(isInstallHardBlocked(entry!), toolId).toBe(true);
      expect(isEnableHardBlocked(entry!), toolId).toBe(true);
    }
  });

  it("still allows GPL Engine Lab install after license accept (Semgrep is not theater)", async () => {
    const entry = await getOpenSourceToolCatalogEntryWithRuntime("semgrep");
    expect(entry).toBeTruthy();
    expect(isInstallHardBlocked(entry!)).toBe(false);
  });
});
