import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { RemediationWorkbench } from "./remediation-workbench";

const { navigated } = vi.hoisted(() => ({ navigated: [] as string[] }));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        event.preventDefault();
        navigated.push(href);
      }}
    >
      {children}
    </a>
  )
}));

describe("RemediationWorkbench empty (P09)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a single primary CTA on empty list", async () => {
    vi.spyOn(api, "listRemediations").mockResolvedValue([]);

    render(<RemediationWorkbench />);

    expect(await screen.findByTestId("remediation-empty")).toBeInTheDocument();
    const primary = screen.getByTestId("remediation-empty-primary-cta");
    expect(primary).toHaveAttribute("href", "/findings");
    expect(primary).toHaveTextContent(/Review findings/i);
    expect(
      screen.queryByTestId("remediation-header-primary-cta")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /open active findings/i })
    ).not.toBeInTheDocument();
    // No competing secondary CTA on empty.
    expect(
      screen.queryByRole("link", { name: /Run a Validation Snapshot/i })
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole("link", { name: /Review findings/i })).toHaveLength(
        1
      );
    });
  });
});

describe("RemediationWorkbench task titles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/remediation");
  });

  it("distinguishes duplicate generic remediation titles by location or fingerprint", async () => {
    const timestamp = "2026-07-15T16:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const generic =
      "Own and remediate this validated finding; re-run the originating module or snapshot to verify.";
    const leakA = {
      createdAt: timestamp,
      dueAt: null,
      evidenceIds: ["55555555-5555-4555-8555-555555555555"],
      owner: null,
      recommendedAction: generic,
      relatedExposureId: null,
      relatedFindingFingerprint:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      relatedPathEvidenceBasis: "Measured" as const,
      relatedPathId: null,
      remediationId: "22222222-2222-4222-8222-222222222221",
      status: "Open" as const,
      technicalSteps: ["Rotate the secret in leaked.js (slack-app-token)."],
      tenantId,
      ticketId: null,
      ticketIntegrationId: null,
      ticketState: null,
      ticketStateLabel: null,
      ticketSyncedAt: null,
      ticketSystem: null,
      updatedAt: timestamp,
      verificationMethod: "Re-run gitleaks.repo_secrets.",
      verificationRequired: true,
      lastVerifiedAt: null,
      latestVerification: null,
      nextVerificationAt: null
    };
    const leakB = {
      ...leakA,
      relatedFindingFingerprint:
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      remediationId: "22222222-2222-4222-8222-222222222222",
      technicalSteps: ["Rotate the secret in .env (generic-api-key)."]
    };
    vi.spyOn(api, "listRemediations").mockResolvedValue([leakA, leakB]);

    render(<RemediationWorkbench />);

    const titles = await screen.findAllByTestId(/remediation-title-/);
    expect(titles).toHaveLength(2);
    expect(titles[0]?.textContent).toMatch(/leaked\.js|slack-app-token|fp·aaaaaaaa/i);
    expect(titles[1]?.textContent).toMatch(/\.env|generic-api-key|fp·bbbbbbbb/i);
    expect(titles[0]?.textContent).not.toEqual(titles[1]?.textContent);
    expect(titles[0]?.textContent).not.toBe(generic);
    expect(screen.queryByText(/^Fixed$/)).not.toBeInTheDocument();
  });

  it("P3-REMTITLE: Open row title is the finding path · rule, not the generic action", async () => {
    const timestamp = "2026-07-15T16:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const remediationId = "b8c35357-3620-4e03-b4d5-435afe623282";
    const fingerprint =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    vi.spyOn(api, "listRemediations").mockResolvedValue([
      {
        createdAt: timestamp,
        dueAt: null,
        evidenceIds: ["55555555-5555-4555-8555-555555555555"],
        owner: null,
        recommendedAction:
          "Own and remediate this validated finding; re-run the originating module or snapshot to verify.",
        relatedExposureId: null,
        relatedFindingFingerprint: fingerprint,
        relatedPathEvidenceBasis: "Measured" as const,
        relatedPathId: null,
        remediationId,
        status: "Open" as const,
        technicalSteps: [
          "Confirm ownership and target SLA for this finding fingerprint.",
          "Apply the smallest fix that addresses the measured or correlated cause.",
          "Re-run the originating validation module or Validation Snapshot; do not mark Fixed without a re-test."
        ],
        tenantId,
        ticketId: null,
        ticketIntegrationId: null,
        ticketState: null,
        ticketStateLabel: null,
        ticketSyncedAt: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod:
          "Re-run the originating module or snapshot for this finding fingerprint and compare evidence before treating the risk as fixed.",
        verificationRequired: true,
        lastVerifiedAt: null,
        latestVerification: null,
        nextVerificationAt: null
      }
    ]);
    vi.spyOn(api, "listFindings").mockResolvedValue([
      {
        fingerprint,
        location: "leaked.js:2",
        ruleId: "slack-bot-token",
        title: "EXV SecretExposure"
      }
    ] as never);

    render(<RemediationWorkbench />);

    const title = await screen.findByTestId(`remediation-title-${remediationId}`);
    await waitFor(() => {
      expect(title).toHaveTextContent("leaked.js:2 · slack-bot-token");
    });
    expect(title).not.toHaveTextContent(/Own and remediate/i);
    expect(title).not.toHaveTextContent(/fp·/i);

    const row = screen.getByTestId(`remediation-row-${remediationId}`);
    const link = within(row).getByTestId(`remediation-row-link-${remediationId}`);
    expect(link).toHaveAttribute("href", `/remediation/${remediationId}`);
    expect(within(row).getByText(/^Open$/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mark (as )?fixed/i })
    ).not.toBeInTheDocument();
  });
});

