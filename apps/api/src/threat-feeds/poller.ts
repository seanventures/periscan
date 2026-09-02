import type { PrismaClient } from "@prisma/client";

import { ingestThreatIntelItems } from "../services/threat-intel-catalog.js";
import { assertSafeFeedUrl } from "../threat-feeds.js";
import { correlateThreatItemsForTenants } from "./correlate.js";
import {
  listThreatFeeds,
  type FeedFetchSpec,
  type ThreatFeedDefinition
} from "./registry.js";

/**
 * High-frequency poller for the global super-feed. A frequent tick calls
 * runDueThreatFeedPolls; only feeds whose per-feed cadence has elapsed
 * (ThreatIntelSourceState.nextPollAt <= now) actually fetch. Each poll fetches
 * under the SSRF guard, parses with the feed's pure adapter, and ingests with
 * cross-feed dedup. The fetcher is injectable so CI/tests never touch the
 * network. A key-required feed with no key is SKIPPED (not errored); transient
 * errors back off so a flaky feed can't hot-loop.
 */

export interface FeedFetchResult {
  ok: boolean;
  status: number;
  payload: unknown;
}

export type FeedFetcher = (spec: FeedFetchSpec) => Promise<FeedFetchResult>;

export interface PollFeedOutcome {
  sourceKey: string;
  status: "ok" | "skipped_no_key" | "error";
  ingested: number;
  created: number;
  createdItemIds: string[];
  error?: string;
}

export interface RunDuePollsResult {
  polled: number;
  created: number;
  ingested: number;
  skipped: number;
  errored: number;
  /** Per-tenant alerts raised by correlating this run's new items. */
  alertsRaised: number;
  outcomes: PollFeedOutcome[];
}

export interface PollOptions {
  now?: Date;
  fetcher?: FeedFetcher;
  env?: NodeJS.ProcessEnv;
  /** Bound a single poll's work so a huge feed can't stall the tick. */
  maxItemsPerPoll?: number;
}

const MAX_BACKOFF_MINUTES = 360;

/** Live fetcher: SSRF-guarded https fetch, JSON or text per the feed spec. */
export async function defaultFeedFetcher(
  spec: FeedFetchSpec
): Promise<FeedFetchResult> {
  await assertSafeFeedUrl(spec.url);
  const response = await fetch(spec.url, {
    method: spec.method,
    headers: spec.headers,
    body: spec.body
  });
  const payload =
    spec.responseType === "json"
      ? await response.json()
      : await response.text();
  return { ok: response.ok, status: response.status, payload };
}

