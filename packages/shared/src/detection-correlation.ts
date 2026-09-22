import { z } from "zod";

import type { ControlEffectivenessState } from "./control-effectiveness";

/**
 * PERISCAN-590 detection correlation helpers.
 *
 * Pure functions: unique run/step markers, asset/technique/rule/time matching,
 * observer-health gates from a health-sample series (lastValidatedAt fallback).
 * No I/O and no invented detections.
 */

export const DETECTION_CORRELATION_LAW =
  "Correlate a unique run/step marker with asset, technique, rule and event times. Distinguish Executed, Prevented, Logged, Alerted and Routed. Missed requires a healthy observer covering the observation window (health-sample series, or lastValidatedAt fallback in-window). Observer outages, missing observers, and stale lastValidatedAt outside the window are Inconclusive, never Missed. This module does not invent detections.";

/**
 * Documented fallback when a heartbeat series is not persisted.
 * Control sources today expose lastValidatedAt, not a time-series.
 */
export const OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK =
  "When no healthSamples series is present, lastValidatedAt (or lastHeartbeatAt) is a single-point fallback. Missed is allowed only if that timestamp falls inside the observation window and the observer is Healthy. A stale lastValidatedAt outside the observation window is Inconclusive, never Missed. A single snapshot cannot prove health across unsampled gaps.";

/** Allowlisted benign-marker class used by DRV emit→observe. */
export const DETECTION_CORRELATION_MARKER_PATTERN =
  /^periscan-[A-Za-z0-9._:-]{4,120}$/u;

export const DetectionCorrelationVerdictSchema = z.enum([
  "Executed",
  "Prevented",
  "Logged",
  "Alerted",
  "Routed",
  "Missed",
  "Inconclusive"
]);
export type DetectionCorrelationVerdict = z.infer<
  typeof DetectionCorrelationVerdictSchema
>;

export const DetectionCorrelationStageSchema = z.enum([
  "inject",
  "observe",
  "verdict",
  "retest"
]);
export type DetectionCorrelationStage = z.infer<
  typeof DetectionCorrelationStageSchema
>;

export const DetectionCorrelationEventOutcomeSchema = z.enum([
  "Blocked",
  "Logged",
  "Alerted",
  "Routed",
  "Detected",
  "Missed"
]);
export type DetectionCorrelationEventOutcome = z.infer<
  typeof DetectionCorrelationEventOutcomeSchema
>;

export const ObserverHealthStatusSchema = z.enum([
  "Healthy",
  "Degraded",
  "Unhealthy",
  "Unknown"
]);
export type ObserverHealthStatus = z.infer<typeof ObserverHealthStatusSchema>;

export type DetectionCorrelationInject = {
  assetId?: string | null;
  emitted: boolean;
  expectedRuleId?: string | null;
  injectedAt?: string | null;
  marker: string;
  runId: string;
  stepId: string;
  techniqueId?: string | null;
};

export type DetectionCorrelationEvent = {
  assetId?: string | null;
  eventId: string;
  marker?: string | null;
  observedAt: string;
  outcome?: DetectionCorrelationEventOutcome | string | null;
  payload?: string | null;
  ruleId?: string | null;
  techniqueId?: string | null;
};

export type ObserverHealthSample = {
  healthStatus: ObserverHealthStatus | string;
  observedAt: string;
  telemetryStatus?: ObserverHealthStatus | string | null;
};

export type ObserverHealthCoverage =
  | "series"
  | "lastValidatedAt_fallback"
  | "none";

export type ObserverHealthWindowAssessment = {
  allowsMissed: boolean;
  coverage: ObserverHealthCoverage;
  healthy: boolean;
  missingObserver: boolean;
  outage: boolean;
  reason: string;
  stale: boolean;
};

export type DetectionCorrelationObserver = {
  healthSamples?: readonly ObserverHealthSample[] | null;
  healthStatus: ObserverHealthStatus | string;
  lastHeartbeatAt?: string | null;
  lastValidatedAt?: string | null;
  telemetryStatus?: ObserverHealthStatus | string | null;
  windowEnd: string;
  windowStart: string;
};

