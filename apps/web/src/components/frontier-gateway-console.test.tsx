import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FrontierGatewayConsole } from "./frontier-gateway-console";

const timestamp = "2026-07-14T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";

function mockFetch() {
  const provider = {
    allowedUseCases: [],
    authMethod: "bearer",
    createdAt: timestamp,
    createdBy: userId,
    dataResidency: null,
    deploymentType: "Cloud",
    endpointUrl: "https://models.example.test/v1",
    hasCredential: true,
    lastTestedAt: null,
    modelProviderId: "33333333-3333-4333-8333-333333333333",
    providerName: "Production model",
    providerType: "OpenAICompatible",
    servingCapabilities: {},
    status: "Active",
    tenantId,
    updatedAt: timestamp
  };
  const policy = {
    allowExternalValidation: false,
    allowInternalValidation: false,
    allowRawEvidence: false,
    allowRunnerTasks: false,
    allowSensitiveContext: false,
    allowTicketCreation: false,
    allowedDataClasses: [],
    allowedModes: ["PlanOnly", "ReadOnlyEvidence"],
    allowedTools: [],
    approvalRequiredAboveLevel: "ActiveNonInvasive",
    blockedTools: [],
    createdAt: timestamp,
    createdBy: userId,
    description: "Read-only analyst policy.",
    maxSafetyLevel: "PassiveReadOnly",
    modelPolicyProfileId: "44444444-4444-4444-8444-444444444444",
    name: "Read-only analyst",
    redactionPolicy: "default",
    sessionTimeoutMinutes: 60,
    tenantId,
    updatedAt: timestamp
  };

  return vi.fn(async (input: RequestInfo | URL) => {
    const route = String(input).split("?")[0] ?? "";
    const payloads: Record<string, unknown> = {
      "/api/v1/model-gateway/audit-events": { items: [] },
      "/api/v1/model-gateway/interventions": {
        generatedAt: timestamp,
        items: [
          {
            createdAt: timestamp,
            inputPayloadHash: "a".repeat(64),
            intervention: null,
            modelSessionId: "55555555-5555-4555-8555-555555555555",
            policyDecisionId: "66666666-6666-4666-8666-666666666666",
            policyProfileName: "Human boundary",
            requestReason: "Validate the highest-risk exposure",
            scopeIds: ["77777777-7777-4777-8777-777777777777"],
            sessionMode: "SafeValidation",
            sessionPurpose: "Review the top exposure",
            status: "RequiresApproval",
            toolName: "request_exposure_validation",
            toolRequestId: "88888888-8888-4888-8888-888888888888"
          }
        ],
        limitations: ["A channel message is never approval."],
        pendingCount: 1,
        reviewLinkCount: 0
      },
      "/api/v1/model-gateway/policies": { items: [policy] },
      "/api/v1/model-gateway/providers": { items: [provider] },
      "/api/v1/model-gateway/tools": { items: [] }
    };
    if (!(route in payloads)) {
      return {
        json: async () => ({ error: `Unhandled route ${route}` }),
        ok: false,
        status: 404
      };
    }
    return { json: async () => payloads[route], ok: true, status: 200 };
  }) as unknown as typeof fetch;
}

describe("FrontierGatewayConsole", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("exposes provider editing, disabling, deletion, and key rotation", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<FrontierGatewayConsole />);

    fireEvent.mouseDown(await screen.findByRole("tab", { name: "Providers" }), {
      button: 0,
      ctrlKey: false
    });
    expect(await screen.findByText("Production model")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disable" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit / rotate key" }));
    expect(
      screen.getByLabelText("New API key (optional, write-only)")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save provider" })
    ).toBeInTheDocument();
  });

  it("makes the signed intervention boundary the default operator view", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<FrontierGatewayConsole />);

    expect(
      await screen.findByText("Exact authorization envelope")
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Validate the highest-risk exposure")
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Issue review link" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("Message approvals").length).toBeGreaterThan(0);
  });

  it("opens full policy-profile authoring and edit controls", async () => {
    vi.stubGlobal("fetch", mockFetch());
    render(<FrontierGatewayConsole />);

    fireEvent.mouseDown(
      await screen.findByRole("tab", { name: "Policy rules" }),
      {
        button: 0,
        ctrlKey: false
      }
    );
    expect(await screen.findByText("Read-only analyst")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Create policy profile" })
    );

    expect(screen.getByLabelText("Max safety level")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Approval required above")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Redaction policy")).toBeInTheDocument();
    expect(screen.getByText("Capabilities")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create policy" })).toBeEnabled();
  });
});
