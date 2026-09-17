import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Integration, RemediationTask } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { RemediationDetail } from "./remediation-detail";

vi.mock("./governed-remediation-action", () => ({
  GovernedRemediationAction: () => null
}));

vi.mock("./iac-remediation-workspace", () => ({
  IacRemediationWorkspace: () => null
}));

const timestamp = "2026-07-15T16:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const remediationId = "22222222-2222-4222-8222-222222222222";
const integrationId = "33333333-3333-4333-8333-333333333333";
const pathId = "44444444-4444-4444-8444-444444444444";

function remediation(
  overrides: Partial<RemediationTask> = {}
): RemediationTask {
  return {
    createdAt: timestamp,
    dueAt: null,
    evidenceIds: [],
    owner: "Security engineering",
    recommendedAction: "Rotate the exposed secret",
    relatedExposureId: null,
    relatedFindingFingerprint: null,
    relatedPathEvidenceBasis: "Measured",
    relatedPathId: pathId,
    remediationId,
    status: "Open",
    technicalSteps: ["Rotate the secret", "Rerun validation"],
    tenantId,
    ticketId: null,
    ticketIntegrationId: null,
    ticketState: null,
    ticketStateLabel: null,
    ticketSyncedAt: null,
    ticketSystem: null,
    updatedAt: timestamp,
    verificationMethod: "Rerun the GitHub and AWS checks.",
    verificationRequired: true,
    lastVerifiedAt: null,
    latestVerification: null,
    nextVerificationAt: null,
    ...overrides
  };
}

function ticketingIntegration(
  overrides: Partial<Integration> = {}
): Integration {
  return {
    authType: "api_key",
    category: "Ticketing",
    config: { connectorKey: "jira", mockMode: true },
    createdAt: timestamp,
    healthStatus: "Healthy",
    integrationId,
    lastSyncAt: null,
    nextSyncAt: null,
    permissionsSummary: {
      connectorKey: "jira",
      requiredPermissions: ["write:jira-work"]
    },
    product: "Jira Cloud",
    status: "Connected",
    syncFrequency: null,
    tenantId,
    updatedAt: timestamp,
    vendor: "Atlassian",
    ...overrides
  };
}

describe("RemediationDetail create ticket", () => {
  afterEach(() => vi.restoreAllMocks());

  it("creates a ticket against the selected ticketing integration", async () => {
    const openRemediation = remediation();
    const ticketed = remediation({
      status: "InProgress",
      ticketId: "JIRA-42",
      ticketIntegrationId: integrationId,
      ticketState: "Open",
      ticketStateLabel: "Created",
      ticketSyncedAt: timestamp,
      ticketSystem: "Jira"
    });

    vi.spyOn(api, "getRemediation")
      .mockResolvedValueOnce(openRemediation)
      .mockResolvedValue(ticketed);
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([
      ticketingIntegration(),
      {
        ...ticketingIntegration({
          category: "Cloud",
          integrationId: "55555555-5555-4555-8555-555555555555",
          product: "AWS",
          vendor: "Amazon",
          permissionsSummary: { connectorKey: "aws" }
        })
      }
    ]);
    const createTicket = vi.spyOn(api, "createRemediationTicket").mockResolvedValue({
      remediation: ticketed,
      ticket: {
        evidenceSummary: "Evidence IDs: ",
        integrationId,
        status: "InProgress",
        system: "Jira",
        ticketId: "JIRA-42"
      }
    });

    render(<RemediationDetail id={remediationId} />);

    expect(
      await screen.findByRole("button", { name: "Create ticket" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Select PSA/RMM destination for this remediation")
    ).toHaveValue(integrationId);
    expect(screen.queryByText("Open integrations")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Create ticket" }));

    await waitFor(() =>
      expect(createTicket).toHaveBeenCalledWith(remediationId, {
        integrationId
      })
    );
    expect(
      await screen.findByText(/Ticket created — Jira·JIRA-42/u)
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Synchronize state" })
    ).toBeInTheDocument();
  });

  it("shows NotConfigured with integrations link when no ticketing destination exists", async () => {
    vi.spyOn(api, "getRemediation").mockResolvedValue(remediation());
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([
      {
        ...ticketingIntegration({
          category: "Cloud",
          product: "AWS",
          vendor: "Amazon",
          permissionsSummary: { connectorKey: "aws" }
        })
      }
    ]);
    const createTicket = vi.spyOn(api, "createRemediationTicket");

    render(<RemediationDetail id={remediationId} />);

    expect(
      await screen.findByText("No ticketing destination connected")
    ).toBeInTheDocument();
    const integrationsLink = screen.getByRole("link", {
      name: /Open integrations/u
    });
    expect(integrationsLink).toHaveAttribute("href", "/integrations");
    expect(
      screen.queryByRole("button", { name: "Create ticket" })
    ).not.toBeInTheDocument();
    expect(createTicket).not.toHaveBeenCalled();
  });

  it("surfaces create-ticket failures without leaving the create UI", async () => {
    vi.spyOn(api, "getRemediation").mockResolvedValue(remediation());
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([
      ticketingIntegration()
    ]);
    vi.spyOn(api, "createRemediationTicket").mockRejectedValue(
      new Error("Integration not found for this tenant.")
    );

    render(<RemediationDetail id={remediationId} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Create ticket" })
    );

    expect(
      await screen.findByRole("alert")
    ).toHaveTextContent("Integration not found for this tenant.");
    expect(
      screen.getByRole("button", { name: "Create ticket" })
    ).toBeInTheDocument();
  });
});

describe("RemediationDetail auto-revalidate honesty (O5)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("exposes auto-revalidate CTA without customer-facing auto-mitigate copy", async () => {
    vi.spyOn(api, "getRemediation").mockResolvedValue(remediation());
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    const autoRevalidate = vi.spyOn(api, "autoRevalidate").mockResolvedValue({
      actionApplied: false as const,
      autoExecuted: false,
      closedLoop: "verdict->planner->mark-ready->revalidate->evidence",
      plan: {
        objective: "Close exposure via operator change, then re-measure",
        steps: [
          {
            order: 1,
            title: "Apply network control",
            action: "Human or IaC applies the change"
          },
          {
            order: 2,
            title: "Auto-revalidate (measured re-test)",
            action: "Re-run the targeted validation"
          }
        ]
      },
      verification: {
        verificationEvent: { outcome: "StillOpen" }
      }
    });

    const { container } = render(<RemediationDetail id={remediationId} />);

    expect(
      await screen.findByRole("button", { name: "Run auto-revalidate" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Auto-revalidate closed loop")
    ).toBeInTheDocument();
    // Customer-facing UI must not market "auto-mitigate" as a control push.
    expect(container.textContent).not.toMatch(/auto-mitigate/i);
    expect(
      screen.getByText(/This is not a control-plane push/u)
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Run auto-revalidate" })
    );

    await waitFor(() =>
      expect(autoRevalidate).toHaveBeenCalledWith(remediationId)
    );
    // Prefer text match: role=status name computation varies by testing-library.
    await waitFor(() => {
      expect(container.textContent).toMatch(
        /Auto-revalidate complete — no configuration was pushed/
      );
    });
    expect(container.textContent).toMatch(/actionApplied=false/);
    expect(container.textContent).not.toMatch(/auto-mitigate/i);
  });
});