describe("RemediationWorkbench Open row opens detail (P2-VERIFYUI)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    navigated.length = 0;
    window.history.replaceState(null, "", "/remediation");
  });

  it("clicking the Open list row follows /remediation/:id and does not mark Fixed", async () => {
    const timestamp = "2026-07-15T16:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const remediationId = "22222222-2222-4222-8222-222222222221";
    vi.spyOn(api, "listRemediations").mockResolvedValue([
      {
        createdAt: timestamp,
        dueAt: null,
        evidenceIds: ["55555555-5555-4555-8555-555555555555"],
        owner: null,
        recommendedAction:
          "Own and remediate this validated finding; re-run the originating module or snapshot to verify.",
        relatedExposureId: null,
        relatedFindingFingerprint:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        relatedPathEvidenceBasis: "Measured" as const,
        relatedPathId: null,
        remediationId,
        status: "Open" as const,
        technicalSteps: ["Rotate the secret in leaked.js (slack-app-token)."],
        tenantId,
        ticketId: null,
        ticketIntegrationId: null,
        ticketState: null,
        ticketStateLabel: null,
        ticketSyncedAt: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod: "Re-run gitleaks.repo_secrets.",
        verificationRequired: true,
        lastVerifiedAt: null,
        latestVerification: null,
        nextVerificationAt: null
      }
    ]);

    render(<RemediationWorkbench />);

    const row = await screen.findByTestId(`remediation-row-${remediationId}`);
    const link = within(row).getByTestId(
      `remediation-row-link-${remediationId}`
    );
    expect(link).toHaveAttribute("href", `/remediation/${remediationId}`);
    expect(link).toHaveAttribute("data-remediation-row-link");
    expect(link).toHaveAccessibleName(/open remediation/i);
    expect(
      screen.queryByRole("button", { name: /mark (as )?fixed/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/^Fixed$/)).not.toBeInTheDocument();

    fireEvent.click(row);
    expect(navigated).toEqual([`/remediation/${remediationId}`]);
  });
});

describe("RemediationWorkbench header (P3-HEADERCTA)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    navigated.length = 0;
    window.history.replaceState(null, "", "/remediation");
  });

  it("does not compete with the Open row using a header Open Active findings primary", async () => {
    const timestamp = "2026-07-15T16:00:00.000Z";
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const remediationId = "22222222-2222-4222-8222-222222222221";
    vi.spyOn(api, "listRemediations").mockResolvedValue([
      {
        createdAt: timestamp,
        dueAt: null,
        evidenceIds: ["55555555-5555-4555-8555-555555555555"],
        owner: null,
        recommendedAction:
          "Own and remediate this validated finding; re-run the originating module or snapshot to verify.",
        relatedExposureId: null,
        relatedFindingFingerprint:
          "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        relatedPathEvidenceBasis: "Measured" as const,
        relatedPathId: null,
        remediationId,
        status: "Open" as const,
        technicalSteps: ["Rotate the secret in leaked.js (slack-app-token)."],
        tenantId,
        ticketId: null,
        ticketIntegrationId: null,
        ticketState: null,
        ticketStateLabel: null,
        ticketSyncedAt: null,
        ticketSystem: null,
        updatedAt: timestamp,
        verificationMethod: "Re-run gitleaks.repo_secrets.",
        verificationRequired: true,
        lastVerifiedAt: null,
        latestVerification: null,
        nextVerificationAt: null
      }
    ]);

    render(<RemediationWorkbench />);

    const row = await screen.findByTestId(`remediation-row-${remediationId}`);
    const link = within(row).getByTestId(
      `remediation-row-link-${remediationId}`
    );
    expect(link).toHaveAttribute("href", `/remediation/${remediationId}`);
    expect(within(row).getByText(/^Open$/)).toBeInTheDocument();
    expect(screen.getByTestId("remediation-first-hour")).toBeInTheDocument();
    expect(
      screen.queryByTestId("remediation-header-primary-cta")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /open active findings/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /mark (as )?fixed/i })
    ).not.toBeInTheDocument();
  });
});
