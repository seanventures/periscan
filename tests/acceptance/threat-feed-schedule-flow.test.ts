import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { buildApp } from "../../apps/api/src/app.js";
import { createRuntimeServices } from "../../apps/api/src/runtime-services.js";
import { runSystemValidationSweep } from "../../apps/api/src/system-scheduler.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

const SESSION_COOKIE_NAME = "periscan_session";

function authCookies(cookie: string) {
  return { [SESSION_COOKIE_NAME]: cookie };
}

const FEED_FIXTURE = {
  title: "CISA KEV",
  vulnerabilities: [
    {
      cveID: "CVE-2026-9001",
      dateAdded: "2026-06-09",
      knownRansomwareCampaignUse: "Known",
      product: "Edge Gateway",
      requiredAction: "Patch now.",
      shortDescription: "RCE in Edge Gateway.",
      vendorProject: "ExampleCorp",
      vulnerabilityName: "ExampleCorp Edge Gateway RCE"
    }
  ]
};

/**
 * Proves CONTINUOUS threat-feed ingestion: a tenant opts into a recurring schedule
 * and the system sweep then ingests new advisories with no manual import and no
 * per-tenant HTTP auth — the threat center stays current automatically.
 */
describe("Continuous threat-feed ingestion", () => {
  it("ingests the feed via the system sweep when a tenant's schedule is due", async () => {
    const prisma = createPrismaClient();
    const fetchImpl = (async () =>
      new Response(JSON.stringify(FEED_FIXTURE), {
        headers: { "content-type": "application/json" },
        status: 200
      })) as unknown as typeof fetch;

    const services = createRuntimeServices({
      dataRegion: "us-east-1",
      devMode: true,
      fetchImpl,
      prisma
    });
    const app = await buildApp({ devMode: true, services });

    try {
      const signup = await app.inject({
        method: "POST",
        payload: {
          email: `threat-sched-${randomUUID()}@periscan.test`,
          name: "Threat Sched Owner",
          password: "periscan-threat-sched-password",
          tenantName: "Threat Sched Tenant"
        },
        url: "/api/v1/auth/signup"
      });
      expect(signup.statusCode).toBe(201);
      const cookie = signup.cookies.find(
        (c) => c.name === SESSION_COOKIE_NAME
      )!.value;
      const tenantId = signup.json().tenant.tenantId as string;

      // Before opting in, the schedule reads as unconfigured.
      const before = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/threat-feeds/schedule"
      });
      expect(before.statusCode).toBe(200);
      expect(before.json()).toEqual({
        frequency: null,
        nextThreatFeedIngestAt: null
      });

      // Opt into a recurring schedule.
      const scheduled = await app.inject({
        cookies: authCookies(cookie),
        method: "POST",
        payload: { frequency: "Daily" },
        url: "/api/v1/threat-feeds/schedule"
      });
      expect(scheduled.statusCode).toBe(200);
      expect(scheduled.json().nextThreatFeedIngestAt).not.toBeNull();

      // The schedule read now reflects the persisted recurring configuration.
      const afterSet = await app.inject({
        cookies: authCookies(cookie),
        method: "GET",
        url: "/api/v1/threat-feeds/schedule"
      });
      expect(afterSet.statusCode).toBe(200);
      expect(afterSet.json().frequency).toBe("Daily");
      expect(afterSet.json().nextThreatFeedIngestAt).not.toBeNull();

      // Force the schedule due, then drive the sweep (no HTTP context).
      await prisma.tenant.update({
        data: { nextThreatFeedIngestAt: new Date(Date.now() - 60_000) },
        where: { tenantId }
      });

      const summary = await runSystemValidationSweep({
        services,
        tenantIds: [tenantId]
      });
      expect(summary.threatFeedsIngested).toBeGreaterThanOrEqual(1);

      // The advisory was ingested and the schedule advanced into the future.
      const advisories = await prisma.threatAdvisory.count({
        where: { externalId: "CVE-2026-9001", tenantId }
      });
      expect(advisories).toBe(1);
      const after = await prisma.tenant.findUniqueOrThrow({
        where: { tenantId }
      });
      expect(after.nextThreatFeedIngestAt?.getTime() ?? 0).toBeGreaterThan(
        Date.now()
      );
    } finally {
      await app.close();
      await prisma.$disconnect();
    }
  }, 60_000);
});
