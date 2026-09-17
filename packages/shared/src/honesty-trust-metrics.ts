/**
 * Honesty architecture trust metrics (P12-17).
 *
 * Productizes the Leaders differentiator as executive-facing numbers competitors
 * cannot fake without the same measured loop:
 * - % claims Measured
 * - % Fixed that survived revalidation
 * - denied-never-queued count
 * - signature verification rate
 *
 * Pure composition over caller-supplied counters — no invented product data.
 */

import { z } from "zod";

export const HonestyTrustMetricsSchema = z.object({
  /** Path/hop claims with Measured evidence basis / total claims. */
  claimsMeasuredPct: z.number().min(0).max(100),
  claimsMeasuredCount: z.number().int().nonnegative(),
  claimsTotalCount: z.number().int().nonnegative(),
  /**
   * Fixed/Mitigated remediations that still hold after measured revalidation
   * (not reopened / not ClosedWithoutEvidence).
   */
  fixedSurvivedRevalidationPct: z.number().min(0).max(100),
  fixedSurvivedCount: z.number().int().nonnegative(),
  fixedAttemptedCount: z.number().int().nonnegative(),
  /** Policy decisions that Denied work before queue (fail-closed proof). */
  deniedNeverQueuedCount: z.number().int().nonnegative(),
  /**
   * Runner/task result envelopes whose signatures verified / total checked.
   * Null when no signed results in window (honest empty, not 100%).
   */
  signatureVerificationRatePct: z.number().min(0).max(100).nullable(),
  signatureVerifiedCount: z.number().int().nonnegative(),
  signatureCheckedCount: z.number().int().nonnegative(),
  /** One-line composition disclosure for reports/UI. */
  compositionNote: z.string().min(1)
});
export type HonestyTrustMetrics = z.infer<typeof HonestyTrustMetricsSchema>;

export const HONESTY_TRUST_METRIC_LAW =
  "Trust metrics are derived only from measured claim labels, verification events, policy deny audit, and signature checks. Severity, ticket close, and fixture-only runs never inflate these rates.";

export type HonestyTrustMetricsInput = {
  measuredClaimCount: number;
  totalClaimCount: number;
  /** Fixed that still hold after measured revalidation. */
  fixedSurvivedCount: number;
  /** Fixed attempted (including later reopened / closed-without-evidence). */
  fixedAttemptedCount: number;
  deniedNeverQueuedCount: number;
  signatureVerifiedCount: number;
  signatureCheckedCount: number;
};

function pct(numerator: number, denominator: number): number {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.min(100, Math.round((numerator / denominator) * 1000) / 10)
  );
}

function nonNegInt(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

/**
 * Build the executive honesty trust metric block (P12-17).
 * Callers supply already-aggregated counters from real persistence.
 */
export function buildHonestyTrustMetrics(
  input: HonestyTrustMetricsInput
): HonestyTrustMetrics {
  const claimsMeasuredCount = nonNegInt(input.measuredClaimCount);
  const claimsTotalCount = nonNegInt(input.totalClaimCount);
  const fixedSurvivedCount = nonNegInt(input.fixedSurvivedCount);
  const fixedAttemptedCount = nonNegInt(input.fixedAttemptedCount);
  const deniedNeverQueuedCount = nonNegInt(input.deniedNeverQueuedCount);
  const signatureVerifiedCount = nonNegInt(input.signatureVerifiedCount);
  const signatureCheckedCount = nonNegInt(input.signatureCheckedCount);

  const signatureVerificationRatePct =
    signatureCheckedCount === 0
      ? null
      : pct(signatureVerifiedCount, signatureCheckedCount);

  return HonestyTrustMetricsSchema.parse({
    claimsMeasuredPct: pct(claimsMeasuredCount, claimsTotalCount),
    claimsMeasuredCount,
    claimsTotalCount,
    fixedSurvivedRevalidationPct: pct(fixedSurvivedCount, fixedAttemptedCount),
    fixedSurvivedCount,
    fixedAttemptedCount,
    deniedNeverQueuedCount,
    signatureVerificationRatePct,
    signatureVerifiedCount,
    signatureCheckedCount,
    compositionNote: HONESTY_TRUST_METRIC_LAW
  });
}

/** Derive path claim counters from evidenceBasis labels. */
export function countMeasuredClaims(
  evidenceBases: readonly (string | null | undefined)[]
): { measuredClaimCount: number; totalClaimCount: number } {
  let measured = 0;
  let total = 0;
  for (const basis of evidenceBases) {
    if (basis == null || basis === "") continue;
    total += 1;
    if (basis === "Measured") {
      measured += 1;
    }
  }
  return { measuredClaimCount: measured, totalClaimCount: total };
}

/**
 * Fixed survival: Fixed/Mitigated that are not later Reopened and that have a
 * measured verification outcome Fixed/Mitigated. Callers pre-filter sets.
 */
export function countFixedSurvival(input: {
  fixedWithMeasuredVerification: number;
  fixedOrMitigatedTotal: number;
  reopenedAfterFixed?: number;
}): { fixedSurvivedCount: number; fixedAttemptedCount: number } {
  const attempted = nonNegInt(input.fixedOrMitigatedTotal);
  const reopened = nonNegInt(input.reopenedAfterFixed ?? 0);
  const survived = Math.max(
    0,
    nonNegInt(input.fixedWithMeasuredVerification) - reopened
  );
  return {
    fixedSurvivedCount: Math.min(survived, attempted),
    fixedAttemptedCount: attempted
  };
}
