import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SignalActivityStream } from "./signal-activity-stream";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const membershipId = "33333333-3333-4333-8333-333333333333";
const missionId = "44444444-4444-4444-8444-444444444444";
const scopeId = "55555555-5555-4555-8555-555555555555";
const policyDecisionId = "66666666-6666-4666-8666-666666666666";

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

const triggerRule = {
  description: "A new critical CVE affects an in-scope asset.",
  enabled: true,
  name: "Critical CVE published",
  recommendedMissionType: "ExposureValidation",
  requiredIntegrationCategories: [],
  requiredScopeTypes: [],
  safetyLevel: "ActiveNonInvasive",
  signalCategories: ["Exposure"],
  signalSubcategories: [],
  triggerId: "cve-critical",
  triggerType: "CVE"
};

const evaluation = {
  auditEventIds: [],
  evidenceIds: [],
  matchedAuditEventIds: [],
  matchedSignalIds: [],
  missingPrerequisites: [],
  reason: "A matching critical CVE signal is ready for validation.",
  recommendedMissionType: "ExposureValidation",
  recommendedModuleIds: ["exposure.cve"],
  requiresApproval: true,
  status: "NeedsApproval",
  triggerId: "cve-critical",
  triggerType: "CVE"
};

const activityEvent = {
  activityId: "activity-1",
  auditEventIds: [],
  createdAt: timestamp,
  evidenceIds: [],
  recommendedMissionType: "ExposureValidation",
  signalIds: [],
  status: "NeedsApproval",
  summary: "Critical CVE matched an in-scope asset.",
  title: "Critical CVE published",
  triggerId: "cve-critical",
  triggerType: "CVE"
};

const summary = {
  needsApproval: 1,
  notConfigured: 0,
  requiresIntegration: 0,
  requiresInternalRunner: 0,
  requiresVerifiedScope: 0
};

const triggersResponse = {
  activity: [activityEvent],
  evaluatedAt: timestamp,
  evaluations: [evaluation],
  rules: [triggerRule],
  summary,
  tenantId
};

const approvalResponse = {
  evaluation,
  mission: {
    completedAt: null,
    createdAt: timestamp,
    evidenceIds: [],
    missionId,
    missionType: "ExposureValidation",
    policyDecisionId,
    policyProfile: null,
    requestedBy: userId,
    safetyLevel: "ActiveNonInvasive",
    scopeId,
    scopeIds: [scopeId],
    startedAt: null,
    status: "Draft",
    tenantId,
    updatedAt: timestamp
  },
  policyDecision: {
    approvalState: "Approved",
    approvedAt: timestamp,
    approvedBy: userId,
    createdAt: timestamp,
    executionEnvironment: "ControlPlane",
    expiresAt: null,
    missionType: "ExposureValidation",
    outcome: "Allowed",
    policyDecisionId,
    rationale: "Approved by tenant owner.",
    requestedAction: {
      credentialTheft: false,
      destructive: false,
      persistence: false,
      realDataExfiltration: false,
      requiresInternalRunner: false,
      requiresTimeWindow: false,
      uncontrolledExploitChaining: false
    },
    safetyLevel: "ActiveNonInvasive",
    scopeId,
    target: {},
    tenantId,
    updatedAt: timestamp,
    userId
  },
  routing: {
    deliveries: [],
    enabled: false,
    escalationRole: "Owner",
    nextActions: ["Review the draft mission before running validation."],
    notificationIntegrationIds: [],
    status: "NotConfigured",
    summary: "Routing is not configured; review the draft mission manually.",
    workflowDestinationIntegrationIds: []
  }
};

function mockFetch(payloadByRoute: Record<string, unknown>) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const route = String(input).split("?")[0] ?? "";
    const method = init?.method ?? "GET";
    const key = method === "GET" ? route : `${method} ${route}`;
    const payload = payloadByRoute[key] ?? payloadByRoute[route];

    if (payload == null) {
      return {
        json: async () => ({ error: `Unhandled route ${key}` }),
        ok: false,
        status: 404
      };
    }

    return { json: async () => payload, ok: true, status: 200 };
  }) as unknown as typeof fetch;
}

describe("SignalActivityStream", () => {
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

    render(<SignalActivityStream />);

    await waitFor(() => {
      expect(
        screen.getByText("Sign in to review signal activity.")
      ).toBeInTheDocument();
    });
  });

  it("renders trigger rules and the activity stream from the API", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/me": authPayload,
        "/api/v1/signal-triggers": triggersResponse,
        "/api/v1/signal-triggers/activity": { items: [activityEvent] }
      })
    );

    render(<SignalActivityStream />);

    await waitFor(() => {
      expect(
        screen.getAllByText("Critical CVE published").length
      ).toBeGreaterThan(0);
    });

    expect(
      screen.getByText("Critical CVE matched an in-scope asset.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Approve & create draft mission" })
    ).toBeInTheDocument();
    // Count badges expose accessible names (consistent with count badges
    // elsewhere in the app), not just visible text.
    expect(
      screen.getByRole("status", { name: "Signal activity event count: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Signal trigger rule count: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Signal trigger readiness summary")
    ).toHaveClass("grid-cols-1", "sm:grid-cols-2", "lg:grid-cols-5");
  });

  it("sorts the activity stream by recency or by signal volume", async () => {
    const sig = (n: number) => `${n}0000000-0000-4000-8000-000000000000`;
    const recentLowSignal = {
      ...activityEvent,
      activityId: "activity-recent",
      createdAt: "2026-06-10T00:00:00.000Z",
      signalIds: [sig(1)],
      title: "Recent low-signal activity"
    };
    const olderHighSignal = {
      ...activityEvent,
      activityId: "activity-older",
      createdAt: "2026-06-01T00:00:00.000Z",
      signalIds: [sig(2), sig(3), sig(4)],
      title: "Older high-signal activity"
    };

    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/me": authPayload,
        "/api/v1/signal-triggers": triggersResponse,
        "/api/v1/signal-triggers/activity": {
          items: [recentLowSignal, olderHighSignal]
        }
      })
    );

    render(<SignalActivityStream />);

    const list = await waitFor(() =>
      screen.getByRole("list", { name: "Signal trigger activity" })
    );

    // Default sort is most-recent-first.
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(
      "Recent low-signal activity"
    );

    // Switching to "Most signals" surfaces the highest-volume trigger first.
    fireEvent.change(screen.getByLabelText("Sort by"), {
      target: { value: "signals" }
    });
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent(
      "Older high-signal activity"
    );
  });

  it("approves a ready trigger and shows the created draft mission", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/me": authPayload,
        "/api/v1/signal-triggers": triggersResponse,
        "/api/v1/signal-triggers/activity": { items: [activityEvent] },
        "POST /api/v1/signal-triggers/cve-critical/approve": approvalResponse
      })
    );

    render(<SignalActivityStream />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Approve & create draft mission" })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Approve & create draft mission" })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Approval created a draft mission")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Review the draft mission before running validation.")
    ).toBeInTheDocument();
  });

  it("shows an authenticated empty activity state", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        "/api/v1/me": authPayload,
        "/api/v1/signal-triggers": {
          ...triggersResponse,
          activity: [],
          evaluations: [],
          rules: []
        },
        "/api/v1/signal-triggers/activity": { items: [] }
      })
    );

    render(<SignalActivityStream />);

    await waitFor(() => {
      expect(
        screen.getByText(
          "No signal-driven validation activity has been recorded for this tenant yet. Connect signal sources or import advisories to populate the stream."
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("No signal trigger rules are defined.")
    ).toBeInTheDocument();
  });
});
