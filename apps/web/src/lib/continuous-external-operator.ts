import { ScheduleFrequencySchema } from "@periscan/shared";

/** Frequencies the live schedule API contract accepts. */
export const API_SCHEDULE_FREQUENCIES: readonly string[] = [
  ...ScheduleFrequencySchema.options
];

export const HOURLY_CADENCE_UNAVAILABLE_NOTE =
  "Hourly cadence is not available from the API. Continuous validation uses Daily, Weekly, or Monthly.";

export const INVASIVE_VALIDATE_BLOCKED_NOTE =
  "Cannot Validate invasive modules until this candidate is verified.";

export const IDENTITY_ABUSE_BLOCKED_NOTE =
  "Cannot run identity abuse modules until this IdP candidate is promoted to scope and verified. Unscoped spray stays High-danger.";

export const EXTERNAL_ASSESSMENT_PRIMARY_CTA = "Start external assessment";

export const OPERATOR_COPY_DENY_PHRASES = [
  "NodeZero",
  "automated pentest",
  "always-on BAS",
  "CTEM %",
  "5.0"
] as const;

const CADENCE_ORDER = [
  "Hourly",
  "Continuous",
  "Daily",
  "Weekly",
  "Monthly"
] as const;

export function scheduleCadencesForUi(supported: readonly string[]): {
  frequencies: string[];
  hourlySupported: boolean;
  continuousFrequencySupported: boolean;
  hourlyHonesty: string | null;
} {
  const allowed = new Set(supported);
  const frequencies = CADENCE_ORDER.filter((item) => allowed.has(item));
  const hourlySupported = allowed.has("Hourly");
  return {
    frequencies: [...frequencies],
    hourlySupported,
    continuousFrequencySupported: allowed.has("Continuous"),
    hourlyHonesty: hourlySupported ? null : HOURLY_CADENCE_UNAVAILABLE_NOTE
  };
}

export function canStartExternalAssessment(
  scope: { scopeType: string; verificationStatus: string } | null
): boolean {
  return (
    scope?.scopeType === "Domain" && scope.verificationStatus === "Verified"
  );
}

export function pendingPromoteCandidates(
  entries: ReadonlyArray<{
    assetId: string;
    hostnames: string[];
    name: string;
    ownershipStatus: string;
    reviewDisposition: string | null;
  }>
): Array<{
  assetId: string;
  hostnames: string[];
  name: string;
  ownershipStatus: string;
  reviewDisposition: string | null;
}> {
  return entries.filter(
    (entry) =>
      entry.ownershipStatus === "UnattributedCandidate" &&
      entry.reviewDisposition !== "Dismissed"
  );
}

export function discoveryCandidateValidateGate(input: {
  verificationStatus?: string | null;
}): { canValidateInvasive: boolean; reason: string | null } {
  const verified = input.verificationStatus === "Verified";
  return {
    canValidateInvasive: verified,
    reason: verified ? null : INVASIVE_VALIDATE_BLOCKED_NOTE
  };
}

export function pendingIdentityPromoteCandidates<
  T extends {
    autoAddedToScope?: boolean;
    inVerifiedScope?: boolean;
    promotion?: string;
  }
>(candidates: readonly T[]): T[] {
  return candidates.filter(
    (row) =>
      row.promotion === "promote-to-scope" &&
      row.autoAddedToScope !== true &&
      row.inVerifiedScope !== true
  );
}

export function identityCandidateAbuseGate(input: {
  promoted?: boolean;
  verificationStatus?: string | null;
}): { canRunIdentityAbuse: boolean; reason: string | null } {
  const verified =
    input.promoted === true && input.verificationStatus === "Verified";
  return {
    canRunIdentityAbuse: verified,
    reason: verified ? null : IDENTITY_ABUSE_BLOCKED_NOTE
  };
}

export function scopeTypeForCandidateHostname(
  hostname: string
): "Domain" | "Subdomain" {
  const labels = hostname
    .trim()
    .toLowerCase()
    .split(".")
    .filter((part) => part.length > 0);
  return labels.length > 2 ? "Subdomain" : "Domain";
}

export function honestApiEmpty(status: number | null): boolean {
  return status === 404;
}

export function operatorCopyViolations(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const phrase of OPERATOR_COPY_DENY_PHRASES) {
    if (phrase === "CTEM %") {
      if (/ctem[\s\d]*%/i.test(text)) found.push(phrase);
      continue;
    }
    if (phrase === "5.0") {
      if (/\b5\.0\b/.test(text)) found.push(phrase);
      continue;
    }
    if (lower.includes(phrase.toLowerCase())) found.push(phrase);
  }
  return found;
}