export type DetectionCorrelationObservation = {
  windowComplete: boolean;
  windowEnd: string;
  windowStart: string;
};

export type DetectionCorrelationInput = {
  events: readonly DetectionCorrelationEvent[];
  inject: DetectionCorrelationInject;
  observation: DetectionCorrelationObservation;
  observer: DetectionCorrelationObserver | null;
};

export type DetectionCorrelationResult = {
  matchedEventIds: string[];
  missedEligible: boolean;
  observerHealthCoverage: ObserverHealthCoverage;
  observerHealthStale: boolean;
  observerHealthy: boolean;
  reason: string;
  stage: DetectionCorrelationStage;
  verdict: DetectionCorrelationVerdict;
  windowComplete: boolean;
};

const MARKER_PARSE =
  /^periscan-r([0-9a-f]{8})-s([0-9a-f]{8})-[A-Za-z0-9._:-]+$/iu;

function randomMarkerSuffix(length = 10): string {
  const bytes = new Uint8Array(length);
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.getRandomValues === "function") {
    cryptoRef.getRandomValues(bytes);
  } else {
    for (let i = 0; i < length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function hexPrefix(id: string, size = 8): string {
  return id.replace(/-/g, "").toLowerCase().slice(0, size).padEnd(size, "0");
}

export function buildDetectionRunStepMarker(input: {
  runId: string;
  stepId: string;
}): string {
  const marker = `periscan-r${hexPrefix(input.runId)}-s${hexPrefix(input.stepId)}-${randomMarkerSuffix()}`;
  if (!DETECTION_CORRELATION_MARKER_PATTERN.test(marker)) {
    return `periscan-r${hexPrefix(input.runId)}-s${hexPrefix(input.stepId)}-fall`;
  }
  return marker;
}

export function parseDetectionRunStepMarker(
  marker: string
): { runIdPrefix: string; stepIdPrefix: string } | null {
  const match = MARKER_PARSE.exec(marker);
  if (!match) {
    return null;
  }
  return {
    runIdPrefix: match[1]!.toLowerCase(),
    stepIdPrefix: match[2]!.toLowerCase()
  };
}

function parseTime(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function payloadContainsExactMarker(payload: string, marker: string): boolean {
  let from = 0;
  while (from <= payload.length) {
    const idx = payload.indexOf(marker, from);
    if (idx < 0) {
      return false;
    }
    const after = payload[idx + marker.length];
    if (!after || !/[A-Za-z0-9._:-]/u.test(after)) {
      return true;
    }
    from = idx + 1;
  }
  return false;
}

function eventCarriesMarker(
  event: DetectionCorrelationEvent,
  marker: string
): boolean {
  if (event.marker === marker) {
    return true;
  }
  if (event.marker && event.marker !== marker) {
    return false;
  }
  if (event.payload && payloadContainsExactMarker(event.payload, marker)) {
    return true;
  }
  return false;
}

export function eventMatchesCorrelationKeys(input: {
  event: DetectionCorrelationEvent;
  inject: DetectionCorrelationInject;
  observation: DetectionCorrelationObservation;
}): boolean {
  const { event, inject, observation } = input;
  if (!inject.marker || !eventCarriesMarker(event, inject.marker)) {
    return false;
  }
  if (inject.assetId && event.assetId && inject.assetId !== event.assetId) {
    return false;
  }
  if (
    inject.techniqueId &&
    event.techniqueId &&
    inject.techniqueId !== event.techniqueId
  ) {
    return false;
  }
  if (
    inject.expectedRuleId &&
    event.ruleId &&
    inject.expectedRuleId !== event.ruleId
  ) {
    return false;
  }
  const observedAt = parseTime(event.observedAt);
  const windowStart = parseTime(observation.windowStart);
  const windowEnd = parseTime(observation.windowEnd);
  const injectedAt = parseTime(inject.injectedAt);
  if (observedAt == null || windowStart == null || windowEnd == null) {
    return false;
  }
  if (observedAt < windowStart || observedAt > windowEnd) {
    return false;
  }
  if (injectedAt != null && observedAt < injectedAt) {
    return false;
  }
  return true;
}

function isOutageStatus(
  healthStatus?: string | null,
  telemetryStatus?: string | null
): boolean {
  return (
    healthStatus === "Unhealthy" ||
    healthStatus === "Unknown" ||
    telemetryStatus === "Unhealthy" ||
    telemetryStatus === "Unknown"
  );
}

function isHealthyStatus(
  healthStatus?: string | null,
  telemetryStatus?: string | null
): boolean {
  if (healthStatus !== "Healthy") {
    return false;
  }
  return telemetryStatus == null || telemetryStatus === "Healthy";
}

function healthWindowAssessment(input: {
  allowsMissed: boolean;
  coverage: ObserverHealthCoverage;
  healthy?: boolean;
  missingObserver?: boolean;
  outage?: boolean;
  reason: string;
  stale?: boolean;
}): ObserverHealthWindowAssessment {
  return {
    allowsMissed: input.allowsMissed,
    coverage: input.coverage,
    healthy: input.healthy ?? input.allowsMissed,
    missingObserver: input.missingObserver === true,
    outage: input.outage === true,
    reason: input.reason,
    stale: input.stale === true
  };
}

function evaluateHealthSampleSeries(
  samples: readonly ObserverHealthSample[],
  start: number,
  end: number
): ObserverHealthWindowAssessment {
  const parsed = samples
    .map((sample) => ({ sample, at: parseTime(sample.observedAt) }))
    .filter((item): item is { sample: ObserverHealthSample; at: number } => {
      return item.at != null;
    });

  if (parsed.length === 0) {
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "none",
      reason:
        "Observer health series has no usable timestamps — Inconclusive, not Missed."
    });
  }

  const inWindow = parsed.filter((item) => item.at >= start && item.at <= end);
  const outageInWindow = inWindow.find((item) =>
    isOutageStatus(item.sample.healthStatus, item.sample.telemetryStatus)
  );
  if (outageInWindow) {
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "series",
      outage: true,
      reason:
        "Observer outage during the observation window — verdict is Inconclusive, not Missed."
    });
  }

  const bracketsStart = parsed.some((item) => item.at <= start);
  const bracketsEnd = parsed.some((item) => item.at >= end);
  if (inWindow.length === 0 || !bracketsStart || !bracketsEnd) {
    const stale = parsed.every((item) => item.at < start || item.at > end);
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "series",
      reason: stale
        ? "Observer health is stale (lastValidatedAt outside the observation window) — Inconclusive, never Missed."
        : "Observer health series does not cover the observation window — Inconclusive, not Missed.",
      stale
    });
  }

  const allHealthy = inWindow.every((item) =>
    isHealthyStatus(item.sample.healthStatus, item.sample.telemetryStatus)
  );
  if (!allHealthy) {
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "series",
      reason:
        "Observer was not healthy for the observation window — cannot claim Missed."
    });
  }

  return healthWindowAssessment({
    allowsMissed: true,
    coverage: "series",
    healthy: true,
    reason:
      "Healthy observer health-sample series covers the observation window."
  });
}

