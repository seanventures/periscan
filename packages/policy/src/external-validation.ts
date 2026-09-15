import * as dns from "node:dns/promises";
import * as net from "node:net";

import { z } from "zod";

import {
  ExecutionEnvironmentSchema,
  ScopeTypeSchema,
  ScopeVerificationStatusSchema
} from "@periscan/shared";

export const ExternalValidationTemplateProfileSchema = z.enum([
  "safe-baseline",
  "safe-http-fingerprint",
  "safe-http-headers",
  "safe-public-metadata"
]);

export const ExternalValidationTemplateProfileMetadataSchema = z.object({
  defaultRateLimit: z.number().int().positive(),
  description: z.string().min(1),
  displayName: z.string().min(1),
  maxRequestsPerTarget: z.number().int().positive(),
  profile: ExternalValidationTemplateProfileSchema,
  safetyNotes: z.array(z.string().min(1)),
  templateIds: z.array(z.string().min(1))
});

export const ExternalValidationDenialCodeSchema = z.enum([
  "BlockedTarget",
  "GlobalRateLimitExceeded",
  "KillSwitchEnabled",
  "PrivateOrReservedTarget",
  "ScopeTypeUnsupported",
  "TargetOutsideVerifiedScope",
  "TargetRateLimitExceeded",
  "TenantRateLimitExceeded",
  "UnverifiedScope",
  "UnsafeExecutionEnvironment",
  "UnsafeTemplateProfile"
]);

export const ExternalValidationGuardInputSchema = z.object({
  blockedTargets: z.array(z.string().min(1)).default([]),
  executionEnvironment: ExecutionEnvironmentSchema,
  globalWindowLimit: z.number().int().positive(),
  globalWindowRequestCount: z.number().int().nonnegative(),
  killSwitchEnabled: z.boolean().default(false),
  scopeType: ScopeTypeSchema,
  scopeValue: z.string().min(1),
  scopeVerificationStatus: ScopeVerificationStatusSchema,
  targetHostname: z.string().min(1),
  // Per-target request ceiling for the active template profile
  // (maxRequestsPerTarget). Null/absent means no per-target cap applies, so the
  // guard leaves per-target throttling to the tenant/global window limits.
  targetWindowLimit: z.number().int().positive().nullish(),
  targetWindowRequestCount: z.number().int().nonnegative().nullish(),
  templateProfile: z.string().min(1),
  tenantWindowLimit: z.number().int().positive(),
  tenantWindowRequestCount: z.number().int().nonnegative()
});

export const ExternalValidationGuardResultSchema = z.object({
  allowed: z.boolean(),
  denialCode: ExternalValidationDenialCodeSchema.nullish(),
  rationale: z.string().min(1)
});

export type ExternalValidationTemplateProfile = z.infer<
  typeof ExternalValidationTemplateProfileSchema
>;
export type ExternalValidationTemplateProfileMetadata = z.infer<
  typeof ExternalValidationTemplateProfileMetadataSchema
>;
export type ExternalValidationDenialCode = z.infer<
  typeof ExternalValidationDenialCodeSchema
>;
export type ExternalValidationGuardInput = z.infer<
  typeof ExternalValidationGuardInputSchema
>;
export type ExternalValidationGuardResult = z.infer<
  typeof ExternalValidationGuardResultSchema
>;

const EXTERNAL_VALIDATION_TEMPLATE_PROFILE_METADATA: ExternalValidationTemplateProfileMetadata[] =
  z.array(ExternalValidationTemplateProfileMetadataSchema).parse([
    {
      defaultRateLimit: 10,
      description:
        "Runs the full Periscan safe external baseline of non-invasive GET-only observations.",
      displayName: "Safe Baseline",
      maxRequestsPerTarget: 25,
      profile: "safe-baseline",
      safetyNotes: [
        "GET-only checks",
        "No fuzzing, brute force, credential use, or exploit payloads",
        "Requires verified domain or subdomain scope"
      ],
      templateIds: [
        "periscan-safe-http-fingerprint",
        "periscan-safe-http-security-headers",
        "periscan-safe-public-metadata"
      ]
    },
    {
      defaultRateLimit: 5,
      description:
        "Performs a single safe homepage request to identify externally reachable service posture.",
      displayName: "Safe HTTP Fingerprint",
      maxRequestsPerTarget: 5,
      profile: "safe-http-fingerprint",
      safetyNotes: [
        "Single GET request to the base URL",
        "Captures only status-level service observation metadata"
      ],
      templateIds: ["periscan-safe-http-fingerprint"]
    },
    {
      defaultRateLimit: 5,
      description:
        "Checks response-header presence for safe control and hardening observations without sending payloads.",
      displayName: "Safe HTTP Header Review",
      maxRequestsPerTarget: 5,
      profile: "safe-http-headers",
      safetyNotes: [
        "GET-only request to the base URL",
        "No header injection, fuzzing, or bypass attempts"
      ],
      templateIds: ["periscan-safe-http-security-headers"]
    },
    {
      defaultRateLimit: 10,
      description:
        "Requests common public metadata paths such as robots.txt, sitemap.xml, and security.txt.",
      displayName: "Safe Public Metadata",
      maxRequestsPerTarget: 10,
      profile: "safe-public-metadata",
      safetyNotes: [
        "GET-only requests to standard public metadata paths",
        "No crawling beyond the allowlisted paths"
      ],
      templateIds: ["periscan-safe-public-metadata"]
    }
  ]);

