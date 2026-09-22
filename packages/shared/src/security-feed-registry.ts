import { createHash } from "node:crypto";

import { z } from "zod";

import { unpaginatedListSchema } from "./api-contract";
import { ATTACK_NAVIGATOR_DEFAULT_VERSIONS } from "./attack-navigator";
import {
  PINNED_CALDERA_RELEASE,
  PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID
} from "./caldera-operations-adapter";
import { NUCLEI_TEMPLATES_VERSION_PIN } from "./web-api-scenario-version";

/**
 * Managed registry of OSS security *content* Periscan pins.
 * A check never auto-flips an executable pin. Newer upstream becomes a
 * PendingReview content version. Unpinned YAML is never evaluated.
 */

export const COMMUNITY_PERMISSIVE_SPDX_IDS = [
  "Apache-2.0",
  "MIT",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "BlueOak-1.0.0",
  "NPSL"
] as const;

const COMMUNITY_PERMISSIVE_SPDX_SET = new Set<string>(
  COMMUNITY_PERMISSIVE_SPDX_IDS
);

export const SECURITY_FEED_IDS = [
  "nuclei-templates",
  "sigma",
  "attack-stix",
  "atomic-yaml",
  "caldera-abilities",
  "yara",
  "rustinel-rules",
  "nvd",
  "cisa-kev",
  "gitleaks"
] as const;

export const SecurityFeedIdSchema = z.enum(SECURITY_FEED_IDS);
export type SecurityFeedId = z.infer<typeof SecurityFeedIdSchema>;

export const SecurityFeedKindSchema = z.enum([
  "content-pack",
  "engine-pin",
  "stix",
  "ability-hash",
  "threat-intel"
]);
export type SecurityFeedKind = z.infer<typeof SecurityFeedKindSchema>;

export const SecurityFeedUpdatePolicySchema = z.enum(["manual", "scheduled"]);
export type SecurityFeedUpdatePolicy = z.infer<
  typeof SecurityFeedUpdatePolicySchema
>;

export const SecurityFeedPinKindSchema = z.enum([
  "tag",
  "sha",
  "version",
  "unpinned"
]);
export type SecurityFeedPinKind = z.infer<typeof SecurityFeedPinKindSchema>;

export const SecurityFeedPinSchema = z.object({
  kind: SecurityFeedPinKindSchema,
  value: z.string().min(1).nullable()
});
export type SecurityFeedPin = z.infer<typeof SecurityFeedPinSchema>;

export const SecurityFeedContentVersionStatusSchema = z.enum([
  "Current",
  "PendingReview",
  "Rejected"
]);
export type SecurityFeedContentVersionStatus = z.infer<
  typeof SecurityFeedContentVersionStatusSchema
>;

export const SecurityFeedDefaultPackDecisionSchema = z.enum([
  "allowed",
  "fail_closed"
]);
export type SecurityFeedDefaultPackDecision = z.infer<
  typeof SecurityFeedDefaultPackDecisionSchema
>;

export const SecurityFeedCheckCodeSchema = z.enum([
  "current",
  "newer_upstream",
  "spdx_not_community_permissive",
  "unpinned_yaml_rejected",
  "yaml_not_executed"
]);
export type SecurityFeedCheckCode = z.infer<typeof SecurityFeedCheckCodeSchema>;

const Sha256HexSchema = z.string().regex(/^[a-f0-9]{64}$/u);

export const SecurityFeedSchema = z.object({
  abilityIds: z.array(z.string().min(1)).optional(),
  defaultPackEligible: z.boolean(),
  displayName: z.string().min(1),
  executablePin: z.boolean(),
  id: z.string().min(1),
  kind: SecurityFeedKindSchema,
  lastCheckedAt: z.string().datetime().nullable(),
  lastDigest: Sha256HexSchema.nullable(),
  liveSupported: z.literal(false),
  pin: SecurityFeedPinSchema,
  spdxLicenseId: z.string().min(1),
  threatIntelSourceKey: z.string().min(1).optional(),
  toolId: z.string().min(1).optional(),
  updatePolicy: SecurityFeedUpdatePolicySchema
});
export type SecurityFeed = z.infer<typeof SecurityFeedSchema>;

export const SecurityFeedObservationSchema = z.object({
  abilityHashes: z.record(z.string(), z.string()).optional(),
  checkedAt: z.string().datetime(),
  contentDigest: Sha256HexSchema.optional(),
  requestedDefaultPack: z.boolean().optional(),
  upstreamSha: z.string().min(1).optional(),
  upstreamVersion: z.string().min(1).optional(),
  yaml: z.string().optional()
});
export type SecurityFeedObservation = z.infer<
  typeof SecurityFeedObservationSchema
>;