function evaluateLastValidatedAtFallback(
  observer: DetectionCorrelationObserver,
  start: number,
  end: number
): ObserverHealthWindowAssessment {
  const stamp =
    parseTime(observer.lastValidatedAt) ?? parseTime(observer.lastHeartbeatAt);
  const outage = isOutageStatus(
    observer.healthStatus,
    observer.telemetryStatus
  );
  if (outage) {
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: stamp == null ? "none" : "lastValidatedAt_fallback",
      outage: true,
      reason:
        "Observer outage during the observation window — verdict is Inconclusive, not Missed.",
      stale: stamp != null && (stamp < start || stamp > end)
    });
  }

  if (stamp == null) {
    const missingObserver =
      observer.healthStatus == null || observer.healthStatus === "Unknown";
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "none",
      missingObserver,
      reason: missingObserver
        ? "No observer — cannot claim Missed."
        : "Observer health timestamp is missing — Inconclusive, not Missed."
    });
  }

  if (stamp < start || stamp > end) {
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "lastValidatedAt_fallback",
      reason:
        "Observer health is stale (lastValidatedAt outside the observation window) — Inconclusive, never Missed.",
      stale: true
    });
  }

  if (!isHealthyStatus(observer.healthStatus, observer.telemetryStatus)) {
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "lastValidatedAt_fallback",
      reason:
        "Observer was not healthy for the observation window — cannot claim Missed."
    });
  }

  return healthWindowAssessment({
    allowsMissed: true,
    coverage: "lastValidatedAt_fallback",
    healthy: true,
    reason:
      "Healthy observer lastValidatedAt fallback is inside the observation window."
  });
}

