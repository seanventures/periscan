import { z } from "zod";

import { evaluateIdentityAbuseStart } from "./identity-candidates";

/**
 * identity.cred_spray is startable as an owned-account password-policy
 * test against verified-scope identities. Unscoped/internet spray is
 * High-danger (extra acknowledgement), not Community first-hour. Stolen
 * credentials are never persisted.
 */

export const IDENTITY_CRED_SPRAY_MODULE_ID = "identity.cred_spray" as const;

export const IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE =
  "identity_cred_spray_internet_forbidden" as const;

export const MIN_IDENTITY_CRED_SPRAY_RATE_PER_MINUTE = 1;
export const MAX_IDENTITY_CRED_SPRAY_RATE_PER_MINUTE = 12;
export const MAX_IDENTITY_CRED_SPRAY_OWNED_IDENTITIES = 16;

const UuidSchema = z.uuid();

export const IdentityCredSprayOwnershipSchema = z.enum([
  "tenant_owned",
  "customer_owned"
]);

export const IdentityCredSprayOwnedIdentitySchema = z.strictObject({
  inVerifiedScope: z.literal(true),
  ownership: IdentityCredSprayOwnershipSchema,
  username: z.string().min(1).max(256)
});

export type IdentityCredSprayOwnedIdentity = z.infer<
  typeof IdentityCredSprayOwnedIdentitySchema
>;

export const IdentityCredSprayStartDecisionSchema = z.strictObject({
  allowed: z.boolean(),
  auditRequired: z.literal(true),
  code: z.string().min(1).nullable(),
  jobsQueued: z.union([z.literal(0), z.literal(1)]),
  measurementClass: z.enum(["Config", "Danger", "Forbidden"]),
  persistCredentials: z.literal(false),
  rationale: z.string().min(1),
  startable: z.boolean()
});

export type IdentityCredSprayStartDecision = z.infer<
  typeof IdentityCredSprayStartDecisionSchema
>;

const INTERNAL_HOST_SUFFIXES = [
  ".internal",
  ".local",
  ".lab",
  ".test",
  ".lan",
  ".corp",
  ".home"
] as const;

function isPrivateOrReservedIpv4(host: string): boolean {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }
  const [a, b] = parts;
  if (a === undefined || b === undefined) {
    return true;
  }
  if (a === 10 || a === 127 || a === 0) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  if (a === 100 && b >= 64 && b <= 127) {
    return true;
  }
  if (a >= 224) {
    return true;
  }
  return false;
}

export function isInternetSprayHost(host: unknown): boolean {
  if (typeof host !== "string" || host.trim().length === 0) {
    return false;
  }
  const value = host.trim().toLowerCase().replace(/^\[|\]$/gu, "");
  if (value === "localhost" || value.endsWith(".localhost")) {
    return false;
  }
  if (/^\d{1,3}(\.\d{1,3}){3}$/u.test(value)) {
    return !isPrivateOrReservedIpv4(value);
  }
  if (value.includes(":")) {
    if (
      value === "::1" ||
      value === "::" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      value.startsWith("fe80")
    ) {
      return false;
    }
    return true;
  }
  if (INTERNAL_HOST_SUFFIXES.some((suffix) => value.endsWith(suffix))) {
    return false;
  }
  return value.includes(".");
}

function hasOwnedIdentities(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }
  if (value.length > MAX_IDENTITY_CRED_SPRAY_OWNED_IDENTITIES) {
    return false;
  }
  return value.every(
    (entry) => IdentityCredSprayOwnedIdentitySchema.safeParse(entry).success
  );
}

function deny(input: {
  code: string;
  measurementClass?: "Config" | "Danger" | "Forbidden";
  rationale: string;
}): IdentityCredSprayStartDecision {
  return IdentityCredSprayStartDecisionSchema.parse({
    allowed: false,
    auditRequired: true,
    code: input.code,
    jobsQueued: 0,
    measurementClass: input.measurementClass ?? "Forbidden",
    persistCredentials: false,
    rationale: input.rationale,
    startable: false
  });
}

function requestsCredentialPersistence(target: Record<string, unknown>): boolean {
  return (
    target.persistCredentials === true ||
    target.persistStolenCredentials === true ||
    target.credentialTheft === true ||
    target.storeValidCredentials === true
  );
}

