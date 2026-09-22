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
 * Falco exported JSON alert observe.
 *
 * SPDX Apache-2.0. Rules lint stays `falco.rules_validate`. This helper
 * records observe-only findings from fixture/lab JSON alerts. It does not
 * attach a live kernel module and is not Community first-hour.
 */

export const FALCO_OBSERVE_MODULE_ID = "falco.observe";
export const FALCO_OBSERVE_PARSER = "periscan.falco.observe.v1";
export const FALCO_OBSERVE_SPDX_LICENSE_ID = "Apache-2.0";
export const FALCO_OBSERVE_FIXTURE_FILE = "falco/falco-observe-fixture.json";
export const FALCO_LIVE_KERNEL_DENIED = "falco_live_kernel_denied";
export const FALCO_OBSERVE_AUTHORIZATION_REQUIRED =
  "falco_observe_authorization_required";
export const FALCO_OBSERVE_QUALIFICATION_REQUIRED =
  "falco_observe_qualification_required";
export const FALCO_OBSERVE_POLICY_NOT_ALLOWED =
  "falco_observe_policy_not_allowed";
export const FALCO_OBSERVE_COMMUNITY_DEFAULT_DENIED =
  "falco_observe_community_default_denied";
export const FALCO_OBSERVE_NOT_STARTABLE = "falco_observe_not_startable";

const FIXTURE_URL = new URL(
  "../fixtures/falco/falco-observe-fixture.json",
  import.meta.url
);

const MARKER_IN_TEXT = /periscan-[A-Za-z0-9._:-]{4,120}/u;

export type FalcoObserveFinding = {
  hostname: string | null;
  marker: string | null;
  observeOnly: true;
  priority: string | null;
  processName: string | null;
  rule: string | null;
  source: string | null;
  timestamp: string | null;
};

export type FalcoObserveImportResult = {
  executed: false;
  findings: FalcoObserveFinding[];
  invented: false;
  liveKernel: false;
  liveSupported: false;
  observeOnly: true;
  parser: typeof FALCO_OBSERVE_PARSER;
};

export type FalcoObserveStartInput = {
  authorized?: boolean;
  liveKernel?: boolean;
  qualified?: boolean;
};

export type FalcoObserveStartResult = {
  allowed: boolean;
  code: string | null;
  communityStart: false;
  executed: false;
  jobsQueued: number;
  liveKernel: false;
  liveSupported: false;
  moduleId: typeof FALCO_OBSERVE_MODULE_ID;
  observeOnly: true;
  spdxLicenseId: typeof FALCO_OBSERVE_SPDX_LICENSE_ID;
};

export type FalcoObservePlan = {
  executed: false;
  executable: false;
  kind: "observe";
  liveKernel: false;
  liveSupported: false;
  moduleId: typeof FALCO_OBSERVE_MODULE_ID;
  observeOnly: true;
  parser: typeof FALCO_OBSERVE_PARSER;
};

export type FalcoObserveQualifiedStartInput = {
  communityDefaultPack?: boolean;
  fixtureMode?: boolean;
  json?: unknown;
  liveKernel?: boolean;
  policyOutcome?: string | null;
  qualified?: boolean;
  raw?: string;
  startable?: boolean;
  tenantAuthorized?: boolean;
};

