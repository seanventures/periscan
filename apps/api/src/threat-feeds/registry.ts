import {
  canonicalKeyForCve,
  canonicalKeyForIoc,
  detectIoc,
  normalizeTechniqueId,
  severityFromCvss,
  type NormalizedThreatIntelItem,
  type ThreatSeverity
} from "@periscan/shared";

/**
 * Code-defined registry of public threat feeds for the global super-feed.
 *
 * Each feed has a PURE `parse(payload) -> NormalizedThreatIntelItem[]` (no
 * network, fully unit-testable over a fixture) separated from its fetch spec.
 * The poller resolves the (optional, free) API key from env, fetches under the
 * SSRF guard, then calls `parse`. A feed whose `keyEnvVar` is required but unset
 * is SKIPPED (not errored), so the no-key feeds work out of the box and the
 * free-key feeds activate the moment an operator supplies a key.
 *
 * Adding a feed = add one ThreatFeedDefinition. Everything downstream (dedup,
 * provenance, polling, alerts) is feed-agnostic.
 */

export interface FeedFetchSpec {
  method: "GET" | "POST";
  url: string;
  headers?: Record<string, string>;
  body?: string;
  responseType: "json" | "text";
}

export interface ThreatFeedDefinition {
  sourceKey: string;
  name: string;
  category:
    | "Vulnerability"
    | "Exploited"
    | "IpReputation"
    | "Phishing"
    | "Malware"
    | "Advisory";
  description: string;
  homepageUrl: string;
  /** Default poll cadence; fast feeds poll more often than big dumps. */
  cadenceMinutes: number;
  /** Env var holding a FREE api key, or null when the feed needs no key. */
  keyEnvVar: string | null;
  /** When true, the feed is skipped (not errored) until keyEnvVar is set. */
  keyRequired: boolean;
  /** Attribution + terms note for THIRD_PARTY/source docs. */
  license: string;
  buildRequest(apiKey: string | null): FeedFetchSpec;
  parse(payload: unknown): NormalizedThreatIntelItem[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function splitLines(payload: unknown): string[] {
  return typeof payload === "string"
    ? payload
        .split(/\r?\n/u)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
    : [];
}

// --- CISA KEV: known-exploited vulnerabilities (no key) ---------------------

function parseCisaKev(payload: unknown): NormalizedThreatIntelItem[] {
  const root = asRecord(payload);
  if (!root) {
    return [];
  }
  const items: NormalizedThreatIntelItem[] = [];
  for (const entry of asArray(root.vulnerabilities)) {
    const record = asRecord(entry);
    const cveId = record ? str(record.cveID) : null;
    const canonicalKey = cveId ? canonicalKeyForCve(cveId) : null;
    if (!record || !cveId || !canonicalKey) {
      continue;
    }
    const ransomware =
      str(record.knownRansomwareCampaignUse)?.toLowerCase() === "known";
    items.push({
      kind: "Vulnerability",
      canonicalKey,
      title:
        str(record.vulnerabilityName) ??
        `${cveId}${str(record.product) ? ` in ${str(record.product)}` : ""}`,
      summary: str(record.shortDescription) ?? "",
      cveIds: [cveId.toUpperCase()],
      cvssScore: null,
      epssScore: null,
      // On the KEV list = actively exploited; treat as Critical exposure.
      severity: "Critical",
      kev: true,
      kevRansomware: ransomware,
      techniqueIds: [],
      tags: ["cisa-kev", ...(ransomware ? ["ransomware"] : [])],
      publishedAt: str(record.dateAdded)
        ? new Date(`${str(record.dateAdded)}T00:00:00.000Z`).toISOString()
        : null,
      sourceKey: "cisa-kev",
      externalId: cveId.toUpperCase(),
      sourceUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog"
    });
  }
  return items;
}

// --- NVD CVE 2.0: full vuln catalog w/ CVSS (key optional, raises rate) -----

function parseNvd(payload: unknown): NormalizedThreatIntelItem[] {
  const root = asRecord(payload);
  if (!root) {
    return [];
  }
  const items: NormalizedThreatIntelItem[] = [];
  for (const entry of asArray(root.vulnerabilities)) {
    const cve = asRecord(asRecord(entry)?.cve);
    const cveId = cve ? str(cve.id) : null;
    const canonicalKey = cveId ? canonicalKeyForCve(cveId) : null;
    if (!cve || !cveId || !canonicalKey) {
      continue;
    }
    const descriptions = asArray(cve.descriptions);
    const englishDescription = descriptions
      .map((d) => asRecord(d))
      .find((d) => d && str(d.lang) === "en");
    const metrics = asRecord(cve.metrics);
    const primaryCvss = [
      ...asArray(metrics?.cvssMetricV31),
      ...asArray(metrics?.cvssMetricV30),
      ...asArray(metrics?.cvssMetricV2)
    ]
      .map((m) => asRecord(asRecord(m)?.cvssData))
      .find((data) => data && typeof data.baseScore === "number");
    const cvssScore =
      primaryCvss && typeof primaryCvss.baseScore === "number"
        ? primaryCvss.baseScore
        : null;
    items.push({
      kind: "Vulnerability",
      canonicalKey,
      title: cveId.toUpperCase(),
      summary: englishDescription ? (str(englishDescription.value) ?? "") : "",
      cveIds: [cveId.toUpperCase()],
      cvssScore,
      epssScore: null,
      severity: severityFromCvss(cvssScore),
      kev: false,
      kevRansomware: false,
      techniqueIds: [],
      tags: ["nvd"],
      publishedAt: str(cve.published)
        ? new Date(str(cve.published) as string).toISOString()
        : null,
      sourceKey: "nvd",
      externalId: cveId.toUpperCase(),
      sourceUrl: `https://nvd.nist.gov/vuln/detail/${cveId.toUpperCase()}`
    });
  }
  return items;
}

// --- FIRST EPSS: exploit-prediction enrichment (no key) ---------------------
// Emits CVE-keyed items carrying only epssScore; they MERGE into the NVD/KEV
// record for the same CVE rather than creating standalone rows.

function parseEpss(payload: unknown): NormalizedThreatIntelItem[] {
  const root = asRecord(payload);
  if (!root) {
    return [];
  }
  const items: NormalizedThreatIntelItem[] = [];
  for (const entry of asArray(root.data)) {
    const record = asRecord(entry);
    const cveId = record ? str(record.cve) : null;
    const canonicalKey = cveId ? canonicalKeyForCve(cveId) : null;
    const epss = record ? Number(record.epss) : NaN;
    if (!record || !cveId || !canonicalKey || Number.isNaN(epss)) {
      continue;
    }
    items.push({
      kind: "Vulnerability",
      canonicalKey,
      title: cveId.toUpperCase(),
      summary: "",
      cveIds: [cveId.toUpperCase()],
      cvssScore: null,
      epssScore: Math.min(Math.max(epss, 0), 1),
      severity: "Unknown",
      kev: false,
      kevRansomware: false,
      techniqueIds: [],
      tags: ["epss"],
      publishedAt: null,
      sourceKey: "epss",
      externalId: cveId.toUpperCase(),
      sourceUrl: "https://www.first.org/epss/"
    });
  }
  return items;
}

// --- Tor exit nodes: IP reputation (no key) ---------------------------------

function parseTorExit(payload: unknown): NormalizedThreatIntelItem[] {
  const items: NormalizedThreatIntelItem[] = [];
  for (const line of splitLines(payload)) {
    const canonicalKey = canonicalKeyForIoc(line);
    const ioc = detectIoc(line);
    if (!canonicalKey || !ioc || ioc.type !== "ipv4") {
      continue;
    }
    items.push({
      kind: "Indicator",
      canonicalKey,
      title: `Tor exit node ${ioc.value}`,
      summary: "Tor network exit node IP.",
      cveIds: [],
      cvssScore: null,
      epssScore: null,
      severity: "Low",
      kev: false,
      kevRansomware: false,
      iocType: ioc.type,
      iocValue: ioc.value,
      techniqueIds: [],
      tags: ["tor", "exit-node", "anonymizer"],
      publishedAt: null,
      sourceKey: "tor-exit",
      externalId: ioc.value,
      sourceUrl: "https://check.torproject.org/torbulkexitlist"
    });
  }
  return items;
}

// --- OpenPhish: live phishing URLs (community feed, no key) ------------------

function parseOpenPhish(payload: unknown): NormalizedThreatIntelItem[] {
  const items: NormalizedThreatIntelItem[] = [];
  for (const line of splitLines(payload)) {
    const canonicalKey = canonicalKeyForIoc(line);
    const ioc = detectIoc(line);
    if (!canonicalKey || !ioc || ioc.type !== "url") {
      continue;
    }
    items.push({
      kind: "Indicator",
      canonicalKey,
      title: `Phishing URL ${ioc.value.slice(0, 120)}`,
      summary: "Active phishing URL reported by OpenPhish.",
      cveIds: [],
      cvssScore: null,
      epssScore: null,
      severity: "High",
      kev: false,
      kevRansomware: false,
      iocType: ioc.type,
      iocValue: ioc.value,
      techniqueIds: [normalizeTechniqueId("T1566") ?? "T1566"],
      tags: ["openphish", "phishing"],
      publishedAt: null,
      sourceKey: "openphish",
      externalId: ioc.value,
      sourceUrl: "https://openphish.com/"
    });
  }
  return items;
}

// --- abuse.ch ThreatFox: malware IOCs (FREE auth key required) --------------
// We re-detect the IOC type from the value (more robust than trusting the
// feed's ioc_type label), so network IOCs given as "ip:port" key on the IP.

function parseThreatFox(payload: unknown): NormalizedThreatIntelItem[] {
  const root = asRecord(payload);
  if (!root || str(root.query_status) !== "ok") {
    return [];
  }
  const items: NormalizedThreatIntelItem[] = [];
  for (const entry of asArray(root.data)) {
    const record = asRecord(entry);
    if (!record) {
      continue;
    }
    const rawValue = str(record.ioc);
    // ThreatFox returns ip:port for network IOCs; key on the IP.
    const candidate = rawValue ? (rawValue.split(":")[0] ?? rawValue) : null;
    const canonicalKey = candidate ? canonicalKeyForIoc(candidate) : null;
    const ioc = candidate ? detectIoc(candidate) : null;
    if (!rawValue || !candidate || !canonicalKey || !ioc) {
      continue;
    }
    const malware = str(record.malware_printable);
    const externalId = str(record.id);
    items.push({
      kind: "Indicator",
      canonicalKey,
      title: malware
        ? `${malware} IOC ${ioc.value}`
        : `Malware IOC ${ioc.value}`,
      summary: str(record.threat_type_desc) ?? "abuse.ch ThreatFox indicator.",
      cveIds: [],
      cvssScore: null,
      epssScore: null,
      severity: "High",
      kev: false,
      kevRansomware: false,
      iocType: ioc.type,
      iocValue: ioc.value,
      techniqueIds: [],
      tags: [
        "abuse.ch",
        "threatfox",
        ...(malware ? [malware.toLowerCase()] : []),
        ...(str(record.threat_type) ? [str(record.threat_type) as string] : [])
      ],
      publishedAt: str(record.first_seen)
        ? new Date(
            `${str(record.first_seen)?.replace(" ", "T")}Z`
          ).toISOString()
        : null,
      sourceKey: "threatfox",
      externalId: externalId ?? ioc.value,
      sourceUrl: externalId
        ? `https://threatfox.abuse.ch/ioc/${externalId}/`
        : "https://threatfox.abuse.ch/"
    });
  }
  return items;
}

// --- Generic IP-blocklist adapter (plain text, one IP per line, no key) -----

function parseIpList(
  payload: unknown,
  opts: {
    sourceKey: string;
    sourceUrl: string;
    tags: string[];
    titlePrefix: string;
    severity: ThreatSeverity;
  }
): NormalizedThreatIntelItem[] {
  const items: NormalizedThreatIntelItem[] = [];
  for (const line of splitLines(payload)) {
    const token = line.split(/[\s#;,]/u)[0] ?? "";
    const canonicalKey = canonicalKeyForIoc(token);
    const ioc = detectIoc(token);
    if (!canonicalKey || !ioc || (ioc.type !== "ipv4" && ioc.type !== "ipv6")) {
      continue;
    }
    items.push({
      kind: "Indicator",
      canonicalKey,
      title: `${opts.titlePrefix} ${ioc.value}`,
      summary: "",
      cveIds: [],
      cvssScore: null,
      epssScore: null,
      severity: opts.severity,
      kev: false,
      kevRansomware: false,
      iocType: ioc.type,
      iocValue: ioc.value,
      techniqueIds: [],
      tags: opts.tags,
      publishedAt: null,
      sourceKey: opts.sourceKey,
      externalId: ioc.value,
      sourceUrl: opts.sourceUrl
    });
  }
  return items;
}

// --- abuse.ch Feodo Tracker: botnet C2 IPs (public JSON, no key) ------------

function parseFeodo(payload: unknown): NormalizedThreatIntelItem[] {
  const items: NormalizedThreatIntelItem[] = [];
  for (const entry of asArray(payload)) {
    const record = asRecord(entry);
    const ip = record ? str(record.ip_address) : null;
    const canonicalKey = ip ? canonicalKeyForIoc(ip) : null;
    const ioc = ip ? detectIoc(ip) : null;
    if (!record || !ip || !canonicalKey || !ioc) {
      continue;
    }
    const malware = str(record.malware);
    items.push({
      kind: "Indicator",
      canonicalKey,
      title: `${malware ?? "Botnet"} C2 ${ioc.value}`,
      summary: "abuse.ch Feodo Tracker botnet C2 server.",
      cveIds: [],
      cvssScore: null,
      epssScore: null,
      severity: "High",
      kev: false,
      kevRansomware: false,
      iocType: ioc.type,
      iocValue: ioc.value,
      techniqueIds: [],
      tags: [
        "abuse.ch",
        "feodo",
        "c2",
        ...(malware ? [malware.toLowerCase()] : [])
      ],
      publishedAt: str(record.first_seen)
        ? new Date(
            `${str(record.first_seen)?.replace(" ", "T")}Z`
          ).toISOString()
        : null,
      sourceKey: "feodo",
      externalId: ioc.value,
      sourceUrl: "https://feodotracker.abuse.ch/"
    });
  }
  return items;
}

// --- abuse.ch URLhaus: malware-distribution URLs (FREE auth key) ------------

function parseUrlhaus(payload: unknown): NormalizedThreatIntelItem[] {
  const root = asRecord(payload);
  if (!root || str(root.query_status) !== "ok") {
    return [];
  }
  const items: NormalizedThreatIntelItem[] = [];
  for (const entry of asArray(root.urls)) {
    const record = asRecord(entry);
    const url = record ? str(record.url) : null;
    const canonicalKey = url ? canonicalKeyForIoc(url) : null;
    const ioc = url ? detectIoc(url) : null;
    if (!record || !url || !canonicalKey || !ioc) {
      continue;
    }
    const threat = str(record.threat);
    const tags = asArray(record.tags)
      .map((t) => (typeof t === "string" ? t.toLowerCase() : null))
      .filter((t): t is string => Boolean(t));
    items.push({
      kind: "Indicator",
      canonicalKey,
      title: `Malware URL ${ioc.value.slice(0, 120)}`,
      summary: threat ?? "abuse.ch URLhaus malware-distribution URL.",
      cveIds: [],
      cvssScore: null,
      epssScore: null,
      severity: "High",
      kev: false,
      kevRansomware: false,
      iocType: ioc.type,
      iocValue: ioc.value,
      techniqueIds: [],
      tags: ["abuse.ch", "urlhaus", ...(threat ? [threat] : []), ...tags],
      publishedAt: str(record.date_added)
        ? new Date(
            `${str(record.date_added)?.replace(" ", "T")}Z`
          ).toISOString()
        : null,
      sourceKey: "urlhaus",
      externalId: str(record.id) ?? ioc.value,
      sourceUrl: "https://urlhaus.abuse.ch/"
    });
  }
  return items;
}

// --- abuse.ch MalwareBazaar: recent malware sample hashes (FREE auth key) ---

function parseMalwareBazaar(payload: unknown): NormalizedThreatIntelItem[] {
  const root = asRecord(payload);
  if (!root || str(root.query_status) !== "ok") {
    return [];
  }
  const items: NormalizedThreatIntelItem[] = [];
  for (const entry of asArray(root.data)) {
    const record = asRecord(entry);
    const hash =
      (record ? str(record.sha256_hash) : null) ??
      (record ? str(record.sha1_hash) : null) ??
      (record ? str(record.md5_hash) : null);
    const canonicalKey = hash ? canonicalKeyForIoc(hash) : null;
    const ioc = hash ? detectIoc(hash) : null;
    if (!record || !hash || !canonicalKey || !ioc) {
      continue;
    }
    const signature = str(record.signature);
    const fileType = str(record.file_type);
    items.push({
      kind: "Indicator",
      canonicalKey,
      title: `${signature ?? "Malware"} sample ${ioc.value.slice(0, 16)}…`,
      summary: `abuse.ch MalwareBazaar sample${fileType ? ` (${fileType})` : ""}.`,
      cveIds: [],
      cvssScore: null,
      epssScore: null,
      severity: "High",
      kev: false,
      kevRansomware: false,
      iocType: ioc.type,
      iocValue: ioc.value,
      techniqueIds: [],
      tags: [
        "abuse.ch",
        "malwarebazaar",
        ...(signature ? [signature.toLowerCase()] : [])
      ],
      publishedAt: str(record.first_seen)
        ? new Date(
            `${str(record.first_seen)?.replace(" ", "T")}Z`
          ).toISOString()
        : null,
      sourceKey: "malwarebazaar",
      externalId: ioc.value,
      sourceUrl: `https://bazaar.abuse.ch/sample/${ioc.value}/`
    });
  }
  return items;
}

// --- AlienVault OTX: subscribed pulses -> indicators (FREE key) -------------

function parseOtx(payload: unknown): NormalizedThreatIntelItem[] {
  const root = asRecord(payload);
  if (!root) {
    return [];
  }
  const items: NormalizedThreatIntelItem[] = [];
  for (const pulseEntry of asArray(root.results)) {
    const pulse = asRecord(pulseEntry);
    if (!pulse) {
      continue;
    }
    const pulseName = str(pulse.name) ?? "OTX pulse";
    const created = str(pulse.created);
    for (const indicatorEntry of asArray(pulse.indicators)) {
      const indicator = asRecord(indicatorEntry);
      const value = indicator ? str(indicator.indicator) : null;
      const canonicalKey = value ? canonicalKeyForIoc(value) : null;
      const ioc = value ? detectIoc(value) : null;
      if (!indicator || !value || !canonicalKey || !ioc) {
        continue;
      }
      items.push({
        kind: "Indicator",
        canonicalKey,
        title: `${pulseName}: ${ioc.value.slice(0, 100)}`,
        summary: str(pulse.description) ?? "AlienVault OTX pulse indicator.",
        cveIds: [],
        cvssScore: null,
        epssScore: null,
        severity: "Medium",
        kev: false,
        kevRansomware: false,
        iocType: ioc.type,
        iocValue: ioc.value,
        techniqueIds: [],
        tags: ["otx", "alienvault"],
        publishedAt: created ? new Date(created).toISOString() : null,
        sourceKey: "otx",
        externalId: str(indicator.id) ?? ioc.value,
        sourceUrl: "https://otx.alienvault.com/"
      });
    }
  }
  return items;
}

// --- CISA cybersecurity advisories RSS (no key, lightweight XML parse) ------

function parseCisaAdvisories(payload: unknown): NormalizedThreatIntelItem[] {
  if (typeof payload !== "string") {
    return [];
  }
  const items: NormalizedThreatIntelItem[] = [];
  const itemBlocks = payload.match(/<item\b[\s\S]*?<\/item>/giu) ?? [];
  for (const block of itemBlocks) {
    const pick = (tag: string): string | null => {
      const match = block.match(
        new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "iu")
      );
      if (!match) {
        return null;
      }
      return match[1]!
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/giu, "$1")
        .replace(/<[^>]+>/gu, " ")
        .replace(/\s+/gu, " ")
        .trim();
    };
    const title = pick("title");
    const link = pick("link") ?? pick("guid");
    if (!title || !link) {
      continue;
    }
    const description = pick("description") ?? "";
    const cves = [
      ...new Set(
        (`${title} ${description}`.match(/CVE-\d{4}-\d{4,}/giu) ?? []).map(
          (c) => c.toUpperCase()
        )
      )
    ];
    const pubDate = pick("pubDate");
    let publishedAt: string | null = null;
    if (pubDate) {
      const parsed = new Date(pubDate);
      publishedAt = Number.isNaN(parsed.getTime())
        ? null
        : parsed.toISOString();
    }
    items.push({
      kind: "Advisory",
      canonicalKey: `advisory:cisa-advisories:${link}`,
      title,
      summary: description.slice(0, 500),
      cveIds: cves,
      cvssScore: null,
      epssScore: null,
      severity: "Unknown",
      kev: false,
      kevRansomware: false,
      techniqueIds: [],
      tags: ["cisa", "advisory"],
      publishedAt,
      sourceKey: "cisa-advisories",
      externalId: link,
      sourceUrl: link
    });
  }
  return items;
}

export const THREAT_FEED_DEFINITIONS: ThreatFeedDefinition[] = [
  {
    sourceKey: "cisa-kev",
    name: "CISA Known Exploited Vulnerabilities",
    category: "Exploited",
    description:
      "US CISA catalog of vulnerabilities with confirmed active exploitation.",
    homepageUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    cadenceMinutes: 60,
    keyEnvVar: null,
    keyRequired: false,
    license: "US Government work / public domain",
    buildRequest: () => ({
      method: "GET",
      url: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
      responseType: "json"
    }),
    parse: parseCisaKev
  },
  {
    sourceKey: "nvd",
    name: "NVD CVE 2.0",
    category: "Vulnerability",
    description:
      "NIST National Vulnerability Database — full CVE catalog + CVSS.",
    homepageUrl: "https://nvd.nist.gov/",
    cadenceMinutes: 60,
    keyEnvVar: "PERISCAN_NVD_API_KEY",
    keyRequired: false,
    license: "US Government work / public domain (API key optional, free)",
    buildRequest: (apiKey) => ({
      method: "GET",
      url: "https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=200",
      headers: apiKey ? { apiKey } : undefined,
      responseType: "json"
    }),
    parse: parseNvd
  },
  {
    sourceKey: "epss",
    name: "FIRST EPSS",
    category: "Vulnerability",
    description:
      "Exploit Prediction Scoring System — per-CVE exploitation probability.",
    homepageUrl: "https://www.first.org/epss/",
    cadenceMinutes: 1440,
    keyEnvVar: null,
    keyRequired: false,
    license: "FIRST EPSS — free for any use with attribution",
    buildRequest: () => ({
      method: "GET",
      url: "https://api.first.org/data/v1/epss?limit=200&order=!epss",
      responseType: "json"
    }),
    parse: parseEpss
  },
  {
    sourceKey: "tor-exit",
    name: "Tor Exit Node List",
    category: "IpReputation",
    description: "Current Tor network exit-node IPs.",
    homepageUrl: "https://check.torproject.org/torbulkexitlist",
    cadenceMinutes: 30,
    keyEnvVar: null,
    keyRequired: false,
    license: "Tor Project — public list",
    buildRequest: () => ({
      method: "GET",
      url: "https://check.torproject.org/torbulkexitlist",
      responseType: "text"
    }),
    parse: parseTorExit
  },
  {
    sourceKey: "openphish",
    name: "OpenPhish Community Feed",
    category: "Phishing",
    description: "Live phishing URLs (OpenPhish community feed).",
    homepageUrl: "https://openphish.com/",
    cadenceMinutes: 15,
    keyEnvVar: null,
    keyRequired: false,
    license: "OpenPhish community feed — free for non-commercial/eval use",
    buildRequest: () => ({
      method: "GET",
      url: "https://openphish.com/feed.txt",
      responseType: "text"
    }),
    parse: parseOpenPhish
  },
  {
    sourceKey: "threatfox",
    name: "abuse.ch ThreatFox",
    category: "Malware",
    description: "Malware/botnet IOCs from abuse.ch ThreatFox.",
    homepageUrl: "https://threatfox.abuse.ch/",
    cadenceMinutes: 15,
    keyEnvVar: "PERISCAN_ABUSE_CH_AUTH_KEY",
    keyRequired: true,
    license: "abuse.ch — free with a (free) Auth-Key; CC0 data",
    buildRequest: (apiKey) => ({
      method: "POST",
      url: "https://threatfox-api.abuse.ch/api/v1/",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "Auth-Key": apiKey } : {})
      },
      body: JSON.stringify({ query: "get_iocs", days: 1 }),
      responseType: "json"
    }),
    parse: parseThreatFox
  },
  {
    sourceKey: "feodo",
    name: "abuse.ch Feodo Tracker",
    category: "Malware",
    description: "Active botnet C2 server IPs (Dridex/Emotet/QakBot/etc).",
    homepageUrl: "https://feodotracker.abuse.ch/",
    cadenceMinutes: 60,
    keyEnvVar: null,
    keyRequired: false,
    license: "abuse.ch — CC0 public blocklist",
    buildRequest: () => ({
      method: "GET",
      url: "https://feodotracker.abuse.ch/downloads/ipblocklist.json",
      responseType: "json"
    }),
    parse: parseFeodo
  },
  {
    sourceKey: "urlhaus",
    name: "abuse.ch URLhaus",
    category: "Malware",
    description: "Malware-distribution URLs from abuse.ch URLhaus.",
    homepageUrl: "https://urlhaus.abuse.ch/",
    cadenceMinutes: 15,
    keyEnvVar: "PERISCAN_ABUSE_CH_AUTH_KEY",
    keyRequired: true,
    license: "abuse.ch — free with a (free) Auth-Key; CC0 data",
    buildRequest: (apiKey) => ({
      method: "GET",
      url: "https://urlhaus-api.abuse.ch/v1/urls/recent/",
      headers: apiKey ? { "Auth-Key": apiKey } : undefined,
      responseType: "json"
    }),
    parse: parseUrlhaus
  },
  {
    sourceKey: "malwarebazaar",
    name: "abuse.ch MalwareBazaar",
    category: "Malware",
    description: "Recent malware sample hashes from abuse.ch MalwareBazaar.",
    homepageUrl: "https://bazaar.abuse.ch/",
    cadenceMinutes: 60,
    keyEnvVar: "PERISCAN_ABUSE_CH_AUTH_KEY",
    keyRequired: true,
    license: "abuse.ch — free with a (free) Auth-Key; CC0 data",
    buildRequest: (apiKey) => ({
      method: "POST",
      url: "https://mb-api.abuse.ch/api/v1/",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        ...(apiKey ? { "Auth-Key": apiKey } : {})
      },
      body: "query=get_recent&selector=time",
      responseType: "json"
    }),
    parse: parseMalwareBazaar
  },
  {
    sourceKey: "otx",
    name: "AlienVault OTX",
    category: "Malware",
    description: "Open Threat Exchange subscribed-pulse indicators.",
    homepageUrl: "https://otx.alienvault.com/",
    cadenceMinutes: 60,
    keyEnvVar: "PERISCAN_OTX_API_KEY",
    keyRequired: true,
    license: "AlienVault OTX — free with a (free) API key",
    buildRequest: (apiKey) => ({
      method: "GET",
      url: "https://otx.alienvault.com/api/v1/pulses/subscribed?limit=50",
      headers: apiKey ? { "X-OTX-API-KEY": apiKey } : undefined,
      responseType: "json"
    }),
    parse: parseOtx
  },
  {
    sourceKey: "emergingthreats-compromised",
    name: "Emerging Threats Compromised IPs",
    category: "IpReputation",
    description: "Proofpoint Emerging Threats compromised-host IP list.",
    homepageUrl: "https://rules.emergingthreats.net/",
    cadenceMinutes: 60,
    keyEnvVar: null,
    keyRequired: false,
    license: "Proofpoint Emerging Threats — open ruleset",
    buildRequest: () => ({
      method: "GET",
      url: "https://rules.emergingthreats.net/blockrules/compromised-ips.txt",
      responseType: "text"
    }),
    parse: (payload) =>
      parseIpList(payload, {
        sourceKey: "emergingthreats-compromised",
        sourceUrl:
          "https://rules.emergingthreats.net/blockrules/compromised-ips.txt",
        tags: ["emerging-threats", "compromised"],
        titlePrefix: "Compromised host",
        severity: "Medium"
      })
  },
  {
    sourceKey: "blocklist-de",
    name: "blocklist.de Attackers",
    category: "IpReputation",
    description: "IPs reported to blocklist.de for attacks/abuse.",
    homepageUrl: "https://www.blocklist.de/",
    cadenceMinutes: 60,
    keyEnvVar: null,
    keyRequired: false,
    license: "blocklist.de — free attacker IP list",
    buildRequest: () => ({
      method: "GET",
      url: "https://lists.blocklist.de/lists/all.txt",
      responseType: "text"
    }),
    parse: (payload) =>
      parseIpList(payload, {
        sourceKey: "blocklist-de",
        sourceUrl: "https://lists.blocklist.de/lists/all.txt",
        tags: ["blocklist.de", "attacker"],
        titlePrefix: "Reported attacker",
        severity: "Low"
      })
  },
  {
    sourceKey: "cisa-advisories",
    name: "CISA Cybersecurity Advisories",
    category: "Advisory",
    description: "US CISA cybersecurity advisories (RSS).",
    homepageUrl: "https://www.cisa.gov/news-events/cybersecurity-advisories",
    cadenceMinutes: 60,
    keyEnvVar: null,
    keyRequired: false,
    license: "US Government work / public domain",
    buildRequest: () => ({
      method: "GET",
      url: "https://www.cisa.gov/cybersecurity-advisories/all.xml",
      responseType: "text"
    }),
    parse: parseCisaAdvisories
  }
];

export function listThreatFeeds(): ThreatFeedDefinition[] {
  return THREAT_FEED_DEFINITIONS;
}

export function getThreatFeed(sourceKey: string): ThreatFeedDefinition | null {
  return (
    THREAT_FEED_DEFINITIONS.find((feed) => feed.sourceKey === sourceKey) ?? null
  );
}
