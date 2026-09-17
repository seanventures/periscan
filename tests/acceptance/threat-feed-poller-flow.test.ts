import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import {
  runDueThreatFeedPolls,
  type FeedFetcher
} from "../../apps/api/src/threat-feeds/poller.js";
import { listThreatFeeds } from "../../apps/api/src/threat-feeds/registry.js";
import { createPrismaClient } from "../../packages/db/src/client.js";

/**
 * Proves the super-feed poller end-to-end with an INJECTED fetcher (no network,
 * CI-safe): it fetches due feeds, ingests with dedup, skips key-required feeds
 * that have no key (not an error), is idempotent on re-poll, and backs off on a
 * feed error.
 */
describe("Super-feed high-frequency poller", () => {
  const prisma = createPrismaClient();
  const touchedSourceKeys = listThreatFeeds().map((feed) => feed.sourceKey);
  let originalSourceStates: Awaited<
    ReturnType<typeof prisma.threatIntelSourceState.findMany>
  > | null = null;
  const cveId = `CVE-2026-${BigInt(
    `0x${randomUUID().replaceAll("-", "").slice(0, 16)}`
  ).toString()}`;
  const canonicalKey = `cve:${cveId}`;

  // A CISA-KEV-shaped payload for our random CVE; every other feed is fed an
  // empty-but-valid payload so it succeeds with zero items (no noise/errors).
  const kevPayload = {
    vulnerabilities: [
      {
        cveID: cveId,
        vulnerabilityName: "Poller fixture RCE",
        product: "Widget",
        dateAdded: "2026-06-10",
        shortDescription: "Fixture vulnerability.",
        knownRansomwareCampaignUse: "Known"
      }
    ]
  };

  const okFetcher: FeedFetcher = async (spec) => {
    if (spec.url.includes("cisa.gov")) {
      return { ok: true, status: 200, payload: kevPayload };
    }
    return {
      ok: true,
      status: 200,
      payload: spec.responseType === "json" ? {} : ""
    };
  };

  async function snapshotSourceStates() {
    originalSourceStates ??= await prisma.threatIntelSourceState.findMany({
      where: { sourceKey: { in: [...touchedSourceKeys] } }
    });
  }

  async function restoreSourceStates() {
    if (!originalSourceStates) {
      return;
    }

    const existingSourceKeys = new Set(
      originalSourceStates.map((state) => state.sourceKey)
    );

    for (const state of originalSourceStates) {
      await prisma.threatIntelSourceState.update({
        data: {
          consecutiveErrors: state.consecutiveErrors,
          cursor: state.cursor,
          enabled: state.enabled,
          lastError: state.lastError,
          lastItemCount: state.lastItemCount,
          lastNewCount: state.lastNewCount,
          lastPolledAt: state.lastPolledAt,
          lastStatus: state.lastStatus,
          nextPollAt: state.nextPollAt
        },
        where: { sourceKey: state.sourceKey }
      });
    }

    await prisma.threatIntelSourceState.deleteMany({
      where: {
        sourceKey: {
          in: touchedSourceKeys.filter((key) => !existingSourceKeys.has(key))
        }
      }
    });
  }

  afterAll(async () => {
    await prisma.threatIntelItem.deleteMany({ where: { canonicalKey } });
    await restoreSourceStates();
    await prisma.$disconnect();
  });

  it("polls due feeds, ingests KEV, and skips the key-required feed with no key", async () => {
    await snapshotSourceStates();
    const now = new Date();
    // The catalog's source-state is GLOBAL and persists across test runs, so a
    // prior run may have pushed these feeds' nextPollAt into the future. Force
    // the two we assert on to be due now (deterministic, run-order independent).
    const due = new Date(now.getTime() - 1000);
    for (const sourceKey of ["cisa-kev", "threatfox"]) {
      await prisma.threatIntelSourceState.upsert({
        where: { sourceKey },
        update: { nextPollAt: due, enabled: true, consecutiveErrors: 0 },
        create: { sourceKey, nextPollAt: due }
      });
    }
    // No abuse.ch key in this env => threatfox must be SKIPPED, not errored.
    const result = await runDueThreatFeedPolls(prisma, {
      now,
      fetcher: okFetcher,
      env: {}
    });

    expect(result.polled).toBeGreaterThan(0);
    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(result.errored).toBe(0);

    const kev = result.outcomes.find((o) => o.sourceKey === "cisa-kev");
    expect(kev?.status).toBe("ok");
    expect(kev?.created).toBe(1);

    const threatfox = result.outcomes.find((o) => o.sourceKey === "threatfox");
    expect(threatfox?.status).toBe("skipped_no_key");

    // The KEV item landed in the catalog with provenance + active-exploitation flags.
    const item = await prisma.threatIntelItem.findUniqueOrThrow({
      where: { canonicalKey },
      include: { provenance: true }
    });
    expect(item.kev).toBe(true);
    expect(item.kevRansomware).toBe(true);
    expect(item.provenance.map((p) => p.sourceKey)).toContain("cisa-kev");

    // After a successful poll the feed's next poll is in the future (cadence honored).
    const state = await prisma.threatIntelSourceState.findUniqueOrThrow({
      where: { sourceKey: "cisa-kev" }
    });
    expect(state.lastStatus).toBe("ok");
    expect(state.lastNewCount).toBe(1);
    expect(state.nextPollAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("re-polling the same feed is idempotent (dedup => 0 new)", async () => {
    await snapshotSourceStates();
    // Force KEV due again; only it should poll (others advanced their cadence).
    const now = new Date();
    await prisma.threatIntelSourceState.upsert({
      create: { nextPollAt: now, sourceKey: "cisa-kev" },
      update: { nextPollAt: now },
      where: { sourceKey: "cisa-kev" }
    });
    const result = await runDueThreatFeedPolls(prisma, {
      now,
      fetcher: okFetcher,
      env: {}
    });
    const kev = result.outcomes.find((o) => o.sourceKey === "cisa-kev");
    expect(kev?.status).toBe("ok");
    expect(kev?.created).toBe(0);
  });

  it("backs off a feed that errors instead of hot-looping", async () => {
    await snapshotSourceStates();
    const now = new Date();
    await prisma.threatIntelSourceState.upsert({
      create: {
        consecutiveErrors: 0,
        nextPollAt: now,
        sourceKey: "cisa-kev"
      },
      update: { consecutiveErrors: 0, nextPollAt: now },
      where: { sourceKey: "cisa-kev" }
    });
    const failingFetcher: FeedFetcher = async (spec) => {
      if (spec.url.includes("cisa.gov")) {
        return { ok: false, status: 503, payload: null };
      }
      return {
        ok: true,
        status: 200,
        payload: spec.responseType === "json" ? {} : ""
      };
    };
    const result = await runDueThreatFeedPolls(prisma, {
      now,
      fetcher: failingFetcher,
      env: {}
    });
    const kev = result.outcomes.find((o) => o.sourceKey === "cisa-kev");
    expect(kev?.status).toBe("error");

    const state = await prisma.threatIntelSourceState.findUniqueOrThrow({
      where: { sourceKey: "cisa-kev" }
    });
    expect(state.lastStatus).toBe("error");
    expect(state.consecutiveErrors).toBeGreaterThanOrEqual(1);
    // Backed off into the future (cadence * errors), so it won't hot-loop.
    expect(state.nextPollAt.getTime()).toBeGreaterThan(now.getTime());
  });
});
