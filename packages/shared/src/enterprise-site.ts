/**
 * Fortune 1000 enterprise sites: named sites with CIDR blocks, AD domains,
 * and bound inside runners. Internal assessment / discover only against
 * CIDRs that sit on a verified IPRange/InternalNetwork scope AND match a
 * site. Empty catalog is honest empty — never invent HQ/DC/branch maps.
 *
 * Runner transport copy: outbound HTTPS poll, not inbound VPN.
 * HTTP: GET/POST /api/v1/enterprise-sites, PATCH /api/v1/enterprise-sites/:siteId.
 */

import { z } from "zod";

import { unpaginatedListSchema } from "./api-contract";

const IdSchema = z.uuid();
const TimestampSchema = z.iso.datetime();

export const ENTERPRISE_SITE_RUNNER_TRANSPORT_COPY =
  "Inside runners poll the control plane over outbound HTTPS. Periscan does not require an inbound VPN.";

export const ENTERPRISE_SITE_EMPTY_CATALOG_COPY =
  "No sites configured. Periscan will not invent a headquarters or branch map.";

const AD_DOMAIN_RE =
  /^(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/u;

export const EnterpriseSiteCidrSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => parseIpv4Cidr(value) !== null, {
    message: "Must be an IPv4 CIDR (for example 10.0.0.0/24)."
  });

export const EnterpriseSiteAdDomainSchema = z
  .string()
  .trim()
  .min(1)
  .max(253)
  .regex(AD_DOMAIN_RE, "Must be a DNS or AD domain name.");

export const EnterpriseSiteSchema = z.object({
  adDomains: z.array(EnterpriseSiteAdDomainSchema),
  cidrs: z.array(EnterpriseSiteCidrSchema),
  name: z.string().trim().min(1).max(128),
  runnerIds: z.array(IdSchema),
  siteId: IdSchema
});

export type EnterpriseSite = z.infer<typeof EnterpriseSiteSchema>;

export const CreateEnterpriseSiteInputSchema = z.object({
  adDomains: z.array(EnterpriseSiteAdDomainSchema).default([]),
  cidrs: z.array(EnterpriseSiteCidrSchema).default([]),
  name: z.string().trim().min(1).max(128),
  runnerIds: z.array(IdSchema).default([])
});

export type CreateEnterpriseSiteInput = z.infer<
  typeof CreateEnterpriseSiteInputSchema
>;

export const UpdateEnterpriseSiteInputSchema = z
  .object({
    adDomains: z.array(EnterpriseSiteAdDomainSchema).optional(),
    cidrs: z.array(EnterpriseSiteCidrSchema).optional(),
    name: z.string().trim().min(1).max(128).optional(),
    runnerIds: z.array(IdSchema).optional()
  })
  .refine(
    (value) =>
      value.adDomains !== undefined ||
      value.cidrs !== undefined ||
      value.name !== undefined ||
      value.runnerIds !== undefined,
    {
      message:
        "At least one of name, cidrs, adDomains, or runnerIds is required."
    }
  );

export type UpdateEnterpriseSiteInput = z.infer<
  typeof UpdateEnterpriseSiteInputSchema
>;

export const EnterpriseSiteCatalogSchema = z.object({
  generatedAt: TimestampSchema,
  sites: z.array(EnterpriseSiteSchema)
});

export type EnterpriseSiteCatalog = z.infer<typeof EnterpriseSiteCatalogSchema>;

export const EnterpriseSiteListEnvelopeSchema =
  unpaginatedListSchema(EnterpriseSiteSchema);
export type EnterpriseSiteListEnvelope = z.infer<
  typeof EnterpriseSiteListEnvelopeSchema
>;

export const EnterpriseSiteInternalKindSchema = z.enum([
  "internal_assessment",
  "discover"
]);
export type EnterpriseSiteInternalKind = z.infer<
  typeof EnterpriseSiteInternalKindSchema
>;

export const EnterpriseSiteDenialCodeSchema = z.enum([
  "empty_site_catalog",
  "unverified_scope",
  "cidr_not_on_verified_scope",
  "cidr_not_matching_site",
  "target_not_ip_or_cidr"
]);
export type EnterpriseSiteDenialCode = z.infer<
  typeof EnterpriseSiteDenialCodeSchema
>;

export type VerifiedScopeSnapshot = {
  scopeType: string;
  value: string;
  verificationStatus: string;
};

export type EnterpriseSiteInternalTargetDecision = {
  allowed: boolean;
  code: EnterpriseSiteDenialCode | null;
  jobsQueued: 0;
  matchingScopeValue: string | null;
  matchingSiteId: string | null;
  rationale: string;
};

export function emptyEnterpriseSiteCatalog(
  generatedAt: string
): EnterpriseSiteCatalog {
  return EnterpriseSiteCatalogSchema.parse({
    generatedAt,
    sites: []
  });
}

export function honestEmptyEnterpriseSiteList(): EnterpriseSiteListEnvelope {
  return { items: [] };
}

export function listEnterpriseSites(
  catalog: EnterpriseSiteCatalog | null | undefined
): EnterpriseSite[] {
  if (!catalog) return [];
  return catalog.sites;
}

export function bindRunnerToEnterpriseSite(
  site: EnterpriseSite,
  runnerId: string
): EnterpriseSite {
  const id = IdSchema.parse(runnerId);
  if (site.runnerIds.includes(id)) return site;
  return { ...site, runnerIds: [...site.runnerIds, id] };
}

