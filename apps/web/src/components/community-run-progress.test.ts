import { describe, expect, it } from "vitest";

import {
  COMMUNITY_HOME_WATCH_DWELL_MS,
  COMMUNITY_HOME_WATCH_WALKER_HOLD_MS,
  COMMUNITY_HOME_WATCH_WALKER_MAX_VISIBLE_MS,
  COMMUNITY_HOME_WATCH_WALKER_MIN_VISIBLE_MS,
  COMMUNITY_HOME_WATCH_WALKER_WAIT_IDLE_MS,
  COMMUNITY_RUN_COMPLETED_FIXED_COPY,
  COMMUNITY_RUN_POLL_INTERVAL_MS,
  COMMUNITY_RUN_REVIEW_FINDINGS_LABEL,
  COMMUNITY_RUN_WATCH_LABEL,
  accumulateCommunityHomeWatchDwellVisibleMs,
  communityFindingsHref,
  communityHomeWatchAllowsAutoNav,
  communityHomeWatchDwellRemainingMs,
  communityHomeWatchShouldStart,
  communityMissionHref,
  communityMissionStatusCopy,
  communityModuleLabel,
  communityRunElapsedLabel,
  communityRunGroups,
  communityRunHasEvidence,
  communityWatchPollMs,
  formatCommunityFindingPathRule,
  readCommunityHomeWatchDwellRecord,
  readCommunityHomeWatchDwellStartedAtMs,
  resolveCommunityHomeWatchDwellMount,
  resolveCommunityHomeWatchDwellStartedAtMs,
  scoreHomeWatchDwellSamples,
  writeCommunityHomeWatchDwellRecord,
  writeCommunityHomeWatchDwellStartedAtMs
} from "./community-run-progress";

describe("communityModuleLabel", () => {
  it("uses the Community suite title when the module is in the pack", () => {
    expect(communityModuleLabel("gitleaks.repo_secrets")).toBe(
      "Repository secret scan"
    );
    expect(communityModuleLabel("periscan.dns_resolution_check")).toBe(
      "DNS resolution"
    );
    expect(communityModuleLabel("nuclei.external_exposure_safe")).toBe(
      "Nuclei safe external exposure"
    );
  });

  it("falls back to a readable module id when the engine is not in the suite", () => {
    expect(communityModuleLabel("vendor.foo_bar")).toBe("Vendor · Foo Bar");
    expect(communityModuleLabel("periscan.unknownCamelCheck")).toBe(
      "Unknown Camel Check"
    );
  });
});

describe("communityRunGroups", () => {
  const primaryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const nucleiId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

  it("lists only the primary mission when Nuclei did not start", () => {
    expect(
      communityRunGroups({
        missionId: primaryId,
        nucleiMissionId: null
      })
    ).toEqual([
      {
        kind: "primary",
        missionId: primaryId,
        title: "Community mission"
      }
    ]);
  });

  it("adds Nuclei as a second run group when a second mission id is present", () => {
    expect(
      communityRunGroups({
        missionId: primaryId,
        nucleiMissionId: nucleiId
      })
    ).toEqual([
      {
        kind: "primary",
        missionId: primaryId,
        title: "Community mission"
      },
      {
        kind: "nuclei",
        missionId: nucleiId,
        title: "Nuclei second mission"
      }
    ]);
  });
});

describe("communityMissionStatusCopy", () => {
  it("explains live mission statuses without inventing progress", () => {
    expect(communityMissionStatusCopy("Queued")).toBe(
      "Queued — waiting for a runner or control plane."
    );
    expect(communityMissionStatusCopy("Running")).toBe(
      "Running — engines are executing."
    );
    expect(communityMissionStatusCopy("Completed")).toMatch(
      /evidence|findings/i
    );
    expect(communityMissionStatusCopy("Failed")).toBe(
      "Failed — inspect run errors below."
    );
    expect(communityMissionStatusCopy("DeniedByPolicy")).toBe(
      "Denied by policy — this work was never queued."
    );
    expect(communityMissionStatusCopy("RequiresApproval")).toBe(
      "Requires approval — no work is queued until approved."
    );
    expect(communityMissionStatusCopy("Cancelled")).toBe("Cancelled.");
    expect(communityMissionStatusCopy("Draft")).toBe("Draft — not started.");
  });

  it("echoes unknown statuses instead of inventing a state", () => {
    expect(communityMissionStatusCopy("UnexpectedStatus")).toBe(
      "UnexpectedStatus"
    );
  });

  it("completed copy names evidence/findings next step", () => {
    expect(communityMissionStatusCopy("Completed")).toMatch(
      /evidence|findings/i
    );
  });
});

