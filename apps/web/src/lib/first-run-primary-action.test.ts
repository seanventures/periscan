import { describe, expect, it } from "vitest";
import {
  COMMUNITY_FIRST_RUN_START_LABEL,
  type ProductActivationState
} from "@periscan/shared";

import {
  railPrimaryCompetesWithFindingsFirstHour,
  resolveCommunityReviewFindingsMissionId,
  resolveFirstRunPrimaryAction,
  resolveOptionalAwsFirstHourCta,
  homeTopFindingIsSettled,
  resolvePostFindingPrimaryAction,
  selectHomeTopFinding
} from "./first-run-primary-action";

function milestone(
  key: ProductActivationState["milestones"][number]["key"],
  state: ProductActivationState["milestones"][number]["state"]
): ProductActivationState["milestones"][number] {
  return {
    completedAt: state === "Completed" ? "2026-07-14T14:30:00.000Z" : null,
    evidenceBasis: "test",
    href: "/dashboard",
    key,
    label: key,
    stage: "Connect",
    state
  };
}

function base(
  overrides: Partial<ProductActivationState> = {}
): ProductActivationState {
  return {
    completedMilestones: 1,
    currentStage: "Connect",
    diagnostics: [],
    maturity: "New",
    measuredAt: "2026-07-14T15:00:00.000Z",
    milestones: [
      milestone("AccountCreated", "Completed"),
      milestone("SourceConnected", "Upcoming"),
      milestone("ScopeVerified", "Upcoming"),
      milestone("PolicyPreviewed", "Upcoming"),
      milestone("MissionCreated", "Upcoming"),
      milestone("MeasuredResult", "Upcoming"),
      milestone("RemediationCreated", "Upcoming"),
      milestone("Revalidated", "Upcoming"),
      milestone("ProofDelivered", "Upcoming")
    ],
    nextAction: {
      href: "/integrations",
      label: "Connect a source",
      reason: "from API"
    },
    profile: {
      completedAt: "2026-07-14T14:00:00.000Z",
      membershipId: "17171717-1717-4717-8717-171717171717",
      primaryOutcome: "RunProofLoop",
      productPersona: "SecurityEngineer",
      updatedAt: "2026-07-14T14:00:00.000Z"
    },
    totalMilestones: 9,
    ...overrides
  };
}

