import type { JitMembershipRole, MembershipRole } from "@periscan/shared";

export const SSO_JIT_DEFAULT_ROLE: JitMembershipRole = "Viewer";

export type SsoJitDenyReason =
  | "jit_disabled"
  | "domain_not_allowlisted"
  | "sso_unverified"
  | "forbidden_role"
  | "user_disabled"
  | "user_invited";

export type SsoJitDecision =
  | {
      ok: true;
      role: JitMembershipRole;
    }
  | {
      ok: false;
      code: "sso_user_not_provisioned";
      reason: SsoJitDenyReason;
    };

export type NormalizedSsoJitConfig =
  | {
      ok: true;
      jitDefaultRole: JitMembershipRole;
      jitEmailDomains: string[];
      jitEnabled: boolean;
    }
  | {
      ok: false;
      code: "sso_jit_allowlist_required" | "sso_jit_owner_forbidden";
    };

function uniqueLowercase(values: string[]): string[] {
  return [
    ...new Set(
      values.map((value) => value.trim().toLowerCase()).filter(Boolean)
    )
  ];
}

function emailDomain(email: string): string {
  return email.split("@").at(-1)?.toLowerCase() ?? "";
}

function isJitMembershipRole(role: MembershipRole): role is JitMembershipRole {
  return role !== "Owner";
}

export function normalizeSsoJitConfig(input: {
  jitDefaultRole?: MembershipRole | null;
  jitEmailDomains?: string[];
  jitEnabled?: boolean;
}): NormalizedSsoJitConfig {
  const jitEnabled = Boolean(input.jitEnabled);
  const jitEmailDomains = uniqueLowercase(input.jitEmailDomains ?? []);
  const requestedRole = input.jitDefaultRole ?? SSO_JIT_DEFAULT_ROLE;
  if (!isJitMembershipRole(requestedRole)) {
    return { ok: false, code: "sso_jit_owner_forbidden" };
  }
  if (jitEnabled && jitEmailDomains.length === 0) {
    return { ok: false, code: "sso_jit_allowlist_required" };
  }
  return {
    ok: true,
    jitDefaultRole: requestedRole,
    jitEmailDomains,
    jitEnabled
  };
}

export function evaluateSsoJitProvisioning(input: {
  email: string;
  existingUserStatus?: "Invited" | "Active" | "Disabled" | null;
  jitDefaultRole?: MembershipRole | null;
  jitEmailDomains: string[];
  jitEnabled: boolean;
  ssoVerified: boolean;
}): SsoJitDecision {
  if (input.existingUserStatus === "Disabled") {
    return {
      ok: false,
      code: "sso_user_not_provisioned",
      reason: "user_disabled"
    };
  }
  if (input.existingUserStatus === "Invited") {
    return {
      ok: false,
      code: "sso_user_not_provisioned",
      reason: "user_invited"
    };
  }
  if (!input.jitEnabled) {
    return {
      ok: false,
      code: "sso_user_not_provisioned",
      reason: "jit_disabled"
    };
  }
  if (!input.ssoVerified) {
    return {
      ok: false,
      code: "sso_user_not_provisioned",
      reason: "sso_unverified"
    };
  }

  const allowlist = uniqueLowercase(input.jitEmailDomains);
  if (!allowlist.includes(emailDomain(input.email))) {
    return {
      ok: false,
      code: "sso_user_not_provisioned",
      reason: "domain_not_allowlisted"
    };
  }

  const role = input.jitDefaultRole ?? SSO_JIT_DEFAULT_ROLE;
  if (!isJitMembershipRole(role)) {
    return {
      ok: false,
      code: "sso_user_not_provisioned",
      reason: "forbidden_role"
    };
  }

  return { ok: true, role };
}
