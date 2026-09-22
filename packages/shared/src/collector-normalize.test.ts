import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  COLLECTOR_NORMALIZE_LAW,
  COLLECTOR_PLATFORM_BY_VENDOR,
  correlateCollectorObservation,
  normalizeCollectorPayload,
  type CollectorVendor
} from "./collector-normalize";
import type {
  DetectionCorrelationInject,
  DetectionCorrelationObserver,
  DetectionCorrelationObservation,
  ObserverHealthSample
} from "./detection-correlation";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "collectors"
);

const WINDOW_START = "2026-09-17T14:00:00.000Z";
const WINDOW_END = "2026-09-17T14:10:00.000Z";
const INJECTED_AT = "2026-09-17T14:00:05.000Z";
const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STEP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ASSET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const MARKER = "periscan-r-aaaa-s-bbbb-nonce1";

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

function inject(
  overrides: Partial<DetectionCorrelationInject> = {}
): DetectionCorrelationInject {
  return {
    assetId: ASSET_ID,
    emitted: true,
    expectedRuleId: null,
    injectedAt: INJECTED_AT,
    marker: MARKER,
    runId: RUN_ID,
    stepId: STEP_ID,
    techniqueId: "T1059",
    ...overrides
  };
}

function observer(
  overrides: Partial<DetectionCorrelationObserver> = {}
): DetectionCorrelationObserver {
  return {
    healthStatus: "Healthy",
    lastHeartbeatAt: "2026-09-17T14:09:00.000Z",
    lastValidatedAt: "2026-09-17T14:09:00.000Z",
    telemetryStatus: "Healthy",
    windowEnd: WINDOW_END,
    windowStart: WINDOW_START,
    ...overrides
  };
}

function healthSample(
  observedAt: string,
  healthStatus: ObserverHealthSample["healthStatus"] = "Healthy"
): ObserverHealthSample {
  return { healthStatus, observedAt, telemetryStatus: "Healthy" };
}

function coveringHealthySeries(): ObserverHealthSample[] {
  return [
    healthSample(WINDOW_START),
    healthSample("2026-09-17T14:05:00.000Z"),
    healthSample(WINDOW_END)
  ];
}

function observation(
  overrides: Partial<DetectionCorrelationObservation> = {}
): DetectionCorrelationObservation {
  return {
    windowComplete: true,
    windowEnd: WINDOW_END,
    windowStart: WINDOW_START,
    ...overrides
  };
}

function correlate(
  vendor: CollectorVendor,
  payload: unknown,
  overrides: {
    inject?: Partial<DetectionCorrelationInject>;
    observation?: Partial<DetectionCorrelationObservation>;
    observer?: DetectionCorrelationObserver | null;
  } = {}
) {
  return correlateCollectorObservation({
    inject: inject(overrides.inject),
    observation: observation(overrides.observation),
    observer:
      overrides.observer === undefined
        ? observer({ healthSamples: coveringHealthySeries() })
        : overrides.observer,
    payload,
    vendor
  });
}

describe("COLLECTOR_NORMALIZE_LAW", () => {
  it("requires empty JSON as 0 detections, no invented detections, and stale as Inconclusive", () => {
    expect(COLLECTOR_NORMALIZE_LAW).toMatch(/empty json is 0 detections/i);
    expect(COLLECTOR_NORMALIZE_LAW).toMatch(/does not invent/i);
    expect(COLLECTOR_NORMALIZE_LAW).toMatch(/Inconclusive, never Missed/i);
    expect(COLLECTOR_NORMALIZE_LAW).toMatch(/Splunk/i);
    expect(COLLECTOR_NORMALIZE_LAW).toMatch(/Elastic/i);
    expect(COLLECTOR_NORMALIZE_LAW).toMatch(/CrowdStrike/i);
  });

  it("classifies OpenAEV collector platforms without claiming live vendor APIs", () => {
    expect(COLLECTOR_PLATFORM_BY_VENDOR.splunk).toBe("SIEM");
    expect(COLLECTOR_PLATFORM_BY_VENDOR.elastic).toBe("SIEM");
    expect(COLLECTOR_PLATFORM_BY_VENDOR.crowdstrike).toBe("EDR");
  });
});