describe("resolveFirstRunPrimaryAction", () => {
  it("starts with authorize when no source is connected (Community does not require a vendor connector)", () => {
    const action = resolveFirstRunPrimaryAction(base());
    expect(action).toMatchObject({
      href: "/scopes",
      label: "Authorize scope",
      setupIncomplete: true
    });
    expect(action.href).toBe("/scopes");
    expect(action.label).toMatch(/Authorize scope/i);
  });

  it("keeps setupIncomplete true until source + scope + measured result", () => {
    const afterSource = resolveFirstRunPrimaryAction(
      base({
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Upcoming"),
          milestone("PolicyPreviewed", "Upcoming"),
          milestone("MissionCreated", "Upcoming"),
          milestone("MeasuredResult", "Upcoming"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(afterSource.setupIncomplete).toBe(true);
    expect(afterSource.href).toBe("/scopes");
  });

  it("moves to authorize after source is connected", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Upcoming"),
          milestone("PolicyPreviewed", "Upcoming"),
          milestone("MissionCreated", "Upcoming"),
          milestone("MeasuredResult", "Upcoming"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/scopes",
      label: "Authorize scope",
      setupIncomplete: true
    });
  });

  it("does not advertise Run when nextAction is Run but no Community engines are startable", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 2,
        nextAction: {
          href: "/missions",
          label: COMMUNITY_FIRST_RUN_START_LABEL,
          reason:
            "Community edition starts live OSS/first-party engines on verified scope."
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Upcoming"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Upcoming"),
          milestone("MissionCreated", "Upcoming"),
          milestone("MeasuredResult", "Upcoming"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      }),
      undefined,
      {
        cloudAwsAvailable: false,
        startableModuleIds: []
      }
    );
    expect(action.label).not.toBe(COMMUNITY_FIRST_RUN_START_LABEL);
    expect(action.href).toBe("/integrations");
    expect(action.label).toBe("Connect AWS");
    expect(action.reason).toMatch(/no Community engines start without AWS/i);
    expect(action.setupIncomplete).toBe(true);
  });

  it("honors API Connect AWS nextAction after a verified CloudAccount with no engines", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 2,
        nextAction: {
          href: "/integrations",
          label: "Connect AWS",
          reason:
            "No Community engines start without AWS. Connect an AWS integration to start Prowler."
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Upcoming"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Upcoming"),
          milestone("MissionCreated", "Upcoming"),
          milestone("MeasuredResult", "Upcoming"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/integrations",
      label: "Connect AWS",
      setupIncomplete: true
    });
    expect(action.label).not.toBe(COMMUNITY_FIRST_RUN_START_LABEL);
  });

  it("still advertises Run when a verified scope has startable Community engines", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 3,
        nextAction: {
          href: "/missions",
          label: COMMUNITY_FIRST_RUN_START_LABEL,
          reason: "from API"
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Current"),
          milestone("MissionCreated", "Upcoming"),
          milestone("MeasuredResult", "Upcoming"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      }),
      undefined,
      {
        cloudAwsAvailable: false,
        startableModuleIds: ["gitleaks.repo_secrets"]
      }
    );
    expect(action).toMatchObject({
      href: "/missions",
      label: COMMUNITY_FIRST_RUN_START_LABEL,
      setupIncomplete: true
    });
  });

  it("starts Community validation after source and scope when no Community mission exists", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 3,
        nextAction: {
          href: "/missions",
          label: "Preview mission policy",
          reason: "from API"
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Current"),
          milestone("MissionCreated", "Upcoming"),
          milestone("MeasuredResult", "Upcoming"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/missions",
      label: "Run Community validation",
      setupIncomplete: true
    });
  });

  it("watches an in-flight Community mission instead of starting another run", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 5,
        nextAction: {
          href: "/missions/33333333-3333-4333-8333-333333333333",
          label: "Watch Community validation",
          reason: "Community validation is already in flight."
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Completed"),
          milestone("MissionCreated", "Completed"),
          milestone("MeasuredResult", "Current"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/missions/33333333-3333-4333-8333-333333333333",
      label: "Watch Community validation",
      setupIncomplete: true
    });
  });

  it("reviews a failed Community run via the blocking diagnostic", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 5,
        diagnostics: [
          {
            code: "latest_run_failed",
            detail: "gitleaks exited 2",
            href: "/missions/44444444-4444-4444-8444-444444444444",
            severity: "Blocking",
            title: "Latest Community validation needs recovery"
          }
        ],
        nextAction: {
          href: "/missions/44444444-4444-4444-8444-444444444444",
          label: "Review failed Community run",
          reason: "gitleaks exited 2"
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Completed"),
          milestone("MissionCreated", "Completed"),
          milestone("MeasuredResult", "Current"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/missions/44444444-4444-4444-8444-444444444444",
      label: "Review failed Community run",
      reason: "gitleaks exited 2",
      setupIncomplete: true
    });
  });

  it("does not treat a non-Community failure as measured when start remains the next action", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 5,
        diagnostics: [
          {
            code: "latest_run_failed",
            detail: "catalog engine failed",
            href: "/missions/55555555-5555-4555-8555-555555555555",
            severity: "Blocking",
            title: "Latest validation needs recovery"
          }
        ],
        nextAction: {
          href: "/missions",
          label: "Run Community validation",
          reason:
            "Community edition starts live OSS/first-party engines on verified scope."
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Completed"),
          milestone("MissionCreated", "Completed"),
          milestone("MeasuredResult", "Current"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/missions",
      label: "Run Community validation",
      setupIncomplete: true
    });
  });

  it("prefers watching an in-flight Community run over an older failed diagnostic", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 5,
        diagnostics: [
          {
            code: "latest_run_failed",
            detail: "previous engine failed",
            href: "/missions/66666666-6666-4666-8666-666666666666",
            severity: "Blocking",
            title: "Latest Community validation needs recovery"
          }
        ],
        nextAction: {
          href: "/missions/77777777-7777-4777-8777-777777777777",
          label: "Watch Community validation",
          reason: "Community validation is already in flight."
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Completed"),
          milestone("MissionCreated", "Completed"),
          milestone("MeasuredResult", "Current"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/missions/77777777-7777-4777-8777-777777777777",
      label: "Watch Community validation",
      setupIncomplete: true
    });
  });

  it("does not send the user to Connect a source after MeasuredResult when SourceConnected is still incomplete", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 5,
        nextAction: {
          href: "/integrations",
          label: "Connect a source",
          reason: "from API"
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Upcoming"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Completed"),
          milestone("MissionCreated", "Completed"),
          milestone("MeasuredResult", "Completed"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action.href).not.toBe("/integrations");
    expect(action.label).not.toMatch(/Connect a source/i);
    expect(["/findings", "/remediation"]).toContain(action.href);
    expect(action.label).toMatch(/findings|remediation|fix|verify/i);
  });

  it("uses API nextAction after the three setup steps complete", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 6,
        nextAction: {
          href: "/remediation",
          label: "Assign remediation",
          reason: "act"
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Completed"),
          milestone("MissionCreated", "Completed"),
          milestone("MeasuredResult", "Completed"),
          milestone("RemediationCreated", "Current"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/remediation",
      label: "Assign remediation",
      setupIncomplete: false
    });
  });

  it("does not keep Run Community validation as the primary after MeasuredResult", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 6,
        nextAction: {
          href: "/missions",
          label: COMMUNITY_FIRST_RUN_START_LABEL,
          reason:
            "Community edition starts live OSS/first-party engines on verified scope."
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Upcoming"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Completed"),
          milestone("MissionCreated", "Completed"),
          milestone("MeasuredResult", "Completed"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      })
    );
    expect(action).toMatchObject({
      href: "/findings",
      label: "Review findings",
      setupIncomplete: false
    });
    expect(action.label).not.toBe(COMMUNITY_FIRST_RUN_START_LABEL);
  });

  it("falls back to persona action when activation is complete", () => {
    const action = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 9,
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Completed"),
          milestone("MissionCreated", "Completed"),
          milestone("MeasuredResult", "Completed"),
          milestone("RemediationCreated", "Completed"),
          milestone("Revalidated", "Completed"),
          milestone("ProofDelivered", "Completed")
        ]
      }),
      { href: "/executive", label: "Review posture" }
    );
    expect(action).toMatchObject({
      href: "/executive",
      label: "Review posture",
      setupIncomplete: false
    });
  });
});