export const SecurityFeedCheckResultSchema = z.object({
  code: SecurityFeedCheckCodeSchema,
  contentVersionStatus: SecurityFeedContentVersionStatusSchema,
  defaultPackDecision: SecurityFeedDefaultPackDecisionSchema,
  executablePin: z.boolean(),
  executablePinFlipped: z.literal(false),
  feedId: z.string().min(1),
  lastCheckedAt: z.string().datetime(),
  lastDigest: Sha256HexSchema.nullable(),
  liveSupported: z.literal(false),
  recordedPin: SecurityFeedPinSchema,
  threatIntelTracked: z.boolean(),
  upstreamPin: SecurityFeedPinSchema.nullable(),
  yamlEvaluated: z.literal(false)
});
export type SecurityFeedCheckResult = z.infer<
  typeof SecurityFeedCheckResultSchema
>;

export const SecurityFeedYamlApplyResultSchema = z.object({
  applied: z.literal(false),
  code: z.enum(["unpinned_yaml_rejected", "yaml_not_executed"]),
  contentVersionStatus: z.enum(["PendingReview", "Rejected"]),
  evaluated: z.literal(false),
  executablePinFlipped: z.literal(false),
  recordedPin: SecurityFeedPinSchema.optional()
});
export type SecurityFeedYamlApplyResult = z.infer<
  typeof SecurityFeedYamlApplyResultSchema
>;

const ATOMIC_YAML_PIN_SHA = "11ff111ace63e02825dd44ce8246800203a10ce8";
const GITLEAKS_VERSION_PIN = "v8.30.0";
const YARA_VERSION_PIN = "4.5.2";
const SIGMA_TAG_PIN = "main";
const PINNED_CALDERA_ABILITY_IDS = [
  PINNED_CALDERA_STOCKPILE_T1082_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1083_ABILITY_ID,
  PINNED_CALDERA_STOCKPILE_T1033_ABILITY_ID
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isCommunityPermissiveSpdx(spdx: string): boolean {
  const trimmed = spdx.trim();
  if (trimmed.length === 0) {
    return false;
  }
  if (/\sAND\s/iu.test(trimmed)) {
    return false;
  }
  const parts = trimmed
    .split(/\sOR\s/iu)
    .map((part) => part.replace(/[()]/gu, "").trim())
    .filter((part) => part.length > 0);
  if (parts.length === 0) {
    return false;
  }
  return parts.some((part) => COMMUNITY_PERMISSIVE_SPDX_SET.has(part));
}

function normalizeVersionForComparison(version: string): string {
  return version
    .trim()
    .replace(/^refs\/tags\//i, "")
    .replace(/^v(?=\d)/i, "")
    .toLowerCase();
}

function isNewerPinValue(candidate: string, current: string): boolean {
  const left = normalizeVersionForComparison(candidate);
  const right = normalizeVersionForComparison(current);
  if (left === right) {
    return false;
  }
  const leftParts = left.split(".").map((part) => Number(part));
  const rightParts = right.split(".").map((part) => Number(part));
  const numeric =
    leftParts.length > 0 &&
    rightParts.length > 0 &&
    leftParts.every(Number.isFinite) &&
    rightParts.every(Number.isFinite);

  if (!numeric) {
    return true;
  }

  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) {
      return true;
    }
    if (leftPart < rightPart) {
      return false;
    }
  }
  return false;
}

function defineFeed(
  input: Omit<
    SecurityFeed,
    "defaultPackEligible" | "lastCheckedAt" | "lastDigest" | "liveSupported"
  >
): SecurityFeed {
  return SecurityFeedSchema.parse({
    ...input,
    defaultPackEligible: isCommunityPermissiveSpdx(input.spdxLicenseId),
    lastCheckedAt: null,
    lastDigest: null,
    liveSupported: false
  });
}

