import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { EngagementResultSchema, ScenarioBundleSchema } from "@periscan/shared";

import { ScenarioFeedbackLoop } from "./scenario-feedback-loop";

const timestamp = "2026-07-16T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";
const scenarioBundleId = "44444444-4444-4444-8444-444444444444";
const engagementId = "55555555-5555-4555-8555-555555555555";
const evidenceId = "66666666-6666-4666-8666-666666666666";
const compiledHash = "a".repeat(64);

const scenario = ScenarioBundleSchema.parse({
  allowedScopeTypes: ["Domain"],
  approvedAt: timestamp,
  approvedBy: userId,
  bundleVersion: 1,
  compiledAt: timestamp,
  compiledHash,
  createdAt: timestamp,
  description: "A deterministic DNS feedback graph.",
  expectedObservations: ["DNS evidence persists."],
  feedbackCycleCount: 1,
  feedbackFailedCycleCount: 0,
  feedbackLastCompletedAt: timestamp,
  feedbackLastReason: "Confirm the release control still produces evidence.",
  feedbackLastReviewReference: "CHANGE-1234",
  feedbackLastStartedAt: timestamp,
  feedbackLastStatus: "Completed",
  intent: "Validate DNS posture with fresh evidence.",
  legalClassification: "PassiveAuthorized",
  maximumIterations: 3,
  name: "DNS release proof",
  prerequisites: ["Verified Domain scope"],
  safetyCeiling: "PassiveReadOnly",
  sbom: [
    {
      executionMode: "ControlPlane",
      moduleId: "periscan.dns_resolution_check",
      safetyLevel: "PassiveReadOnly",
      version: "1.0.0"
    }
  ],
  scenarioBundleId,
  scopeId,
  signature: {
    algorithm: "EdDSA",
    digestSha256: compiledHash,
    keyId: "tenant-signing-key",
    signature: "signed-content"
  },
  source: { kind: "OperatorIntent", reference: null },
  status: "Approved",
  steps: [
    {
      dependsOn: [],
      expectedObservations: ["DNS evidence persists."],
      moduleId: "periscan.dns_resolution_check",
      name: "Resolve DNS",
      stepId: "step-1",
      target: {},
      when: { kind: "Always" }
    },
    {
      dependsOn: ["step-1"],
      expectedObservations: ["Email controls persist."],
      moduleId: "periscan.dns_email_controls",
      name: "Inspect email controls",
      stepId: "step-2",
      target: {},
      when: {
        allowedStatuses: ["executed"],
        kind: "PriorStep",
        minimumEvidenceCount: 1,
        minimumSignalCount: 0,
        stepId: "step-1",
        validationStates: []
      }
    }
  ],
  techniqueIds: ["T1595"],
  tenantId,
  updatedAt: timestamp
});

const cycle = EngagementResultSchema.parse({
  engagementId,
  evidenceIds: [evidenceId],
  feedbackCycleNumber: 1,
  compiledHash,
  generatedAt: timestamp,
  mode: "Execute",
  scenarioBundleId,
  scopeId,
  status: "Completed",
  steps: [
    {
      branchDecision: null,
      evidenceIds: [evidenceId],
      moduleId: "periscan.dns_resolution_check",
      runMode: "AgentLocal",
      signalCount: 1,
      status: "executed",
      stepId: "step-1",
      validationState: "Validated"
    },
    {
      branchDecision: {
        evidence: ["step-1 evidence=1 status=executed"],
        matched: true,
        predicate: {
          allowedStatuses: ["executed"],
          kind: "PriorStep",
          minimumEvidenceCount: 1,
          minimumSignalCount: 0,
          stepId: "step-1",
          validationStates: []
        }
      },
      evidenceIds: [],
      moduleId: "periscan.dns_email_controls",
      runMode: "AgentLocal",
      signalCount: 0,
      status: "executed",
      stepId: "step-2",
      validationState: "Validated"
    }
  ],
  tenantId
});

describe("ScenarioFeedbackLoop", () => {
  it("shows persisted branch evidence and submits an optimistic next-cycle decision", async () => {
    const onRun = vi.fn(async () => undefined);
    const onStop = vi.fn(async () => undefined);
    render(
      <ScenarioFeedbackLoop
        busy={false}
        cycles={[cycle]}
        onRun={onRun}
        onStop={onStop}
        scenario={scenario}
      />
    );

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(
      screen.getByText("step-1 evidence=1 status=executed")
    ).toBeInTheDocument();
    const run = screen.getByRole("button", {
      name: "Run next governed cycle"
    });
    expect(run).toBeDisabled();

    fireEvent.change(
      screen.getByRole("textbox", { name: "Feedback decision reason" }),
      { target: { value: "Revalidate after the approved release change." } }
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Feedback review reference" }),
      { target: { value: "CHANGE-2345" } }
    );
    fireEvent.click(run);

    await waitFor(() =>
      expect(onRun).toHaveBeenCalledWith({
        compiledHash,
        expectedFeedbackCycleCount: 1,
        reason: "Revalidate after the approved release change.",
        reviewReference: "CHANGE-2345"
      })
    );
  });

  it("makes stop terminal and explains that a new signed bundle is required", () => {
    const stopped = ScenarioBundleSchema.parse({
      ...scenario,
      feedbackLastStatus: "Stopped",
      feedbackStopReason:
        "Release review is complete; no further cycle is authorized.",
      feedbackStopReviewReference: "CHANGE-3456",
      feedbackStoppedAt: timestamp,
      feedbackStoppedBy: userId
    });
    render(
      <ScenarioFeedbackLoop
        busy={false}
        cycles={[cycle]}
        onRun={vi.fn(async () => undefined)}
        onStop={vi.fn(async () => undefined)}
        scenario={stopped}
      />
    );

    expect(screen.getByText("Loop stopped")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Run next governed cycle" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("CHANGE-3456")).toBeInTheDocument();
  });
});
