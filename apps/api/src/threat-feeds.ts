import type * as dnsPromises from "node:dns/promises";

import {
  CisaKevFeedSchema,
  type CisaKevFeed,
  type ImportThreatAdvisoryInput,
  type ThreatFeed
} from "@periscan/shared";

import { assertSafeOutboundHttpsUrl } from "./outbound-url-safety.js";

// Canonical, free, no-auth public feed. Override via ingestion input.feedUrl for
// self-hosted mirrors or tests.
export const CISA_KEV_FEED_URL =
  "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";

// SSRF guard for customer-supplied feed URLs (delegates to shared outbound guard).
export async function assertSafeFeedUrl(
  rawUrl: string,
  lookup?: typeof dnsPromises.lookup
): Promise<void> {
  await assertSafeOutboundHttpsUrl(rawUrl, {
    code: "unsafe_feed_url",
    label: "Threat feed URL",
    lookup
  });
}

// Stable per-feed provenance slug stored on ThreatAdvisory.sourceCategory and
// used (with externalId) for idempotent dedup.
export const THREAT_FEED_SOURCE_CATEGORY: Record<ThreatFeed, string> = {
  cisa_kev: "cisa_kev"
};

export function resolveThreatFeedUrl(
  feed: ThreatFeed,
  override?: string
): string {
  if (override) {
    return override;
  }
  switch (feed) {
    case "cisa_kev":
      return CISA_KEV_FEED_URL;
    default: {
      const exhaustive: never = feed;
      throw new Error(`Unsupported threat feed: ${String(exhaustive)}`);
    }
  }
}

// Fetch + validate the raw feed using an injectable fetch (tests stub this).
export async function fetchCisaKevFeed(
  feedUrl: string,
  fetchImpl: typeof fetch,
  lookup?: typeof dnsPromises.lookup
): Promise<CisaKevFeed> {
  // SSRF guard: validate the resolved URL before any outbound request.
  await assertSafeFeedUrl(feedUrl, lookup);
  const response = await fetchImpl(feedUrl, {
    headers: {
      accept: "application/json",
      "user-agent": "Periscan-ThreatFeed/1.0"
    },
    method: "GET",
    // Do not follow redirects to a different (possibly internal) host.
    redirect: "error"
  });
  if (!response.ok) {
    throw new Error(
      `Threat feed fetch failed (HTTP ${response.status}) for ${feedUrl}.`
    );
  }
  return CisaKevFeedSchema.parse(await response.json());
}

function parseFeedDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

// Map one CISA KEV entry to the existing advisory-import contract. The composed
// rawContent feeds the same indicator-extraction + evidence path as manual
// imports, so feed-sourced advisories produce identical normalized output.
export function normalizeCisaKevEntry(
  entry: CisaKevFeed["vulnerabilities"][number]
): ImportThreatAdvisoryInput {
  const cveId = entry.cveID.trim().toUpperCase();
  const vendorProduct = [entry.vendorProject, entry.product]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(" ");
  const ransomware =
    entry.knownRansomwareCampaignUse &&
    entry.knownRansomwareCampaignUse.toLowerCase() !== "unknown"
      ? `Known ransomware campaign use: ${entry.knownRansomwareCampaignUse}.`
      : "";
  const rawContent = [
    `${cveId} — ${entry.vulnerabilityName}`,
    vendorProduct ? `Affected: ${vendorProduct}` : "",
    entry.shortDescription ?? "",
    entry.requiredAction ? `Required action: ${entry.requiredAction}` : "",
    ransomware,
    entry.notes ?? ""
  ]
    .filter((part) => part.trim().length > 0)
    .join("\n");

  return {
    cveIds: [cveId],
    externalId: cveId,
    publishedAt: parseFeedDate(entry.dateAdded),
    rawContent,
    sourceCategory: THREAT_FEED_SOURCE_CATEGORY.cisa_kev,
    sourceName: "CISA KEV",
    sourceUrl: `https://nvd.nist.gov/vuln/detail/${cveId}`,
    summary: entry.shortDescription?.trim() || entry.vulnerabilityName,
    title: `${cveId}: ${entry.vulnerabilityName}`
  };
}

// Most-recent-first ordering by dateAdded so a bounded `limit` imports the
// newest entries first.
export function orderCisaKevByRecency(
  vulnerabilities: CisaKevFeed["vulnerabilities"]
): CisaKevFeed["vulnerabilities"] {
  return [...vulnerabilities].sort((a, b) => {
    const aDate = parseFeedDate(a.dateAdded) ?? "";
    const bDate = parseFeedDate(b.dateAdded) ?? "";
    return bDate.localeCompare(aDate);
  });
}
