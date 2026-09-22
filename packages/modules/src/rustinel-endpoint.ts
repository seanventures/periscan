import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  correlateDetectionObservation,
  DETECTION_CORRELATION_MARKER_PATTERN,
  type DetectionCorrelationEvent,
  type DetectionCorrelationInject,
  type DetectionCorrelationObservation,
  type DetectionCorrelationObserver,
  type DetectionCorrelationResult
} from "@periscan/shared";

/**
 * Rustinel endpoint-detection adapter.
 *
 * SPDX Apache-2.0 — Community pack eligible, not Community start until a live
 * agent is qualified. Import ECS NDJSON alerts. Correlate like Falco JSON.
 * Missed requires observer health covering the window.
 */

export const RUSTINEL_MODULE_ID = "rustinel.endpoint_observe";
export const RUSTINEL_PARSER = "periscan.rustinel.v1";
export const RUSTINEL_SPDX_LICENSE_ID = "Apache-2.0";
export const RUSTINEL_COMMUNITY_PACK_ELIGIBLE = true;
export const RUSTINEL_FIXTURE_FILE = "rustinel/rustinel-fixture.ndjson";
export const RUSTINEL_LIVE_AGENT_DENIED = "rustinel_live_agent_denied";
export const RUSTINEL_AUTHORIZATION_REQUIRED =
  "rustinel_authorization_required";
export const RUSTINEL_QUALIFICATION_REQUIRED =
  "rustinel_qualification_required";
export const RUSTINEL_POLICY_NOT_ALLOWED = "rustinel_policy_not_allowed";
export const RUSTINEL_YAML_EVAL_DENIED = "rustinel_yaml_eval_denied";
export const RUSTINEL_COMMUNITY_DEFAULT_DENIED =
  "rustinel_community_default_denied";
export const RUSTINEL_NOT_STARTABLE = "rustinel_observe_import_not_startable";

const FIXTURE_URL = new URL(
  "../fixtures/rustinel/rustinel-fixture.ndjson",
  import.meta.url
);

const MARKER_IN_TEXT = /periscan-[A-Za-z0-9._:-]{4,120}/u;

export type RustinelAlert = {
  category: string | null;
  kind: "alert";
  marker: string | null;
  processName: string | null;
  ruleId: string | null;
  ruleName: string | null;
  timestamp: string | null;
};

export type RustinelImportResult = {
  alerts: RustinelAlert[];
  invented: false;
  liveSupported: false;
  parser: typeof RUSTINEL_PARSER;
};

export type RustinelStartInput = {
  authorized?: boolean;
  liveAgent?: boolean;
  qualified?: boolean;
};

export type RustinelStartResult = {
  allowed: boolean;
  code: string | null;
  communityPackEligible: true;
  communityStart: false;
  jobsQueued: number;
  liveAgent: false;
  liveSupported: false;
  moduleId: typeof RUSTINEL_MODULE_ID;
  spdxLicenseId: typeof RUSTINEL_SPDX_LICENSE_ID;
};

export type RustinelObserveImportPlan = {
  kind: "observe-import";
  liveAgent: false;
  liveSupported: false;
  moduleId: typeof RUSTINEL_MODULE_ID;
  parser: typeof RUSTINEL_PARSER;
  yamlEval: false;
};

export type RustinelQualifiedStartInput = {
  communityDefaultPack?: boolean;
  liveAgent?: boolean;
  policyOutcome?: string | null;
  qualified?: boolean;
  startable?: boolean;
  tenantAuthorized?: boolean;
  yamlEval?: boolean;
};

