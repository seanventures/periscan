import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RemediationAction } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { GovernedRemediationAction } from "./governed-remediation-action";

const timestamp = "2026-07-14T22:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const remediationId = "22222222-2222-4222-8222-222222222222";
const controlSourceId = "33333333-3333-4333-8333-333333333333";
const integrationId = "44444444-4444-4444-8444-444444444444";
const remediationActionId = "55555555-5555-4555-8555-555555555555";
const previewHash = "a".repeat(64);

function action(state: RemediationAction["state"]): RemediationAction {
  return {
    actionType: "ControlExpectationTuning",
    appliedAt: state === "Applied" ? timestamp : null,
    applicationReceipt:
      state === "Applied" ? { nextRequiredAction: "RunFixVerification" } : null,
    approvedAt: ["Approved", "Applied", "RolledBack"].includes(state)
      ? timestamp
      : null,
    approvedBy: ["Approved", "Applied", "RolledBack"].includes(state)
      ? tenantId
      : null,
    createdAt: timestamp,
    failureReason: null,
    idempotencyKey: `${remediationId}:${controlSourceId}:Alerted-Detected`,
    manifest: {
      actionType: "ControlExpectationTuning",
      approvalRoles: ["Owner", "Admin", "SecurityEngineer"],
      blastRadius: "Changes only Periscan expected behavior.",
      description: "Tune expectations.",
      evidenceProduced: ["Exact preview hash", "Application receipt"],
      exactDiff: {
        after: ["Detected", "Alerted"],
        before: ["Detected"],
        field: "expectedBehaviors"
      },
      expectedWriteOperations: ["Update expectation"],
      preconditions: ["Exact preview remains current"],
      requiredPermissions: ["Security Engineer"],
      rollback: { available: true, operation: "Restore before value" },
      target: {
        controlSourceId,
        integrationId,
        provider: "Splunk"
      },
      title: "Tune Splunk expectations",
      verification: {
        method: "Run FixVerification",
        required: true,
        successDoesNotEqualFixed: true
      }
    },
    previewHash,
    remediationActionId,
    remediationId,
    rollbackReceipt: state === "RolledBack" ? { restored: ["Detected"] } : null,
    rolledBackAt: state === "RolledBack" ? timestamp : null,
    state,
    targetEntityId: controlSourceId,
    tenantId,
    updatedAt: timestamp
  };
}

describe("GovernedRemediationAction", () => {
  afterEach(() => vi.restoreAllMocks());

  it("previews, approves, applies, and rolls back the exact hashed diff", async () => {
    vi.spyOn(api, "listControlSources").mockResolvedValue([
      {
        controlSourceId,
        controlType: "SIEM",
        createdAt: timestamp,
        expectedBehaviors: ["Detected"],
        healthStatus: "Healthy",
        integrationId,
        lastValidatedAt: timestamp,
        provider: "Splunk",
        telemetryStatus: "Healthy",
        tenantId,
        updatedAt: timestamp
      }
    ]);
    vi.spyOn(api, "listRemediationActions").mockResolvedValue([]);
    const preview = vi
      .spyOn(api, "previewRemediationAction")
      .mockResolvedValue(action("AwaitingApproval"));
    const confirm = vi
      .spyOn(api, "confirmRemediationAction")
      .mockResolvedValueOnce(action("Approved"))
      .mockResolvedValueOnce(action("Applied"))
      .mockResolvedValueOnce(action("RolledBack"));

    render(<GovernedRemediationAction remediationId={remediationId} />);

    fireEvent.click(await screen.findByRole("checkbox", { name: "Alerted" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview exact diff" }));
    await waitFor(() =>
      expect(preview).toHaveBeenCalledWith(
        remediationId,
        expect.objectContaining({
          actionType: "ControlExpectationTuning",
          controlSourceId,
          nextExpectedBehaviors: ["Detected", "Alerted"]
        })
      )
    );
    expect(await screen.findByText(previewHash)).toBeInTheDocument();
    expect(
      screen.getByText("Applied ≠ Fixed · Run FixVerification")
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve exact hash" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Apply governed action" })
    );
    expect(
      await screen.findByText("Applied · verification required")
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Roll back exact diff" })
    );
    expect(await screen.findByText("RolledBack")).toBeInTheDocument();
    expect(confirm).toHaveBeenNthCalledWith(
      1,
      remediationActionId,
      "approve",
      previewHash
    );
    expect(confirm).toHaveBeenNthCalledWith(
      2,
      remediationActionId,
      "execute",
      previewHash
    );
    expect(confirm).toHaveBeenNthCalledWith(
      3,
      remediationActionId,
      "rollback",
      previewHash
    );
  });
});
