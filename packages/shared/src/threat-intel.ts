import { z } from "zod";

/**
 * Global threat-intelligence catalog ("super feed") shared contracts + the pure,
 * deterministic dedup logic.
 *
 * World threat data (CVEs, IOCs, advisories) is identical for every tenant, so
 * it is ingested ONCE into a global catalog and deduped across all feeds by a
 * stable `canonicalKey`. The canonical-key derivation and the cross-feed MERGE
 * are pure functions here so they are unit-testable without a DB and shared by
 * the worker poller, the ingestion service, and the API.
 */

export const ThreatIntelKindSchema = z.enum([
  "Vulnerability",
  "Indicator",
  "Advisory"
]);
export type ThreatIntelKind = z.infer<typeof ThreatIntelKindSchema>;

// Indicator-of-compromise value types we normalize + key on.
export const IocTypeSchema = z.enum([
  "ipv4",
  "ipv6",
  "domain",
  "url",
  "md5",
  "sha1",
  "sha256",
  "email"
]);
export type IocType = z.infer<typeof IocTypeSchema>;

export const ThreatSeveritySchema = z.enum([
  "Critical",
  "High",
  "Medium",
  "Low",
  "None",
  "Unknown"
]);
export type ThreatSeverity = z.infer<typeof ThreatSeveritySchema>;

const SEVERITY_RANK: Record<ThreatSeverity, number> = {
  Critical: 5,
  High: 4,
  Medium: 3,
  Low: 2,
  None: 1,
  Unknown: 0
};

const CVE_PATTERN = /^CVE-\d{4}-\d{4,}$/u;
const TECHNIQUE_PATTERN = /^T\d{4}(?:\.\d{3})?$/u;
const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/u;
const MD5_PATTERN = /^[a-f0-9]{32}$/u;
const SHA1_PATTERN = /^[a-f0-9]{40}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const DOMAIN_PATTERN =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/u;
const EMAIL_PATTERN = /^[^\s@]+@(?:[a-z0-9-]+\.)+[a-z]{2,}$/u;

/** Uppercase + validate a CVE id, or null if it is not a well-formed CVE. */
export function normalizeCveId(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return CVE_PATTERN.test(normalized) ? normalized : null;
}

/** Uppercase + validate a MITRE ATT&CK technique id, or null. */
export function normalizeTechniqueId(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  return TECHNIQUE_PATTERN.test(normalized) ? normalized : null;
}

function isIpv6(value: string): boolean {
  // Pragmatic IPv6 check: hex groups + at least one colon, optional :: compression.
  if (!value.includes(":")) {
    return false;
  }
  return /^[0-9a-f:]+$/u.test(value) && (value.match(/:/gu)?.length ?? 0) >= 2;
}

/**
 * Detect the IOC type of a raw value and return it in its canonical form
 * (lowercased for hashes/domains/urls/emails; IPs left as written). Returns null
 * for anything we don't recognize as a usable indicator. Trailing punctuation
 * that commonly clings to extracted indicators is stripped.
 */
export function detectIoc(
  raw: string
): { type: IocType; value: string } | null {
  const trimmed = raw.trim().replace(/[).,;\]}>]+$/u, "");
  if (trimmed.length === 0) {
    return null;
  }
  const lower = trimmed.toLowerCase();

  if (/^https?:\/\//u.test(lower)) {
    return { type: "url", value: lower };
  }
  if (MD5_PATTERN.test(lower)) {
    return { type: "md5", value: lower };
  }
  if (SHA1_PATTERN.test(lower)) {
    return { type: "sha1", value: lower };
  }
  if (SHA256_PATTERN.test(lower)) {
    return { type: "sha256", value: lower };
  }
  if (EMAIL_PATTERN.test(lower)) {
    return { type: "email", value: lower };
  }
  if (IPV4_PATTERN.test(trimmed)) {
    const octets = trimmed.split(".").map((part) => Number(part));
    if (
      octets.every(
        (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255
      )
    ) {
      return { type: "ipv4", value: trimmed };
    }
    return null;
  }
  if (isIpv6(lower)) {
    return { type: "ipv6", value: lower };
  }
  if (DOMAIN_PATTERN.test(lower)) {
    return { type: "domain", value: lower };
  }
  return null;
}

/** Map a CVSS base score (0-10) to a normalized severity band (CVSS v3 cutoffs). */
export function severityFromCvss(
  score: number | null | undefined
): ThreatSeverity {
  if (score == null || Number.isNaN(score)) {
    return "Unknown";
  }
  if (score >= 9) {
    return "Critical";
  }
  if (score >= 7) {
    return "High";
  }
  if (score >= 4) {
    return "Medium";
  }
  if (score > 0) {
    return "Low";
  }
  return "None";
}

/** Coerce an arbitrary severity label into the normalized band. */
export function normalizeSeverity(
  value: string | null | undefined
): ThreatSeverity {
  if (!value) {
    return "Unknown";
  }
  const lower = value.trim().toLowerCase();
  switch (lower) {
    case "critical":
      return "Critical";
    case "high":
    case "important":
      return "High";
    case "medium":
    case "moderate":
      return "Medium";
    case "low":
      return "Low";
    case "none":
    case "informational":
    case "info":
      return "None";
    default:
      return "Unknown";
  }
}

