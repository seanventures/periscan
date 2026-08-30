import { ipv4InCidr, parentDomainSuffixes } from "@periscan/shared";
import type { PrismaClient } from "@prisma/client";

/**
 * Correlate FRESH global catalog items to each tenant's attack surface and
 * raise per-tenant alerts. Two MEASURED match families (no heuristic over-claim):
 *
 *  - IOC -> verified scope: a domain/URL-host/IP that just appeared on a
 *    malware/phishing/Tor feed AND is covered by one of the tenant's Verified
 *    scopes — the exact host, a verified PARENT domain (login.acme.com vs a
 *    verified acme.com), or an IP inside a verified IPRange CIDR.
 *  - CVE -> already-tracked: a CVE that just hit NVD/KEV AND the tenant already
 *    tracks it via a ThreatAdvisory. ("A vuln you care about just escalated.")
 *
 * Alerts are deduped one-per (tenant, item) by the DB unique constraint, so
 * re-correlation never duplicates.
 */

export interface CorrelateResult {
  alertsCreated: number;
}

interface AlertCandidate {
  tenantId: string;
  threatIntelItemId: string;
  matchType: "ioc" | "cve";
  matchedValue: string;
  matchedScopeId: string | null;
  severity: string | null;
}

function urlHost(value: string): string | null {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export async function correlateThreatItemsForTenants(
  prisma: PrismaClient,
  itemIds: ReadonlyArray<string>
): Promise<CorrelateResult> {
  if (itemIds.length === 0) {
    return { alertsCreated: 0 };
  }

  const items = await prisma.threatIntelItem.findMany({
    where: { threatIntelItemId: { in: [...itemIds] } },
    select: {
      threatIntelItemId: true,
      kind: true,
      iocType: true,
      iocValue: true,
      cveIds: true,
      severity: true
    }
  });

  const candidates: AlertCandidate[] = [];

  // The verified IPRange scopes are fetched once and CIDR-matched in memory
  // (containment can't be expressed as a SQL equality). Lazily loaded only if a
  // fresh IP indicator actually shows up in this batch.
  let verifiedIpRanges: Array<{
    scopeId: string;
    tenantId: string;
    value: string;
  }> | null = null;
  const loadIpRanges = async () => {
    if (verifiedIpRanges === null) {
      verifiedIpRanges = await prisma.scope.findMany({
        where: { verificationStatus: "Verified", scopeType: "IPRange" },
        select: { scopeId: true, tenantId: true, value: true }
      });
    }
    return verifiedIpRanges;
  };

  for (const item of items) {
    if (item.iocValue && item.iocType) {
      const host =
        item.iocType === "url" ? urlHost(item.iocValue) : item.iocValue;

      // --- domain/URL IOC -> verified Domain/Subdomain scope ---------------
      // Matches the exact host AND any verified PARENT domain (a fresh
      // login.acme.com alerts the owner of verified scope acme.com).
      if (host && item.iocType !== "ipv4" && item.iocType !== "ipv6") {
        const suffixes = parentDomainSuffixes(host);
        if (suffixes.length > 0) {
          const scopes = await prisma.scope.findMany({
            where: {
              verificationStatus: "Verified",
              scopeType: { in: ["Domain", "Subdomain"] as never },
              value: { in: suffixes }
            },
            select: { scopeId: true, tenantId: true }
          });
          for (const scope of scopes) {
            candidates.push({
              tenantId: scope.tenantId,
              threatIntelItemId: item.threatIntelItemId,
              matchType: "ioc",
              matchedValue: item.iocValue,
              matchedScopeId: scope.scopeId,
              severity: item.severity
            });
          }
        }
      }

      // --- IPv4 IOC -> verified IPRange scope (exact value OR CIDR member) --
      if (host && item.iocType === "ipv4") {
        for (const scope of await loadIpRanges()) {
          const inScope =
            scope.value === host ||
            (scope.value.includes("/") && ipv4InCidr(host, scope.value));
          if (inScope) {
            candidates.push({
              tenantId: scope.tenantId,
              threatIntelItemId: item.threatIntelItemId,
              matchType: "ioc",
              matchedValue: item.iocValue,
              matchedScopeId: scope.scopeId,
              severity: item.severity
            });
          }
        }
      }
    }

    // --- CVE -> a CVE the tenant already tracks ---------------------------
    if (item.kind === "Vulnerability" && item.cveIds.length > 0) {
      const advisories = await prisma.threatAdvisory.findMany({
        where: { cveIds: { hasSome: item.cveIds } },
        select: { tenantId: true },
        distinct: ["tenantId"]
      });
      const matchedCve = item.cveIds[0] ?? "";
      for (const advisory of advisories) {
        candidates.push({
          tenantId: advisory.tenantId,
          threatIntelItemId: item.threatIntelItemId,
          matchType: "cve",
          matchedValue: matchedCve,
          matchedScopeId: null,
          severity: item.severity
        });
      }
    }
  }

  if (candidates.length === 0) {
    return { alertsCreated: 0 };
  }

  // One alert per (tenant, item): collapse multiple scope matches, prefer an
  // IOC/scope match's scopeId when present.
  const byKey = new Map<string, AlertCandidate>();
  for (const candidate of candidates) {
    const key = `${candidate.tenantId}:${candidate.threatIntelItemId}`;
    const existing = byKey.get(key);
    if (!existing || (!existing.matchedScopeId && candidate.matchedScopeId)) {
      byKey.set(key, candidate);
    }
  }

  // createMany + skipDuplicates leans on the (tenant, item) unique index so an
  // item already alerted for a tenant is never duplicated on re-correlation.
  const created = await prisma.tenantThreatAlert.createMany({
    data: [...byKey.values()].map((candidate) => ({
      tenantId: candidate.tenantId,
      threatIntelItemId: candidate.threatIntelItemId,
      matchType: candidate.matchType,
      matchedValue: candidate.matchedValue,
      matchedScopeId: candidate.matchedScopeId,
      severity: candidate.severity
    })),
    skipDuplicates: true
  });

  return { alertsCreated: created.count };
}