describe("resolveOptionalAwsFirstHourCta", () => {
  it("keeps empty-tenant Home Gitleaks-only (no Prowler second primary)", () => {
    expect(
      resolveOptionalAwsFirstHourCta({ cloudAwsAvailable: false })
    ).toBeNull();
    const empty = resolveFirstRunPrimaryAction(base());
    expect(empty.label).not.toMatch(/Prowler/i);
    expect(empty.label).not.toMatch(/Assess connected AWS/i);
  });

  it("adds Assess connected AWS (Prowler) next to Gitleaks when AWS is Connected", () => {
    const cta = resolveOptionalAwsFirstHourCta({
      cloudAwsAvailable: true,
      startableModuleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"]
    });
    expect(cta?.label).toBe("Assess connected AWS (Prowler)");
    expect(cta?.moduleIds).toEqual(["prowler.aws_posture"]);
    expect(cta?.label).not.toMatch(/full cloud BAS/i);
    const primary = resolveFirstRunPrimaryAction(
      base({
        completedMilestones: 3,
        nextAction: {
          href: "/missions",
          label: COMMUNITY_FIRST_RUN_START_LABEL,
          reason: "from API"
        },
        milestones: [
          milestone("AccountCreated", "Completed"),
          milestone("SourceConnected", "Completed"),
          milestone("ScopeVerified", "Completed"),
          milestone("PolicyPreviewed", "Current"),
          milestone("MissionCreated", "Upcoming"),
          milestone("MeasuredResult", "Upcoming"),
          milestone("RemediationCreated", "Upcoming"),
          milestone("Revalidated", "Upcoming"),
          milestone("ProofDelivered", "Upcoming")
        ]
      }),
      undefined,
      {
        cloudAwsAvailable: true,
        startableModuleIds: ["gitleaks.repo_secrets", "prowler.aws_posture"]
      }
    );
    expect(primary.label).toBe(COMMUNITY_FIRST_RUN_START_LABEL);
    expect(primary.label).not.toBe(cta?.label);
  });
});