/** Pick the higher-risk of two severities. */
export function maxSeverity(
  a: ThreatSeverity,
  b: ThreatSeverity
): ThreatSeverity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

// --- Attack-surface matching helpers (correlation) --------------------------

/**
 * The registrable-domain suffixes of a hostname, from the full host down to its
 * two-label apex (the TLD-only suffix is excluded so a fresh subdomain can match
 * a verified parent domain without a bare-TLD false positive). Used to alert
 * when a malicious `login.acme.com` lands on a feed and `acme.com` is a verified
 * scope. e.g. "a.b.acme.com" -> ["a.b.acme.com","b.acme.com","acme.com"].
 */
export function parentDomainSuffixes(host: string): string[] {
  const labels = host.trim().toLowerCase().replace(/\.+$/u, "").split(".");
  if (labels.length < 2) {
    return [];
  }
  const suffixes: string[] = [];
  for (let i = 0; i <= labels.length - 2; i += 1) {
    suffixes.push(labels.slice(i).join("."));
  }
  return suffixes;
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.trim().split(".");
  if (parts.length !== 4) {
    return null;
  }
  let value = 0;
  for (const part of parts) {
    const octet = Number(part);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) {
      return null;
    }
    value = value * 256 + octet;
  }
  return value >>> 0;
}

/**
 * Whether an IPv4 address falls inside a CIDR range (e.g. `10.0.0.5` in
 * `10.0.0.0/24`). Used to alert when a malicious IP lands on a feed and it sits
 * inside one of the tenant's verified IPRange scopes. Returns false for any
 * malformed input — never throws.
 */
export function ipv4InCidr(ip: string, cidr: string): boolean {
  const [network, bitsRaw] = cidr.trim().split("/");
  if (!network || bitsRaw === undefined) {
    return false;
  }
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }
  const ipInt = ipv4ToInt(ip);
  const netInt = ipv4ToInt(network);
  if (ipInt === null || netInt === null) {
    return false;
  }
  if (bits === 0) {
    return true;
  }
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (netInt & mask);
}

// --- Canonical keys (the cross-feed dedup identity) -------------------------

/** `cve:CVE-2026-1234` — null if not a valid CVE id. */
export function canonicalKeyForCve(cveId: string): string | null {
  const normalized = normalizeCveId(cveId);
  return normalized ? `cve:${normalized}` : null;
}

/** `ioc:<type>:<value>` — null if the value is not a recognized indicator. */
export function canonicalKeyForIoc(raw: string): string | null {
  const ioc = detectIoc(raw);
  return ioc ? `ioc:${ioc.type}:${ioc.value}` : null;
}

/**
 * `advisory:<sourceKey>:<externalId>` — advisories are source-specific (their
 * shared CVEs/IOCs dedup at the vulnerability/indicator level instead).
 */
export function canonicalKeyForAdvisory(
  sourceKey: string,
  externalId: string
): string {
  return `advisory:${sourceKey.trim().toLowerCase()}:${externalId.trim()}`;
}

// --- Normalized item: the shape every feed adapter emits --------------------

export const NormalizedThreatIntelItemSchema = z.object({
  kind: ThreatIntelKindSchema,
  canonicalKey: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().default(""),
  cveIds: z.array(z.string()).default([]),
  cvssScore: z.number().min(0).max(10).nullish(),
  epssScore: z.number().min(0).max(1).nullish(),
  severity: ThreatSeveritySchema.default("Unknown"),
  kev: z.boolean().default(false),
  kevRansomware: z.boolean().default(false),
  iocType: IocTypeSchema.nullish(),
  iocValue: z.string().nullish(),
  techniqueIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  publishedAt: z.string().datetime().nullish(),
  // Provenance: which feed reported this, and its native id/url there.
  sourceKey: z.string().min(1),
  externalId: z.string().nullish(),
  sourceUrl: z.string().nullish()
});
export type NormalizedThreatIntelItem = z.infer<
  typeof NormalizedThreatIntelItemSchema
>;

/** Catalog fields that participate in the cross-feed merge. */
export interface MergeableThreatIntelFields {
  title: string;
  summary: string;
  cveIds: string[];
  cvssScore: number | null;
  epssScore: number | null;
  severity: ThreatSeverity;
  kev: boolean;
  kevRansomware: boolean;
  techniqueIds: string[];
  tags: string[];
  publishedAt: string | null;
}

function unionSorted(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])].filter((value) => value.length > 0).sort();
}

function maxNullable(
  a: number | null | undefined,
  b: number | null | undefined
): number | null {
  const values = [a, b].filter(
    (value): value is number =>
      typeof value === "number" && !Number.isNaN(value)
  );
  return values.length > 0 ? Math.max(...values) : null;
}

