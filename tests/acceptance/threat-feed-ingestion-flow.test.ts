import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function uniqueEmail(prefix: string) {
  return `${prefix}-${randomUUID()}@periscan.test`;
}

function getSessionCookie(response: {
  cookies: Array<{ name: string; value: string }>;
}) {
  const cookie = response.cookies.find(
    (item) => item.name === SESSION_COOKIE_NAME
  );
  if (!cookie) {
    throw new Error("Expected a Periscan session cookie.");
  }
  return cookie.value;
}

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

const FEED_FIXTURE = {
  catalogVersion: "2026.06.02",
  title: "CISA Catalog of Known Exploited Vulnerabilities",
  vulnerabilities: [
    {
      cveID: "CVE-2026-0001",
      dateAdded: "2026-06-01",
      knownRansomwareCampaignUse: "Known",
      product: "Edge Gateway",
      requiredAction: "Apply vendor updates per instructions.",
      shortDescription:
        "Unauthenticated remote code execution in Edge Gateway.",
      vendorProject: "ExampleCorp",
      vulnerabilityName: "ExampleCorp Edge Gateway RCE"
    },
    {
      cveID: "CVE-2026-0002",
      dateAdded: "2026-06-02",
      knownRansomwareCampaignUse: "Unknown",
      product: "Identity Broker",
      requiredAction: "Apply vendor updates per instructions.",
      shortDescription: "Authentication bypass in Identity Broker.",
      vendorProject: "ExampleCorp",
      vulnerabilityName: "ExampleCorp Identity Broker Auth Bypass"
    }
  ]
};

describe("Threat feed ingestion acceptance workflow", () => {
  it("ingests CISA KEV, persists deduped advisories with feed provenance, and skips on re-run", async () => {
    const prisma = createPrismaClient();
    let fetchCalls = 0;
    const fetchImpl = (async (url: string | URL) => {
      fetchCalls += 1;
      expect(String(url)).toContain("known.json");
      return new Response(JSON.stringify(FEED_FIXTURE), {
        headers: { "content-type": "application/json" },
        status: 200
      });
    }) as unknown as typeof fetch;

    const app = await buildApp({
      devMode: true,
      services: createRuntimeServices({
        dataRegion: "us-east-1",
        devMode: true,
        fetchImpl,
        prisma
      })
    });

    try {
      const signupResponse = await app.inject({
        method: "POST",
        payload: {
          email: uniqueEmail("threat-feed"),
          name: "Threat Feed Owner",
          password: "periscan-threat-feed-password",
          tenantName: "Threat Feed Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signupResponse.statusCode).toBe(201);
      const cookie = getSessionCookie(signupResponse);
      const tenantId = signupResponse.json().tenant.tenantId as string;

      // First ingestion imports both feed entries.
      const firstIngest = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          feed: "cisa_kev",
          feedUrl: "https://feeds.example.test/known.json"
        },
        url: "/api/v1/threat-feeds/ingest"
      });
      expect(firstIngest.statusCode).toBe(201);
      const firstBody = firstIngest.json();
      expect(firstBody.feed).toBe("cisa_kev");
      expect(firstBody.fetchedCount).toBe(2);
      expect(firstBody.importedCount).toBe(2);
      expect(firstBody.skippedCount).toBe(0);
      expect(firstBody.advisoryIds).toHaveLength(2);
      expect(fetchCalls).toBe(1);

      // Advisories persisted with feed provenance + dedup keys.
      const stored = await prisma.threatAdvisory.findMany({
        orderBy: { externalId: "asc" },
        where: { sourceCategory: "cisa_kev", tenantId }
      });
      expect(stored).toHaveLength(2);
      expect(stored.map((row) => row.externalId)).toEqual([
        "CVE-2026-0001",
        "CVE-2026-0002"
      ]);
      expect(stored[0]?.sourceName).toBe("CISA KEV");
      expect(stored[0]?.cveIds).toContain("CVE-2026-0001");

      // Re-ingestion is idempotent: nothing new imported, both skipped.
      const secondIngest = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: {
          feed: "cisa_kev",
          feedUrl: "https://feeds.example.test/known.json"
        },
        url: "/api/v1/threat-feeds/ingest"
      });
      expect(secondIngest.statusCode).toBe(201);
      const secondBody = secondIngest.json();
      expect(secondBody.importedCount).toBe(0);
      expect(secondBody.skippedCount).toBe(2);

      const afterReingest = await prisma.threatAdvisory.count({
        where: { sourceCategory: "cisa_kev", tenantId }
      });
      expect(afterReingest).toBe(2);

      // Imported advisories surface through the normal Threat Center listing.
      const listing = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/threat-advisories"
      });
      expect(listing.statusCode).toBe(200);
      const titles = listing
        .json()
        .items.map((item: { title: string }) => item.title);
      expect(titles).toEqual(
        expect.arrayContaining([
          "CVE-2026-0001: ExampleCorp Edge Gateway RCE",
          "CVE-2026-0002: ExampleCorp Identity Broker Auth Bypass"
        ])
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  });
});
