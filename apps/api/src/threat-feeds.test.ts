import { describe, expect, it } from "vitest";

import {
  assertSafeFeedUrl,
  CISA_KEV_FEED_URL,
  fetchCisaKevFeed,
  normalizeCisaKevEntry,
  orderCisaKevByRecency,
  resolveThreatFeedUrl
} from "./threat-feeds.js";

const ENTRY = {
  cveID: "cve-2026-1234",
  dateAdded: "2026-05-10",
  knownRansomwareCampaignUse: "Known",
  product: "Gateway",
  requiredAction: "Patch now.",
  shortDescription: "Remote code execution.",
  vendorProject: "ExampleCorp",
  vulnerabilityName: "Example RCE"
};

/** Stub lookup: public A for any hostname unless the name encodes "private". */
const publicLookup = (async (hostname: string) => {
  if (String(hostname).includes("private")) {
    return [{ address: "10.0.0.9", family: 4 }];
  }
  return [{ address: "93.184.216.34", family: 4 }];
}) as unknown as typeof import("node:dns/promises").lookup;

describe("threat-feeds normalizer", () => {
  it("resolves the canonical CISA KEV url and honors overrides", () => {
    expect(resolveThreatFeedUrl("cisa_kev")).toBe(CISA_KEV_FEED_URL);
    expect(resolveThreatFeedUrl("cisa_kev", "https://mirror.test/k.json")).toBe(
      "https://mirror.test/k.json"
    );
  });

  it("maps a KEV entry to an advisory import with normalized provenance", () => {
    const input = normalizeCisaKevEntry(ENTRY);
    expect(input.externalId).toBe("CVE-2026-1234");
    expect(input.sourceCategory).toBe("cisa_kev");
    expect(input.sourceName).toBe("CISA KEV");
    expect(input.cveIds).toEqual(["CVE-2026-1234"]);
    expect(input.title).toBe("CVE-2026-1234: Example RCE");
    expect(input.publishedAt).toBe(new Date("2026-05-10").toISOString());
    // rawContent carries vendor/product + ransomware so indicator extraction +
    // evidence match the manual-import path.
    expect(input.rawContent).toContain("ExampleCorp Gateway");
    expect(input.rawContent).toContain("Known ransomware campaign use");
  });

  it("tolerates missing optional fields and 'Unknown' ransomware", () => {
    const input = normalizeCisaKevEntry({
      cveID: "CVE-2026-9",
      knownRansomwareCampaignUse: "Unknown",
      vulnerabilityName: "Sparse Entry"
    });
    expect(input.summary).toBe("Sparse Entry");
    expect(input.publishedAt).toBeNull();
    expect(input.rawContent).not.toContain("ransomware");
  });

  it("orders entries most-recent-first by dateAdded", () => {
    const ordered = orderCisaKevByRecency([
      { cveID: "CVE-1", dateAdded: "2026-01-01", vulnerabilityName: "old" },
      { cveID: "CVE-2", dateAdded: "2026-06-01", vulnerabilityName: "new" },
      { cveID: "CVE-3", dateAdded: "2026-03-01", vulnerabilityName: "mid" }
    ]);
    expect(ordered.map((entry) => entry.cveID)).toEqual([
      "CVE-2",
      "CVE-3",
      "CVE-1"
    ]);
  });

  it("validates the feed shape and rejects non-OK responses", async () => {
    const ok = (async () =>
      new Response(JSON.stringify({ vulnerabilities: [ENTRY] }), {
        status: 200
      })) as unknown as typeof fetch;
    const feed = await fetchCisaKevFeed(
      "https://feed.test/k.json",
      ok,
      publicLookup
    );
    expect(feed.vulnerabilities).toHaveLength(1);

    const failing = (async () =>
      new Response("nope", { status: 503 })) as unknown as typeof fetch;
    await expect(
      fetchCisaKevFeed("https://feed.test/k.json", failing, publicLookup)
    ).rejects.toThrow(/HTTP 503/);
  });
});

describe("threat-feed SSRF guard", () => {
  it("accepts https public feed hosts that resolve public", async () => {
    await expect(
      assertSafeFeedUrl("https://www.cisa.gov/feeds/known.json", publicLookup)
    ).resolves.toBeUndefined();
    await expect(
      assertSafeFeedUrl("https://feeds.example.test/known.json", publicLookup)
    ).resolves.toBeUndefined();
  });

  it("rejects non-https schemes", async () => {
    await expect(
      assertSafeFeedUrl("http://www.cisa.gov/feed.json", publicLookup)
    ).rejects.toThrow(/https/iu);
    await expect(
      assertSafeFeedUrl("file:///etc/passwd", publicLookup)
    ).rejects.toThrow();
  });

  it("blocks cloud-metadata, loopback, and private hosts", async () => {
    for (const url of [
      "https://169.254.169.254/latest/meta-data/",
      "https://127.0.0.1/",
      "https://localhost/feed.json",
      "https://10.0.0.5/feed.json",
      "https://192.168.1.10/feed.json",
      "https://172.16.4.4/feed.json",
      "https://metadata.google.internal/computeMetadata/v1/",
      "https://vault.internal/secret",
      "https://[::1]/feed.json"
    ]) {
      await expect(assertSafeFeedUrl(url, publicLookup)).rejects.toThrow(
        /disallowed|host|private|reserved|post-resolve/iu
      );
    }
  });

  it("blocks hostnames that rebind to private addresses after DNS resolve", async () => {
    await expect(
      assertSafeFeedUrl("https://evil.private.example/feed.json", publicLookup)
    ).rejects.toThrow(/post-resolve|private|reserved/iu);
  });
});