export function listExternalValidationTemplateProfiles() {
  return EXTERNAL_VALIDATION_TEMPLATE_PROFILE_METADATA.map((profile) => ({
    ...profile,
    safetyNotes: [...profile.safetyNotes],
    templateIds: [...profile.templateIds]
  }));
}

/**
 * The per-target request ceiling (`maxRequestsPerTarget`) for a template
 * profile, or null when the profile is unknown. This is the safety bound on how
 * many external-validation requests may hit a single target within a rate
 * window; the guard enforces it through `targetWindowLimit`. Returning null for
 * an unknown profile is safe because the guard rejects unrecognized profiles
 * (`UnsafeTemplateProfile`) before the per-target check is reached.
 */
export function getExternalValidationTargetRequestLimit(
  templateProfile: string
): number | null {
  const profile = EXTERNAL_VALIDATION_TEMPLATE_PROFILE_METADATA.find(
    (entry) => entry.profile === templateProfile
  );

  return profile ? profile.maxRequestsPerTarget : null;
}

function normalizeHostname(value: string) {
  return value.trim().toLowerCase().replace(/\.+$/, "");
}

function isScopeCompatible(
  scopeType: ExternalValidationGuardInput["scopeType"]
) {
  return scopeType === "Domain" || scopeType === "Subdomain";
}

function targetMatchesScope(
  scopeType: ExternalValidationGuardInput["scopeType"],
  scopeValue: string,
  targetHostname: string
) {
  const normalizedScope = normalizeHostname(scopeValue);
  const normalizedTarget = normalizeHostname(targetHostname);

  if (scopeType === "Domain") {
    return (
      normalizedTarget === normalizedScope ||
      normalizedTarget.endsWith(`.${normalizedScope}`)
    );
  }

  return normalizedTarget === normalizedScope;
}

function isBlockedTarget(targetHostname: string, blockedTargets: string[]) {
  const normalizedTarget = normalizeHostname(targetHostname);

  return blockedTargets.some((blockedTarget) => {
    const normalizedBlocked = normalizeHostname(blockedTarget);

    return (
      normalizedTarget === normalizedBlocked ||
      normalizedTarget.endsWith(`.${normalizedBlocked}`)
    );
  });
}

function isReservedHostname(targetHostname: string) {
  const normalizedTarget = normalizeHostname(targetHostname);

  return (
    normalizedTarget === "localhost" ||
    normalizedTarget.endsWith(".local") ||
    normalizedTarget.endsWith(".internal") ||
    normalizedTarget.endsWith(".lan") ||
    normalizedTarget.endsWith(".home")
  );
}

function parseIpv4Part(part: string) {
  const parsed = Number.parseInt(part, 10);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) {
    return null;
  }

  return parsed;
}

/**
 * True when the host string is a reserved/private IP literal, or a reserved
 * hostname label (localhost / .local / …). Does **not** resolve DNS — use
 * `assertHostnameResolvesPublic` at fetch/queue time to close DNS rebinding.
 */
