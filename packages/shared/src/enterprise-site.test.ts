import { describe, expect, it } from "vitest";

import {
  CreateEnterpriseSiteInputSchema,
  ENTERPRISE_SITE_RUNNER_TRANSPORT_COPY,
  EnterpriseSiteCatalogSchema,
  EnterpriseSiteListEnvelopeSchema,
  EnterpriseSiteSchema,
  UpdateEnterpriseSiteInputSchema,
  bindRunnerToEnterpriseSite,
  emptyEnterpriseSiteCatalog,
  evaluateEnterpriseSiteDiscoverGate,
  evaluateEnterpriseSiteInternalTarget,
  honestEmptyEnterpriseSiteList,
  listEnterpriseSites,
  siteForRunner,
  unbindRunnerFromEnterpriseSite
} from "./enterprise-site.js";

const SITE_ID = "11111111-1111-4111-8111-111111111111";
const SITE_B_ID = "33333333-3333-4333-8333-333333333333";
const RUNNER_ID = "22222222-2222-4222-8222-222222222222";
const RUNNER_B_ID = "44444444-4444-4444-8444-444444444444";
const GENERATED_AT = "2026-09-17T12:00:00.000Z";

function chicagoDc(overrides?: Record<string, unknown>) {
  return EnterpriseSiteSchema.parse({
    siteId: SITE_ID,
    name: "Chicago DC",
    cidrs: ["10.8.0.0/16", "10.9.0.0/24"],
    adDomains: ["corp.contoso.local", "ad.example.com"],
    runnerIds: [RUNNER_ID],
    ...overrides
  });
}

function verifiedIpRange(value = "10.8.0.0/16") {
  return {
    scopeType: "IPRange" as const,
    value,
    verificationStatus: "Verified" as const
  };
}

describe("enterprise site catalog", () => {
  it("parses a Fortune-1000 site with name, CIDRs, AD domains, and bound runners", () => {
    const site = chicagoDc();

    expect(site).toEqual({
      siteId: SITE_ID,
      name: "Chicago DC",
      cidrs: ["10.8.0.0/16", "10.9.0.0/24"],
      adDomains: ["corp.contoso.local", "ad.example.com"],
      runnerIds: [RUNNER_ID]
    });
  });

  it("rejects invalid CIDR blocks and AD domain names", () => {
    expect(
      EnterpriseSiteSchema.safeParse({
        siteId: SITE_ID,
        name: "Bad CIDR",
        cidrs: ["10.8.0.0"],
        adDomains: ["corp.contoso.local"],
        runnerIds: []
      }).success
    ).toBe(false);

    expect(
      EnterpriseSiteSchema.safeParse({
        siteId: SITE_ID,
        name: "Hostname as CIDR",
        cidrs: ["app.internal"],
        adDomains: ["corp.contoso.local"],
        runnerIds: []
      }).success
    ).toBe(false);

    expect(
      EnterpriseSiteSchema.safeParse({
        siteId: SITE_ID,
        name: "Bad AD",
        cidrs: ["10.8.0.0/16"],
        adDomains: ["ldap://corp.contoso.local"],
        runnerIds: []
      }).success
    ).toBe(false);
  });

  it("returns an honest empty catalog instead of inventing a headquarters map", () => {
    const catalog = emptyEnterpriseSiteCatalog(GENERATED_AT);
    const parsed = EnterpriseSiteCatalogSchema.parse(catalog);

    expect(parsed.sites).toEqual([]);
    expect(listEnterpriseSites(parsed)).toEqual([]);
    expect(listEnterpriseSites(null)).toEqual([]);
    expect(honestEmptyEnterpriseSiteList()).toEqual({ items: [] });
    expect(EnterpriseSiteListEnvelopeSchema.parse({ items: [] }).items).toEqual(
      []
    );
    expect(JSON.stringify(parsed)).not.toMatch(/Headquarters|US-East|Default site/i);
  });
});

