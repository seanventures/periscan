import { describe, expect, it } from "vitest";

import {
  DETECTION_CORRELATION_LAW,
  OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK,
  buildDetectionRunStepMarker,
  correlateDetectionObservation,
  evaluateObserverHealthWindow,
  observerHealthAllowsMissed
} from "./detection-correlation";

describe("evidence detection-correlation re-export (PERISCAN-590)", () => {
  it("exposes the shared correlation helpers used for inject→observe verdicts", () => {
    expect(DETECTION_CORRELATION_LAW).toMatch(/healthy observer/i);
    expect(OBSERVER_HEALTH_LAST_VALIDATED_FALLBACK).toMatch(/never Missed/i);
    const marker = buildDetectionRunStepMarker({
      runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      stepId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    });
    expect(marker.startsWith("periscan-r")).toBe(true);
    expect(
      observerHealthAllowsMissed({
        healthStatus: "Unhealthy",
        lastHeartbeatAt: "2026-09-17T14:01:00.000Z",
        telemetryStatus: "Healthy",
        windowEnd: "2026-09-17T14:10:00.000Z",
        windowStart: "2026-09-17T14:00:00.000Z"
      })
    ).toBe(false);
    expect(
      evaluateObserverHealthWindow({
        healthSamples: [
          {
            healthStatus: "Healthy",
            observedAt: "2026-09-17T14:00:00.000Z",
            telemetryStatus: "Healthy"
          },
          {
            healthStatus: "Unhealthy",
            observedAt: "2026-09-17T14:05:00.000Z",
            telemetryStatus: "Unknown"
          },
          {
            healthStatus: "Healthy",
            observedAt: "2026-09-17T14:10:00.000Z",
            telemetryStatus: "Healthy"
          }
        ],
        healthStatus: "Healthy",
        lastValidatedAt: "2026-09-17T14:10:00.000Z",
        telemetryStatus: "Healthy",
        windowEnd: "2026-09-17T14:10:00.000Z",
        windowStart: "2026-09-17T14:00:00.000Z"
      }).outage
    ).toBe(true);
    expect(
      correlateDetectionObservation({
        events: [],
        inject: {
          emitted: true,
          injectedAt: "2026-09-17T14:00:05.000Z",
          marker,
          runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          stepId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          techniqueId: "T1059"
        },
        observation: {
          windowComplete: true,
          windowEnd: "2026-09-17T14:10:00.000Z",
          windowStart: "2026-09-17T14:00:00.000Z"
        },
        observer: {
          healthStatus: "Unhealthy",
          lastHeartbeatAt: "2026-09-17T14:01:00.000Z",
          telemetryStatus: "Healthy",
          windowEnd: "2026-09-17T14:10:00.000Z",
          windowStart: "2026-09-17T14:00:00.000Z"
        }
      }).verdict
    ).toBe("Inconclusive");
  });
});