export type RustinelQualifiedStartResult = {
  allowed: boolean;
  code: string | null;
  communityDefaultPack: false;
  communityPackEligible: true;
  communityStart: false;
  jobsQueued: number;
  liveAgent: false;
  liveSupported: false;
  moduleId: typeof RUSTINEL_MODULE_ID;
  observeImportPlan: RustinelObserveImportPlan | null;
  queued: boolean;
  spdxLicenseId: typeof RUSTINEL_SPDX_LICENSE_ID;
  yamlEval: false;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function extractMarker(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const match = MARKER_IN_TEXT.exec(value);
  if (!match) {
    return null;
  }
  return DETECTION_CORRELATION_MARKER_PATTERN.test(match[0]) ? match[0] : null;
}

function nestedString(
  record: Record<string, unknown>,
  path: string[]
): string | null {
  let cursor: unknown = record;
  for (const key of path) {
    if (!isRecord(cursor)) {
      return null;
    }
    cursor = cursor[key];
  }
  return asString(cursor);
}

function asAlert(row: unknown): RustinelAlert | null {
  if (!isRecord(row)) {
    return null;
  }
  const kind = nestedString(row, ["event", "kind"]);
  const ruleName = nestedString(row, ["rule", "name"]);
  const ruleId = nestedString(row, ["rule", "id"]);
  if (kind === "metric" || kind === "event") {
    return null;
  }
  if (kind !== "alert" && !ruleName && !ruleId) {
    return null;
  }
  if (kind != null && kind !== "alert") {
    return null;
  }
  if (!ruleName && !ruleId) {
    return null;
  }
  const message = asString(row.message);
  const original = nestedString(row, ["event", "original"]);
  const commandLine = nestedString(row, ["process", "command_line"]);
  return {
    category: nestedString(row, ["rule", "category"]),
    kind: "alert",
    marker:
      extractMarker(message) ??
      extractMarker(original) ??
      extractMarker(commandLine),
    processName: nestedString(row, ["process", "name"]),
    ruleId,
    ruleName,
    timestamp: asString(row["@timestamp"])
  };
}

function parseNdjsonOrJson(raw: string): unknown[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (isRecord(parsed) && Array.isArray(parsed.alerts)) {
        return parsed.alerts;
      }
      if (isRecord(parsed)) {
        return [parsed];
      }
    } catch {
      // fall through to NDJSON
    }
  }
  const rows: unknown[] = [];
  for (const line of trimmed.split("\n")) {
    const item = line.trim();
    if (!item) {
      continue;
    }
    try {
      rows.push(JSON.parse(item));
    } catch {
      // skip malformed lines
    }
  }
  return rows;
}

export function mapRustinelAlerts(raw: unknown): RustinelAlert[] {
  if (raw == null) {
    return [];
  }
  let rows: unknown[];
  if (typeof raw === "string") {
    rows = parseNdjsonOrJson(raw);
  } else if (Array.isArray(raw)) {
    rows = raw;
  } else if (isRecord(raw) && Array.isArray(raw.alerts)) {
    rows = raw.alerts;
  } else if (isRecord(raw)) {
    rows = [raw];
  } else {
    return [];
  }
  return rows.flatMap((row) => {
    const alert = asAlert(row);
    return alert ? [alert] : [];
  });
}

export function loadRustinelFixture(): string {
  return readFileSync(fileURLToPath(FIXTURE_URL), "utf8");
}

export function importRustinelAlerts(
  input: {
    fixtureMode?: boolean;
    json?: unknown;
    raw?: string;
  } = {}
): RustinelImportResult {
  let raw: unknown;
  if (input.raw !== undefined) {
    raw = input.raw;
  } else if (input.json !== undefined) {
    raw = input.json;
  } else if (input.fixtureMode === true) {
    raw = loadRustinelFixture();
  } else {
    raw = "";
  }
  return {
    alerts: mapRustinelAlerts(raw),
    invented: false,
    liveSupported: false,
    parser: RUSTINEL_PARSER
  };
}

function toCorrelationEvents(
  alerts: RustinelAlert[]
): DetectionCorrelationEvent[] {
  return alerts.flatMap((alert, index) => {
    if (!alert.timestamp) {
      return [];
    }
    return [
      {
        eventId: alert.ruleId ?? `rustinel-${index}`,
        marker: alert.marker,
        observedAt: alert.timestamp,
        outcome: "Alerted",
        payload: alert.marker,
        ruleId: alert.ruleName ?? alert.ruleId
      }
    ];
  });
}

