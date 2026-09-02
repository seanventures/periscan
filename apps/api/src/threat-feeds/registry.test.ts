import { NormalizedThreatIntelItemSchema } from "@periscan/shared";
import { describe, expect, it } from "vitest";

import {
  getThreatFeed,
  listThreatFeeds,
  THREAT_FEED_DEFINITIONS
} from "./registry.js";

/**
 * Contract tests for every super-feed adapter: parse a representative fixture
 * payload (NO network) and assert the normalized output. CI never fetches a
 * live feed — these fixtures are the fixtureMode coverage.
 */

const CISA_KEV_FIXTURE = {
  title: "CISA Catalog of Known Exploited Vulnerabilities",
  vulnerabilities: [
    {
      cveID: "CVE-2026-1234",
      vulnerabilityName: "Acme Widget RCE",
      vendorProject: "Acme",
      product: "Widget",
      dateAdded: "2026-06-10",
      shortDescription: "Remote code execution in Acme Widget.",
      requiredAction: "Apply updates.",
      knownRansomwareCampaignUse: "Known"
    },
    { cveID: "not-a-cve", vulnerabilityName: "junk" }
  ]
};

const NVD_FIXTURE = {
  vulnerabilities: [
    {
      cve: {
        id: "CVE-2026-1234",
        published: "2026-06-09T00:00:00.000",
        descriptions: [
          { lang: "en", value: "Remote code execution in Acme Widget." },
          { lang: "es", value: "ignored" }
        ],
        metrics: {
          cvssMetricV31: [{ cvssData: { baseScore: 9.8 } }]
        }
      }
    }
  ]
};

const EPSS_FIXTURE = {
  status: "OK",
  data: [
    { cve: "CVE-2026-1234", epss: "0.97431", percentile: "0.999" },
    { cve: "garbage", epss: "nope" }
  ]
};

const TOR_FIXTURE = ["# comment", "1.2.3.4", "5.6.7.8", "not-an-ip"].join("\n");

const OPENPHISH_FIXTURE = [
  "https://evil.example/login",
  "http://bad.test/paypal",
  "garbage-not-a-url"
].join("\n");

const THREATFOX_FIXTURE = {
  query_status: "ok",
  data: [
    {
      id: "999001",
      ioc: "203.0.113.5:443",
      ioc_type: "ip:port",
      threat_type: "botnet_cc",
      threat_type_desc: "Indicator that identifies a botnet C2 server.",
      malware_printable: "Cobalt Strike",
      first_seen: "2026-06-12 10:00:00"
    },
    {
      id: "999002",
      ioc: "evil-malware.test",
      ioc_type: "domain",
      threat_type: "payload_delivery",
      malware_printable: "Emotet",
      first_seen: "2026-06-12 11:00:00"
    }
  ]
};

const FEODO_FIXTURE = [
  {
    ip_address: "198.51.100.7",
    port: 443,
    malware: "Emotet",
    first_seen: "2026-06-12 09:00:00"
  },
  { ip_address: "not-an-ip" }
];

const URLHAUS_FIXTURE = {
  query_status: "ok",
  urls: [
    {
      id: "3001",
      url: "https://malware.test/payload.exe",
      threat: "malware_download",
      tags: ["exe", "emotet"],
      date_added: "2026-06-12 10:00:00"
    },
    { id: "3002", url: "garbage" }
  ]
};

const MALWAREBAZAAR_FIXTURE = {
  query_status: "ok",
  data: [
    {
      sha256_hash: "b".repeat(64),
      signature: "AgentTesla",
      file_type: "exe",
      first_seen: "2026-06-12 11:00:00"
    }
  ]
};

const OTX_FIXTURE = {
  results: [
    {
      id: "pulse-1",
      name: "APT fixture campaign",
      description: "Fixture pulse.",
      created: "2026-06-12T12:00:00",
      indicators: [
        { id: "i1", indicator: "203.0.113.9", type: "IPv4" },
        { id: "i2", indicator: "evil-otx.test", type: "domain" },
        { id: "i3", indicator: "garbage value", type: "unknown" }
      ]
    }
  ]
};

const ET_FIXTURE = ["# Emerging Threats", "192.0.2.10", "192.0.2.11", ""].join(
  "\n"
);
const BLOCKLISTDE_FIXTURE = ["203.0.113.50", "203.0.113.51"].join("\n");

const CISA_ADVISORIES_FIXTURE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>ICS Advisory: Acme PLC affected by CVE-2026-4242</title>
    <link>https://www.cisa.gov/advisories/aa26-100a</link>
    <pubDate>Mon, 15 Jun 2026 00:00:00 GMT</pubDate>
    <description><![CDATA[A vulnerability CVE-2026-4242 affects Acme PLC.]]></description>
  </item>
