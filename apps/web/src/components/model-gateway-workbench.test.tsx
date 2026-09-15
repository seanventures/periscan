import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ModelGatewayWorkbench } from "./model-gateway-workbench";

function createJsonResponse(
  payload: unknown,
  init?: { ok?: boolean; status?: number }
) {
  return {
    json: async () => payload,
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    text: async () => JSON.stringify(payload)
  };
}

const TIMESTAMP = "2026-06-01T00:00:00.000Z";
const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "33333333-3333-4333-8333-333333333333";

function createAuthPayload() {
  return {
    membership: {
      createdAt: TIMESTAMP,
      membershipId: "22222222-2222-4222-8222-222222222222",
      role: "Owner",
      tenantId: TENANT_ID,
      updatedAt: TIMESTAMP,
      userId: USER_ID
    },
    tenant: {
      billingAccountId: null,
      createdAt: TIMESTAMP,
      dataRegion: "us-east-1",
      name: "Demo Tenant",
      parentTenantId: null,
      tenantId: TENANT_ID,
      type: "Organization",
      updatedAt: TIMESTAMP
    },
    user: {
      createdAt: TIMESTAMP,
      email: "demo@periscan.local",
      name: "Demo User",
      status: "Active",
      updatedAt: TIMESTAMP,
      userId: USER_ID
    }
  };
}

function createProvider() {
  return {
    allowedUseCases: [],
    authMethod: "bearer",
    createdAt: TIMESTAMP,
    createdBy: USER_ID,
    dataResidency: null,
    deploymentType: "Cloud",
    endpointUrl: "https://api.openai.com/v1",
    hasCredential: true,
    lastTestedAt: null,
    modelProviderId: "44444444-4444-4444-8444-444444444444",
    providerName: "Customer OpenAI",
    providerType: "OpenAICompatible",
    servingCapabilities: {},
    status: "Active",
    tenantId: TENANT_ID,
    updatedAt: TIMESTAMP
  };
}

function routeFetch(authResponse: ReturnType<typeof createJsonResponse>) {
  return vi.fn((input: string, init?: RequestInit) => {
    if (input === "/api/v1/me") {
      return Promise.resolve(authResponse);
    }
    if (input === "/api/v1/model-gateway/providers") {
      return Promise.resolve(createJsonResponse({ items: [createProvider()] }));
    }
    if (input === "/api/v1/runners") {
      return Promise.resolve(
        createJsonResponse({
          items: [
            {
              arch: "amd64",
              createdAt: TIMESTAMP,
              deploymentMode: "Docker",
              hostname: "lab-runner",
              killSwitchActive: false,
              labels: ["lab"],
              name: "lab-runner",
              networkProfile: {
                additionalEgressNotes: null,
                dnsResolutionRequired: true,
                explicitProxyUrl: null,
                gatewayHostnames: ["runner.periscan.cloud"],
                httpConnectProxySupported: true,
                outboundHttpsPorts: [443]
              },
              os: "linux",
              runnerId: "66666666-6666-4666-8666-666666666666",
              status: "Active",
              tenantId: TENANT_ID,
              transportMode: "LongPollHttps",
              updatedAt: TIMESTAMP,
              version: "0.1.0"
            }
          ]
        })
      );
    }
    if (input === "/api/v1/scopes") {
      return Promise.resolve(
        createJsonResponse({
          items: [
            {
              createdAt: TIMESTAMP,
              effectiveMaxSafetyLevel: "BASLite",
              isOperationalTechnology: false,
              safetyRestrictionReason:
                "This scope permits validation through BASLite.",
              scopeId: "77777777-7777-4777-8777-777777777777",
              scopeType: "Domain",
              tenantId: TENANT_ID,
              updatedAt: TIMESTAMP,
              value: "example.com",
              verificationStale: false,
              verificationStatus: "Verified"
            }
          ]
        })
      );
    }
    if (
      input === "/api/v1/mission-drafts/conversational" &&
      init?.method === "POST"
    ) {
      return Promise.resolve(
        createJsonResponse({
          createdAt: TIMESTAMP,
          draftId: "55555555-5555-4555-8555-555555555555",
          executable: false,
          honesty: {
            claimLanguage: "mission_draft_not_executable_bas",
            conversationalOnly: true,
            summary:
              "Conversational builder produces a typed mission draft for review. It is not an executable BAS scenario and does not dispatch runner tasks."
          },
          intent: "AEV proof plan",
          missionType: "ExposureValidation",
          moduleIds: ["periscan.dns_resolution_check"],
          nextSteps: [
            "Review module list and safety ceiling.",
            "Compile with Hybrid Execution Compiler."
          ],
          safetyCeiling: "PassiveReadOnly",
          scopeId: "77777777-7777-4777-8777-777777777777",
          source: "AevProofPlanPreset",
          steps: [
            {
              agentRole: "dns_posture",
              dependsOn: [],
              moduleId: "periscan.dns_resolution_check",
              name: "DNS resolution",
              safetyLevel: "PassiveReadOnly",
              stepKey: "step-1"
            }
          ],
          targetHost: "host.example.com",
          title: "AEV proof mission draft"
        })
      );
    }
    if (
      input ===
        "/api/v1/mission-drafts/conversational/to-hybrid-compile-input" &&
      init?.method === "POST"
    ) {
      return Promise.resolve(
        createJsonResponse({
          compileInput: {
            intent: "AEV proof plan",
            moduleIds: ["periscan.dns_resolution_check"],
            queueTasks: false,
            rateLimitPerMinute: 30,
            runnerId: "66666666-6666-4666-8666-666666666666",
            scopeId: "77777777-7777-4777-8777-777777777777",
            targetHost: "host.example.com",
            timeoutSeconds: 5
          },
          draftExecutable: false,
          draftId: "55555555-5555-4555-8555-555555555555",
          honesty: {
            basExecutableFromDraft: false,
            claimLanguage: "mission_draft_not_executable_bas",
            summary:
              "Converted conversational mission draft into Hybrid Execution Compiler input for allowlisted passive modules only. Draft remains non-executable BAS; conversion does not enable live APT/Atomic or multi-agent offense."
          },
          rejectedModuleIds: []
        })
      );
    }
    return Promise.resolve(createJsonResponse({ items: [] }));
  }) as unknown as typeof fetch;
}