export type FalcoObserveQualifiedStartResult = {
  allowed: boolean;
  code: string | null;
  communityDefaultPack: false;
  communityStart: false;
  executed: false;
  executable: false;
  findings: FalcoObserveFinding[];
  jobsQueued: number;
  liveKernel: false;
  liveSupported: false;
  moduleId: typeof FALCO_OBSERVE_MODULE_ID;
  observeOnly: true;
  observePlan: FalcoObservePlan | null;
  queued: boolean;
  spdxLicenseId: typeof FALCO_OBSERVE_SPDX_LICENSE_ID;
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

function parseNdjsonOrJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      return JSON.parse(trimmed);
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

function isRulesLintLoadResult(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  if (!Array.isArray(value.falco_load_results)) {
    return false;
  }
  return !Array.isArray(value.events) && !Array.isArray(value.alerts);
}

function rowsFromUnknown(json: unknown): unknown[] {
  if (json == null) {
    return [];
  }
  if (isRulesLintLoadResult(json)) {
    return [];
  }
  if (Array.isArray(json)) {
    return json;
  }
  if (!isRecord(json)) {
    return [];
  }
  if (Array.isArray(json.events)) {
    return json.events;
  }
  if (Array.isArray(json.alerts)) {
    return json.alerts;
  }
  if (asString(json.rule)) {
    return [json];
  }
  return [];
}

function asFinding(row: unknown): FalcoObserveFinding | null {
  if (!isRecord(row)) {
    return null;
  }
  const rule = asString(row.rule);
  if (!rule) {
    return null;
  }
  const output = asString(row.output);
  const cmdline = nestedString(row, ["output_fields", "proc.cmdline"]);
  return {
    hostname: asString(row.hostname),
    marker: extractMarker(output) ?? extractMarker(cmdline),
    observeOnly: true,
    priority: asString(row.priority),
    processName: nestedString(row, ["output_fields", "proc.name"]),
    rule,
    source: asString(row.source),
    timestamp: asString(row.time)
  };
}

export function mapFalcoObserveAlerts(raw: unknown): FalcoObserveFinding[] {
  let json: unknown = raw;
  if (typeof raw === "string") {
    json = parseNdjsonOrJson(raw);
  }
  return rowsFromUnknown(json).flatMap((row) => {
    const finding = asFinding(row);
    return finding ? [finding] : [];
  });
}

export function loadFalcoObserveFixture(): unknown {
  return JSON.parse(readFileSync(fileURLToPath(FIXTURE_URL), "utf8"));
}

export function importFalcoObserveFindings(
  input: {
    fixtureMode?: boolean;
    json?: unknown;
    raw?: string;
  } = {}
): FalcoObserveImportResult {
  let json: unknown;
  if (input.raw !== undefined) {
    json = parseNdjsonOrJson(input.raw);
  } else if (input.json !== undefined) {
    json = input.json;
  } else if (input.fixtureMode === true) {
    json = loadFalcoObserveFixture();
  } else {
    json = [];
  }

  return {
    executed: false,
    findings: mapFalcoObserveAlerts(json),
    invented: false,
    liveKernel: false,
    liveSupported: false,
    observeOnly: true,
    parser: FALCO_OBSERVE_PARSER
  };
}

function toCorrelationEvents(
  findings: FalcoObserveFinding[]
): DetectionCorrelationEvent[] {
  return findings.flatMap((finding, index) => {
    if (!finding.timestamp) {
      return [];
    }
    return [
      {
        eventId: finding.rule ?? `falco-observe-${index}`,
        marker: finding.marker,
        observedAt: finding.timestamp,
        outcome: "Alerted",
        payload: finding.marker,
        ruleId: finding.rule
      }
    ];
  });
}

export function correlateFalcoObserve(input: {
  inject: DetectionCorrelationInject;
  observation: DetectionCorrelationObservation;
  observer: DetectionCorrelationObserver | null;
  json?: unknown;
  raw?: string;
}): DetectionCorrelationResult {
  const findings = mapFalcoObserveAlerts(input.raw ?? input.json);
  return correlateDetectionObservation({
    events: toCorrelationEvents(findings),
    inject: input.inject,
    observation: input.observation,
    observer: input.observer
  });
}

function denyStart(code: string): FalcoObserveStartResult {
  return {
    allowed: false,
    code,
    communityStart: false,
    executed: false,
    jobsQueued: 0,
    liveKernel: false,
    liveSupported: false,
    moduleId: FALCO_OBSERVE_MODULE_ID,
    observeOnly: true,
    spdxLicenseId: FALCO_OBSERVE_SPDX_LICENSE_ID
  };
}

export function evaluateFalcoObserveStart(
  input: FalcoObserveStartInput = {}
): FalcoObserveStartResult {
  if (input.liveKernel === true) {
    return denyStart(FALCO_LIVE_KERNEL_DENIED);
  }
  if (input.authorized !== true) {
    return denyStart(FALCO_OBSERVE_AUTHORIZATION_REQUIRED);
  }
  if (input.qualified !== true) {
    return denyStart(FALCO_OBSERVE_QUALIFICATION_REQUIRED);
  }
  return {
    allowed: true,
    code: null,
    communityStart: false,
    executed: false,
    jobsQueued: 1,
    liveKernel: false,
    liveSupported: false,
    moduleId: FALCO_OBSERVE_MODULE_ID,
    observeOnly: true,
    spdxLicenseId: FALCO_OBSERVE_SPDX_LICENSE_ID
  };
}

function denyQualified(code: string): FalcoObserveQualifiedStartResult {
  return {
    allowed: false,
    code,
    communityDefaultPack: false,
    communityStart: false,
    executed: false,
    executable: false,
    findings: [],
    jobsQueued: 0,
    liveKernel: false,
    liveSupported: false,
    moduleId: FALCO_OBSERVE_MODULE_ID,
    observeOnly: true,
    observePlan: null,
    queued: false,
    spdxLicenseId: FALCO_OBSERVE_SPDX_LICENSE_ID
  };
}

/**
 * Queue an observe-only plan from fixture/lab Falco JSON. Never attaches a
 * live kernel module and never enters the Community default pack.
 */
export function queueFalcoObserveStart(
  input: FalcoObserveQualifiedStartInput = {}
): FalcoObserveQualifiedStartResult {
  if (input.liveKernel === true) {
    return denyQualified(FALCO_LIVE_KERNEL_DENIED);
  }
  if (input.communityDefaultPack === true) {
    return denyQualified(FALCO_OBSERVE_COMMUNITY_DEFAULT_DENIED);
  }
  if (input.startable !== true) {
    return denyQualified(FALCO_OBSERVE_NOT_STARTABLE);
  }
  if (input.qualified !== true) {
    return denyQualified(FALCO_OBSERVE_QUALIFICATION_REQUIRED);
  }
  if (input.tenantAuthorized !== true) {
    return denyQualified(FALCO_OBSERVE_AUTHORIZATION_REQUIRED);
  }
  if (input.policyOutcome !== "Allowed") {
    return denyQualified(FALCO_OBSERVE_POLICY_NOT_ALLOWED);
  }

  const imported = importFalcoObserveFindings({
    fixtureMode: input.fixtureMode,
    json: input.json,
    raw: input.raw
  });

  return {
    allowed: true,
    code: null,
    communityDefaultPack: false,
    communityStart: false,
    executed: false,
    executable: false,
    findings: imported.findings,
    jobsQueued: 1,
    liveKernel: false,
    liveSupported: false,
    moduleId: FALCO_OBSERVE_MODULE_ID,
    observeOnly: true,
    observePlan: {
      executed: false,
      executable: false,
      kind: "observe",
      liveKernel: false,
      liveSupported: false,
      moduleId: FALCO_OBSERVE_MODULE_ID,
      observeOnly: true,
      parser: FALCO_OBSERVE_PARSER
    },
    queued: true,
    spdxLicenseId: FALCO_OBSERVE_SPDX_LICENSE_ID
  };
}
