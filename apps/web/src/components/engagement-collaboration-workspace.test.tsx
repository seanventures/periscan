import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  EngagementCollaborationSnapshot,
  TenantMember
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { EngagementCollaborationWorkspace } from "./engagement-collaboration-workspace";

const timestamp = "2026-07-15T17:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const engagementId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const userId = "44444444-4444-4444-8444-444444444444";
const evidenceId = "55555555-5555-4555-8555-555555555555";

const member: TenantMember = {
  membership: {
    createdAt: timestamp,
    experienceProfileCompletedAt: null,
    membershipId: "66666666-6666-4666-8666-666666666666",
    primaryOutcome: null,
    productPersona: null,
    role: "SecurityEngineer",
    tenantId,
    updatedAt: timestamp,
    userId
  },
  user: {
    createdAt: timestamp,
    email: "morgan@example.test",
    emailVerifiedAt: timestamp,
    mfaEnabledAt: null,
    name: "Morgan Operator",
    status: "Active",
    updatedAt: timestamp,
    userId
  }
};

function snapshot(
  eventCount: number,
  valid = true
): EngagementCollaborationSnapshot {
  return {
    collaborators: [
      {
        addedAt: timestamp,
        addedByUserId: userId,
        collaboratorId: "77777777-7777-4777-8777-777777777777",
        email: member.user.email,
        name: member.user.name,
        role: "Lead",
        userId
      }
    ],
    events: Array.from({ length: eventCount }, (_, index) => ({
      actorName: member.user.name,
      actorUserId: userId,
      assignedToName: index === 0 ? member.user.name : null,
      assignedToUserId: index === 0 ? userId : null,
      body:
        index === 0
          ? "Coordinate the measured validation."
          : "Measured response reviewed with the operator.",
      createdAt: timestamp,
      engagementCollaborationEventId: `${String(index + 8).repeat(8)}-${String(index + 8).repeat(4)}-4${String(index + 8).repeat(3)}-8${String(index + 8).repeat(3)}-${String(index + 8).repeat(12)}`,
      eventHash: String.fromCharCode(97 + index).repeat(64),
      eventType: index === 0 ? "WorkspaceCreated" : "Note",
      evidenceIds: index === 0 ? [] : [evidenceId],
      previousEventHash:
        index === 0 ? null : String.fromCharCode(96 + index).repeat(64),
      sequence: index + 1,
      status: index === 0 ? "Open" : null
    })),
    integrity: {
      brokenAtSequence: valid ? null : 2,
      eventCount,
      valid
    },
    workspace: {
      createdAt: timestamp,
      engagementId,
      engagementWorkspaceId: workspaceId,
      lastEventSequence: eventCount,
      leadUserId: userId,
      objective: "Coordinate the measured validation.",
      status: "Open",
      tenantId,
      title: "External validation review",
      updatedAt: timestamp
    }
  };
}

describe("EngagementCollaborationWorkspace", () => {
  afterEach(() => vi.restoreAllMocks());

  it("initializes the workspace, appends operator notes, and replays its event ledger", async () => {
    vi.spyOn(api, "getEngagementCollaboration").mockResolvedValue(null);
    vi.spyOn(api, "listTenantMembers").mockResolvedValue([member]);
    const initialize = vi
      .spyOn(api, "initializeEngagementCollaboration")
      .mockResolvedValue(snapshot(1));
    const append = vi
      .spyOn(api, "appendEngagementCollaborationEvent")
      .mockResolvedValue(snapshot(2));

    render(
      <EngagementCollaborationWorkspace
        engagementId={engagementId}
        evidenceIds={[evidenceId]}
      />
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Start shared workspace" })
    );
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Chain verified · 1")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Operator note"), {
      target: { value: "Measured response reviewed with the operator." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Append to replay" }));
    await waitFor(() => expect(append).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("Chain verified · 2")).toBeInTheDocument();
    expect(
      screen.getByText("Measured response reviewed with the operator.")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replay from start" }));
    expect(screen.getByLabelText("Collaboration replay position")).toHaveValue(
      "1"
    );
    expect(screen.getByText("Sequence 1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Return to live" }));
    expect(screen.getByText("Sequence 2 of 2")).toBeInTheDocument();
  });

  it("surfaces a broken replay chain instead of presenting it as trusted", async () => {
    vi.spyOn(api, "getEngagementCollaboration").mockResolvedValue(
      snapshot(2, false)
    );
    vi.spyOn(api, "listTenantMembers").mockResolvedValue([member]);

    render(
      <EngagementCollaborationWorkspace
        engagementId={engagementId}
        evidenceIds={[evidenceId]}
      />
    );

    expect(await screen.findByText("Chain broken · #2")).toBeInTheDocument();
  });
});
