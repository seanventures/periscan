import { randomUUID } from "node:crypto";

import { afterEach, describe, expect, it } from "vitest";

import {
  IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE,
  IDENTITY_CRED_SPRAY_MODULE_ID,
  MAX_IDENTITY_CRED_SPRAY_RATE_PER_MINUTE,
  evaluateIdentityCredSprayStart,
  isInternetSprayHost
} from "./identity-cred-spray";

const POLICY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const APPROVAL_ID = randomUUID();

function ownedAccountTarget(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    approvalId: APPROVAL_ID,
    auditRequired: true,
    authorizedOffensive: true,
    persistCredentials: false,
    policyDecisionId: POLICY_ID,
    purpose: "password_policy",
    rateLimitPerMinute: 6,
    scopeVerified: true,
    sprayMode: "owned_account",
    targetHost: "dc01.corp.internal",
    ownedIdentities: [
      {
        inVerifiedScope: true,
        ownership: "tenant_owned",
        username: "lab-policy-test"
      }
    ],
    ...overrides
  };
}

describe("identity.cred_spray owned-account password-policy start", () => {
  afterEach(() => {
    delete process.env.PERISCAN_LIVE_OFFENSIVE;
  });

  it("is startable only as an owned-account password-policy test", () => {
    const decision = evaluateIdentityCredSprayStart(ownedAccountTarget());
    expect(IDENTITY_CRED_SPRAY_MODULE_ID).toBe("identity.cred_spray");
    expect(decision.startable).toBe(true);
    expect(decision.allowed).toBe(true);
    expect(decision.jobsQueued).toBe(1);
    expect(decision.persistCredentials).toBe(false);
    expect(decision.auditRequired).toBe(true);
    expect(decision.measurementClass).toBe("Config");
    expect(decision.code).toBe(
      "identity_cred_spray_owned_account_password_policy"
    );
  });

  it("denies unverified scope, missing owned identities, and unscoped targets with jobsQueued=0", () => {
    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({ scopeVerified: false })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: "identity_cred_spray_requires_verified_scope"
    });

    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({ ownedIdentities: [] })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: "identity_cred_spray_owned_identities_required"
    });

    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({
          ownedIdentities: [
            {
              inVerifiedScope: false,
              ownership: "tenant_owned",
              username: "lab-policy-test"
            }
          ]
        })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: "identity_cred_spray_owned_identities_required"
    });

    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({ unscoped: true })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE
    });
  });

  it("places internet spray in High danger; env flag does not enable it", () => {
    process.env.PERISCAN_LIVE_OFFENSIVE = "1";
    expect(isInternetSprayHost("login.microsoftonline.com")).toBe(true);
    expect(isInternetSprayHost("8.8.8.8")).toBe(true);
    expect(isInternetSprayHost("dc01.corp.internal")).toBe(false);
    expect(isInternetSprayHost("10.0.0.5")).toBe(false);

    const internet = evaluateIdentityCredSprayStart(
      ownedAccountTarget({
        dryRun: false,
        sowId: "test-sow",
        sprayMode: "internet",
        targetHost: "login.microsoftonline.com"
      })
    );
    expect(internet).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE,
      measurementClass: "Danger"
    });
    expect(internet.rationale.toLowerCase()).toMatch(/internet/);

    const publicHost = evaluateIdentityCredSprayStart(
      ownedAccountTarget({ targetHost: "8.8.8.8" })
    );
    expect(publicHost.startable).toBe(false);
    expect(publicHost.jobsQueued).toBe(0);
    expect(publicHost.code).toBe(IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE);
  });

  it("forbids credential theft persistence, unbounded rate, and missing audit", () => {
    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({ persistCredentials: true })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      persistCredentials: false,
      code: "identity_cred_spray_credential_persistence_forbidden"
    });

    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({ credentialTheft: true })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: "identity_cred_spray_credential_persistence_forbidden"
    });

    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({ rateLimitPerMinute: 0 })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: "identity_cred_spray_rate_limit_required"
    });

    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({
          rateLimitPerMinute: MAX_IDENTITY_CRED_SPRAY_RATE_PER_MINUTE + 1
        })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: "identity_cred_spray_rate_limit_required"
    });

    expect(
      evaluateIdentityCredSprayStart(
        ownedAccountTarget({ policyDecisionId: undefined })
      )
    ).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      auditRequired: true,
      code: "identity_cred_spray_audit_required"
    });
  });

  it("does not treat authorization-only targets as startable directory spray", () => {
    const authorizedOnly = evaluateIdentityCredSprayStart({
      approvalId: APPROVAL_ID,
      authorizedOffensive: true,
      scopeVerified: true,
      targetHost: "dc01.corp.internal"
    });
    expect(authorizedOnly.startable).toBe(false);
    expect(authorizedOnly.jobsQueued).toBe(0);
    expect(authorizedOnly.allowed).toBe(false);
  });
});