function resolveMaxItems(options: PollOptions): number {
  if (typeof options.maxItemsPerPoll === "number") {
    return options.maxItemsPerPoll;
  }
  const env = options.env ?? process.env;
  const parsed = Number.parseInt(
    env.PERISCAN_THREAT_FEED_MAX_ITEMS_PER_POLL ?? "",
    10
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2000;
}

function nextPollAt(now: Date, cadenceMinutes: number): Date {
  return new Date(now.getTime() + cadenceMinutes * 60_000);
}

/** Create a source-state row for any registered feed that lacks one. */
export async function ensureThreatFeedSourceStates(
  prisma: PrismaClient,
  now: Date = new Date()
): Promise<void> {
  for (const feed of listThreatFeeds()) {
    await prisma.threatIntelSourceState.upsert({
      where: { sourceKey: feed.sourceKey },
      update: {},
      create: { sourceKey: feed.sourceKey, enabled: true, nextPollAt: now }
    });
  }
}

async function pollOneFeed(
  prisma: PrismaClient,
  feed: ThreatFeedDefinition,
  options: PollOptions
): Promise<PollFeedOutcome> {
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? defaultFeedFetcher;
  const apiKey = feed.keyEnvVar ? (env[feed.keyEnvVar] ?? null) : null;

  if (feed.keyRequired && !apiKey) {
    await prisma.threatIntelSourceState.update({
      where: { sourceKey: feed.sourceKey },
      data: {
        lastPolledAt: now,
        nextPollAt: nextPollAt(now, feed.cadenceMinutes),
        lastStatus: "skipped_no_key",
        lastNewCount: 0
      }
    });
    return {
      sourceKey: feed.sourceKey,
      status: "skipped_no_key",
      ingested: 0,
      created: 0,
      createdItemIds: []
    };
  }

  try {
    const response = await fetcher(feed.buildRequest(apiKey));
    if (!response.ok) {
      throw new Error(`feed responded with status ${response.status}`);
    }
    const parsed = feed.parse(response.payload);
    const bounded = parsed.slice(0, resolveMaxItems(options));
    const result = await ingestThreatIntelItems(prisma, bounded, { now });
    await prisma.threatIntelSourceState.update({
      where: { sourceKey: feed.sourceKey },
      data: {
        lastPolledAt: now,
        nextPollAt: nextPollAt(now, feed.cadenceMinutes),
        cursor: null,
        lastItemCount: result.ingested,
        lastNewCount: result.created,
        lastStatus: bounded.length < parsed.length ? "ok_truncated" : "ok",
        lastError: null,
        consecutiveErrors: 0
      }
    });
    return {
      sourceKey: feed.sourceKey,
      status: "ok",
      ingested: result.ingested,
      created: result.created,
      createdItemIds: result.createdItemIds
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const existing = await prisma.threatIntelSourceState.findUnique({
      where: { sourceKey: feed.sourceKey },
      select: { consecutiveErrors: true }
    });
    const consecutiveErrors = (existing?.consecutiveErrors ?? 0) + 1;
    const backoffMinutes = Math.min(
      feed.cadenceMinutes * consecutiveErrors,
      MAX_BACKOFF_MINUTES
    );
    await prisma.threatIntelSourceState.update({
      where: { sourceKey: feed.sourceKey },
      data: {
        lastPolledAt: now,
        nextPollAt: nextPollAt(now, backoffMinutes),
        lastStatus: "error",
        lastError: message.slice(0, 500),
        consecutiveErrors
      }
    });
    return {
      sourceKey: feed.sourceKey,
      status: "error",
      ingested: 0,
      created: 0,
      createdItemIds: [],
      error: message
    };
  }
}

/**
 * Poll every feed whose cadence is due. Ensures a state row exists per
 * registered feed first, so a freshly-deployed feed polls on the next tick.
 */
export async function runDueThreatFeedPolls(
  prisma: PrismaClient,
  options: PollOptions = {}
): Promise<RunDuePollsResult> {
  const now = options.now ?? new Date();
  await ensureThreatFeedSourceStates(prisma, now);

  const due = await prisma.threatIntelSourceState.findMany({
    where: { enabled: true, nextPollAt: { lte: now } },
    select: { sourceKey: true }
  });

  const result: RunDuePollsResult = {
    polled: 0,
    created: 0,
    ingested: 0,
    skipped: 0,
    errored: 0,
    alertsRaised: 0,
    outcomes: []
  };

  const createdItemIds: string[] = [];

  for (const state of due) {
    const feed = listThreatFeeds().find((f) => f.sourceKey === state.sourceKey);
    if (!feed) {
      // A state row with no registered feed (a removed feed): leave it, skip.
      continue;
    }
    const outcome = await pollOneFeed(prisma, feed, { ...options, now });
    result.polled += 1;
    result.created += outcome.created;
    result.ingested += outcome.ingested;
    if (outcome.status === "skipped_no_key") {
      result.skipped += 1;
    }
    if (outcome.status === "error") {
      result.errored += 1;
    }
    createdItemIds.push(...outcome.createdItemIds);
    result.outcomes.push(outcome);
  }

  // Correlate only this run's NEW catalog items to tenants — the realtime
  // "a fresh world threat just hit your attack surface" alert.
  if (createdItemIds.length > 0) {
    const correlation = await correlateThreatItemsForTenants(
      prisma,
      createdItemIds
    );
    result.alertsRaised = correlation.alertsCreated;
  }

  return result;
}
