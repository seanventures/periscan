import { z } from "zod";

/**
 * Connected Entra / Okta / JumpCloud inventory is CAASM *candidates*
 * (users, groups, apps). Not verified scope. Identity abuse modules
 * require promote-to-scope first. Unscoped spray stays High-danger.
 */

export const IDENTITY_CANDIDATE_HONESTY_NOTE =
  "Connected Entra, Okta, and JumpCloud inventory lands as CAASM candidates (user, group, app counts). Records are never added to verified scope automatically. Promote-to-scope is required before identity abuse modules. Unscoped spray remains High-danger.";

export const IDENTITY_ABUSE_PROMOTE_TO_SCOPE_REQUIRED_CODE =
  "identity_abuse_promote_to_scope_required" as const;

export const IDENTITY_UNSCOPED_SPRAY_CODE =
  "identity_cred_spray_internet_forbidden" as const;

export const IDENTITY_ABUSE_MODULE_IDS = [
  "identity.cred_spray",
  "identity.credential_harvest",
  "identity.kerberos_userenum"
] as const;
export type IdentityAbuseModuleId = (typeof IDENTITY_ABUSE_MODULE_IDS)[number];

export const IdentityCandidateKindSchema = z.enum(["user", "group", "app"]);
export type IdentityCandidateKind = z.infer<typeof IdentityCandidateKindSchema>;

export const IdentityCandidateSourceSchema = z.enum([
  "jumpcloud",
  "microsoft-entra-id",
  "okta"
]);
export type IdentityCandidateSource = z.infer<
  typeof IdentityCandidateSourceSchema
>;

export const IdentityCandidateSchema = z.object({
  autoAddedToScope: z.literal(false),
  displayName: z.string().min(1),
  externalId: z.string().min(1),
  inVerifiedScope: z.literal(false),
  kind: IdentityCandidateKindSchema,
  liveSpray: z.literal(false),
  promotion: z.literal("promote-to-scope"),
  source: IdentityCandidateSourceSchema
});
export type IdentityCandidate = z.infer<typeof IdentityCandidateSchema>;

export const IdentityCandidateCountsSchema = z.object({
  apps: z.number().int().nonnegative(),
  groups: z.number().int().nonnegative(),
  users: z.number().int().nonnegative()
});
export type IdentityCandidateCounts = z.infer<
  typeof IdentityCandidateCountsSchema
>;

export const IdentityInventorySyncSchema = z.object({
  autoAddedToScope: z.literal(false),
  candidates: z.array(IdentityCandidateSchema),
  counts: IdentityCandidateCountsSchema,
  liveSpray: z.literal(false),
  source: IdentityCandidateSourceSchema
});
export type IdentityInventorySync = z.infer<typeof IdentityInventorySyncSchema>;

export const IdentityAbuseStartDecisionSchema = z.object({
  allowed: z.boolean(),
  autoAddedToScope: z.literal(false),
  code: z.string().min(1).nullable(),
  jobsQueued: z.literal(0),
  liveSpray: z.literal(false),
  measurementClass: z.enum(["Config", "Danger", "Forbidden"]),
  rationale: z.string().min(1),
  startable: z.boolean()
});
export type IdentityAbuseStartDecision = z.infer<
  typeof IdentityAbuseStartDecisionSchema
>;