export function evaluateObserverHealthWindow(
  observer: DetectionCorrelationObserver | null | undefined
): ObserverHealthWindowAssessment {
  if (observer == null) {
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "none",
      missingObserver: true,
      reason: "No observer — cannot claim Missed."
    });
  }

  const start = parseTime(observer.windowStart);
  const end = parseTime(observer.windowEnd);
  if (start == null || end == null || end < start) {
    return healthWindowAssessment({
      allowsMissed: false,
      coverage: "none",
      outage: isOutageStatus(observer.healthStatus, observer.telemetryStatus),
      reason:
        "Observation window timestamps are invalid — Inconclusive, not Missed."
    });
  }

  const samples = observer.healthSamples ?? [];
  if (samples.length > 0) {
    return evaluateHealthSampleSeries(samples, start, end);
  }

  return evaluateLastValidatedAtFallback(observer, start, end);
}

export function observerHealthAllowsMissed(
  observer: DetectionCorrelationObserver | null | undefined
): boolean {
  return evaluateObserverHealthWindow(observer).allowsMissed;
}

export function isObserverOutage(
  observer: DetectionCorrelationObserver | null | undefined
): boolean {
  return evaluateObserverHealthWindow(observer).outage;
}

function asResult(
  partial: DetectionCorrelationResult
): DetectionCorrelationResult {
  DetectionCorrelationVerdictSchema.parse(partial.verdict);
  return partial;
}

function resultWithHealth(
  assessment: ObserverHealthWindowAssessment,
  partial: Omit<
    DetectionCorrelationResult,
    "observerHealthCoverage" | "observerHealthStale" | "observerHealthy"
  > & {
    observerHealthy?: boolean;
  }
): DetectionCorrelationResult {
  return asResult({
    ...partial,
    observerHealthCoverage: assessment.coverage,
    observerHealthStale: assessment.stale,
    observerHealthy: partial.observerHealthy ?? assessment.allowsMissed
  });
}

function strongestMatchedOutcome(
  events: readonly DetectionCorrelationEvent[]
): DetectionCorrelationEventOutcome | null {
  const outcomes = new Set(
    events.map((item) => item.outcome).filter(Boolean) as string[]
  );
  if (outcomes.has("Blocked")) {
    return "Blocked";
  }
  if (outcomes.has("Routed")) {
    return "Routed";
  }
  if (outcomes.has("Alerted") || outcomes.has("Detected")) {
    return "Alerted";
  }
  if (outcomes.has("Logged")) {
    return "Logged";
  }
  return null;
}