export function unbindRunnerFromEnterpriseSite(
  site: EnterpriseSite,
  runnerId: string
): EnterpriseSite {
  const id = IdSchema.parse(runnerId);
  return {
    ...site,
    runnerIds: site.runnerIds.filter((item) => item !== id)
  };
}

export function siteForRunner(
  sites: readonly EnterpriseSite[],
  runnerId: string
): EnterpriseSite | null {
  return sites.find((site) => site.runnerIds.includes(runnerId)) ?? null;
}

const CIDR_SCOPE_TYPES = new Set(["IPRange", "InternalNetwork"]);

export function evaluateEnterpriseSiteDiscoverGate(input: {
  sites: readonly EnterpriseSite[];
  target: string;
  verifiedScopes: readonly VerifiedScopeSnapshot[];
}): EnterpriseSiteInternalTargetDecision | null {
  if (!parseIpv4HostOrCidr(input.target)) {
    return null;
  }
  return evaluateEnterpriseSiteInternalTarget({
    kind: "discover",
    sites: input.sites,
    target: input.target,
    verifiedScopes: input.verifiedScopes
  });
}

export function evaluateEnterpriseSiteInternalTarget(input: {
  kind: EnterpriseSiteInternalKind;
  sites: readonly EnterpriseSite[];
  target: string;
  verifiedScopes: readonly VerifiedScopeSnapshot[];
}): EnterpriseSiteInternalTargetDecision {
  void input.kind;
  const target = parseIpv4HostOrCidr(input.target);
  if (!target) {
    return deny(
      "target_not_ip_or_cidr",
      "Internal assessment and discover require an IP or CIDR target, not a hostname."
    );
  }

  if (input.sites.length === 0) {
    return deny("empty_site_catalog", ENTERPRISE_SITE_EMPTY_CATALOG_COPY);
  }

  const coveringScopes = input.verifiedScopes.filter((scope) => {
    if (!CIDR_SCOPE_TYPES.has(scope.scopeType)) return false;
    const cidr = parseIpv4Cidr(scope.value);
    return cidr !== null && cidrContains(cidr, target);
  });
  const verifiedCovering = coveringScopes.filter(
    (scope) => scope.verificationStatus === "Verified"
  );

  if (verifiedCovering.length === 0) {
    if (coveringScopes.length > 0) {
      return deny(
        "unverified_scope",
        "Internal assessment and discover run only against verified CIDR or internal-network scope."
      );
    }
    return deny(
      "cidr_not_on_verified_scope",
      "Target is not contained in a verified IPRange or InternalNetwork CIDR."
    );
  }

  const siteMatch = bestSiteMatch(input.sites, target);
  if (!siteMatch) {
    return deny(
      "cidr_not_matching_site",
      "Target is on verified scope but does not match a configured site CIDR."
    );
  }

  const matchingScope = mostSpecificScope(verifiedCovering, target);
  return {
    allowed: true,
    code: null,
    jobsQueued: 0,
    matchingScopeValue: matchingScope?.value ?? null,
    matchingSiteId: siteMatch.site.siteId,
    rationale: `Target is contained in verified scope ${matchingScope?.value ?? "cidr"} and site ${siteMatch.site.name}.`
  };
}

function deny(
  code: EnterpriseSiteDenialCode,
  rationale: string
): EnterpriseSiteInternalTargetDecision {
  return {
    allowed: false,
    code,
    jobsQueued: 0,
    matchingScopeValue: null,
    matchingSiteId: null,
    rationale
  };
}

function bestSiteMatch(
  sites: readonly EnterpriseSite[],
  target: Ipv4Cidr
): { prefix: number; site: EnterpriseSite } | null {
  let best: { prefix: number; site: EnterpriseSite } | null = null;
  for (const site of sites) {
    for (const raw of site.cidrs) {
      const cidr = parseIpv4Cidr(raw);
      if (!cidr || !cidrContains(cidr, target)) continue;
      if (!best || cidr.prefix > best.prefix) {
        best = { prefix: cidr.prefix, site };
      }
    }
  }
  return best;
}

function mostSpecificScope(
  scopes: readonly VerifiedScopeSnapshot[],
  target: Ipv4Cidr
): VerifiedScopeSnapshot | null {
  let best: { prefix: number; scope: VerifiedScopeSnapshot } | null = null;
  for (const scope of scopes) {
    const cidr = parseIpv4Cidr(scope.value);
    if (!cidr || !cidrContains(cidr, target)) continue;
    if (!best || cidr.prefix > best.prefix) {
      best = { prefix: cidr.prefix, scope };
    }
  }
  return best?.scope ?? null;
}

type Ipv4Cidr = { network: number; prefix: number };

function parseIpv4HostOrCidr(value: string): Ipv4Cidr | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/")) return parseIpv4Cidr(trimmed);
  return parseIpv4Cidr(`${trimmed}/32`);
}

function parseIpv4Cidr(value: string): Ipv4Cidr | null {
  const [addrPart, prefixPart] = value.trim().split("/");
  if (!addrPart || prefixPart === undefined || prefixPart === "") return null;
  const octets = addrPart.split(".").map((octet) => Number(octet));
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }
  const prefix = Number(prefixPart);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return null;
  const network =
    ((octets[0]! << 24) | (octets[1]! << 16) | (octets[2]! << 8) | octets[3]!) >>>
    0;
  return { network, prefix };
}

function cidrContains(parent: Ipv4Cidr, child: Ipv4Cidr): boolean {
  if (child.prefix < parent.prefix) return false;
  const mask = parent.prefix === 0 ? 0 : (~0 << (32 - parent.prefix)) >>> 0;
  return (parent.network & mask) === (child.network & mask);
}
