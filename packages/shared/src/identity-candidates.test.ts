import { describe, expect, it } from "vitest";

import { DANGER_CATALOG, isDangerCatalogModule } from "./danger-section";
import {
  IDENTITY_ABUSE_MODULE_IDS,
  IDENTITY_ABUSE_PROMOTE_TO_SCOPE_REQUIRED_CODE,
  IDENTITY_CANDIDATE_HONESTY_NOTE,
  countIdentityCandidates,
  evaluateIdentityAbuseStart,
  mapEntraIdentityInventory,
  mapIdentityInventoryToCandidates,
  mapJumpCloudIdentityInventory,
  mapOktaIdentityInventory,
  promoteIdentityCandidate
} from "./identity-candidates";
import {
  IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE,
  IDENTITY_CRED_SPRAY_MODULE_ID,
  evaluateIdentityCredSprayStart
} from "./identity-cred-spray";

const OKTA_USERS = [
  {
    id: "00u-admin",
    profile: {
      displayName: "Periscan Admin",
      email: "admin@example.com",
      login: "admin@example.com"
    },
    status: "ACTIVE"
  },
  {
    id: "00u-service",
    profile: {
      displayName: "Deployment Bot",
      login: "deploy-bot@example.com"
    },
    status: "ACTIVE"
  }
];

const OKTA_GROUPS = [
  {
    id: "00g-admins",
    profile: { name: "Okta Administrators" },
    type: "OKTA_GROUP"
  },
  {
    id: "00g-engineering",
    profile: { name: "Engineering" },
    type: "OKTA_GROUP"
  }
];

const OKTA_APPS = [
  {
    id: "0oa-prod",
    label: "Production Console",
    name: "prod-console",
    status: "ACTIVE"
  }
];

const ENTRA_USERS = [
  {
    displayName: "Security Administrator",
    id: "entra-user-admin",
    userPrincipalName: "security-admin@example.com"
  },
  {
    displayName: "Deployment Service Principal Owner",
    id: "entra-user-deploy",
    userPrincipalName: "deploy@example.com"
  }
];

const ENTRA_GROUPS = [
  { displayName: "Global Administrators", id: "entra-group-admins" },
  { displayName: "Production Engineering", id: "entra-group-engineering" }
];

const ENTRA_APPS = [
  { appId: "00000000-0000-4000-8000-000000000001", displayName: "Production Operations App", id: "entra-app-prod" }
];

const JUMPCLOUD_USERS = [
  { displayName: "Security Admin", id: "jc-user-admin", username: "security-admin" },
  { _id: "jc-user-build-bot", displayName: "Build Bot", username: "build-bot" }
];

const JUMPCLOUD_GROUPS = [
  { id: "jc-group-admins", name: "JumpCloud Administrators" },
  { id: "jc-group-engineering", name: "Engineering" }
];

const JUMPCLOUD_APPS = [
  { _id: "jc-app-aws", name: "AWS Console" },
  { id: "jc-app-prod", name: "Production Console" }
];

