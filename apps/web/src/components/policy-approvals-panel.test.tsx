import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PolicyDecision } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { PolicyApprovalsPanel } from "./policy-approvals-panel";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("approvalState=Pending")
}));

const timestamp = "2026-07-15T16:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const decisionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const scopeId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function decision(overrides: Partial<PolicyDecision> = {}): PolicyDecision {
  return {
    approvalState: "Pending",
    approvedAt: null,
    approvedBy: null,
    createdAt: timestamp,
    executionEnvironment: "ControlPlane",
    expiresAt: null,
    missionType: "ExposureValidation",
    outcome: "RequiresApproval",
    policyDecisionId: decisionId,
    rationale: "High-impact validation needs a second pair of eyes.",
    requestedAction: {
      credentialTheft: false,
      destructive: false,
      persistence: false,
      realDataExfiltration: false,
      requiresInternalRunner: false,
      requiresTimeWindow: false,
      uncontrolledExploitChaining: false
    },
    safetyLevel: "ControlledValidation",
    scopeId,
    target: { hostname: "example.com" },
    tenantId,
    updatedAt: timestamp,
    userId,
    ...overrides
  };
}

describe("PolicyApprovalsPanel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists pending decisions and approves them (P14-13)", async () => {
    vi.spyOn(api, "listPolicyDecisions")
      .mockResolvedValueOnce([decision()])
      .mockResolvedValue([
        decision({ approvalState: "Approved", approvedAt: timestamp })
      ]);
    const approve = vi
      .spyOn(api, "approvePolicyDecision")
      .mockResolvedValue(
        decision({ approvalState: "Approved", approvedAt: timestamp })
      );

    render(<PolicyApprovalsPanel />);

    expect(
      await screen.findByText(/High-impact validation needs a second pair of eyes/u)
    ).toBeInTheDocument();
    expect(screen.getByText(/1 pending/u)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(approve).toHaveBeenCalledWith(decisionId)
    );
    expect(await screen.findByText(/Approved aaaaaaaa/u)).toBeInTheDocument();
  });

  it("shows empty state when nothing is pending", async () => {
    vi.spyOn(api, "listPolicyDecisions").mockResolvedValue([
      decision({ approvalState: "Approved", approvedAt: timestamp })
    ]);

    render(<PolicyApprovalsPanel />);

    expect(
      await screen.findByText(/No policy decisions are waiting on approval/u)
    ).toBeInTheDocument();
  });
});
