import { describe, expect, it } from "vitest";

import {
  evaluatePolicy,
  isPolicyDecisionExpired,
  resolvePolicyDecisionGate
} from "./index.js";

describe("evaluatePolicy", () => {
  const safeAction = {
    credentialTheft: false,
    destructive: false,
    persistence: false,
    realDataExfiltration: false,
    requiresInternalRunner: false,
    requiresTimeWindow: false,
    uncontrolledExploitChaining: false
  } as const;

  it("hard-blocks active validation on OT-classified scopes", () => {
    const decision = evaluatePolicy({
      adminApproval: true,
      executionEnvironment: "InternalRunner",
      explicitMissionApproval: true,
      missionType: "ExposureValidation",
      requestedAction: safeAction,
      safetyLevel: "ActiveNonInvasive",
      scopeContext: {
        assetClass: "OT",
        businessCriticality: "Critical",
        externalValidationProfileId: null,
        maxSafetyLevel: "BASLite",
        purdueLevel: "Level2SupervisoryControl",
        segmentName: "Plant line 2",
        sensitivity: "Restricted",
        tags: ["scada"]
      },
      scopeVerificationStatus: "Verified",
      timeWindowApproved: true,
      userRole: "Admin"
    });

    expect(decision).toMatchObject({
      approvalState: "Rejected",
      outcome: "Denied"
    });
    expect(decision.rationale).toContain("OT-classified");
  });

  it("allows passive read-only validation on OT-classified scopes", () => {
    expect(
      evaluatePolicy({
        executionEnvironment: "InternalRunner",
        missionType: "ValidationSnapshot",
        requestedAction: safeAction,
        safetyLevel: "PassiveReadOnly",
        scopeContext: {
          assetClass: "OT",
          businessCriticality: "Critical",
          maxSafetyLevel: "BASLite",
          purdueLevel: "Level1BasicControl",
          sensitivity: "Restricted",
          tags: []
        },
        scopeVerificationStatus: "Verified",
        userRole: "SecurityEngineer"
      }).outcome
    ).toBe("Allowed");
  });

  it("enforces a non-OT scope safety ceiling", () => {
    const decision = evaluatePolicy({
      executionEnvironment: "ExternalPoA",
      explicitMissionApproval: true,
      missionType: "ControlValidation",
      requestedAction: safeAction,
      safetyLevel: "ControlledValidation",
      scopeContext: {
        assetClass: "BusinessApplication",
        businessCriticality: "High",
        maxSafetyLevel: "ActiveNonInvasive",
        sensitivity: "High",
        tags: ["customer-facing"]
      },
      scopeVerificationStatus: "Verified",
      userRole: "Admin"
    });

    expect(decision.outcome).toBe("Denied");
    expect(decision.rationale).toContain("Scope");
  });

  it("allows verified passive validation", () => {
    expect(
      evaluatePolicy({
        userRole: "SecurityEngineer",
        scopeVerificationStatus: "Verified",
        missionType: "ValidationSnapshot",
        safetyLevel: "PassiveReadOnly",
        executionEnvironment: "ExternalPoA",
        requestedAction: {
          destructive: false,
          realDataExfiltration: false,
          persistence: false,
          credentialTheft: false,
          uncontrolledExploitChaining: false,
          requiresInternalRunner: false,
          requiresTimeWindow: false
        },
        explicitMissionApproval: false,
        adminApproval: false,
        timeWindowApproved: false
      }).outcome
    ).toBe("Allowed");
  });

  it("requires verified scope before any validation", () => {
    expect(
      evaluatePolicy({
        userRole: "SecurityEngineer",
        scopeVerificationStatus: "Pending",
        missionType: "ValidationSnapshot",
        safetyLevel: "PassiveReadOnly",
        executionEnvironment: "ExternalPoA",
        requestedAction: {
          destructive: false,
          realDataExfiltration: false,
          persistence: false,
          credentialTheft: false,
          uncontrolledExploitChaining: false,
          requiresInternalRunner: false,
          requiresTimeWindow: false
        },
        explicitMissionApproval: false,
        adminApproval: false,
        timeWindowApproved: false
      }).outcome
    ).toBe("RequiresVerifiedScope");
  });

  it("requires explicit mission approval for controlled validation", () => {
    expect(
      evaluatePolicy({
        userRole: "SecurityEngineer",
        scopeVerificationStatus: "Verified",
        missionType: "ExposureValidation",
        safetyLevel: "ControlledValidation",
        executionEnvironment: "ExternalPoA",
        requestedAction: {
          destructive: false,
          realDataExfiltration: false,
          persistence: false,
          credentialTheft: false,
          uncontrolledExploitChaining: false,
          requiresInternalRunner: false,
          requiresTimeWindow: false
        },
        explicitMissionApproval: false,
        adminApproval: false,
        timeWindowApproved: false
      }).outcome
    ).toBe("RequiresApproval");
  });

  it("requires admin approval for BAS-lite validation", () => {
    expect(
      evaluatePolicy({
        userRole: "SecurityEngineer",
        scopeVerificationStatus: "Verified",
        missionType: "ControlValidation",
        safetyLevel: "BASLite",
        executionEnvironment: "ExternalPoA",
        requestedAction: {
          destructive: false,
          realDataExfiltration: false,
          persistence: false,
          credentialTheft: false,
          uncontrolledExploitChaining: false,
          requiresInternalRunner: true,
          requiresTimeWindow: false
        },
        explicitMissionApproval: true,
        adminApproval: false,
        timeWindowApproved: false
      }).outcome
    ).toBe("RequiresInternalRunner");

    expect(
      evaluatePolicy({
        userRole: "SecurityEngineer",
        scopeVerificationStatus: "Verified",
        missionType: "ControlValidation",
        safetyLevel: "BASLite",
        executionEnvironment: "InternalRunner",
        requestedAction: {
          destructive: false,
          realDataExfiltration: false,
          persistence: false,
          credentialTheft: false,
          uncontrolledExploitChaining: false,
          requiresInternalRunner: false,
          requiresTimeWindow: false
        },
        explicitMissionApproval: true,
        adminApproval: false,
        timeWindowApproved: false
      }).outcome
    ).toBe("RequiresApproval");
  });

  it("denies disallowed safety and unsafe actions", () => {
    expect(
      evaluatePolicy({
        userRole: "Owner",
        scopeVerificationStatus: "Verified",
        missionType: "ExposureValidation",
        safetyLevel: "Disallowed",
        executionEnvironment: "ExternalPoA",
        requestedAction: {
          destructive: false,
          realDataExfiltration: false,
          persistence: false,
          credentialTheft: false,
          uncontrolledExploitChaining: false,
          requiresInternalRunner: false,
          requiresTimeWindow: false
        },
        explicitMissionApproval: true,
        adminApproval: true,
        timeWindowApproved: true
      }).outcome
    ).toBe("Denied");

    expect(
      evaluatePolicy({
        userRole: "Owner",
        scopeVerificationStatus: "Verified",
        missionType: "ExposureValidation",
        safetyLevel: "PassiveReadOnly",
        executionEnvironment: "ExternalPoA",
        requestedAction: {
          destructive: true,
          realDataExfiltration: false,
          persistence: false,
          credentialTheft: false,
          uncontrolledExploitChaining: false,
          requiresInternalRunner: false,
          requiresTimeWindow: false
        },
        explicitMissionApproval: false,
        adminApproval: false,
        timeWindowApproved: false
      }).outcome
    ).toBe("Denied");
  });

  it("denies advanced adversarial validation by default", () => {
    expect(
      evaluatePolicy({
        adminApproval: true,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: true,
        missionType: "ControlValidation",
        requestedAction: {
          credentialTheft: false,
          destructive: false,
          persistence: false,
          realDataExfiltration: false,
          requiresInternalRunner: true,
          requiresTimeWindow: true,
          uncontrolledExploitChaining: false
        },
        safetyLevel: "AdvancedAdversarial",
        scopeVerificationStatus: "Verified",
        timeWindowApproved: true,
        userRole: "Owner"
      }).outcome
    ).toBe("Denied");
  });

  it("permits governed destructive validation only with the tier + verified scope + admin + per-mission approval", () => {
    const destructiveInput = (
      overrides: Partial<Parameters<typeof evaluatePolicy>[0]> = {}
    ): Parameters<typeof evaluatePolicy>[0] => ({
      adminApproval: true,
      destructiveValidationAuthorized: true,
      executionEnvironment: "InternalRunner",
      explicitMissionApproval: true,
      missionType: "ControlValidation",
      requestedAction: {
        credentialTheft: false,
        destructive: true,
        persistence: false,
        realDataExfiltration: false,
        requiresInternalRunner: false,
        requiresTimeWindow: false,
        uncontrolledExploitChaining: false
      },
      safetyLevel: "AdvancedAdversarial",
      scopeVerificationStatus: "Verified",
      timeWindowApproved: true,
      userRole: "Owner",
      ...overrides
    });

    // Tier ON + all gates → allowed.
    expect(evaluatePolicy(destructiveInput()).outcome).toBe("Allowed");

    // Tier OFF → denied (real-payload validation disabled).
    expect(
      evaluatePolicy(
        destructiveInput({ destructiveValidationAuthorized: false })
      ).outcome
    ).toBe("Denied");

    // Tier ON but no per-mission approval → not auto-allowed.
    expect(
      evaluatePolicy(
        destructiveInput({ explicitMissionApproval: false })
      ).outcome
    ).toBe("RequiresApproval");

    // Tier ON but unverified scope → still requires a verified authorized scope.
    expect(
      evaluatePolicy(
        destructiveInput({ scopeVerificationStatus: "Pending" })
      ).outcome
    ).toBe("RequiresVerifiedScope");
  });

  it("never permits uncontrolled exploit chaining, even with the destructive tier enabled", () => {
    expect(
      evaluatePolicy({
        adminApproval: true,
        destructiveValidationAuthorized: true,
        executionEnvironment: "InternalRunner",
        explicitMissionApproval: true,
        missionType: "ControlValidation",
        requestedAction: {
          credentialTheft: false,
          destructive: false,
          persistence: false,
          realDataExfiltration: false,
          requiresInternalRunner: false,
          requiresTimeWindow: false,
          uncontrolledExploitChaining: true
        },
        safetyLevel: "AdvancedAdversarial",
        scopeVerificationStatus: "Verified",
        timeWindowApproved: true,
        userRole: "Owner"
      }).outcome
    ).toBe("Denied");
  });
});

