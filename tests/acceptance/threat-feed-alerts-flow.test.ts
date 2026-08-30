import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { correlateThreatItemsForTenants } from "../../apps/api/src/threat-feeds/correlate.js";
import { ingestThreatIntelItems } from "../../apps/api/src/services/threat-intel-catalog.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

/**
 * Proves the realtime per-tenant alert: when a FRESH global catalog item
 * correlates to a tenant's attack surface (a verified-scope domain that lands on
 * a phishing feed, or a CVE the tenant already tracks that hits NVD), a deduped
 * TenantThreatAlert is raised. A non-matching item raises nothing (no over-claim).
 */
describe("Super-feed per-tenant correlation alerts", () => {
  const prisma = createPrismaClient();
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const numericSuffix = Number.parseInt(suffix.slice(0, 8), 16);
  const domain = `victim-${suffix}.example`;
  const cveId = `CVE-2026-${BigInt(`0x${suffix}`).toString()}`;
  const phishUrl = `https://${domain}/login`;
  const iocKey = `ioc:domain:${domain}`;
  const cveKey = `cve:${cveId}`;
  const unrelatedKey = `ioc:domain:not-mine-${suffix}.example`;

  afterAll(async () => {
    await prisma.threatIntelItem.deleteMany({
      where: { canonicalKey: { in: [iocKey, cveKey, unrelatedKey] } }
    });
    await prisma.$disconnect();
  });

  it("alerts when a fresh IOC matches a verified scope and a fresh CVE is already tracked; dedups; ignores non-matches", async () => {
    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: `alerts-${suffix}@periscan.test`,
          name: "Alerts Owner",
          password: "periscan-alerts-password",
          tenantName: "Alerts Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const tenantId = signup.json().tenant.tenantId as string;

      // The tenant's VERIFIED attack surface includes `domain`.
      await prisma.scope.create({
        data: {
          tenantId,
          scopeType: "Domain",
          value: domain,
          verificationStatus: "Verified",
          verifiedAt: new Date()
        }
      });
      // The tenant already TRACKS this CVE via an advisory.
      await prisma.threatAdvisory.create({
        data: {
          tenantId,
          title: `Tracked ${cveId}`,
          sourceName: "manual",
          summary: "Tenant already tracks this CVE.",
          rawEvidenceId: randomUUID(),
          cveIds: [cveId],
          iocValues: [],
          techniqueIds: [],
          evidenceIds: [],
          status: "Imported"
        }
      });

      // A poll surfaces THREE fresh world threats: a phishing URL on the
      // tenant's domain, the tracked CVE hitting NVD, and an unrelated domain.
      const ingest = await ingestThreatIntelItems(prisma, [
        {
          kind: "Indicator",
          canonicalKey: iocKey,
          title: `Phishing URL ${phishUrl}`,
          iocType: "url",
          iocValue: phishUrl,
          severity: "High",
          sourceKey: "openphish"
        },
        {
          kind: "Vulnerability",
          canonicalKey: cveKey,
          title: cveId,
          cveIds: [cveId],
          cvssScore: 9.8,
          severity: "Critical",
          sourceKey: "nvd"
        },
        {
          kind: "Indicator",
          canonicalKey: unrelatedKey,
          title: "Unrelated phishing domain",
          iocType: "domain",
          iocValue: `not-mine-${suffix}.example`,
          severity: "High",
          sourceKey: "openphish"
        }
      ]);
      expect(ingest.created).toBe(3);

      const correlation = await correlateThreatItemsForTenants(
        prisma,
        ingest.createdItemIds
      );
      // At least two matches are created: the current tenant's
      // IOC-on-verified-scope and tracked CVE. The result is global across all
      // tenants, so other due tenants in the shared acceptance DB may also
      // legitimately correlate to the same fresh batch.
      expect(correlation.alertsCreated).toBeGreaterThanOrEqual(2);

      const alerts = await prisma.tenantThreatAlert.findMany({
        where: { tenantId },
        orderBy: { matchType: "asc" }
      });
      expect(alerts.map((a) => a.matchType)).toEqual(["cve", "ioc"]);
      const iocAlert = alerts.find((a) => a.matchType === "ioc");
      expect(iocAlert?.matchedValue).toBe(phishUrl);
      expect(iocAlert?.matchedScopeId).not.toBeNull();
      const cveAlert = alerts.find((a) => a.matchType === "cve");
      expect(cveAlert?.matchedValue).toBe(cveId);

      // Re-correlation is idempotent — the (tenant, item) unique dedups.
      const again = await correlateThreatItemsForTenants(
        prisma,
        ingest.createdItemIds
      );
      expect(again.alertsCreated).toBe(0);

      await prisma.tenantThreatAlert.deleteMany({ where: { tenantId } });
    } finally {
      await app.close();
    }
  });

  it("alerts on a subdomain of a verified domain and an IP inside a verified CIDR", async () => {
    const apex = `acme-${suffix}.example`;
    const subdomainHost = `login.${apex}`;
    const subKey = `ioc:domain:${subdomainHost}`;
    const cidrSecondOctet = numericSuffix % 200;
    const cidrThirdOctet = Math.floor(numericSuffix / 200) % 256;
    const cidrHostOctet = 1 + (Math.floor(numericSuffix / (200 * 256)) % 254);
    const cidrIp = `10.${cidrSecondOctet}.${cidrThirdOctet}.${cidrHostOctet}`;
    const ipKey = `ioc:ipv4:${cidrIp}`;

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        prisma
      })
    });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: `surface-${suffix}@periscan.test`,
          name: "Surface Owner",
          password: "periscan-surface-password",
          tenantName: "Surface Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      const tenantId = signup.json().tenant.tenantId as string;

      await prisma.scope.create({
        data: {
          tenantId,
          scopeType: "Domain",
          value: apex, // verified PARENT domain
          verificationStatus: "Verified",
          verifiedAt: new Date()
        }
      });
      await prisma.scope.create({
        data: {
          tenantId,
          scopeType: "IPRange",
          value: `10.${cidrSecondOctet}.${cidrThirdOctet}.0/24`, // verified CIDR
          verificationStatus: "Verified",
          verifiedAt: new Date()
        }
      });

      const ingest = await ingestThreatIntelItems(prisma, [
        {
          kind: "Indicator",
          canonicalKey: subKey,
          title: `Phishing on ${subdomainHost}`,
          iocType: "url",
          iocValue: `https://${subdomainHost}/login`,
          severity: "High",
          sourceKey: "openphish"
        },
        {
          kind: "Indicator",
          canonicalKey: ipKey,
          title: `Botnet C2 ${cidrIp}`,
          iocType: "ipv4",
          iocValue: cidrIp,
          severity: "High",
          sourceKey: "feodo"
        }
      ]);
      expect(ingest.ingested).toBe(2);
      expect(ingest.created).toBeGreaterThanOrEqual(0);

      const feedItems = await prisma.threatIntelItem.findMany({
        select: { threatIntelItemId: true },
        where: { canonicalKey: { in: [subKey, ipKey] } }
      });
      expect(feedItems).toHaveLength(2);

      const correlation = await correlateThreatItemsForTenants(
        prisma,
        feedItems.map((item) => item.threatIntelItemId)
      );
      // Both the subdomain-of-verified-domain and the in-CIDR IP correlate for
      // this tenant. The result is global across tenants, so do not assert an
      // exact cross-tenant created count.
      expect(correlation.alertsCreated).toBeGreaterThanOrEqual(2);

      const alerts = await prisma.tenantThreatAlert.findMany({
        where: { tenantId }
      });
      expect(alerts.length).toBe(2);
      expect(alerts.every((a) => a.matchType === "ioc")).toBe(true);
      expect(alerts.every((a) => a.matchedScopeId !== null)).toBe(true);

      await prisma.tenantThreatAlert.deleteMany({ where: { tenantId } });
      await prisma.threatIntelItem.deleteMany({
        where: { canonicalKey: { in: [subKey, ipKey] } }
      });
    } finally {
      await app.close();
    }
  });
});
