import { describe, expect, it } from "vitest";

import {
  analyzeAgentBehavior,
  type AgentBehaviorRunInput
} from "./agent-behavior.js";

const tenantId = "11111111-1111-4111-8111-111111111111";

function quietRun(index: number): AgentBehaviorRunInput {
  return {
    createdAt: new Date(`2026-07-${10 + index}T12:00:00.000Z`),
    events: [],
    status: "Completed",
    toolRequests: [],
    usageCostsMicrousd: [],
    workflowRunId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`
  };
}

describe("agent behavior analysis", () => {
  it("explains approval, denial, velocity, scope, and cost signals from durable records", () => {
    const suspicious = quietRun(9);
    suspicious.usageCostsMicrousd = [1_000_000n];
    suspicious.toolRequests = Array.from({ length: 12 }, (_, index) => ({
      approvedAt: null,
      createdAt: new Date("2026-07-15T12:00:00.000Z"),
      scopeIds: [
        `10000000-0000-4000-8000-${String(index % 6).padStart(12, "0")}`
      ],
      status: index < 3 ? "Denied" : index === 3 ? "Completed" : "Allowed",
      toolName: index === 3 ? "dangerous.write" : "safe.read",
      toolRequestId: `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`
    }));

    const report = analyzeAgentBehavior({
      approvalRequiredTools: new Set(["dangerous.write"]),
      generatedAt: new Date("2026-07-15T13:00:00.000Z"),
      runs: [quietRun(1), quietRun(2), quietRun(3), suspicious],
      tenantId
    });

    expect(report.findings.map((item) => item.ruleId)).toEqual(
      expect.arrayContaining([
        "ApprovalIntegrity",
        "PolicyDenialBurst",
        "ToolVelocityOutlier",
        "ScopeFanOut",
        "CostOutlier"
      ])
    );
    expect(report.findings.every((item) => item.evidenceRefs.length > 0)).toBe(
      true
    );
    expect(report.methodology).toContain("not a trained anomaly model");
  });
});