function isInternetOrUnscopedSpray(target: Record<string, unknown>): boolean {
  return (
    target.sprayMode === "internet" ||
    target.unscoped === true ||
    isInternetSprayHost(target.targetHost)
  );
}

export function evaluateIdentityCredSprayStart(
  target: Record<string, unknown>
): IdentityCredSprayStartDecision {
  if (isInternetOrUnscopedSpray(target)) {
    return deny({
      code: IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE,
      measurementClass: "Danger",
      rationale:
        "Internet and unscoped credential spray are High-danger. Extra acknowledgement + qualification + tenant authorization required. Not Community default start."
    });
  }

  const abuse = evaluateIdentityAbuseStart({
    candidates: target.identityCandidates,
    moduleId: IDENTITY_CRED_SPRAY_MODULE_ID,
    promotedExternalIds: target.promotedIdentityExternalIds,
    sprayMode: target.sprayMode,
    unscoped: target.unscoped
  });
  if (!abuse.allowed) {
    return deny({
      code: abuse.code ?? "identity_abuse_promote_to_scope_required",
      measurementClass: abuse.measurementClass,
      rationale: abuse.rationale
    });
  }

  if (requestsCredentialPersistence(target)) {
    return deny({
      code: "identity_cred_spray_credential_persistence_forbidden",
      measurementClass: "Danger",
      rationale:
        "Credential persistence is High-danger. Owned-account password-policy tests never store recovered passwords without extra acknowledgement."
    });
  }

  if (target.scopeVerified !== true) {
    return deny({
      code: "identity_cred_spray_requires_verified_scope",
      measurementClass: "Forbidden",
      rationale:
        "Verified scope is required before an owned-account password-policy test can start."
    });
  }

  if (!hasOwnedIdentities(target.ownedIdentities)) {
    return deny({
      code: "identity_cred_spray_owned_identities_required",
      measurementClass: "Forbidden",
      rationale:
        "Targets must be verified-scope owned identities. Directory-wide or unowned spray is not startable."
    });
  }

  if (
    target.purpose !== "password_policy" ||
    target.sprayMode !== "owned_account"
  ) {
    return deny({
      code: IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE,
      measurementClass: "Forbidden",
      rationale:
        "identity.cred_spray is startable only as an owned-account password-policy test, never internet spray."
    });
  }

  const rate = target.rateLimitPerMinute;
  if (
    typeof rate !== "number" ||
    !Number.isInteger(rate) ||
    rate < MIN_IDENTITY_CRED_SPRAY_RATE_PER_MINUTE ||
    rate > MAX_IDENTITY_CRED_SPRAY_RATE_PER_MINUTE
  ) {
    return deny({
      code: "identity_cred_spray_rate_limit_required",
      measurementClass: "Forbidden",
      rationale: `Owned-account password-policy tests require a bounded rateLimitPerMinute between ${MIN_IDENTITY_CRED_SPRAY_RATE_PER_MINUTE} and ${MAX_IDENTITY_CRED_SPRAY_RATE_PER_MINUTE}.`
    });
  }

  if (
    typeof target.policyDecisionId !== "string" ||
    !UuidSchema.safeParse(target.policyDecisionId).success
  ) {
    return deny({
      code: "identity_cred_spray_audit_required",
      measurementClass: "Forbidden",
      rationale:
        "An audited policy decision is required before identity.cred_spray can start."
    });
  }

  if (
    target.authorizedOffensive !== true ||
    typeof target.approvalId !== "string" ||
    target.approvalId.length === 0
  ) {
    return deny({
      code: "identity_cred_spray_requires_approval",
      measurementClass: "Forbidden",
      rationale:
        "Owned-account password-policy tests require explicit offensive-execution approval."
    });
  }

  return IdentityCredSprayStartDecisionSchema.parse({
    allowed: true,
    auditRequired: true,
    code: "identity_cred_spray_owned_account_password_policy",
    jobsQueued: 1,
    measurementClass: "Config",
    persistCredentials: false,
    rationale:
      "Owned-account password-policy test against verified-scope identities. Rate-limited, audited, no credential persistence, not internet spray.",
    startable: true
  });
}
