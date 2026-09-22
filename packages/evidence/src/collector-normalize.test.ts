import { describe, expect, it } from "vitest";

import {
  COLLECTOR_NORMALIZE_LAW,
  correlateCollectorObservation,
  normalizeCollectorPayload
} from "./collector-normalize";

describe("evidence collector-normalize re-export", () => {
  it("exposes the shared OpenAEV-style collector contract for inject verdicts", () => {
    expect(COLLECTOR_NORMALIZE_LAW).toMatch(/does not invent/i);
    const empty = normalizeCollectorPayload({
      payload: { results: [] },
      vendor: "splunk"
    });
    expect(empty.detectionCount).toBe(0);
    expect(
      correlateCollectorObservation({
        inject: {
          emitted: true,
          injectedAt: "2026-09-17T14:00:05.000Z",
          marker: "periscan-r-aaaa-s-bbbb-nonce1",
          runId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          stepId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        },
        observation: {
          windowComplete: true,
          windowEnd: "2026-09-17T14:10:00.000Z",
          windowStart: "2026-09-17T14:00:00.000Z"
        },
        observer: {
          healthStatus: "Healthy",
          lastValidatedAt: "2026-09-17T13:00:00.000Z",
          telemetryStatus: "Healthy",
          windowEnd: "2026-09-17T14:10:00.000Z",
          windowStart: "2026-09-17T14:00:00.000Z"
        },
        payload: { hits: { hits: [] } },
        vendor: "elastic"
      }).verdict
    ).toBe("Inconclusive");
  });
});