const SECURITY_FEEDS: readonly SecurityFeed[] = [
  defineFeed({
    displayName: "Nuclei Templates",
    executablePin: true,
    id: "nuclei-templates",
    kind: "content-pack",
    pin: { kind: "tag", value: NUCLEI_TEMPLATES_VERSION_PIN },
    spdxLicenseId: "MIT",
    toolId: "nuclei-templates",
    updatePolicy: "scheduled"
  }),
  defineFeed({
    displayName: "Sigma Rules",
    executablePin: false,
    id: "sigma",
    kind: "content-pack",
    pin: { kind: "tag", value: SIGMA_TAG_PIN },
    spdxLicenseId: "MIT",
    toolId: "sigma",
    updatePolicy: "scheduled"
  }),
  defineFeed({
    displayName: "ATT&CK STIX",
    executablePin: false,
    id: "attack-stix",
    kind: "stix",
    pin: {
      kind: "tag",
      value: ATTACK_NAVIGATOR_DEFAULT_VERSIONS.attack
    },
    spdxLicenseId: "Apache-2.0",
    updatePolicy: "scheduled"
  }),
  defineFeed({
    displayName: "Atomic Red Team YAML",
    executablePin: false,
    id: "atomic-yaml",
    kind: "content-pack",
    pin: { kind: "sha", value: ATOMIC_YAML_PIN_SHA },
    spdxLicenseId: "MIT",
    toolId: "atomic-red-team",
    updatePolicy: "manual"
  }),
  defineFeed({
    abilityIds: [...PINNED_CALDERA_ABILITY_IDS],
    displayName: "Caldera ability hashes",
    executablePin: false,
    id: "caldera-abilities",
    kind: "ability-hash",
    pin: { kind: "tag", value: PINNED_CALDERA_RELEASE },
    spdxLicenseId: "Apache-2.0",
    toolId: "caldera",
    updatePolicy: "manual"
  }),
  defineFeed({
    displayName: "YARA",
    executablePin: true,
    id: "yara",
    kind: "engine-pin",
    pin: { kind: "version", value: YARA_VERSION_PIN },
    spdxLicenseId: "BSD-3-Clause",
    toolId: "yara",
    updatePolicy: "scheduled"
  }),
  defineFeed({
    displayName: "Rustinel rules",
    executablePin: false,
    id: "rustinel-rules",
    kind: "content-pack",
    pin: { kind: "unpinned", value: null },
    spdxLicenseId: "LicenseRef-DRL-1.1",
    updatePolicy: "manual"
  }),
  defineFeed({
    displayName: "NVD CVE 2.0",
    executablePin: false,
    id: "nvd",
    kind: "threat-intel",
    pin: { kind: "tag", value: "cves/2.0" },
    spdxLicenseId: "LicenseRef-USgov-PD",
    threatIntelSourceKey: "nvd",
    updatePolicy: "scheduled"
  }),
  defineFeed({
    displayName: "CISA KEV",
    executablePin: false,
    id: "cisa-kev",
    kind: "threat-intel",
    pin: { kind: "tag", value: "known_exploited_vulnerabilities" },
    spdxLicenseId: "LicenseRef-USgov-PD",
    threatIntelSourceKey: "cisa-kev",
    updatePolicy: "scheduled"
  }),
  defineFeed({
    displayName: "Gitleaks",
    executablePin: true,
    id: "gitleaks",
    kind: "engine-pin",
    pin: { kind: "version", value: GITLEAKS_VERSION_PIN },
    spdxLicenseId: "MIT",
    toolId: "gitleaks",
    updatePolicy: "scheduled"
  })
];

export function listSecurityFeeds(): SecurityFeed[] {
  return SECURITY_FEEDS.map((feed) => SecurityFeedSchema.parse(feed));
}

export const SecurityFeedOperatorItemSchema = z.object({
  autoExecute: z.literal(false),
  contentVersionStatus: SecurityFeedContentVersionStatusSchema,
  executablePinFlipped: z.literal(false),
  id: z.string().min(1),
  lastCheckedAt: z.string().datetime().nullable(),
  lastDigest: Sha256HexSchema.nullable(),
  liveSupported: z.literal(false),
  pin: SecurityFeedPinSchema,
  spdxLicenseId: z.string().min(1),
  updatePolicy: SecurityFeedUpdatePolicySchema
});
export type SecurityFeedOperatorItem = z.infer<
  typeof SecurityFeedOperatorItemSchema
>;

export const SecurityFeedListEnvelopeSchema = unpaginatedListSchema(
  SecurityFeedOperatorItemSchema
);
export type SecurityFeedListEnvelope = z.infer<
  typeof SecurityFeedListEnvelopeSchema
>;

export function listSecurityFeedOperatorItems(
  feeds: readonly SecurityFeed[] = listSecurityFeeds(),
  checks: readonly SecurityFeedCheckResult[] = []
): SecurityFeedOperatorItem[] {
  const checkById = new Map(checks.map((check) => [check.feedId, check]));
  return feeds.map((feed) => {
    const check = checkById.get(feed.id);
    return SecurityFeedOperatorItemSchema.parse({
      autoExecute: false,
      contentVersionStatus: check?.contentVersionStatus ?? "Current",
      executablePinFlipped: false,
      id: feed.id,
      lastCheckedAt: check?.lastCheckedAt ?? feed.lastCheckedAt,
      lastDigest: check?.lastDigest ?? feed.lastDigest,
      liveSupported: false,
      pin: feed.pin,
      spdxLicenseId: feed.spdxLicenseId,
      updatePolicy: feed.updatePolicy
    });
  });
}

