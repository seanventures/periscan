import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Integration, RemediationTask } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { RemediationDetail } from "./remediation-detail";

vi.mock("./governed-remediation-action", () => ({
  GovernedRemediationAction: () => (
    <div data-testid="governed-remediation-action">
      Governed action manifest
    </div>
  )
}));

vi.mock("./iac-remediation-workspace", () => ({
  IacRemediationWorkspace: () => (
    <div data-testid="iac-remediation-workspace">
      A real GitHub PAT integration is required
    </div>
  )
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
    const createTicket = vi
      .spyOn(api, "createRemediationTicket")
      .mockResolvedValue({
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

    await screen.findByTestId("remediation-first-hour-primary");
    openMoreActions();

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

    await screen.findByTestId("remediation-first-hour-primary");
    openMoreActions();

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

    await screen.findByTestId("remediation-first-hour-primary");
    openMoreActions();

    fireEvent.click(
      await screen.findByRole("button", { name: "Create ticket" })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Integration not found for this tenant."
    );
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

    await screen.findByTestId("remediation-first-hour-primary");
    openMoreActions();

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

function openMoreActions() {
  const more = screen.getByTestId("remediation-more-actions");
  (more as HTMLDetailsElement).open = true;
  return more;
}

describe("RemediationDetail first-hour chrome (P2-MALL)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows one Re-verify primary; kitchen stays under closed More", async () => {
    vi.spyOn(api, "getRemediation").mockResolvedValue(remediation());
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);

    render(<RemediationDetail id={remediationId} />);

    const firstHour = await screen.findByTestId("remediation-first-hour");
    const primary = screen.getByTestId("remediation-first-hour-primary");
    expect(primary).toHaveTextContent(/^Re-verify$/);
    expect(firstHour).toContainElement(primary);
    expect(
      screen.getAllByTestId("remediation-first-hour-primary")
    ).toHaveLength(1);
    expect(
      within(firstHour).queryByRole("button", { name: "Run auto-revalidate" })
    ).not.toBeInTheDocument();
    expect(
      within(firstHour).queryByRole("button", { name: "Create ticket" })
    ).not.toBeInTheDocument();
    expect(
      within(firstHour).queryByRole("link", { name: /Open integrations/i })
    ).not.toBeInTheDocument();
    expect(
      within(firstHour).queryByTestId("governed-remediation-action")
    ).not.toBeInTheDocument();
    expect(
      within(firstHour).queryByTestId("iac-remediation-workspace")
    ).not.toBeInTheDocument();
    expect(firstHour).toHaveTextContent(/Verification timeline/i);

    const more = screen.getByTestId("remediation-more-actions");
    expect(more).not.toHaveAttribute("open");
    expect(
      within(more).getByTestId("governed-remediation-action")
    ).toBeInTheDocument();
    expect(
      within(more).getByTestId("iac-remediation-workspace")
    ).toBeInTheDocument();
  });

  it("reveals ticketing, auto-revalidate, GitHub PAT, and governed action after opening More", async () => {
    vi.spyOn(api, "getRemediation").mockResolvedValue(remediation());
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([
      ticketingIntegration()
    ]);

    render(<RemediationDetail id={remediationId} />);

    await screen.findByTestId("remediation-first-hour-primary");
    openMoreActions();

    expect(
      screen.getByRole("button", { name: "Run auto-revalidate" })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Create ticket" })).toBeVisible();
    expect(screen.getByTestId("governed-remediation-action")).toBeVisible();
    expect(screen.getByTestId("iac-remediation-workspace")).toBeVisible();
    expect(screen.getByTestId("iac-remediation-workspace")).toHaveTextContent(
      /GitHub PAT/
    );
  });

  it("Re-verify runs from first-hour chrome without opening More", async () => {
    vi.spyOn(api, "getRemediation").mockResolvedValue(remediation());
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    const verifyRemediation = vi
      .spyOn(api, "verifyRemediation")
      .mockResolvedValue({
        attackPath: null,
        mission: {} as never,
        remediation: remediation({ status: "Fixed" }),
        run: {} as never,
        verificationEvent: {
          createdAt: timestamp,
          evidenceIds: [],
          measuredRevalidation: true,
          newState: "Fixed",
          outcome: "Fixed",
          reSyncedConnectorKeys: [],
          selectedModuleIds: ["gitleaks.repo_secrets"],
          tenantId,
          updatedAt: timestamp,
          verificationId: "66666666-6666-4666-8666-666666666666",
          verifiedAt: timestamp,
          remediationId
        }
      });

    render(<RemediationDetail id={remediationId} />);

    fireEvent.click(
      await screen.findByTestId("remediation-first-hour-primary")
    );

    await waitFor(() =>
      expect(verifyRemediation).toHaveBeenCalledWith(remediationId)
    );
    expect(screen.getByTestId("remediation-more-actions")).not.toHaveAttribute(
      "open"
    );
  });

  it("keeps Re-verify as the first-hour primary after a measured Fixed hop", async () => {
    const event = {
      createdAt: timestamp,
      evidenceIds: [],
      exposureReCorrelated: false,
      measuredRevalidation: true,
      newState: "Fixed" as const,
      outcome: "Fixed" as const,
      previousEvidenceBasis: "Measured" as const,
      previousState: "Validated" as const,
      reSyncedConnectorKeys: [],
      retestMethod: "validation-module",
      selectedModuleIds: ["gitleaks.repo_secrets"],
      tenantId,
      updatedAt: timestamp,
      verificationId: "66666666-6666-4666-8666-666666666666",
      verifiedAt: timestamp,
      remediationId
    };
    vi.spyOn(api, "getRemediation").mockResolvedValue(
      remediation({
        status: "Fixed",
        latestVerification: {
          measuredRevalidation: true,
          outcome: "Fixed",
          verifiedAt: timestamp
        }
      })
    );
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([event]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);

    render(<RemediationDetail id={remediationId} />);

    expect(
      await screen.findByTestId("remediation-first-hour-primary")
    ).toHaveTextContent(/^Re-verify$/);
    const firstHour = screen.getByTestId("remediation-first-hour");
    expect(
      within(firstHour).queryByRole("button", { name: "Run auto-revalidate" })
    ).not.toBeInTheDocument();
    expect(within(firstHour).getByText(/Measured re-test/i)).toBeVisible();
  });
});

describe("RemediationDetail title (P3-REMTITLE)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the finding path · rule as H1 when the stored action is generic", async () => {
    const fingerprint =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    vi.spyOn(api, "getRemediation").mockResolvedValue(
      remediation({
        recommendedAction:
          "Own and remediate this validated finding; re-run the originating module or snapshot to verify.",
        relatedFindingFingerprint: fingerprint,
        relatedPathId: null,
        technicalSteps: [
          "Confirm ownership and target SLA for this finding fingerprint.",
          "Apply the smallest fix that addresses the measured or correlated cause.",
          "Re-run the originating validation module or Validation Snapshot; do not mark Fixed without a re-test."
        ]
      })
    );
    vi.spyOn(api, "listVerificationEvents").mockResolvedValue([]);
    vi.spyOn(api, "listIntegrations").mockResolvedValue([]);
    vi.spyOn(api, "listFindings").mockResolvedValue([
      {
        fingerprint,
        location: "leaked.js:2",
        relatedRemediationIds: [remediationId],
        ruleId: "slack-bot-token",
        title: "EXV SecretExposure"
      }
    ] as never);

    render(<RemediationDetail id={remediationId} />);

    const heading = await screen.findByRole("heading", { level: 1 });
    await waitFor(() => {
      expect(heading).toHaveTextContent("leaked.js:2 · slack-bot-token");
    });
    expect(heading).not.toHaveTextContent(/Own and remediate/i);
    expect(heading).not.toHaveTextContent(/fp·/i);
    expect(screen.getByTestId("remediation-first-hour-primary")).toHaveTextContent(
      /^Re-verify$/
    );
    expect(screen.getByTestId("remediation-more-actions")).not.toHaveAttribute(
      "open"
    );
    expect(
      screen.queryByRole("button", { name: /mark (as )?fixed/i })
    ).not.toBeInTheDocument();
  });
});