export function isReservedIpAddress(targetHostname: string) {
  const normalizedTarget = normalizeHostname(targetHostname);
  const ipVersion = net.isIP(normalizedTarget);

  if (ipVersion === 0) {
    return isReservedHostname(normalizedTarget);
  }

  if (ipVersion === 6) {
    return (
      normalizedTarget === "::1" ||
      normalizedTarget.startsWith("fc") ||
      normalizedTarget.startsWith("fd") ||
      normalizedTarget.startsWith("fe80:")
    );
  }

  const octets = normalizedTarget
    .split(".")
    .map((part) => parseIpv4Part(part))
    .filter((part): part is number => part !== null);

  if (octets.length !== 4) {
    return true;
  }

  const first = octets[0]!;
  const second = octets[1]!;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

export type HostnameResolvePublicResult =
  | { ok: true; addresses: string[] }
  | { ok: false; rationale: string };

/**
 * Post-resolve SSRF / DNS-rebinding guard: resolve A/AAAA and deny if **any**
 * address is private, loopback, link-local, CGNAT, or reserved. Call this at
 * policy-decision and again immediately before outbound connect so a public
 * name cannot rebind to 169.254.169.254 between checks.
 *
 * Injectable `lookup` is for tests only.
 */
export async function assertHostnameResolvesPublic(
  targetHostname: string,
  lookup: typeof dns.lookup = dns.lookup
): Promise<HostnameResolvePublicResult> {
  const normalizedTarget = normalizeHostname(targetHostname);

  if (!normalizedTarget) {
    return { ok: false, rationale: "Hostname is empty." };
  }

  // IP literals: no DNS step; same reserved ranges as pre-resolve guard.
  if (net.isIP(normalizedTarget) !== 0) {
    if (isReservedIpAddress(normalizedTarget)) {
      return {
        ok: false,
        rationale:
          "Target is a private, loopback, link-local, or reserved address."
      };
    }
    return { ok: true, addresses: [normalizedTarget] };
  }

  if (isReservedHostname(normalizedTarget)) {
    return {
      ok: false,
      rationale: "Target hostname is reserved (localhost / local / internal)."
    };
  }

  let entries: Array<{ address: string; family: number }>;
  try {
    entries = await lookup(normalizedTarget, { all: true, verbatim: true });
  } catch {
    return {
      ok: false,
      rationale: `Hostname ${normalizedTarget} could not be resolved.`
    };
  }

  if (!entries.length) {
    return {
      ok: false,
      rationale: `Hostname ${normalizedTarget} did not resolve to any address.`
    };
  }

  for (const entry of entries) {
    if (isReservedIpAddress(entry.address)) {
      return {
        ok: false,
        rationale: `Hostname ${normalizedTarget} resolves to private or reserved address ${entry.address}.`
      };
    }
  }

  return {
    ok: true,
    addresses: entries.map((entry) => entry.address)
  };
}

function deny(
  denialCode: ExternalValidationDenialCode,
  rationale: string
): ExternalValidationGuardResult {
  return ExternalValidationGuardResultSchema.parse({
    allowed: false,
    denialCode,
    rationale
  });
}

export function evaluateExternalValidationGuard(
  rawInput: ExternalValidationGuardInput
): ExternalValidationGuardResult {
  const input = ExternalValidationGuardInputSchema.parse(rawInput);

  if (input.killSwitchEnabled) {
    return deny(
      "KillSwitchEnabled",
      "External validation is disabled by the Periscan admin kill switch."
    );
  }

  if (input.executionEnvironment !== "ExternalPoA") {
    return deny(
      "UnsafeExecutionEnvironment",
      "This validation profile is restricted to the external point-of-attack environment."
    );
  }

  if (input.scopeVerificationStatus !== "Verified") {
    return deny(
      "UnverifiedScope",
      "External validation requires a verified domain or subdomain scope."
    );
  }

  if (!isScopeCompatible(input.scopeType)) {
    return deny(
      "ScopeTypeUnsupported",
      "External validation currently supports verified domain and subdomain scopes only."
    );
  }

  const parsedTemplateProfile =
    ExternalValidationTemplateProfileSchema.safeParse(input.templateProfile);

  if (!parsedTemplateProfile.success) {
    return deny(
      "UnsafeTemplateProfile",
      "Only allowlisted safe Nuclei template profiles are permitted."
    );
  }

  if (isBlockedTarget(input.targetHostname, input.blockedTargets)) {
    return deny(
      "BlockedTarget",
      `Target ${normalizeHostname(input.targetHostname)} is on the external validation blocklist.`
    );
  }

  if (isReservedIpAddress(input.targetHostname)) {
    return deny(
      "PrivateOrReservedTarget",
      "External validation may not target private, loopback, link-local, or reserved addresses."
    );
  }

  if (
    !targetMatchesScope(input.scopeType, input.scopeValue, input.targetHostname)
  ) {
    return deny(
      "TargetOutsideVerifiedScope",
      "External validation target must be inside the verified customer-authorized domain scope."
    );
  }

  if (
    input.targetWindowLimit != null &&
    (input.targetWindowRequestCount ?? 0) >= input.targetWindowLimit
  ) {
    return deny(
      "TargetRateLimitExceeded",
      "External validation per-target request limit exceeded for this target in the current execution window."
    );
  }

  if (input.tenantWindowRequestCount >= input.tenantWindowLimit) {
    return deny(
      "TenantRateLimitExceeded",
      "Tenant external validation rate limit exceeded for the current execution window."
    );
  }

  if (input.globalWindowRequestCount >= input.globalWindowLimit) {
    return deny(
      "GlobalRateLimitExceeded",
      "Global external validation rate limit exceeded for the current execution window."
    );
  }

  return ExternalValidationGuardResultSchema.parse({
    allowed: true,
    denialCode: null,
    rationale: `Target is within verified scope, uses the ${parsedTemplateProfile.data} profile, and is inside current external validation limits.`
  });
}

/**
 * Async post-resolve complement to `evaluateExternalValidationGuard`. Call after
 * the sync guard allows, so DNS rebinding to private ranges is denied before
 * work is queued or executed.
 */
export async function evaluateExternalValidationResolvedTarget(
  targetHostname: string,
  lookup?: typeof dns.lookup
): Promise<ExternalValidationGuardResult> {
  const resolved = await assertHostnameResolvesPublic(targetHostname, lookup);

  if (!resolved.ok) {
    return deny("PrivateOrReservedTarget", resolved.rationale);
  }

  return ExternalValidationGuardResultSchema.parse({
    allowed: true,
    denialCode: null,
    rationale: `Target ${normalizeHostname(targetHostname)} resolves only to public addresses (${resolved.addresses.join(", ")}).`
  });
}
