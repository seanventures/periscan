import { describe, expect, it } from "vitest";
import type { ProductActivationState } from "@periscan/shared";

import { resolveFirstRunPrimaryAction } from "./first-run-primary-action";

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
