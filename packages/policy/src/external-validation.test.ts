import { describe, expect, it } from "vitest";

import {
  assertHostnameResolvesPublic,
  evaluateExternalValidationGuard,
  evaluateExternalValidationResolvedTarget,
  getExternalValidationTargetRequestLimit,
  listExternalValidationTemplateProfiles
} from "./external-validation.js";

describe("evaluateExternalValidationGuard", () => {
  it("lists the allowlisted safe external validation profiles", () => {
    const profiles = listExternalValidationTemplateProfiles();

    expect(profiles.map((profile) => profile.profile)).toEqual(
      expect.arrayContaining([
        "safe-baseline",
        "safe-http-fingerprint",
        "safe-http-headers",
        "safe-public-metadata"
      ])
    );
    expect(
      profiles.find((profile) => profile.profile === "safe-baseline")
        ?.templateIds
    ).toEqual(
      expect.arrayContaining([
        "periscan-safe-http-fingerprint",
        "periscan-safe-http-security-headers",
        "periscan-safe-public-metadata"
      ])
    );
  });

  it("allows safe verified external validation inside domain scope", () => {
    expect(
      evaluateExternalValidationGuard({
        blockedTargets: [],
        executionEnvironment: "ExternalPoA",
        globalWindowLimit: 50,
        globalWindowRequestCount: 1,
        killSwitchEnabled: false,
        scopeType: "Domain",
        scopeValue: "example.com",
        scopeVerificationStatus: "Verified",
        targetHostname: "api.example.com",
        templateProfile: "safe-baseline",
        tenantWindowLimit: 10,
        tenantWindowRequestCount: 1
      }).allowed
    ).toBe(true);
  });

  it("allows narrowed safe profile variants inside verified scope", () => {
    const result = evaluateExternalValidationGuard({
      blockedTargets: [],
      executionEnvironment: "ExternalPoA",
      globalWindowLimit: 50,
      globalWindowRequestCount: 1,
      killSwitchEnabled: false,
      scopeType: "Domain",
      scopeValue: "example.com",
      scopeVerificationStatus: "Verified",
      targetHostname: "api.example.com",
      templateProfile: "safe-http-headers",
      tenantWindowLimit: 10,
      tenantWindowRequestCount: 1
    });

    expect(result.allowed).toBe(true);
    expect(result.rationale).toContain("safe-http-headers");
  });

  it("denies private or reserved targets for external validation", () => {
    const result = evaluateExternalValidationGuard({
      blockedTargets: [],
      executionEnvironment: "ExternalPoA",
      globalWindowLimit: 50,
      globalWindowRequestCount: 1,
      killSwitchEnabled: false,
      scopeType: "Domain",
      scopeValue: "example.com",
      scopeVerificationStatus: "Verified",
      targetHostname: "127.0.0.1",
      templateProfile: "safe-baseline",
      tenantWindowLimit: 10,
      tenantWindowRequestCount: 1
    });

    expect(result.allowed).toBe(false);
    expect(result.denialCode).toBe("PrivateOrReservedTarget");
  });

  it("denies third-party targets outside the verified scope", () => {
    const result = evaluateExternalValidationGuard({
      blockedTargets: [],
      executionEnvironment: "ExternalPoA",
      globalWindowLimit: 50,
      globalWindowRequestCount: 1,
      killSwitchEnabled: false,
      scopeType: "Domain",
      scopeValue: "example.com",
      scopeVerificationStatus: "Verified",
      targetHostname: "attacker.com",
      templateProfile: "safe-baseline",
      tenantWindowLimit: 10,
      tenantWindowRequestCount: 1
    });

    expect(result.allowed).toBe(false);
    expect(result.denialCode).toBe("TargetOutsideVerifiedScope");
  });

  it("denies requests when limits or kill switch are active", () => {
    expect(
      evaluateExternalValidationGuard({
        blockedTargets: [],
        executionEnvironment: "ExternalPoA",
        globalWindowLimit: 50,
        globalWindowRequestCount: 1,
        killSwitchEnabled: true,
        scopeType: "Domain",
        scopeValue: "example.com",
        scopeVerificationStatus: "Verified",
        targetHostname: "api.example.com",
        templateProfile: "safe-baseline",
        tenantWindowLimit: 10,
        tenantWindowRequestCount: 1
      }).denialCode
    ).toBe("KillSwitchEnabled");

    expect(
      evaluateExternalValidationGuard({
        blockedTargets: [],
        executionEnvironment: "ExternalPoA",
        globalWindowLimit: 2,
        globalWindowRequestCount: 2,
        killSwitchEnabled: false,
        scopeType: "Domain",
        scopeValue: "example.com",
        scopeVerificationStatus: "Verified",
        targetHostname: "api.example.com",
        templateProfile: "safe-baseline",
        tenantWindowLimit: 10,
        tenantWindowRequestCount: 1
      }).denialCode
    ).toBe("GlobalRateLimitExceeded");

    expect(
      evaluateExternalValidationGuard({
        blockedTargets: ["blocked.example.com"],
        executionEnvironment: "ExternalPoA",
        globalWindowLimit: 50,
        globalWindowRequestCount: 1,
        killSwitchEnabled: false,
        scopeType: "Domain",
        scopeValue: "example.com",
        scopeVerificationStatus: "Verified",
        targetHostname: "blocked.example.com",
        templateProfile: "safe-baseline",
        tenantWindowLimit: 2,
        tenantWindowRequestCount: 1
      }).denialCode
    ).toBe("BlockedTarget");

    expect(
      evaluateExternalValidationGuard({
        blockedTargets: [],
        executionEnvironment: "ExternalPoA",
        globalWindowLimit: 50,
        globalWindowRequestCount: 1,
        killSwitchEnabled: false,
        scopeType: "Domain",
        scopeValue: "example.com",
        scopeVerificationStatus: "Verified",
        targetHostname: "api.example.com",
        templateProfile: "unsafe-profile",
        tenantWindowLimit: 2,
        tenantWindowRequestCount: 1
      }).denialCode
    ).toBe("UnsafeTemplateProfile");

    expect(
      evaluateExternalValidationGuard({
        blockedTargets: [],
        executionEnvironment: "ExternalPoA",
        globalWindowLimit: 50,
        globalWindowRequestCount: 1,
        killSwitchEnabled: false,
        scopeType: "Domain",
        scopeValue: "example.com",
        scopeVerificationStatus: "Verified",
        targetHostname: "api.example.com",
        templateProfile: "safe-baseline",
        tenantWindowLimit: 2,
        tenantWindowRequestCount: 2
      }).denialCode
    ).toBe("TenantRateLimitExceeded");
  });

  it("exposes each profile's per-target request ceiling", () => {
    expect(getExternalValidationTargetRequestLimit("safe-baseline")).toBe(25);
    expect(
      getExternalValidationTargetRequestLimit("safe-http-fingerprint")
    ).toBe(5);
    expect(getExternalValidationTargetRequestLimit("safe-http-headers")).toBe(
      5
    );
    expect(
      getExternalValidationTargetRequestLimit("safe-public-metadata")
    ).toBe(10);
    expect(
      getExternalValidationTargetRequestLimit("unknown-profile")
    ).toBeNull();
  });

  it("enforces the per-target request ceiling before the tenant window fills", () => {
    const limit = getExternalValidationTargetRequestLimit("safe-http-headers")!;
    const result = evaluateExternalValidationGuard({
      blockedTargets: [],
      executionEnvironment: "ExternalPoA",
      // Tenant and global windows still have headroom; only the per-target cap
      // is exhausted, so without per-target enforcement this would be allowed.
      globalWindowLimit: 50,
      globalWindowRequestCount: 1,
      killSwitchEnabled: false,
      scopeType: "Domain",
      scopeValue: "example.com",
      scopeVerificationStatus: "Verified",
      targetHostname: "api.example.com",
      targetWindowLimit: limit,
      targetWindowRequestCount: limit,
      templateProfile: "safe-http-headers",
      tenantWindowLimit: 25,
      tenantWindowRequestCount: 1
    });

    expect(result.allowed).toBe(false);
    expect(result.denialCode).toBe("TargetRateLimitExceeded");
  });

  it("allows a target still under its per-target ceiling", () => {
    const limit = getExternalValidationTargetRequestLimit("safe-baseline")!;
    const result = evaluateExternalValidationGuard({
      blockedTargets: [],
      executionEnvironment: "ExternalPoA",
      globalWindowLimit: 50,
      globalWindowRequestCount: 1,
      killSwitchEnabled: false,
      scopeType: "Domain",
      scopeValue: "example.com",
      scopeVerificationStatus: "Verified",
      targetHostname: "api.example.com",
      targetWindowLimit: limit,
      targetWindowRequestCount: limit - 1,
      templateProfile: "safe-baseline",
      tenantWindowLimit: 25,
      tenantWindowRequestCount: 1
    });

    expect(result.allowed).toBe(true);
  });

  it("skips per-target enforcement when no ceiling is supplied", () => {
    const result = evaluateExternalValidationGuard({
      blockedTargets: [],
      executionEnvironment: "ExternalPoA",
      globalWindowLimit: 50,
      globalWindowRequestCount: 1,
      killSwitchEnabled: false,
      scopeType: "Domain",
      scopeValue: "example.com",
      scopeVerificationStatus: "Verified",
      targetHostname: "api.example.com",
      targetWindowRequestCount: 9_999,
      templateProfile: "safe-baseline",
      tenantWindowLimit: 25,
      tenantWindowRequestCount: 1
    });

    expect(result.allowed).toBe(true);
  });
});

