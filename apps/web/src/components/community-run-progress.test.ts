import { describe, expect, it } from "vitest";

import {
  COMMUNITY_RUN_COMPLETED_FIXED_COPY,
  COMMUNITY_RUN_POLL_INTERVAL_MS,
  COMMUNITY_RUN_REVIEW_FINDINGS_LABEL,
  communityFindingsHref,
  communityMissionHref,
  communityMissionStatusCopy,
  communityModuleLabel,
  communityRunElapsedLabel,
  communityRunGroups
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

describe("Community completed Watch copy", () => {
  it("names the Review findings CTA and Fixed-requires-retest honesty", () => {
    expect(COMMUNITY_RUN_REVIEW_FINDINGS_LABEL).toBe("Review findings");
    expect(COMMUNITY_RUN_COMPLETED_FIXED_COPY).toBe(
      "Finished — Fixed still requires a retest."
    );
  });
});