export function correlateDetectionObservation(
  input: DetectionCorrelationInput
): DetectionCorrelationResult {
  const assessment = evaluateObserverHealthWindow(input.observer);
  const windowComplete = input.observation.windowComplete === true;

  if (!input.inject.emitted || !input.inject.marker) {
    return resultWithHealth(assessment, {
      matchedEventIds: [],
      missedEligible: false,
      reason:
        "No inject receipt — cannot correlate a detection without a unique emitted marker.",
      stage: "inject",
      verdict: "Inconclusive",
      windowComplete
    });
  }

  const matched = input.events.filter((event) =>
    eventMatchesCorrelationKeys({
      event,
      inject: input.inject,
      observation: input.observation
    })
  );
  const matchedEventIds = matched.map((event) => event.eventId);

  if (matched.length === 0 && assessment.missingObserver) {
    return resultWithHealth(assessment, {
      matchedEventIds,
      missedEligible: false,
      observerHealthy: false,
      reason: "No observer — cannot claim Missed.",
      stage: "observe",
      verdict: "Inconclusive",
      windowComplete
    });
  }

  if (matched.length === 0 && assessment.outage) {
    return resultWithHealth(assessment, {
      matchedEventIds,
      missedEligible: false,
      observerHealthy: false,
      reason:
        "Observer outage during the observation window — verdict is Inconclusive, not Missed.",
      stage: "observe",
      verdict: "Inconclusive",
      windowComplete
    });
  }

  const strongest = strongestMatchedOutcome(matched);
  if (strongest === "Blocked") {
    return resultWithHealth(assessment, {
      matchedEventIds,
      missedEligible: false,
      reason: "Matched telemetry recorded prevention/block for this marker.",
      stage: "verdict",
      verdict: "Prevented",
      windowComplete
    });
  }
  if (strongest === "Routed") {
    return resultWithHealth(assessment, {
      matchedEventIds,
      missedEligible: false,
      reason: "Matched telemetry recorded routing for this marker.",
      stage: "verdict",
      verdict: "Routed",
      windowComplete
    });
  }
  if (strongest === "Alerted") {
    return resultWithHealth(assessment, {
      matchedEventIds,
      missedEligible: false,
      reason: "Matched telemetry recorded an alert or detection for this marker.",
      stage: "verdict",
      verdict: "Alerted",
      windowComplete
    });
  }
  if (strongest === "Logged") {
    return resultWithHealth(assessment, {
      matchedEventIds,
      missedEligible: false,
      reason: "Matched telemetry recorded log-only evidence for this marker.",
      stage: "verdict",
      verdict: "Logged",
      windowComplete
    });
  }

  if (!windowComplete) {
    return resultWithHealth(assessment, {
      matchedEventIds,
      missedEligible: false,
      reason:
        "Inject receipt present; observation window still open — Executed, not Missed.",
      stage: "observe",
      verdict: "Executed",
      windowComplete
    });
  }

  if (!assessment.allowsMissed) {
    return resultWithHealth(assessment, {
      matchedEventIds,
      missedEligible: false,
      observerHealthy: false,
      reason: assessment.reason,
      stage: "verdict",
      verdict: "Inconclusive",
      windowComplete
    });
  }

  return resultWithHealth(assessment, {
    matchedEventIds,
    missedEligible: true,
    observerHealthy: true,
    reason:
      "Healthy observer completed the window with no matching rule or event for this marker.",
    stage: "verdict",
    verdict: "Missed",
    windowComplete
  });
}

export function gateMissedByObserverHealth<T extends string>(
  verdict: T,
  observer:
    | {
        healthSamples?: readonly ObserverHealthSample[] | null;
        healthStatus?: string | null;
        lastHeartbeatAt?: string | null;
        lastValidatedAt?: string | null;
        telemetryStatus?: string | null;
        windowEnd?: string | null;
        windowStart?: string | null;
      }
    | null
    | undefined
): T | "Inconclusive" {
  if (verdict !== "Missed") {
    return verdict;
  }
  if (observer == null) {
    return "Inconclusive";
  }
  if (observer.windowStart && observer.windowEnd) {
    const assessed = evaluateObserverHealthWindow({
      healthSamples: observer.healthSamples,
      healthStatus: observer.healthStatus ?? "Unknown",
      lastHeartbeatAt: observer.lastHeartbeatAt,
      lastValidatedAt: observer.lastValidatedAt,
      telemetryStatus: observer.telemetryStatus,
      windowEnd: observer.windowEnd,
      windowStart: observer.windowStart
    });
    return assessed.allowsMissed ? verdict : "Inconclusive";
  }
  if (
    observer.healthStatus === "Healthy" &&
    (observer.telemetryStatus == null || observer.telemetryStatus === "Healthy")
  ) {
    return verdict;
  }
  return "Inconclusive";
}