export function correlateRustinelDetection(input: {
  inject: DetectionCorrelationInject;
  observation: DetectionCorrelationObservation;
  observer: DetectionCorrelationObserver | null;
  json?: unknown;
  raw?: string;
}): DetectionCorrelationResult {
  const alerts = mapRustinelAlerts(input.raw ?? input.json);
  return correlateDetectionObservation({
    events: toCorrelationEvents(alerts),
    inject: input.inject,
    observation: input.observation,
    observer: input.observer
  });
}

function deny(code: string): RustinelStartResult {
  return {
    allowed: false,
    code,
    communityPackEligible: true,
    communityStart: false,
    jobsQueued: 0,
    liveAgent: false,
    liveSupported: false,
    moduleId: RUSTINEL_MODULE_ID,
    spdxLicenseId: RUSTINEL_SPDX_LICENSE_ID
  };
}

export function evaluateRustinelStart(
  input: RustinelStartInput = {}
): RustinelStartResult {
  if (input.liveAgent === true) {
    return deny(RUSTINEL_LIVE_AGENT_DENIED);
  }
  if (input.authorized !== true) {
    return deny(RUSTINEL_AUTHORIZATION_REQUIRED);
  }
  if (input.qualified !== true) {
    return deny(RUSTINEL_QUALIFICATION_REQUIRED);
  }
  return {
    allowed: true,
    code: null,
    communityPackEligible: true,
    communityStart: false,
    jobsQueued: 1,
    liveAgent: false,
    liveSupported: false,
    moduleId: RUSTINEL_MODULE_ID,
    spdxLicenseId: RUSTINEL_SPDX_LICENSE_ID
  };
}

function denyQualified(code: string): RustinelQualifiedStartResult {
  return {
    allowed: false,
    code,
    communityDefaultPack: false,
    communityPackEligible: true,
    communityStart: false,
    jobsQueued: 0,
    liveAgent: false,
    liveSupported: false,
    moduleId: RUSTINEL_MODULE_ID,
    observeImportPlan: null,
    queued: false,
    spdxLicenseId: RUSTINEL_SPDX_LICENSE_ID,
    yamlEval: false
  };
}

/**
 * Queue an observe/import plan only. Never starts a live Rustinel agent,
 * never evals rustinel-rules YAML, and never enters the Community default pack.
 */
export function queueRustinelObserveImportStart(
  input: RustinelQualifiedStartInput = {}
): RustinelQualifiedStartResult {
  if (input.liveAgent === true) {
    return denyQualified(RUSTINEL_LIVE_AGENT_DENIED);
  }
  if (input.yamlEval === true) {
    return denyQualified(RUSTINEL_YAML_EVAL_DENIED);
  }
  if (input.communityDefaultPack === true) {
    return denyQualified(RUSTINEL_COMMUNITY_DEFAULT_DENIED);
  }
  if (input.startable !== true) {
    return denyQualified(RUSTINEL_NOT_STARTABLE);
  }
  if (input.qualified !== true) {
    return denyQualified(RUSTINEL_QUALIFICATION_REQUIRED);
  }
  if (input.tenantAuthorized !== true) {
    return denyQualified(RUSTINEL_AUTHORIZATION_REQUIRED);
  }
  if (input.policyOutcome !== "Allowed") {
    return denyQualified(RUSTINEL_POLICY_NOT_ALLOWED);
  }

  return {
    allowed: true,
    code: null,
    communityDefaultPack: false,
    communityPackEligible: true,
    communityStart: false,
    jobsQueued: 1,
    liveAgent: false,
    liveSupported: false,
    moduleId: RUSTINEL_MODULE_ID,
    observeImportPlan: {
      kind: "observe-import",
      liveAgent: false,
      liveSupported: false,
      moduleId: RUSTINEL_MODULE_ID,
      parser: RUSTINEL_PARSER,
      yamlEval: false
    },
    queued: true,
    spdxLicenseId: RUSTINEL_SPDX_LICENSE_ID,
    yamlEval: false
  };
}