describe("normalizeCollectorPayload empty JSON", () => {
  it.each([
    ["splunk", "splunk-empty.json"],
    ["elastic", "elastic-empty.json"],
    ["crowdstrike", "crowdstrike-empty.json"]
  ] as const)("%s empty results is 0 detections", (vendor, file) => {
    const result = normalizeCollectorPayload({
      payload: loadFixture(file),
      vendor
    });
    expect(result.detectionCount).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.vendor).toBe(vendor);
    expect(result.platform).toBe(COLLECTOR_PLATFORM_BY_VENDOR[vendor]);
  });

  it("treats null, blank, and object-without-rows JSON as 0 detections", () => {
    for (const payload of [null, "", "   ", {}, [], { hits: {} }]) {
      for (const vendor of ["splunk", "elastic", "crowdstrike"] as const) {
        const result = normalizeCollectorPayload({ payload, vendor });
        expect(result.detectionCount).toBe(0);
        expect(result.events).toEqual([]);
      }
    }
  });

  it("skips CrowdStrike malformed resources instead of inventing detections", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("crowdstrike-malformed.json"),
      vendor: "crowdstrike"
    });
    expect(result.detectionCount).toBe(0);
    expect(result.events).toEqual([]);
    expect(result.skipped).toBeGreaterThan(0);
  });
});

describe("normalizeCollectorPayload vendor shapes", () => {
  it("maps Splunk notable JSON with the inject marker to Alerted", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("splunk-alerted.json"),
      vendor: "splunk"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.outcome).toBe("Alerted");
    expect(result.events[0]?.ruleId).toBe("sigma.proc_canary");
    expect(result.events[0]?.marker).toBe(MARKER);
    expect(result.events[0]?.observedAt).toBe("2026-09-17T14:01:00.000Z");
  });

  it("maps Splunk blocked JSON to Blocked", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("splunk-prevented.json"),
      vendor: "splunk"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.outcome).toBe("Blocked");
  });

  it("maps Splunk log-only JSON to Logged", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("splunk-logged.json"),
      vendor: "splunk"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.outcome).toBe("Logged");
    expect(result.events[0]?.ruleId).toBeNull();
  });

  it("maps Elastic Security alert hits to Alerted", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("elastic-alerted.json"),
      vendor: "elastic"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.eventId).toBe("elastic-alert-1");
    expect(result.events[0]?.outcome).toBe("Alerted");
    expect(result.events[0]?.ruleId).toBe("sigma.proc_canary");
    expect(result.events[0]?.marker).toBe(MARKER);
  });

  it("maps Elastic blocked event.action to Blocked", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("elastic-prevented.json"),
      vendor: "elastic"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.outcome).toBe("Blocked");
  });

  it("maps Elastic process logs without kibana.alert to Logged", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("elastic-logged.json"),
      vendor: "elastic"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.outcome).toBe("Logged");
  });

  it("maps CrowdStrike Alerts v2 with pattern_disposition 0 to Alerted", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("crowdstrike-alerted.json"),
      vendor: "crowdstrike"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.eventId).toBe("cs-alert-1");
    expect(result.events[0]?.outcome).toBe("Alerted");
    expect(result.events[0]?.marker).toBe(MARKER);
    expect(result.events[0]?.techniqueId).toBe("T1059");
  });

  it("maps CrowdStrike prevent bitmask 16 to Blocked", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("crowdstrike-prevented.json"),
      vendor: "crowdstrike"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.outcome).toBe("Blocked");
  });

  it("unwraps CrowdStrike body.resources the way OpenAEV tests do", () => {
    const result = normalizeCollectorPayload({
      payload: loadFixture("crowdstrike-body-wrapped.json"),
      vendor: "crowdstrike"
    });
    expect(result.detectionCount).toBe(1);
    expect(result.events[0]?.eventId).toBe("cs-wrapped-1");
    expect(result.events[0]?.marker).toBe(MARKER);
  });
});