export function mapDetectionCorrelationToEffectiveness(
  verdict: DetectionCorrelationVerdict
): ControlEffectivenessState {
  switch (verdict) {
    case "Prevented":
      return "Prevented";
    case "Alerted":
    case "Routed":
      return "Detected";
    case "Logged":
      return "TelemetryOnly";
    case "Missed":
      return "Missed";
    case "Executed":
    case "Inconclusive":
      return "Inconclusive";
  }
}

export function correlateStimulusObservation(input: {
  correlationMatched?: boolean | null;
  dispatchReceiptPresent: boolean;
  injectedAt?: string | null;
  marker: string;
  observationDeadlineAt?: string | null;
  observerHealthSamples?: readonly ObserverHealthSample[] | null;
  observerHealthStatus?: string | null;
  observerLastValidatedAt?: string | null;
  observerTelemetryStatus?: string | null;
  runId?: string | null;
  stepId?: string | null;
  storedObservedOutcome?: string | null;
  storedVerdict?: string | null;
  stimulusStatus: string;
  techniqueId?: string | null;
  windowStart?: string | null;
}): DetectionCorrelationResult {
  const windowEnd =
    input.observationDeadlineAt ??
    input.observerLastValidatedAt ??
    input.injectedAt ??
    new Date(0).toISOString();
  const windowStart = input.windowStart ?? input.injectedAt ?? windowEnd;
  const windowComplete = [
    "Completed",
    "Failed",
    "DeniedByPolicy",
    "Cancelled"
  ].includes(input.stimulusStatus);
  const events: DetectionCorrelationEvent[] = [];
  if (input.correlationMatched && input.storedObservedOutcome) {
    events.push({
      eventId: "stored-observer",
      marker: input.marker,
      observedAt: input.observerLastValidatedAt ?? windowEnd,
      outcome: input.storedObservedOutcome,
      ruleId: null,
      techniqueId: input.techniqueId ?? null
    });
  }

  const correlated = correlateDetectionObservation({
    events,
    inject: {
      emitted: input.dispatchReceiptPresent,
      injectedAt: input.injectedAt ?? windowStart,
      marker: input.marker,
      runId: input.runId ?? "00000000-0000-4000-8000-000000000000",
      stepId: input.stepId ?? input.runId ?? "00000000-0000-4000-8000-000000000001",
      techniqueId: input.techniqueId ?? null
    },
    observation: {
      windowComplete,
      windowEnd,
      windowStart
    },
    observer: {
      healthSamples: input.observerHealthSamples,
      healthStatus: input.observerHealthStatus ?? "Unknown",
      lastHeartbeatAt: input.observerLastValidatedAt ?? null,
      lastValidatedAt: input.observerLastValidatedAt ?? null,
      telemetryStatus: input.observerTelemetryStatus ?? null,
      windowEnd,
      windowStart
    }
  });

  if (input.storedVerdict === "Missed") {
    const gated = gateMissedByObserverHealth(input.storedVerdict, {
      healthSamples: input.observerHealthSamples,
      healthStatus: input.observerHealthStatus,
      lastHeartbeatAt: input.observerLastValidatedAt,
      lastValidatedAt: input.observerLastValidatedAt,
      telemetryStatus: input.observerTelemetryStatus,
      windowEnd,
      windowStart
    });
    if (gated === "Inconclusive") {
      return {
        ...correlated,
        missedEligible: false,
        reason:
          "Stored Missed is gated: observer was not healthy — Inconclusive.",
        verdict: "Inconclusive"
      };
    }
  }

  return correlated;
}
