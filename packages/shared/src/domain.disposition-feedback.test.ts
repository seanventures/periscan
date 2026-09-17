import { describe, expect, it } from "vitest";

import {
  DispositionFeedbackSummarySchema,
  FINDING_DISPOSITION_FINGERPRINT_PREFIX,
  MissionScheduleDetailSchema,
  ProductWorkQueueSchema,
  TransitionFindingInputSchema,
  WEBHOOK_EVENT_TYPES,
  findingDispositionFingerprintKey,
  fingerprintFromDispositionKey,
  isFindingDispositionFingerprintKey
} from "./domain";

describe("wave4 P06/P18 disposition + work-queue residuals", () => {
  it("builds fingerprint disposition keys without colliding with finding ids", () => {
    const key = findingDispositionFingerprintKey("abc123");
    expect(key).toBe(`${FINDING_DISPOSITION_FINGERPRINT_PREFIX}abc123`);
    expect(isFindingDispositionFingerprintKey(key)).toBe(true);
    expect(isFindingDispositionFingerprintKey("path-id")).toBe(false);
    expect(fingerprintFromDispositionKey(key)).toBe("abc123");
  });

  it("allows optional Suppressed revisit via expiresAt", () => {
    const parsed = TransitionFindingInputSchema.parse({
      disposition: "Suppressed",
      reasonCode: "ToolNoise",
      expiresAt: new Date(Date.now() + 86_400_000).toISOString()
    });
    expect(parsed.disposition).toBe("Suppressed");
    expect(parsed.expiresAt).toBeTruthy();
  });

  it("accepts applyToFingerprint opt-out on FP/Suppressed (ICP-P1-1)", () => {
    const muted = TransitionFindingInputSchema.parse({
      disposition: "FalsePositive",
      reasonCode: "ToolNoise",
      applyToFingerprint: true
    });
    expect(muted.applyToFingerprint).toBe(true);
    const optOut = TransitionFindingInputSchema.parse({
      disposition: "Suppressed",
      reasonCode: "Lab",
      applyToFingerprint: false
    });
    expect(optOut.applyToFingerprint).toBe(false);
    const omitted = TransitionFindingInputSchema.parse({
      disposition: "FalsePositive",
      reasonCode: "Benign"
    });
    expect(omitted.applyToFingerprint).toBeUndefined();
  });

  it("counts work-queue total as categories with separate workUnits", () => {
    const queue = ProductWorkQueueSchema.parse({
      generatedAt: new Date().toISOString(),
      items: [
        {
          itemId: "a",
          kind: "NewFinding",
          title: "New findings",
          detail: "triage",
          count: 5,
          urgency: "Soon",
          stage: "Understand",
          href: "/findings",
          oldestAt: null
        },
        {
          itemId: "b",
          kind: "ThreatAlert",
          title: "Alerts",
          detail: "ack",
          count: 3,
          urgency: "Soon",
          stage: "Understand",
          href: "/threat-feed",
          oldestAt: null
        }
      ],
      total: 2,
      workUnits: 8,
      feed: [
        {
          feedId: "f1",
          kind: "NewFinding",
          title: "Critical exposure",
          detail: "needs disposition",
          urgency: "Now",
          stage: "Understand",
          href: "/findings",
          at: null,
          severity: "Critical"
        }
      ]
    });
    expect(queue.total).toBe(2);
    expect(queue.workUnits).toBe(8);
    expect(queue.feed).toHaveLength(1);
  });

  it("includes schedule.failed and finding.disposition_changed in webhook catalog", () => {
    expect(WEBHOOK_EVENT_TYPES).toContain("finding.disposition_changed");
    expect(WEBHOOK_EVENT_TYPES).toContain("schedule.failed");
  });

  it("parses schedule detail with run history", () => {
    const detail = MissionScheduleDetailSchema.parse({
      scheduleId: "11111111-1111-4111-8111-111111111111",
      tenantId: "22222222-2222-4222-8222-222222222222",
      missionType: "ValidationSnapshot",
      createdBy: "33333333-3333-4333-8333-333333333333",
      frequency: "Daily",
      status: "Active",
      nextRunAt: new Date().toISOString(),
      lastRunAt: null,
      lastSnapshotId: null,
      lastMissionId: null,
      scopeIds: [],
      config: {},
      lastDiff: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      runHistory: [
        {
          runId: "run-1",
          at: new Date().toISOString(),
          outcome: "Failed",
          status: "Failed",
          missionId: "44444444-4444-4444-8444-444444444444",
          errorSummary: "policy denied",
          denyReason: null,
          packId: null,
          packType: null,
          diff: null
        }
      ]
    });
    expect(detail.runHistory).toHaveLength(1);
    expect(detail.runHistory[0]?.errorSummary).toBe("policy denied");
  });

  it("parses disposition feedback summary", () => {
    const summary = DispositionFeedbackSummarySchema.parse({
      generatedAt: new Date().toISOString(),
      totalFalsePositive: 1,
      totalSuppressed: 0,
      byReason: [{ reasonCode: "ToolNoise", count: 1 }],
      byFingerprint: [
        {
          fingerprint: "fp-1",
          reasonCode: "ToolNoise",
          disposition: "FalsePositive",
          count: 1,
          source: "signal",
          sampleFindingId: "55555555-5555-4555-8555-555555555555",
          sampleTitle: "noise",
          lastUpdatedAt: new Date().toISOString(),
          expiresAt: null
        }
      ],
      bySource: [{ source: "signal", count: 1 }]
    });
    expect(summary.totalFalsePositive).toBe(1);
  });
});
