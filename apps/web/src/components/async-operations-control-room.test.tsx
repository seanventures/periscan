import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AsyncOperationsWorkspace,
  AsyncRecoveryDecisionResult
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { AsyncOperationsControlRoom } from "./async-operations-control-room";

const timestamp = "2026-07-16T15:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const workloadId = "33333333-3333-4333-8333-333333333333";
const missionId = "44444444-4444-4444-8444-444444444444";
const runId = "55555555-5555-4555-8555-555555555555";
const recoveryMissionId = "66666666-6666-4666-8666-666666666666";

function workspace(configured = true): AsyncOperationsWorkspace {
  return {
    events: [],
    generatedAt: timestamp,
    limitations: [
      "Targets are reviewed thresholds, not externally audited SLOs."
    ],
    policy: configured
      ? {
          createdAt: timestamp,
          escalationChannel: "#security-operations",
          queueAgeTargetSeconds: 900,
          reviewReference: "OPS-001",
          reviewedAt: timestamp,
          reviewedBy: userId,
          runnerLeaseWarningSeconds: 600,
          runningTimeoutSeconds: 1800,
          supportOwner: "Security Operations",
          tenantId,
          updatedAt: timestamp
        }
      : null,
    summary: {
      activeCount: 0,
      configured,
      health: configured ? "Attention" : "NotConfigured",
      oldestActiveAgeSeconds: 0,
      queuedCount: 0,
      recentSuccessCount: 3,
      runningCount: 0,
      stalledCount: 0,
      terminalFailureCount: 1,
      waitingTooLongCount: 0
    },
    workItems: [
      {
        ageSeconds: 3600,
        attempts: 2,
        availableAt: timestamp,
        completedAt: timestamp,
        createdAt: timestamp,
        detail: "Control-plane job in validation.",
        errorSummary: "Worker exited before reporting a terminal result.",
        expiresAt: null,
        missionId,
        moduleId: null,
        nextAction: "PrepareRecovery",
        operationalState: "TerminalFailure",
        queueName: "validation",
        runId,
        runnerId: null,
        startedAt: timestamp,
        status: "Failed",
        workloadId,
        workloadKind: "ValidationJob"
      }
    ]
  };
}

describe("AsyncOperationsControlRoom", () => {
  afterEach(() => vi.restoreAllMocks());

  it("prepares a policy-gated recovery draft from a selected failed workload", async () => {
    const state = workspace();
    vi.spyOn(api, "getMe").mockResolvedValue({
      membership: { role: "Owner" }
    } as Awaited<ReturnType<typeof api.getMe>>);
    vi.spyOn(api, "getAsyncOperationsWorkspace").mockResolvedValue(state);
    vi.spyOn(api, "recordAsyncRecoveryDecision").mockResolvedValue({
      event: {
        createdAt: timestamp,
        createdBy: userId,
        eventHash: "a".repeat(64),
        eventId: "77777777-7777-4777-8777-777777777777",
        eventType: "RecoveryPrepared",
        integrityVerified: true,
        previousEventHash: null,
        reason: "Prepare a newly reviewed recovery run.",
        recoveryMissionId,
        reference: "INC-2026-0042",
        result: { directReplay: false },
        sequence: 1,
        tenantId,
        workloadId,
        workloadKind: "ValidationJob"
      },
      recoveryMissionId,
      workspace: state
    } satisfies AsyncRecoveryDecisionResult);

    render(<AsyncOperationsControlRoom />);

    expect(
      await screen.findByText(
        "Worker exited before reporting a terminal result."
      )
    ).toBeInTheDocument();
    const references = screen.getAllByLabelText("Decision reference");
    const reasons = screen.getAllByLabelText("Operator reason");
    fireEvent.change(references[0]!, { target: { value: "INC-2026-0042" } });
    fireEvent.change(reasons[0]!, {
      target: { value: "Prepare a newly reviewed recovery run." }
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Prepare recovery draft" })
    );

    await waitFor(() =>
      expect(api.recordAsyncRecoveryDecision).toHaveBeenCalledWith({
        decision: "PrepareRecovery",
        reason: "Prepare a newly reviewed recovery run.",
        reference: "INC-2026-0042",
        workloadId,
        workloadKind: "ValidationJob"
      })
    );
    expect(
      await screen.findByText(/has no policy decision and cannot execute/u)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Review recovery draft" })
    ).toHaveAttribute("href", `/missions/${recoveryMissionId}`);
  });

  it("shows honest setup language when targets have not been reviewed", async () => {
    vi.spyOn(api, "getMe").mockResolvedValue({
      membership: { role: "Viewer" }
    } as Awaited<ReturnType<typeof api.getMe>>);
    vi.spyOn(api, "getAsyncOperationsWorkspace").mockResolvedValue(
      workspace(false)
    );

    render(<AsyncOperationsControlRoom />);

    expect(await screen.findByText("NotConfigured")).toBeInTheDocument();
    expect(
      screen.getByText("Required before reconciliation")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save reviewed targets" })
    ).toBeDisabled();
  });
});