describe("ModelGatewayWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prompts unauthenticated visitors to sign in", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: string) => {
        if (input === "/api/v1/me") {
          return Promise.resolve(
            createJsonResponse(
              { error: "Authentication required" },
              { ok: false, status: 401 }
            )
          );
        }
        return Promise.resolve(createJsonResponse({ items: [] }));
      }) as unknown as typeof fetch
    );

    render(<ModelGatewayWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByText("Sign in to use the Model Gateway")
      ).toBeInTheDocument();
    });
  });

  it("renders the control plane for an authenticated tenant", async () => {
    vi.stubGlobal("fetch", routeFetch(createJsonResponse(createAuthPayload())));

    render(<ModelGatewayWorkbench />);

    await waitFor(() => {
      expect(screen.getAllByText("Customer OpenAI").length).toBeGreaterThan(0);
    });

    expect(
      screen.getByRole("button", { name: "Activate kill switch" })
    ).toBeInTheDocument();
    // P04-18: advanced safety stubs hard-labeled; operator kill switch is real.
    expect(
      screen.getByTestId("model-gateway-advanced-safety-honesty")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Not enterprise AI governance/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/stubs \/ synthetic/i)).toBeInTheDocument();
    expect(screen.getByText(/Emergency · real control/i)).toBeInTheDocument();
    expect(screen.getByText("Providers")).toBeInTheDocument();
    expect(screen.getByText("Policy profiles")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.queryByText("SpecializedCyberModel")).not.toBeInTheDocument();
    // Section count badges expose accessible names (consistent with count
    // badges across the app), not just visible text.
    expect(
      screen.getByRole("status", { name: "Registered provider count: 1" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Policy profile count: 0" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Model session count: 0" })
    ).toBeInTheDocument();
  });

  it("creates a typed conversational mission draft (not executable BAS)", async () => {
    vi.stubGlobal("fetch", routeFetch(createJsonResponse(createAuthPayload())));

    render(<ModelGatewayWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /AEV proof plan \(mission draft\)/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /AEV proof plan \(mission draft\)/i })
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("conversational-mission-draft")
      ).toBeInTheDocument();
    });
    expect(screen.getByText("executable: false")).toBeInTheDocument();
    expect(screen.getByText(/dns_posture/i)).toBeInTheDocument();
    expect(
      screen.getByText(/not live APT\/Atomic\/multi-agent offense/i)
    ).toBeInTheDocument();
  });

  it("converts mission draft to hybrid compile input without enabling BAS", async () => {
    vi.stubGlobal("fetch", routeFetch(createJsonResponse(createAuthPayload())));

    render(<ModelGatewayWorkbench />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /AEV proof plan \(mission draft\)/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /AEV proof plan \(mission draft\)/i })
    );

    await waitFor(() => {
      expect(
        screen.getByTestId("convert-draft-to-hybrid-compile")
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("convert-draft-to-hybrid-compile"));

    await waitFor(() => {
      expect(
        screen.getByTestId("hybrid-compile-input-from-draft")
      ).toBeInTheDocument();
    });
    expect(screen.getByText(/draftExecutable: false/i)).toBeInTheDocument();
    expect(screen.getByText(/queueTasks: false/i)).toBeInTheDocument();
    expect(
      screen.getByText("periscan.dns_resolution_check")
    ).toBeInTheDocument();
  });
});
