import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  InfrastructureChangeRequest,
  Integration
} from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { IacRemediationWorkspace } from "./iac-remediation-workspace";

const timestamp = "2026-07-15T16:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const remediationId = "22222222-2222-4222-8222-222222222222";
const integrationId = "33333333-3333-4333-8333-333333333333";
const changeId = "44444444-4444-4444-8444-444444444444";
const previewHash = "a".repeat(64);

const integration: Integration = {
  authType: "pat",
  category: "Code",
  config: { connectorKey: "github", mockMode: false },
  createdAt: timestamp,
  healthStatus: "Healthy",
  integrationId,
  lastSyncAt: null,
  nextSyncAt: null,
  permissionsSummary: {
    connectorKey: "github",
    requiredPermissions: ["contents:read"]
  },
  product: "GitHub Cloud",
  status: "Connected",
  syncFrequency: null,
  tenantId,
  updatedAt: timestamp,
  vendor: "GitHub"
};

function change(
  state: InfrastructureChangeRequest["state"]
): InfrastructureChangeRequest {
  return {
    applicationReceipt: [
      "PullRequestOpened",
      "ChecksPassing",
      "MergedAwaitingVerification"
    ].includes(state)
      ? {
          branchName: "periscan/remediation-22222222-test",
          checks:
            state === "ChecksPassing" || state === "MergedAwaitingVerification"
              ? {
                  conclusion: "Passing",
                  names: ["terraform-plan"],
                  refreshedAt: timestamp
                }
              : undefined,
          commitSha: "commit-sha",
          openedAt: timestamp,
          pullRequestNumber: 42,
          pullRequestUrl: "https://github.com/periscan/secure-infra/pull/42"
        }
      : null,
    appliedAt:
      state === "AwaitingApproval" || state === "Approved" ? null : timestamp,
    approvedAt: state === "AwaitingApproval" ? null : timestamp,
    approvedBy: state === "AwaitingApproval" ? null : tenantId,
    createdAt: timestamp,
    failureReason: null,
    iacChangeRequestId: changeId,
    idempotencyKey: "iac-test-idempotency-key",
    integrationId,
    manifest: {
      actionType: "InfrastructureAsCodePullRequest",
      afterContent: "force_destroy = false\n",
      afterContentHash: "b".repeat(64),
      baseBranch: "main",
      beforeContent: "force_destroy = true\n",
      beforeContentHash: "c".repeat(64),
      beforeSha: "base-file-sha",
      blastRadius: "One repository file on a review branch.",
      branchName: "periscan/remediation-22222222-test",
      expectedWriteOperations: [
        "Create branch",
        "Commit file",
        "Open pull request"
      ],
      filePath: "infra/main.tf",
      pullRequestBody: "Harden the evidence bucket.",
      pullRequestTitle: "Harden evidence bucket lifecycle",
      repository: { name: "secure-infra", owner: "periscan" },
      rollback: {
        availableUntilMerged: true,
        operation: "Close pull request and delete branch."
      },
      unifiedDiff:
        "--- a/infra/main.tf\n+++ b/infra/main.tf\n-force_destroy = true\n+force_destroy = false",
      verification: {
        ciChecksRequired: true,
        freshPeriscanRevalidationRequired: true,
        mergeDoesNotEqualFixed: true
      }
    },
    previewHash,
    remediationId,
    rollbackReceipt: null,
    rolledBackAt: null,
    state,
    tenantId,
    updatedAt: timestamp
  };
}

describe("IacRemediationWorkspace", () => {
  afterEach(() => vi.restoreAllMocks());

  it("previews the exact diff and carries its hash through approval and PR creation", async () => {
    vi.spyOn(api, "listIntegrations").mockResolvedValue([integration]);
    vi.spyOn(api, "listInfrastructureChanges").mockResolvedValue([]);
    const preview = vi
      .spyOn(api, "previewInfrastructureChange")
      .mockResolvedValue(change("AwaitingApproval"));
    const confirm = vi
      .spyOn(api, "confirmInfrastructureChange")
      .mockResolvedValueOnce(change("Approved"))
      .mockResolvedValueOnce(change("PullRequestOpened"));

    render(<IacRemediationWorkspace remediationId={remediationId} />);

    fireEvent.change(await screen.findByLabelText("Repository owner"), {
      target: { value: "periscan" }
    });
    fireEvent.change(screen.getByLabelText("Repository"), {
      target: { value: "secure-infra" }
    });
    fireEvent.change(screen.getByLabelText("File path"), {
      target: { value: "infra/main.tf" }
    });
    fireEvent.change(screen.getByLabelText("Pull request title"), {
      target: { value: "Harden evidence bucket lifecycle" }
    });
    fireEvent.change(screen.getByLabelText("Complete proposed file"), {
      target: { value: "force_destroy = false\n" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Preview exact diff" }));

    await waitFor(() => expect(preview).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(previewHash)).toBeInTheDocument();
    expect(
      screen.getByLabelText("Exact infrastructure diff")
    ).toHaveTextContent("force_destroy = false");
    fireEvent.click(screen.getByRole("button", { name: "Approve exact hash" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Open pull request" })
    );
    expect(await screen.findByText("Open PR #42 ↗")).toBeInTheDocument();
    expect(confirm).toHaveBeenNthCalledWith(
      1,
      changeId,
      "approve",
      previewHash
    );
    expect(confirm).toHaveBeenNthCalledWith(
      2,
      changeId,
      "execute",
      previewHash
    );
    expect(screen.getByText(/It cannot merge/u)).toBeInTheDocument();
  });

  it("makes the post-merge verification gate explicit", async () => {
    vi.spyOn(api, "listIntegrations").mockResolvedValue([integration]);
    vi.spyOn(api, "listInfrastructureChanges").mockResolvedValue([
      change("MergedAwaitingVerification")
    ]);

    render(<IacRemediationWorkspace remediationId={remediationId} />);

    expect(await screen.findByText("Merge is not proof.")).toBeInTheDocument();
    expect(
      screen.getByText(/Run the fresh targeted re-test below/u)
    ).toBeInTheDocument();
  });
});
