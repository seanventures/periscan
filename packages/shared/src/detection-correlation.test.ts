import { describe, expect, it } from "vitest";

import { deriveControlEffectivenessState } from "./control-effectiveness";
import {
  DETECTION_CORRELATION_LAW,
  DETECTION_CORRELATION_MARKER_PATTERN,
  OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK,
  buildDetectionRunStepMarker,
  correlateDetectionObservation,
  correlateStimulusObservation,
  evaluateObserverHealthWindow,
  eventMatchesCorrelationKeys,
  gateMissedByObserverHealth,
  mapDetectionCorrelationToEffectiveness,
  observerHealthAllowsMissed,
  parseDetectionRunStepMarker,
  type DetectionCorrelationEvent,
  type DetectionCorrelationInject,
  type DetectionCorrelationObserver,
  type DetectionCorrelationObservation,
  type ObserverHealthSample
} from "./detection-correlation";

const WINDOW_START = "2026-09-17T14:00:00.000Z";
const WINDOW_END = "2026-09-17T14:10:00.000Z";
const INJECTED_AT = "2026-09-17T14:00:05.000Z";
const EVENT_AT = "2026-09-17T14:01:00.000Z";
const RUN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const STEP_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ASSET_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_ASSET = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

function inject(
  overrides: Partial<DetectionCorrelationInject> = {}
): DetectionCorrelationInject {
  return {
    assetId: ASSET_ID,
    emitted: true,
    expectedRuleId: "sigma.proc_canary",
    injectedAt: INJECTED_AT,
    marker: "periscan-r-aaaa-s-bbbb-nonce1",
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
  healthStatus: ObserverHealthSample["healthStatus"] = "Healthy",
  telemetryStatus: ObserverHealthSample["telemetryStatus"] = "Healthy"
): ObserverHealthSample {
  return { healthStatus, observedAt, telemetryStatus };
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

function event(
  overrides: Partial<DetectionCorrelationEvent> = {}
): DetectionCorrelationEvent {
  return {
    assetId: ASSET_ID,
    eventId: "evt-1",
    marker: "periscan-r-aaaa-s-bbbb-nonce1",
    observedAt: EVENT_AT,
    outcome: "Alerted",
    ruleId: "sigma.proc_canary",
    techniqueId: "T1059",
    ...overrides
  };
}

describe("DETECTION_CORRELATION_LAW", () => {
  it("requires unique markers, health before Missed, and outages as Inconclusive", () => {
    expect(DETECTION_CORRELATION_LAW).toMatch(/unique run\/step marker/i);
    expect(DETECTION_CORRELATION_LAW).toMatch(/healthy observer/i);
    expect(DETECTION_CORRELATION_LAW).toMatch(/Inconclusive/i);
    expect(DETECTION_CORRELATION_LAW).toMatch(/does not invent/i);
    expect(DETECTION_CORRELATION_LAW).toMatch(/health-sample series/i);
    expect(DETECTION_CORRELATION_LAW).toMatch(/stale lastValidatedAt/i);
  });
});

describe("OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK", () => {
  it("documents lastValidatedAt as a single-point fallback, never a heartbeat series", () => {
    expect(OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK).toMatch(
      /lastValidatedAt/i
    );
    expect(OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK).toMatch(/fallback/i);
    expect(OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK).toMatch(
      /outside the (observation )?window/i
    );
    expect(OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK).toMatch(/Inconclusive/i);
    expect(OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK).toMatch(/never Missed/i);
  });
});

describe("buildDetectionRunStepMarker", () => {
  it("mints allowlisted unique markers bound to run and step", () => {
    const first = buildDetectionRunStepMarker({
      runId: RUN_ID,
      stepId: STEP_ID
    });
    const second = buildDetectionRunStepMarker({
      runId: RUN_ID,
      stepId: STEP_ID
    });

    expect(first).toMatch(DETECTION_CORRELATION_MARKER_PATTERN);
    expect(second).toMatch(DETECTION_CORRELATION_MARKER_PATTERN);
    expect(first).not.toBe(second);

    const parsed = parseDetectionRunStepMarker(first);
    expect(parsed).toEqual({
      runIdPrefix: RUN_ID.replace(/-/g, "").slice(0, 8),
      stepIdPrefix: STEP_ID.replace(/-/g, "").slice(0, 8)
    });
  });

  it("does not collide across run or step identity", () => {
    const a = buildDetectionRunStepMarker({
      runId: RUN_ID,
      stepId: STEP_ID
    });
    const b = buildDetectionRunStepMarker({
      runId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      stepId: STEP_ID
    });
    const parsedA = parseDetectionRunStepMarker(a);
    const parsedB = parseDetectionRunStepMarker(b);
    expect(parsedA?.runIdPrefix).not.toBe(parsedB?.runIdPrefix);
  });

  it("rejects parsing of non-periscan or truncated tokens", () => {
    expect(parseDetectionRunStepMarker("atomic-live-t1082")).toBeNull();
    expect(parseDetectionRunStepMarker("periscan-")).toBeNull();
    expect(parseDetectionRunStepMarker("periscan-r-aaaa")).toBeNull();
  });
});

describe("eventMatchesCorrelationKeys", () => {
  const marker = "periscan-r-aaaa-s-bbbb-nonce1";

  it("matches only the exact marker plus asset, technique, rule, and event time", () => {
    expect(
      eventMatchesCorrelationKeys({
        event: event(),
        inject: inject({ marker }),
        observation: observation()
      })
    ).toBe(true);
  });

  it("does not match a prefix or neighboring marker", () => {
    expect(
      eventMatchesCorrelationKeys({
        event: event({ marker: `${marker}extra` }),
        inject: inject({ marker }),
        observation: observation()
      })
    ).toBe(false);
    expect(
      eventMatchesCorrelationKeys({
        event: event({ marker: "periscan-r-aaaa-s-bbbb-nonce2" }),
        inject: inject({ marker }),
        observation: observation()
      })
    ).toBe(false);
  });

  it("requires asset, technique, and expected rule when both sides declare them", () => {
    expect(
      eventMatchesCorrelationKeys({
        event: event({ assetId: OTHER_ASSET }),
        inject: inject(),
        observation: observation()
      })
    ).toBe(false);
    expect(
      eventMatchesCorrelationKeys({
        event: event({ techniqueId: "T1082" }),
        inject: inject(),
        observation: observation()
      })
    ).toBe(false);
    expect(
      eventMatchesCorrelationKeys({
        event: event({ ruleId: "sigma.other" }),
        inject: inject(),
        observation: observation()
      })
    ).toBe(false);
  });

  it("rejects events outside the observation window", () => {
    expect(
      eventMatchesCorrelationKeys({
        event: event({ observedAt: "2026-09-17T13:59:59.000Z" }),
        inject: inject(),
        observation: observation()
      })
    ).toBe(false);
    expect(
      eventMatchesCorrelationKeys({
        event: event({ observedAt: "2026-09-17T14:10:01.000Z" }),
        inject: inject(),
        observation: observation()
      })
    ).toBe(false);
  });

  it("matches marker text embedded in a payload only as an exact token", () => {
    expect(
      eventMatchesCorrelationKeys({
        event: event({
          marker: undefined,
          payload: `host=box rule=sigma.proc_canary ${marker} outcome=Alerted`
        }),
        inject: inject({ marker }),
        observation: observation()
      })
    ).toBe(true);
    expect(
      eventMatchesCorrelationKeys({
        event: event({
          marker: undefined,
          payload: `${marker}extra still looks similar`
        }),
        inject: inject({ marker }),
        observation: observation()
      })
    ).toBe(false);
  });
});

describe("observerHealthAllowsMissed", () => {
  it("allows Missed only when the observer is Healthy inside the window", () => {
    expect(observerHealthAllowsMissed(observer())).toBe(true);
  });

  it("refuses Missed on degraded, unhealthy, unknown, or missing heartbeat", () => {
    expect(
      observerHealthAllowsMissed(observer({ healthStatus: "Degraded" }))
    ).toBe(false);
    expect(
      observerHealthAllowsMissed(observer({ healthStatus: "Unhealthy" }))
    ).toBe(false);
    expect(
      observerHealthAllowsMissed(observer({ healthStatus: "Unknown" }))
    ).toBe(false);
    expect(
      observerHealthAllowsMissed(observer({ telemetryStatus: "Unhealthy" }))
    ).toBe(false);
    expect(
      observerHealthAllowsMissed(
        observer({ lastHeartbeatAt: null, lastValidatedAt: null })
      )
    ).toBe(false);
    expect(
      observerHealthAllowsMissed(
        observer({
          lastHeartbeatAt: "2026-09-17T13:50:00.000Z",
          lastValidatedAt: "2026-09-17T13:50:00.000Z"
        })
      )
    ).toBe(false);
  });
});

describe("evaluateObserverHealthWindow", () => {
  it("prefers a covering Healthy series over lastValidatedAt", () => {
    const assessed = evaluateObserverHealthWindow(
      observer({
        healthSamples: coveringHealthySeries(),
        lastValidatedAt: "2026-09-17T13:00:00.000Z"
      })
    );
    expect(assessed.allowsMissed).toBe(true);
    expect(assessed.coverage).toBe("series");
    expect(assessed.healthy).toBe(true);
    expect(assessed.stale).toBe(false);
    expect(assessed.outage).toBe(false);
  });

  it("treats an in-window Unhealthy sample as an outage even when lastValidatedAt is Healthy", () => {
    const assessed = evaluateObserverHealthWindow(
      observer({
        healthSamples: [
          healthSample(WINDOW_START),
          healthSample("2026-09-17T14:05:00.000Z", "Unhealthy", "Unknown"),
          healthSample(WINDOW_END)
        ],
        lastValidatedAt: "2026-09-17T14:09:00.000Z"
      })
    );
    expect(assessed.allowsMissed).toBe(false);
    expect(assessed.coverage).toBe("series");
    expect(assessed.outage).toBe(true);
  });

  it("does not allow Missed when the series fails to cover the window", () => {
    const assessed = evaluateObserverHealthWindow(
      observer({
        healthSamples: [healthSample("2026-09-17T14:05:00.000Z")],
        lastHeartbeatAt: "2026-09-17T14:05:00.000Z",
        lastValidatedAt: "2026-09-17T14:05:00.000Z"
      })
    );
    expect(assessed.allowsMissed).toBe(false);
    expect(assessed.coverage).toBe("series");
    expect(assessed.reason).toMatch(/does not cover/i);
  });

  it("marks lastValidatedAt after the window as stale fallback, never Missed", () => {
    const assessed = evaluateObserverHealthWindow(
      observer({
        healthSamples: [],
        lastHeartbeatAt: "2026-09-17T14:20:00.000Z",
        lastValidatedAt: "2026-09-17T14:20:00.000Z"
      })
    );
    expect(assessed.allowsMissed).toBe(false);
    expect(assessed.coverage).toBe("lastValidatedAt_fallback");
    expect(assessed.stale).toBe(true);
    expect(assessed.reason).toMatch(/stale/i);
  });

  it("marks lastValidatedAt before the window as stale fallback, never Missed", () => {
    const assessed = evaluateObserverHealthWindow(
      observer({
        healthSamples: null,
        lastHeartbeatAt: "2026-09-17T13:50:00.000Z",
        lastValidatedAt: "2026-09-17T13:50:00.000Z"
      })
    );
    expect(assessed.allowsMissed).toBe(false);
    expect(assessed.stale).toBe(true);
  });

  it("treats a missing observer as not Missed-eligible", () => {
    const assessed = evaluateObserverHealthWindow(null);
    expect(assessed.allowsMissed).toBe(false);
    expect(assessed.missingObserver).toBe(true);
    expect(assessed.coverage).toBe("none");
  });

  it("treats a persisted stale series as Inconclusive, never Missed", () => {
    const persisted = [
      healthSample("2026-09-17T13:40:00.000Z"),
      healthSample("2026-09-17T13:50:00.000Z")
    ];
    const assessed = evaluateObserverHealthWindow(
      observer({
        healthSamples: persisted,
        lastValidatedAt: "2026-09-17T13:50:00.000Z"
      })
    );
    expect(assessed.allowsMissed).toBe(false);
    expect(assessed.stale).toBe(true);
    expect(assessed.coverage).toBe("series");
    expect(
      correlateDetectionObservation({
        events: [],
        inject: inject(),
        observation: observation({ windowComplete: true }),
        observer: observer({ healthSamples: persisted })
      }).verdict
    ).toBe("Inconclusive");
  });

  it("does not treat persisted health samples as detection events", () => {
    const persisted = coveringHealthySeries();
    const result = correlateDetectionObservation({
      events: persisted.map((sample, index) => ({
        eventId: `health-${index}`,
        observedAt: sample.observedAt,
        outcome: "Detected",
        payload: `observer health ${sample.healthStatus}`
      })),
      inject: inject(),
      observation: observation({ windowComplete: true }),
      observer: observer({ healthSamples: persisted })
    });
    expect(result.matchedEventIds).toEqual([]);
    expect(result.verdict).toBe("Missed");
    expect(result.observerHealthCoverage).toBe("series");
  });
});

describe("correlateDetectionObservation", () => {
  it("returns Inconclusive when there is no inject receipt", () => {
    const result = correlateDetectionObservation({
      events: [event()],
      inject: inject({ emitted: false }),
      observation: observation(),
      observer: observer()
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.missedEligible).toBe(false);
    expect(result.reason).toMatch(/inject receipt/i);
  });

  it("returns Executed while the window is still open and no control event matched", () => {
    const result = correlateDetectionObservation({
      events: [],
      inject: inject(),
      observation: observation({ windowComplete: false }),
      observer: observer()
    });
    expect(result.verdict).toBe("Executed");
    expect(result.stage).toBe("observe");
    expect(result.missedEligible).toBe(false);
  });

  it("distinguishes prevented, logged, alerted, and routed from matched events", () => {
    expect(
      correlateDetectionObservation({
        events: [event({ outcome: "Blocked" })],
        inject: inject(),
        observation: observation(),
        observer: observer()
      }).verdict
    ).toBe("Prevented");
    expect(
      correlateDetectionObservation({
        events: [event({ outcome: "Logged" })],
        inject: inject(),
        observation: observation(),
        observer: observer()
      }).verdict
    ).toBe("Logged");
    expect(
      correlateDetectionObservation({
        events: [event({ outcome: "Detected" })],
        inject: inject(),
        observation: observation(),
        observer: observer()
      }).verdict
    ).toBe("Alerted");
    expect(
      correlateDetectionObservation({
        events: [event({ outcome: "Routed" })],
        inject: inject(),
        observation: observation(),
        observer: observer()
      }).verdict
    ).toBe("Routed");
  });

  it("does not invent a detection from unrelated telemetry", () => {
    const result = correlateDetectionObservation({
      events: [
        event({
          marker: "periscan-other",
          outcome: "Alerted",
          payload: "noise from a different canary"
        })
      ],
      inject: inject(),
      observation: observation(),
      observer: observer()
    });
    expect(result.verdict).toBe("Missed");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("claims Missed only after a healthy observer and completed window", () => {
    const result = correlateDetectionObservation({
      events: [],
      inject: inject(),
      observation: observation({ windowComplete: true }),
      observer: observer()
    });
    expect(result.verdict).toBe("Missed");
    expect(result.missedEligible).toBe(true);
    expect(result.stage).toBe("verdict");
  });

  it("claims Missed when a Healthy series covers the observation window", () => {
    const result = correlateDetectionObservation({
      events: [],
      inject: inject(),
      observation: observation({ windowComplete: true }),
      observer: observer({ healthSamples: coveringHealthySeries() })
    });
    expect(result.verdict).toBe("Missed");
    expect(result.missedEligible).toBe(true);
    expect(result.observerHealthCoverage).toBe("series");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("treats observer outages as Inconclusive, never Missed", () => {
    const result = correlateDetectionObservation({
      events: [],
      inject: inject(),
      observation: observation({ windowComplete: true }),
      observer: observer({ healthStatus: "Unhealthy" })
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.missedEligible).toBe(false);
    expect(result.reason).toMatch(/outage|not healthy/i);
  });

  it("treats an in-window series outage as Inconclusive even if lastValidatedAt is Healthy", () => {
    const result = correlateDetectionObservation({
      events: [],
      inject: inject(),
      observation: observation({ windowComplete: true }),
      observer: observer({
        healthSamples: [
          healthSample(WINDOW_START),
          healthSample("2026-09-17T14:04:00.000Z", "Unhealthy", "Unhealthy"),
          healthSample(WINDOW_END)
        ]
      })
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.missedEligible).toBe(false);
    expect(result.reason).toMatch(/outage/i);
  });

  it("returns Inconclusive for a missing observer, never Missed", () => {
    const result = correlateDetectionObservation({
      events: [],
      inject: inject(),
      observation: observation({ windowComplete: true }),
      observer: null
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.missedEligible).toBe(false);
    expect(result.reason).toMatch(/no observer/i);
  });

  it("returns Inconclusive for stale lastValidatedAt after the window, never Missed", () => {
    const result = correlateDetectionObservation({
      events: [],
      inject: inject(),
      observation: observation({ windowComplete: true }),
      observer: observer({
        healthSamples: [],
        lastHeartbeatAt: "2026-09-17T14:45:00.000Z",
        lastValidatedAt: "2026-09-17T14:45:00.000Z"
      })
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.missedEligible).toBe(false);
    expect(result.observerHealthStale).toBe(true);
    expect(result.reason).toMatch(/stale/i);
  });

  it("returns Inconclusive for stale lastValidatedAt before the window, never Missed", () => {
    const result = correlateDetectionObservation({
      events: [],
      inject: inject(),
      observation: observation({ windowComplete: true }),
      observer: observer({
        healthSamples: [],
        lastHeartbeatAt: "2026-09-17T13:00:00.000Z",
        lastValidatedAt: "2026-09-17T13:00:00.000Z"
      })
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.missedEligible).toBe(false);
    expect(result.observerHealthStale).toBe(true);
  });

  it("does not promote unmatched events to Alerted", () => {
    const result = correlateDetectionObservation({
      events: [
        event({
          assetId: OTHER_ASSET,
          outcome: "Alerted"
        })
      ],
      inject: inject(),
      observation: observation(),
      observer: observer()
    });
    expect(result.verdict).not.toBe("Alerted");
    expect(["Missed", "Inconclusive"]).toContain(result.verdict);
  });
});

describe("gateMissedByObserverHealth", () => {
  it("downgrades stored Missed to Inconclusive without a healthy observer", () => {
    expect(
      gateMissedByObserverHealth("Missed", {
        healthStatus: "Unhealthy",
        telemetryStatus: "Healthy"
      })
    ).toBe("Inconclusive");
    expect(
      gateMissedByObserverHealth("Missed", {
        healthStatus: "Healthy",
        telemetryStatus: "Healthy"
      })
    ).toBe("Missed");
    expect(
      gateMissedByObserverHealth("Prevented", {
        healthStatus: "Unhealthy",
        telemetryStatus: "Unknown"
      })
    ).toBe("Prevented");
  });

  it("downgrades stored Missed when lastValidatedAt is stale relative to the window", () => {
    expect(
      gateMissedByObserverHealth("Missed", {
        healthStatus: "Healthy",
        lastValidatedAt: "2026-09-17T14:45:00.000Z",
        telemetryStatus: "Healthy",
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      })
    ).toBe("Inconclusive");
    expect(
      gateMissedByObserverHealth("Missed", {
        healthStatus: "Healthy",
        lastValidatedAt: "2026-09-17T14:09:00.000Z",
        telemetryStatus: "Healthy",
        windowEnd: WINDOW_END,
        windowStart: WINDOW_START
      })
    ).toBe("Missed");
    expect(gateMissedByObserverHealth("Missed", null)).toBe("Inconclusive");
  });
});

describe("correlateStimulusObservation", () => {
  const stimulusBase = {
    dispatchReceiptPresent: true,
    injectedAt: INJECTED_AT,
    marker: "periscan-r-aaaa-s-bbbb-nonce1",
    observationDeadlineAt: WINDOW_END,
    observerHealthStatus: "Healthy",
    observerTelemetryStatus: "Healthy",
    runId: RUN_ID,
    stepId: STEP_ID,
    stimulusStatus: "Completed",
    techniqueId: "T1059",
    windowStart: WINDOW_START
  };

  it("allows Missed via in-window lastValidatedAt fallback when no series exists", () => {
    const result = correlateStimulusObservation({
      ...stimulusBase,
      observerLastValidatedAt: "2026-09-17T14:09:00.000Z"
    });
    expect(result.verdict).toBe("Missed");
    expect(result.observerHealthCoverage).toBe("lastValidatedAt_fallback");
    expect(result.matchedEventIds).toEqual([]);
  });

  it("returns Inconclusive when lastValidatedAt is past the observation window", () => {
    const result = correlateStimulusObservation({
      ...stimulusBase,
      observerLastValidatedAt: "2026-09-17T14:45:00.000Z"
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.observerHealthStale).toBe(true);
    expect(result.missedEligible).toBe(false);
  });

  it("returns Inconclusive when no observer health exists", () => {
    const result = correlateStimulusObservation({
      ...stimulusBase,
      observerHealthStatus: "Unknown",
      observerLastValidatedAt: null,
      observerTelemetryStatus: "Unknown"
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.missedEligible).toBe(false);
  });

  it("does not invent detections from a health-sample series", () => {
    const result = correlateStimulusObservation({
      ...stimulusBase,
      observerHealthSamples: coveringHealthySeries(),
      observerLastValidatedAt: "2026-09-17T14:09:00.000Z"
    });
    expect(result.matchedEventIds).toEqual([]);
    expect(result.verdict).toBe("Missed");
    expect(result.observerHealthCoverage).toBe("series");
  });

  it("downgrades a stored Missed when the observer series shows an outage", () => {
    const result = correlateStimulusObservation({
      ...stimulusBase,
      observerHealthSamples: [
        healthSample(WINDOW_START, "Unhealthy", "Unhealthy"),
        healthSample(WINDOW_END, "Unhealthy", "Unhealthy")
      ],
      observerLastValidatedAt: "2026-09-17T14:09:00.000Z",
      storedVerdict: "Missed"
    });
    expect(result.verdict).toBe("Inconclusive");
    expect(result.missedEligible).toBe(false);
  });
});

describe("mapDetectionCorrelationToEffectiveness", () => {
  it("maps correlation verdicts onto the canonical effectiveness atom", () => {
    expect(mapDetectionCorrelationToEffectiveness("Prevented")).toBe(
      "Prevented"
    );
    expect(mapDetectionCorrelationToEffectiveness("Alerted")).toBe("Detected");
    expect(mapDetectionCorrelationToEffectiveness("Routed")).toBe("Detected");
    expect(mapDetectionCorrelationToEffectiveness("Logged")).toBe(
      "TelemetryOnly"
    );
    expect(mapDetectionCorrelationToEffectiveness("Missed")).toBe("Missed");
    expect(mapDetectionCorrelationToEffectiveness("Executed")).toBe(
      "Inconclusive"
    );
    expect(mapDetectionCorrelationToEffectiveness("Inconclusive")).toBe(
      "Inconclusive"
    );
  });

  it("does not let effectiveness invent Prevented from an inconclusive correlation", () => {
    expect(
      deriveControlEffectivenessState({
        observationAttempted: true,
        observationCompleted: true,
        verdict: "Inconclusive"
      })
    ).toBe("Inconclusive");
  });
});
