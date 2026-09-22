import { z } from "zod";

import {
  DETECTION_CORRELATION_MARKER_PATTERN,
  correlateDetectionObservation,
  type DetectionCorrelationEvent,
  type DetectionCorrelationEventOutcome,
  type DetectionCorrelationInject,
  type DetectionCorrelationObservation,
  type DetectionCorrelationObserver,
  type DetectionCorrelationResult
} from "./detection-correlation";

/**
 * OpenAEV-style SIEM/EDR/XDR collector normalize (PERISCAN-590).
 *
 * After inject, map vendor JSON (Splunk ES, Elastic Security, CrowdStrike
 * Falcon Alerts v2) onto correlation events. No vendor I/O. Empty JSON is
 * 0 detections. Unmatched rows are not upgraded to detections.
 */

export const COLLECTOR_NORMALIZE_LAW =
  "After inject, normalize Splunk ES, Elastic Security, and CrowdStrike Falcon Alerts v2 JSON into correlation events. Empty JSON is 0 detections. This module does not invent detections from unmatched or health-only telemetry. Stale, missing, or unhealthy observers are Inconclusive, never Missed. Collectors do not call vendor APIs.";

export const CollectorVendorSchema = z.enum([
  "splunk",
  "elastic",
  "crowdstrike"
]);
export type CollectorVendor = z.infer<typeof CollectorVendorSchema>;

export const CollectorPlatformSchema = z.enum(["SIEM", "EDR", "XDR"]);
export type CollectorPlatform = z.infer<typeof CollectorPlatformSchema>;

export const COLLECTOR_PLATFORM_BY_VENDOR: Record<
  CollectorVendor,
  CollectorPlatform
> = {
  splunk: "SIEM",
  elastic: "SIEM",
  crowdstrike: "EDR"
};

/**
 * CrowdStrike Falcon pattern_disposition prevent bits used by OpenAEV.
 * Reference: Falcon events data dictionary + OpenAEV collectors/crowdstrike.
 */
const CROWDSTRIKE_PREVENT_BITS =
  16 | 128 | 512 | 1024 | 2048 | 4096 | 32768 | 65536 | 1048576 | 524288;
const CROWDSTRIKE_MODIFY_BITS =
  256 | 8192 | 16384 | 131072 | 262144 | 2097152 | 4194304;

const BLOCK_TOKEN = /^(blocked?|prevent(ed|ion)?|denied|deny|quarantined?)$/iu;
const LOG_TOKEN = /^(log(ged)?|informational|info|syslog)$/iu;
const ALERT_TOKEN = /^(alert(ed)?|notable|detect(ed|ion)?)$/iu;
const EXEC_EXT = /\.(exe|dll|bin|cmd|bat|ps1|sh|so|dylib|app)$/iu;
const MARKER_FIND = /periscan-[A-Za-z0-9._:-]{4,120}/gu;

export type CollectorNormalizeResult = {
  detectionCount: number;
  events: DetectionCorrelationEvent[];
  platform: CollectorPlatform;
  skipped: number;
  vendor: CollectorVendor;
};

export type CollectorObservationInput = {
  inject: DetectionCorrelationInject;
  observation: DetectionCorrelationObservation;
  observer: DetectionCorrelationObserver | null;
  payload: unknown;
  vendor: CollectorVendor;
};