describe("resolvePolicyDecisionGate", () => {
  it("proceeds for an allowed decision that has not been rejected", () => {
    expect(
      resolvePolicyDecisionGate({
        outcome: "Allowed",
        approvalState: "NotRequired"
      })
    ).toBe("Proceed");
    expect(
      resolvePolicyDecisionGate({
        outcome: "Allowed",
        approvalState: "Approved"
      })
    ).toBe("Proceed");
  });

  it("denies an allowed decision that was explicitly rejected (revoked)", () => {
    // denyPolicyDecision can reject an auto-"Allowed" decision to revoke it.
    // A rejected decision was turned down by a human and must never execute, so
    // the gate denies it regardless of the auto-evaluated outcome — otherwise the
    // revocation is decorative and the mission proceeds anyway.
    expect(
      resolvePolicyDecisionGate({
        outcome: "Allowed",
        approvalState: "Rejected"
      })
    ).toBe("Denied");
  });

  it("blocks a RequiresApproval decision that is still pending", () => {
    expect(
      resolvePolicyDecisionGate({
        outcome: "RequiresApproval",
        approvalState: "Pending"
      })
    ).toBe("RequiresApproval");
  });

  it("honors an admin-approved RequiresApproval decision so the mission can run", () => {
    // The outcome stays RequiresApproval after approval — only approvalState
    // flips — so the gate must consult approvalState or the mission strands.
    expect(
      resolvePolicyDecisionGate({
        outcome: "RequiresApproval",
        approvalState: "Approved"
      })
    ).toBe("Proceed");
  });

  it("denies a rejected RequiresApproval decision", () => {
    expect(
      resolvePolicyDecisionGate({
        outcome: "RequiresApproval",
        approvalState: "Rejected"
      })
    ).toBe("Denied");
  });

  it("never proceeds for non-approval blocking or denied outcomes", () => {
    for (const outcome of [
      "RequiresVerifiedScope",
      "RequiresInternalRunner",
      "RequiresTimeWindow",
      "Denied"
    ] as const) {
      expect(
        resolvePolicyDecisionGate({ outcome, approvalState: "Pending" })
      ).toBe("Denied");
    }
  });

  const NOW = new Date("2026-06-16T12:00:00.000Z");
  const PAST = new Date("2026-06-16T11:00:00.000Z");
  const FUTURE = new Date("2026-06-16T13:00:00.000Z");

  it("denies an otherwise-proceedable decision once its expiresAt has lapsed", () => {
    // An expired authorization must not execute regardless of how it was
    // evaluated/approved — an Allowed (auto) and an admin-Approved
    // RequiresApproval decision both fail closed to Denied past expiry, so the
    // serialized expiresAt is not a decorative window the gate ignores.
    expect(
      resolvePolicyDecisionGate(
        { outcome: "Allowed", approvalState: "NotRequired", expiresAt: PAST },
        NOW
      )
    ).toBe("Denied");
    expect(
      resolvePolicyDecisionGate(
        {
          outcome: "RequiresApproval",
          approvalState: "Approved",
          expiresAt: PAST
        },
        NOW
      )
    ).toBe("Denied");
  });

  it("still proceeds when expiresAt is in the future or absent", () => {
    expect(
      resolvePolicyDecisionGate(
        { outcome: "Allowed", approvalState: "Approved", expiresAt: FUTURE },
        NOW
      )
    ).toBe("Proceed");
    expect(
      resolvePolicyDecisionGate(
        { outcome: "Allowed", approvalState: "Approved", expiresAt: null },
        NOW
      )
    ).toBe("Proceed");
    expect(
      resolvePolicyDecisionGate({
        outcome: "Allowed",
        approvalState: "Approved"
      })
    ).toBe("Proceed");
  });

  it("does not let a future expiry rescue a rejected decision", () => {
    // The Rejected fail-closed short-circuit still wins — a live expiry window
    // cannot un-revoke a human rejection.
    expect(
      resolvePolicyDecisionGate(
        { outcome: "Allowed", approvalState: "Rejected", expiresAt: FUTURE },
        NOW
      )
    ).toBe("Denied");
  });
});

describe("isPolicyDecisionExpired", () => {
  const NOW = new Date("2026-06-16T12:00:00.000Z");

  it("treats a null or undefined expiresAt as never expired (legacy rows)", () => {
    expect(isPolicyDecisionExpired(null, NOW)).toBe(false);
    expect(isPolicyDecisionExpired(undefined, NOW)).toBe(false);
  });

  it("expires at or before now and not after (Date and ISO string inputs)", () => {
    expect(
      isPolicyDecisionExpired(new Date("2026-06-16T11:59:59.999Z"), NOW)
    ).toBe(true);
    expect(isPolicyDecisionExpired(NOW, NOW)).toBe(true);
    expect(isPolicyDecisionExpired("2026-06-16T11:00:00.000Z", NOW)).toBe(true);
    expect(isPolicyDecisionExpired("2026-06-16T13:00:00.000Z", NOW)).toBe(
      false
    );
  });
});
