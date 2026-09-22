import { describe, expect, it } from "vitest";

import {
  evaluateSsoJitProvisioning,
  normalizeSsoJitConfig
} from "./sso-jit.js";

describe("normalizeSsoJitConfig", () => {
  it("defaults to disabled Viewer with an empty allowlist", () => {
    expect(normalizeSsoJitConfig({})).toEqual({
      ok: true,
      jitDefaultRole: "Viewer",
      jitEmailDomains: [],
      jitEnabled: false
    });
  });

  it("requires a domain allowlist when JIT is enabled", () => {
    expect(
      normalizeSsoJitConfig({
        jitEnabled: true,
        jitEmailDomains: [" ", ""]
      })
    ).toMatchObject({
      code: "sso_jit_allowlist_required",
      ok: false
    });
  });

  it("never accepts Owner as the JIT default role", () => {
    expect(
      normalizeSsoJitConfig({
        jitDefaultRole: "Owner",
        jitEmailDomains: ["example.com"],
        jitEnabled: true
      })
    ).toMatchObject({
      code: "sso_jit_owner_forbidden",
      ok: false
    });
  });

  it("normalizes domains lowercase unique and keeps non-Owner roles", () => {
    expect(
      normalizeSsoJitConfig({
        jitDefaultRole: "Admin",
        jitEmailDomains: ["Example.COM", "example.com", "acme.test"],
        jitEnabled: true
      })
    ).toEqual({
      ok: true,
      jitDefaultRole: "Admin",
      jitEmailDomains: ["example.com", "acme.test"],
      jitEnabled: true
    });
  });
});

describe("evaluateSsoJitProvisioning", () => {
  const allowlisted = {
    email: "new.user@example.com",
    jitEmailDomains: ["example.com"],
    jitEnabled: true,
    ssoVerified: true
  };

  it("creates Viewer by default when enabled, allowlisted, and SSO-verified", () => {
    expect(evaluateSsoJitProvisioning(allowlisted)).toEqual({
      ok: true,
      role: "Viewer"
    });
  });

  it("uses a configured non-Owner default role", () => {
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        jitDefaultRole: "SecurityEngineer"
      })
    ).toEqual({ ok: true, role: "SecurityEngineer" });
  });

  it("fails closed when JIT is disabled", () => {
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        jitEnabled: false
      })
    ).toMatchObject({
      code: "sso_user_not_provisioned",
      ok: false,
      reason: "jit_disabled"
    });
  });

  it("fails closed when the email domain is not on the JIT allowlist", () => {
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        email: "intruder@other.test"
      })
    ).toMatchObject({
      code: "sso_user_not_provisioned",
      ok: false,
      reason: "domain_not_allowlisted"
    });
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        jitEmailDomains: []
      })
    ).toMatchObject({
      reason: "domain_not_allowlisted"
    });
  });

  it("fails closed unless SSO email is verified", () => {
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        ssoVerified: false
      })
    ).toMatchObject({
      code: "sso_user_not_provisioned",
      ok: false,
      reason: "sso_unverified"
    });
  });

  it("never JIT-promotes Owner even if a caller smuggles the role", () => {
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        jitDefaultRole: "Owner"
      })
    ).toMatchObject({
      code: "sso_user_not_provisioned",
      ok: false,
      reason: "forbidden_role"
    });
  });

  it("does not reactivate Disabled or Invited users", () => {
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        existingUserStatus: "Disabled"
      })
    ).toMatchObject({ reason: "user_disabled" });
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        existingUserStatus: "Invited"
      })
    ).toMatchObject({ reason: "user_invited" });
  });

  it("allows an existing Active user without this tenant membership", () => {
    expect(
      evaluateSsoJitProvisioning({
        ...allowlisted,
        existingUserStatus: "Active"
      })
    ).toEqual({ ok: true, role: "Viewer" });
  });
});
