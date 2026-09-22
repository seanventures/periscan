import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID
} from "@periscan/shared";

import { ATOMIC_HOSTNAME_LAB } from "./bas-local-lab.js";
import {
  checkManagedSecurityFeeds,
  listToolchainBoundSecurityFeeds
} from "./security-feed-updater.js";
import { getOpenSourceToolDefinition } from "./toolchain.js";

const CHECKED_AT = "2026-09-17T15:00:00.000Z";
const UPDATER_SOURCE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "security-feed-updater.ts"
);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("managed security feed updater (modules worker helper)", () => {
  it("binds registry pins to toolchain, Atomic SHA, and Caldera ability hashes", () => {
    const feeds = listToolchainBoundSecurityFeeds();
    const byId = Object.fromEntries(feeds.map((feed) => [feed.id, feed]));

    expect(byId.gitleaks?.pin.value).toBe(
      getOpenSourceToolDefinition("gitleaks")?.defaultVersion
    );
    expect(byId["nuclei-templates"]?.pin.value).toBe(
      getOpenSourceToolDefinition("nuclei-templates")?.defaultVersion
    );
    expect(byId.sigma?.pin.value).toBe(
      getOpenSourceToolDefinition("sigma")?.defaultVersion
    );
    expect(byId.yara?.pin.value).toBe(
      getOpenSourceToolDefinition("yara")?.defaultVersion
    );

    expect(byId["atomic-yaml"]?.pin.value).toBe(
      ATOMIC_HOSTNAME_LAB.sourceRevision
    );
    expect(byId["atomic-yaml"]?.lastDigest).toBe(
      ATOMIC_HOSTNAME_LAB.contentSha256
    );
    expect(byId["atomic-yaml"]?.executablePin).toBe(false);

    const expectedAbilityDigest = sha256(
      [
        PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
        PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
        PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID
      ]
        .slice()
        .sort()
        .join(",")
    );
    expect(byId["caldera-abilities"]?.lastDigest).toBe(expectedAbilityDigest);
    expect(byId["caldera-abilities"]?.liveSupported).toBe(false);

    expect(byId.nvd?.threatIntelSourceKey).toBe("nvd");
    expect(byId["cisa-kev"]?.threatIntelSourceKey).toBe("cisa-kev");
  });

  it("does not auto-flip executable toolchain pins when upstream is newer", () => {
    const gitleaksBefore =
      getOpenSourceToolDefinition("gitleaks")?.defaultVersion;
    const nucleiBefore =
      getOpenSourceToolDefinition("nuclei-templates")?.defaultVersion;

    const results = checkManagedSecurityFeeds({
      checkedAt: CHECKED_AT,
      byFeedId: {
        gitleaks: { upstreamVersion: "v9.0.0" },
        "nuclei-templates": { upstreamVersion: "v10.9.9" }
      }
    });

    const gitleaks = results.find((item) => item.feedId === "gitleaks");
    expect(gitleaks?.contentVersionStatus).toBe("PendingReview");
    expect(gitleaks?.recordedPin.value).toBe(gitleaksBefore);
    expect(gitleaks?.executablePinFlipped).toBe(false);

    const nuclei = results.find((item) => item.feedId === "nuclei-templates");
    expect(nuclei?.contentVersionStatus).toBe("PendingReview");
    expect(nuclei?.recordedPin.value).toBe(nucleiBefore);
    expect(nuclei?.executablePinFlipped).toBe(false);

    expect(getOpenSourceToolDefinition("gitleaks")?.defaultVersion).toBe(
      gitleaksBefore
    );
    expect(
      getOpenSourceToolDefinition("nuclei-templates")?.defaultVersion
    ).toBe(nucleiBefore);
  });

  it("fails closed for DRL rustinel-rules in the default pack and never evals YAML", () => {
    const source = readFileSync(UPDATER_SOURCE, "utf8");
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/\byaml\.parse\b/);
    expect(source).not.toMatch(/\bexecFile\b/);
    expect(source).not.toMatch(/\bspawn\b/);

    const results = checkManagedSecurityFeeds({
      checkedAt: CHECKED_AT,
      yamlAttempts: {
        "rustinel-rules": "run: curl | sh",
        "atomic-yaml": "executor: sh\ncommand: whoami"
      }
    });

    const rustinel = results.find((item) => item.feedId === "rustinel-rules");
    expect(rustinel?.defaultPackDecision).toBe("fail_closed");
    expect(rustinel?.code).toBe("spdx_not_community_permissive");
    expect(rustinel?.yamlEvaluated).toBe(false);
    expect(rustinel?.executablePinFlipped).toBe(false);

    const atomic = results.find((item) => item.feedId === "atomic-yaml");
    expect(atomic?.yamlEvaluated).toBe(false);
    expect(atomic?.executablePinFlipped).toBe(false);
    expect(atomic?.liveSupported).toBe(false);
    expect(atomic?.recordedPin.value).toBe(ATOMIC_HOSTNAME_LAB.sourceRevision);
  });
});
