import { afterEach, describe, expect, it } from "vitest";

import {
  isMfaRequiredForPasswordAuth,
  isMfaSetupAllowedPath,
  isPasswordSessionMfaSetupRestricted,
  isRequireMfaEnabled,
  privilegedActionRequiresMfaStepUp
} from "./mfa-policy.js";

const originalRequireMfa = process.env.PERISCAN_REQUIRE_MFA;
const originalDeploymentEnv = process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;
const originalNodeEnv = process.env.NODE_ENV;

afterEach(() => {
  if (originalRequireMfa === undefined) {
    delete process.env.PERISCAN_REQUIRE_MFA;
  } else {
    process.env.PERISCAN_REQUIRE_MFA = originalRequireMfa;
  }
  if (originalDeploymentEnv === undefined) {
    delete process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT;
  } else {
    process.env.PERISCAN_DEPLOYMENT_ENVIRONMENT = originalDeploymentEnv;
  }
  process.env.NODE_ENV = originalNodeEnv;
});

describe("isRequireMfaEnabled", () => {
  it("is off when unset", () => {
    expect(isRequireMfaEnabled({})).toBe(false);
    expect(isRequireMfaEnabled({ PERISCAN_REQUIRE_MFA: "" })).toBe(false);
  });

  it("is on when explicitly true", () => {
    expect(isRequireMfaEnabled({ PERISCAN_REQUIRE_MFA: "true" })).toBe(true);
  });

  it("is off when explicitly false", () => {
    expect(
      isRequireMfaEnabled({
        NODE_ENV: "production",
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_REQUIRE_MFA: "false"
      })
    ).toBe(false);
  });

  it("fails closed on malformed values in production", () => {
    expect(
      isRequireMfaEnabled({
        NODE_ENV: "production",
        PERISCAN_REQUIRE_MFA: "yes"
      })
    ).toBe(true);
    expect(
      isRequireMfaEnabled({
        PERISCAN_DEPLOYMENT_ENVIRONMENT: "production",
        PERISCAN_REQUIRE_MFA: "1"
      })
    ).toBe(true);
  });

  it("does not fail closed on malformed values outside production", () => {
    expect(
      isRequireMfaEnabled({
        NODE_ENV: "development",
        PERISCAN_REQUIRE_MFA: "yes"
      })
    ).toBe(false);
    expect(
      isRequireMfaEnabled({
        NODE_ENV: "test",
        PERISCAN_REQUIRE_MFA: "1"
      })
    ).toBe(false);
  });
});

describe("isMfaRequiredForPasswordAuth", () => {
  it("is true when env or tenant flag is set", () => {
    expect(
      isMfaRequiredForPasswordAuth({
        envRequireMfa: true,
        tenantRequireMfa: false
      })
    ).toBe(true);
    expect(
      isMfaRequiredForPasswordAuth({
        envRequireMfa: false,
        tenantRequireMfa: true
      })
    ).toBe(true);
    expect(
      isMfaRequiredForPasswordAuth({
        envRequireMfa: false,
        tenantRequireMfa: false
      })
    ).toBe(false);
  });
});

describe("isPasswordSessionMfaSetupRestricted", () => {
  it("restricts password sessions without MFA when policy is on", () => {
    expect(
      isPasswordSessionMfaSetupRestricted({
        authMethod: "password",
        mfaEnabled: false,
        mfaRequired: true
      })
    ).toBe(true);
  });

  it("does not restrict when MFA is enrolled", () => {
    expect(
      isPasswordSessionMfaSetupRestricted({
        authMethod: "password",
        mfaEnabled: true,
        mfaRequired: true
      })
    ).toBe(false);
  });

  it("does not restrict SSO sessions (IdP path)", () => {
    expect(
      isPasswordSessionMfaSetupRestricted({
        authMethod: "sso",
        mfaEnabled: false,
        mfaRequired: true
      })
    ).toBe(false);
  });

  it("does not restrict API key or system sessions", () => {
    expect(
      isPasswordSessionMfaSetupRestricted({
        authMethod: "api_key",
        mfaEnabled: false,
        mfaRequired: true
      })
    ).toBe(false);
    expect(
      isPasswordSessionMfaSetupRestricted({
        authMethod: "system",
        mfaEnabled: false,
        mfaRequired: true
      })
    ).toBe(false);
  });

  it("does not restrict when policy is off", () => {
    expect(
      isPasswordSessionMfaSetupRestricted({
        authMethod: "password",
        mfaEnabled: false,
        mfaRequired: false
      })
    ).toBe(false);
  });
});

describe("isMfaSetupAllowedPath", () => {
  it("allows enroll, verify, me, logout, and current tenant", () => {
    expect(isMfaSetupAllowedPath("/api/v1/me")).toBe(true);
    expect(isMfaSetupAllowedPath("/api/v1/auth/logout")).toBe(true);
    expect(isMfaSetupAllowedPath("/api/v1/auth/mfa/enroll")).toBe(true);
    expect(isMfaSetupAllowedPath("/api/v1/auth/mfa/verify")).toBe(true);
    expect(isMfaSetupAllowedPath("/api/v1/tenants/current")).toBe(true);
    expect(isMfaSetupAllowedPath("/api/v1/me?foo=1")).toBe(true);
  });

  it("allows reading force-MFA policy during setup but not mutating it", () => {
    expect(
      isMfaSetupAllowedPath(
        "/api/v1/tenants/current/security-settings/require-mfa",
        "GET"
      )
    ).toBe(true);
    expect(
      isMfaSetupAllowedPath(
        "/api/v1/tenants/current/security-settings/require-mfa",
        "PUT"
      )
    ).toBe(false);
  });

  it("denies product routes", () => {
    expect(isMfaSetupAllowedPath("/api/v1/scopes")).toBe(false);
    expect(isMfaSetupAllowedPath("/api/v1/auth/mfa/disable")).toBe(false);
    expect(isMfaSetupAllowedPath("/api/v1/tenants/current/api-keys")).toBe(
      false
    );
  });
});

describe("privilegedActionRequiresMfaStepUp", () => {
  it("requires step-up for password sessions under force-MFA", () => {
    expect(
      privilegedActionRequiresMfaStepUp({
        authMethod: "password",
        forceMfa: true,
        mfaEnabled: true
      })
    ).toBe(true);
  });

  it("requires step-up when MFA is enrolled even without force-MFA", () => {
    expect(
      privilegedActionRequiresMfaStepUp({
        authMethod: "password",
        forceMfa: false,
        mfaEnabled: true
      })
    ).toBe(true);
  });

  it("does not require step-up for SSO, API key, or system", () => {
    for (const authMethod of ["sso", "api_key", "system"] as const) {
      expect(
        privilegedActionRequiresMfaStepUp({
          authMethod,
          forceMfa: true,
          mfaEnabled: true
        })
      ).toBe(false);
    }
  });

  it("does not require step-up for password without MFA and without force", () => {
    expect(
      privilegedActionRequiresMfaStepUp({
        authMethod: "password",
        forceMfa: false,
        mfaEnabled: false
      })
    ).toBe(false);
  });
});
