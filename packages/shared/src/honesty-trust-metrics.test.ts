import { describe, expect, it } from "vitest";

import {
  buildHonestyTrustMetrics,
  countFixedSurvival,
  countMeasuredClaims,
  HONESTY_TRUST_METRIC_LAW
} from "./honesty-trust-metrics";

describe("honesty trust metrics (P12-17)", () => {
  it("computes Measured claim rate and Fixed survival", () => {
    const claims = countMeasuredClaims([
      "Measured",
      "Heuristic",
      "Measured",
      null
    ]);
    expect(claims).toEqual({ measuredClaimCount: 2, totalClaimCount: 3 });

    const survival = countFixedSurvival({
      fixedWithMeasuredVerification: 4,
      fixedOrMitigatedTotal: 5,
      reopenedAfterFixed: 1
    });
    expect(survival).toEqual({
      fixedSurvivedCount: 3,
      fixedAttemptedCount: 5
    });

    const metrics = buildHonestyTrustMetrics({
      measuredClaimCount: claims.measuredClaimCount,
      totalClaimCount: claims.totalClaimCount,
      fixedSurvivedCount: survival.fixedSurvivedCount,
      fixedAttemptedCount: survival.fixedAttemptedCount,
      deniedNeverQueuedCount: 12,
      signatureVerifiedCount: 9,
      signatureCheckedCount: 10
    });

    expect(metrics.claimsMeasuredPct).toBe(66.7);
    expect(metrics.fixedSurvivedRevalidationPct).toBe(60);
    expect(metrics.deniedNeverQueuedCount).toBe(12);
    expect(metrics.signatureVerificationRatePct).toBe(90);
    expect(metrics.compositionNote).toBe(HONESTY_TRUST_METRIC_LAW);
  });

  it("returns null signature rate when no signed results", () => {
    const metrics = buildHonestyTrustMetrics({
      measuredClaimCount: 0,
      totalClaimCount: 0,
      fixedSurvivedCount: 0,
      fixedAttemptedCount: 0,
      deniedNeverQueuedCount: 0,
      signatureVerifiedCount: 0,
      signatureCheckedCount: 0
    });
    expect(metrics.claimsMeasuredPct).toBe(0);
    expect(metrics.signatureVerificationRatePct).toBeNull();
  });

  it("never invents 100% from empty denominators", () => {
    const metrics = buildHonestyTrustMetrics({
      measuredClaimCount: 5,
      totalClaimCount: 0,
      fixedSurvivedCount: 3,
      fixedAttemptedCount: 0,
      deniedNeverQueuedCount: 0,
      signatureVerifiedCount: 1,
      signatureCheckedCount: 0
    });
    expect(metrics.claimsMeasuredPct).toBe(0);
    expect(metrics.fixedSurvivedRevalidationPct).toBe(0);
    expect(metrics.signatureVerificationRatePct).toBeNull();
  });
});
