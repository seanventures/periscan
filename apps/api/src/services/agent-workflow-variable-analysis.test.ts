import { describe, expect, it } from "vitest";

import type {
  AgentWorkflowEvent,
  AgentWorkflowRunDetail
} from "@periscan/shared";

import { buildAgentWorkflowVariableAnalysis } from "./agent-workflows.js";

const timestamp = "2026-07-16T16:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const runId = "33333333-3333-4333-8333-333333333333";
const definitionId = "44444444-4444-4444-8444-444444444444";
const evidenceId = "55555555-5555-4555-8555-555555555555";

function event(
  input: Partial<AgentWorkflowEvent> &
    Pick<AgentWorkflowEvent, "eventType" | "sequence">
): AgentWorkflowEvent {
  return {
    costMicrousd: null,
    createdAt: timestamp,
    eventHash: input.sequence.padStart(64, "0"),
    evidenceIds: [],
    latencyMs: null,
    modelProvider: null,
    modelVersion: null,
    payloadRedacted: {},
    policyDecisionId: null,
    previousEventHash: null,
    stepKey: null,
    tenantId,
    toolRequestId: null,
    workflowEventId: `66666666-6666-4666-8666-66666666666${input.sequence}`,
    workflowRunId: runId,
    ...input
  } as AgentWorkflowEvent;
}

function detail(): AgentWorkflowRunDetail {
  return {
    checkpoints: [],
    definition: {
      createdAt: timestamp,
      createdBy: userId,
      definitionHash: "a".repeat(64),
      name: "Variable analysis test",
      purpose: "Verify redacted historical variable derivation.",
      steps: [
        {
          dependsOn: [],
          name: "Build context",
          stepKey: "context",
          stepKind: "Context"
        },
        {
          dependsOn: ["context"],
          name: "Analyze",
          stepKey: "model",
          stepKind: "Model"
        },
        {
          dependsOn: ["model"],
          name: "Branch",
          stepKey: "transition",
          stepKind: "Transition"
        }
      ],
      tenantId,
      version: 1,
      workflowDefinitionId: definitionId
    },
    events: [
      event({
        eventType: "StepStarted",
        payloadRedacted: {
          contextSourceRefs: ["scope:verified"],
          retainedItemCount: 1
        },
        sequence: "1",
        stepKey: "context"
      }),
      event({
        costMicrousd: "880",
        eventType: "ModelResponse",
        evidenceIds: [evidenceId],
        latencyMs: 284,
        modelProvider: "Demo fixture",
        modelVersion: "demo-v1",
        payloadRedacted: { evidenceGrounded: true, status: "Completed" },
        sequence: "2",
        stepKey: "model"
      }),
      event({
        eventType: "Transition",
        payloadRedacted: { branch: "review", next: "complete" },
        sequence: "3",
        stepKey: "transition"
      }),
      event({
        eventType: "Transition",
        payloadRedacted: { branch: "complete", next: "archive" },
        sequence: "4",
        stepKey: "transition"
      })
    ],
    flightRecorderValid: true,
    run: {
      createdAt: timestamp,
      createdBy: userId,
      definitionVersion: 1,
      endedAt: timestamp,
      evidenceIds: [evidenceId],
      evidenceManifestHash: "b".repeat(64),
      forkedFromCheckpointId: null,
      forkedFromRunId: null,
      inputHash: "c".repeat(64),
      inputManifest: {
        mode: "PlanOnly",
        purpose: "Inspect persisted references",
        storedPromptText: false
      },
      modelSessionId: null,
      policyDecisionIds: [],
      policySnapshotHash: "d".repeat(64),
      reusedThroughSequence: null,
      startedAt: timestamp,
      status: "Completed",
      tenantId,
      workflowDefinitionId: definitionId,
      workflowRunId: runId
    }
  };
}

describe("workflow variable analysis", () => {
  it("derives cumulative redacted snapshots and exact change history", () => {
    const analysis = buildAgentWorkflowVariableAnalysis(
      detail(),
      new Date(timestamp)
    );

    expect(analysis).toMatchObject({
      integrityVerified: true,
      summary: {
        eventCount: 4,
        snapshotCount: 5,
        totalCostMicrousd: "880",
        totalLatencyMs: 284
      },
      workflowRunId: runId
    });
    expect(analysis.namespaceCounts.Input).toBeGreaterThan(0);
    expect(analysis.namespaceCounts.Model).toBeGreaterThan(0);
    expect(analysis.namespaceCounts.Performance).toBeGreaterThan(0);
    expect(analysis.variables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          changeCount: 1,
          key: "transition.transition.manifest.branch",
          latestValuePreview: "complete",
          observationCount: 2
        })
      ])
    );
    expect(JSON.stringify(analysis)).toContain(
      "raw prompts, responses, credentials"
    );
  });
});
