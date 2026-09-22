export const FINDINGS_HONESTY_NEEDS_VERIFY =
  "Fixed still requires a verification event.";

export const FINDINGS_HONESTY_AFTER_FIXED =
  "Remediation Fixed after retest. Pathless Gitleaks stay Open.";

export function findingsHonestyCopy(
  remediations: ReadonlyArray<{
    latestVerification?: unknown;
    status: string;
  }>
): string {
  const measuredFixed = remediations.some(
    (task) =>
      (task.status === "Fixed" || task.status === "Mitigated") &&
      Boolean(task.latestVerification)
  );
  return measuredFixed
    ? FINDINGS_HONESTY_AFTER_FIXED
    : FINDINGS_HONESTY_NEEDS_VERIFY;
}
