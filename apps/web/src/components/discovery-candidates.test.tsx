import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Asset, AssetOwnershipSurface, Scope } from "@periscan/shared";

import { browserPeriscanApiClient as api } from "../lib/periscan-api-client";
import { PeriscanApiClientError } from "../lib/periscan-api-client";
import { DiscoveryCandidates } from "./discovery-candidates";

const now = "2026-07-15T12:00:00.000Z";
const tenantId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const assetId = "77777777-7777-4777-8777-777777777777";
const scopeId = "88888888-8888-4888-8888-888888888888";

const candidateAsset: Asset = {
  assetId,
  assetType: "Host",
  businessCriticality: "Moderate",
  createdAt: now,
  environment: "production",
  firstSeenAt: now,
  identifiers: { publicDnsName: "shadow.example.net" },
  internetExposed: true,
  lastSeenAt: now,
  name: "shadow.example.net",
  owner: null,
  status: "Active",
  tags: [],
  tenantId,
  updatedAt: now,
  valuation: null
};

const ownership: AssetOwnershipSurface = {
  entries: [
    {
      asset: candidateAsset,
      basis:
        "Internet-facing source observation has no matching verified domain scope.",
      confidence: 0,
      evidenceIds: ["33333333-3333-4333-8333-333333333333"],
      hostnames: ["shadow.example.net"],
      latestObservedAt: now,
      lifecycle: "New",
      matchedScopeId: null,
      matchedScopeValue: null,
      ownershipStatus: "UnattributedCandidate",
      review: null,
      sourceCount: 1
    }
  ],
  generatedAt: now,
  summary: {
    attributedAssetCount: 0,
    averageAttributedConfidence: 0,
    internetFacingAssetCount: 1,
    unattributedCandidateCount: 1,
    verifiedRootCount: 0
  }
};

const pendingScope: Scope = {
  assetClass: "BusinessApplication",
  businessCriticality: "Moderate",
  createdAt: now,
  createdBy: userId,
  effectiveMaxSafetyLevel: "PassiveReadOnly",
  externalValidationProfileId: null,
  isOperationalTechnology: false,
  lastPostureCheckAt: null,
  maxSafetyLevel: "PassiveReadOnly",
  nextPostureCheckAt: null,
  purdueLevel: null,
  safetyRestrictionReason: "Pending verification.",
  scopeId,
  scopeType: "Subdomain",
  segmentName: null,
  sensitivity: "Moderate",
  tags: [],
  tenantId,
  updatedAt: now,
  value: "shadow.example.net",
  verificationExpiresAt: null,
  verificationMethod: "DNS_TXT",
  verificationStale: false,
  verificationStatus: "Pending",
  verificationToken: "periscan-token",
  verifiedAt: null,
  verifiedBy: null
};

describe("DiscoveryCandidates", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists pending promote-to-scope candidates and cannot Validate invasive until verified", async () => {
    vi.spyOn(api, "getAssetOwnershipSurface").mockResolvedValue(ownership);
    vi.spyOn(api, "listScopes").mockResolvedValue([]);
    const createScope = vi.spyOn(api, "createScope").mockResolvedValue(pendingScope);

    render(<DiscoveryCandidates />);

    expect(
      await screen.findByRole("heading", { name: /Discovery candidates/i })
    ).toBeInTheDocument();
    expect(screen.getByText("shadow.example.net")).toBeInTheDocument();
    expect(
      screen.getAllByText(/pending promote-to-scope/i).length
    ).toBeGreaterThan(0);

    const invasive = screen.getByTestId("discovery-invasive-gate");
    expect(invasive).toHaveTextContent(/until this candidate is verified/i);
    expect(
      screen.queryByRole("button", { name: /Validate invasive/i })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /Promote to pending scope/i })
    );

    await waitFor(() => {
      expect(createScope).toHaveBeenCalledWith({
        scopeType: "Subdomain",
        value: "shadow.example.net"
      });
    });
    expect(await screen.findByText(/^Pending$/)).toBeInTheDocument();
    expect(screen.getByTestId("discovery-invasive-gate")).toHaveTextContent(
      /until this candidate is verified/i
    );
    expect(document.body.textContent).toMatch(/Entra/);
    expect(document.body.textContent).toMatch(/Okta/);
    expect(document.body.textContent).toMatch(/JumpCloud/);
    expect(document.body.textContent).toMatch(/CAASM candidates/i);
    expect(document.body.textContent).toMatch(/High-danger/i);
    expect(document.body.textContent).not.toMatch(/NodeZero/i);
    expect(document.body.textContent).not.toMatch(/automated pentest/i);
    expect(document.body.textContent).not.toMatch(/always-on BAS/i);
    expect(document.body.textContent).not.toMatch(/CTEM\s*%/i);
  });

  it("shows honest empty when the ownership API returns 404", async () => {
    vi.spyOn(api, "getAssetOwnershipSurface").mockRejectedValue(
      new PeriscanApiClientError(404, "Not found")
    );
    vi.spyOn(api, "listScopes").mockResolvedValue([]);

    render(<DiscoveryCandidates />);

    expect(
      await screen.findByTestId("discovery-candidates-empty")
    ).toBeInTheDocument();
    expect(screen.getByTestId("discovery-candidates-empty")).toHaveTextContent(
      /not available from the API/i
    );
  });
});
