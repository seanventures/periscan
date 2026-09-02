import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearWorkingTenant,
  consumeWorkingTenantEnterToast,
  readWorkingTenant
} from "../lib/working-tenant";
import { MSSPPortfolioWorkbench } from "./mssp-portfolio-workbench";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), prefetch: vi.fn() })
}));

function createPortfolioPayload() {
  const timestamp = "2026-06-01T00:00:00.000Z";
  const parentTenantId = "11111111-1111-4111-8111-111111111111";
  const clientTenantId = "44444444-4444-4444-8444-444444444444";
  const tenant = {
    billingAccountId: "acct-demo",
    createdAt: timestamp,
    dataRegion: "us-east-1",
    name: "Customer One",
    parentTenantId,
    tenantId: clientTenantId,
    type: "Client",
    updatedAt: timestamp
  };

  return {
    clients: [
      {
        branding: {
          createdAt: timestamp,
          logoUrl: null,
          organizationName: "Customer One Security",
          primaryColor: "#0F766E",
          reportFooter: null,
          supportEmail: null,
          tenantId: clientTenantId,
          updatedAt: timestamp,
          whiteLabelEnabled: true
        },
        coverage: {
          aiApplications: 0,
          connectedIntegrations: 1,
          controlSources: 0,
          healthyIntegrations: 1,
          missingProofInputs: 1,
          runners: 0,
          totalScopes: 1,
          unhealthyIntegrations: 0,
          verifiedScopes: 1
        },
        latestActivity: {
          latestEvidencePackAt: null,
          latestReportId: null,
          latestSnapshotAt: timestamp,
          latestSnapshotId: null,
          latestValidationRunAt: timestamp
        },
        readinessStatus: "Attention",
        risk: {
          criticalPaths: 1,
          fixedPaths: 0,
          highPaths: 1,
          lowPaths: 0,
          mediumPaths: 0,
          openRemediations: 2,
          verificationPending: 1
        },
        tenant,
        usage: {
          billingAccountId: "acct-demo",
          meteringPeriodEnd: "2026-07-01T00:00:00.000Z",
          meteringPeriodStart: timestamp,
          meters: [],
          tenantId: clientTenantId
        }
      }
    ],
    generatedAt: timestamp,
    parentTenant: {
      ...tenant,
      name: "Periscan Partner",
      parentTenantId: null,
      tenantId: parentTenantId,
      type: "MSSP"
    },
    totals: {
      activeClients: 0,
      attentionClients: 1,
      clientTenants: 1,
      evidencePacks: 0,
      missingProofInputs: 1,
      needsIntegrationClients: 0,
      needsScopeClients: 0,
      needsValidationClients: 0,
      openRemediations: 2,
      shortTermAssessments: 0,
      validationRuns: 1,
      verifiedScopes: 1
    }
  };
}

