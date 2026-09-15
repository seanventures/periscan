import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { AgentBehaviorAnalytics } from "./agent-behavior-analytics";

describe("AgentBehaviorAnalytics", () => {
  afterEach(() => vi.restoreAllMocks());

  it("explains a critical recorder-integrity finding with source references", async () => {
    vi.spyOn(api, "getAgentBehaviorAnalysis").mockResolvedValue({
      baseline: {
        medianCostMicrousd: 1400,
        medianScopeCount: 1,
        medianToolRequests: 2,
        runCount: 6,
        windowDays: 30
      },
      findings: [
        {
          baseline: "Every event must preserve hash-chain integrity.",
          evidenceRefs: ["workflow-event:22222222-2222-4222-8222-222222222222"],
          explanation: "The recomputed event hash does not match.",
          findingKey: "a".repeat(64),
          observed: "3 events; chain verification failed",
          recommendedAction: "Stop checkpoint reuse and investigate.",
          ruleId: "FlightRecorderIntegrity",
          severity: "Critical",
          title: "Workflow recorder integrity failed",
          workflowRunId: "11111111-1111-4111-8111-111111111111"
        }
      ],
      generatedAt: "2026-07-15T12:00:00.000Z",
      methodology: "Explainable deterministic rules over durable records.",
      runs: [
        {
          costMicrousd: 1400,
          deniedToolRequests: 0,
          eventCount: 3,
          failedToolRequests: 0,
          flightRecorderValid: false,
          scopeCount: 1,
          toolRequestCount: 2,
          workflowRunId: "11111111-1111-4111-8111-111111111111"
        }
      ],
      summary: {
        critical: 1,
        high: 0,
        moderate: 0,
        runsAnalyzed: 1,
        runsWithFindings: 1
      },
      tenantId: "33333333-3333-4333-8333-333333333333"
    });

    render(<AgentBehaviorAnalytics />);

    expect(
      await screen.findByText("Workflow recorder integrity failed")
    ).toBeInTheDocument();
    expect(screen.getByText("FlightRecorderIntegrity")).toBeInTheDocument();
    expect(screen.getByText(/workflow-event:22222222/)).toBeInTheDocument();
    expect(screen.getByText(/does not assign intent/i)).toBeInTheDocument();
  });
});
