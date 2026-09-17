import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { RemediationWorkbench } from "./remediation-workbench";

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
});
