import { describe, expect, it } from "vitest";

import {
  RunnerFleetWorkspaceSchema,
  UpdateRunnerFleetPolicyInputSchema
} from "./runner-fleet.js";

describe("runner fleet contracts", () => {
  it("requires the offline threshold to follow the attention threshold", () => {
    expect(
      UpdateRunnerFleetPolicyInputSchema.safeParse({
        attentionAfterSeconds: 120,
        certificateWarningDays: 14,
        escalationReference: "SECOPS-123",
        minimumAgentVersion: "0.1.0",
        offlineAfterSeconds: 90,
        queueWarningDepth: 10,
        supportOwner: "Security Operations"
      }).success
    ).toBe(false);
  });

  it("parses an honest empty fleet without inventing runner activity", () => {
    const workspace = RunnerFleetWorkspaceSchema.parse({
      generatedAt: "2026-07-16T16:00:00.000Z",
      policy: {
        attentionAfterSeconds: 90,
        certificateWarningDays: 14,
        configured: false,
        escalationReference: null,
        minimumAgentVersion: null,
        offlineAfterSeconds: 300,
        queueWarningDepth: 10,
        supportOwner: null,
        updatedAt: null,
        updatedBy: null
      },
      rulesVersion: "1.0",
      runners: [],
      summary: {
        activeTasks: 0,
        attention: 0,
        completionRate24h: null,
        evidence24h: 0,
        halted: 0,
        healthy: 0,
        offline: 0,
        revoked: 0,
        total: 0
      }
    });

    expect(workspace.runners).toEqual([]);
    expect(workspace.summary.total).toBe(0);
    expect(workspace.policy.configured).toBe(false);
  });
});
