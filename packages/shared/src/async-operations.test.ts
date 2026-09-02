import { describe, expect, it } from "vitest";

import {
  AsyncOperationsPolicyInputSchema,
  AsyncRecoveryDecisionInputSchema
} from "./async-operations";

describe("async operations contracts", () => {
  it("requires owned and reviewed operating targets", () => {
    expect(
      AsyncOperationsPolicyInputSchema.parse({
        escalationChannel: "PagerDuty platform-primary",
        queueAgeTargetSeconds: 300,
        reviewReference: "OPS-REVIEW-2026-Q3",
        runnerLeaseWarningSeconds: 600,
        runningTimeoutSeconds: 1800,
        supportOwner: "Platform reliability"
      })
    ).toMatchObject({
      queueAgeTargetSeconds: 300,
      supportOwner: "Platform reliability"
    });

    expect(() =>
      AsyncOperationsPolicyInputSchema.parse({
        escalationChannel: "x",
        queueAgeTargetSeconds: 1,
        reviewReference: "x",
        runnerLeaseWarningSeconds: 1,
        runningTimeoutSeconds: 1,
        supportOwner: "x"
      })
    ).toThrow();
  });

  it("makes direct replay impossible in the recovery contract", () => {
    expect(
      AsyncRecoveryDecisionInputSchema.parse({
        decision: "PrepareRecovery",
        reason: "Prepare a new policy-gated mission for operator review.",
        reference: "INC-2026-0716",
        workloadId: "11111111-1111-4111-8111-111111111111",
        workloadKind: "ValidationJob"
      }).decision
    ).toBe("PrepareRecovery");
    expect(() =>
      AsyncRecoveryDecisionInputSchema.parse({
        decision: "Replay",
        reason: "Replay the original job immediately without review.",
        reference: "INC-2026-0716",
        workloadId: "11111111-1111-4111-8111-111111111111",
        workloadKind: "ValidationJob"
      })
    ).toThrow();
  });
});
