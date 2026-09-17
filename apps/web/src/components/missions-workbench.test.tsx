import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MissionsWorkbench } from "./missions-workbench";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const missionId = "44444444-4444-4444-8444-444444444444";
const scopeId = "55555555-5555-4555-8555-555555555555";
const runId = "66666666-6666-4666-8666-666666666666";
const evidenceId = "77777777-7777-4777-8777-777777777777";
const jobId = "88888888-8888-4888-8888-888888888888";

const authPayload = {
  membership: {
    createdAt: timestamp,
    membershipId,
    role: "Owner",
    tenantId,
    updatedAt: timestamp,
    userId
  },
  tenant: {
    billingAccountId: null,
    createdAt: timestamp,
    dataRegion: "us-east-1",
    name: "Demo Security",
    parentTenantId: null,
    tenantId,
    type: "Organization",
    updatedAt: timestamp
  },
  user: {
    createdAt: timestamp,
    email: "owner@example.com",
    name: "Owner User",
    status: "Active",
    updatedAt: timestamp,
    userId
  }
};

const mission = {
  completedAt: timestamp,
  createdAt: timestamp,
  evidenceIds: [evidenceId],
  missionId,
  missionType: "ValidationSnapshot",
  policyDecisionId: null,
  policyProfile: null,
  requestedBy: userId,
  safetyLevel: "ActiveNonInvasive",
  scopeId,
  scopeIds: [scopeId],
  startedAt: timestamp,
  status: "Completed",
  tenantId,
  updatedAt: timestamp
};

const run = {
  completedAt: timestamp,
  createdAt: timestamp,
  errorSummary: null,
  evidenceIds: [evidenceId],
  missionId,
  moduleId: "exposure.cve",
  outcome: "Validated reachable path",
  policyDecisionId: null,
  runId,
  runnerId: null,
  safetyLevel: "ActiveNonInvasive",
  scopeId,
  startedAt: timestamp,
  status: "Completed",
  target: {},
  techniqueIds: ["T1190"],
  tenantId,
  updatedAt: timestamp,
  validationState: "Validated"
};

const job = {
  attempts: 1,
  availableAt: timestamp,
  completedAt: timestamp,
  createdAt: timestamp,
  dedupeKey: null,
  errorMessage: null,
  jobId,
  missionId,
  payload: {},
  queueName: "validation",
  status: "Completed",
  tenantId,
  updatedAt: timestamp,
  validationRunId: runId
};

function mockFetch(payloadByRoute: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const route = String(input).split("?")[0] ?? "";
    const payload = payloadByRoute[route];

    if (payload == null) {
      return {
        json: async () => ({ error: `Unhandled route ${route}` }),
        ok: false,
        status: 404
      };
    }

    return { json: async () => payload, ok: true, status: 200 };
  }) as unknown as typeof fetch;
}

describe("MissionsWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts unauthenticated visitors to sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ error: "Authentication required" }),
        ok: false,
        status: 401
      })) as unknown as typeof fetch
    );

    render(<MissionsWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByText("Sign in to review validation missions.")
      ).toBeInTheDocument();
    });
  });

  it("renders missions and auto-loads runs with status, outcome, and evidence", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/me": authPayload,
        "/api/v1/missions": { items: [mission] },
        [`/api/v1/missions/${missionId}/runs`]: { items: [run] }
      })
    );

    render(<MissionsWorkbench />);

    await waitFor(() => {
      expect(screen.getAllByText("exposure.cve").length).toBeGreaterThan(0);
    });

    expect(screen.getByText("Validated reachable path")).toBeInTheDocument();
    expect(screen.getByText("T1190")).toBeInTheDocument();
    expect(
      screen.getByRole("status", {
        name: `Run ${runId.slice(0, 8)} status: Completed`
      })
    ).toBeInTheDocument();
    // The Missions section count badge exposes an accessible name (consistent
    // with count badges across the app).
    expect(
      screen.getByRole("status", { name: "Validation mission count: 1" })
    ).toBeInTheDocument();
  });

  it("shows an authenticated empty mission state", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/me": authPayload,
        "/api/v1/missions": { items: [] }
      })
    );

    render(<MissionsWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No validation missions have been created for this tenant yet. Run a Validation Snapshot or approve a signal trigger to create one."
        )
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Labs \/ not mounted on product routes/i)
    ).toBeInTheDocument();
  });

  it("looks up a queue job by id", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/me": authPayload,
        "/api/v1/missions": { items: [mission] },
        [`/api/v1/missions/${missionId}/runs`]: { items: [run] },
        [`/api/v1/jobs/${jobId}`]: job
      })
    );

    render(<MissionsWorkbench />);

    await waitFor(() => {
      expect(screen.getAllByText("exposure.cve").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Job id"), {
      target: { value: jobId }
    });
    fireEvent.click(screen.getByRole("button", { name: "Inspect job" }));

    await waitFor(() => {
      expect(screen.getByText(`Job ${jobId.slice(0, 8)}`)).toBeInTheDocument();
    });

    expect(screen.getByText("validation")).toBeInTheDocument();
  });
});
