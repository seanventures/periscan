import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EngagementWorkbench } from "./engagement-workbench";

const timestamp = "2026-06-01T00:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const scopeId = "33333333-3333-4333-8333-333333333333";
const evidenceId = "44444444-4444-4444-8444-444444444444";
const engagementId = "55555555-5555-4555-8555-555555555555";
const scenarioBundleId = "77777777-7777-4777-8777-777777777777";
const compiledHash = "a".repeat(64);

const authPayload = {
  membership: {
    createdAt: timestamp,
    membershipId: "66666666-6666-4666-8666-666666666666",
    role: "Owner",
    tenantId,
    updatedAt: timestamp,
    userId
  },
  tenant: {
    billingAccountId: "acct-demo",
    createdAt: timestamp,
    dataRegion: "us-east-1",
    name: "Demo",
    parentTenantId: null,
    tenantId,
    type: "Organization",
    updatedAt: timestamp
  },
  user: {
    createdAt: timestamp,
    email: "owner@example.com",
    name: "Owner",
    status: "Active",
    updatedAt: timestamp,
    userId
  }
};

const scope = {
  createdAt: timestamp,
  createdBy: userId,
  scopeId,
  scopeType: "Domain",
  tenantId,
  updatedAt: timestamp,
  value: "corp.example.com",
  verificationStatus: "Verified"
};

const engagementResult = {
  engagementId,
  evidenceIds: [evidenceId],
  generatedAt: timestamp,
  mode: "Execute",
  scopeId,
  status: "Completed",
  steps: [
    {
      evidenceIds: [evidenceId],
      moduleId: "periscan.dns_resolution_check",
      runMode: "AgentLocal",
      signalCount: 0,
      status: "executed"
    },
    {
      evidenceIds: [],
      moduleId: "web.sqli_probe",
      reason:
        "web.sqli_probe is an offensive/high-impact action and requires a verified authorized scope before it can be queued.",
      runMode: "ServiceViaProxy",
      signalCount: 0,
      status: "denied"
    },
    {
      evidenceIds: [],
      moduleId: "recon.subdomain_enum",
      runMode: "AgentLocal",
      signalCount: 0,
      status: "planned"
    }
  ],
  tenantId
};

const scenarioBundle = {
  allowedScopeTypes: ["Domain"],
  approvedAt: null,
  approvedBy: null,
  bundleVersion: 1,
  compiledAt: timestamp,
  compiledHash,
  createdAt: timestamp,
  description: "A deterministic DNS proof graph.",
  expectedObservations: ["DNS evidence is persisted."],
  intent: "Validate DNS posture with saved evidence.",
  legalClassification: "PassiveAuthorized",
  maximumIterations: 2,
  name: "DNS posture proof",
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
  status: "Draft",
  steps: [
    {
      dependsOn: [],
      expectedObservations: ["DNS answers are persisted."],
      moduleId: "periscan.dns_resolution_check",
      name: "Resolve DNS",
      stepId: "step-1",
      target: {},
      when: { kind: "Always" }
    },
    {
      dependsOn: ["step-1"],
      expectedObservations: ["Email controls are persisted."],
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
  techniqueIds: [],
  tenantId,
  updatedAt: timestamp
} as const;

function jsonResponse(payload: unknown) {
  return { json: async () => payload, ok: true, status: 200 };
}

function mockFetch(
  runResult: unknown = engagementResult,
  scopes: unknown[] = [scope]
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.endsWith("/api/v1/me")) {
      return jsonResponse(authPayload);
    }
    if (url.endsWith("/api/v1/scopes")) {
      return jsonResponse({ items: scopes });
    }
    if (url.endsWith("/api/v1/engagements")) {
      // POST runs an engagement (single result); GET lists persisted history.
      return method === "POST"
        ? jsonResponse(runResult)
        : jsonResponse({ items: [engagementResult] });
    }
    return {
      json: async () => ({ error: `Unhandled ${url}` }),
      ok: false,
      status: 404
    };
  }) as unknown as typeof fetch;
}