export type MapIdentityInventoryInput = {
  apps?: readonly unknown[];
  groups?: readonly unknown[];
  source: IdentityCandidateSource;
  users?: readonly unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function nestedProfile(row: Record<string, unknown>): Record<string, unknown> {
  return isRecord(row.profile) ? row.profile : {};
}

function pickExternalId(row: Record<string, unknown>): string | null {
  return (
    asTrimmedString(row.externalId) ??
    asTrimmedString(row.id) ??
    asTrimmedString(row._id)
  );
}

function pickDisplayName(
  row: Record<string, unknown>,
  kind: IdentityCandidateKind,
  fallback: string
): string {
  const profile = nestedProfile(row);
  if (kind === "user") {
    return (
      asTrimmedString(row.displayName) ??
      asTrimmedString(profile.displayName) ??
      asTrimmedString(row.userPrincipalName) ??
      asTrimmedString(row.mail) ??
      asTrimmedString(profile.login) ??
      asTrimmedString(profile.email) ??
      asTrimmedString(row.username) ??
      fallback
    );
  }
  if (kind === "group") {
    return (
      asTrimmedString(row.displayName) ??
      asTrimmedString(profile.name) ??
      asTrimmedString(row.name) ??
      fallback
    );
  }
  return (
    asTrimmedString(row.label) ??
    asTrimmedString(row.displayName) ??
    asTrimmedString(row.displayLabel) ??
    asTrimmedString(row.name) ??
    asTrimmedString(profile.name) ??
    fallback
  );
}

function mapRows(
  rows: readonly unknown[] | undefined,
  kind: IdentityCandidateKind,
  source: IdentityCandidateSource,
  seen: Set<string>
): IdentityCandidate[] {
  const candidates: IdentityCandidate[] = [];
  for (const raw of rows ?? []) {
    if (!isRecord(raw)) {
      continue;
    }
    const externalId = pickExternalId(raw);
    if (!externalId) {
      continue;
    }
    const dedupe = `${source}:${kind}:${externalId}`;
    if (seen.has(dedupe)) {
      continue;
    }
    seen.add(dedupe);
    candidates.push(
      IdentityCandidateSchema.parse({
        autoAddedToScope: false,
        displayName: pickDisplayName(raw, kind, externalId),
        externalId,
        inVerifiedScope: false,
        kind,
        liveSpray: false,
        promotion: "promote-to-scope",
        source
      })
    );
  }
  return candidates;
}

export function countIdentityCandidates(
  candidates: readonly IdentityCandidate[]
): IdentityCandidateCounts {
  return IdentityCandidateCountsSchema.parse({
    apps: candidates.filter((row) => row.kind === "app").length,
    groups: candidates.filter((row) => row.kind === "group").length,
    users: candidates.filter((row) => row.kind === "user").length
  });
}

export function mapIdentityInventoryToCandidates(
  input: MapIdentityInventoryInput
): IdentityInventorySync {
  const seen = new Set<string>();
  const candidates = [
    ...mapRows(input.users, "user", input.source, seen),
    ...mapRows(input.groups, "group", input.source, seen),
    ...mapRows(input.apps, "app", input.source, seen)
  ];
  return IdentityInventorySyncSchema.parse({
    autoAddedToScope: false,
    candidates,
    counts: countIdentityCandidates(candidates),
    liveSpray: false,
    source: input.source
  });
}

export function mapOktaIdentityInventory(input: {
  apps?: readonly unknown[];
  groups?: readonly unknown[];
  users?: readonly unknown[];
}): IdentityInventorySync {
  return mapIdentityInventoryToCandidates({
    apps: input.apps,
    groups: input.groups,
    source: "okta",
    users: input.users
  });
}

export function mapEntraIdentityInventory(input: {
  applications?: readonly unknown[];
  groups?: readonly unknown[];
  users?: readonly unknown[];
}): IdentityInventorySync {
  return mapIdentityInventoryToCandidates({
    apps: input.applications,
    groups: input.groups,
    source: "microsoft-entra-id",
    users: input.users
  });
}

export function mapJumpCloudIdentityInventory(input: {
  applications?: readonly unknown[];
  groups?: readonly unknown[];
  users?: readonly unknown[];
}): IdentityInventorySync {
  return mapIdentityInventoryToCandidates({
    apps: input.applications,
    groups: input.groups,
    source: "jumpcloud",
    users: input.users
  });
}

export function isIdentityAbuseModuleId(
  moduleId: string
): moduleId is IdentityAbuseModuleId {
  return (IDENTITY_ABUSE_MODULE_IDS as readonly string[]).includes(moduleId);
}

function parseCandidates(value: unknown): IdentityCandidate[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const parsed = IdentityCandidateSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

function parsePromotedIds(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set();
  }
  return new Set(
    value.flatMap((item) => {
      const id = asTrimmedString(item);
      return id ? [id] : [];
    })
  );
}

function abuseDecision(input: {
  allowed: boolean;
  code: string | null;
  measurementClass: "Config" | "Danger" | "Forbidden";
  rationale: string;
  startable: boolean;
}): IdentityAbuseStartDecision {
  return IdentityAbuseStartDecisionSchema.parse({
    allowed: input.allowed,
    autoAddedToScope: false,
    code: input.code,
    jobsQueued: 0,
    liveSpray: false,
    measurementClass: input.measurementClass,
    rationale: input.rationale,
    startable: input.startable
  });
}

export type EvaluateIdentityAbuseStartInput = {
  candidates?: unknown;
  moduleId: string;
  promotedExternalIds?: unknown;
  sprayMode?: unknown;
  unscoped?: unknown;
};

export function evaluateIdentityAbuseStart(
  input: EvaluateIdentityAbuseStartInput
): IdentityAbuseStartDecision {
  if (input.unscoped === true || input.sprayMode === "internet") {
    return abuseDecision({
      allowed: false,
      code: IDENTITY_UNSCOPED_SPRAY_CODE,
      measurementClass: "Danger",
      rationale:
        "Internet and unscoped credential spray are High-danger. Extra acknowledgement + qualification + tenant authorization required. Not Community default start.",
      startable: false
    });
  }

  if (!isIdentityAbuseModuleId(input.moduleId)) {
    return abuseDecision({
      allowed: true,
      code: null,
      measurementClass: "Config",
      rationale: "Module is not an identity abuse pin.",
      startable: true
    });
  }

  const candidates = parseCandidates(input.candidates);
  if (candidates.length > 0) {
    const promoted = parsePromotedIds(input.promotedExternalIds);
    const anyPromoted = candidates.some((row) => promoted.has(row.externalId));
    if (!anyPromoted) {
      return abuseDecision({
        allowed: false,
        code: IDENTITY_ABUSE_PROMOTE_TO_SCOPE_REQUIRED_CODE,
        measurementClass: "Forbidden",
        rationale:
          "IdP inventory is CAASM candidates only. Promote-to-scope is required before identity abuse modules. Denied starts never queue.",
        startable: false
      });
    }
  }

  return abuseDecision({
    allowed: true,
    code: null,
    measurementClass: "Config",
    rationale:
      "Promote-to-scope gate passed. Identity abuse still requires the module compiler; this gate never queues live spray.",
    startable: true
  });
}

export type IdentityCandidatePromotion = {
  autoAddedToScope: false;
  externalId: string;
  kind: IdentityCandidateKind;
  liveSpray: false;
  readyForVerification: boolean;
  requiresOperator: boolean;
  scopeExpanded: false;
  source: IdentityCandidateSource;
  verificationStatus: "Pending";
};

export function promoteIdentityCandidate(
  candidate: IdentityCandidate,
  options?: { operatorPromoted?: boolean }
): IdentityCandidatePromotion {
  const operatorPromoted = options?.operatorPromoted !== false;
  return {
    autoAddedToScope: false,
    externalId: candidate.externalId,
    kind: candidate.kind,
    liveSpray: false,
    readyForVerification: operatorPromoted,
    requiresOperator: !operatorPromoted,
    scopeExpanded: false,
    source: candidate.source,
    verificationStatus: "Pending"
  };
}