export type CollectorObservationResult = DetectionCorrelationResult & {
  detectionCount: number;
  platform: CollectorPlatform;
  skipped: number;
  vendor: CollectorVendor;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function parseJsonPayload(payload: unknown): unknown {
  if (payload == null) {
    return {};
  }
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) {
      return {};
    }
    try {
      return JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  return payload;
}

function dig(source: Record<string, unknown>, path: string): unknown {
  if (Object.prototype.hasOwnProperty.call(source, path)) {
    return source[path];
  }
  let current: unknown = source;
  for (const part of path.split(".")) {
    const rec = asRecord(current);
    if (!rec || !Object.prototype.hasOwnProperty.call(rec, part)) {
      return undefined;
    }
    current = rec[part];
  }
  return current;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (Array.isArray(value) && value.length > 0) {
    return asNonEmptyString(value[0]);
  }
  return null;
}

function firstString(
  source: Record<string, unknown>,
  paths: readonly string[]
): string | null {
  for (const path of paths) {
    const text = asNonEmptyString(dig(source, path));
    if (text) {
      return text;
    }
  }
  return null;
}

function toIso(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d+(\.\d+)?$/u.test(trimmed)) {
    return toIso(Number(trimmed));
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function canonicalizeMarker(token: string): string | null {
  const stripped = token.replace(EXEC_EXT, "");
  if (DETECTION_CORRELATION_MARKER_PATTERN.test(stripped)) {
    return stripped;
  }
  if (DETECTION_CORRELATION_MARKER_PATTERN.test(token)) {
    return token;
  }
  return null;
}

function extractMarkers(text: string): string[] {
  const found = new Set<string>();
  const re = new RegExp(MARKER_FIND.source, "gu");
  let match: RegExpExecArray | null = re.exec(text);
  while (match) {
    const token = canonicalizeMarker(match[0]);
    if (token) {
      found.add(token);
    }
    match = re.exec(text);
  }
  return [...found];
}

function haystackFor(row: Record<string, unknown>): string {
  try {
    return JSON.stringify(row);
  } catch {
    return "";
  }
}

function pickMarker(row: Record<string, unknown>): string | null {
  const markers = extractMarkers(haystackFor(row));
  return markers.length === 1 ? markers[0]! : null;
}

function isBlockToken(value: string | null): boolean {
  return value != null && BLOCK_TOKEN.test(value.trim());
}

function isLogToken(value: string | null): boolean {
  return value != null && LOG_TOKEN.test(value.trim());
}

function isAlertToken(value: string | null): boolean {
  return value != null && ALERT_TOKEN.test(value.trim());
}

function isCrowdStrikePrevented(disposition: unknown): boolean {
  const bits =
    typeof disposition === "number"
      ? disposition
      : typeof disposition === "string" && /^\d+$/u.test(disposition)
        ? Number(disposition)
        : null;
  if (bits == null || !Number.isFinite(bits)) {
    return false;
  }
  return (
    (bits & CROWDSTRIKE_PREVENT_BITS) > 0 &&
    (bits & CROWDSTRIKE_MODIFY_BITS) === 0
  );
}

function splunkRows(payload: unknown): unknown[] {
  const rec = asRecord(payload);
  if (!rec) {
    return [];
  }
  return Array.isArray(rec.results) ? rec.results : [];
}

function elasticHits(payload: unknown): unknown[] {
  const rec = asRecord(payload);
  if (!rec) {
    return [];
  }
  const hits = asRecord(rec.hits);
  if (hits && Array.isArray(hits.hits)) {
    return hits.hits;
  }
  return Array.isArray(rec.hits) ? rec.hits : [];
}

function crowdstrikeResources(payload: unknown): unknown[] {
  const rec = asRecord(payload);
  if (!rec) {
    return [];
  }
  if (Array.isArray(rec.resources)) {
    return rec.resources;
  }
  const body = asRecord(rec.body);
  if (body && Array.isArray(body.resources)) {
    return body.resources;
  }
  return Array.isArray(rec.alerts) ? rec.alerts : [];
}

function elasticSource(hit: Record<string, unknown>): Record<string, unknown> {
  const source = asRecord(hit._source);
  return source ?? hit;
}

function splunkOutcome(
  row: Record<string, unknown>
): DetectionCorrelationEventOutcome {
  const eventType = firstString(row, ["event_type", "action", "event.action"]);
  if (isBlockToken(eventType)) {
    return "Blocked";
  }
  const ruleId = firstString(row, ["rule_name", "signature"]);
  if (isLogToken(eventType) && !ruleId) {
    return "Logged";
  }
  if (isAlertToken(eventType) || ruleId) {
    return "Alerted";
  }
  return "Logged";
}

function elasticOutcome(
  source: Record<string, unknown>
): DetectionCorrelationEventOutcome {
  const action = firstString(source, [
    "event.action",
    "event.outcome",
    "kibana.alert.action"
  ]);
  if (isBlockToken(action)) {
    return "Blocked";
  }
  const ruleId = firstString(source, [
    "kibana.alert.rule.name",
    "signal.rule.name",
    "rule.name"
  ]);
  if (ruleId || isAlertToken(action)) {
    return "Alerted";
  }
  return "Logged";
}

function crowdstrikeOutcome(
  row: Record<string, unknown>
): DetectionCorrelationEventOutcome {
  if (isCrowdStrikePrevented(dig(row, "pattern_disposition"))) {
    return "Blocked";
  }
  return "Alerted";
}

function eventFromRow(input: {
  index: number;
  outcome: DetectionCorrelationEventOutcome;
  row: Record<string, unknown>;
  vendor: CollectorVendor;
}): DetectionCorrelationEvent | null {
  const { row, vendor, index, outcome } = input;
  const observedAt = toIso(
    firstString(row, [
      "_time",
      "@timestamp",
      "kibana.alert.original_time",
      "created_timestamp",
      "updated_timestamp",
      "timestamp",
      "event.ingested"
    ])
  );
  if (!observedAt) {
    return null;
  }

  const eventId =
    firstString(row, [
      "id",
      "_id",
      "sid",
      "event_id",
      "event.id",
      "composite_id",
      "_cd"
    ]) ?? `${vendor}-${index}`;

  const ruleId = firstString(row, [
    "rule_name",
    "signature",
    "kibana.alert.rule.name",
    "signal.rule.name",
    "rule.name",
    "kibana.alert.rule.rule_id"
  ]);

  const techniqueId = firstString(row, [
    "technique",
    "techniqueId",
    "technique_id",
    "mitre_technique",
    "threat.technique.id"
  ]);

  return {
    assetId: null,
    eventId,
    marker: pickMarker(row),
    observedAt,
    outcome,
    payload: haystackFor(row),
    ruleId,
    techniqueId
  };
}

function normalizeRows(
  vendor: CollectorVendor,
  rows: unknown[],
  outcomeFor: (row: Record<string, unknown>) => DetectionCorrelationEventOutcome
): CollectorNormalizeResult {
  const events: DetectionCorrelationEvent[] = [];
  let skipped = 0;
  rows.forEach((item, index) => {
    const row = asRecord(item);
    if (!row) {
      skipped += 1;
      return;
    }
    const event = eventFromRow({
      index,
      outcome: outcomeFor(row),
      row,
      vendor
    });
    if (!event) {
      skipped += 1;
      return;
    }
    events.push(event);
  });
  return {
    detectionCount: events.length,
    events,
    platform: COLLECTOR_PLATFORM_BY_VENDOR[vendor],
    skipped,
    vendor
  };
}

function flattenElasticHit(
  hit: Record<string, unknown>
): Record<string, unknown> {
  const source = elasticSource(hit);
  return {
    ...source,
    _id: hit._id ?? source._id
  };
}

export function normalizeCollectorPayload(input: {
  payload: unknown;
  vendor: CollectorVendor;
}): CollectorNormalizeResult {
  const vendor = CollectorVendorSchema.parse(input.vendor);
  const payload = parseJsonPayload(input.payload);

  if (vendor === "splunk") {
    return normalizeRows(vendor, splunkRows(payload), splunkOutcome);
  }
  if (vendor === "elastic") {
    const rows = elasticHits(payload).map((item) => {
      const hit = asRecord(item);
      return hit ? flattenElasticHit(hit) : item;
    });
    return normalizeRows(vendor, rows, elasticOutcome);
  }
  return normalizeRows(
    vendor,
    crowdstrikeResources(payload),
    crowdstrikeOutcome
  );
}

export function correlateCollectorObservation(
  input: CollectorObservationInput
): CollectorObservationResult {
  const normalized = normalizeCollectorPayload({
    payload: input.payload,
    vendor: input.vendor
  });
  const correlated = correlateDetectionObservation({
    events: normalized.events,
    inject: input.inject,
    observation: input.observation,
    observer: input.observer
  });
  return {
    ...correlated,
    detectionCount: normalized.detectionCount,
    platform: normalized.platform,
    skipped: normalized.skipped,
    vendor: normalized.vendor
  };
}