describe("enterprise site internal assessment / discover gate", () => {
  it("allows an internal assessment IP on a verified CIDR that also matches a site", () => {
    const decision = evaluateEnterpriseSiteInternalTarget({
      kind: "internal_assessment",
      target: "10.8.1.5",
      verifiedScopes: [verifiedIpRange()],
      sites: [chicagoDc()]
    });

    expect(decision.allowed).toBe(true);
    expect(decision.code).toBeNull();
    expect(decision.matchingSiteId).toBe(SITE_ID);
    expect(decision.matchingScopeValue).toBe("10.8.0.0/16");
    expect(decision.jobsQueued).toBe(0);
  });

  it("allows discover of a CIDR contained by both verified scope and a site", () => {
    const decision = evaluateEnterpriseSiteInternalTarget({
      kind: "discover",
      target: "10.8.1.0/24",
      verifiedScopes: [verifiedIpRange("10.8.0.0/16")],
      sites: [chicagoDc()]
    });

    expect(decision.allowed).toBe(true);
    expect(decision.matchingSiteId).toBe(SITE_ID);
  });

  it("denies when the catalog is empty instead of inventing a site map", () => {
    const decision = evaluateEnterpriseSiteInternalTarget({
      kind: "discover",
      target: "10.8.1.5",
      verifiedScopes: [verifiedIpRange()],
      sites: []
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("empty_site_catalog");
    expect(decision.matchingSiteId).toBeNull();
    expect(decision.jobsQueued).toBe(0);
    expect(decision.rationale).toMatch(/not invent/i);
  });

  it("denies a CIDR that is verified but not on any site", () => {
    const decision = evaluateEnterpriseSiteInternalTarget({
      kind: "internal_assessment",
      target: "172.16.4.10",
      verifiedScopes: [
        {
          scopeType: "InternalNetwork",
          value: "172.16.0.0/12",
          verificationStatus: "Verified"
        }
      ],
      sites: [chicagoDc()]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("cidr_not_matching_site");
    expect(decision.matchingSiteId).toBeNull();
  });

  it("denies a site-matching CIDR that is not on a verified scope", () => {
    const decision = evaluateEnterpriseSiteInternalTarget({
      kind: "discover",
      target: "10.8.1.5",
      verifiedScopes: [
        {
          scopeType: "IPRange",
          value: "10.8.0.0/16",
          verificationStatus: "Pending"
        }
      ],
      sites: [chicagoDc()]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("unverified_scope");
  });

  it("does not treat a verified Domain as authorization for an internal CIDR", () => {
    const decision = evaluateEnterpriseSiteInternalTarget({
      kind: "internal_assessment",
      target: "10.8.1.5",
      verifiedScopes: [
        {
          scopeType: "Domain",
          value: "example.com",
          verificationStatus: "Verified"
        }
      ],
      sites: [chicagoDc()]
    });

    expect(decision.allowed).toBe(false);
    expect(decision.code).toBe("cidr_not_on_verified_scope");
  });

  it("rejects hostname-only and CIDR-sweep targets the way port-present is IP/CIDR-contained", () => {
    expect(
      evaluateEnterpriseSiteInternalTarget({
        kind: "internal_assessment",
        target: "app.internal",
        verifiedScopes: [verifiedIpRange()],
        sites: [chicagoDc()]
      }).code
    ).toBe("target_not_ip_or_cidr");

    const sweep = evaluateEnterpriseSiteInternalTarget({
      kind: "discover",
      target: "10.0.0.0/8",
      verifiedScopes: [verifiedIpRange("10.8.0.0/16")],
      sites: [chicagoDc()]
    });
    expect(sweep.allowed).toBe(false);
    expect(sweep.code).toBe("cidr_not_on_verified_scope");
  });

  it("prefers the most specific matching site when two CIDRs overlap", () => {
    const campus = chicagoDc({
      siteId: SITE_B_ID,
      name: "Chicago campus VLAN",
      cidrs: ["10.8.1.0/24"],
      runnerIds: [RUNNER_B_ID]
    });
    const decision = evaluateEnterpriseSiteInternalTarget({
      kind: "internal_assessment",
      target: "10.8.1.9",
      verifiedScopes: [verifiedIpRange("10.8.0.0/16")],
      sites: [chicagoDc(), campus]
    });

    expect(decision.allowed).toBe(true);
    expect(decision.matchingSiteId).toBe(SITE_B_ID);
  });
});

describe("enterprise site runner bind and transport copy", () => {
  it("binds and unbinds runner ids on a site without inventing a second site", () => {
    const bound = bindRunnerToEnterpriseSite(chicagoDc({ runnerIds: [] }), RUNNER_ID);
    expect(bound.runnerIds).toEqual([RUNNER_ID]);
    expect(bindRunnerToEnterpriseSite(bound, RUNNER_ID).runnerIds).toEqual([
      RUNNER_ID
    ]);

    const unbound = unbindRunnerFromEnterpriseSite(bound, RUNNER_ID);
    expect(unbound.runnerIds).toEqual([]);
    expect(siteForRunner([bound], RUNNER_ID)?.siteId).toBe(SITE_ID);
    expect(siteForRunner([], RUNNER_ID)).toBeNull();
  });

  it("describes outbound HTTPS runner poll, not inbound VPN", () => {
    expect(ENTERPRISE_SITE_RUNNER_TRANSPORT_COPY).toMatch(/outbound HTTPS/i);
    expect(ENTERPRISE_SITE_RUNNER_TRANSPORT_COPY).toMatch(
      /does not require an inbound VPN/i
    );
    expect(ENTERPRISE_SITE_RUNNER_TRANSPORT_COPY).not.toMatch(/open inbound/i);
    expect(ENTERPRISE_SITE_RUNNER_TRANSPORT_COPY).not.toMatch(/reverse SSH/i);
  });
});

describe("enterprise site create and patch input", () => {
  it("creates a site from name, CIDRs, AD domains, and runner ids without inventing HQ", () => {
    const parsed = CreateEnterpriseSiteInputSchema.parse({
      name: "Chicago DC",
      cidrs: ["10.8.0.0/16"],
      adDomains: ["corp.contoso.local"],
      runnerIds: [RUNNER_ID]
    });

    expect(parsed.name).toBe("Chicago DC");
    expect(parsed.cidrs).toEqual(["10.8.0.0/16"]);
    expect(JSON.stringify(parsed)).not.toMatch(/Headquarters|US-East/i);
  });

  it("patches cidrs, adDomains, and runnerIds without requiring a full replace", () => {
    const parsed = UpdateEnterpriseSiteInputSchema.parse({
      cidrs: ["10.8.1.0/24"],
      adDomains: ["ad.example.com"],
      runnerIds: [RUNNER_B_ID]
    });

    expect(parsed.cidrs).toEqual(["10.8.1.0/24"]);
    expect(parsed.adDomains).toEqual(["ad.example.com"]);
    expect(parsed.runnerIds).toEqual([RUNNER_B_ID]);
    expect(parsed.name).toBeUndefined();
    expect(UpdateEnterpriseSiteInputSchema.safeParse({}).success).toBe(false);
  });
});

describe("enterprise site discover gate helper", () => {
  it("skips hostname discover so DNS recon is not forced through the CIDR catalog", () => {
    expect(
      evaluateEnterpriseSiteDiscoverGate({
        target: "inventory.corp.example.internal",
        verifiedScopes: [verifiedIpRange()],
        sites: []
      })
    ).toBeNull();
  });

  it("denies CIDR discover against an empty catalog instead of inventing a site map", () => {
    const decision = evaluateEnterpriseSiteDiscoverGate({
      target: "10.8.1.5",
      verifiedScopes: [verifiedIpRange()],
      sites: []
    });

    expect(decision?.allowed).toBe(false);
    expect(decision?.code).toBe("empty_site_catalog");
    expect(decision?.jobsQueued).toBe(0);
  });

  it("allows CIDR discover only when verified scope AND a site CIDR both contain the target", () => {
    const allowed = evaluateEnterpriseSiteDiscoverGate({
      target: "10.8.1.0/24",
      verifiedScopes: [verifiedIpRange("10.8.0.0/16")],
      sites: [chicagoDc()]
    });
    expect(allowed?.allowed).toBe(true);
    expect(allowed?.matchingSiteId).toBe(SITE_ID);

    const offSite = evaluateEnterpriseSiteDiscoverGate({
      target: "172.16.4.10",
      verifiedScopes: [
        {
          scopeType: "InternalNetwork",
          value: "172.16.0.0/12",
          verificationStatus: "Verified"
        }
      ],
      sites: [chicagoDc()]
    });
    expect(offSite?.allowed).toBe(false);
    expect(offSite?.code).toBe("cidr_not_matching_site");
  });
});
