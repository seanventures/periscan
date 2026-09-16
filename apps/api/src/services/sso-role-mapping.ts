import type { MembershipRole, TenantSsoRoleMappingRule } from "@periscan/shared";

/** Highest-privilege wins when a user matches multiple mapped groups. */
const ROLE_PRIVILEGE_RANK: Record<MembershipRole, number> = {
  Owner: 100,
  MSSPOwner: 95,
  Admin: 80,
  ClientAdmin: 70,
  SecurityEngineer: 50,
  Viewer: 10
};

export type SsoRoleMappingConfig = {
  defaultMappedRole: MembershipRole | null;
  roleClaimName: string | null;
  roleMappings: TenantSsoRoleMappingRule[];
};

export type ResolvedSsoRole =
  | {
      claimValues: string[];
      matchedClaimValues: string[];
      role: MembershipRole;
      status: "mapped" | "default";
    }
  | {
      claimValues: string[];
      matchedClaimValues: [];
      role: null;
      status: "disabled" | "unmapped";
    };

/**
 * Pull string claim values from an OIDC JWT payload or SAML attribute bag.
 * Supports string, string[], and nested objects with a `value` field.
 */
export function extractClaimValues(
  source: Record<string, unknown> | null | undefined,
  claimName: string
): string[] {
  if (!source || !claimName) {
    return [];
  }

  const raw = source[claimName];
  return normalizeClaimRaw(raw);
}

function normalizeClaimRaw(raw: unknown): string[] {
  if (raw == null) {
    return [];
  }

  if (typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
    const text = String(raw).trim();
    return text ? [text] : [];
  }

  if (Array.isArray(raw)) {
    const values: string[] = [];
    for (const item of raw) {
      values.push(...normalizeClaimRaw(item));
    }
    return [...new Set(values)];
  }

  if (typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if ("value" in record) {
      return normalizeClaimRaw(record.value);
    }
  }

  return [];
}

export function parseStoredRoleMappings(raw: unknown): TenantSsoRoleMappingRule[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const rules: TenantSsoRoleMappingRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const record = item as Record<string, unknown>;
    const claimValue =
      typeof record.claimValue === "string" ? record.claimValue.trim() : "";
    const role = record.role;
    if (
      !claimValue ||
      typeof role !== "string" ||
      !(role in ROLE_PRIVILEGE_RANK)
    ) {
      continue;
    }
    rules.push({ claimValue, role: role as MembershipRole });
  }
  return rules;
}

/**
 * Resolve a MembershipRole from IdP claims against tenant-configured mappings.
 *
 * - Empty `roleMappings` → mapping disabled (keep invite-time role).
 * - Non-empty mappings → deny-by-default unless a claim matches or
 *   `defaultMappedRole` is set.
 * - Multiple matches → highest-privilege role wins.
 */
export function resolveSsoMappedRole(input: {
  claims: Record<string, unknown> | null | undefined;
  config: SsoRoleMappingConfig;
}): ResolvedSsoRole {
  const mappings = input.config.roleMappings;
  if (mappings.length === 0) {
    return {
      claimValues: [],
      matchedClaimValues: [],
      role: null,
      status: "disabled"
    };
  }

  const claimName = (input.config.roleClaimName?.trim() || "groups").trim();
  const claimValues = extractClaimValues(input.claims, claimName);
  const claimSet = new Set(claimValues.map((value) => value.toLowerCase()));

  const matched: Array<{ claimValue: string; role: MembershipRole }> = [];
  for (const rule of mappings) {
    if (claimSet.has(rule.claimValue.toLowerCase())) {
      matched.push(rule);
    }
  }

  if (matched.length === 0) {
    if (input.config.defaultMappedRole) {
      return {
        claimValues,
        matchedClaimValues: [],
        role: input.config.defaultMappedRole,
        status: "default"
      };
    }
    return {
      claimValues,
      matchedClaimValues: [],
      role: null,
      status: "unmapped"
    };
  }

  let best = matched[0]!;
  for (const candidate of matched.slice(1)) {
    if (ROLE_PRIVILEGE_RANK[candidate.role] > ROLE_PRIVILEGE_RANK[best.role]) {
      best = candidate;
    }
  }

  return {
    claimValues,
    matchedClaimValues: matched.map((item) => item.claimValue),
    role: best.role,
    status: "mapped"
  };
}

export function pickHighestPrivilegeRole(
  roles: MembershipRole[]
): MembershipRole | null {
  if (roles.length === 0) {
    return null;
  }
  return roles.reduce((best, role) =>
    ROLE_PRIVILEGE_RANK[role] > ROLE_PRIVILEGE_RANK[best] ? role : best
  );
}
