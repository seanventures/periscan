import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { correlateThreatItemsForTenants } from "../../apps/api/src/threat-feeds/correlate.js";
import { ingestThreatIntelItems } from "../../apps/api/src/services/threat-intel-catalog.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function cookieFrom(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find((c) => c.name === SESSION_COOKIE_NAME);
  if (!cookie) {
    throw new Error("expected session cookie");
  }
  return { [SESSION_COOKIE_NAME]: cookie.value };
}

/** End-to-end HTTP surface for the super feed: catalog search, feed health, alerts. */
describe("Super-feed API surface", () => {
  const prisma = createPrismaClient();
  const suffix = randomUUID();
  const domain = `apicheck-${suffix}.example`;
  const iocKey = `ioc:domain:${domain}`;

  afterAll(async () => {
    await prisma.threatIntelItem.deleteMany({
      where: { canonicalKey: iocKey }
    });
    await prisma.$disconnect();
  });

  it("lists feed health, searches the catalog, surfaces a tenant alert, and acks it", async () => {
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
          email: `apicheck-${suffix}@periscan.test`,
          name: "API Check",
          password: "periscan-apicheck-password",
          tenantName: "API Check Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookies = cookieFrom(signup);
      const tenantId = signup.json().tenant.tenantId as string;

      // Feed health lists every registered source (registry-backed).
      const feeds = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/threat-intel/feeds"
      });
      expect(feeds.statusCode).toBe(200);
      const feedKeys = (feeds.json().items as Array<{ sourceKey: string }>).map(
        (f) => f.sourceKey
      );
      expect(feedKeys).toContain("cisa-kev");
      expect(feedKeys).toContain("threatfox");
      const threatfox = (
        feeds.json().items as Array<{ sourceKey: string; keyRequired: boolean }>
      ).find((f) => f.sourceKey === "threatfox");
      expect(threatfox?.keyRequired).toBe(true);

      // Seed a verified-scope match + ingest the fresh IOC, then correlate.
      await prisma.scope.create({
        data: {
          tenantId,
          scopeType: "Domain",
          value: domain,
          verificationStatus: "Verified",
          verifiedAt: new Date()
        }
      });
      const ingest = await ingestThreatIntelItems(prisma, [
        {
          kind: "Indicator",
          canonicalKey: iocKey,
          title: `Phishing on ${domain}`,
          iocType: "domain",
          iocValue: domain,
          severity: "High",
          sourceKey: "openphish"
        }
      ]);
      await correlateThreatItemsForTenants(prisma, ingest.createdItemIds);

      // Catalog search finds the canonical item with its source attribution.
      const catalog = await app.inject({
        cookies,
        method: "GET",
        url: `/api/v1/threat-intel/catalog?q=${encodeURIComponent(domain)}`
      });
      expect(catalog.statusCode).toBe(200);
      const found = (
        catalog.json().items as Array<{
          canonicalKey: string;
          sources: string[];
        }>
      ).find((i) => i.canonicalKey === iocKey);
      expect(found).toBeDefined();
      expect(found!.sources).toContain("openphish");

      // The tenant alert is surfaced.
      const alerts = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/threat-intel/alerts"
      });
      expect(alerts.statusCode).toBe(200);
      const alertItems = alerts.json().items as Array<{
        tenantThreatAlertId: string;
        matchType: string;
        status: string;
      }>;
      expect(alertItems.length).toBe(1);
      expect(alertItems[0]!.matchType).toBe("ioc");
      expect(alertItems[0]!.status).toBe("New");

      // Acknowledge it.
      const ack = await app.inject({
        cookies,
        method: "POST",
        payload: { status: "Acknowledged" },
        url: `/api/v1/threat-intel/alerts/${alertItems[0]!.tenantThreatAlertId}/status`
      });
      expect(ack.statusCode).toBe(200);
      expect(ack.json().status).toBe("Acknowledged");

      // Filtering by New now excludes it.
      const newOnly = await app.inject({
        cookies,
        method: "GET",
        url: "/api/v1/threat-intel/alerts?status=New"
      });
      expect((newOnly.json().items as unknown[]).length).toBe(0);

      await prisma.tenantThreatAlert.deleteMany({ where: { tenantId } });
    } finally {
      await app.close();
    }
  });
});
