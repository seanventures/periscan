import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SecurityFeedOperatorItem } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { SecurityFeedPinReview } from "./security-feed-pin-review";

const checkedAt = "2026-09-17T12:00:00.000Z";
const digest =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function feed(
  overrides: Partial<SecurityFeedOperatorItem> &
    Pick<SecurityFeedOperatorItem, "id">
): SecurityFeedOperatorItem {
  return {
    autoExecute: false,
    contentVersionStatus: "Current",
    executablePinFlipped: false,
    lastCheckedAt: checkedAt,
    lastDigest: digest,
    liveSupported: false,
    pin: { kind: "version", value: "v8.30.0" },
    spdxLicenseId: "MIT",
    updatePolicy: "scheduled",
    ...overrides
  };
}

describe("SecurityFeedPinReview", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists toolchain-bound feeds with PendingReview versus the recorded pin", async () => {
    vi.spyOn(api, "listSecurityFeeds").mockResolvedValue([
      feed({
        contentVersionStatus: "PendingReview",
        id: "gitleaks",
        pin: { kind: "version", value: "v8.30.0" }
      }),
      feed({
        contentVersionStatus: "Current",
        id: "yara",
        pin: { kind: "version", value: "4.5.2" },
        spdxLicenseId: "BSD-3-Clause"
      })
    ]);

    render(<SecurityFeedPinReview />);

    expect(
      await screen.findByRole("table", { name: /security-feed pins/i })
    ).toBeInTheDocument();
    expect(screen.getByText("gitleaks")).toBeInTheDocument();
    expect(screen.getByText("yara")).toBeInTheDocument();
    expect(screen.getByText("PendingReview")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("v8.30.0")).toBeInTheDocument();
    expect(screen.getByText("4.5.2")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
    expect(screen.getByText("BSD-3-Clause")).toBeInTheDocument();
  });

  it("keeps executable pins unflipped and never offers YAML evaluation", async () => {
    vi.spyOn(api, "listSecurityFeeds").mockResolvedValue([
      feed({
        contentVersionStatus: "PendingReview",
        id: "atomic-yaml",
        pin: {
          kind: "sha",
          value: "11ff111ace63e02825dd44ce8246800203a10ce8"
        }
      })
    ]);

    render(<SecurityFeedPinReview />);

    expect(await screen.findByText("atomic-yaml")).toBeInTheDocument();
    expect(screen.getByText("PendingReview")).toBeInTheDocument();
    expect(screen.getAllByText(/not flipped/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/YAML is never evaluated/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /eval|execute|apply yaml|start/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText("liveSupported")).not.toBeInTheDocument();
    expect(screen.queryByText("LIVE_OFFENSIVE")).not.toBeInTheDocument();
    expect(screen.queryByText("4.0")).not.toBeInTheDocument();
    expect(screen.queryByText("5.0")).not.toBeInTheDocument();
  });

  it("marks rustinel-rules DRL as Community pack fail-closed", async () => {
    vi.spyOn(api, "listSecurityFeeds").mockResolvedValue([
      feed({
        contentVersionStatus: "Rejected",
        id: "rustinel-rules",
        lastDigest: null,
        pin: { kind: "unpinned", value: null },
        spdxLicenseId: "LicenseRef-DRL-1.1",
        updatePolicy: "manual"
      })
    ]);

    render(<SecurityFeedPinReview />);

    const row = await screen.findByRole("row", { name: /rustinel-rules/i });
    expect(row).toHaveTextContent("LicenseRef-DRL-1.1");
    expect(row).toHaveTextContent(/fail-closed/i);
    expect(row).toHaveTextContent(/unpinned/i);
    expect(row).toHaveTextContent("Rejected");
    expect(row).toHaveTextContent(/not flipped/i);
  });

  it("shows an honest error when the pin listing cannot load", async () => {
    vi.spyOn(api, "listSecurityFeeds").mockRejectedValue(
      new Error("Unable to read security feeds")
    );

    render(<SecurityFeedPinReview />);

    expect(
      await screen.findByText("Unable to read security feeds")
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });
});