/**
 * Merge a freshly-reported item into the existing canonical record. Pure +
 * deterministic: unions indicator arrays, takes the WORST severity / highest
 * scores (a control gap is never downgraded by a later, blander report), ORs
 * the KEV flags, keeps the earliest known publish date, and fills an empty
 * title/summary. The caller owns firstSeenAt(min)/lastSeenAt(max)/sourceCount.
 */
export function mergeThreatIntelFields(
  existing: MergeableThreatIntelFields,
  incoming: Partial<MergeableThreatIntelFields>
): MergeableThreatIntelFields {
  const earliestPublish = (): string | null => {
    const a = existing.publishedAt;
    const b = incoming.publishedAt ?? null;
    if (a && b) {
      return new Date(a).getTime() <= new Date(b).getTime() ? a : b;
    }
    return a ?? b ?? null;
  };

  return {
    title:
      existing.title.trim().length > 0
        ? existing.title
        : (incoming.title ?? existing.title),
    summary:
      existing.summary.trim().length > 0
        ? existing.summary
        : (incoming.summary ?? existing.summary),
    cveIds: unionSorted(existing.cveIds, incoming.cveIds ?? []),
    cvssScore: maxNullable(existing.cvssScore, incoming.cvssScore),
    epssScore: maxNullable(existing.epssScore, incoming.epssScore),
    severity: maxSeverity(existing.severity, incoming.severity ?? "Unknown"),
    kev: existing.kev || (incoming.kev ?? false),
    kevRansomware: existing.kevRansomware || (incoming.kevRansomware ?? false),
    techniqueIds: unionSorted(
      existing.techniqueIds,
      incoming.techniqueIds ?? []
    ),
    tags: unionSorted(existing.tags, incoming.tags ?? []),
    publishedAt: earliestPublish()
  };
}

// --- Serialized catalog item (API / DTO shape) ------------------------------

export const ThreatIntelItemSchema = z.object({
  threatIntelItemId: z.string().uuid(),
  kind: ThreatIntelKindSchema,
  canonicalKey: z.string(),
  title: z.string(),
  summary: z.string(),
  cveIds: z.array(z.string()),
  cvssScore: z.number().nullable(),
  epssScore: z.number().nullable(),
  severity: ThreatSeveritySchema.nullable(),
  kev: z.boolean(),
  kevRansomware: z.boolean(),
  iocType: IocTypeSchema.nullable(),
  iocValue: z.string().nullable(),
  techniqueIds: z.array(z.string()),
  tags: z.array(z.string()),
  sourceCount: z.number().int().nonnegative(),
  sources: z.array(z.string()).default([]),
  publishedAt: z.string().nullable(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string()
});
export type ThreatIntelItem = z.infer<typeof ThreatIntelItemSchema>;

// --- Feed health (per-source poll status for the API/UI) --------------------

export const ThreatFeedStatusSchema = z.object({
  sourceKey: z.string(),
  name: z.string(),
  category: z.string(),
  description: z.string(),
  cadenceMinutes: z.number().int().positive(),
  keyRequired: z.boolean(),
  /** Whether the (free) API key env var is set for a key-gated feed. */
  keyConfigured: z.boolean(),
  enabled: z.boolean(),
  lastPolledAt: z.string().nullable(),
  nextPollAt: z.string().nullable(),
  lastStatus: z.string().nullable(),
  lastError: z.string().nullable(),
  lastItemCount: z.number().int().nonnegative(),
  lastNewCount: z.number().int().nonnegative(),
  consecutiveErrors: z.number().int().nonnegative()
});
export type ThreatFeedStatus = z.infer<typeof ThreatFeedStatusSchema>;

// --- Per-tenant realtime alert (DTO) ----------------------------------------

export const TenantThreatAlertStatusSchema = z.enum([
  "New",
  "Acknowledged",
  "Dismissed"
]);
export type TenantThreatAlertStatus = z.infer<
  typeof TenantThreatAlertStatusSchema
>;

export const TenantThreatAlertSchema = z.object({
  tenantThreatAlertId: z.string().uuid(),
  threatIntelItemId: z.string().uuid(),
  matchType: z.string(),
  matchedValue: z.string(),
  matchedScopeId: z.string().uuid().nullable(),
  severity: z.string().nullable(),
  status: TenantThreatAlertStatusSchema,
  createdAt: z.string(),
  /** The correlated catalog item, embedded for context. */
  item: ThreatIntelItemSchema
});
export type TenantThreatAlert = z.infer<typeof TenantThreatAlertSchema>;

export const ThreatCatalogQuerySchema = z.object({
  kind: ThreatIntelKindSchema.optional(),
  severity: ThreatSeveritySchema.optional(),
  kev: z.boolean().optional(),
  q: z.string().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(200).optional()
});
export type ThreatCatalogQuery = z.infer<typeof ThreatCatalogQuerySchema>;

export const SetThreatAlertStatusInputSchema = z.object({
  status: TenantThreatAlertStatusSchema
});
export type SetThreatAlertStatusInput = z.infer<
  typeof SetThreatAlertStatusInputSchema
>;