describe("correlateCollectorObservation inject verdicts", () => {
  it("returns Alerted for Splunk notable JSON that carries the inject marker", () => {
    const result = correlate("splunk", loadFixture("splunk-alerted.json"));
    expect(result.detectionCount).toBe(1);
    expect(result.verdict).toBe("Alerted");
    expect(result.matchedEventIds).toHaveLength(1);
  });

  it("returns Prevented for Splunk blocked JSON that carries the inject marker", () => {
    const result = correlate("splunk", loadFixture("splunk-prevented.json"));
    expect(result.verdict).toBe("Prevented");
  });

  it("returns Logged for Splunk log-only JSON that carries the inject marker", () => {
    const result = correlate("splunk", loadFixture("splunk-logged.json"));
    expect(result.verdict).toBe("Logged");
  });

  it("returns Alerted for Elastic Security alerts that carry the inject marker", () => {
    const result = correlate("elastic", loadFixture("elastic-alerted.json"));
    expect(result.verdict).toBe("Alerted");
  });

  it("returns Prevented for Elastic blocked hits that carry the inject marker", () => {
    const result = correlate("elastic", loadFixture("elastic-prevented.json"));
    expect(result.verdict).toBe("Prevented");
  });

  it("returns Logged for Elastic process logs that carry the inject marker", () => {
    const result = correlate("elastic", loadFixture("elastic-logged.json"));
    expect(result.verdict).toBe("Logged");
  });

  it("returns Alerted for CrowdStrike detection-only alerts", () => {
    const result = correlate(
      "crowdstrike",
      loadFixture("crowdstrike-alerted.json")
    );
    expect(result.verdict).toBe("Alerted");
  });

  it("returns Prevented for CrowdStrike prevent-bitmask alerts", () => {
    const result = correlate(
      "crowdstrike",
      loadFixture("crowdstrike-prevented.json")
    );
    expect(result.verdict).toBe("Prevented");
  });

  it("returns Executed while the observation window is still open and JSON is empty", () => {
    const result = correlate("splunk", loadFixture("splunk-empty.json"), {
      observation: { windowComplete: false }
    });
    expect(result.detectionCount).toBe(0);
    expect(result.verdict).toBe("Executed");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("does not invent a detection from unrelated Splunk notables", () => {
    const result = correlate("splunk", loadFixture("splunk-unrelated.json"));
    expect(result.detectionCount).toBe(1);
    expect(result.matchedEventIds).toEqual([]);
    expect(result.verdict).not.toBe("Alerted");
    expect(result.verdict).not.toBe("Prevented");
    expect(result.verdict).not.toBe("Logged");
    expect(result.verdict).toBe("Missed");
  });

  it("returns Inconclusive, never Missed, when the observer lastValidatedAt is stale", () => {
    const result = correlate("elastic", loadFixture("elastic-empty.json"), {
      observer: observer({
        healthSamples: [],
        lastHeartbeatAt: "2026-09-17T13:00:00.000Z",
        lastValidatedAt: "2026-09-17T13:00:00.000Z"
      })
    });
    expect(result.detectionCount).toBe(0);
    expect(result.verdict).toBe("Inconclusive");
    expect(result.observerHealthStale).toBe(true);
    expect(result.missedEligible).toBe(false);
    expect(result.reason).toMatch(/stale/i);
  });

  it("returns Inconclusive, never Missed, when health samples are stale vs the window", () => {
    const result = correlate(
      "crowdstrike",
      loadFixture("crowdstrike-empty.json"),
      {
        observer: observer({
          healthSamples: [
            healthSample("2026-09-17T13:40:00.000Z"),
            healthSample("2026-09-17T13:50:00.000Z")
          ],
          lastValidatedAt: "2026-09-17T13:50:00.000Z"
        })
      }
    );
    expect(result.detectionCount).toBe(0);
    expect(result.verdict).toBe("Inconclusive");
    expect(result.observerHealthStale).toBe(true);
  });

  it("returns Inconclusive for a missing observer even when collector JSON is empty", () => {
    const result = correlate("splunk", {}, { observer: null });
    expect(result.detectionCount).toBe(0);
    expect(result.verdict).toBe("Inconclusive");
    expect(result.reason).toMatch(/no observer/i);
  });

  it("allows Missed only after empty collector JSON, completed window, and a healthy covering series", () => {
    const result = correlate("elastic", loadFixture("elastic-empty.json"));
    expect(result.detectionCount).toBe(0);
    expect(result.verdict).toBe("Missed");
    expect(result.missedEligible).toBe(true);
    expect(result.observerHealthy).toBe(true);
  });
});