</channel></rss>`;

const FIXTURE_BY_KEY: Record<string, unknown> = {
  "cisa-kev": CISA_KEV_FIXTURE,
  nvd: NVD_FIXTURE,
  epss: EPSS_FIXTURE,
  "tor-exit": TOR_FIXTURE,
  openphish: OPENPHISH_FIXTURE,
  threatfox: THREATFOX_FIXTURE,
  feodo: FEODO_FIXTURE,
  urlhaus: URLHAUS_FIXTURE,
  malwarebazaar: MALWAREBAZAAR_FIXTURE,
  otx: OTX_FIXTURE,
  "emergingthreats-compromised": ET_FIXTURE,
  "blocklist-de": BLOCKLISTDE_FIXTURE,
  "cisa-advisories": CISA_ADVISORIES_FIXTURE
};

describe("super-feed registry contracts", () => {
  it("registers a unique sourceKey per feed", () => {
    const keys = THREAT_FEED_DEFINITIONS.map((feed) => feed.sourceKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every feed's fixture parses to schema-valid normalized items keyed by its sourceKey", () => {
    for (const feed of listThreatFeeds()) {
      const fixture = FIXTURE_BY_KEY[feed.sourceKey];
      expect(fixture, `missing fixture for ${feed.sourceKey}`).toBeDefined();
      const items = feed.parse(fixture);
      expect(
        items.length,
        `${feed.sourceKey} produced no items`
      ).toBeGreaterThan(0);
      for (const item of items) {
        // Each item must satisfy the shared normalized contract (so ingest accepts it).
        expect(() => NormalizedThreatIntelItemSchema.parse(item)).not.toThrow();
        expect(item.sourceKey).toBe(feed.sourceKey);
        expect(item.canonicalKey.length).toBeGreaterThan(0);
      }
    }
  });

  it("drops malformed entries instead of emitting junk", () => {
    // KEV fixture has a bad cveID; NVD/EPSS have junk rows; text feeds have noise.
    expect(getThreatFeed("cisa-kev")!.parse(CISA_KEV_FIXTURE)).toHaveLength(1);
    expect(getThreatFeed("epss")!.parse(EPSS_FIXTURE)).toHaveLength(1);
    expect(getThreatFeed("tor-exit")!.parse(TOR_FIXTURE)).toHaveLength(2);
    expect(getThreatFeed("openphish")!.parse(OPENPHISH_FIXTURE)).toHaveLength(
      2
    );
  });

  it("CISA KEV marks active exploitation + ransomware on the canonical CVE key", () => {
    const item = getThreatFeed("cisa-kev")!.parse(CISA_KEV_FIXTURE)[0];
    expect(item).toBeDefined();
    expect(item!.canonicalKey).toBe("cve:CVE-2026-1234");
    expect(item!.kev).toBe(true);
    expect(item!.kevRansomware).toBe(true);
    expect(item!.severity).toBe("Critical");
  });

  it("NVD derives severity from CVSS, EPSS carries the probability — both on the SAME canonical key (cross-feed merge)", () => {
    const nvd = getThreatFeed("nvd")!.parse(NVD_FIXTURE)[0];
    const epss = getThreatFeed("epss")!.parse(EPSS_FIXTURE)[0];
    expect(nvd).toBeDefined();
    expect(epss).toBeDefined();
    // Same canonical key => these will dedup/merge into one catalog item.
    expect(nvd!.canonicalKey).toBe("cve:CVE-2026-1234");
    expect(epss!.canonicalKey).toBe("cve:CVE-2026-1234");
    expect(nvd!.cvssScore).toBe(9.8);
    expect(nvd!.severity).toBe("Critical");
    expect(epss!.epssScore).toBeCloseTo(0.97431, 5);
  });

  it("ThreatFox keys network IOCs by IP (strips :port) and tags the malware family", () => {
    const items = getThreatFeed("threatfox")!.parse(THREATFOX_FIXTURE);
    const cobalt = items.find((i) => i.canonicalKey === "ioc:ipv4:203.0.113.5");
    expect(cobalt).toBeDefined();
    expect(cobalt!.iocType).toBe("ipv4");
    expect(cobalt!.tags).toContain("cobalt strike");
    const emotet = items.find(
      (i) => i.canonicalKey === "ioc:domain:evil-malware.test"
    );
    expect(emotet).toBeDefined();
  });

  it("the abuse.ch/OTX feeds are key-REQUIRED; the rest work with no key", () => {
    const keyRequired = THREAT_FEED_DEFINITIONS.filter((f) => f.keyRequired)
      .map((f) => f.sourceKey)
      .sort();
    expect(keyRequired).toEqual(
      ["malwarebazaar", "otx", "threatfox", "urlhaus"].sort()
    );
    // A key-required feed with no key still builds a request shape (poller skips it).
    const tf = getThreatFeed("threatfox")!;
    expect(tf.buildRequest(null).method).toBe("POST");
    // NVD's optional key goes in the apiKey header when present.
    expect(getThreatFeed("nvd")!.buildRequest("k").headers?.apiKey).toBe("k");
    expect(getThreatFeed("nvd")!.buildRequest(null).headers).toBeUndefined();
    expect(getThreatFeed("feodo")!.keyEnvVar).toBeNull();
    expect(getThreatFeed("emergingthreats-compromised")!.keyEnvVar).toBeNull();
  });

  it("CISA advisories RSS extracts the advisory + its CVE", () => {
    const items = getThreatFeed("cisa-advisories")!.parse(
      CISA_ADVISORIES_FIXTURE
    );
    expect(items.length).toBe(1);
    expect(items[0]!.kind).toBe("Advisory");
    expect(items[0]!.cveIds).toContain("CVE-2026-4242");
  });

  it("Feodo + ET + blocklist.de drop malformed lines and key by IP", () => {
    expect(getThreatFeed("feodo")!.parse(FEODO_FIXTURE)).toHaveLength(1);
    expect(
      getThreatFeed("emergingthreats-compromised")!.parse(ET_FIXTURE)
    ).toHaveLength(2);
    expect(
      getThreatFeed("blocklist-de")!.parse(BLOCKLISTDE_FIXTURE)
    ).toHaveLength(2);
  });
});