describe("assertHostnameResolvesPublic (DNS rebinding residual)", () => {
  it("allows public IP literals", async () => {
    await expect(assertHostnameResolvesPublic("93.184.216.34")).resolves.toEqual(
      {
        ok: true,
        addresses: ["93.184.216.34"]
      }
    );
  });

  it("denies private IP literals without DNS", async () => {
    const result = await assertHostnameResolvesPublic("169.254.169.254");
    expect(result.ok).toBe(false);
  });

  it("denies hostnames that resolve to private addresses", async () => {
    const lookup = (async () => [
      { address: "10.1.2.3", family: 4 }
    ]) as unknown as typeof import("node:dns/promises").lookup;

    const result = await assertHostnameResolvesPublic("evil.example.com", lookup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rationale).toMatch(/10\.1\.2\.3/);
    }
  });

  it("allows hostnames that resolve only to public addresses", async () => {
    const lookup = (async () => [
      { address: "1.1.1.1", family: 4 },
      { address: "8.8.8.8", family: 4 }
    ]) as unknown as typeof import("node:dns/promises").lookup;

    await expect(
      assertHostnameResolvesPublic("api.example.com", lookup)
    ).resolves.toEqual({
      ok: true,
      addresses: ["1.1.1.1", "8.8.8.8"]
    });
  });

  it("maps resolve failures into external-validation denials", async () => {
    const lookup = (async () => [
      { address: "192.168.0.5", family: 4 }
    ]) as unknown as typeof import("node:dns/promises").lookup;

    const denied = await evaluateExternalValidationResolvedTarget(
      "rebind.example.com",
      lookup
    );
    expect(denied.allowed).toBe(false);
    expect(denied.denialCode).toBe("PrivateOrReservedTarget");
  });
});