describe("resolvePostFindingPrimaryAction", () => {
  it("is null before a finding exists", () => {
    expect(
      resolvePostFindingPrimaryAction({
        findingsCount: 0,
        openRemediationCount: 0
      })
    ).toBeNull();
  });

  it("reviews findings after the first Community finding", () => {
    expect(
      resolvePostFindingPrimaryAction({
        findingsCount: 1,
        openRemediationCount: 0
      })
    ).toMatchObject({
      href: "/findings",
      label: "Review findings",
      setupIncomplete: false
    });
  });

  it("P3-HOMEMISSION: Review findings includes missionId so the stranger lands on the Community-mission chip", () => {
    const missionId = "13d9422a-3dc2-4e82-8a29-a7d2527e764f";
    expect(
      resolvePostFindingPrimaryAction({
        findingsCount: 1,
        openRemediationCount: 0,
        missionId
      })
    ).toMatchObject({
      href: `/findings?missionId=${missionId}`,
      label: "Review findings",
      setupIncomplete: false
    });
  });

  it("P3-HOMEMISSION: blank missionId keeps the tenant findings queue", () => {
    expect(
      resolvePostFindingPrimaryAction({
        findingsCount: 1,
        openRemediationCount: 0,
        missionId: "   "
      })
    ).toMatchObject({
      href: "/findings",
      label: "Review findings"
    });
  });

  it("never competes with Connect a source or Validate after a finding exists", () => {
    const review = resolvePostFindingPrimaryAction({
      findingsCount: 1,
      openRemediationCount: 0
    });
    const verify = resolvePostFindingPrimaryAction({
      findingsCount: 4,
      openRemediationCount: 1
    });
    for (const action of [review, verify]) {
      expect(action?.label).not.toMatch(/connect a source/i);
      expect(action?.label).not.toMatch(/^validate$/i);
      expect(action?.href).not.toBe("/integrations");
    }
  });

  it("verifies when Open remediations exist", () => {
    expect(
      resolvePostFindingPrimaryAction({
        findingsCount: 1,
        openRemediationCount: 2
      })
    ).toMatchObject({
      href: "/remediation",
      label: "Verify",
      setupIncomplete: false
    });
  });

  it("P2-HOMEFIXED: Keep on a cadence after measured Fixed and no Open remediations", () => {
    expect(
      resolvePostFindingPrimaryAction({
        findingsCount: 1,
        measuredFixedCount: 1,
        openRemediationCount: 0
      })
    ).toMatchObject({
      href: "/schedules",
      label: "Keep on a cadence",
      setupIncomplete: false
    });
  });
});