function recordedDigest(
  feed: SecurityFeed,
  observation: Pick<SecurityFeedObservation, "contentDigest">
): string | null {
  if (observation.contentDigest) {
    return observation.contentDigest;
  }
  if (feed.lastDigest) {
    return feed.lastDigest;
  }
  if (feed.pin.value) {
    return sha256(`${feed.pin.kind}:${feed.pin.value}`);
  }
  return null;
}

function hasChangedAbilityHashes(
  observation: Pick<SecurityFeedObservation, "abilityHashes">
): boolean {
  const hashes = observation.abilityHashes;
  if (!hashes) {
    return false;
  }
  return Object.keys(hashes).length > 0;
}

export function checkSecurityFeed(
  feed: SecurityFeed,
  observation: SecurityFeedObservation
): SecurityFeedCheckResult {
  const defaultPackDecision: SecurityFeedDefaultPackDecision =
    isCommunityPermissiveSpdx(feed.spdxLicenseId) ? "allowed" : "fail_closed";
  const threatIntelTracked = feed.kind === "threat-intel";

  if (
    observation.requestedDefaultPack === true &&
    defaultPackDecision === "fail_closed"
  ) {
    return SecurityFeedCheckResultSchema.parse({
      code: "spdx_not_community_permissive",
      contentVersionStatus: "Rejected",
      defaultPackDecision,
      executablePin: feed.executablePin,
      executablePinFlipped: false,
      feedId: feed.id,
      lastCheckedAt: observation.checkedAt,
      lastDigest: recordedDigest(feed, observation),
      liveSupported: false,
      recordedPin: feed.pin,
      threatIntelTracked,
      upstreamPin: null,
      yamlEvaluated: false
    });
  }

  let contentVersionStatus: SecurityFeedContentVersionStatus = "Current";
  let code: SecurityFeedCheckCode =
    defaultPackDecision === "fail_closed"
      ? "spdx_not_community_permissive"
      : "current";
  let upstreamPin: SecurityFeedPin | null = null;

  if (
    observation.upstreamVersion &&
    feed.pin.value &&
    (feed.pin.kind === "tag" || feed.pin.kind === "version") &&
    isNewerPinValue(observation.upstreamVersion, feed.pin.value)
  ) {
    contentVersionStatus = "PendingReview";
    code = "newer_upstream";
    upstreamPin = {
      kind: feed.pin.kind,
      value: observation.upstreamVersion
    };
  }

  if (
    observation.upstreamSha &&
    feed.pin.kind === "sha" &&
    feed.pin.value &&
    observation.upstreamSha !== feed.pin.value
  ) {
    contentVersionStatus = "PendingReview";
    code = "newer_upstream";
    upstreamPin = { kind: "sha", value: observation.upstreamSha };
  }

  if (hasChangedAbilityHashes(observation)) {
    contentVersionStatus = "PendingReview";
    code = "newer_upstream";
  }

  return SecurityFeedCheckResultSchema.parse({
    code,
    contentVersionStatus,
    defaultPackDecision,
    executablePin: feed.executablePin,
    executablePinFlipped: false,
    feedId: feed.id,
    lastCheckedAt: observation.checkedAt,
    lastDigest: recordedDigest(feed, observation),
    liveSupported: false,
    recordedPin: feed.pin,
    threatIntelTracked,
    upstreamPin,
    yamlEvaluated: false
  });
}

export function checkSecurityFeeds(
  feeds: readonly SecurityFeed[],
  input: {
    byFeedId?: Record<string, Omit<SecurityFeedObservation, "checkedAt">>;
    checkedAt: string;
  }
): SecurityFeedCheckResult[] {
  return feeds.map((feed) =>
    checkSecurityFeed(feed, {
      checkedAt: input.checkedAt,
      ...(input.byFeedId?.[feed.id] ?? {})
    })
  );
}

export function applySecurityFeedYaml(input: {
  feed: SecurityFeed;
  yaml: string;
}): SecurityFeedYamlApplyResult {
  void input.yaml;
  if (input.feed.pin.kind === "unpinned" || !input.feed.pin.value) {
    return SecurityFeedYamlApplyResultSchema.parse({
      applied: false,
      code: "unpinned_yaml_rejected",
      contentVersionStatus: "Rejected",
      evaluated: false,
      executablePinFlipped: false
    });
  }

  return SecurityFeedYamlApplyResultSchema.parse({
    applied: false,
    code: "yaml_not_executed",
    contentVersionStatus: "PendingReview",
    evaluated: false,
    executablePinFlipped: false,
    recordedPin: input.feed.pin
  });
}

export function withFeedCheckSnapshot(
  feed: SecurityFeed,
  check: SecurityFeedCheckResult
): SecurityFeed {
  return SecurityFeedSchema.parse({
    ...feed,
    lastCheckedAt: check.lastCheckedAt,
    lastDigest: check.lastDigest,
    pin: feed.pin,
    executablePin: feed.executablePin,
    liveSupported: false
  });
}