describe("EngagementWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a consistent loading status panel while the workspace loads", () => {
    // A never-resolving fetch keeps the component in its initial loading state.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})) as unknown as typeof fetch
    );

    render(<EngagementWorkbench />);

    // Matches the sibling-workbench loading pattern: a role=status panel, not a
    // bare paragraph.
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading workspace.")).toBeInTheDocument();
  });

  it("routes an empty workspace to scope setup", async () => {
    vi.stubGlobal("fetch", mockFetch(engagementResult, []));

    render(<EngagementWorkbench />);

    expect(
      await screen.findByRole("note", { name: "Engagement scope required" })
    ).toHaveTextContent("Add an authorized scope");
    expect(
      screen.getByRole("link", { name: "Add and verify a scope →" })
    ).toHaveAttribute("href", "/missions");
    expect(
      screen.getByRole("button", { name: "Run engagement" })
    ).toBeDisabled();
  });

  it("renders engagement step results truthfully (executed vs denied vs planned)", async () => {
    vi.stubGlobal("fetch", mockFetch());

    render(<EngagementWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Autonomous engagement" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Run engagement" }));

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Engagement status: Completed" })
      ).toBeInTheDocument();
    });

    // Outcome summary aggregates the real step results (1 executed, 1 denied,
    // 1 planned, 0 signals in this fixture).
    expect(
      screen.getByRole("status", { name: "Engagement steps executed: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Engagement steps denied: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Engagement steps planned: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Engagement signals produced: 0" })
    ).toBeInTheDocument();

    // The executed step surfaces its produced evidence artifacts.
    expect(
      screen.getByLabelText("Evidence for periscan.dns_resolution_check")
    ).toBeInTheDocument();

    // Executed step → kit success tone (not open-exposure green misuse).
    const executed = screen.getByRole("status", {
      name: "Step periscan.dns_resolution_check: executed"
    });
    expect(executed).toHaveClass("text-success");

    // Denied offensive step → danger tone, with the governance reason shown.
    const denied = screen.getByRole("status", {
      name: "Step web.sqli_probe: denied"
    });
    expect(denied).toHaveClass("text-danger");
    expect(denied).not.toHaveClass("text-success");
    // The governance verdict is surfaced as a prominent danger-toned note,
    // not buried in the muted metadata line.
    const deniedReason = screen.getByRole("note", {
      name: "Denied reason for web.sqli_probe"
    });
    expect(deniedReason).toHaveTextContent(
      /Denied:.*offensive\/high-impact action and requires/u
    );

    // Planned step → warning/pending, never shown as success.
    const planned = screen.getByRole("status", {
      name: "Step recon.subdomain_enum: planned"
    });
    expect(planned).toHaveClass("text-warning");
    expect(planned).not.toHaveClass("text-success");

    // Persisted history surfaces with a truthful engagement-level pill.
    expect(
      screen.getByRole("heading", { name: "Recent engagements" })
    ).toBeInTheDocument();
    const historyPill = screen.getByRole("status", {
      name: `Engagement ${engagementId}: Completed`
    });
    expect(historyPill).toHaveClass("text-success");

    // The engagement mode is surfaced as a distinct badge so an Execute run is
    // visually separable from a PlanOnly preview.
    expect(
      screen.getByLabelText(`Engagement ${engagementId} mode: Execute`)
    ).toBeInTheDocument();

    // Recent-engagements outcome distribution (real history; one Completed).
    const historyFigure = screen.getByRole("figure", {
      name: "Recent engagements by outcome"
    });
    expect(
      within(historyFigure).getByRole("rowheader", { name: "Completed" })
    ).toBeInTheDocument();

    // An Execute-mode result must NOT show the preview-only banner.
    expect(
      screen.queryByRole("status", {
        name: "Preview only: no engagement steps were executed"
      })
    ).not.toBeInTheDocument();
  });

  it("shows a preview-only banner for a PlanOnly result (nothing executed)", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetch({
        ...engagementResult,
        mode: "PlanOnly",
        status: "Planned",
        steps: engagementResult.steps.map((step) => ({
          ...step,
          evidenceIds: [],
          signalCount: 0,
          status: "planned"
        }))
      })
    );

    render(<EngagementWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Autonomous engagement" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Run engagement" }));

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Engagement status: Planned" })
      ).toBeInTheDocument();
    });

    expect(
      screen.getByRole("status", {
        name: "Preview only: no engagement steps were executed"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Engagement steps executed: 0" })
    ).toBeInTheDocument();
  });

  it("authors an ATT&CK-contextual chain and binds the tenant authorization record", async () => {
    const authorizationReference = "CHANGE-4242 / customer approval";
    let submittedBody: Record<string, unknown> | null = null;
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.endsWith("/api/v1/me")) {
          return jsonResponse(authPayload);
        }
        if (url.endsWith("/api/v1/scopes")) {
          return jsonResponse({ items: [scope] });
        }
        if (url.endsWith("/api/v1/modules")) {
          return jsonResponse({
            items: [
              {
                moduleId: "periscan.dns_resolution_check",
                name: "DNS resolution check",
                requiredScopes: ["Domain"],
                safetyLevel: "Safe",
                status: "Implemented"
              }
            ]
          });
        }
        if (url.endsWith("/api/v1/attack-techniques")) {
          return jsonResponse({
            items: [
              {
                description: "Safe active-scanning context.",
                safeExample: true,
                tacticId: "TA0043",
                tacticName: "Reconnaissance",
                techniqueId: "T1595",
                techniqueName: "Active Scanning"
              }
            ]
          });
        }
        if (url.endsWith("/api/v1/tenants/current/safety-settings")) {
          return jsonResponse({
            authorizationReference,
            authorizedAt: timestamp,
            authorizedBy: userId,
            destructiveAuthorizationReference: null,
            destructiveAuthorizedAt: null,
            destructiveAuthorizedBy: null,
            destructiveValidationEnabled: false,
            effectiveMaxSafetyLevel: "AdvancedAdversarial",
            offensiveValidationEnabled: true
          });
        }
        if (url.endsWith("/api/v1/engagements")) {
          if (method === "POST") {
            submittedBody = JSON.parse(String(init?.body)) as Record<
              string,
              unknown
            >;
            return jsonResponse({
              ...engagementResult,
              approvalId: authorizationReference
            });
          }
          return jsonResponse({ items: [] });
        }
        return {
          json: async () => ({ error: `Unhandled ${url}` }),
          ok: false,
          status: 404
        };
      }
    ) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    render(<EngagementWorkbench />);

    const technique = await screen.findByRole("combobox", {
      name: "Engagement ATT&CK technique"
    });
    fireEvent.change(technique, { target: { value: "T1595" } });
    fireEvent.click(screen.getByRole("button", { name: "Add step" }));
    expect(
      screen.getByRole("list", { name: "Engagement plan steps" })
    ).toHaveTextContent("T1595");

    const authorization = screen.getByRole("checkbox", {
      name: "Authorize offensive steps"
    });
    await waitFor(() => expect(authorization).toBeEnabled());
    fireEvent.click(authorization);
    expect(screen.getByText(authorizationReference)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Run engagement" }));
    await waitFor(() => expect(submittedBody).not.toBeNull());
    expect(submittedBody).toMatchObject({
      approvalId: authorizationReference,
      authorizedOffensive: true,
      mode: "PlanOnly",
      plan: [
        {
          moduleId: "periscan.dns_resolution_check",
          target: { techniqueId: "T1595" }
        }
      ],
      scopeId
    });
  });

  it("reviews, approves, and executes the exact signed scenario preview", async () => {
    const requestBodies: Array<{ body: unknown; url: string }> = [];
    let engagementItems: unknown[] = [];
    const approvedBundle = {
      ...scenarioBundle,
      approvedAt: timestamp,
      approvedBy: userId,
      status: "Approved"
    };
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.endsWith("/api/v1/me")) return jsonResponse(authPayload);
        if (url.endsWith("/api/v1/scopes")) {
          return jsonResponse({ items: [scope] });
        }
        if (url.endsWith("/api/v1/engagements")) {
          return jsonResponse({ items: engagementItems });
        }
        if (url.endsWith("/api/v1/scenarios/compile") && method === "POST") {
          requestBodies.push({ body: JSON.parse(String(init?.body)), url });
          return jsonResponse({
            bundle: scenarioBundle,
            preview: {
              branchCount: 1,
              compiledHash,
              executable: false,
              moduleCount: 2,
              nextStep: "ApproveScenarioBundle"
            }
          });
        }
        if (
          url.endsWith(`/api/v1/scenarios/${scenarioBundleId}/approve`) &&
          method === "POST"
        ) {
          return jsonResponse(approvedBundle);
        }
        if (
          url.endsWith(`/api/v1/scenarios/${scenarioBundleId}/execute`) &&
          method === "POST"
        ) {
          requestBodies.push({ body: JSON.parse(String(init?.body)), url });
          const cycleEngagement = {
            ...engagementResult,
            compiledHash,
            feedbackCycleNumber: 1,
            scenarioBundleId
          };
          engagementItems = [cycleEngagement];
          return jsonResponse({
            bundle: {
              ...approvedBundle,
              feedbackCycleCount: 1,
              feedbackFailedCycleCount: 0,
              feedbackLastCompletedAt: timestamp,
              feedbackLastReason: "Fresh proof is required for release review.",
              feedbackLastReviewReference: "CHANGE-1234",
              feedbackLastStartedAt: timestamp,
              feedbackLastStatus: "Completed"
            },
            engagement: cycleEngagement,
            feedback: {
              cycleNumber: 1,
              maximumIterations: 2,
              reason: "Fresh proof is required for release review.",
              remainingIterations: 1,
              reviewReference: "CHANGE-1234",
              status: "Completed"
            },
            integrity: { compiledHash, executionMatchedPreview: true }
          });
        }
        return {
          json: async () => ({ error: `Unhandled ${method} ${url}` }),
          ok: false,
          status: 404
        };
      }
    ) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    render(<EngagementWorkbench />);

    const intent = await screen.findByRole("textbox", {
      name: "Scenario intent"
    });
    fireEvent.change(intent, {
      target: { value: "Validate DNS posture with saved evidence." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Compile preview" }));

    expect(
      await screen.findByRole("list", { name: "Compiled scenario steps" })
    ).toHaveTextContent("Continue when step-1 has 1+ evidence");
    expect(screen.getByText(compiledHash)).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Scenario lifecycle: preview" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve exact hash" }));
    const execute = await screen.findByRole("button", {
      name: "Run next governed cycle"
    });
    expect(
      screen.getByRole("status", { name: "Scenario lifecycle: approved" })
    ).toBeInTheDocument();
    expect(execute).toBeDisabled();
    fireEvent.change(
      screen.getByRole("textbox", { name: "Feedback decision reason" }),
      { target: { value: "Fresh proof is required for release review." } }
    );
    fireEvent.change(
      screen.getByRole("textbox", { name: "Feedback review reference" }),
      { target: { value: "CHANGE-1234" } }
    );
    fireEvent.click(execute);

    expect(await screen.findByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("1 remaining")).toBeInTheDocument();
    expect(requestBodies).toEqual([
      expect.objectContaining({
        body: expect.objectContaining({
          intent: "Validate DNS posture with saved evidence.",
          maximumIterations: 3,
          scopeId
        })
      }),
      expect.objectContaining({
        body: {
          compiledHash,
          expectedFeedbackCycleCount: 0,
          reason: "Fresh proof is required for release review.",
          reviewReference: "CHANGE-1234"
        }
      })
    ]);
  });

  it("shows a signed-out state when unauthenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        json: async () => ({ error: "Unauthorized" }),
        ok: false,
        status: 401
      })) as unknown as typeof fetch
    );

    render(<EngagementWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", {
          name: "Sign in to run autonomous engagements."
        })
      ).toBeInTheDocument();
    });
  });

  it("shows a dismissible error when running an engagement fails", async () => {
    const fetchImpl = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = (init?.method ?? "GET").toUpperCase();
        if (url.endsWith("/api/v1/me")) {
          return jsonResponse(authPayload);
        }
        if (url.endsWith("/api/v1/scopes")) {
          return jsonResponse({ items: [scope] });
        }
        if (url.endsWith("/api/v1/engagements")) {
          // The run (POST) fails; GET history still succeeds.
          return method === "POST"
            ? {
                json: async () => ({ error: "Engagement engine unavailable." }),
                ok: false,
                status: 503
              }
            : jsonResponse({ items: [] });
        }
        return {
          json: async () => ({ error: `Unhandled ${url}` }),
          ok: false,
          status: 404
        };
      }
    ) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchImpl);

    render(<EngagementWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Autonomous engagement" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Run engagement" }));

    // The failure surfaces as a dismissible alert (consistent with sibling
    // workbenches), not a silent failure or a permanent banner.
    const alert = await waitFor(() => screen.getByRole("alert"));
    const dismiss = within(alert).getByRole("button", {
      name: "Dismiss engagement error"
    });
    fireEvent.click(dismiss);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