describe("IdP identity inventory as CAASM candidates", () => {
  it("maps Okta/Entra/JumpCloud users, groups, and apps to IdentityCandidate records", () => {
    const okta = mapOktaIdentityInventory({
      apps: OKTA_APPS,
      groups: OKTA_GROUPS,
      users: OKTA_USERS
    });
    const entra = mapEntraIdentityInventory({
      applications: ENTRA_APPS,
      groups: ENTRA_GROUPS,
      users: ENTRA_USERS
    });
    const jumpcloud = mapJumpCloudIdentityInventory({
      applications: JUMPCLOUD_APPS,
      groups: JUMPCLOUD_GROUPS,
      users: JUMPCLOUD_USERS
    });

    expect(countIdentityCandidates(okta.candidates)).toEqual({
      apps: 1,
      groups: 2,
      users: 2
    });
    expect(countIdentityCandidates(entra.candidates)).toEqual({
      apps: 1,
      groups: 2,
      users: 2
    });
    expect(countIdentityCandidates(jumpcloud.candidates)).toEqual({
      apps: 2,
      groups: 2,
      users: 2
    });

    expect(okta.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          autoAddedToScope: false,
          displayName: "Periscan Admin",
          externalId: "00u-admin",
          inVerifiedScope: false,
          kind: "user",
          liveSpray: false,
          promotion: "promote-to-scope",
          source: "okta"
        }),
        expect.objectContaining({
          externalId: "00g-admins",
          kind: "group",
          source: "okta"
        }),
        expect.objectContaining({
          displayName: "Production Console",
          externalId: "0oa-prod",
          kind: "app",
          source: "okta"
        })
      ])
    );
    expect(entra.candidates.every((row) => row.source === "microsoft-entra-id")).toBe(
      true
    );
    expect(jumpcloud.candidates.map((row) => row.externalId)).toEqual(
      expect.arrayContaining([
        "jc-user-admin",
        "jc-user-build-bot",
        "jc-group-admins",
        "jc-app-aws"
      ])
    );
    expect(okta.autoAddedToScope).toBe(false);
    expect(okta.liveSpray).toBe(false);
    expect(IDENTITY_CANDIDATE_HONESTY_NOTE).toMatch(/promote-to-scope/i);
    expect(IDENTITY_CANDIDATE_HONESTY_NOTE).not.toMatch(/auto-scope|live spray/i);
  });

  it("drops rows without an external id and never auto-scopes", () => {
    const mapped = mapIdentityInventoryToCandidates({
      apps: [{ label: "no-id-app" }, { id: "  " }],
      groups: [{ name: "no-id-group" }],
      source: "okta",
      users: [{ profile: { login: "nobody" } }, { id: "00u-keep", profile: { login: "keep" } }]
    });

    expect(mapped.candidates).toHaveLength(1);
    expect(mapped.candidates[0]).toMatchObject({
      autoAddedToScope: false,
      externalId: "00u-keep",
      kind: "user",
      liveSpray: false,
      promotion: "promote-to-scope"
    });
    expect(mapped.counts).toEqual({ apps: 0, groups: 0, users: 1 });
  });

  it("requires promote-to-scope before identity abuse modules", () => {
    const { candidates } = mapOktaIdentityInventory({
      apps: OKTA_APPS,
      groups: OKTA_GROUPS,
      users: OKTA_USERS
    });

    expect([...IDENTITY_ABUSE_MODULE_IDS].sort()).toEqual([
      "identity.cred_spray",
      "identity.credential_harvest",
      "identity.kerberos_userenum"
    ]);

    for (const moduleId of IDENTITY_ABUSE_MODULE_IDS) {
      const denied = evaluateIdentityAbuseStart({
        candidates,
        moduleId
      });
      expect(denied).toMatchObject({
        allowed: false,
        autoAddedToScope: false,
        code: IDENTITY_ABUSE_PROMOTE_TO_SCOPE_REQUIRED_CODE,
        jobsQueued: 0,
        liveSpray: false,
        startable: false
      });
    }

    const promoted = evaluateIdentityAbuseStart({
      candidates,
      moduleId: IDENTITY_CRED_SPRAY_MODULE_ID,
      promotedExternalIds: ["00u-admin"],
      sprayMode: "owned_account"
    });
    expect(promoted.allowed).toBe(true);
    expect(promoted.startable).toBe(true);
    expect(promoted.jobsQueued).toBe(0);
    expect(promoted.liveSpray).toBe(false);
    expect(promoted.autoAddedToScope).toBe(false);

    const promotion = promoteIdentityCandidate(candidates[0]!);
    expect(promotion).toMatchObject({
      autoAddedToScope: false,
      liveSpray: false,
      readyForVerification: true,
      requiresOperator: false,
      scopeExpanded: false,
      verificationStatus: "Pending"
    });
    expect(promoteIdentityCandidate(candidates[0]!, { operatorPromoted: false }).requiresOperator).toBe(
      true
    );
  });

  it("keeps unscoped spray High-danger even after IdP inventory sync", () => {
    expect(isDangerCatalogModule("identity.cred_spray")).toBe(true);
    expect(
      DANGER_CATALOG.some(
        (entry) =>
          entry.moduleId === "identity.cred_spray" &&
          entry.dangerClass === "unscoped_spray" &&
          entry.section === "High danger"
      )
    ).toBe(true);

    const { candidates } = mapOktaIdentityInventory({
      apps: OKTA_APPS,
      groups: OKTA_GROUPS,
      users: OKTA_USERS
    });

    const unscoped = evaluateIdentityAbuseStart({
      candidates,
      moduleId: IDENTITY_CRED_SPRAY_MODULE_ID,
      promotedExternalIds: ["00u-admin"],
      sprayMode: "internet",
      unscoped: true
    });
    expect(unscoped).toMatchObject({
      allowed: false,
      code: IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE,
      jobsQueued: 0,
      liveSpray: false,
      measurementClass: "Danger",
      startable: false
    });

    const spray = evaluateIdentityCredSprayStart({
      approvalId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      authorizedOffensive: true,
      identityCandidates: candidates,
      ownedIdentities: [
        {
          inVerifiedScope: true,
          ownership: "tenant_owned",
          username: "lab-policy-test"
        }
      ],
      policyDecisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      promotedIdentityExternalIds: ["00u-admin"],
      purpose: "password_policy",
      rateLimitPerMinute: 4,
      scopeVerified: true,
      sprayMode: "internet",
      targetHost: "login.microsoftonline.com",
      unscoped: true
    });
    expect(spray).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      measurementClass: "Danger",
      startable: false,
      code: IDENTITY_CRED_SPRAY_INTERNET_FORBIDDEN_CODE
    });
  });

  it("blocks owned-account spray against unpromoted IdP candidates", () => {
    const { candidates } = mapEntraIdentityInventory({
      applications: ENTRA_APPS,
      groups: ENTRA_GROUPS,
      users: ENTRA_USERS
    });

    const blocked = evaluateIdentityCredSprayStart({
      approvalId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      authorizedOffensive: true,
      identityCandidates: candidates,
      ownedIdentities: [
        {
          inVerifiedScope: true,
          ownership: "tenant_owned",
          username: "lab-policy-test"
        }
      ],
      policyDecisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      purpose: "password_policy",
      rateLimitPerMinute: 4,
      scopeVerified: true,
      sprayMode: "owned_account",
      targetHost: "dc01.corp.internal"
    });
    expect(blocked).toMatchObject({
      allowed: false,
      jobsQueued: 0,
      startable: false,
      code: IDENTITY_ABUSE_PROMOTE_TO_SCOPE_REQUIRED_CODE
    });

    const allowed = evaluateIdentityCredSprayStart({
      approvalId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      authorizedOffensive: true,
      identityCandidates: candidates,
      ownedIdentities: [
        {
          inVerifiedScope: true,
          ownership: "tenant_owned",
          username: "lab-policy-test"
        }
      ],
      policyDecisionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      promotedIdentityExternalIds: ["entra-user-admin"],
      purpose: "password_policy",
      rateLimitPerMinute: 4,
      scopeVerified: true,
      sprayMode: "owned_account",
      targetHost: "dc01.corp.internal"
    });
    expect(allowed.startable).toBe(true);
    expect(allowed.jobsQueued).toBe(1);
    expect(allowed.persistCredentials).toBe(false);
  });
});
