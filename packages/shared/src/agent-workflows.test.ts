import { describe, expect, it } from "vitest";

import {
  evaluateAgentWorkflowQuality,
  type AgentWorkflowEvent,
  type AgentWorkflowRunDetail
} from "./agent-workflows.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const runId = "22222222-2222-4222-8222-222222222222";
const evidenceId = "33333333-3333-4333-8333-333333333333";
const policyId = "44444444-4444-4444-8444-444444444444";
const toolRequestId = "55555555-5555-4555-8555-555555555555";
const now = "2026-07-15T12:00:00.000Z";

function event(
  sequence: number,
  input: Partial<AgentWorkflowEvent> &
    Pick<AgentWorkflowEvent, "eventType" | "stepKey">
): AgentWorkflowEvent {
  return {
    costMicrousd: null,
    createdAt: now,
    eventHash: String(sequence).padStart(64, "0"),
    evidenceIds: [],
    latencyMs: null,
    modelProvider: null,
    modelVersion: null,
    payloadRedacted: {},
    policyDecisionId: null,
    previousEventHash:
      sequence === 1 ? null : String(sequence - 1).padStart(64, "0"),
    sequence: String(sequence),
    tenantId,
    toolRequestId: null,
    workflowEventId: `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    workflowRunId: runId,
    ...input
  };
}

function detail(events: AgentWorkflowEvent[]): AgentWorkflowRunDetail {
  return {
    checkpoints: [],
    definition: {
      createdAt: now,
      createdBy: "66666666-6666-4666-8666-666666666666",
      definitionHash: "a".repeat(64),
      name: "Evaluated analyst",
      purpose: "Evaluate grounded workflow quality.",
      steps: [
        {
          dependsOn: [],
          name: "Analyze",
          stepKey: "model",
          stepKind: "Model"
        },
        {
          dependsOn: ["model"],
          name: "Validate",
          stepKey: "tool",
          stepKind: "Tool",
          toolName: "validation.run"
        },
        {
          dependsOn: ["tool"],
          name: "Bind evidence",
          stepKey: "evidence",
          stepKind: "Evidence"
        }
      ],
      tenantId,
      version: 1,
      workflowDefinitionId: "77777777-7777-4777-8777-777777777777"
    },
    events,
    flightRecorderValid: true,
    run: {
      createdAt: now,
      createdBy: "66666666-6666-4666-8666-666666666666",
      definitionVersion: 1,
      endedAt: now,
      evidenceIds: [evidenceId],
      evidenceManifestHash: "b".repeat(64),
      forkedFromCheckpointId: null,
      forkedFromRunId: null,
      inputHash: "c".repeat(64),
      inputManifest: {},
      modelSessionId: null,
      policyDecisionIds: [policyId],
      policySnapshotHash: "d".repeat(64),
      reusedThroughSequence: null,
      startedAt: now,
      status: "Completed",
      tenantId,
      workflowDefinitionId: "77777777-7777-4777-8777-777777777777",
      workflowRunId: runId
    }
  };
}

describe("evaluateAgentWorkflowQuality", () => {
  it("certifies a complete, grounded, policy-linked run", () => {
    const evaluation = evaluateAgentWorkflowQuality(
      detail([
        event(1, {
          eventType: "ModelResponse",
          evidenceIds: [evidenceId],
          modelProvider: "OpenAI",
          modelVersion: "gpt-evaluated",
          stepKey: "model"
        }),
        event(2, {
          eventType: "PolicyDecision",
          policyDecisionId: policyId,
          stepKey: "tool"
        }),
        event(3, {
          eventType: "ToolResult",
          evidenceIds: [evidenceId],
          policyDecisionId: policyId,
          stepKey: "tool",
          toolRequestId
        }),
        event(4, {
          eventType: "EvidenceAttached",
          evidenceIds: [evidenceId],
          stepKey: "evidence"
        })
      ]),
      new Date(now)
    );

    expect(evaluation).toMatchObject({
      findings: [],
      score: 100,
      status: "Ready",
      workflowRunId: runId
    });
  });

  it("identifies ungrounded, ungoverned, incomplete analyst activity", () => {
    const input = detail([
      event(1, {
        eventType: "ModelResponse",
        modelProvider: "OpenAI",
        modelVersion: null,
        stepKey: "model"
      })
    ]);
    input.run = { ...input.run, endedAt: null, status: "Running" };
    const evaluation = evaluateAgentWorkflowQuality(input, new Date(now));

    expect(evaluation.status).toBe("NeedsEvidence");
    expect(evaluation.score).toBeLessThan(60);
    expect(evaluation.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining([
        "IncompleteStepCoverage",
        "ModelIdentityGap",
        "RunNotCompleted",
        "ToolPolicyGap",
        "UngroundedClaimEvents"
      ])
    );
  });
});