describe("communityRunElapsedLabel", () => {
  const startedAt = "2026-08-15T12:00:00.000Z";

  it("formats elapsed from startedAt without inventing percent-complete", () => {
    expect(
      communityRunElapsedLabel(
        startedAt,
        Date.parse("2026-08-15T12:00:03.000Z")
      )
    ).toBe("3s");
    expect(
      communityRunElapsedLabel(
        startedAt,
        Date.parse("2026-08-15T12:01:05.000Z")
      )
    ).toBe("1m 5s");
    expect(
      communityRunElapsedLabel(
        startedAt,
        Date.parse("2026-08-15T12:00:00.000Z")
      )
    ).toBe("0s");
  });

  it("returns null when there is no start timestamp to measure", () => {
    expect(communityRunElapsedLabel(null, Date.parse(startedAt))).toBeNull();
    expect(
      communityRunElapsedLabel(undefined, Date.parse(startedAt))
    ).toBeNull();
    expect(
      communityRunElapsedLabel("not-a-date", Date.parse(startedAt))
    ).toBeNull();
  });
});

describe("communityFindingsHref", () => {
  it("scopes Findings to this Community mission's evidence", () => {
    expect(communityFindingsHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(
      "/findings?missionId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
  });
});

describe("communityMissionHref", () => {
  it("links to the mission detail route", () => {
    expect(communityMissionHref("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toBe(
      "/missions/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
  });
});

describe("COMMUNITY_RUN_POLL_INTERVAL_MS", () => {
  it("polls at 1s while a Community run is in flight", () => {
    expect(COMMUNITY_RUN_POLL_INTERVAL_MS).toBe(1000);
  });
});

describe("community Watch until evidence", () => {
  it("names the beat Watch, not a percent or Command Center", () => {
    expect(COMMUNITY_RUN_WATCH_LABEL).toBe("Watch");
  });

  it("keeps 1s poll until evidence exists; stops after evidence or a failed run", () => {
    expect(
      communityWatchPollMs({ status: "Running", hasEvidence: false })
    ).toBe(1000);
    expect(communityWatchPollMs({ status: "Queued", hasEvidence: false })).toBe(
      1000
    );
    expect(
      communityWatchPollMs({ status: "Completed", hasEvidence: false })
    ).toBe(1000);
    expect(
      communityWatchPollMs({ status: "Completed", hasEvidence: true })
    ).toBeUndefined();
    expect(
      communityWatchPollMs({ status: "Failed", hasEvidence: false })
    ).toBeUndefined();
  });

  it("treats mission or run evidence ids as evidence, never severity", () => {
    expect(
      communityRunHasEvidence({
        missionEvidenceIds: [],
        runs: [{ evidenceIds: [] }]
      })
    ).toBe(false);
    expect(
      communityRunHasEvidence({
        missionEvidenceIds: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"],
        runs: [{ evidenceIds: [] }]
      })
    ).toBe(true);
    expect(
      communityRunHasEvidence({
        missionEvidenceIds: [],
        runs: [{ evidenceIds: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"] }]
      })
    ).toBe(true);
  });
});

describe("Community completed Watch copy", () => {
  it("names the Review findings CTA and Fixed-requires-retest honesty", () => {
    expect(COMMUNITY_RUN_REVIEW_FINDINGS_LABEL).toBe("Review findings");
    expect(COMMUNITY_RUN_COMPLETED_FIXED_COPY).toBe(
      "Finished — Fixed still requires a retest."
    );
  });
});

describe("P2-WATCH Home dwell after jobsQueued=1 evidence", () => {
  const evidenceAtMs = 1_700_000_000_000;

  it("is a 1–2s measured beat, not a percent and not a 1s poll after evidence", () => {
    expect(COMMUNITY_HOME_WATCH_DWELL_MS).toBeGreaterThanOrEqual(1_000);
    expect(COMMUNITY_HOME_WATCH_DWELL_MS).toBeLessThanOrEqual(2_000);
    expect(
      communityWatchPollMs({ status: "Completed", hasEvidence: true })
    ).toBeUndefined();
    expect(
      communityWatchPollMs({ status: "Running", hasEvidence: true })
    ).toBeUndefined();
  });

  it("formats the CLI-shaped path · rule locator", () => {
    expect(
      formatCommunityFindingPathRule({
        location: "leaked.js:2",
        ruleId: "slack-bot-token",
        title: "Secret leaked"
      })
    ).toBe("leaked.js:2 · slack-bot-token");
    expect(
      formatCommunityFindingPathRule({
        title: "leaked.js:2 · slack-bot-token"
      })
    ).toBe("leaked.js:2 · slack-bot-token");
  });

  it("holds auto-nav until Home has shown evidence for the dwell", () => {
    const base = {
      jobsQueued: 1,
      hasEvidence: true,
      evidenceAtMs
    };
    expect(
      communityHomeWatchDwellRemainingMs({ ...base, nowMs: evidenceAtMs })
    ).toBe(COMMUNITY_HOME_WATCH_DWELL_MS);
    expect(
      communityHomeWatchAllowsAutoNav({
        ...base,
        nowMs: evidenceAtMs + 999
      })
    ).toBe(false);
    expect(
      communityHomeWatchDwellRemainingMs({
        ...base,
        nowMs: evidenceAtMs + 999
      })
    ).toBeGreaterThan(0);
    expect(
      communityHomeWatchAllowsAutoNav({
        ...base,
        nowMs: evidenceAtMs + COMMUNITY_HOME_WATCH_DWELL_MS
      })
    ).toBe(true);
    expect(
      communityHomeWatchDwellRemainingMs({
        ...base,
        nowMs: evidenceAtMs + COMMUNITY_HOME_WATCH_DWELL_MS
      })
    ).toBe(0);
  });

  it("does not dwell without jobsQueued=1 evidence", () => {
    expect(
      communityHomeWatchShouldStart({
        jobsQueued: 41,
        hasEvidence: true,
        findingCreatedAtMs: evidenceAtMs,
        nowMs: evidenceAtMs,
        source: "gitleaks.repo_secrets",
        displayValidationState: "Validated"
      })
    ).toBe(false);
    expect(
      communityHomeWatchShouldStart({
        jobsQueued: 1,
        hasEvidence: false,
        findingCreatedAtMs: evidenceAtMs,
        nowMs: evidenceAtMs,
        source: "gitleaks.repo_secrets",
        displayValidationState: "Validated"
      })
    ).toBe(false);
    expect(
      communityHomeWatchAllowsAutoNav({
        jobsQueued: 1,
        hasEvidence: false,
        evidenceAtMs,
        nowMs: evidenceAtMs
      })
    ).toBe(true);
  });

  it("starts a Home Watch dwell for a fresh Gitleaks VALIDATED finding", () => {
    expect(
      communityHomeWatchShouldStart({
        jobsQueued: 1,
        hasEvidence: true,
        findingCreatedAtMs: evidenceAtMs,
        nowMs: evidenceAtMs + 3_000,
        source: "gitleaks.repo_secrets",
        displayValidationState: "Validated"
      })
    ).toBe(true);
    expect(
      communityHomeWatchShouldStart({
        jobsQueued: 1,
        hasEvidence: true,
        findingCreatedAtMs: evidenceAtMs,
        nowMs: evidenceAtMs + 10 * 60 * 1_000,
        source: "gitleaks.repo_secrets",
        displayValidationState: "Validated"
      })
    ).toBe(false);
  });
});

describe("P3-DWELLREMNT Home Watch dwell once per evidence", () => {
  const findingId = "finding-gitleaks-1";
  const otherFindingId = "finding-gitleaks-2";
  const t0 = 1_700_000_000_000;

  function memoryStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
      getItem: (key: string): string | null => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      }
    };
  }

  it("reuses persisted startedAt so a remount does not restart the 1.5s beat", () => {
    const storage = memoryStorage();
    const first = resolveCommunityHomeWatchDwellStartedAtMs({
      nowMs: t0,
      shouldStart: true,
      storedStartedAtMs: readCommunityHomeWatchDwellStartedAtMs(
        storage,
        findingId
      )
    });
    expect(first.shouldPersist).toBe(true);
    expect(first.startedAtMs).toBe(t0);
    writeCommunityHomeWatchDwellStartedAtMs(
      storage,
      findingId,
      first.startedAtMs ?? t0
    );

    const remountMid = resolveCommunityHomeWatchDwellStartedAtMs({
      nowMs: t0 + 500,
      shouldStart: true,
      storedStartedAtMs: readCommunityHomeWatchDwellStartedAtMs(
        storage,
        findingId
      )
    });
    expect(remountMid.shouldPersist).toBe(false);
    expect(remountMid.startedAtMs).toBe(t0);
    expect(
      communityHomeWatchDwellRemainingMs({
        evidenceAtMs: remountMid.startedAtMs,
        hasEvidence: true,
        jobsQueued: 1,
        nowMs: t0 + 500
      })
    ).toBe(COMMUNITY_HOME_WATCH_DWELL_MS - 500);

    const remountAfter = resolveCommunityHomeWatchDwellStartedAtMs({
      nowMs: t0 + COMMUNITY_HOME_WATCH_DWELL_MS + 10_000,
      shouldStart: true,
      storedStartedAtMs: readCommunityHomeWatchDwellStartedAtMs(
        storage,
        findingId
      )
    });
    expect(remountAfter.shouldPersist).toBe(false);
    expect(remountAfter.startedAtMs).toBe(t0);
    expect(
      communityHomeWatchDwellRemainingMs({
        evidenceAtMs: remountAfter.startedAtMs,
        hasEvidence: true,
        jobsQueued: 1,
        nowMs: t0 + COMMUNITY_HOME_WATCH_DWELL_MS + 10_000
      })
    ).toBe(0);
  });

  it("starts a new 1.5s dwell for a different Community evidence findingId", () => {
    const storage = memoryStorage();
    writeCommunityHomeWatchDwellStartedAtMs(storage, findingId, t0);
    const other = resolveCommunityHomeWatchDwellStartedAtMs({
      nowMs: t0 + 8_000,
      shouldStart: true,
      storedStartedAtMs: readCommunityHomeWatchDwellStartedAtMs(
        storage,
        otherFindingId
      )
    });
    expect(other.shouldPersist).toBe(true);
    expect(other.startedAtMs).toBe(t0 + 8_000);
    expect(
      communityHomeWatchDwellRemainingMs({
        evidenceAtMs: other.startedAtMs,
        hasEvidence: true,
        jobsQueued: 1,
        nowMs: t0 + 8_000
      })
    ).toBe(COMMUNITY_HOME_WATCH_DWELL_MS);
  });

  it("does not reintroduce a 1s Watch poll after evidence", () => {
    expect(
      communityWatchPollMs({ status: "Completed", hasEvidence: true })
    ).toBeUndefined();
    expect(
      communityWatchPollMs({ status: "Running", hasEvidence: true })
    ).toBeUndefined();
  });
});

describe("Home Watch dwell when walker navigates immediately after evidence", () => {
  const findingId = "finding-gitleaks-walker";
  const t0 = 1_700_000_000_000;

  function memoryStorage(initial: Record<string, string> = {}) {
    const data = { ...initial };
    return {
      getItem: (key: string): string | null => data[key] ?? null,
      setItem: (key: string, value: string) => {
        data[key] = value;
      }
    };
  }

  it("does not waitIdle before sampling and holds a 1–2s visible window", () => {
    expect(COMMUNITY_HOME_WATCH_WALKER_WAIT_IDLE_MS).toBe(0);
    expect(COMMUNITY_HOME_WATCH_WALKER_HOLD_MS).toBeGreaterThanOrEqual(
      COMMUNITY_HOME_WATCH_WALKER_MIN_VISIBLE_MS
    );
    expect(COMMUNITY_HOME_WATCH_WALKER_HOLD_MS).toBeLessThanOrEqual(
      COMMUNITY_HOME_WATCH_WALKER_MAX_VISIBLE_MS
    );
    expect(COMMUNITY_HOME_WATCH_WALKER_MIN_VISIBLE_MS).toBe(1_000);
    expect(COMMUNITY_HOME_WATCH_WALKER_MAX_VISIBLE_MS).toBe(2_500);
  });

  it("keeps ≥1s remaining after 0ms visible then 5s away", () => {
    const storage = memoryStorage();
    writeCommunityHomeWatchDwellRecord(storage, findingId, {
      startedAtMs: t0,
      visibleMs: 0
    });
    const remountAt = t0 + 5_000;
    const remount = resolveCommunityHomeWatchDwellMount({
      nowMs: remountAt,
      shouldStart: true,
      stored: readCommunityHomeWatchDwellRecord(storage, findingId)
    });
    expect(remount.thisMountAtMs).toBe(remountAt);
    expect(remount.accumulatedVisibleMs).toBe(0);
    expect(
      communityHomeWatchDwellRemainingMs({
        accumulatedVisibleMs: remount.accumulatedVisibleMs,
        evidenceAtMs: remount.thisMountAtMs,
        hasEvidence: true,
        jobsQueued: 1,
        nowMs: remountAt
      })
    ).toBe(COMMUNITY_HOME_WATCH_DWELL_MS);
    expect(
      communityHomeWatchDwellRemainingMs({
        accumulatedVisibleMs: remount.accumulatedVisibleMs,
        evidenceAtMs: remount.thisMountAtMs,
        hasEvidence: true,
        jobsQueued: 1,
        nowMs: remountAt + 999
      })
    ).toBeGreaterThan(0);
    expect(
      communityHomeWatchAllowsAutoNav({
        accumulatedVisibleMs: remount.accumulatedVisibleMs,
        evidenceAtMs: remount.thisMountAtMs,
        hasEvidence: true,
        jobsQueued: 1,
        nowMs: remountAt + 999
      })
    ).toBe(false);
  });

  it("accumulates only visible Home time, not wall clock while away", () => {
    expect(
      accumulateCommunityHomeWatchDwellVisibleMs({
        accumulatedVisibleMs: 0,
        nowMs: t0 + 80,
        thisMountAtMs: t0
      })
    ).toBe(80);
    const remount = resolveCommunityHomeWatchDwellMount({
      nowMs: t0 + 5_000,
      shouldStart: true,
      stored: { startedAtMs: t0, visibleMs: 80 }
    });
    expect(
      communityHomeWatchDwellRemainingMs({
        accumulatedVisibleMs: remount.accumulatedVisibleMs,
        evidenceAtMs: remount.thisMountAtMs,
        hasEvidence: true,
        jobsQueued: 1,
        nowMs: t0 + 5_000
      })
    ).toBe(COMMUNITY_HOME_WATCH_DWELL_MS - 80);
  });

  it("does not replay after 1.5s visible even if the walker remounts later", () => {
    const remount = resolveCommunityHomeWatchDwellMount({
      nowMs: t0 + 20_000,
      shouldStart: true,
      stored: {
        startedAtMs: t0,
        visibleMs: COMMUNITY_HOME_WATCH_DWELL_MS
      }
    });
    expect(
      communityHomeWatchDwellRemainingMs({
        accumulatedVisibleMs: remount.accumulatedVisibleMs,
        evidenceAtMs: remount.thisMountAtMs,
        hasEvidence: true,
        jobsQueued: 1,
        nowMs: t0 + 20_000
      })
    ).toBe(0);
    expect(communityHomeWatchAllowsAutoNav({
      accumulatedVisibleMs: remount.accumulatedVisibleMs,
      evidenceAtMs: remount.thisMountAtMs,
      hasEvidence: true,
      jobsQueued: 1,
      nowMs: t0 + 20_000
    })).toBe(true);
  });

  it("does not reintroduce a 1s Watch poll after evidence", () => {
    expect(
      communityWatchPollMs({ status: "Completed", hasEvidence: true })
    ).toBeUndefined();
    expect(
      communityWatchPollMs({ status: "Running", hasEvidence: true })
    ).toBeUndefined();
    expect(COMMUNITY_RUN_POLL_INTERVAL_MS).toBe(1_000);
  });

  it("scores walker samples that navigate immediately after ≥1s Watch + VALIDATED", () => {
    const samples = [];
    for (let t = 0; t <= 1_080; t += 120) {
      samples.push({
        dwell_present: true,
        finding_locator: "leaked.js:2 · slack-bot-token",
        has_path_rule: true,
        has_percent: false,
        has_validated: true,
        header_sign_in: false,
        t_ms: t,
        watch_label: "Watch"
      });
    }
    samples.push({
      dwell_present: false,
      finding_locator: null,
      has_path_rule: false,
      has_percent: false,
      has_validated: false,
      header_sign_in: false,
      t_ms: 1_200,
      watch_label: null
    });
    const score = scoreHomeWatchDwellSamples(samples);
    expect(score.dwell_observed).toBe(true);
    expect(score.validated_path_rule_observed).toBe(true);
    expect(score.watch_is_watch).toBe(true);
    expect(score.visible_span_ms).toBeGreaterThanOrEqual(1_000);
    expect(score.visible_span_ms).toBeLessThanOrEqual(2_500);
    expect(score.no_percent).toBe(true);
    expect(score.header_sign_in).toBe(false);
    expect(score.dwell_ok).toBe(true);
    expect(score.finding_locator).toBe("leaked.js:2 · slack-bot-token");
  });
});