describe("MSSPPortfolioWorkbench", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearWorkingTenant();
    pushMock.mockReset();
  });

  it("builds a ranked batch review while keeping every action tenant-bound", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/tenants/current/client-portfolio") {
          return new Response(JSON.stringify(createPortfolioPayload()), {
            status: 200
          });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), {
          status: 404
        });
      })
    );

    render(<MSSPPortfolioWorkbench />);

    await screen.findByText("Customer One Security");
    fireEvent.click(screen.getByRole("button", { name: "Select visible" }));

    expect(
      screen.getByRole("heading", {
        name: "1 client tenant queued by exception rank"
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/This queue batches review, not mutations/)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Add Customer One to batch triage")
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Open findings" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove Customer One from batch"
      })
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: "1 client tenant queued by exception rank"
        })
      ).not.toBeInTheDocument();
    });
  });

  it("opens a client workspace by setting working tenant and navigating to findings", async () => {
    const payload = createPortfolioPayload();
    const clientTenantId = payload.clients[0]!.tenant.tenantId;
    const timestamp = payload.generatedAt;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/tenants/current/client-portfolio") {
          return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (input === "/api/v1/me") {
          return new Response(
            JSON.stringify({
              membership: {
                createdAt: timestamp,
                membershipId: "55555555-5555-4555-8555-555555555555",
                role: "MSSPOwner",
                tenantId: clientTenantId,
                updatedAt: timestamp,
                userId: "66666666-6666-4666-8666-666666666666"
              },
              tenant: payload.clients[0]!.tenant,
              user: {
                createdAt: timestamp,
                email: "ops@partner.example",
                name: "MSSP Ops",
                status: "Active",
                updatedAt: timestamp,
                userId: "66666666-6666-4666-8666-666666666666"
              }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ error: "unexpected" }), {
          status: 404
        });
      })
    );

    render(<MSSPPortfolioWorkbench />);
    await screen.findByText("Customer One Security");

    fireEvent.click(screen.getByRole("button", { name: "Open client" }));

    await waitFor(() => {
      expect(readWorkingTenant()?.tenantId).toBe(clientTenantId);
      expect(pushMock).toHaveBeenCalledWith("/findings");
    });
    // P05: one-shot "Working as {name}" status + enter toast armed for shell.
    const success = await screen.findByTestId("open-client-success");
    expect(success).toHaveAttribute("role", "status");
    expect(success).toHaveTextContent("Working as Customer One Security");
    expect(consumeWorkingTenantEnterToast()).toBe("Customer One Security");
    // Consumed once — second read is empty.
    expect(consumeWorkingTenantEnterToast()).toBeNull();
  });

  it("surfaces create-client provision panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/tenants/current/client-portfolio") {
          return new Response(JSON.stringify(createPortfolioPayload()), {
            status: 200
          });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), {
          status: 404
        });
      })
    );

    render(<MSSPPortfolioWorkbench />);
    await screen.findByRole("heading", { name: "Create client tenant" });
    fireEvent.click(screen.getByRole("button", { name: "New client" }));
    expect(screen.getByLabelText(/Client name/i)).toBeInTheDocument();
  });

  it("opens the first selected client from the batch queue (P05)", async () => {
    const payload = createPortfolioPayload();
    const clientTenantId = payload.clients[0]!.tenant.tenantId;
    const timestamp = payload.generatedAt;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/tenants/current/client-portfolio") {
          return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (input === "/api/v1/me") {
          return new Response(
            JSON.stringify({
              membership: {
                createdAt: timestamp,
                membershipId: "55555555-5555-4555-8555-555555555555",
                role: "MSSPOwner",
                tenantId: clientTenantId,
                updatedAt: timestamp,
                userId: "66666666-6666-4666-8666-666666666666"
              },
              tenant: payload.clients[0]!.tenant,
              user: {
                createdAt: timestamp,
                email: "ops@partner.example",
                name: "MSSP Ops",
                status: "Active",
                updatedAt: timestamp,
                userId: "66666666-6666-4666-8666-666666666666"
              }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ error: "unexpected" }), {
          status: 404
        });
      })
    );

    render(<MSSPPortfolioWorkbench />);
    await screen.findByText("Customer One Security");
    fireEvent.click(screen.getByRole("button", { name: "Select visible" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Open first selected" })
    );

    await waitFor(() => {
      expect(readWorkingTenant()?.tenantId).toBe(clientTenantId);
      expect(readWorkingTenant()?.homeTenantId).toBe(
        payload.parentTenant.tenantId
      );
      expect(pushMock).toHaveBeenCalledWith("/findings");
    });
  });

  it("opens client on Enter when the card is focused (P05)", async () => {
    const payload = createPortfolioPayload();
    const clientTenantId = payload.clients[0]!.tenant.tenantId;
    const timestamp = payload.generatedAt;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/tenants/current/client-portfolio") {
          return new Response(JSON.stringify(payload), { status: 200 });
        }
        if (input === "/api/v1/me") {
          return new Response(
            JSON.stringify({
              membership: {
                createdAt: timestamp,
                membershipId: "55555555-5555-4555-8555-555555555555",
                role: "MSSPOwner",
                tenantId: clientTenantId,
                updatedAt: timestamp,
                userId: "66666666-6666-4666-8666-666666666666"
              },
              tenant: payload.clients[0]!.tenant,
              user: {
                createdAt: timestamp,
                email: "ops@partner.example",
                name: "MSSP Ops",
                status: "Active",
                updatedAt: timestamp,
                userId: "66666666-6666-4666-8666-666666666666"
              }
            }),
            { status: 200 }
          );
        }
        return new Response(JSON.stringify({ error: "unexpected" }), {
          status: 404
        });
      })
    );

    render(<MSSPPortfolioWorkbench />);
    await screen.findByText("Customer One Security");
    const card = screen.getByTestId("mssp-client-card");
    card.focus();
    fireEvent.keyDown(card, { key: "Enter" });

    await waitFor(() => {
      expect(readWorkingTenant()?.tenantId).toBe(clientTenantId);
      expect(pushMock).toHaveBeenCalledWith("/findings");
    });
  });

  it("auto-expands create client form when the portfolio is empty (P05)", async () => {
    const empty = {
      ...createPortfolioPayload(),
      clients: [],
      totals: {
        ...createPortfolioPayload().totals,
        clientTenants: 0,
        attentionClients: 0,
        openRemediations: 0,
        missingProofInputs: 0,
        verifiedScopes: 0,
        validationRuns: 0
      }
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input === "/api/v1/tenants/current/client-portfolio") {
          return new Response(JSON.stringify(empty), { status: 200 });
        }
        return new Response(JSON.stringify({ error: "unexpected" }), {
          status: 404
        });
      })
    );

    render(<MSSPPortfolioWorkbench />);
    // forceOpen flips true only after portfolio load settles empty — wait for the
    // expanded form field, not the always-visible provision heading.
    expect(await screen.findByLabelText(/Client name/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByText(/No client tenants/i)).toBeInTheDocument();
  });
});