describe("resolveCommunityReviewFindingsMissionId", () => {
  const missionId = "13d9422a-3dc2-4e82-8a29-a7d2527e764f";

  it("reads the Community mission from MeasuredResult /missions/:id", () => {
    expect(
      resolveCommunityReviewFindingsMissionId({
        measuredResultHref: `/missions/${missionId}`
      })
    ).toBe(missionId);
  });

  it("falls back to the latest snapshot missionId", () => {
    expect(
      resolveCommunityReviewFindingsMissionId({
        measuredResultHref: "/missions",
        snapshots: [
          {
            createdAt: "2026-07-14T19:00:00.000Z",
            missionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
          },
          {
            createdAt: "2026-07-14T20:00:00.000Z",
            missionId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
          }
        ]
      })
    ).toBe("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  it("returns null when no Community mission is known", () => {
    expect(
      resolveCommunityReviewFindingsMissionId({
        measuredResultHref: "/missions",
        snapshots: [{ createdAt: "2026-07-14T20:00:00.000Z", missionId: null }]
      })
    ).toBeNull();
  });

  it("leads unsettled findings; settled Fixed stays visible instead of empty Home", () => {
    expect(
      selectHomeTopFinding(
        [{ fingerprint: "abc" }, { fingerprint: "def" }],
        [
          {
            latestVerification: { outcome: "Fixed" },
            relatedFindingFingerprint: "abc",
            status: "Fixed"
          }
        ]
      )
    ).toEqual({ fingerprint: "def" });
    expect(
      selectHomeTopFinding(
        [{ fingerprint: "abc", title: "leaked.js:2 · slack-bot-token" }],
        [
          {
            latestVerification: { outcome: "Fixed" },
            relatedFindingFingerprint: "abc",
            status: "Fixed"
          }
        ]
      )
    ).toEqual({ fingerprint: "abc", title: "leaked.js:2 · slack-bot-token" });
  });

  it("marks a Home top finding settled when its remediation is measured Fixed", () => {
    expect(
      homeTopFindingIsSettled(
        { fingerprint: "abc" },
        [
          {
            latestVerification: { outcome: "Fixed" },
            relatedFindingFingerprint: "abc",
            status: "Fixed"
          }
        ]
      )
    ).toBe(true);
    expect(
      homeTopFindingIsSettled(
        { fingerprint: "abc" },
        [
          {
            relatedFindingFingerprint: "abc",
            status: "Open"
          }
        ]
      )
    ).toBe(false);
  });

  it("treats a null snapshot list like unknown (useApiResource data)", () => {
    expect(
      resolveCommunityReviewFindingsMissionId({
        measuredResultHref: "/missions",
        snapshots: null
      })
    ).toBeNull();
  });
});

describe("railPrimaryCompetesWithFindingsFirstHour", () => {
  const routeFix = {
    href: "/remediation",
    label: "Route the smallest fix"
  };

  it("hides Route the smallest fix on /findings so first-hour keeps one verb", () => {
    expect(railPrimaryCompetesWithFindingsFirstHour("/findings", routeFix)).toBe(
      true
    );
    expect(
      railPrimaryCompetesWithFindingsFirstHour("/findings?missionId=abc", routeFix)
    ).toBe(true);
  });

  it("hides later remediations rail CTAs on /findings", () => {
    expect(
      railPrimaryCompetesWithFindingsFirstHour("/findings", {
        href: "/remediation/99999999-9999-4999-8999-999999999999",
        label: "Review remediations"
      })
    ).toBe(true);
    expect(
      railPrimaryCompetesWithFindingsFirstHour("/findings", {
        href: "/missions",
        label: "Run fresh verification"
      })
    ).toBe(true);
  });

  it("keeps setup CTAs on /findings and keeps Route the smallest fix off findings", () => {
    expect(
      railPrimaryCompetesWithFindingsFirstHour("/findings", {
        href: "/scopes",
        label: "Authorize scope"
      })
    ).toBe(false);
    expect(
      railPrimaryCompetesWithFindingsFirstHour("/findings", {
        href: "/missions",
        label: "Watch Community validation"
      })
    ).toBe(false);
    expect(
      railPrimaryCompetesWithFindingsFirstHour("/dashboard", routeFix)
    ).toBe(false);
    expect(
      railPrimaryCompetesWithFindingsFirstHour("/remediation", routeFix)
    ).toBe(false);
  });
});
